# VAPE STORE LOCATOR
- npm install
- import json file into pg admin
- make sure credentials match inside index.js

## packages
- npm install axios
- npm install dotenv

## sql Database instructions
- Step 1: CREATE DATABASE vaporstores;
- Step 2: CREATE TABLE stores (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    contact_info VARCHAR(255),
    image BYTEA,
    latitude DECIMAL(9,6),
    longitude DECIMAL (9,6),
);
- Step 3: CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    reviewer_name VARCHAR(255) NOT NULL
);