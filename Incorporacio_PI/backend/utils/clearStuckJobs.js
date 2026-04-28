const { connectDB, getDB } = require('../config/db');
require('dotenv').config();

async function clearStuckJobs() {
    try {
        await connectDB();
        const db = getDB();

        console.log("🧹 Iniciant neteja de processos d'IA encallats...");

        // 1. Resetear resúmenes individuales de archivos
        const resultFiles = await db.collection('students').updateMany(
            { 
                $or: [
                    { "files.ia_data.docente.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } },
                    { "files.ia_data.orientador.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } }
                ]
            },
            { 
                $set: { 
                    "files.$[].ia_data.docente.estado": "PENDENT",
                    "files.$[].ia_data.orientador.estado": "PENDENT"
                } 
            }
        );

        // 2. Resetear resúmenes evolutivos (Globales)
        const resultGlobal = await db.collection('students').updateMany(
            { "global_summary.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA", "OBSOLET"] } },
            { 
                $set: { 
                    "global_summary.estado": "PENDENT",
                    "global_summary.progress": 0,
                    "global_summary.resumen": ""
                } 
            }
        );

        console.log(`✅ Neteja completada:`);
        console.log(`   - Fitxers actualitzats: ${resultFiles.modifiedCount}`);
        console.log(`   - Resums globals resetejats: ${resultGlobal.modifiedCount}`);

    } catch (err) {
        console.error("❌ Error durant la neteja:", err);
    } finally {
        process.exit(0);
    }
}

clearStuckJobs();
