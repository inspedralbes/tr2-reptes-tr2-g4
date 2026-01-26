const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

router.get('/dashboard', async (req, res) => {
    try {
        const db = getDB();

        const statsCentres = await db.collection('students').aggregate([
            { $match: { codi_centre: { $ne: null } } },

            { 
                $group: { 
                    _id: "$codi_centre", 
                    totalAlumnes: { $sum: 1 },
                    alumnesAmbPI: { 
                        $sum: { $cond: [{ $eq: ["$has_file", true] }, 1, 0] } 
                    },
                    tamanyMitjaFitxers: { $avg: { $first: "$files.size" } } 
                }
            },

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

            { $sort: { ratioDigitalitzacio: -1 } }
        ]).toArray();

        res.json({ success: true, data: statsCentres });
    } catch (error) {
        console.error("Error stats dashboard:", error);
        res.status(500).json({ error: 'Error calculant estadístiques' });
    }
});

router.get('/adaptacions', async (req, res) => {
    try {
        const db = getDB();

        const statsTipologia = await db.collection('students').aggregate([

            { $match: { "ia_data.adaptacions": { $exists: true, $ne: [] } } },

            { $unwind: "$ia_data.adaptacions" },

            {
                $group: {
                    _id: "$ia_data.adaptacions",
                    frequencia: { $sum: 1 }
                }
            },

            { $sort: { frequencia: -1 } },

            { $limit: 5 }
        ]).toArray();

        res.json({ success: true, topAdaptacions: statsTipologia });
    } catch (error) {
        res.status(500).json({ error: 'Error analitzant adaptacions' });
    }
});

module.exports = router;