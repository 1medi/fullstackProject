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
app.use(express.static('public'));

// Helper function to fetch place details
async function fetchPlaceDetails(placeId) {
  const placeDetailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
  const placeDetailsResponse = await axios.get(placeDetailsUrl);
  const openingHours = placeDetailsResponse.data.result.opening_hours?.weekday_text; // Extract opening hours
  return {
    openingHours: Array.isArray(openingHours) ? openingHours : [openingHours]
  };
}

async function getPlaceIdFromDatabase(storeId) {
  try {
    const result = await db.query("SELECT place_id FROM stores WHERE id = $1", [storeId]);
    return result.rows.length > 0 ? result.rows[0].place_id : null; // Return the Place ID or null if not found
  } catch (error) {
    console.error('Error fetching Place ID:', error);
    return null; // Handle error gracefully
  }
}

// Home Route
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    const stores = result.rows;

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
        console.error('Geocoding error:', geocodeError);
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
  const placeId = await getPlaceIdFromDatabase(storeId); // Fetch the Place ID based on the store ID
  if (!placeId) {
    return res.status(404).send('Store not found');
  }
  try {
    const storeResult = await db.query("SELECT * FROM stores WHERE id = $1", [storeId]);
    const reviewsResult = await db.query("SELECT * FROM reviews WHERE store_id = $1", [storeId]);

    if (storeResult.rows.length === 0) {
      return res.status(404).send("Store not found");
    }
    
    const store = storeResult.rows[0];
    console.log("Place ID:", store.place_id);

    // Fetch place details to get opening and closing hours
    const { openingHours } = await fetchPlaceDetails(store.place_id);

    const reviews = reviewsResult.rows;
    console.log("Operating Hours:", openingHours); // Log the operating hours

    res.render("store", { placeId: placeId, store, reviews, formattedOpeningHours: openingHours });
  } catch (err) {
    res.status(500).send(err.message);
  }
});

app.post('/add-store', upload.single('image'), async (req, res) => {
  const { name, address, contact_info, parking } = req.body; 
  const image = req.file.buffer;
  const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;

  try {
    const geocodeResponse = await axios.get(geocodeUrl);
    const location = geocodeResponse.data.results[0]?.geometry?.location;
    const placeId = geocodeResponse.data.results[0]?.place_id; 

    if (!location || !placeId) {
      return res.status(400).send('Unable to find coordinates or place ID for the provided address.');
    }

    const latitude = location.lat;
    const longitude = location.lng;

    // Fetch place details to get opening and closing hours
    const { openingHours, closingHours } = await fetchPlaceDetails(placeId);

    // Insert into database
    const query = 'INSERT INTO stores(name, address, contact_info, image, latitude, longitude, parking, place_id, opening_hours) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9)';
    const values = [name, address, contact_info, image, latitude, longitude, parking, placeId, openingHours];
    await db.query(query, values);

    res.redirect('/');
  } catch (err) {
    console.error(err); // Log the error details
    res.status(500).send('Error inserting store or geocoding address');
  }
});

app.post('/add-review', upload.single('image'),  async (req, res) => {
  console.log('Request Body:', req.body); // Log the entire request body

  const { storeId, rating, comment, reviewerName } = req.body;
  let imagePath = null;

  if (req.file) {
    imagePath = req.file.path;
  }

  if (!storeId || !rating || !comment || !reviewerName) {
    return res.status(400).send('All fields are required.');
  }

  const query = 'INSERT INTO reviews(store_id, rating, comment, reviewer_name, image) VALUES($1, $2, $3, $4, $5)';
  const values = [storeId, rating, comment, reviewerName, imagePath];

  try {
    await db.query(query, values);
    res.redirect('/store/' + storeId);
  } catch (err) {
    console.error('Database error:', err);
    res.status(500).send('Error inserting review');
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
