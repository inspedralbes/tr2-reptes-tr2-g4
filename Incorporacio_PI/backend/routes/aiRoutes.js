const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { extractTextFromFile } = require('../fileReader');
const { sendToQueue } = require('../services/rabbitService');

const UPLOADS_DIR = path.join(__dirname, '../uploads');

async function getFileText(filename) {
    const filePath = path.join(UPLOADS_DIR, filename);
    if (!fs.existsSync(filePath)) return "";
    const buffer = fs.readFileSync(filePath);
    return await extractTextFromFile(buffer, filename);
}

router.post('/generate-summary', async (req, res) => {
    const { text, filename, role, userEmail } = req.body;
    if (!text || !filename) return res.status(400).json({ error: 'Falta text o filename' });

    const success = sendToQueue({ text, filename, role: role || 'docent', userEmail: userEmail || 'usuari' });
    if (!success) return res.status(500).json({ error: 'RabbitMQ no disponible' });

    try {
        const db = getDB();
        const roleKey = role || 'docent';
        await db.collection('students').updateOne(
            { "files.filename": filename },
            { $set: { [`files.$.ia_data.${roleKey}.estado`]: "A LA CUA", [`files.$.ia_data.${roleKey}.progress`]: 0 } }
        );
    } catch (dbErr) {
        console.error("Error setting initial AI status:", dbErr);
    }

    res.json({ success: true, message: "Afegit a la cua" });
});

router.post('/generate-global-summary', async (req, res) => {
    const { studentHash, userEmail } = req.body;
    if (!studentHash) return res.status(400).json({ error: 'Falta studentHash' });

    try {
        const db = getDB();
        const student = await db.collection('students').findOne({ hash_id: studentHash });
        if (!student) return res.status(404).json({ error: 'Estudiant no trobat' });

        let combinedText = "HISTORIAL DE DOCUMENTS:\n\n";
        const files = student.files || [];
        for (const f of files) {
            const text = await getFileText(f.filename);
            combinedText += `--- DOCUMENT: ${f.originalName} ---\n${text.substring(0, 1500)}...\n\n`;
        }

        await db.collection('students').updateOne(
            { hash_id: studentHash },
            { $set: { "global_summary.estado": "A LA CUA", "global_summary.progress": 0 } }
        );

        sendToQueue({ text: combinedText, studentHash, role: 'global', filename: student.hash_id, userEmail: userEmail || 'usuari' });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
