const express = require('express');
const multer = require('multer'); // Librería para gestionar subida de archivos
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors()); // Permite que cualquier frontend se conecte
app.use(express.json());

// --- CONFIGURACIÓN DE LA "NEVERA" (Almacenamiento) ---
// Aquí definimos dónde y cómo se guardan los archivos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = './uploads';
        // Si la carpeta "uploads" no existe, la crea (la nevera física)
        if (!fs.existsSync(dir)){
            fs.mkdirSync(dir);
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        // TRUCO: Guardamos el archivo con el nombre del RALC.
        // Así el ID (RALC) es la llave única de la taquilla.
        // Ejemplo: "123456.pdf"
        const ralc = req.body.ralc; 
        const extension = path.extname(file.originalname);
        cb(null, `${ralc}${extension}`);
    }
});

const upload = multer({ storage: storage });

// --- SIMULACIÓN DE IA (El "Middleware") ---
// Esta función simula que la IA lee el PDF y saca los datos clave
function simularProcesamientoIA(ralc) {
    // En el futuro, aquí conectarás con OpenAI/Python
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

// ================= RUTAS (La API) =================

// 1. RUTA PARA EL CENTRO ORIGEN (Llenar la nevera)
// Método: POST | Recibe: archivo 'pdf' y texto 'ralc'
app.post('/api/subir-pi', upload.single('documento'), (req, res) => {
    const ralc = req.body.ralc;
    
    if (!req.file || !ralc) {
        return res.status(400).json({ error: "Falta el archivo o el RALC" });
    }

    console.log(`[CENTRO 1] Documento guardado para RALC: ${ralc}`);
    
    // Aquí disparamos la "Simulación de IA"
    const datosIA = simularProcesamientoIA(ralc);

    res.json({
        mensaje: "Documento guardado en la taquilla correctamente",
        archivo: req.file.filename,
        ia_preview: datosIA // Devolvemos ya el mock de la IA
    });
});

// 2. RUTA PARA EL CENTRO DESTINO (Mirar si hay algo en la nevera)
// Método: GET | Se dispara cuando hay matrícula
app.get('/api/consultar-alumno/:ralc', (req, res) => {
    const ralc = req.params.ralc;
    const pathArchivo = `./uploads/${ralc}.pdf`; // Asumimos PDF por simplicidad

    // Verificamos si existe el archivo en la "nevera"
    if (fs.existsSync(pathArchivo)) {
        console.log(`[CENTRO 2] ¡Match encontrado! Hay datos para RALC: ${ralc}`);
        
        // Simulamos que recuperamos los datos procesados por la IA
        const datosIA = simularProcesamientoIA(ralc);

        res.json({
            encontrado: true,
            datos_ia: datosIA,
            download_url: `/api/descargar/${ralc}`
        });
    } else {
        console.log(`[CENTRO 2] Consultando RALC: ${ralc} -> Taquilla vacía.`);
        res.json({ 
            encontrado: false, 
            mensaje: "No hay documentación previa para este alumno." 
        });
    }
});

// 3. RUTA PARA DESCARGAR EL ORIGINAL
app.get('/api/descargar/:ralc', (req, res) => {
    const ralc = req.params.ralc;
    const file = `${__dirname}/uploads/${ralc}.pdf`;
    res.download(file); 
});

// --- ARRANCAR SERVIDOR ---
app.listen(PORT, () => {
    console.log(`🚀 Servidor "Taquilla Digital" corriendo en http://localhost:${PORT}`);
    console.log(`📂 Los archivos se guardarán en la carpeta /uploads`);
});