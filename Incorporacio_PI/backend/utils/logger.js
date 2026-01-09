const { getDB } = require('../db');

async function registrarAcces(email, accio, ralcSuffix = 'N/A') {
    try {
        const db = getDB();
        await db.collection('access_logs').insertOne({
            usuari: email,
            accio: accio,
            ralc_alumne: ralcSuffix,
            timestamp: new Date()
        });
    } catch (e) {
        console.error("Error guardant log:", e);
    }
}

module.exports = { registrarAcces };