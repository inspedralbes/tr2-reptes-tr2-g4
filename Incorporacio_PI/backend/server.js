require('dotenv').config()
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto'); // Del teu company
const amqp = require('amqplib'); // CLIENT RABBITMQ
const AdmZip = require('adm-zip'); // PER LLEGIR ODT
const mammoth = require('mammoth'); // PER LLEGIR DOCX
const { connectDB, getDB } = require('./db'); // La teva DB
const { extractTextFromPDF } = require('./fileReader'); // Corregit: Coincideix amb fileReader.js
const { generateSummaryLocal, checkConnection, chatWithDocument } = require('./aiService'); // Importem el servei d'IA Local i el test

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

// --- HELPER: LLEGIR ODT ---
function extractTextFromODT(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        // Neteja bàsica de XML: Reemplaça etiquetes de paràgraf per salts de línia i esborra la resta
        return contentXml
            .replace(/<text:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .trim();
    } catch (e) {
        console.error("Error llegint ODT:", e);
        return "";
    }
}

// --- CONFIGURACIÓ RABBITMQ ---
const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const QUEUE_NAME = 'summary_jobs';
let channel = null;

// VARIABLES GLOBALS PER A LA CUA (Per poder consultar l'estat des de l'API)
const localQueue = [];
let isProcessing = false;
let currentProcessingId = null;

async function connectRabbit() {
    try {
        const conn = await amqp.connect(RABBIT_URL);

        // NOU: Gestió d'errors de connexió per evitar que el servidor caigui si RabbitMQ es reinicia
        conn.on('error', (err) => {
            console.error("❌ [RabbitMQ] Error de connexió:", err.message);
        });
        conn.on('close', () => {
            console.warn("⚠️ [RabbitMQ] Connexió tancada. Reintentant en 5s...");
            channel = null; // Marquem el canal com a no disponible
            setTimeout(connectRabbit, 5000);
        });

        channel = await conn.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1); // IMPORTANT: Processar d'un en un per no saturar la IA
        console.log("🐰 Connectat a RabbitMQ. Cua:", QUEUE_NAME);

        // --- CONSUMER (WORKER) ---
        // (localQueue i isProcessing ara són globals)

        const processNext = async () => {
            if (isProcessing || localQueue.length === 0) return;

            isProcessing = true;
            const msg = localQueue.shift();

            // Define variables outside try/catch scope
            let text, filename, role, studentHash;

            try {
                // Movem el parsing DINS del try per si el missatge és invàlid
                const content = JSON.parse(msg.content.toString());
                ({ text, filename, role, studentHash } = content);

                // Identificador per a l'API d'estat
                currentProcessingId = filename || studentHash;

                console.log(`🐰 [Worker] Processant resum (${role || 'docent'}) per: ${currentProcessingId}`);

                const db = getDB();

                // Determinem on guardar el resultat segons si és global o per fitxer
                let query = {};
                let updateFieldPrefix = "";

                if (role === 'global') {
                    query = { hash_id: studentHash };
                    updateFieldPrefix = "global_summary";
                } else {
                    // CORRECCIÓ CRÍTICA: Busquem el fitxer tant al camp root com a l'array 'files'
                    query = { $or: [{ filename: filename }, { "files.filename": filename }] };
                    updateFieldPrefix = "ia_data";
                }

                // 1. Actualitzem estat a "LLEGINT..."
                let initUpdate = {};
                initUpdate[`${updateFieldPrefix}.estado`] = "LLEGINT...";
                initUpdate[`${updateFieldPrefix}.resumen`] = "";
                initUpdate[`${updateFieldPrefix}.progress`] = 0;
                initUpdate[`${updateFieldPrefix}.role`] = role || 'docent'; // Always set role

                await db.collection('students').updateOne(query, { $set: initUpdate });

                // 2. Cridem a la IA (Això triga minuts)
                console.log(`⏳ [Worker] Iniciant generació IA (${role})...`);

                let lastUpdate = 0;
                const summary = await generateSummaryLocal(text, role, async (partialText, progress) => {
                    const now = Date.now();
                    if (now - lastUpdate > 1000) {
                        lastUpdate = now;
                        const estatActual = partialText.length > 0 ? "GENERANT..." : "LLEGINT...";

                        let progressUpdate = {};
                        progressUpdate[`${updateFieldPrefix}.estado`] = estatActual;
                        progressUpdate[`${updateFieldPrefix}.progress`] = progress;
                        progressUpdate[`${updateFieldPrefix}.resumen`] = partialText;

                        // PROTECCIÓ: Si falla l'actualització de progrés (micro-tall BD), NO parem la generació
                        try {
                            await db.collection('students').updateOne(query, { $set: progressUpdate });
                            console.log(`🐰 [Worker] Progrés: ${progress}% (${estatActual})`);
                        } catch (progErr) {
                            console.warn(`⚠️ [Worker] Error puntual actualitzant progrés (ignorat): ${progErr.message}`);
                        }
                    }
                });

                // 3. Guardem resultat
                let finalUpdate = {};
                finalUpdate[`${updateFieldPrefix}.estado`] = "COMPLETAT";
                finalUpdate[`${updateFieldPrefix}.resumen`] = summary;
                finalUpdate[`${updateFieldPrefix}.fecha`] = new Date();

                await db.collection('students').updateOne(query, { $set: finalUpdate });

                console.log(`✅ [Worker] Resum completat.`);
                // channel.ack(msg); // ELIMINAT: Ja hem fet l'ack al principi
                console.log(`🏁 [RabbitMQ] Tasca finalitzada.`);

            } catch (error) {
                console.error(`❌ [Worker] Error processant:`, error);

                // PROTECCIÓ CRÍTICA: Si no podem guardar l'error a la BD, no fem petar el servidor
                try {
                    const db = getDB();
                    // Fallback query if variables are undefined (e.g. JSON parse error)
                    let query = {};
                    let updateFieldPrefix = "ia_data";

                    if (role === 'global' && studentHash) {
                        query = { hash_id: studentHash };
                        updateFieldPrefix = "global_summary";
                    } else if (filename) {
                        query = { filename: filename };
                    } else {
                        // If we can't identify the student/file, we can't save the error to their record
                        console.error("❌ [Worker] Cannot save error to DB: Missing filename/studentHash");
                        return;
                    }

                    let errorUpdate = {};
                    errorUpdate[`${updateFieldPrefix}.estado`] = "ERROR";
                    errorUpdate[`${updateFieldPrefix}.resumen`] = error.message || "Error desconegut";

                    await db.collection('students').updateOne(query, { $set: errorUpdate });
                } catch (criticalErr) {
                    console.error("❌ [Worker] CRÍTIC: No s'ha pogut guardar l'error a la BD (Servidor protegit del crash):", criticalErr.message);
                }
            } finally {
                isProcessing = false;
                currentProcessingId = null; // Reset quan acaba
                // Usem setTimeout per deixar respirar el servidor i evitar stack overflow
                setTimeout(processNext, 100);
            }
        };

        // Aquest codi s'executa quan RabbitMQ ens envia un missatge
        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                // 1. ACK IMMEDIAT: Diem a RabbitMQ que ja tenim el missatge.
                // Això evita que talli la connexió si triguem 1 hora.
                channel.ack(msg);

                // 2. Afegim a la cua local i processem
                localQueue.push(msg);
                processNext();
            }
        });

    } catch (error) {
        console.error("❌ Error connectant RabbitMQ (Reintentant en 5s...)", error.message);
        setTimeout(connectRabbit, 5000);
    }
}

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
        // Acceptem PDF i ODT (OpenDocument Text)
        if (file.mimetype === 'application/pdf' ||
            file.mimetype === 'application/vnd.oasis.opendocument.text' ||
            file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // DOCX
            file.originalname.endsWith('.odt')) {
            cb(null, true);
        } else {
            cb(null, false); // Rebutja altres fitxers
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

// --- HELPER: LLEGIR DOCS (Refactoritzat per reutilitzar) ---
async function extractTextFromFile(filePath) {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const filename = path.basename(filePath).toLowerCase();

    if (filename.endsWith('.odt')) {
        return extractTextFromODT(buffer);
    } else if (filename.endsWith('.docx')) {
        const result = await mammoth.extractRawText({ buffer: buffer });
        return result.value;
    } else {
        return await extractTextFromPDF(buffer);
    }
}

// --- HELPER: ENCUAR TASCA (Refactoritzat) ---
async function enqueueSummaryJob(text, filename, role, studentHash) {
    if (!channel) throw new Error("RabbitMQ no connectat");

    // 1. Enviar a RabbitMQ
    const jobData = { text, filename, role: role || 'docent', studentHash };
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jobData)), { persistent: true });

    // 2. Actualitzar MongoDB
    const db = getDB();
    const query = studentHash
        ? { hash_id: studentHash }
        : { $or: [{ filename: filename }, { "files.filename": filename }] };

    let updateFieldPrefix = "ia_data";
    // Si és un resum global, guardem a un lloc diferent
    if (role === 'global') updateFieldPrefix = "global_summary";

    let updateSet = {};
    updateSet[`${updateFieldPrefix}.estado`] = "A LA CUA";
    updateSet[`${updateFieldPrefix}.resumen`] = "";
    updateSet[`${updateFieldPrefix}.progress`] = 0;
    updateSet[`${updateFieldPrefix}.role`] = role || 'docent';

    await db.collection('students').updateOne(query, { $set: updateSet });

    console.log(`📤 [Cua] Tasca afegida: ${filename || studentHash} (${role})`);
    return true;
}

// POST: Puja fitxer i actualitza Mongo + AUTO-GENERA RESUM
app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    const { studentHash, userEmail } = req.body;
    if (!req.file || !studentHash) return res.status(400).json({ success: false, message: 'Falten dades' });

    try {
        const db = getDB();

        // 1. Preparem dades del fitxer
        const fileData = {
            filename: req.file.filename,
            originalName: req.file.originalname,
            mimetype: req.file.mimetype,
            size: req.file.size,
            uploadDate: new Date()
        };

        // 2. Estat inicial IA
        const iaData = {
            estado: "A LA CUA", // Canviat de "PROCESSAT" a "A LA CUA"
            resumen: "",
            progress: 0,
            role: 'docent' // Per defecte
        };

        // 3. Actualitzem la BD (Guardem fitxer i estat)
        await db.collection('students').updateOne(
            { hash_id: studentHash },
            {
                $set: {
                    has_file: true,
                    filename: req.file.filename,
                    ia_data: iaData
                },
                $push: { files: fileData }
            }
        );

        // 4. AUTO-START: Extraiem text i enviem a la cua directament!
        const filePath = path.join(UPLOADS_DIR, req.file.filename);
        const text = await extractTextFromFile(filePath);

        if (text && text.length > 50) {
            // Enviem a la cua automàticament
            await enqueueSummaryJob(text, req.file.filename, 'docent', studentHash);
            console.log(`🚀 [Auto-Start] Resum iniciat automàticament per ${req.file.filename}`);
        } else {
            console.warn(`⚠️ [Auto-Start] No s'ha pogut extreure text o és buit: ${req.file.filename}`);
        }

        // 5. Registrem l'accés
        const alumne = await db.collection('students').findOne({ hash_id: studentHash });
        const ralcSuffix = alumne ? alumne.visual_identity.ralc_suffix : '???';
        await registrarAcces(userEmail || 'sistema', 'Pujada de document PI', ralcSuffix);

        res.json({ success: true, message: "Fitxer pujat i processament iniciat" });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// DELETE: Eliminar fitxer
app.delete('/api/students/:hash/files/:filename', async (req, res) => {
    const { hash, filename } = req.params;
    const { userEmail } = req.body;

    try {
        const db = getDB();
        const studentInfo = await db.collection('students').findOne({ hash_id: hash });
        const ralcSuffix = studentInfo ? studentInfo.visual_identity.ralc_suffix : '???';

        await db.collection('students').updateOne(
            { hash_id: hash },
            { $pull: { files: { filename: filename } } }
        );

        await db.collection('students').updateOne(
            { hash_id: hash, filename: filename },
            { $unset: { filename: "" } }
        );

        const studentUpdated = await db.collection('students').findOne({ hash_id: hash });
        const hasFiles = (studentUpdated.files && studentUpdated.files.length > 0) || (!!studentUpdated.filename);

        await db.collection('students').updateOne(
            { hash_id: hash },
            { $set: { has_file: hasFiles } }
        );

        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

        await registrarAcces(userEmail || 'Desconegut', 'Eliminació de document', ralcSuffix);

        res.json({ success: true });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false });
    }
});

// --- RUTA D'ANÀLISI IA (Helper Wrapper) ---
app.get('/api/analyze/:filename', async (req, res) => {
    try {
        const filename = decodeURIComponent(req.params.filename);
        const filePath = path.join(UPLOADS_DIR, filename);
        const text = await extractTextFromFile(filePath);

        if (text === null) return res.status(404).json({ error: 'Fitxer no trobat' });
        res.json({ text_completo: text });

    } catch (error) {
        console.error("Error analitzant PI:", error);
        res.status(500).json({ error: 'Error al processar el document' });
    }
});

// --- RUTA GENERACIÓ RESUM (IA) ---
app.post('/api/generate-summary', async (req, res) => {
    const { text, filename, role } = req.body;
    if (!text || !filename) return res.status(400).json({ error: 'Falta text o filename' });

    try {
        await enqueueSummaryJob(text, filename, role, null); // Passem null com a hash si no el tenim, farem cerca per filename
        res.json({ success: true, message: "Afegit a la cua de processament" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error enviant a la cua" });
    }
});

// --- RUTA GENERACIÓ RESUM GLOBAL ---
app.post('/api/generate-global-summary', async (req, res) => {
    const { studentHash } = req.body;
    if (!studentHash) return res.status(400).json({ error: 'Falta studentHash' });
    if (!channel) return res.status(500).json({ error: 'RabbitMQ no connectat' });

    try {
        const db = getDB();
        const student = await db.collection('students').findOne({ hash_id: studentHash });
        if (!student) return res.status(404).json({ error: 'Estudiant no trobat' });

        let filesToProcess = student.files || [];
        if (student.filename && !filesToProcess.some(f => f.filename === student.filename)) {
            filesToProcess.push({ filename: student.filename, originalName: 'Document Antic' });
        }

        if (filesToProcess.length === 0) return res.status(400).json({ error: 'No hi ha documents' });

        let combinedText = `HISTORIAL DE DOCUMENTS DE L'ALUMNE:\n\n`;
        const CHARS_PER_DOC = 2000;

        for (const file of filesToProcess) {
            const filePath = path.join(UPLOADS_DIR, file.filename);
            const text = await extractTextFromFile(filePath);
            if (text) {
                let snippet = text.substring(0, CHARS_PER_DOC);
                combinedText += `--- DOCUMENT: ${file.originalName} ---\n${snippet}...\n\n`;
            }
        }

        const jobData = { text: combinedText, studentHash, role: 'global' };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jobData)), { persistent: true });

        // Actualitzem estat
        await db.collection('students').updateOne(
            { hash_id: studentHash },
            { $set: { "global_summary.estado": "A LA CUA", "global_summary.progress": 0 } }
        );

        res.json({ success: true, message: "Generació global iniciada" });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error iniciant resum global" });
    }
});

// --- RUTA CHAT RÀPID (NOU) ---
app.post('/api/chat', async (req, res) => {
    const { text, question } = req.body;
    if (!text || !question) return res.status(400).json({ error: 'Falta text o pregunta' });

    try {
        const answer = await chatWithDocument(text, question);
        res.json({ answer });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error al xat" });
    }
});

// --- RUTA ESTAT DE LA CUA (NOU) ---
app.get('/api/queue-status', (req, res) => {
    // Retornem la llista d'IDs que estan esperant
    const queueList = localQueue.map(m => {
        const c = JSON.parse(m.content.toString());
        return c.filename || c.studentHash;
    });
    res.json({ queue: queueList, current: currentProcessingId });
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

    // NOU: Neteja d'estats "zombies" en arrencar el servidor
    console.log("🧹 Netejant tasques interrompudes a la BD...");
    await db.collection('students').updateMany(
        { "ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } },
        { $set: { "ia_data.estado": "INTERROMPUT", "ia_data.resumen": "El procés es va interrompre pel reinici del servidor. Torna a generar-lo." } }
    );

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
        connectRabbit(); // Iniciem RabbitMQ en arrencar
        checkConnection(); // NOU: Testeig de connexió amb la IA a l'inici
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