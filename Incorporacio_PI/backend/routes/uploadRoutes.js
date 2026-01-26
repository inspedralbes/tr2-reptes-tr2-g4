const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { upload } = require('../config/multer');
const { registrarAcces } = require('../utils/logger');

router.post('/', upload.single('documento_pi'), async (req, res) => {
    const { studentHash, userEmail } = req.body;
    if (!req.file || !studentHash) return res.status(400).json({ success: false, message: 'Error en dades' });

    try {
        const db = getDB();
        const iaData = {
            estado: "PROCESSAT",
            resumen: "Document processat correctament el " + new Date().toLocaleDateString()
        };
        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date()
        };

        const alumne = await db.collection('students').findOne({ hash_id: studentHash });
        const ralcSuffix = alumne ? alumne.visual_identity.ralc_suffix : '???';

        await db.collection('students').updateOne(
            { hash_id: studentHash },
            { 
                $set: { has_file: true, filename: req.file.filename, ia_data: iaData },
                $push: { files: fileData }
            }
        );

        await registrarAcces(userEmail || 'sistema', 'Pujada de document PI', ralcSuffix);
        console.log(`LOG: PDF pujat per ${ralcSuffix}`);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

module.exports = router;