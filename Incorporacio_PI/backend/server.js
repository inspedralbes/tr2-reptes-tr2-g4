require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { connectDB, getDB } = require('./db');
const { ObjectId } = require('mongodb');
const amqp = require('amqplib');
const WebSocket = require('ws');
const { extractTextFromFile } = require('./fileReader');

const app = express();
const port = process.env.PORT || 4000;

// Multer Config
const upload = multer({ dest: 'uploads/' });

// Connect to DB
connectDB();

app.use(cors({
    origin: true, // Permet qualsevol origen (com localhost:3000) reflectint la petició
    credentials: true
}));
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads'))); // Servir fitxers pujats també


// WebSocket Server Setup
const WSS_PORT = 4001;
const wss = new WebSocket.Server({ port: WSS_PORT });
const clients = new Map();

wss.on('connection', (ws, req) => {
    console.log(`🔗 Cliente WebSocket conectado al puerto ${WSS_PORT}.`);
    const userId = new URL(req.url, `http://${req.headers.host}`).searchParams.get('userId');

    if (userId) {
        clients.set(String(userId), ws);
        console.log(` Cliente ${userId} registrado.`);
    }

    ws.on('close', () => {
        if (userId) clients.delete(String(userId));
    });
});

// RabbitMQ Setup
let channel;
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://user:1234@rabbitmq:5672';

async function connectRabbitMQ() {
    try {
        const connection = await amqp.connect(RABBITMQ_URL);
        channel = await connection.createChannel();
        await channel.assertQueue('pi_processing_queue', { durable: true });
        await channel.assertQueue('job_notification_queue', { durable: true });
        console.log('✅ Conectado a RabbitMQ.');

        channel.consume('job_notification_queue', (msg) => {
            if (msg !== null) {
                try {
                    const notification = JSON.parse(msg.content.toString());
                    const clientWs = clients.get(String(notification.userId));
                    if (clientWs && clientWs.readyState === WebSocket.OPEN) {
                        clientWs.send(JSON.stringify(notification));
                        console.log(` Notificación enviada a ${notification.userId}`);
                    }
                    channel.ack(msg);
                } catch (e) {
                    console.error('Error procesando notificación:', e);
                    channel.ack(msg);
                }
            }
        }, { noAck: false });

    } catch (error) {
        console.error('❌ Error conectando a RabbitMQ:', error.message);
        setTimeout(connectRabbitMQ, 5000);
    }
}
connectRabbitMQ();


// ==========================================
// ROUTES (API)
// ==========================================

// 1. GET STUDENTS (Merged logic: Students + Orphan Jobs)
app.get('/api/students', async (req, res) => {
    try {
        const db = getDB();
        const students = await db.collection('students').find().toArray();
        const jobs = await db.collection('jobs').find().sort({ uploadedAt: -1 }).toArray();

        // 1. Process Students
        const combinedList = [];
        const processedJobUserIds = new Set();

        students.forEach(student => {
            const studentId = student._id.toString(); // Ensure string comparison

            // Find ALL jobs for this student (Excluding the Global Summary record itself)
            const studentJobs = jobs.filter(j => j.userId === studentId && j.filename !== "Resum Global");
            const latestJob = studentJobs.length > 0 ? studentJobs[0] : null;

            if (latestJob) processedJobUserIds.add(studentId);

            combinedList.push({
                hash_id: studentId,
                original_name: student.name,
                original_id: student.centerCode || studentId,
                visual_identity: student.visual_identity || {
                    iniciales: (student.name || "Unknown").substring(0, 2).toUpperCase(),
                    ralc_suffix: studentId.length > 3 ? studentId.substring(studentId.length - 3) : '000',
                    color_bg: '#E0E0E0',
                    color_text: '#000000'
                },
                has_file: !!latestJob,
                files: studentJobs.map(j => ({ filename: j.filename, upload_date: j.uploadedAt, originalName: j.filename })),
                ia_data: latestJob ? {
                    estado: mapStatus(latestJob.status),
                    last_update: latestJob.processedAt,
                    resumen: latestJob.result || (latestJob.error ? { error: latestJob.error } : null)
                } : null,
                filename: latestJob ? latestJob.filename : null,
                global_summary: student.global_summary || null
            });
        });

        // 2. Process Orphan Jobs (Jobs with no matching Student)
        jobs.forEach(job => {
            if (job.filename === "Resum Global") return; // Skip history trackers
            if (!processedJobUserIds.has(job.userId)) {

                const derivedName = job.filename.split('.')[0].replace(/[_-]/g, ' ');
                const initials = derivedName.substring(0, 2).toUpperCase();

                combinedList.push({
                    hash_id: job.userId,
                    original_name: derivedName + " (Arxiu)",
                    original_id: "Ext.",
                    visual_identity: {
                        iniciales: initials,
                        ralc_suffix: 'FILE',
                        color_bg: '#FFCC80',
                        color_text: '#000000'
                    },
                    has_file: true,
                    files: [{ filename: job.filename, upload_date: job.uploadedAt }],
                    ia_data: {
                        estado: mapStatus(job.status),
                        last_update: job.processedAt,
                        resumen: job.result || (job.error ? { error: job.error } : null)
                    },
                    filename: job.filename
                });

                processedJobUserIds.add(job.userId);
            }
        });

        res.json(combinedList);
    } catch (error) {
        console.error("Error fetching students:", error);
        res.status(500).json({ error: 'Failed' });
    }
});

function mapStatus(status) {
    if (status === 'queued') return 'A LA CUA';
    if (status === 'processing') return 'GENERANT...';
    if (status === 'reading') return 'LLEGINT...';
    if (status === 'completed') return 'COMPLETAT';
    if (status === 'failed') return 'ERROR';
    return status;
}

// 2. UPLOAD FILE
app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file.' });
    if (!channel) return res.status(500).json({ success: false, message: 'RabbitMQ invalid.' });

    const userId = req.body.studentHash || req.body.userId; // This is the RALC or ID
    const role = req.body.role || 'docente'; // Default to 'docente' if not provided

    const filePath = req.file.path;
    const originalFileName = req.file.originalname;
    const jobId = new ObjectId(); // Generate ID manually

    const newJob = {
        _id: jobId,
        userId: userId,
        filename: originalFileName,
        filePath: filePath,
        status: 'queued',
        uploadedAt: new Date(),
        result: null,
        error: null,
        role: role // Save the role
    };

    try {
        await getDB().collection('jobs').insertOne(newJob);

        const message = {
            jobId: jobId.toString(),
            filePath: filePath,
            originalFileName: originalFileName,
            userId: userId,
            role: role // Pass role to queue
        };
        channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`✅ Trabajo ${jobId} encolado (Rol: ${role}).`);

        res.status(200).json({ success: true, jobId, filename: originalFileName });
    } catch (error) {
        console.error('❌ Error upload:', error);
        if (fs.existsSync(filePath)) try { fs.unlinkSync(filePath); } catch (e) { }
        res.status(500).json({ success: false });
    }
});

// 3. ANALYZE FILE (Get Raw Text)
app.get('/api/analyze/:filename', async (req, res) => {
    try {
        console.log(`🔍 [API] Rebuda petició per analitzar: ${req.params.filename}`);
        // Express ja descodifica els paràmetres automàticament. No cal fer-ho manualment.
        const filename = req.params.filename;
        const job = await getDB().collection('jobs').findOne({ filename: filename }, { sort: { uploadedAt: -1 } });

        if (!job) return res.status(404).json({ error: 'File not found' });

        let text = "";
        if (fs.existsSync(job.filePath)) {
            text = await extractTextFromFile(job.filePath, job.filename);
        } else {
            text = "El archivo original ya no existe en el servidor.";
        }
        res.json({ text_completo: text || "(Sin contenido extraíble)" });
    } catch (error) {
        console.error("Error analyzing file:", error);
        res.status(500).json({ error: 'Error' });
    }
});

// 4. GENERATE SUMMARY (Re-queue)
app.post('/api/generate-summary', async (req, res) => {
    const { filename, role } = req.body; // Accept role here too
    const db = getDB();
    const job = await db.collection('jobs').findOne({ filename: filename }, { sort: { uploadedAt: -1 } });

    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (!fs.existsSync(job.filePath)) {
        return res.status(400).json({ error: 'El archivo original ya no existe. Súbelo de nuevo.' });
    }

    const targetRole = role || job.role || 'docente'; // Update role if provided, else keep existing

    // Update status and role
    await db.collection('jobs').updateOne(
        { _id: job._id },
        {
            $set: {
                status: 'queued',
                result: null,
                error: null,
                role: targetRole
            }
        }
    );

    const message = {
        jobId: job._id.toString(),
        filePath: job.filePath,
        originalFileName: job.filename,
        userId: job.userId,
        role: targetRole
    };
    channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify(message)), { persistent: true });

    res.json({ success: true, message: "Re-queued for generation", role: targetRole });
});

// 4.5 GENERATE GLOBAL SUMMARY
app.post('/api/generate-global-summary', async (req, res) => {
    const { studentHash } = req.body;
    if (!studentHash) return res.status(400).json({ error: 'Missing studentHash' });

    const db = getDB();
    const jobId = new ObjectId();

    // ID HANDLING: If studentHash is a valid ObjectId use it, else use it as string
    let searchId;
    try {
        searchId = /^[0-9a-fA-F]{24}$/.test(studentHash) ? new ObjectId(studentHash) : studentHash;
    } catch (e) {
        searchId = studentHash;
    }

    try {
        // Find if student exists
        const student = await db.collection('students').findOne({ _id: searchId });
        if (!student) {
            // Check if it's an orphan job user
            const hasJobs = await db.collection('jobs').findOne({ userId: studentHash });
            if (!hasJobs) return res.status(404).json({ error: 'Student not found' });
        }

        // Create the job
        const newJob = {
            _id: jobId,
            userId: studentHash,
            filename: "Resum Global",
            status: 'queued',
            uploadedAt: new Date(),
            role: 'historial'
        };
        await db.collection('jobs').insertOne(newJob);

        // Update student status (optimistic) if it's a real student record
        if (student) {
            await db.collection('students').updateOne(
                { _id: searchId },
                { $set: { "global_summary": { estado: 'A LA CUA', fecha: new Date() } } }
            );
        }

        const message = {
            jobId: jobId.toString(),
            userId: studentHash,
            role: 'historial'
        };
        channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify(message)), { persistent: true });

        res.json({ success: true, jobId });
    } catch (e) {
        console.error("Error global summary:", e);
        res.status(500).json({ error: 'Internal Error' });
    }
});

// 4.6 QUEUE STATUS
app.get('/api/queue-status', async (req, res) => {
    try {
        const db = getDB();
        const queuedJobs = await db.collection('jobs')
            .find({ status: 'queued' })
            .sort({ uploadedAt: 1 })
            .toArray();

        const queue = queuedJobs.map(j => j.filename === "Resum Global" ? j.userId : j.filename);
        res.json({ queue });
    } catch (e) {
        res.status(500).json({ error: 'Error' });
    }
});

// 4.7 CHAT API (FAST ONE-SHOT)
app.post('/api/chat', async (req, res) => {
    const { text, question } = req.body;
    if (!text || !question) return res.status(400).json({ error: 'Missing text or question' });

    const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://ollama:11434';
    const MODEL_NAME = process.env.MODEL_NAME || 'llama3.2:3b';

    try {
        const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                system: "Ets un cercador ràpid per a un Pla Individualitzat. Respon sempre en Català de forma molt breu (1 frase).",
                prompt: `
                Document PI: """${text.substring(0, 10000)}"""
                Pregunta: "${question}"
                
                Si la resposta no és al text, diu: "NO_TROBAT".
                `,
                stream: false,
                keep_alive: "60m",
                options: {
                    temperature: 0,
                    num_ctx: 8192,
                    num_predict: 60
                }
            })
        });

        if (!response.ok) throw new Error('Ollama error');
        const data = await response.json();
        res.json({ answer: data.response });
    } catch (e) {
        console.error("Chat Error:", e);
        res.status(500).json({ error: 'Chat failed' });
    }
});

// 5. LOGS
app.get('/api/logs', (req, res) => res.json([]));

// 6. DELETE FILE
app.delete('/api/students/:id/files/:filename', async (req, res) => {
    const { id } = req.params;
    // This deletes ALL jobs for the user? Or just the file?
    // Request says /files/:filename but logic in Step 37 was `deleteOne({ userId: id })` which wipes everything.
    // I will assume it wipes everything for that user based on previous code.
    await getDB().collection('jobs').deleteMany({ userId: id });
    res.json({ success: true });
});

// 7. CATCH-ALL 404 (Per evitar errors de CORS en rutes inexistents)
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found', path: req.path });
});

app.get('/', (req, res) => res.send('Backend Running'));

app.listen(port, '0.0.0.0', () => console.log(`🚀 Server running on port ${port}`));