const { connectDB, getDB } = require('./db');
require('dotenv').config();

async function run() {
    try {
        await connectDB();
        const db = getDB();
        const students = await db.collection('students').find({}).toArray();
        students.forEach(s => {
            if (s.files) {
                s.files.forEach(f => {
                    if (f.ia_data) {
                        console.log(`File: ${f.filename}`);
                        if (f.ia_data.docente) console.log(`  Docente: ${f.ia_data.docente.estado} (${f.ia_data.docente.progress}%)`);
                        if (f.ia_data.orientador) console.log(`  Orientador: ${f.ia_data.orientador.estado} (${f.ia_data.orientador.progress}%)`);
                    }
                });
            }
            if (s.global_summary) {
                console.log(`Global Summary (${s.nom}): ${s.global_summary.estado} (${s.global_summary.progress}%)`);
            }
        });
    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}
run();
