require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require("socket.io");
const { connectDB, getDB } = require('./db');
const { runSeed } = require('./utils/seeder');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const miscRoutes = require('./routes/miscRoutes');
const statsRoutes = require('./routes/statsRoutes'); 
const unityRoutes = require('./routes/unityRoutes');
const aiRoutes = require('./routes/aiRoutes'); 

const { connectRabbit, setBroadcastFn } = require('./services/rabbitService');
const { checkConnection } = require('./services/aiService');
const { cleanupBrokenFiles } = require('./utils/cleanup');

const app = express();
const PORT = process.env.PORT || 3001;

const sseClients = {};
const broadcastProgress = (filename, data) => {
    if (!sseClients[filename]) return;
    const payload = `data: ${JSON.stringify(data)}\n\n`;
    sseClients[filename].forEach(res => {
        try { res.write(payload); } catch (e) { }
    });
};
setBroadcastFn(broadcastProgress);

const allowedOrigins = [
    "http://localhost:3000",         
    "http://localhost:5173",         
    "http://127.0.0.1:3000",
    "http://incorporacio-pi.dam.inspedralbes.cat", 
    "https://incorporacio-pi.dam.inspedralbes.cat" 
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/unity', unityRoutes);
app.use('/api', aiRoutes); 
app.use('/api', miscRoutes);

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

connectDB().then(async () => {
    const db = getDB();

    console.log("🧹 Cleanup: Cleaning zombie AI tasks...");
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

    await cleanupBrokenFiles();

    connectRabbit();
    checkConnection(); 

    const server = http.createServer(app);
    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            credentials: true
        }
    });

    global.io = io;

    io.on('connection', (socket) => {
    });

    server.listen(PORT, '0.0.0.0', () => {
        console.log(`Server corrent en el port ${PORT}`);
        console.log(`Cors habilitat per a: ${allowedOrigins.join(', ')}`);
        console.log(`Serveis d'IA i RabbitMQ activats.`);
    });

}).catch((err) => {
    console.error("Error crític iniciant el servidor:", err);
});