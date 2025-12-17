const express = require('express');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());

// CONFIGURACIÓN DE CARPETAS
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// CONFIGURACIÓN MULTER (Gestor de archivos)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Guardamos con: HASH + TIMESTAMP + EXTENSION
        const studentHash = req.body.studentHash || 'unknown';
        const ext = path.extname(file.originalname);
        cb(null, `${studentHash}_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage: storage });

// BASE DE DATOS SIMULADA
const dbAlumnosESO = [
    { id_ralc: "1112223334", nombre: "Joan Garcia Lopez", curso: "4t ESO" },
    { id_ralc: "5556667778", nombre: "Maria Martinez Soler", curso: "4t ESO" },
    { id_ralc: "9998887776", nombre: "Ahmed Benali", curso: "4t ESO" },
    { id_ralc: "1234567890", nombre: "Laia Valls Roca", curso: "4t ESO" }
];

// UTILIDADES
function generarHash(texto) {
    return crypto.createHash('sha256').update(texto).digest('hex');
}
function obtenerIniciales(nombre) {
    return nombre.split(' ').map(n => n[0]).join('.') + '.';
}

// --- RUTAS (ENDPOINTS) ---

// 1. OBTENER LISTA (Directo, sin login)
app.get('/api/students', (req, res) => {
    const listaSegura = dbAlumnosESO.map(alumno => {
        return {
            hash_id: generarHash(alumno.id_ralc),
            visual_identity: {
                iniciales: obtenerIniciales(alumno.nombre),
                ralc_suffix: `***${alumno.id_ralc.slice(-3)}`
            },
            // Verifica si existe algún archivo que empiece con ese hash
            has_file: fs.readdirSync(UPLOADS_DIR).some(f => f.startsWith(generarHash(alumno.id_ralc)))
        };
    });
    res.json(listaSegura);
});

// 2. SUBIR ARCHIVO
app.post('/api/upload', upload.single('documento_pi'), (req, res) => {
    if (!req.file || !req.body.studentHash) {
        return res.status(400).json({ success: false, message: 'Faltan datos' });
    }
    console.log(`📂 Archivo guardado para: ${req.body.studentHash.substring(0, 10)}...`);
    
    // Aquí es donde entraría la IA más tarde
    
    res.json({ success: true, message: 'Subida correcta' });
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor listo en http://localhost:${PORT}`);
});