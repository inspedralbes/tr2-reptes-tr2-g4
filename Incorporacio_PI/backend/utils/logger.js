const { getDB } = require('../db');

async function registrarAcces(email, accio, ralcSuffix = 'N/A') {
    try {
        const db = getDB();
        const newLog = {
            usuari: email,
            accio: accio,
            ralc_alumne: ralcSuffix,
            timestamp: new Date()
        };

        await db.collection('access_logs').insertOne(newLog);

        if (global.io) {
            global.io.emit('new_notification', newLog);
        }

    } catch (e) {
        console.error("Error guardant log:", e);
    }
}

module.exports = { registrarAcces };