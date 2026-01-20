const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { UPLOADS_DIR } = require('../config/multer'); // Asegúrate que esta importación sea correcta según tu proyecto
const { generarHash, obtenerIniciales } = require('../utils/helpers');
const { registrarAcces } = require('../utils/logger'); // <--- IMPRESCINDIBLE

// ==========================================
// 1. RUTES ESTÀTIQUES I DE CERCA
// ==========================================

router.get('/search/advanced', async (req, res) => {
    const { term, hasFile, minDificultats } = req.query;

    try {
        const db = getDB();
        const filter = {};
        const conditions = [];

        if (term) {
            conditions.push({
                $or: [
                    { "visual_identity.iniciales": { $regex: term, $options: 'i' } },
                    { "hash_id": term },
                    { "ia_data.perfil": { $regex: term, $options: 'i' } }
                ]
            });
        }

        if (hasFile === 'true') {
             conditions.push({
                files: { $elemMatch: { mimetype: "application/pdf" } }
             });
        }

        if (minDificultats) {
            conditions.push({ [`ia_data.dificultats.${parseInt(minDificultats)}`]: { $exists: true } });
        }

        if (conditions.length > 0) {
            filter.$and = conditions;
        }

        const results = await db.collection('students').find(filter).toArray();
        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en cerca avançada' });
    }
});

// ==========================================
// 2. RUTES GENERALS
// ==========================================

// GET: Llistat complet
router.get('/', async (req, res) => {
    try {
        const db = getDB();
        const students = await db.collection('students').find().toArray();
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Error al servidor' });
    }
});

// POST: Crear alumne
router.post('/', async (req, res) => {
    const { nombre, id, codi_centre, start_date, userEmail } = req.body; 

    if (!nombre || !id) return res.status(400).json({ error: "Falten dades" });

    try {
        const db = getDB();
        const hash = generarHash(id);
        const iniciales = obtenerIniciales(nombre);

        const existing = await db.collection('students').findOne({ hash_id: hash });
        if (existing) return res.status(409).json({ error: "Alumne ja existent" });
        
        const fechaInicio = start_date ? new Date(start_date) : new Date();

        const newStudent = {
            hash_id: hash,
            codi_centre: codi_centre || null, 
            date_start: codi_centre ? fechaInicio : null,
            visual_identity: {
                iniciales: iniciales,
                ralc_suffix: `***${id.slice(-3)}`
            },
            has_file: false,
            files: [],
            ia_data: {},
            school_history: [], 
            createdAt: new Date()
        };

        await db.collection('students').insertOne(newStudent);
        
        // --- AQUÍ SE DISPARA LA NOTIFICACIÓN AUTOMÁTICAMENTE ---
        // Al llamar a registrarAcces, logger.js ejecutará el io.emit
        await registrarAcces(
            userEmail || 'Sistema', 
            `Nou Alumne (${codi_centre || 'Sense Centre'})`, 
            newStudent.visual_identity.ralc_suffix
        );

        console.log(`✨ Nou alumne creat: ${iniciales}`);
        res.json({ success: true, student: newStudent });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al servidor' });
    }
});

// ==========================================
// 3. RUTES ESPECÍFIQUES PER ID (:hash)
// ==========================================

// DELETE: Eliminar fitxer
router.delete('/:hash/files/:filename', async (req, res) => {
    const { hash, filename } = req.params;
    const { userEmail } = req.body; 

    try {
        const db = getDB();
        const studentInfo = await db.collection('students').findOne({ hash_id: hash });
        const ralcSuffix = studentInfo ? studentInfo.visual_identity.ralc_suffix : '???';

        await db.collection('students').updateOne(
            { hash_id: hash },
            { $pull: { files: { filename: filename } } }
        );

        await db.collection('students').updateOne({ hash_id: hash, filename: filename }, { $unset: { filename: "" } });
        
        // Recalcular has_file
        const studentUpdated = await db.collection('students').findOne({ hash_id: hash });
        const hasFiles = (studentUpdated.files && studentUpdated.files.length > 0);
        await db.collection('students').updateOne({ hash_id: hash }, { $set: { has_file: hasFiles } });

        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        // Esto también enviará notificación (Broadcast), pero el frontend la ignorará 
        // si no tienes un filtro para "Eliminació de document".
        await registrarAcces(userEmail || 'Desconegut', 'Eliminació de document', ralcSuffix);
        
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});


// PUT: Trasllat de centre
router.put('/:hash/transfer', async (req, res) => {
    const { hash } = req.params;
    const { new_center_id, start_date, end_date, userEmail } = req.body;

    if (!new_center_id) {
        return res.status(400).json({ error: "Falta el nou codi de centre" });
    }

    try {
        const db = getDB();
        const student = await db.collection('students').findOne({ hash_id: hash });

        if (!student) {
            return res.status(404).json({ error: "Alumne no trobat" });
        }

        if (student.codi_centre === new_center_id) {
            return res.status(400).json({ error: "L'alumne ja pertany a aquest centre" });
        }

        const transferDate = start_date ? new Date(start_date) : new Date();
        const transferEndDate = end_date ? new Date(end_date) : null;

        await db.collection('students').updateOne(
            { hash_id: hash },
            {
                $push: {
                    school_history: {
                        codi_centre: student.codi_centre,
                        date_start: student.date_start || null, 
                        date_end: transferDate 
                    }
                },
                $set: {
                    codi_centre: new_center_id,
                    date_start: transferDate,
                    date_end: transferEndDate
                }
            }
        );

        // --- AQUÍ SE DISPARA LA NOTIFICACIÓN DE TRASLADO ---
        // Formato clave: "Trasllat a [CODI]" para que el frontend lo entienda
        await registrarAcces(
            userEmail || 'Desconegut', 
            `Trasllat a ${new_center_id}`, 
            student.visual_identity.ralc_suffix
        );

        console.log(`🔄 Trasllat realitzat: ${student.visual_identity.iniciales} -> ${new_center_id}`);
        res.json({ success: true, message: "Centre modificat i historial guardat" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al servidor al realitzar el trasllat' });
    }
});

module.exports = router;