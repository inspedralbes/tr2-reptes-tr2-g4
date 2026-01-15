const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { getDB } = require('../db');
const { upload, UPLOADS_DIR } = require('../config/multer');
const { generarHash, obtenerIniciales } = require('../utils/helpers');
const { registrarAcces } = require('../utils/logger');

// GET: Llistat
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
    // 1. AÑADIMOS codi_centre AQUÍ
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
            
            // 2. AÑADIMOS EL CAMPO AL OBJETO
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
        // --- NUEVO: REGISTRAR EN EL LOG ---
        // Usamos 'Nou Alumne' como palabra clave para filtrar luego
        // Si tienes el email del usuario en el body, úsalo. Si no, pon 'Admin' o 'Sistema'.
        const userEmail = req.body.userEmail || 'Sistema'; 
        await registrarAcces(userEmail, 'Nou Alumne', newStudent.visual_identity.ralc_suffix);

        console.log(`✨ Nou alumne creat: ${iniciales} (Centre: ${codi_centre})`);
        res.json({ success: true, student: newStudent });
    } catch (error) {
        res.status(500).json({ error: 'Error al servidor' });
    }
});

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
        
        // 1. Primero buscamos al alumno para saber cuál es su centro ACTUAL
        const student = await db.collection('students').findOne({ hash_id: hash });

        if (!student) {
            return res.status(404).json({ error: "Alumne no trobat" });
        }

        // 2. Evitamos hacer nada si el centro es el mismo
        if (student.codi_centre === new_center_id) {
            return res.status(400).json({ error: "L'alumne ja pertany a aquest centre" });
        }

        // 3. ACTUALIZACIÓN ATÓMICA:
        // - $push: Añade el centro viejo al array 'school_history' (si no existe, Mongo lo crea solo)
        // - $set: Cambia el 'codi_centre' actual por el nuevo
        await db.collection('students').updateOne(
            { hash_id: hash },
            {
                $push: {
                    school_history: {
                        codi_centre: student.codi_centre, // El centro viejo
                        date_end: new Date()              // Fecha de hoy
                    }
                },
                $set: {
                    codi_centre: new_center_id            // El centro nuevo
                }
            }
        );

        console.log(`🔄 Trasllat realitzat: ${student.visual_identity.iniciales} -> ${new_center_id}`);
        
        // 4. Devolvemos éxito
        res.json({ success: true, message: "Centre modificat i historial guardat" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error al servidor al realitzar el trasllat' });
    }
});

module.exports = router;