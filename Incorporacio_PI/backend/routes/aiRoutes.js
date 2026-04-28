const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../config/db');
const { extractTextFromFile } = require('../utils/fileReader');
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

        const files = student.files || [];
        if (files.length === 0) {
            return res.status(400).json({ error: "No es pot generar un resum evolutiu sense documents PI." });
        }

        let combinedText = "HISTORIAL DE DOCUMENTS I OBSERVACIONS DE L'ALUMNE:\n\n";
        
        // 1. Documents PI (con más contexto)
        for (const f of files) {
            const text = await getFileText(f.filename);
            const dateStr = f.uploadDate ? new Date(f.uploadDate).toLocaleDateString() : 'Data desconeguda';
            combinedText += `--- DOCUMENT PI: ${f.originalName} ---\n`;
            combinedText += `Data de pujada: ${dateStr}\n`;
            
            // Si ja existeix un resum d'aquest document, l'incloem perquè la IA global en tingui constància
            if (f.ia_data?.docent?.resumen) {
                combinedText += `Resum previ (Docent): ${f.ia_data.docent.resumen}\n`;
            }
            if (f.ia_data?.orientador?.resumen) {
                combinedText += `Resum previ (Orientador): ${f.ia_data.orientador.resumen}\n`;
            }

            combinedText += `Contingut del document:\n${text.substring(0, 4000)}${text.length > 4000 ? '...' : ''}\n\n`;
        }

        // 2. Comentaris i Observacions (molt important per a l'estat actual)
        const comments = student.comments || [];
        if (comments.length > 0) {
            combinedText += "--- OBSERVACIONS I COMENTARIS RECENTS (ESTAT ACTUAL) ---\n";
            comments.sort((a, b) => new Date(b.date) - new Date(a.date)); // Més recents primer
            for (const c of comments) {
                const cDate = new Date(c.date).toLocaleDateString();
                combinedText += `[${cDate}] (${c.type}): ${c.text}\n`;
            }
            combinedText += "\n";
        }

        await db.collection('students').updateOne(
            { hash_id: studentHash },
            { $set: { "global_summary.estado": "A LA CUA", "global_summary.progress": 0 } }
        );

        sendToQueue({ 
            text: combinedText, 
            studentHash, 
            role: 'global', 
            filename: student.hash_id, // Ha de coincidir amb el hash_id per al SSE
            userEmail: userEmail || 'usuari' 
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
