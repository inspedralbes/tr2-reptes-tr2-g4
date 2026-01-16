// backend/routes/statsRoutes.js
const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

/**
 * REQUISIT 5: AGREGACIONS
 * Ruta per obtenir estadístiques globals del dashboard
 * Utilitza: $match, $group, $project, $sort i condicions complexes
 */
router.get('/dashboard', async (req, res) => {
    try {
        const db = getDB();

        // AGREGACIÓ 1: Estadístiques per Centre (KPIs)
        const statsCentres = await db.collection('students').aggregate([
            // 1. Filtrem alumnes que tinguin centre assignat ($match)
            { $match: { codi_centre: { $ne: null } } },

            // 2. Agrupem per centre ($group)
            { 
                $group: { 
                    _id: "$codi_centre", 
                    totalAlumnes: { $sum: 1 },
                    // Comptem quants tenen fitxers pujats (condicional dins de grup)
                    alumnesAmbPI: { 
                        $sum: { $cond: [{ $eq: ["$has_file", true] }, 1, 0] } 
                    },
                    // Mitjana de la mida dels fitxers (si en tenen) - demostra càlcul matemàtic
                    tamanyMitjaFitxers: { $avg: { $first: "$files.size" } } 
                }
            },

            // 3. Calculem percentatges ($project)
            {
                $project: {
                    _id: 0,
                    centre: "$_id",
                    total: "$totalAlumnes",
                    processats: "$alumnesAmbPI",
                    ratioDigitalitzacio: { 
                        $multiply: [ { $divide: ["$alumnesAmbPI", "$totalAlumnes"] }, 100 ] 
                    },
                    status: {
                        $cond: { if: { $gte: ["$totalAlumnes", 10] }, then: "Gran", else: "Petit" }
                    }
                }
            },

            // 4. Ordenem per ràtio ($sort)
            { $sort: { ratioDigitalitzacio: -1 } }
        ]).toArray();

        res.json({ success: true, data: statsCentres });
    } catch (error) {
        console.error("Error stats dashboard:", error);
        res.status(500).json({ error: 'Error calculant estadístiques' });
    }
});

/**
 * REQUISIT ESPECÍFIC: Estadístiques d'adaptacions
 * Analitza el text extret per categoritzar tipus d'adaptacions
 * Utilitza: $unwind per "aplanar" arrays
 */
router.get('/adaptacions', async (req, res) => {
    try {
        const db = getDB();

        const statsTipologia = await db.collection('students').aggregate([
            // Només alumnes amb dades d'IA processades
            { $match: { "ia_data.adaptacions": { $exists: true, $ne: [] } } },

            // "Aplanem" l'array: crea un document per cada adaptació individual
            { $unwind: "$ia_data.adaptacions" },

            // Agrupem per text de l'adaptació per veure les més comuns
            {
                $group: {
                    _id: "$ia_data.adaptacions",
                    frequencia: { $sum: 1 }
                }
            },

            // Ordenem per les més freqüents
            { $sort: { frequencia: -1 } },

            // Limitem al Top 5
            { $limit: 5 }
        ]).toArray();

        res.json({ success: true, topAdaptacions: statsTipologia });
    } catch (error) {
        res.status(500).json({ error: 'Error analitzant adaptacions' });
    }
});

module.exports = router;