import express from "express"
import pg from "pg"


const app = express();
const PORT = process.env.PORT || 3009;

// Database connection
const db = new pg.Client({
    user: 'postgres',
    host: 'localhost',
    database: 'vaporstores',
    password: '1625',
    port: 5432,
});

db.connect();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set('view engine', 'ejs');
app.use(express.static('public'));

// Home Route
app.get('/', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM stores');
        res.render('index', { stores: result.rows });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get('/store/:id', async (req, res) => {
    const storeId = req.params.id;
    try {
        const storeResult = await db.query('SELECT * FROM stores WHERE id = $1', [storeId]);
        const reviewsResult = await db.query('SELECT * FROM reviews WHERE store_id = $1', [storeId]);
        
        if (storeResult.rows.length === 0) {
            return res.status(404).send('Store not found');
        }

        const store = storeResult.rows[0];
        const reviews = reviewsResult.rows;

        res.render('store', { store, reviews });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// API to fetch stores
app.get('/api/stores', async (req, res) => {
    try {
        const result = await db.query('SELECT * FROM stores');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/store/:id', async (req, res) => {
    const storeId = req.params.id;
    try {
        const storeResult = await db.query('SELECT * FROM stores WHERE id = $1', [storeId]);
        const reviewsResult = await db.query('SELECT * FROM reviews WHERE store_id = $1', [storeId]);
        
        if (storeResult.rows.length === 0) {
            return res.status(404).send('Store not found');
        }

        const store = storeResult.rows[0];
        const reviews = reviewsResult.rows;

        res.render('store', { store, reviews });
    } catch (err) {
        res.status(500).send(err.message);
    }
});
app.post('/add-store', async (req, res) => {
    const { name, address, latitude, longitude, rating, contact_info } = req.body;
    try {
        await db.query(
            'INSERT INTO stores (name, address, latitude, longitude, rating, contact_info) VALUES ($1, $2, $3, $4, $5, $6)',
            [name, address, latitude, longitude, rating, contact_info]
        );
        res.redirect('/');
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => {
    console.log("Server running on http://localhost:", PORT);
});
