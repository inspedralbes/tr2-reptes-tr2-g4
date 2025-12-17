const express = require('express');
const multer = require('multer'); // Librería para gestionar subida de archivos
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { connectDB, getDB } = require('./db'); // IMPORTANTE: Tu conexión a Mongo

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Permite que cualquier frontend se conecte
app.use(express.json());

// --- CONFIGURACIÓN DE LA "NEVERA" (Almacenamiento de Archivos) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        const ralc = req.body.ralc; 
        const extension = path.extname(file.originalname);
        cb(null, `${ralc}${extension}`);
    }
});

const upload = multer({ storage: storage });

// --- SIMULACIÓN DE IA ---
function simularProcesamientoIA(ralc) {
    return {
        ralc: ralc,
        estado_ia: "PROCESADO",
        resumen: {
            adaptacion_tiempo: "Necesita +25% tiempo",
            adaptacion_formato: "Letra Arial 12",
            observacion: "Atención dispersa en tardes."
        },
        fecha_proceso: new Date()
    };
}

// ================= RUTAS DE LA TAQUILLA DIGITAL (Tus rutas originales) =================

// 1. SUBIR ARCHIVO
app.post('/api/subir-pi', upload.single('documento'), (req, res) => {
    const ralc = req.body.ralc;
    if (!req.file || !ralc) return res.status(400).json({ error: "Falta el archivo o el RALC" });
    
    console.log(`[CENTRO 1] Documento guardado para RALC: ${ralc}`);
    const datosIA = simularProcesamientoIA(ralc);

    res.json({
        mensaje: "Documento guardado correctamente",
        archivo: req.file.filename,
        ia_preview: datosIA
    });
});

// 2. CONSULTAR ARCHIVO
app.get('/api/consultar-alumno/:ralc', (req, res) => {
    const ralc = req.params.ralc;
    const pathArchivo = `./uploads/${ralc}.pdf`;

    if (fs.existsSync(pathArchivo)) {
        console.log(`[CENTRO 2] Match encontrado para RALC: ${ralc}`);
        const datosIA = simularProcesamientoIA(ralc);
        res.json({
            encontrado: true,
            datos_ia: datosIA,
            download_url: `/api/descargar/${ralc}`
        });
    } else {
        res.json({ encontrado: false, mensaje: "No hay documentación." });
    }
});

// 3. DESCARGAR
app.get('/api/descargar/:ralc', (req, res) => {
    const ralc = req.params.ralc;
    const file = `${__dirname}/uploads/${ralc}.pdf`;
    res.download(file); 
});

// ================= NUEVAS RUTAS DE LOGIN (Las que faltaban) =================

// 4. SOLICITAR CÓDIGO (Login Fase 1)
app.post('/api/login/send-code', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'El email es obligatorio' });

    try {
        const db = getDB();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardamos en Mongo
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );

        console.log(`📨 LOGIN: El código para ${email} es: [ ${code} ]`);
        res.json({ message: 'Código enviado correctamente' });
    } catch (error) {
        console.error('Error enviando código:', error);
        res.status(500).json({ error: 'Error interno' });
    }
});

// 5. VERIFICAR CÓDIGO (Login Fase 2)
app.post('/api/login/verify-code', async (req, res) => {
    const { email, code } = req.body;
    try {
        const db = getDB();
        const registro = await db.collection('login_codes').findOne({ email: email });

        if (!registro) return res.status(400).json({ error: 'Email no encontrado' });

        if (registro.code === code && !registro.used) {
            await db.collection('login_codes').updateOne(
                { email: email },
                { $set: { used: true } }
            );
            res.json({ success: true, token: 'fake-jwt-token-gencat', user: { email } });
        } else {
            res.status(401).json({ error: 'Código incorrecto o expirado' });
        }
    } catch (error) {
        console.error('Error verificando:', error);
        res.status(500).json({ error: 'Error verificando código' });
    }
});

// --- ARRANCAR SERVIDOR CON MONGODB ---
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Servidor (Taquilla + Login) corriendo en http://localhost:${PORT}`);
    });
}).catch(err => {
    console.error('❌ Error fatal al conectar a la BD:', err);
});