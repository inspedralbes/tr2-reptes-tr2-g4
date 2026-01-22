require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const Job = require('./models/Job');
const Student = require('./models/Student'); // Restore Student model
const amqp = require('amqplib');
const WebSocket = require('ws');
const { extractTextFromFile } = require('./fileReader'); // To read file content for analysis

const app = express();
const port = process.env.PORT || 4000;

// Multer Config
const upload = multer({ dest: 'uploads/' });

// MongoDB Connection
const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI;

mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ Connectat a MongoDB (Atlas/External)');
        await seedDatabase(); // Auto-seed on connect
    })
    .catch(err => console.error('❌ Error connectant a MongoDB:', err));

app.use(cors());
app.use(express.json());
app.use('/public', express.static(path.join(__dirname, 'public')));


// --- SEEDING FUNCTION ---
async function seedDatabase() {
    try {
        const count = await Student.countDocuments();
        if (count === 0) {
            console.log("🌱 Seeding DB with dummy students...");
            await Student.create([
                {
                    _id: "RALC1234",
                    name: "Joan Garcia",
                    birthDate: "2010-05-15",
                    centerCode: "080001",
                    ownerId: 1,
                    visual_identity: { iniciales: "JG", ralc_suffix: "234", color_bg: "#AA00FF", color_text: "#FFFFFF" }
                },
                {
                    _id: "RALC5678",
                    name: "Maria Lopez",
                    birthDate: "2011-02-20",
                    centerCode: "080001",
                    ownerId: 1,
                    visual_identity: { iniciales: "ML", ralc_suffix: "678", color_bg: "#00AAFF", color_text: "#FFFFFF" }
                },
                {
                    _id: "RALC9999",
                    name: "Pere Marti",
                    birthDate: "2012-11-01",
                    centerCode: "080001",
                    ownerId: 1,
                    visual_identity: { iniciales: "PM", ralc_suffix: "999", color_bg: "#FF00AA", color_text: "#FFFFFF" }
                }
            ]);
            console.log("✅ Seed complete.");
        }
    } catch (e) {
        console.error("Seed error:", e);
    }
}

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
        const students = await Student.find();
        const jobs = await Job.find().sort({ uploadedAt: -1 });

        // Map of Student ID -> Student Object
        const studentMap = new Map();
        students.forEach(s => studentMap.set(s._id.toString(), s));

        const combinedList = [];
        const processedJobUserIds = new Set();

        // 1. Process Students (and attach their jobs if any)
        students.forEach(student => {
            const studentId = student._id.toString();
            // Find ALL jobs for this student, take the latest
            const studentJobs = jobs.filter(j => j.userId === studentId);
            const latestJob = studentJobs.length > 0 ? studentJobs[0] : null;

            if (latestJob) processedJobUserIds.add(studentId);

            combinedList.push({
                hash_id: studentId,
                original_name: student.name,
                original_id: student.centerCode || studentId,
                visual_identity: student.visual_identity || {
                    iniciales: student.name.substring(0, 2).toUpperCase(),
                    ralc_suffix: studentId.length > 3 ? studentId.substring(studentId.length - 3) : '000',
                    color_bg: '#E0E0E0',
                    color_text: '#000000'
                },
                has_file: !!latestJob,
                files: latestJob ? [{ filename: latestJob.filename, upload_date: latestJob.uploadedAt }] : [],
                ia_data: latestJob ? {
                    estado: mapStatus(latestJob.status),
                    last_update: latestJob.processedAt,
                    resumen: latestJob.result || (latestJob.error ? { error: latestJob.error } : null)
                } : null,
                filename: latestJob ? latestJob.filename : null
            });
        });

        // 2. Process Orphan Jobs (Jobs with no matching Student)
        jobs.forEach(job => {
            if (!processedJobUserIds.has(job.userId)) {
                // This job belongs to a userId that is NOT in the students collection.
                // We treat it as a "Virtual Student".
                const derivedName = job.filename.split('.')[0].replace(/[_-]/g, ' ');
                const initials = derivedName.substring(0, 2).toUpperCase();

                combinedList.push({
                    hash_id: job.userId, // Use job's userId as the ID
                    original_name: derivedName + " (Arxiu)",
                    original_id: "Ext.",
                    visual_identity: {
                        iniciales: initials,
                        ralc_suffix: 'FILE',
                        color_bg: '#FFCC80', // Orange for files
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

                // Mark processed to avoid duplicates if multiple jobs have same userId
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
    if (status === 'completed') return 'COMPLETAT';
    if (status === 'failed') return 'ERROR';
    return status;
}

// 2. UPLOAD FILE
app.post('/api/upload', upload.single('documento_pi'), async (req, res) => {
    // Note: frontend sends 'documento_pi', previous code used 'piFile'. Multer matches frontend now.
    if (!req.file) return res.status(400).json({ success: false, message: 'No file.' });
    if (!channel) return res.status(500).json({ success: false, message: 'RabbitMQ invalid.' });

    // userId = studentHash from frontend
    const userId = req.body.studentHash || req.body.userId;

    // Remove old job if exists for this student
    await Job.deleteOne({ userId: userId });

    const jobId = new mongoose.Types.ObjectId();
    const filePath = req.file.path;
    const originalFileName = req.file.originalname;

    try {
        const newJob = new Job({
            _id: jobId,
            userId: userId,
            filename: originalFileName,
            filePath: filePath,
            status: 'queued',
            uploadedAt: new Date(),
        });
        await newJob.save();

        const message = {
            jobId: jobId.toHexString(),
            filePath: filePath,
            originalFileName: originalFileName,
            userId: userId, // Used for routing notifications back
        };
        channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify(message)), { persistent: true });
        console.log(`✅ Trabajo ${jobId} encolado.`);

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
        const filename = decodeURIComponent(req.params.filename);
        const job = await Job.findOne({ filename: filename }).sort({ uploadedAt: -1 });

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
    const { filename } = req.body;
    // We can't easily re-queue without the file.
    // If user wants to "Regenerate", we would need the original file or the raw text.
    // Since we delete the file, this is tricky.
    // SIMPLE FIX: Just mark as "queued" if file exists, else error.

    const job = await Job.findOne({ filename: filename }).sort({ uploadedAt: -1 });
    if (!job) return res.status(404).json({ error: 'Job not found' });

    if (!fs.existsSync(job.filePath)) {
        return res.status(400).json({ error: 'El archivo original ya no existe. Súbelo de nuevo.' });
    }

    // Re-queue
    job.status = 'queued';
    job.result = null;
    job.error = null;
    await job.save();

    const message = {
        jobId: job._id,
        filePath: job.filePath,
        originalFileName: job.filename,
        userId: job.userId,
    };
    channel.sendToQueue('pi_processing_queue', Buffer.from(JSON.stringify(message)), { persistent: true });

    res.json({ success: true, message: "Re-queued for generation" });
});

// 5. LOGS
app.get('/api/logs', (req, res) => res.json([]));

// 6. DELETE FILE
app.delete('/api/students/:id/files/:filename', async (req, res) => {
    const { id } = req.params;
    await Job.deleteOne({ userId: id });
    res.json({ success: true });
});

app.get('/', (req, res) => res.send('Backend Running'));

app.listen(port, '0.0.0.0', () => console.log(`🚀 Server running on port ${port}`));