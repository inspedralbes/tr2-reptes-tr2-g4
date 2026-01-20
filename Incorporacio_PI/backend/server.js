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
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/login', authRoutes);       // Login i codis
app.use('/api/students', studentRoutes); // CRUD Alumnes + Cerca Avançada
app.use('/api/upload', uploadRoutes);    // Pujada de fitxers
app.use('/api/stats', statsRoutes);      // NOU: Dashboard i Estadístiques (Agregacions)
app.use('/api', miscRoutes);             // Logs, manteniment, etc.

// START SERVER
connectDB().then(async () => {
    await runSeed();

    app.listen(PORT, () => {
        console.log(`Server corrent en http://localhost:${PORT}`);
    });
}).catch((err) => {
    console.error("Error crític iniciant el servidor:", err);
});