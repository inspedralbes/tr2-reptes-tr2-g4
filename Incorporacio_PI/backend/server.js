require('dotenv').config()
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Del teu company
const { connectDB, getDB } = require('./db'); // La teva DB

const app = express();
const PORT = 3001;

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir fitxers

// --- HELPER FUNCTIONS (Del teu company) ---
const generarHash = (id) => crypto.createHash('sha256').update(id).digest('hex');
const obtenerIniciales = (nombre) => nombre.split(' ').map(n => n[0]).join('.') + '.';

// --- 1. CONFIGURACIÓ MULTER ---
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        // Guardem amb Hash + Timestamp per evitar duplicats de nom (idea del company)
        const hash = req.body.studentHash || 'unknown';
        cb(null, `${hash}_${Date.now()}${path.extname(file.originalname)}`);
    }
});
const upload = multer({ storage: storage });

// --- 2. RUTAS DE LOGIN (Amb MongoDB) ---
app.post('/api/login/send-code', async (req, res) => {
    const { email } = req.body;
    try {
        const db = getDB();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );
        console.log(`📨 LOGIN: Codi per ${email}: ${code}`);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Error DB' });
    }
});

// server.js

app.post('/api/login/verify-code', async (req, res) => {
    const { email, code } = req.body;
    console.log("🔍 INTENTO DE LOGIN:");
    console.log("   -> Email recibido:", email);
    console.log("   -> Código recibido:", code);

    try {
        const db = getDB();
        const reg = await db.collection('login_codes').findOne({ email });

        console.log("   -> Registro en DB:", reg);

        // Comprobaciones detalladas para ver dónde falla
        if (!reg) {
            console.log("   ❌ ERROR: No existe registro para este email.");
            return res.status(401).json({ success: false, message: 'Email no encontrado' });
        }
        
        // Convertimos ambos a String por si acaso hay mezcla de tipos (número vs texto)
        if (String(reg.code) !== String(code)) {
            console.log(`   ❌ ERROR: Códigos no coinciden. DB: ${reg.code} vs INPUT: ${code}`);
            return res.status(401).json({ success: false, message: 'Codi incorrecte' });
        }

        if (reg.used) {
            console.log("   ❌ ERROR: Este código ya fue usado.");
            return res.status(401).json({ success: false, message: 'Codi ja usat' });
        }

        // Si pasa todo esto, éxito
        console.log("   ✅ ÉXITO: Login correcto.");
        await db.collection('login_codes').updateOne({ email }, { $set: { used: true } });
        res.json({ success: true, token: 'fake-jwt', user: { email } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error DB' });
    }
});

// --- 3. RUTAS ESTUDIANTES (Amb MongoDB) ---

// GET: Recupera de Mongo (molt més ràpid que llegir disc cada vegada)
app.get('/api/students', async (req, res) => {
    try {
        const db = getDB();
        const students = await db.collection('students').find().toArray();
        res.json(students);
    } catch (error) {
        res.status(500).json({ error: 'Error al servidor' });
    }
});

// POST: Puja fitxer i actualitza Mongo
app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    const studentHash = req.body.studentHash;
    if (!req.file || !studentHash) return res.status(400).json({ success: false });

    try {
        const db = getDB();
        // Simulem IA
        const iaData = {
            estado: "PROCESADO",
            resumen: "Document processat correctament el " + new Date().toLocaleDateString()
        };

        // Preparamos los datos del archivo para el historial
        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date()
        };

        // Actualitzem la BD
        await db.collection('students').updateOne(
            { hash_id: studentHash },
            { 
                $set: { 
                    has_file: true, 
                    filename: req.file.filename, // Mantenemos esto para compatibilidad
                    ia_data: iaData
                },
                $push: { files: fileData } // Añadimos al historial de archivos
            }
        );

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// DELETE: Eliminar fitxer específic d'un estudiant
app.delete('/api/students/:hash/files/:filename', async (req, res) => {
    const { hash, filename } = req.params;
    try {
        const db = getDB();
        
        // 1. Eliminar del array de archivos en Mongo
        const resArray = await db.collection('students').updateOne(
            { hash_id: hash },
            { $pull: { files: { filename: filename } } }
        );
        console.log(`🗑️ DELETE: Eliminado de array 'files': ${resArray.modifiedCount} docs`);

        // 1.5. Si es el archivo "legacy" (campo filename suelto), lo borramos también
        const resLegacy = await db.collection('students').updateOne(
            { hash_id: hash, filename: filename },
            { $unset: { filename: "" } }
        );
        console.log(`🗑️ DELETE: Eliminado de campo 'filename' (legacy): ${resLegacy.modifiedCount} docs`);

        // 2. Verificar si quedan archivos para actualizar el estado has_file
        const student = await db.collection('students').findOne({ hash_id: hash });
        // Tiene archivos si el array tiene algo O si queda un filename legacy
        const hasFiles = (student.files && student.files.length > 0) || (!!student.filename);
        
        await db.collection('students').updateOne(
            { hash_id: hash },
            { $set: { has_file: hasFiles } }
        );

        // 3. Eliminar archivo físico del servidor
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// --- 4. SEED (Dades del company cap a MongoDB) ---
// Aquesta llista és la que ha posat el teu company
const dbAlumnosRaw = [
    { id: "111222333", nombre: "Joan Garcia" },
    { id: "444555666", nombre: "Maria Martinez" },
    { id: "777888999", nombre: "Pau López" },
    { id: "123456789", nombre: "Laura Sánchez" },
    { id: "987654321", nombre: "Marc Fernández" },
    { id: "555666777", nombre: "Anna Puig" },
    { id: "222333444", nombre: "Oriol Casas" },
    { id: "888999000", nombre: "Clara Vidal" }
];

connectDB().then(async () => {
    const db = getDB();
    const count = await db.collection('students').countDocuments();
    
    // Si la BD està buida, la omplim amb les dades del company però formatades per al teu Vue
    if (count === 0) {
        console.log("🌱 Seed: Inserint dades del company a MongoDB...");
        const docs = dbAlumnosRaw.map(a => ({
            hash_id: generarHash(a.id), // Usem el seu hash
            original_id: a.id,
            visual_identity: {
                iniciales: obtenerIniciales(a.nombre),
                ralc_suffix: `***${a.id.slice(-3)}`
            },
            has_file: false // Per defecte buit
        }));
        await db.collection('students').insertMany(docs);
    }

    app.listen(PORT, () => {
        console.log(`🚀 Server Mongo + Logic Company running on http://localhost:${PORT}`);
    });
}).catch(console.error);