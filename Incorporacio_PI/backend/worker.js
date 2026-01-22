require('dotenv').config();
const amqp = require('amqplib');
const mongoose = require('mongoose');
const Job = require('./models/Job');
const { extractPIdata, warmupModel } = require('./extractor');
const fs = require('fs');
const path = require('path');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

async function startWorker() {
    console.log('Worker Iniciado...');

    // Warmup AI in background (Blocking until ready to prevent timeout on first job)
    await warmupModel();

    try {
        if (!MONGO_URI) throw new Error("No Mongo URI provided in .env");
        await mongoose.connect(MONGO_URI);
        console.log('✅ Worker conectado a MongoDB (Atlas/External).');

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

                // 1. FETCH ALL JOBS FOR THIS STUDENT (Historical Context)
                let allStudentJobs = [];
                try {
                    allStudentJobs = await Job.find({ userId: userId }).sort({ uploadedAt: 1 }); // Oldest first
                    console.log(`📚 Found ${allStudentJobs.length} historical documents for student ${userId}`);
                } catch (e) {
                    console.error("Error fetching student history:", e);
                    allStudentJobs = []; // Fallback to current job only if this fails (shouldn't happen)
                }

                // If for some reason the current job is not in the list (race condition?), add it manually
                // But normally it should be there as we just saved it in server.js

                let job;
                try {
                    job = await Job.findById(jobId);
                    if (!job) {
                        console.error(`❌ Job ${jobId} no encontrado en la base de datos.`);
                        channel.ack(msg);
                        return;
                    }

                    // Mark CURRENT job as processing (others are ostensibly already processed or don't matter state-wise for this trigger)
                    job.status = 'processing';
                    await job.save();

                    // Prepare file list for Extractor
                    // We want to pass: [{ path: ..., name: ..., date: ... }]
                    const filesToAnalyze = allStudentJobs.map(j => ({
                        path: j.filePath,
                        name: j.filename,
                        date: j.uploadedAt,
                        id: j._id
                    }));

                    // If list is empty (shouldn't be), add current
                    if (filesToAnalyze.length === 0) {
                        filesToAnalyze.push({ path: filePath, name: originalFileName, date: new Date(), id: jobId });
                    }

                    // Perform file extraction (Multi-File)
                    console.log(`🚀 Sending ${filesToAnalyze.length} documents to Extractor...`);
                    const extractedData = await extractPIdata(filesToAnalyze);
                    console.log(`✅ Extracción de datos completada.`);

                    job.status = 'completed';
                    job.result = extractedData;
                    job.processedAt = new Date();
                    await job.save();

                    console.log(`⭐ Trabajo ${jobId} completado.`);

                    // DO NOT DELETE FILE TO ALLOW REGENERATION / RAW TEXT VIEW
                    /*
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                    }
                    */

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
                        job.status = 'failed';
                        job.error = error.message; // Save error message
                        await job.save();
                    }
                    // DO NOT DELETE FILE ON ERROR EITHER
                    // if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (e) { }
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
