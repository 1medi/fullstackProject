import express from "express";
import pg from "pg";
import multer from "multer";
import axios from "axios";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

// Utility function to find store in recommended.json
function findStoreInRecommended(storeId) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const allRecommendedStores = JSON.parse(
    fs.readFileSync(path.join(__dirname, "recommended.json"), "utf8")
  );
  return allRecommendedStores.find((store) => store.id === storeId);
}

// Helper function to fetch place details
async function fetchPlaceDetails(placeId) {
  const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const placeDetailsResponse = await axios.get(placeDetailsUrl);
  const openingHours =
    placeDetailsResponse.data.result.opening_hours?.weekday_text; // Extract opening hours
  return {
    openingHours: Array.isArray(openingHours) ? openingHours : [openingHours],
  };
}

// Home Route
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    const stores = result.rows;
    const geocodePromises = stores.map(async (store) => {
      const address = store.address;
      const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        address
      )}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

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
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const allRecommendedStores = JSON.parse(
      fs.readFileSync(path.join(__dirname, "recommended.json"), "utf8")
    );
    const recommendedStores = getRandomStores(allRecommendedStores, 3);

    res.render("index", {
      stores,
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      recommendedStores,
      allRecommendedStores,
    });
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

app.get("/store/:id", async (req, res) => {
  const storeId = req.params.id;
  let store;
  let placeId;
  try {
    // Get store details
    const storeResult = await db.query("SELECT * FROM stores WHERE id = $1", [storeId]);
    const reviewsResult = await db.query(
      "SELECT * FROM reviews WHERE store_id = $1 ORDER BY created_at DESC",
      [storeId]
    );

    if (storeResult.rows.length > 0) {
      store = storeResult.rows[0];
      placeId = store.place_id;
    } else {
      const recommendedStore = findStoreInRecommended(storeId);
      if (recommendedStore) {
        store = recommendedStore;
        placeId = recommendedStore.place_id;
      }
    }

    if (!store || !placeId) {
      return res.status(404).send("Store not found");
    }

    res.render("store", {
      store,
      reviews: reviewsResult.rows,
      placeId,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send("Error retrieving store details");
  }
});

app.post("/add-store", upload.single("image"), async (req, res) => {
  const { name, address, contact_info } = req.body;
  console.log(req.body)

  if (req.file) {
    imagePath = req.file.buffer;
  }

  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    address
  )}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;
    const placeId = geocodeResponse.data.results[0]?.place_id;

    if (!location || !placeId) {
      return res
        .status(400)
        .send("Unable to find coordinates or place ID for the provided address.");
    }

    const latitude = location.lat;
    const longitude = location.lng;

    // Fetch place details to get opening and closing hours
    const { openingHours, closingHours } = await fetchPlaceDetails(placeId);

    // Insert into database
    const query =
      "INSERT INTO stores(name, address, contact_info, latitude, longitude, place_id, opening_hours) VALUES($1, $2, $3, $4, $5, $6, $7)";
    const values = [
      name,
      address,
      contact_info,
      latitude,
      longitude,
      placeId,
      openingHours,
    ];
    await db.query(query, values);

    res.redirect("/");
  } catch (err) {
    console.error(err); // Log the error details
    res.status(500).send("Error inserting store or geocoding address");
  }
});

// Add a recommended store
app.post("/store/add", async (req, res) => {
  const { name, address, image, place_id } = req.body; // Include place_id
  console.log("Received store data:", { name, address, image, place_id }); // Log the received data
  console.log("Request Body:", req.body); // Log the entire request body for debugging
  console.log("Inserting into database with Place ID:", place_id); // Log the place_id being inserted

  try {
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
      address
    )}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;
    if (!location)
      return res
        .status(400)
        .json({ success: false, message: "Could not geocode address" });

    const result = await db.query(
      "INSERT INTO stores(name, address, contact_info, image, latitude, longitude, place_id) VALUES($1, $2, $3, $4, $5, $6, $7) RETURNING id",
      [
        name,
        address,
        "Added from recommendations",
        image,
        location.lat,
        location.lng,
        place_id,
      ]
    );

    res.json({
      success: true,
      store: { id: result.rows[0].id, name, address, image },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post("/add-review", async (req, res) => {
  console.log("Request Body:", req.body); // Log the entire request body

  const { storeId, rating, comment, reviewerName, returnUrl } = req.body;
  let imagePath = null;

  if (req.file) {
    imagePath = req.file.path;
  }

  if (!storeId || !rating || !comment || !reviewerName) {
    return res.status(400).send("All fields are required.");
  }

  const query =
    "INSERT INTO reviews(store_id, rating, comment, reviewer_name) VALUES($1, $2, $3, $4)";
  const values = [storeId, rating, comment, reviewerName];

  try {
    await db.query(query, values); 
    return res.redirect(`/store/${storeId}`); 
  } catch (err) {
    res.status(500).send(err.message); 
  }
});

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
