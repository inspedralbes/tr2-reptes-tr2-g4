const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { upload, UPLOADS_DIR } = require('../config/multer');
const { generarHash, obtenerIniciales } = require('../utils/helpers');
const { registrarAcces } = require('../utils/logger');

// ==========================================
// 1. RUTES ESTÀTIQUES I DE CERCA (La meva part)
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
                    // Dot notation per accedir a objectes imbricats
                    { "visual_identity.iniciales": { $regex: term, $options: 'i' } },
                    { "hash_id": term },
                    // Cerca dins l'array de perfils extrets per la IA (si existeix)
                    { "ia_data.perfil": { $regex: term, $options: 'i' } }
                ]
            });
        }

        // 2. REQUISIT ESPECÍFIC: $elemMatch (Consultes en arrays d'objectes)
        // Busca alumnes que tinguin ALMENYS un fitxer PDF (encara que en tinguin d'altres)
        if (hasFile === 'true') {
             conditions.push({
                files: { 
                    $elemMatch: { 
                        mimetype: "application/pdf"
                    } 
                }
             });
        }

        // 3. REQUISIT ESPECÍFIC: Accés a 3+ nivells de profunditat o arrays
        // Comprovem si existeix l'element 'n' de l'array de dificultats
        if (minDificultats) {
            conditions.push({ [`ia_data.dificultats.${parseInt(minDificultats)}`]: { $exists: true } });
        }

        // Combinar tot amb $and
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
// 2. RUTES GENERALS I CRUD (Part del company)
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
// Aquestes han d'anar al final perquè capturen qualsevol URL
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

        // Eliminar físic
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await registrarAcces(userEmail || 'Desconegut', 'Eliminació de document', ralcSuffix);
        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// PUT: Trasllat de centre (Cambiar centro y guardar historial)
router.put('/:hash/transfer', async (req, res) => {
    const { hash } = req.params;
    const { new_center_id } = req.body;

    if (!new_center_id) {
        return res.status(400).json({ error: "Falta el nou codi de centre" });
    }

    try {
        const db = getDB();
        
        // 1. Busquem l'alumne
        const student = await db.collection('students').findOne({ hash_id: hash });

        if (!student) {
            return res.status(404).json({ error: "Alumne no trobat" });
        }

        // 2. Verifiquem si és el mateix centre
        if (student.codi_centre === new_center_id) {
            return res.status(400).json({ error: "L'alumne ja pertany a aquest centre" });
        }

        // 3. ACTUALIZACIÓN ATÓMICA ($push + $set)
        await db.collection('students').updateOne(
            { hash_id: hash },
            {
                $push: {
                    school_history: {
                        codi_centre: student.codi_centre, // Centre vell
                        date_end: new Date()              // Data actual
                    }
                },
                $set: {
                    codi_centre: new_center_id            // Centre nou
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