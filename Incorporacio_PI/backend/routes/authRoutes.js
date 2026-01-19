// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { sendVerificationCode } = require('../utils/nodemailer');
const { registrarAcces } = require('../utils/logger'); // IMPORTANT: Importar Logger

// --- NOUS IMPORTS DE SEGURETAT ---
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

// --- CONFIGURACIÓ DE LIMITADORS (RATE LIMITING) ---

// 1. LIMITADOR D'IP (Login)
const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuts
    max: 100, // Màxim 10 intents
    message: { success: false, error: "Massa intents des d'aquesta IP. Torna-ho a provar en 15 minuts." },
    standardHeaders: true,
    legacyHeaders: false,
    // AFEGIT: Handler per registrar el bloqueig
    handler: async (req, res, next, options) => {
        const ip = req.ip || req.connection.remoteAddress;
        console.warn(`🚫 IP Bloquejada: ${ip}`);
        
        // Registrem l'intent fallit massiu
        await registrarAcces(
            `IP: ${ip}`, 
            'Bloqueig de Seguretat (IP)', 
            'Massa intents de login'
        );
        
        res.status(options.statusCode).send(options.message);
    }
});

// 2. LIMITADOR D'EMAIL
const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 100, 
    message: { success: false, error: "Ja hem enviat massa codis a aquest correu. Espera una hora." },
    keyGenerator: (req) => req.body.email, 
    standardHeaders: true,
    legacyHeaders: false,
    // AFEGIT: Handler per registrar el bloqueig
    handler: async (req, res, next, options) => {
        const email = req.body.email || 'Desconegut';
        console.warn(`🚫 Email Bloquejat: ${email}`);

        await registrarAcces(
            email, 
            'Bloqueig de Seguretat (Email)', 
            'Excés de sol·licituds de codi'
        );

        res.status(options.statusCode).send(options.message);
    }
});

// --- RUTES ---

// Ruta per ENVIAR el codi
router.post('/send-code', loginIpLimiter, emailLimiter, async (req, res) => {
    console.log("1. PETICIÓN RECIBIDA 📥");
    console.log("   - Email:", req.body.email);
    console.log("   - Token recibido:", req.body.recaptchaToken ? "SÍ" : "NO");

    const { email, recaptchaToken } = req.body;

    if (!recaptchaToken) {
        console.log("❌ ERROR: Falta el token");
        return res.status(400).json({ success: false, error: 'Falta Captcha.' });
    }

    try {
        console.log("2. VERIFICANDO CAPTCHA CON GOOGLE... 🤖");
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
        
        const googleResponse = await axios.post(verificationUrl);
        console.log("   - Respuesta Google:", googleResponse.data.success);
        
        if (!googleResponse.data.success) {
            console.log("❌ ERROR: Captcha inválido");
            return res.status(400).json({ success: false, error: 'Error Captcha.' });
        }
    } catch (error) {
        console.error("❌ ERROR CONECTANDO A GOOGLE:", error.message);
        return res.status(500).json({ success: false, error: 'Error intern verificació.' });
    }

    try {
        console.log("3. GENERANDO CODI... 🔢");
        const db = getDB();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        console.log("4. GUARDANDO EN MONGO... 💾");
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );
        console.log("   - Guardado OK");

        console.log("5. ENVIANDO EMAIL (Esto suele tardar)... 📧");
        // Aquí es donde probablemente se cuelga
        const emailSent = await sendVerificationCode(email, code);

        if (emailSent) {
            console.log("✅ EMAIL ENVIADO CORRECTAMENTE! 🎉");
            res.json({ success: true, message: 'Codi enviat' });
        } else {
            console.log("❌ ERROR AL ENVIAR EL EMAIL (Nodemailer falló)");
            res.status(500).json({ success: false, error: 'Error enviant correu' });
        }

    } catch (e) {
        console.error("❌ ERROR CRÍTICO EN EL SERVIDOR:", e);
        res.status(500).json({ error: 'Error Server/DB' });
    }
});

// Ruta per VERIFICAR el codi (Login Real)
router.post('/verify-code', loginIpLimiter, async (req, res) => {
    const { email, code } = req.body;
    try {
        const db = getDB();
        const reg = await db.collection('login_codes').findOne({ email });

        if (!reg) return res.status(401).json({ success: false, message: 'Codi caducat' });
        if (String(reg.code) !== String(code)) {
            // Opcional: Registrar intent fallit de codi
            // await registrarAcces(email, 'Error Login', 'Codi incorrecte');
            return res.status(401).json({ success: false, message: 'Codi incorrecte' });
        }
        if (reg.used) return res.status(401).json({ success: false, message: 'Codi ja usat' });

        await db.collection('login_codes').updateOne({ email }, { $set: { used: true } });

        // AFEGIT: REGISTREM L'ACCÉS CORRECTE
        await registrarAcces(email, 'Login Correcte', 'Accés a plataforma');

        res.json({ success: true, token: 'fake-jwt', user: { email } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error DB' });
    }
});

module.exports = router;