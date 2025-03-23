import express from "express";
import pg from "pg";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config(); // Load .env variables

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

// Home Route
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    const stores = result.rows;

    // Geocode addresses to get latitude & longitude
    const geocodePromises = stores.map(async (store) => {
      const address = store.address;
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

      try {
        const geocodeResponse = await axios.get(geocodeUrl);
        const location = geocodeResponse.data.results[0]?.geometry?.location;

        if (location) {
          store.latitude = location.lat;
          store.longitude = location.lng;
        }
      } catch (geocodeError) {
        console.error("Geocoding error:", geocodeError);
      }
    });

    await Promise.all(geocodePromises);

    res.render("index", { stores, googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.get("/stores", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/store/:id", async (req, res) => {
  const storeId = req.params.id;
  try {
    const storeResult = await db.query("SELECT * FROM stores WHERE id = $1", [storeId]);
    const reviewsResult = await db.query("SELECT * FROM reviews WHERE store_id = $1", [storeId]);

    if (storeResult.rows.length === 0) {
      return res.status(404).send("Store not found");
    }

    const store = storeResult.rows[0];
    const reviews = reviewsResult.rows;

    res.render("store", { store, reviews });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// Add a store with geocoding
app.post("/add-store", upload.single("image"), async (req, res) => {
  const { name, address, contact_info } = req.body;
  const image = req.file?.buffer; // Get the image buffer

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;

    if (!location) {
      return res.status(400).send("Unable to find coordinates for the provided address.");
    }

    const latitude = location.lat;
    const longitude = location.lng;

    const query = "INSERT INTO stores(name, address, contact_info, image, latitude, longitude) VALUES($1, $2, $3, $4, $5, $6)";
    const values = [name, address, contact_info, image, latitude, longitude];

    await db.query(query, values);
    res.redirect("/");
  } catch (err) {
    res.status(500).send("Error inserting store or geocoding address");
  }
});

// Add a review
app.post("/add-review", async (req, res) => {
  const { storeId, rating, comment, reviewerName } = req.body;
  const query = "INSERT INTO reviews(store_id, rating, comment, reviewer_name) VALUES($1, $2, $3, $4)";
  const values = [storeId, rating, comment, reviewerName];

  try {
    await db.query(query, values);
    res.redirect("/store/" + storeId);
  } catch (err) {
    console.log(err)
    res.status(500).send("Error inserting review");
  }
});

// DELETE Store Route
app.post("/store/:id/delete", async (req, res) => {
  const storeId = req.params.id;

  try {
    await db.query("DELETE FROM stores WHERE id = $1", [storeId]);
    res.redirect("/");
  } catch (err) {
    console.error("Error deleting store:", err);
    res.status(500).send("Error deleting store");
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
