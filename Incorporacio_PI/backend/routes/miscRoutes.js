const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { extractTextFromPDF } = require('../fileReader');
const { analyzePI } = require('../piAnalyzer');
const centrosData = require('../centres-educatius.json');
const { UPLOADS_DIR } = require('../config/multer');

// Logs
router.get('/logs', async (req, res) => {
    try {
        const db = getDB();
        const logs = await db.collection('access_logs').find().sort({ timestamp: -1 }).limit(50).toArray();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Error logs' });
    }
});

// Centres
router.get('/centros', (req, res) => res.json(centrosData));

// Analitzar
router.get('/analyze/:filename', async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(UPLOADS_DIR, filename);

        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Fitxer no trobat' });

        const db = getDB();
        const student = await db.collection('students').findOne({ "files.filename": filename });
        
        if (student) {
            const fileObj = student.files.find(f => f.filename === filename);
            if (fileObj && fileObj.analysis) return res.json(fileObj.analysis);
        }

        const dataBuffer = fs.readFileSync(filePath);
        const text = await extractTextFromPDF(dataBuffer);
        const analysis = analyzePI(text);

        if (student) {
            await db.collection('students').updateOne(
                { "files.filename": filename },
                { $set: { "files.$.analysis": analysis } }
            );
        }
        res.json(analysis);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error processant' });
    }
});

module.exports = router;