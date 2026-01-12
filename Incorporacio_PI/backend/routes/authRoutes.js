const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
// 1. IMPORTAMOS LA FUNCIÓN DE CORREO
// Asegúrate de que la ruta '../nodemailer' sea correcta según donde tengas el archivo
const { sendVerificationCode } = require('../utils/nodemailer');

router.post('/send-code', async (req, res) => {
    const { email } = req.body;
    try {
        const db = getDB();
        // Generar código aleatorio
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardar en Base de Datos (Esto ya lo tenías bien)
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );

        console.log(`📨 (Debug) Codi generat per ${email}: ${code}`);

        // 2. ENVIAR EL CORREO REAL
        const emailSent = await sendVerificationCode(email, code);

        if (emailSent) {
            res.json({ success: true, message: 'Codi enviat al correu' });
        } else {
            // Si falla el envío de correo, avisamos al frontend
            res.status(500).json({ success: false, error: 'Error enviant el correu' });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error Server/DB' });
    }
});

router.post('/verify-code', async (req, res) => {
    const { email, code } = req.body;
    try {
        const db = getDB();
        const reg = await db.collection('login_codes').findOne({ email });

        if (!reg) return res.status(401).json({ success: false, message: 'Email no trobat' });
        
        // Verificar código
        if (String(reg.code) !== String(code)) return res.status(401).json({ success: false, message: 'Codi incorrecte' });
        
        // Verificar si ya se usó
        if (reg.used) return res.status(401).json({ success: false, message: 'Codi ja usat' });

        // Marcar como usado
        await db.collection('login_codes').updateOne({ email }, { $set: { used: true } });

        // Devolver token (Aquí mantengo tu fake-jwt, si usas jsonwebtoken real cámbialo aquí)
        res.json({ success: true, token: 'fake-jwt', user: { email } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error DB' });
    }
});

module.exports = router;