const { getDB } = require('../db');

async function registrarAcces(email, accio, ralcSuffix = 'N/A') {
    try {
        const db = getDB();
        
        // 1. Preparamos el objeto del log
        const newLog = {
            usuari: email,
            accio: accio,
            ralc_alumne: ralcSuffix,
            timestamp: new Date()
        };

        // 2. Guardamos en la Base de Dades
        await db.collection('access_logs').insertOne(newLog);

        // 3. ENVIAR NOTIFICACIÓN REAL-TIME (Broadcast)
        // Verificamos si 'global.io' existe (definido en server.js)
        if (global.io) {
            global.io.emit('new_notification', newLog);
            // console.log('🔔 Notificación enviada vía Socket.io');
        }

    } catch (e) {
        console.error("Error guardant log:", e);
    }
}

module.exports = { registrarAcces };