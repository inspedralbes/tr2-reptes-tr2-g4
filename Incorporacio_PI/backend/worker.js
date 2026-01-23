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

        await warmupModel();

        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.assertQueue('job_notification_queue', { durable: true });
        await channel.prefetch(1);

        channel.consume('pi_processing_queue', async (msg) => {
            if (!msg) return;

            const jobData = JSON.parse(msg.content.toString());
            const { jobId, filePath, originalFileName, userId, role } = jobData;

            let searchId = userId;
            try { if (ObjectId.isValid(userId)) searchId = new ObjectId(userId); } catch (e) { }

            try {
                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status: 'processing', startedAt: new Date() } });

                const notify = async (status, message, result = null) => {
                    const note = { jobId, userId, filename: originalFileName, status, message, resumen: result };
                    channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(note)), { persistent: true });
                    await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status_detail: message } });
                };

                await notify('processing', 'GENERANT RESUM...');

                // 1. EXTRAER DATOS DE LA IA
                const result = await extractPIdata([{ path: filePath, name: originalFileName }], role || 'docente');

                // 2. GUARDADO ROBUSTO (Si falla el alumno, el JOB sigue siendo OK)
                try {
                    if (role === 'historial') {
                        await studentsColl.updateOne({ _id: searchId }, {
                            $set: { "global_summary.data": result, "global_summary.estado": 'COMPLETAT', "global_summary.updatedAt": new Date() }
                        });
                    } else {
                        await studentsColl.updateOne(
                            { _id: searchId, "documents.jobId": jobId },
                            { $set: { "documents.$.resultIA": result, "documents.$.statusIA": 'COMPLETAT' } }
                        );
                    }
                } catch (saveErr) {
                    console.warn("⚠️ No se pudo actualizar la ficha del alumno, pero el Job es válido.");
                }

                // 3. ACTUALIZAR EL JOB (Esto es lo que ve el frontend)
                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, {
                    $set: { status: 'completed', result, completedAt: new Date() }
                });

                await notify('completed', 'FET!', result);

                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                channel.ack(msg);

            } catch (error) {
                console.error(`❌ Error Job ${jobId}:`, error.message);
                await jobsColl.updateOne({ _id: new ObjectId(jobId) }, { $set: { status: 'failed', error: error.message } });

                const failNote = { jobId, userId, filename: originalFileName, status: 'failed', message: error.message };
                channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(failNote)), { persistent: true });

                if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
                channel.ack(msg);
            }
        });
    } catch (error) {
        setTimeout(startWorker, 5000);
    }
}

startWorker();
