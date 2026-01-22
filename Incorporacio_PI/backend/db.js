// db.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
// Remove generic options that might cause issues, newer drivers are smart
const client = new MongoClient(uri);

let database = null;

async function connectDB() {
    try {
        await client.connect();
        // Uses the database defined in the URI (Incorporacio_PI)
        database = client.db();
        console.log(`✅ MongoDB Connected to: ${database.databaseName}`);
        return database;
    } catch (error) {
        console.error('❌ Error connecting to MongoDB:', error);
        process.exit(1);
    }
}

function getDB() {
    if (!database) {
        throw new Error('Database not connected. Call connectDB() first.');
    }
    return database;
}

module.exports = { connectDB, getDB, client };