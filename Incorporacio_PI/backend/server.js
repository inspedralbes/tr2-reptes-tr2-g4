require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); // <--- 1. IMPORTAR HTTP
const { Server } = require("socket.io"); // <--- 2. IMPORTAR SOCKET.IO
const { connectDB } = require('./db');
const { runSeed } = require('./utils/seeder');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const miscRoutes = require('./routes/miscRoutes');
const statsRoutes = require('./routes/statsRoutes');

const app = express();
const PORT = 3001;

// <--- 3. CREAR EL SERVIDOR HTTP Y CONFIGURAR SOCKET.IO --->
const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173", // O pon "*" para permitir cualquiera
        methods: ["GET", "POST"]
    }
});

// <--- 4. HACER 'io' ACCESIBLE GLOBALMENTE (TRUCO CLAVE) --->
// Esto permite usar global.io.emit(...) en logger.js sin importar nada
global.io = io; 

io.on('connection', (socket) => {
    console.log('Cliente conectado al socket:', socket.id);
});

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', authRoutes);       
app.use('/api/students', studentRoutes); 
app.use('/api/upload', uploadRoutes);    
app.use('/api/stats', statsRoutes);      
app.use('/api', miscRoutes);             

// START SERVER (Nota: usamos server.listen en vez de app.listen)
connectDB().then(async () => {
    await runSeed();

    // <--- 5. CAMBIAR app.listen POR server.listen --->
    server.listen(PORT, () => {
        console.log(`Server corrent en http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error("Error crític iniciant el servidor:", err);
});