const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { upload, UPLOADS_DIR } = require('../config/multer');
const { generarHash, obtenerIniciales } = require('../utils/helpers');
const { registrarAcces } = require('../utils/logger');

// ==========================================
// 1. RUTES ESTÀTIQUES I DE CERCA (La teva part)
// Han d'anar PRIMER per evitar conflictes amb /:hash
// ==========================================

/**
 * REQUISIT 4: CONSULTES AVANÇADES (Checklist PDF)
 * Demostració de: $or, Dot Notation ("a.b"), $elemMatch i Regex
 */
router.get('/search/advanced', async (req, res) => {
    const { term, hasFile, minDificultats } = req.query;

    try {
        const db = getDB();
        const filter = {};
        const conditions = [];

        // 1. Ús de $or i Regex (cerca flexible en múltiples camps)
        if (term) {
            conditions.push({
                $or: [
                    { "visual_identity.iniciales": { $regex: term, $options: 'i' } },
                    { "hash_id": term },
                    { "ia_data.perfil": { $regex: term, $options: 'i' } }
                ]
            });
        }

        // 2. REQUISIT ESPECÍFIC: $elemMatch (Consultes en arrays d'objectes)
        if (hasFile === 'true') {
             conditions.push({
                files: { 
                    $elemMatch: { mimetype: "application/pdf" } 
                }
             });
        }

        // 3. REQUISIT ESPECÍFIC: Accés a 3+ nivells de profunditat
        if (minDificultats) {
            conditions.push({ [`ia_data.dificultats.${parseInt(minDificultats)}`]: { $exists: true } });
        }

        if (conditions.length > 0) {
            filter.$and = conditions;
        }

        const results = await db.collection('students').find(filter).toArray();
        console.log(`🔎 Cerca avançada: ${results.length} resultats.`);
        res.json(results);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error en cerca avançada' });
    }
});

// ==========================================
// 2. RUTES GENERALS (Part Comuna)
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
    const { nombre, id, codi_centre } = req.body; 

    if (!nombre || !id) return res.status(400).json({ error: "Falten dades" });

    try {
        const db = getDB();
        const hash = generarHash(id);
        const iniciales = obtenerIniciales(nombre);

        const existing = await db.collection('students').findOne({ hash_id: hash });
        if (existing) return res.status(409).json({ error: "Alumne ja existent" });
        
        const newStudent = {
            hash_id: hash,
            codi_centre: codi_centre || null, 
            visual_identity: {
                iniciales: iniciales,
                ralc_suffix: `***${id.slice(-3)}`
            },
            has_file: false,
            files: [],
            ia_data: {},
            createdAt: new Date()
        };

        await db.collection('students').insertOne(newStudent);
        
        const userEmail = req.body.userEmail || 'Sistema'; 
        await registrarAcces(userEmail, 'Nou Alumne', newStudent.visual_identity.ralc_suffix);

        console.log(`✨ Nou alumne creat: ${iniciales} (Centre: ${codi_centre})`);
        res.json({ success: true, student: newStudent });
    } catch (error) {
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

        // Neteja legacy i actualitza has_file
        await db.collection('students').updateOne({ hash_id: hash, filename: filename }, { $unset: { filename: "" } });
        const studentUpdated = await db.collection('students').findOne({ hash_id: hash });
        const hasFiles = (studentUpdated.files && studentUpdated.files.length > 0) || (!!studentUpdated.filename);
        await db.collection('students').updateOne({ hash_id: hash }, { $set: { has_file: hasFiles } });

        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await registrarAcces(userEmail || 'Desconegut', 'Eliminació de document', ralcSuffix);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// PUT: Trasllat de centre (PART DEL TEU COMPANY - MILLORADA AMB DATES)
router.put('/:hash/transfer', async (req, res) => {
    const { hash } = req.params;
    // Recollim dates del body (Millora del company)
    const { new_center_id, start_date, end_date } = req.body;

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

        // Gestió de dates
        const transferDate = start_date ? new Date(start_date) : new Date();
        const transferEndDate = end_date ? new Date(end_date) : null;

        await db.collection('students').updateOne(
            { hash_id: hash },
            {
                // A) Movemos el centro ACTUAL al HISTORIAL
                $push: {
                    school_history: {
                        codi_centre: student.codi_centre,
                        date_start: student.date_start || null, 
                        date_end: transferDate 
                    }
                },
                // B) Establecemos el NUEVO centro como ACTUAL
                $set: {
                    codi_centre: new_center_id,
                    date_start: transferDate,
                    date_end: transferEndDate
                }
            }
        );

        console.log(`🔄 Trasllat realitzat: ${student.visual_identity.iniciales} -> ${new_center_id}`);
        res.json({ success: true, message: "Centre modificat i historial guardat" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al servidor al realitzar el trasllat' });
    }
});

module.exports = router;