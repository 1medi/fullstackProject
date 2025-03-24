# VAPE STORE LOCATOR
## Madi, Brian, Deluka and Kenny

## packages
- npm install
- npm install axios
- npm install dotenv

## Create a .env file
- paste these into your .env file

    GOOGLE_MAPS_API_KEY=AIzaSyDcMs8Q8YSQQssB6s_kU_5ygLubCAKoAR0  
    DB_USER=postgres  
    DB_HOST=localhost  
    DB_NAME=vaporstores  
    DB_PASSWORD=change this to your password  
    DB_PORT=5432  
    PORT=3009  

## SQL Database Creation Instructions
- Step 1: CREATE DATABASE vaporstores;
- Step 2: CREATE TABLE stores (  
    id SERIAL PRIMARY KEY,  
    name VARCHAR(255) NOT NULL,  
    address TEXT NOT NULL,  
    contact_info VARCHAR(255),  
    image BYTEA,  
    latitude DECIMAL(9,6),  
    longitude DECIMAL (9,6),  
    place_id VARCHAR(255),  
    opening_hours TEXT  
);  
- Step 3: CREATE TABLE reviews (  
    id SERIAL PRIMARY KEY,  
    store_id INT REFERENCES stores(id) ON DELETE CASCADE,  
    rating INT CHECK (rating BETWEEN 1 AND 5),  
    comment TEXT,  
    reviewer_name VARCHAR(255) NOT NULL,  
    created_at timestamp without time zone DEFAULT now ()  
);  

## Tasks Completed By Member
### Madi
- Add store functionality and autofill capabilities using Google Maps API
- Merge conflict resolution
- Image fetching using Google Places
- Dynamic store pages
- Postgres tables, columns
### Brian
- Google Maps API integration
- Google Maps Geocode integration
- Remove Button to delete row data from SQL table
- dotenv file integration
### Deluka
- Task
### Kenny
- Adding recommended stores section
- Created recommended.json containing recommended store data
- Dynamically display recommended stores with refresh button
- Add to My Stores button to add recommended store to collection
