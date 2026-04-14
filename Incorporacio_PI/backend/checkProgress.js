const { connectDB, getDB } = require('./db');
require('dotenv').config();

async function checkProgress() {
    try {
        await connectDB();
        const db = getDB();
        const students = await db.collection('students').find({
            $or: [
                { "ia_data.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } },
                { "files.ia_data.docente.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } },
                { "files.ia_data.orientador.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } },
                { "global_summary.estado": { $in: ["LLEGINT...", "GENERANT...", "A LA CUA"] } }
            ]
        }).toArray();

        if (students.length === 0) {
            console.log("No hi ha cap procés de lectura o generació en curs.");
            return;
        }

        students.forEach(s => {
            console.log(`Alumne: ${s.nom} ${s.cognoms}`);
            if (s.global_summary) {
                console.log(`  - Resum Global: ${s.global_summary.estado} (${s.global_summary.progress || 0}%)`);
            }
            if (s.files) {
                s.files.forEach(f => {
                    if (f.ia_data) {
                        if (f.ia_data.docente) {
                            console.log(`  - Fitxer ${f.filename} (Docent): ${f.ia_data.docente.estado} (${f.ia_data.docente.progress || 0}%)`);
                        }
                        if (f.ia_data.orientador) {
                            console.log(`  - Fitxer ${f.filename} (Orientador): ${f.ia_data.orientador.estado} (${f.ia_data.orientador.progress || 0}%)`);
                        }
                    }
                });
            }
        });
    } catch (err) {
        console.error("Error checking progress:", err);
    } finally {
        process.exit(0);
    }
}

checkProgress();
