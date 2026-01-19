require('dotenv').config();
const express = require('express');
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
// Usamos el puerto del entorno o el 3001 por defecto
const PORT = process.env.PORT || 3001; 

// --- CONFIGURACIÓN CORS (LO IMPORTANTE) ---
app.use(cors({
    origin: [
        'http://localhost:5173', // Para cuando trabajas en tu PC
        'http://localhost:3000', // Por si acaso
        'http://incorporacio-pi.dam.inspedralbes.cat', // TU DOMINIO REAL
        'https://incorporacio-pi.dam.inspedralbes.cat' // Tu dominio con HTTPS (por si acaso)
    ],
    credentials: true, // Permite cookies y headers de autorización
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Servir archivos subidos
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rutas
app.use('/api/login', authRoutes);       
app.use('/api/students', studentRoutes); 
app.use('/api/upload', uploadRoutes);    
app.use('/api/stats', statsRoutes);      
app.use('/api', miscRoutes);             

// START SERVER
connectDB().then(async () => {
    // await runSeed(); // Cuidado con ejecutar el seed cada vez en producción, puede duplicar datos

    app.listen(PORT, '0.0.0.0', () => { // '0.0.0.0' permite conexiones externas
        console.log(`Server corrent en puerto ${PORT}`);
    });
}).catch((err) => {
    console.error("Error crític iniciant el servidor:", err);
});