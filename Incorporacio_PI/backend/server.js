require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { connectDB, getDB } = require('./db');
const { ObjectId } = require('mongodb');
const amqp = require('amqplib');
const WebSocket = require('ws');
const { extractTextFromFile } = require('./fileReader');

const app = express();
const port = process.env.PORT || 4000;

const upload = multer({ dest: 'uploads/' });
connectDB();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const WSS_PORT = 4001;
const wss = new WebSocket.Server({ port: WSS_PORT });
const clients = new Map();

wss.on('connection', (ws, req) => {
    const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');
    if (userId) clients.set(String(userId), ws);
    ws.on('close', () => { if (userId) clients.delete(String(userId)); });
});

let channel;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.assertQueue('analisi_notificacio_queue', { durable: true });

        channel.consume('analisi_notificacio_queue', (msg) => {
            if (msg !== null) {
                const note = JSON.parse(msg.content.toString());
                const clientWs = clients.get(String(note.userId));
                if (clientWs && clientWs.readyState === WebSocket.OPEN) clientWs.send(JSON.stringify(note));
                channel.ack(msg);
            }
        });
    } catch (e) { setTimeout(connectRabbitMQ, 5000); }
}
connectRabbitMQ();

// --- API ---

app.get('/api/students', async (req, res) => {
    const db = getDB();
    const students = await db.collection('students').find().toArray();
    const allAnalisis = await db.collection('analisis_pi').find().sort({ uploadedAt: -1 }).toArray();

    const combinedList = [];
    const processedIds = new Set();

    students.forEach(student => {
        const sId = student._id.toString();
        const studentAnalisis = allAnalisis.filter(a => a.userId === sId && a.filename !== "Resum Global");
        const latest = studentAnalisis[0];
        processedIds.add(sId);

        combinedList.push({
            hash_id: sId,
            original_name: student.name,
            original_id: student.centerCode || sId,
            visual_identity: student.visual_identity,
            has_file: !!latest,
            files: studentAnalisis.map(a => ({
                filename: a.filename,
                upload_date: a.uploadedAt,
                analisiId: a._id.toString() // Cambiado de jobId a analisiId
            })),
            ia_data: latest ? {
                estado: mapStatus(latest.status, latest.status_detail),
                last_update: latest.processedAt,
                resumen: latest.result || (latest.error ? { error: latest.error } : null),
                analisiId: latest._id.toString() // Cambiado de jobId a analisiId
            } : null,
            global_summary: student.global_summary
        });
    });

    allAnalisis.forEach(ana => {
        if (ana.filename === "Resum Global" || processedIds.has(ana.userId)) return;
        combinedList.push({
            hash_id: ana.userId,
            original_name: ana.filename.split('.')[0],
            original_id: "Ext.",
            has_file: true,
            ia_data: {
                estado: mapStatus(ana.status, ana.status_detail),
                resumen: ana.result || { error: ana.error },
                analisiId: ana._id.toString()
            },
            filename: ana.filename
        });
        processedIds.add(ana.userId);
    });
    res.json(combinedList);
});

function mapStatus(status, detail) {
    if (status === 'queued') return 'A LA CUA';
    if (status === 'processing') return detail || 'ANALITZANT...';
    if (status === 'completed') return 'COMPLETAT';
    if (status === 'failed') return 'ERROR';
    return status;
}

app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    if (!req.file || !channel) return res.status(400).json({ success: false });
    const userId = req.body.studentHash || req.body.userId;
    const analisisId = new ObjectId();

    const nuevoAnalisis = {
        _id: analisisId,
        userId: userId,
        filename: req.file.originalname,
        filePath: req.file.path,
        status: 'queued',
        uploadedAt: new Date(),
        role: req.body.role || 'docente'
    };

    await getDB().collection('analisis_pi').insertOne(nuevoAnalisis);
    channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify({
        analisiId: analisisId.toString(), // Cambiado de jobId a analisiId
        filePath: req.file.path,
        originalFileName: req.file.originalname,
        userId,
        role: nuevoAnalisis.role
    })));

    res.json({ success: true, analisiId: analisisId, filename: req.file.originalname });
});

app.get('/api/status/:id', async (req, res) => {
    const analisis = await getDB().collection('analisis_pi').findOne({ _id: new ObjectId(req.params.id) });
    res.json(analisis || { status: 'not_found' });
});

app.post('/api/generate-summary', async (req, res) => {
    const { text, filename, role, userId } = req.body;
    if (!channel) return res.status(500).json({ error: 'RabbitMQ Error' });

    const analisisId = new ObjectId();
    const nuevoAnalisis = {
        _id: analisisId,
        userId: userId,
        filename: filename,
        status: 'queued',
        uploadedAt: new Date(),
        role: role
    };

    await getDB().collection('analisis_pi').insertOne(nuevoAnalisis);

    channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify({
        analisiId: analisisId.toString(),
        userId: userId,
        role: role,
        filename: filename,
        text: text // Pass text directly if no file path
    })));

    res.json({ success: true, analisiId });
});

app.post('/api/chat', async (req, res) => {
    const { text, question } = req.body;
    const response = await fetch(`${process.env.OLLAMA_HOST}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: process.env.MODEL_NAME,
            system: "Respon en Català molt breu.",
            prompt: `Document: ${text.substring(0, 10000)}\nPregunta: ${question}`,
            stream: false,
            options: { num_predict: 80 }
        })
    });
    const data = await response.json();
    res.json({ answer: data.response });
});

app.listen(port, '0.0.0.0', () => console.log(`🚀 API en puerto ${port}`));