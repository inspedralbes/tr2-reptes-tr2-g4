const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = 3000;

// MIDDLEWARES
app.use(cors());
app.use(express.json());

// --- 1. CONFIGURACIÓN LOGIN ---
const codigosTemporales = {}; 

app.post('/api/login/send-code', (req, res) => {
    const { email } = req.body;
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    codigosTemporales[email] = code;
    console.log(`📨 Enviando código a ${email}: ${code}`);
    res.json({ success: true });
});

app.post('/api/login/verify-code', (req, res) => {
    const { email, code } = req.body;
    if (codigosTemporales[email] === code) {
        delete codigosTemporales[email];
        res.json({ success: true, token: 'fake-jwt', user: { email } });
    } else {
        res.status(401).json({ success: false, message: 'Código mal' });
    }
});

// --- 2. CONFIGURACIÓN ESTUDIANTES (¡ESTO ES LO QUE TE FALTA O FALLA!) ---

const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const hash = req.body.studentHash || 'unknown';
        cb(null, `${hash}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// DATOS FAKE
const dbAlumnos = [
    { id: "111222333", nombre: "Joan Garcia" },
    { id: "444555666", nombre: "Maria Martinez" },
    { id: "777888999", nombre: "Pau López" },
    { id: "123456789", nombre: "Laura Sánchez" },
    { id: "987654321", nombre: "Marc Fernández" },
    { id: "555666777", nombre: "Anna Puig" },
    { id: "222333444", nombre: "Oriol Casas" },
    { id: "888999000", nombre: "Clara Vidal" }
];


// Helpers
const generarHash = (id) => crypto.createHash('sha256').update(id).digest('hex');
const obtenerIniciales = (nombre) => nombre.split(' ').map(n => n[0]).join('.') + '.';

// RUTA IMPORTANTE QUE TE ESTÁ DANDO ERROR 404
app.get('/api/students', (req, res) => {
    const archivos = fs.readdirSync(UPLOADS_DIR);
    
    const lista = dbAlumnos.map(alum => {
        const hash = generarHash(alum.id);
        return {
            hash_id: hash,
            visual_identity: {
                iniciales: obtenerIniciales(alum.nombre),
                ralc_suffix: `***${alum.id.slice(-3)}`
            },
            has_file: archivos.some(f => f.startsWith(hash))
        };
    });
    
    // IMPORTANTE: Responde JSON
    res.json(lista);
});

// RUTA DE SUBIDA
app.post('/api/upload', upload.single('documento_pi'), (req, res) => {
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});