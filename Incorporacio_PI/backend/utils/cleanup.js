const { getDB } = require('../db');
const fs = require('fs');
const path = require('path');

async function cleanupBrokenFiles() {
    try {
        const db = getDB();
        const UPLOADS_DIR = path.join(__dirname, '../uploads');

        if (!fs.existsSync(UPLOADS_DIR)) {
            console.log("Cleanup: Uploads directory not found.");
            return;
        }

        const students = await db.collection('students').find().toArray();
        for (const student of students) {
            if (!student.files || !Array.isArray(student.files)) continue;

            const validFiles = student.files.filter(f => {
                const exists = fs.existsSync(path.join(UPLOADS_DIR, f.filename));
                if (!exists) console.log(`Cleanup: Removing reference to missing file: ${f.filename}`);
                return exists;
            });

            if (validFiles.length !== student.files.length) {
                await db.collection('students').updateOne(
                    { _id: student._id },
                    {
                        $set: {
                            files: validFiles,
                            has_file: validFiles.length > 0
                        }
                    }
                );
            }
        }
        console.log("Cleanup: Database cleanup completed.");
    } catch (e) {
        console.error("Cleanup Error:", e);
    }
}

module.exports = { cleanupBrokenFiles };
