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
// --- HELPER: NETEJA DE TEXT BÀSICA (Mogut aquí per velocitat) ---
const cleanText = (text) => {
    if (!text) return "";
    return text.replace(/[\r\v\f]/g, '\n').replace(/[ \t]+/g, ' ').trim();
};
const { generateSummaryLocal, checkConnection, parseSummaryToJSON } = require('./aiService'); // Importem el servei d'IA Local i el test

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
const localQueue = []; // Cua local de missatges RabbitMQ (global)

// --- SSE: REGISTRO DE CLIENTES ---
// Mapa para guardar conexiones SSE: { "filename.pdf": [res1, res2...] }
const sseClients = {};

// FUNCIÓN HELPER PARA BROADCAST (ENVIAR DATOS A FRONEND)
const broadcastProgress = (filename, data) => {
    if (!sseClients[filename]) return;

    // Formato SSE: "data: {JSON}\n\n"
    const payload = `data: ${JSON.stringify(data)}\n\n`;

    sseClients[filename].forEach(res => {
        try {
            res.write(payload);
        } catch (e) {
            console.error("❌ Error enviando SSE:", e.message);
        }
    });
};

// --- RUTA SSE (Endpoint) ---
app.get('/api/progress/:filename', (req, res) => {
    const { filename } = req.params;

    // Cabeceras obligatorias para SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Registramos al cliente
    if (!sseClients[filename]) sseClients[filename] = [];
    sseClients[filename].push(res);

    console.log(`🔌 SSE: Cliente conectado para ${filename}`);

    // Mensaje inicial para confirmar conexión
    res.write(`data: ${JSON.stringify({ status: "CONNECTED", progress: 0 })}\n\n`);

    // Limpieza si el cliente cierra la conexión
    req.on('close', () => {
        if (sseClients[filename]) {
            sseClients[filename] = sseClients[filename].filter(c => c !== res);
            if (sseClients[filename].length === 0) delete sseClients[filename];
        }
        console.log(`🔌 SSE: Cliente desconectado (${filename})`);
    });
});
let isProcessing = false;
let currentProcessingId = null;
let lastActivity = Date.now(); // Tracker d'inactivitat per a processos en segon pla

const trackActivity = () => {
    lastActivity = Date.now();
    // console.log("⏱️ Activitat detectada. Reset del comptador de 30 min."); // Silenciem logs
};

// --- BACKGROUND SYNC PROCESS (DESACTIVAT PER PETICIÓ DE L'USUARI) ---
// S'ha eliminat la lògica de comprovació cada 30 minuts per evitar conflictes
// i càrrega innecessària en equips amb pocs recursos.
/*
const IDLE_TIME = 30 * 60 * 1000; // 30 minuts
async function checkIdleAndSync() { ... }
setInterval(checkIdleAndSync, 10 * 60 * 1000);
*/

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
            console.log(`📡 [Worker] Comprovant cua... (Processing: ${isProcessing}, Items: ${localQueue.length})`);
            if (isProcessing || localQueue.length === 0) return;

            isProcessing = true;
            console.log(`🚀 [Worker] Iniciant processament d'ítem...`);
            const msg = localQueue.shift();

            let msgBody = null;
            let role = 'docent';
            let filename = '';
            let studentHash = '';
            let text = '';
            let arrayFilters = []; // Moved to outer scope to be available in catch

            try {
                // Movem el parsing DINS del try per si el missatge és invàlid
                msgBody = JSON.parse(msg.content.toString());
                text = msgBody.text;
                filename = msgBody.filename;
                role = msgBody.role;
                studentHash = msgBody.studentHash;

                // Identificador per a l'API d'estat
                currentProcessingId = filename || studentHash;

                console.log(`🐰 [Worker] Processant resum (${role || 'docent'}) per: ${currentProcessingId}`);

                const db = getDB();
                // let arrayFilters = []; // Removed (now global)

                // Determinem on guardar el resultat segons si és global o per fitxer
                let query = {};
                let updateFieldPrefix = "";

                if (role === 'global') {
                    query = { hash_id: studentHash };
                    updateFieldPrefix = "global_summary";
                } else {
                    // 1. PRIMER BUSQUEM L'ESTUDIANT
                    const student = await db.collection('students').findOne({
                        $or: [{ filename: filename }, { "files.filename": filename }]
                    });
                    if (!student) throw new Error(`Estudiant no trobat: ${filename}`);

                    // 2. Lògica robusta
                    const isFileInArray = student.files && student.files.some(f => f.filename === filename);

                    if (isFileInArray) {
                        query = { _id: student._id };
                        // NOU: Guardem per rol (ia_data.docent, ia_data.orientador)
                        updateFieldPrefix = `files.$[elem].ia_data.${role || 'docent'}`;
                    } else {
                        // Només si NO està a l'array (cas legacy o fitxer principal únic)
                        query = { _id: student._id };
                        updateFieldPrefix = `ia_data.${role || 'docent'}`;
                    }
                }

                if (updateFieldPrefix.includes('$[elem]')) arrayFilters = [{ "elem.filename": filename }];

                // 1. Actualitzem estat inicial a "LLEGINT..." IMMEDIATAMENT (Progrés 1%)
                let initUpdate = {};
                initUpdate[`${updateFieldPrefix}.estado`] = "LLEGINT...";
                initUpdate[`${updateFieldPrefix}.resumen`] = "";
                initUpdate[`${updateFieldPrefix}.progress`] = 1;

                console.log(`📡 [Worker] Notificant a la DB inici de lectura per: ${currentProcessingId} (Rol: ${role})`);
                await db.collection('students').updateOne(query, { $set: initUpdate }, { arrayFilters });

                // 2. Preparem text i cridem a la IA
                const cleanedText = cleanText(text);
                console.log(`🤖 [Worker] IA llegint document per: ${currentProcessingId}`);

                // NOU: Forcem actualització SSE immediata perquè la UI canviï a "Llegint" ja
                broadcastProgress(filename, {
                    status: "LLEGINT...",
                    progress: 1,
                    resumen: null,
                    role: role // NOU: enviem el rol
                });

                let lastUpdate = 0;
                let summary = "";

                try {
                    summary = await generateSummaryLocal(cleanedText, role, async (partialText, progress, isReading) => {

                        const now = Date.now();

                        // CALCULAMOS ESTADO Y PROGRESO VISUAL (Para SSE y DB)
                        let statusText = "LLEGINT...";
                        let visualProgress = 0;
                        let progressUpdate = {}; // Para la DB

                        if (isReading) {
                            statusText = "LLEGINT...";
                            visualProgress = Math.floor(progress); // Progrés REAL (0-100%)
                        } else {
                            statusText = "GENERANT...";
                            visualProgress = Math.floor(progress); // Progrés REAL (0-100%)
                        }

                        // BROADCAST SSE (EN TIEMPO REAL - CADA 0.5s o CADA TOKEN) 🚀
                        broadcastProgress(filename, {
                            status: statusText,
                            progress: visualProgress,
                            resumen: isReading ? null : partialText,
                            role: role // NOU: enviem el rol
                        });

                        // DB Writes: Menos frecuentes (1s o 5%) para no saturar
                        if (now - lastUpdate > 1000 || progress % 5 === 0 || progress === 100) {
                            lastUpdate = now;

                            progressUpdate[`${updateFieldPrefix}.estado`] = statusText;
                            progressUpdate[`${updateFieldPrefix}.progress`] = visualProgress;
                            if (!isReading) progressUpdate[`${updateFieldPrefix}.resumen`] = partialText;

                            try {
                                const dbUpdate = getDB();
                                await dbUpdate.collection('students').updateOne(query, { $set: progressUpdate }, { arrayFilters });
                            } catch (progErr) {
                                console.error("❌ [DB] Error GUARDANT PROGRÉS:", progErr);
                            }
                        }
                    });
                } catch (err) {
                    console.error(`❌ [Worker] Error fatal a la IA: ${err.message}`);
                    throw err;
                }

                // 3. Guardem resultat
                console.log(`📝 [Worker] Resum RAW rebut (Len: ${summary.length}):`, summary.substring(0, 200) + "...");

                // NOU: Guardem el text RAW directament (Mode Text Simple)
                // El frontend ja sap parsejar Markdown si no és JSON.

                let finalUpdate = {};
                finalUpdate[`${updateFieldPrefix}.estado`] = "COMPLETAT";
                finalUpdate[`${updateFieldPrefix}.resumen`] = summary; // Guardem text tal qual
                finalUpdate[`${updateFieldPrefix}.fecha`] = new Date();
                if (role !== 'global') finalUpdate[`${updateFieldPrefix}.filename`] = filename; // Guardem el fitxer origen

                await db.collection('students').updateOne(query, { $set: finalUpdate }, { arrayFilters });

                // BROADCAST FINAL SSE 🏁
                broadcastProgress(filename, {
                    status: "COMPLETAT",
                    progress: 100,
                    resumen: summary // Enviar text RAW
                });

                console.log(`✅ [Worker] Resum completat.`);
                // channel.ack(msg); // ELIMINAT: Ja hem fet l'ack al principi
                console.log(`🏁 [RabbitMQ] Tasca finalitzada.`);

            } catch (error) {
                console.error(`❌ [Worker] Error processant:`, error);

                try {
                    const db = getDB();
                    // Usem les variables que hem definit a dalt del worker
                    let queryErr = role === 'global' ? { hash_id: studentHash } : { $or: [{ filename: filename }, { "files.filename": filename }] };
                    let updateFieldPrefixErr = role === 'global' ? "global_summary" : "ia_data";

                    let errorUpdate = {};
                    errorUpdate[`${updateFieldPrefixErr}.estado`] = "ERROR";
                    errorUpdate[`${updateFieldPrefixErr}.resumen`] = error.message || "Error a la IA (Possible timeout o col·lapse)";

                    await db.collection('students').updateOne(queryErr, { $set: errorUpdate }, { arrayFilters });
                } catch (criticalErr) {
                    console.error("❌ [Worker] CRÍTIC: No s'ha pogut guardar l'error a la BD:", criticalErr.message);
                }
            } finally {
                isProcessing = false;
                currentProcessingId = null;
                setTimeout(processNext, 500); // Donem mig segon d'aire
            }
        };

        // Aquest codi s'executa quan RabbitMQ ens envia un missatge
        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                // 1. ACK IMMEDIAT per evitar desconnexions
                channel.ack(msg);

                try {
                    const data = JSON.parse(msg.content.toString());
                    // 2. PRIORITAT LIFO PER A MANUALS
                    // Si NO és automàtica (isAuto), la posem al davant
                    if (!data.isAuto) {
                        localQueue.unshift(msg);
                        console.log(`📥 [RabbitMQ] Feina MANUAL afegida al davant (Cua: ${localQueue.length})`);
                    } else {
                        localQueue.push(msg);
                        console.log(`📥 [RabbitMQ] Feina AUTOMÀTICA afegida al final (Cua: ${localQueue.length})`);
                    }
                } catch (e) {
                    localQueue.push(msg);
                }

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
        console.error("❌ Error a /api/students:", error);
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
        trackActivity();

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

        // 4. Actualitzar estat has_file i netejar IA si no queden fitxers
        // Tornem a buscar l'alumne actualitzat per veure si li queden fitxers
        const studentUpdated = await db.collection('students').findOne({ hash_id: hash });
        const hasFiles = (studentUpdated.files && studentUpdated.files.length > 0) || (!!studentUpdated.filename);

        let updateObj = { has_file: hasFiles };

        // Si no queden fitxers, netegem també les dades de la IA per seguretat
        if (!hasFiles) {
            updateObj.ia_data = {};
            updateObj.global_summary = {};
        } else if (studentUpdated.ia_data && studentUpdated.ia_data.filename === filename) {
            // Si hem esborrat el fitxer que tenia el resum actiu, netegem el resum
            updateObj.ia_data = {};
        }

        await db.collection('students').updateOne(
            { hash_id: hash },
            { $set: updateObj }
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

        console.log(`🔍 [API] Rebutja petició d'anàlisi per: ${filename}`);
        console.log(`   -> Buscant a path: ${filePath}`);

        // Comprovem si el fitxer existeix físicament
        if (!fs.existsSync(filePath)) {
            console.error("❌ Fitxer no trobat:", filePath);
            return res.status(404).json({ error: 'Fitxer no trobat al servidor' });
        }

        console.log(`   ✅ Fitxer existent. Llegint contingut...`);

        // Llegim i processem
        const dataBuffer = fs.readFileSync(filePath);
        let text = "";

        // Detectem tipus de fitxer
        if (filename.toLowerCase().endsWith('.odt')) {
            text = extractTextFromODT(dataBuffer);
        } else if (filename.toLowerCase().endsWith('.docx')) {
            const result = await mammoth.extractRawText({ buffer: dataBuffer });
            text = result.value;
        } else {
            text = await extractTextFromPDF(dataBuffer);
        }

        console.log(`   ✅ Text extret correctament (${text.length} chars). Enviant resposta.`);

        // Retornem el JSON
        res.json({ text_completo: text });

    } catch (error) {
        console.error("❌ Error analitzant PI:", error);
        res.status(500).json({ error: 'Error al processar el document' });
    }
});

// --- RUTA GENERACIÓ RESUM (IA) ---
app.post('/api/generate-summary', async (req, res) => {
    const { text, filename, role } = req.body;
    if (!text || !filename) return res.status(400).json({ error: 'Falta text o filename' });

    // REACTIVAT: Ara sí que depenem de RabbitMQ per protegir la IA
    if (!channel) return res.status(500).json({ error: 'RabbitMQ no connectat' });

    try {
        // 2. Actualitza estat inicial a la BD
        const db = getDB();
        const student = await db.collection('students').findOne({
            $or: [{ filename: filename }, { "files.filename": filename }]
        });

        let updatePath = "ia_data";
        let filters = [];

        // FIX: Prioritzem SEMPRE l'array si el fitxer hi és (igual que fa el Worker)
        const isFileInArray = student && student.files && student.files.some(f => f.filename === filename);

        if (isFileInArray) {
            updatePath = "files.$[elem].ia_data";
            filters = [{ "elem.filename": filename }];
        }

        let initData = {};
        initData[`${updatePath}.estado`] = "A LA CUA";
        initData[`${updatePath}.resumen`] = "";
        initData[`${updatePath}.progress`] = 0;
        initData[`${updatePath}.role`] = role || 'docent';

        await db.collection('students').updateOne(
            { $or: [{ filename: filename }, { "files.filename": filename }] },
            { $set: initData },
            { arrayFilters: filters }
        );

        // DEDUPLICACIÓ: Si ja hi ha feina d'aquest fitxer a la cua local, la traiem (Modifiquem in-place)
        const filteredQueue = localQueue.filter(m => {
            try {
                const d = JSON.parse(m.content.toString());
                return d.filename !== filename;
            } catch (e) { return true; }
        });
        localQueue.length = 0;
        localQueue.push(...filteredQueue);

        trackActivity(); // Registrem l'activitat per la prioritat de la cua

        // 1. Envia a la cua
        const jobData = { text, filename, role: role || 'docent' };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jobData)), { persistent: true });

        console.log(`📤 [API] Feina enviada a RabbitMQ: ${filename}`);
        res.json({ success: true, message: "Afegit a la cua de processament" });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Error enviant a la cua" });
    }
});

// --- RUTA GENERACIÓ RESUM GLOBAL (NOU) ---
app.post('/api/generate-global-summary', async (req, res) => {
    const { studentHash } = req.body;
    if (!studentHash) return res.status(400).json({ error: 'Falta studentHash' });
    if (!channel) return res.status(500).json({ error: 'RabbitMQ no connectat' });

    try {
        const db = getDB();
        const student = await db.collection('students').findOne({ hash_id: studentHash });
        if (!student) return res.status(404).json({ error: 'Estudiant no trobat' });

        // Recopilem tots els fitxers
        let filesToProcess = student.files || [];
        if (student.filename && !filesToProcess.some(f => f.filename === student.filename)) {
            filesToProcess.push({ filename: student.filename, originalName: 'Document Antic' });
        }

        if (filesToProcess.length === 0) return res.status(400).json({ error: 'No hi ha documents' });

        // Extraiem text de TOTS els fitxers
        let combinedText = `HISTORIAL DE DOCUMENTS DE L'ALUMNE:\n\n`;
        // Limitem la quantitat de text per document per no saturar la IA i que pugui llegir-los tots
        const CHARS_PER_DOC = 1500;

        for (const file of filesToProcess) {
            const filePath = path.join(UPLOADS_DIR, file.filename);
            if (fs.existsSync(filePath)) {
                const dataBuffer = fs.readFileSync(filePath);
                let text = "";
                if (file.filename.endsWith('.odt')) {
                    text = extractTextFromODT(dataBuffer);
                } else if (file.filename.endsWith('.docx')) {
                    const result = await mammoth.extractRawText({ buffer: dataBuffer });
                    text = result.value;
                } else {
                    text = await extractTextFromPDF(dataBuffer);
                }
                // Neteja bàsica ABANS de tallar per aprofitar millor l'espai
                text = cleanText(text);
                // Agafem només el principi de cada document (on sol haver-hi el diagnòstic i dades clau)
                let snippet = text.substring(0, CHARS_PER_DOC);
                combinedText += `--- DOCUMENT: ${file.originalName} ---\n${snippet}...\n\n`;
            }
        }

        // Enviem a la cua amb rol 'global'
        // DEDUPLICACIÓ: Si ja hi ha una feina per aquest fitxer/estudiant, la traiem per posar la nova (in-place)
        const filteredGlobal = localQueue.filter(m => {
            try {
                const data = JSON.parse(m.content.toString());
                const id = data.filename || data.studentHash;
                return id !== (filename || studentHash);
            } catch (e) { return true; }
        });
        localQueue.length = 0;
        localQueue.push(...filteredGlobal);

        const jobData = { text: combinedText, studentHash, role: 'global' };
        channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(jobData)), { persistent: true });

        trackActivity(); // Registrem activitat

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
        trackActivity(); // Registrem activitat (l'usuari està fent servir el sistema)
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
    const msgInterrupcio = "El procés es va interrompre pel reinici del servidor. Torna a generar-lo.";

    // 1. Netejem ia_data top-level
    await db.collection('students').updateMany(
        { "ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } },
        { $set: { "ia_data.estado": "INTERROMPUT", "ia_data.resumen": msgInterrupcio } }
    );

    // 2. Netejem ia_data dins de files array
    // Usem updateMany amb arrayFilters wildcard o simplement buscant documents amb files pendents
    // Com que updateMany amb $[elem] pot ser complex per tots, fem un loop ràpid que és més segur
    // O millor, una query directa amb dot notation que funcioni:
    await db.collection('students').updateMany(
        { "files.ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } },
        { $set: { "files.$[elem].ia_data.estado": "INTERROMPUT", "files.$[elem].ia_data.resumen": msgInterrupcio } },
        { arrayFilters: [{ "elem.ia_data.estado": { $in: ["GENERANT...", "A LA CUA", "LLEGINT..."] } }] }
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

    app.listen(PORT, async () => {
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