const { connectDB, getDB, closeDB } = require('../db');
const crypto = require('crypto');

async function migrate() {
    try {
        await connectDB();
        const db = getDB();
        const students = await db.collection('students').find({ "comments.id": { $exists: false }, "comments": { $exists: true, $not: { $size: 0 } } }).toArray();

        console.log(`Trobat ${students.length} alumnes amb comentaris sense ID.`);

        for (const student of students) {
            let modified = false;
            const updatedComments = student.comments.map(comment => {
                if (!comment.id) {
                    modified = true;
                    return { ...comment, id: crypto.randomUUID() };
                }
                return comment;
            });

            if (modified) {
                await db.collection('students').updateOne(
                    { _id: student._id },
                    { $set: { comments: updatedComments } }
                );
                console.log(`Actualitzat comentaris per a l'alumne: ${student.hash_id}`);
            }
        }

        console.log('Migració completada.');
    } catch (error) {
        console.error('Error durant la migració:', error);
    } finally {
        await closeDB();
    }
}

migrate();
