import express from "express";
import pg from "pg";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const upload = multer();
const app = express();
const PORT = process.env.PORT || 3009;

// Database connection
const db = new pg.Client({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

db.connect();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static("public"));

// Utility function to read recommended stores
function getRandomStores(stores, count) {
  return [...stores].sort(() => 0.5 - Math.random()).slice(0, count);
}

// Home Route
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    const stores = result.rows;

    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const allRecommendedStores = JSON.parse(
      fs.readFileSync(path.join(__dirname, 'recommended.json'), 'utf8')
    );    
    const recommendedStores = getRandomStores(allRecommendedStores, 3);

    res.render("index", { stores, googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY, recommendedStores, allRecommendedStores });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Fetch all stores
app.get("/stores", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fetch a single store
app.get("/store/:id", async (req, res) => {
  const storeId = req.params.id;
  try {
    const storeResult = await db.query("SELECT * FROM stores WHERE id = $1", [storeId]);
    const reviewsResult = await db.query("SELECT * FROM reviews WHERE store_id = $1", [storeId]);

    if (storeResult.rows.length === 0) return res.status(404).send("Store not found");

    res.render("store", { store: storeResult.rows[0], reviews: reviewsResult.rows });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add a store
app.post("/add-store", upload.single("image"), async (req, res) => {
  const { name, address, contact_info } = req.body;
  const image = req.file?.buffer || null;

  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;
    
    if (!location) return res.status(400).send("Unable to find coordinates for the provided address.");

    await db.query(
      "INSERT INTO stores(name, address, contact_info, image, latitude, longitude) VALUES($1, $2, $3, $4, $5, $6)",
      [name, address, contact_info, image, location.lat, location.lng]
    );

    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error inserting store or geocoding address");
  }
});

// Add a recommended store
app.post("/store/add", async (req, res) => {
  const { name, address, image } = req.body;

  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;
    if (!location) return res.status(400).json({ success: false, message: "Could not geocode address" });

    const result = await db.query(
      "INSERT INTO stores(name, address, contact_info, image, latitude, longitude) VALUES($1, $2, $3, $4, $5, $6) RETURNING id",
      [name, address, 'Added from recommendations', image, location.lat, location.lng]
    );

    res.json({ success: true, store: { id: result.rows[0].id, name, address, image } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/store/add", async (req, res) => {
  const { name, address, image } = req.body;

  try {
    // Insert into the database
    const [result] = await db.execute(
      "INSERT INTO stores (name, address, image) VALUES (?, ?, ?)",
      [name, address, image ? Buffer.from(image, "base64") : null]
    );

    const newStore = {
      id: result.insertId,
      name,
      address,
      image
    };

    res.json({ success: true, store: newStore });
  } catch (error) {
    console.error("Database error:", error);
    res.json({ success: false, error: "Failed to add store." });
  }
});


// Add a review
app.post("/add-review", async (req, res) => {
  const { storeId, rating, comment, reviewerName } = req.body;
  const query = "INSERT INTO reviews(store_id, rating, comment, reviewer_name) VALUES($1, $2, $3, $4)";
  const values = [storeId, rating, comment, reviewerName];

  try {
    await db.query(
      "INSERT INTO reviews(store_id, rating, comment, reviewer_name) VALUES($1, $2, $3, $4)",
      [storeId, rating, comment, reviewerName]
    );
    res.redirect("/store/" + storeId);
  } catch (err) {
    console.log(err)
    res.status(500).send("Error inserting review");
  }
});

// Delete a store
app.post("/store/:id/delete", async (req, res) => {
  try {
    await db.query("DELETE FROM stores WHERE id = $1", [req.params.id]);
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error deleting store");
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});