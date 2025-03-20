import express from "express";
import pg from "pg";
import multer from "multer"

const upload = multer();
const app = express();
const PORT = process.env.PORT || 3009;

// Database connection
const db = new pg.Client({
  user: "postgres",
  host: "localhost",
  database: "vaporstores",
  password: "1625",
  port: 5432,
});

db.connect();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static('public'));

// Home Route
app.get("/", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM stores");
    res.render("index", { stores: result.rows });
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
    const storeResult = await db.query("SELECT * FROM stores WHERE id = $1", [
      storeId,
    ]);
    const reviewsResult = await db.query(
      "SELECT * FROM reviews WHERE store_id = $1",
      [storeId]
    );

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

app.post('/add-store', upload.single('image'), (req, res) => {
  const { name, address, contact_info } = req.body;
  const image = req.file.buffer; // Get the image buffer

  const query = 'INSERT INTO stores(name, address, contact_info, image) VALUES($1, $2, $3, $4)';
  const values = [name, address, contact_info, image];

  db.query(query, values, (err) => {
      if (err) {
          return res.status(500).send('Error inserting data');
      }
      res.redirect('/'); // Redirect after successful addition
  });
});

app.post('/add-review', (req, res) => {
  const { storeId, rating, comment, reviewerName } = req.body;

  const query = 'INSERT INTO reviews(store_id, rating, comment, reviewer_name) VALUES($1, $2, $3, $4, $5)';
  const values = [storeId, rating, comment, reviewerName];

  db.query(query, values, (err) => {
      if (err) {
          return res.status(500).send('Error inserting review');
      }
      res.redirect('/store/' + storeId); // Redirect to the store page after successful addition
  });
});

app.listen(PORT, () => {
  console.log("Server running on http://localhost:", PORT);
});
