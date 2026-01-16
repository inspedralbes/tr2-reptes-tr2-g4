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
    max: 10, // Màxim 10 intents
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
    max: 3, 
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
    const { email, recaptchaToken } = req.body;

    // ... (Codi del Recaptcha igual que tenies) ...
    if (!recaptchaToken) return res.status(400).json({ success: false, error: 'Falta Captcha.' });

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
        const googleResponse = await axios.post(verificationUrl);
        
        if (!googleResponse.data.success) {
            // Opcional: Registrar intent fallit de bot
            await registrarAcces(email, 'Intent de Login Fallit', 'Bot detectat (Captcha)');
            return res.status(400).json({ success: false, error: 'Error Captcha.' });
        }
    } catch (error) {
        return res.status(500).json({ success: false, error: 'Error intern.' });
    }

    // Enviament
    try {
        const db = getDB();
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );

        const emailSent = await sendVerificationCode(email, code);

        if (emailSent) {
            // Opcional: Registrar sol·licitud de codi (potser massa soroll?)
            // await registrarAcces(email, 'Sol·licitud Codi accés', 'Email enviat');
            res.json({ success: true, message: 'Codi enviat' });
        } else {
            res.status(500).json({ success: false, error: 'Error enviant correu' });
        }

    } catch (e) {
        console.error(e);
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