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

// WebSocket
const WSS_PORT = 4001;
const wss = new WebSocket.Server({ port: WSS_PORT });
const clients = new Map();

wss.on('connection', (ws, req) => {
    const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');
    if (userId) clients.set(String(userId), ws);
    ws.on('close', () => { if (userId) clients.delete(String(userId)); });
});

// RabbitMQ
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

function mapStatus(status, detail) {
    if (status === 'queued') return 'A LA CUA';
    if (status === 'processing') return detail || 'ANALITZANT...';
    if (status === 'completed') return 'COMPLETAT';
    if (status === 'failed') return 'ERROR';
    return status;
}

// --- API ---

app.get('/api/students', async (req, res) => {
    try {
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
                visual_identity: student.visual_identity || {
                    iniciales: (student.name || "UN").substring(0, 2).toUpperCase(),
                    ralc_suffix: '000',
                    color_bg: '#E0E0E0',
                    color_text: '#000000'
                },
                has_file: !!latest,
                files: studentAnalisis.map(a => ({
                    filename: a.filename,
                    upload_date: a.uploadedAt,
                    analisiId: a._id.toString()
                })),
                ia_data: latest ? {
                    estado: mapStatus(latest.status, latest.status_detail),
                    last_update: latest.processedAt,
                    resumen: latest.result || (latest.error ? { error: latest.error } : null),
                    analisiId: latest._id.toString()
                } : null,
                global_summary: student.global_summary
            });
        });

        allAnalisis.forEach(ana => {
            if (ana.filename === "Resum Global" || processedIds.has(ana.userId)) return;
            const derivedName = ana.filename.split('.')[0];
            combinedList.push({
                hash_id: ana.userId,
                original_name: derivedName,
                original_id: "Ext.",
                visual_identity: {
                    iniciales: derivedName.substring(0, 2).toUpperCase(),
                    ralc_suffix: 'FILE',
                    color_bg: '#FFCC80',
                    color_text: '#000000'
                },
                has_file: true,
                ia_data: {
                    estado: mapStatus(ana.status, ana.status_detail),
                    resumen: ana.result || { error: ana.error },
                    analisiId: ana._id.toString()
                },
                filename: ana.filename,
                files: [{ filename: ana.filename, upload_date: ana.uploadedAt }]
            });
            processedIds.add(ana.userId);
        });
        res.json(combinedList);
    } catch (e) {
        res.status(500).json({ error: 'Server Error' });
    }
});

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
        analisiId: analisisId.toString(),
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

app.get('/api/analyze/:filename', async (req, res) => {
    try {
        const filename = req.params.filename;
        const ana = await getDB().collection('analisis_pi').findOne({ filename: filename }, { sort: { uploadedAt: -1 } });
        if (!ana) return res.status(404).json({ error: 'File not found' });

        let text = ana.rawText || "";

        // Si no está en la DB, intentamos leer el archivo (compatibilidad con archivos antiguos)
        if (!text && ana.filePath && fs.existsSync(ana.filePath)) {
            text = await extractTextFromFile(ana.filePath, ana.filename);
        } else if (!text) {
            text = "Fitxer no disponible. El text no s'ha pogut recuperar de la base de dades.";
        }

        res.json({ text_completo: text });
    } catch (error) {
        console.error("Error en /api/analyze/:", error);
        res.status(500).json({ error: 'Error intern del servidor' });
    }
});

app.post('/api/generate-summary', async (req, res) => {
    const { text, filename, role, studentHash, userId } = req.body;
    if (!channel) return res.status(500).json({ error: 'RabbitMQ Error' });

    const analisisId = new ObjectId();
    const studentId = studentHash || userId || "TEMP_USER";

    const nuevoAnalisis = {
        _id: analisisId,
        userId: studentId,
        filename: filename,
        status: 'queued',
        uploadedAt: new Date(),
        role: role
    };

    await getDB().collection('analisis_pi').insertOne(nuevoAnalisis);
    channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify({
        analisiId: analisisId.toString(),
        userId: studentId,
        role: role,
        filename: filename,
        text: text
    })));

    res.json({ success: true, analisisId });
});

app.get('/api/queue-status', async (req, res) => {
    try {
        const queuedAnalisis = await getDB().collection('analisis_pi')
            .find({ status: 'queued' })
            .sort({ uploadedAt: 1 })
            .toArray();
        const queue = queuedAnalisis.map(a => a.filename);
        res.json({ queue });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
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

app.delete('/api/students/:id/files/:filename', async (req, res) => {
    const { id, filename } = req.params;
    await getDB().collection('analisis_pi').deleteMany({ userId: id, filename: filename });
    res.json({ success: true });
});

app.listen(port, () => console.log(`🚀 API activa en port ${port}`));