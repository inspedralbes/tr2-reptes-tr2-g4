const { connectDB, getDB } = require('./db');
require('dotenv').config();

async function check() {
    await connectDB();
    const db = getDB();
    const students = await db.collection('students').find().toArray();

    console.log("--- START DEBUG ---");
    students.forEach(s => {
        console.log(`Student Hash: ${s.hash_id}`);
        // Check files
        if (s.files) {
            s.files.forEach(f => {
                console.log(`  File: ${f.filename}`);
                if (f.ia_data) {
                    console.log(`    Status: ${f.ia_data.estado}`);
                    console.log(`    Resume Length: ${f.ia_data.resumen ? f.ia_data.resumen.length : 0}`);
                    console.log(`    Resume Preview: ${f.ia_data.resumen ? f.ia_data.resumen.substring(0, 200) : 'NULL'}`);
                }
            });
        }
        // Check legacy
        if (s.ia_data && !s.files) {
            console.log(`  Legacy Data Status: ${s.ia_data.estado}`);
            console.log(`  Resume Preview: ${s.ia_data.resumen ? s.ia_data.resumen.substring(0, 200) : 'NULL'}`);
        }
    });
    console.log("--- END DEBUG ---");
    process.exit();
}

check();
