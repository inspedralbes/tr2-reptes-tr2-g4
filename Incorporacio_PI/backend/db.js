// db.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
let database = null;

/**
* Funció per connectar a MongoDB
* Aquesta funció s'ha de cridar abans de fer qualsevol operació amb la BD
* @returns {Promise<Db>}
*/

async function connectDB() {
    if (!uri) {
        console.error('\n❌ ERROR CRÍTICO: Maveu definit MONGODB_URI al fitxer .env?');
        console.error('📝 Copia el fitxer .env.example a .env i posa la teva connexió de MongoDB Atlas.\n');
        process.exit(1);
    }
    try {
        await client.connect();
        console.log('✅ Connectat a MongoDB Atlas');
        database = client.db('projecte');
        return database;
    } catch (error) {
        console.error('❌ Error connectant a MongoDB:', error);
        throw error;
    }
}

/**
* Funció per obtenir la base de dades
* Retorna la referència a la BD si ja està connectada
* @returns {Db}
*/
function getDB() {
    if (!database) {
        throw new Error(' Base de dades no connectada! Crida connectDB() primer.');
    }
    return database;
}

async function closeDB() {
    try {
        await client.close();
        console.log(' Connexió tancada');
    } catch (error) {
        console.error(' Error tancant la connexió:', error);
        throw error;
    }
}

module.exports = {
    connectDB,
    getDB,
    closeDB
};