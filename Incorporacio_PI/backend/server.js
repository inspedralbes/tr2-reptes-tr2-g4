require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http'); 
const { Server } = require("socket.io"); 
const { connectDB } = require('./db');
const { runSeed } = require('./utils/seeder');

const authRoutes = require('./routes/authRoutes');
const studentRoutes = require('./routes/studentRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const miscRoutes = require('./routes/miscRoutes');
const statsRoutes = require('./routes/statsRoutes');
const unityRouytes = require('./routes/unityRoutes');

const app = express();
const PORT = process.env.PORT || 3001; // Usa el puerto del entorno o 3001

// --- LISTA DE DOMINIOS PERMITIDOS (CORS) ---
const allowedOrigins = [
    "http://localhost:5173", 
    "http://127.0.0.1:5173",
    "http://localhost:4173", // Vite Preview
    "http://incorporacio-pi.dam.inspedralbes.cat", // DOMINIO REAL (HTTP)
    "https://incorporacio-pi.dam.inspedralbes.cat" // DOMINIO REAL (HTTPS)
];

// --- 1. CONFIGURACIÓN DEL SERVIDOR HTTP Y SOCKET.IO ---
const server = http.createServer(app); 
const io = new Server(server, {
    cors: {
        origin: allowedOrigins, // Aplicamos la lista aquí también
        methods: ["GET", "POST"],
        credentials: true
    }
});

// --- 2. HACER 'io' ACCESIBLE GLOBALMENTE ---
global.io = io; 

io.on('connection', (socket) => {
    // console.log('Cliente conectado al socket:', socket.id); // Opcional: comentar para menos ruido en logs
});

// --- 3. CONFIGURACIÓN CORS DE EXPRESS ---
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir archivos estáticos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas API
app.use('/api/login', authRoutes);       
app.use('/api/students', studentRoutes); 
app.use('/api/upload', uploadRoutes);    
app.use('/api/stats', statsRoutes);      
app.use('/api', miscRoutes);             
app.use('/api/unity', unityRoutes);

// --- 4. INICIAR SERVIDOR ---
connectDB().then(async () => {
    // await runSeed(); // Puedes comentar esto si no quieres que se resetee la BD cada vez

    server.listen(PORT, () => {
        console.log(`🚀 Server corrent en el port ${PORT}`);
        console.log(`🌐 Cors habilitat per a: ${allowedOrigins.join(', ')}`);
    });
}).catch((err) => {
    console.error("❌ Error crític iniciant el servidor:", err);
});