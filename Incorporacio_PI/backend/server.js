require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { connectDB, getDB } = require('./db');
const { runSeed } = require('./utils/seeder');

// Importar rutes
const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const miscRoutes = require('./routes/miscRoutes');
const unityRoutes = require('./routes/unityRoutes');
const aiRoutes = require('./routes/aiRoutes');
const { connectRabbit, setBroadcastFn } = require('./services/rabbitService');
const { checkConnection } = require('./services/aiService');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = 3001;

// --- SSE: REGISTRO DE CLIENTES ---
const sseClients = {};
const broadcastProgress = (filename, data) => {
    if (!sseClients[filename]) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients[filename].forEach(res => {
        try { res.write(payload); } catch (e) { }
    });
};
setBroadcastFn(broadcastProgress);

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// RUTES
app.use('/api/login', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/unity', unityRoutes);
app.use('/api', aiRoutes);
app.use('/api', miscRoutes);

// SSE Endpoint
app.get('/api/progress/:filename', (req, res) => {
    const { filename } = req.params;
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    if (!sseClients[filename]) sseClients[filename] = [];
    sseClients[filename].push(res);
    res.write(`data: ${JSON.stringify({ status: "CONNECTED", progress: 0 })}\n\n`);
    req.on('close', () => {
        if (sseClients[filename]) {
            sseClients[filename] = sseClients[filename].filter(c => c !== res);
            if (sseClients[filename].length === 0) delete sseClients[filename];
        }
    });
});

// START SERVER
connectDB().then(async () => {
    const db = getDB();

    console.log("Cleanup: Cleaning zombie tasks...");
    const msgInterrupcio = "El proces es va interrompre pel reinici del servidor. Torna a generar-lo.";

    await db.collection('students').updateMany(
        { "ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } },
        { $set: { "ia_data.estado": "INTERROMPUT", "ia_data.resumen": msgInterrupcio } }
    );

    await db.collection('students').updateMany(
        { "files.ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } },
        { $set: { "files.$[elem].ia_data.estado": "INTERROMPUT", "files.$[elem].ia_data.resumen": msgInterrupcio } },
        { arrayFilters: [{ "elem.ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } }] }
    );

    const { cleanupBrokenFiles } = require('./utils/cleanup');
    await cleanupBrokenFiles();

    await runSeed();
    connectRabbit();
    checkConnection();

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"]
        }
    });

    global.io = io;

    io.on('connection', (socket) => {
        console.log('Socket: New client connected:', socket.id);
        socket.on('disconnect', () => {
            console.log('Socket: Client disconnected');
        });
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server: Running on http://localhost:${PORT}`);
    });
}).catch(console.error);
