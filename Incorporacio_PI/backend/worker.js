require('dotenv').config();
const amqp = require('amqplib');
const { connectDB, getDB } = require('./db');
const { ObjectId } = require('mongodb');
const { extractPIdata, warmupModel } = require('./extractor');
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';

async function startWorker() {
    console.log('Worker Iniciado...');

    // 1. WAIT FOR OLLAMA (Retry indefinitely until active)
    let ollamaReady = false;
    while (!ollamaReady) {
        try {
            console.log("🔍 Checking Ollama availability...");
            await warmupModel();
            ollamaReady = true;
            console.log("✅ Ollama is READY.");
        } catch (e) {
            console.warn("⏳ Ollama not ready yet, retrying in 5s...", e.message);
            await new Promise(res => setTimeout(res, 5000));
        }
    }

    try {
        await connectDB();
        console.log('✅ Worker conectado a MongoDB.');

        const db = getDB();

        let connection;
        while (!connection) {
            try {
                connection = await amqp.connect(RABBITMQ_URL);
            } catch (err) {
                console.error("❌ RabbitMQ unavailable, retrying in 5s...");
                await new Promise(res => setTimeout(res, 5000));
            }
        }

        const channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.prefetch(1);
        console.log('✅ Worker conectado a RabbitMQ. Esperando mensajes...');

        channel.consume('pi_processing_queue', async (msg) => {
            if (msg !== null) {
                const jobData = JSON.parse(msg.content.toString());
                const { jobId, filePath, originalFileName, userId } = jobData;
                console.log(`⚙️ Procesando trabajo ${jobId} para el archivo: ${originalFileName}`);

                // 1. FETCH ALL FILES FOR THIS STUDENT (Historical Context)
                let allStudentJobs = [];
                try {
                    allStudentJobs = await db.collection('jobs')
                        .find({ userId: userId, filename: { $ne: "Resum Global" } })
                        .sort({ uploadedAt: 1 }) // Oldest first
                        .toArray();
                    console.log(`📚 Found ${allStudentJobs.length} historical documents for student ${userId}`);
                } catch (e) {
                    console.error("Error fetching student history:", e);
                    allStudentJobs = [];
                }

                // ID HANDLING: If userId is a valid ObjectId use it, else use it as string
                let searchId;
                try {
                    searchId = /^[0-9a-fA-F]{24}$/.test(userId) ? new ObjectId(userId) : userId;
                } catch (e) {
                    searchId = userId;
                }

                let job;
                try {
                    job = await db.collection('jobs').findOne({ _id: new ObjectId(jobId) });

                    if (!job) {
                        console.error(`❌ Job ${jobId} no encontrado en la base de datos.`);
                        channel.ack(msg);
                        return;
                    }

                    // Mark CURRENT job as processing
                    await db.collection('jobs').updateOne(
                        { _id: new ObjectId(jobId) },
                        { $set: { status: 'processing' } }
                    );

                    const role = jobData.role || job.role || 'docente';
                    if (role === 'historial') {
                        await db.collection('students').updateOne(
                            { _id: searchId },
                            { $set: { "global_summary.estado": 'GENERANT...' } }
                        );
                    }

                    // Prepare file list for Extractor (Only existing files)
                    let filesToAnalyze = allStudentJobs
                        .filter(j => j.filePath && fs.existsSync(j.filePath))
                        .map(j => ({
                            path: j.filePath,
                            name: j.filename,
                            date: j.uploadedAt,
                            id: j._id
                        }));

                    // If individual summary and current file missing, or global summary with no files
                    if (filesToAnalyze.length === 0) {
                        // Special case: if it was a single file job and it's missing
                        if (role !== 'historial' && filePath && fs.existsSync(filePath)) {
                            filesToAnalyze.push({ path: filePath, name: originalFileName, date: new Date(), id: jobId });
                        } else {
                            throw new Error("No s'han trobat els fitxers físics del document (poden haver estat esborrats del servidor).");
                        }
                    }

                    // Perform file extraction (Multi-File)
                    console.log(`🚀 Sending ${filesToAnalyze.length} documents to Extractor (Role: ${role})...`);
                    const extractedData = await extractPIdata(filesToAnalyze, role);
                    console.log(`✅ Extracción de datos completada.`);

                    // Update Job with Result
                    await db.collection('jobs').updateOne(
                        { _id: new ObjectId(jobId) },
                        {
                            $set: {
                                status: 'completed',
                                result: extractedData,
                                processedAt: new Date()
                            }
                        }
                    );

                    // IF ROLE IS HISTORIAL, ALSO UPDATE PLAYER RECORD
                    if (role === 'historial') {
                        await db.collection('students').updateOne(
                            { _id: searchId },
                            {
                                $set: {
                                    global_summary: {
                                        estado: 'COMPLETAT',
                                        resumen: extractedData,
                                        fecha: new Date()
                                    }
                                }
                            }
                        );
                    }

                    console.log(`⭐ Trabajo ${jobId} completado.`);

                    const notification = {
                        jobId,
                        userId,
                        filename: originalFileName,
                        status: 'completed',
                        message: 'File processed successfully.',
                        result: extractedData
                    };
                    channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(notification)), { persistent: true });

                    channel.ack(msg);

                } catch (error) {
                    console.error(`❌ Error procesando trabajo:`, error.message);

                    const notification = {
                        jobId,
                        userId,
                        filename: originalFileName,
                        status: 'failed',
                        message: error.message
                    };
                    channel.sendToQueue('job_notification_queue', Buffer.from(JSON.stringify(notification)), { persistent: true });

                    if (job) {
                        await db.collection('jobs').updateOne(
                            { _id: new ObjectId(jobId) },
                            {
                                $set: {
                                    status: 'failed',
                                    error: error.message
                                }
                            }
                        );

                        if (jobData.role === 'historial' || job.role === 'historial') {
                            await db.collection('students').updateOne(
                                { _id: searchId },
                                {
                                    $set: {
                                        "global_summary.estado": 'ERROR',
                                        "global_summary.resumen": error.message
                                    }
                                }
                            );
                        }
                    }
                    channel.ack(msg);
                }
            }
        }, { noAck: false });
    } catch (error) {
        console.error('❌ Error fatal en el Worker:', error.message);
        process.exit(1);
    }
}

startWorker();
