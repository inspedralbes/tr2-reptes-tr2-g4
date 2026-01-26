const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { extractTextFromFile } = require('../fileReader');
const { analyzePI } = require('../piAnalyzer');
const centrosData = require('../centres-educatius.json');
const { UPLOADS_DIR } = require('../config/multer');

router.get('/logs', async (req, res) => {
    try {
        const db = getDB();
        const logs = await db.collection('access_logs').find().sort({ timestamp: -1 }).limit(50).toArray();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Error logs' });
    }
});

router.get('/centros', (req, res) => res.json(centrosData));

router.get('/analyze/:filename', async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            console.error(`Fitxer no trobat a disc: ${filePath}`);
            return res.status(404).json({ error: 'Fitxer no trobat a disc' });
        }

        const db = getDB();
        const student = await db.collection('students').findOne({ "files.filename": filename });

        if (!student) {
            console.warn(`Alerta: El fitxer ${filename} no està vinculat a cap alumne a la BD.`);
        }

        const dataBuffer = fs.readFileSync(filePath);
        const text = await extractTextFromFile(dataBuffer, filename);
        const analysis = analyzePI(text);

        const responseData = {
            ...analysis,
            text_completo: text
        };

        if (student) {
            await db.collection('students').updateOne(
                { "files.filename": filename },
                { $set: { "files.$.analysis": analysis } }
            );
        }

        res.json(responseData);

    } catch (error) {
        console.error("Error en /analyze:", error);
        res.status(500).json({ error: 'Error processant el document' });
    }
});

router.delete('/maintenance/logs', async (req, res) => {
    try {
        const db = getDB();

        const dateLimit = new Date();
        dateLimit.setDate(dateLimit.getDate() - 30);

        const result = await db.collection('access_logs').deleteMany({
            timestamp: { $lt: dateLimit }
        });

        console.log(`Manteniment: ${result.deletedCount} logs antics esborrats.`);

        res.json({
            success: true,
            message: `S'han eliminat ${result.deletedCount} registres antics.`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en manteniment' });
    }
});

module.exports = router;