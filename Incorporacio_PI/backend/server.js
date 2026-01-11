require('dotenv').config()
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Del teu company
const { connectDB, getDB } = require('./db'); // La teva DB
const { extractTextFromPDF } = require('./FileReader'); // Corregit: Majúscules per coincidir amb el fitxer
const { generateSummaryStream } = require('./aiService'); // Importem el servei d'IA

const app = express();
const PORT = 3001;

// MIDDLEWARES
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir fitxers

// --- HELPER FUNCTIONS (Del teu company) ---
const generarHash = (id) => crypto.createHash('sha256').update(id).digest('hex');
// Funció millorada per obtenir inicials
const obtenerIniciales = (nombre) => {
    if (!nombre) return '';
    return nombre
        .trim()                // 1. Elimina espais al principi i al final ("enrique " -> "enrique")
        .split(/\s+/)          // 2. Divideix per espais, ignorant si n'hi ha més d'un seguit
        .map(n => n[0].toUpperCase()) // 3. Agafa la primera lletra i la fa Majúscula
        .join('.') + '.';      // 4. Uneix amb punts i afegeix el punt final
};

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

// Filtre per acceptar NOMÉS PDF
const upload = multer({ 
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(null, false); // Rebutja el fitxer si no és PDF
        }
    }
});

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
            return res.status(401).json({ success: false, message: 'Email no trobat' });
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

// --- server.js (Afegeix això al bloc de rutes d'estudiants) ---

// POST: Crear nou alumne manualment (Necessari per al botó "Nuevo Alumno")
app.post('/api/students', async (req, res) => {
    const { nombre, id } = req.body;

    // 1. Validació bàsica
    if (!nombre || !id) {
        return res.status(400).json({ error: "Falten dades (nom o id)" });
    }

    try {
        const db = getDB();

        // 2. Generar dades calculades abans de guardar
        // Necessitem el hash ara per comprovar duplicats, ja que no guardarem l'ID original
        const hash = generarHash(id);
        const iniciales = obtenerIniciales(nombre);

        // 3. Comprovar que no existeixi ja aquest alumne (busquem pel HASH, no per l'ID original)
        const existing = await db.collection('students').findOne({ hash_id: hash });
        if (existing) {
            return res.status(409).json({ error: "Aquest alumne ja existeix (ID duplicat)" });
        }
        
        // 4. Construir l'objecte (SENSE original_id ni original_name)
        const newStudent = {
            hash_id: hash,
            // original_id: id,       <-- ELIMINAT PER PRIVACITAT
            // original_name: nombre, <-- ELIMINAT PER PRIVACITAT
            visual_identity: {
                iniciales: iniciales,
                ralc_suffix: `***${id.slice(-3)}`
            },
            has_file: false,
            files: [],
            ia_data: {},
            createdAt: new Date()
        };

        // 5. Insertar a Mongo
        await db.collection('students').insertOne(newStudent);
        
        // Al log de consola sí podem mostrar el nom per debugging, però a la BD no hi va
        console.log(`✨ Nou alumne creat: ${iniciales} (Hash: ${hash.substring(0, 10)}...)`);
        
        res.json({ success: true, student: newStudent });

    } catch (error) {
        console.error("Error creant alumne:", error);
        res.status(500).json({ error: 'Error al servidor' });
    }
});

// POST: Puja fitxer i actualitza Mongo
app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    // Fusionem la lògica de les dues rutes duplicades
    const { studentHash, userEmail } = req.body;
    if (!req.file || !studentHash) return res.status(400).json({ success: false, message: 'Falten dades o el fitxer no és un PDF' });

    try {
        const db = getDB();
        // Simulem IA
        const iaData = {
            estado: "PROCESSAT",
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

        // Busquem l'alumne per tenir el seu RALC sufix per al log
        const alumne = await db.collection('students').findOne({ hash_id: studentHash });
        const ralcSuffix = alumne ? alumne.visual_identity.ralc_suffix : '???';

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

        // Registrem l'accés (#29)
        await registrarAcces(userEmail || 'sistema', 'Pujada de document PI', ralcSuffix);

        console.log(`📄 LOG: Nou PDF registrat a MongoDB per l'alumne ${ralcSuffix}`);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// DELETE: Eliminar fitxer específic d'un estudiant
app.delete('/api/students/:hash/files/:filename', async (req, res) => {
    const { hash, filename } = req.params;
    // REBEM L'EMAIL DE L'USUARI QUE ESTÀ ESBORRANT
    const { userEmail } = req.body; 

    try {
        const db = getDB();
        
        // 1. Busquem l'alumne PRIMER per tenir el RALC per al log
        const studentInfo = await db.collection('students').findOne({ hash_id: hash });
        const ralcSuffix = studentInfo ? studentInfo.visual_identity.ralc_suffix : '???';

        // 2. Eliminar del array de archivos en Mongo
        const resArray = await db.collection('students').updateOne(
            { hash_id: hash },
            { $pull: { files: { filename: filename } } }
        );
        console.log(`🗑️ DELETE: Eliminado de array 'files': ${resArray.modifiedCount} docs`);

        // 3. Si es el archivo "legacy", lo borramos también
        await db.collection('students').updateOne(
            { hash_id: hash, filename: filename },
            { $unset: { filename: "" } }
        );

        // 4. Actualitzar estat has_file
        // Tornem a buscar l'alumne actualitzat per veure si li queden fitxers
        const studentUpdated = await db.collection('students').findOne({ hash_id: hash });
        const hasFiles = (studentUpdated.files && studentUpdated.files.length > 0) || (!!studentUpdated.filename);
        
        await db.collection('students').updateOne(
            { hash_id: hash },
            { $set: { has_file: hasFiles } }
        );

        // 5. Eliminar archivo físico del servidor
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        // --- NOU: REGISTREM AL LOG ---
        await registrarAcces(userEmail || 'Desconegut', 'Eliminació de document', ralcSuffix);
        console.log(`📄 LOG: Document eliminat per ${userEmail} (Alumne: ${ralcSuffix})`);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// --- RUTA D'ANÀLISI IA (Bloc B) ---
app.get('/api/analyze/:filename', async (req, res) => {
    try {
        // Decodifiquem el nom del fitxer per si té espais o accents
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(UPLOADS_DIR, filename);

        // Comprovem si el fitxer existeix físicament
        if (!fs.existsSync(filePath)) {
            console.error("Fitxer no trobat:", filePath);
            return res.status(404).json({ error: 'Fitxer no trobat al servidor' });
        }

        // Llegim i processem
        const dataBuffer = fs.readFileSync(filePath);
        const text = await extractTextFromPDF(dataBuffer);

        // Retornem el JSON
        res.json({ text_completo: text });

    } catch (error) {
        console.error("Error analitzant PI:", error);
        res.status(500).json({ error: 'Error al processar el document' });
    }
});

// --- RUTA GENERACIÓ RESUM (IA) ---
app.post('/api/generate-summary', async (req, res) => {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'Falta el text' });

    // Configurem capçaleres per a Streaming
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');

    // Cridem al servei que escriurà directament a 'res'
    await generateSummaryStream(text, res);
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
    
    // Si la BD està buida, la omplim amb les dades del company
    if (count === 0) {
        console.log("🌱 Seed: Inserint dades del company a MongoDB...");
        const docs = dbAlumnosRaw.map(a => ({
            hash_id: generarHash(a.id), 
            // original_id: a.id,       <-- ELIMINAT: No el guardem a la BD
            // original_name: a.nombre, <-- ELIMINAT: No el guardem a la BD
            visual_identity: {
                iniciales: obtenerIniciales(a.nombre),
                ralc_suffix: `***${a.id.slice(-3)}`
            },
            has_file: false
        }));
        await db.collection('students').insertMany(docs);
    }

    app.listen(PORT, () => {
        console.log(`🚀 Server Mongo + Logic Company running on http://localhost:${PORT}`);
    });
}).catch(console.error);

// --- 5. LÒGICA DE LOGS (Tasques #28 i #29) ---

/**
 * Funció per registrar accions a la col·lecció "access_logs" (#28)
 */
async function registrarAcces(email, accio, ralcSuffix = 'N/A') {
    try {
        const db = getDB();
        await db.collection('access_logs').insertOne({
            usuari: email,
            accio: accio,
            ralc_alumne: ralcSuffix, // Guardem només el sufix per privacitat (#29)
            timestamp: new Date()
        });
    } catch (e) {
        console.error("Error guardant log:", e);
    }
}

// RUTA NOVA: Obtenir logs per a la pantalla de revisió (#30)
app.get('/api/logs', async (req, res) => {
    try {
        const db = getDB();
        const logs = await db.collection('access_logs')
            .find()
            .sort({ timestamp: -1 }) // El més recent primer
            .limit(50)
            .toArray();
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: 'Error al recuperar logs' });
    }
});