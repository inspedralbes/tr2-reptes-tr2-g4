require('dotenv').config();
const express = require('express');
const http = require('http'); // <--- 1. Importar http
const { Server } = require('socket.io'); // <--- 2. Importar Server de socket.io
const cors = require('cors');
const path = require('path');
const { connectDB } = require('./db');
const { runSeed } = require('./utils/seeder');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const miscRoutes = require('./routes/miscRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const PORT = 3001;

// <--- 3. Crear servidor HTTP y configurar Socket.io
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // Ajusta esto a la URL de tu frontend (Vite suele ser 5173)
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

// <--- 4. Middleware para inyectar 'io' en las rutas
app.use((req, res, next) => {
    req.io = io;
    next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api', miscRoutes);

// START SERVER
connectDB().then(async () => {
    await runSeed();
    
    // <--- 5. CAMBIAR app.listen POR server.listen
    server.listen(PORT, () => {
        console.log(`Server i Socket.io corrent en http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error("Error crític iniciant el servidor:", err);
});