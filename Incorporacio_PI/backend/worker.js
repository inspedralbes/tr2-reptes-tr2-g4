const amqp = require('amqplib');
const { MongoClient, ObjectId } = require('mongodb');
const { extractPIdata, warmupModel } = require('./extractor');
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';
const MONGODB_URI = process.env.MONGODB_URI;

async function startWorker() {
    console.log('🚀 Iniciant Worker...');

    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db();
        const studentsColl = db.collection('students');
        const jobsColl = db.collection('jobs');
        console.log('✅ Connectat a MongoDB.');

        console.log('🧠 Escalfant model IA...');
        await warmupModel();

        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.assertQueue('job_notification_queue', { durable: true });
        await channel.prefetch(1);

        console.log('✅ Worker preparat. Esperant missatges...');

        channel.consume('pi_processing_queue', async (msg) => {
            if (!msg) return;

            const jobData = JSON.parse(msg.content.toString());
            const { jobId, filePath, originalFileName, userId, role } = jobData;

            // Determinar ID de búsqueda (ObjectId o RALC)
            let searchId = userId;
            try { if (ObjectId.isValid(userId)) searchId = new ObjectId(userId); } catch (e) { }

            console.log(`⚙️ Job ${jobId} [${role}] - ${originalFileName}`);

            try {
                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status: 'processing', startedAt: new Date() } });

                // Función para enviar notificaciones de estado intermedio
                const notify = async (status, message) => {
                    const note = { jobId, userId, filename: originalFileName, status, message };
                    channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(note)), { persistent: true });
                    // Actualizar DB para que el polling vea el cambio
                    await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status_detail: message } });
                };

                await notify('processing', 'LLEGINT DADES...');

                let filesToAnalyze = [];
                if (role === 'historial') {
                    await notify('processing', 'RECUPERANT HISTORIAL...');
                    const student = await studentsColl.findOne({ _id: searchId });
                    if (student && student.documents) {
                        filesToAnalyze = student.documents
                            .filter(d => d.filename !== "Resum Global" && fs.existsSync(d.filePath))
                            .map(d => ({ path: d.filePath, name: d.filename }));
                    }
                    if (filesToAnalyze.length === 0) throw new Error("No s'han trobat fitxers físics per l'historial.");
                } else {
                    filesToAnalyze = [{ path: filePath, name: originalFileName }];
                }

                const result = await extractPIdata(filesToAnalyze, role || 'docente', (prog) => {
                    notify('processing', prog);
                });

                // Casos especials de guardat
                if (role === 'historial') {
                    await studentsColl.updateOne({ _id: searchId }, {
                        $set: { "global_summary.data": result, "global_summary.estado": 'COMPLETAT', "global_summary.updatedAt": new Date() }
                    });
                } else {
                    // Si es un doc individual, actualizamos el documento en el array del estudiante
                    await studentsColl.updateOne(
                        { _id: searchId, "documents.jobId": jobId },
                        { $set: { "documents.$.resultIA": result, "documents.$.statusIA": 'COMPLETAT' } }
                    );
                }

                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status: 'completed', result, completedAt: new Date() } });
                await notify('completed', 'FET!');

                if (fs.existsSync(filePath) && role !== 'historial') fs.unlinkSync(filePath);
                channel.ack(msg);

            } catch (error) {
                console.error(`❌ Error Job ${jobId}:`, error.message);
                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status: 'failed', error: error.message } });

                if (role === 'historial') {
                    await studentsColl.updateOne({ _id: searchId }, { $set: { "global_summary.estado": 'ERROR' } });
                } else {
                    await studentsColl.updateOne(
                        { _id: searchId, "documents.jobId": jobId },
                        { $set: { "documents.$.statusIA": 'ERROR' } }
                    );
                }

                const failNote = { jobId, userId, filename: originalFileName, status: 'failed', message: error.message };
                channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(failNote)), { persistent: true });

                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                channel.ack(msg);
            }
        });
    } catch (error) {
        console.error('❌ Fallo Crític Worker:', error);
        setTimeout(startWorker, 5000);
    }
}

startWorker();
