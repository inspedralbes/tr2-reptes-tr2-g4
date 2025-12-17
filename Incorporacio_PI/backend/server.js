const express = require('express');
const cors = require('cors'); // Necesario para conectar con Vue
const multer = require('multer'); // Para subir archivos
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Para encriptar IDs

const app = express();
const PORT = 3000;

// --- MIDDLEWARES ---
app.use(cors()); // Permite todas las conexiones (modo dev)
app.use(express.json());

// --- CONFIGURACIÓN DE CARPETA DE SUBIDAS ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
// Si no existe la carpeta 'uploads', la crea automáticamente
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR);
}

// --- CONFIGURACIÓN MULTER (Gestión de Archivos) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        // Obtenemos el Hash del alumno que nos envía el frontend
        const studentHash = req.body.studentHash || 'unknown';
        const extension = path.extname(file.originalname);
        
        // Guardamos el fichero como: HASH_TIMESTAMP.pdf
        // Así evitamos sobreescribir si suben dos veces el mismo
        cb(null, `${studentHash}_${Date.now()}${extension}`);
    }
});
const upload = multer({ storage: storage });

// --- BASE DE DATOS FAKE (Datos Sensibles) ---
const dbAlumnos = [
    { id: "111222333", nombre: "Joan Garcia Lopez" },
    { id: "444555666", nombre: "Maria Martinez Soler" },
    { id: "777888999", nombre: "Ahmed Benali" },
    { id: "123123123", nombre: "Sofia Valls Roca" }
];

// --- FUNCIONES AUXILIARES ---
// Genera el Hash SHA-256 (Identificador único y seguro)
const generarHash = (id) => crypto.createHash('sha256').update(id).digest('hex');

// Genera las iniciales para mostrar en pantalla (J.G.L.)
const obtenerIniciales = (nombre) => nombre.split(' ').map(n => n[0]).join('.') + '.';


// --- RUTAS (ENDPOINTS) ---

// 1. OBTENER LISTA DE ALUMNOS
app.get('/api/students', (req, res) => {
    // Leemos qué archivos hay ya en la carpeta para marcar el check verde
    const archivosEnDisco = fs.readdirSync(UPLOADS_DIR);

    const listaSegura = dbAlumnos.map(alumno => {
        const hash = generarHash(alumno.id);
        
        return {
            hash_id: hash, // ID técnico para la BBDD
            visual_identity: {
                iniciales: obtenerIniciales(alumno.nombre), // Para que el profe lo reconozca
                ralc_suffix: `***${alumno.id.slice(-3)}`   // Para confirmar
            },
            // Comprobamos si existe algún archivo que empiece con este Hash
            has_file: archivosEnDisco.some(filename => filename.startsWith(hash))
        };
    });

    res.json(listaSegura);
});

// 2. SUBIR DOCUMENTO (PDF/WORD/IMG)
// 'documento_pi' es el nombre del campo que usaremos en el Frontend
app.post('/api/upload', upload.single('documento_pi'), (req, res) => {
    try {
        if (!req.file || !req.body.studentHash) {
            return res.status(400).json({ success: false, message: 'Faltan datos' });
        }

        console.log(`✅ Archivo recibido para: ${req.body.studentHash.substring(0, 10)}...`);
        console.log(`📂 Guardado como: ${req.file.filename}`);

        // Devolvemos OK para que el frontend actualice la lista
        res.json({ success: true, filename: req.file.filename });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error al guardar archivo' });
    }
});

// --- ARRANCAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend escuchando en http://localhost:${PORT}`);
    console.log(`📂 Los archivos se guardarán en: ${UPLOADS_DIR}`);
});