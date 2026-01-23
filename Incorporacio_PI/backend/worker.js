const amqp = require('amqplib');
const { MongoClient, ObjectId } = require('mongodb');
const { extractPIdata, warmupModel } = require('./extractor');
const fs = require('fs');

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';
const MONGODB_URI = process.env.MONGODB_URI;

async function startWorker() {
    try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db();
        const studentsColl = db.collection('students');
        const analisisColl = db.collection('analisis_pi');

        await warmupModel();

        const connection = await amqp.connect(RABBITMQ_URL);
        const channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.assertQueue('analisi_notificacio_queue', { durable: true });
        await channel.prefetch(1);

        console.log('✅ Processador d\'anàlisi actiu.');

        channel.consume('pi_processing_queue', async (msg) => {
            if (!msg) return;
            const data = JSON.parse(msg.content.toString());
            const { analisiId, filePath, originalFileName, userId, role, text } = data;

            let searchId = userId;
            try { if (ObjectId.isValid(userId)) searchId = new ObjectId(userId); } catch (e) { }

            try {
                await analisisColl.updateOne({ _id: new ObjectId(analisiId) }, { $set: { status: 'processing', startedAt: new Date() } });

                const notify = async (status, message, result = null) => {
                    const note = { analisiId, userId, filename: originalFileName || data.filename, status, message, resumen: result };
                    channel.sendToQueue('analisi_notificacio_queue', Buffer.from(JSON.stringify(note)), { persistent: true });
                    await analisisColl.updateOne({ _id: new ObjectId(analisiId) }, { $set: { status_detail: message } });
                };

                await notify('processing', 'ANALITZANT DADES...');

                let contextToUse = text;
                // Si hay archivo, extraemos el texto y lo guardamos en la DB para siempre
                if (filePath) {
                    const { extractTextFromFile } = require('./fileReader');
                    contextToUse = await extractTextFromFile(filePath, originalFileName);
                    await analisisColl.updateOne(
                        { _id: new ObjectId(analisiId) },
                        { $set: { rawText: contextToUse } }
                    );
                }

                const result = await extractPIdata([], role || 'docente', (prog) => {
                    notify('processing', prog);
                }, contextToUse);

                // Guardar en la ficha del alumno
                try {
                    if (role === 'historial') {
                        await studentsColl.updateOne({ _id: searchId }, {
                            $set: { "global_summary.data": result, "global_summary.estado": 'COMPLETAT' }
                        });
                    } else {
                        await studentsColl.updateOne(
                            { _id: searchId, "documents.analisiId": analisiId },
                            { $set: { "documents.$.resultIA": result, "documents.$.statusIA": 'COMPLETAT' } }
                        );
                    }
                } catch (e) {
                    console.warn("No s'ha pogut actualitzar el document de l'estudiant:", e.message);
                }

                await analisisColl.updateOne({ _id: new ObjectId(analisiId) }, { $set: { status: 'completed', result, completedAt: new Date() } });
                await notify('completed', 'FET!', result);

                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                channel.ack(msg);

            } catch (error) {
                console.error(`❌ Error en l'anàlisi ${analisiId}:`, error.message);
                await analisisColl.updateOne({ _id: new ObjectId(analisiId) }, { $set: { status: 'failed', error: error.message } });
                const fail = { analisiId, userId, filename: originalFileName || data.filename, status: 'failed', message: error.message };
                channel.sendToQueue('analisi_notificacio_queue', Buffer.from(JSON.stringify(fail)), { persistent: true });
                if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
                channel.ack(msg);
            }
        });
    } catch (error) { setTimeout(startWorker, 5000); }
}

startWorker();
