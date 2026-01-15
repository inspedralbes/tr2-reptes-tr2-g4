const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { sendVerificationCode } = require('../utils/nodemailer');

// --- NOUS IMPORTS DE SEGURETAT ---
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config(); // Per llegir RECAPTCHA_SECRET_KEY del .env

// --- CONFIGURACIÓ DE LIMITADORS (RATE LIMITING) ---

// 1. LIMITADOR D'IP (El que has demanat)
// Si una IP fa més de 10 peticions en 15 minuts, es bloqueja durant 15 minuts.
const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minuts
    max: 10, // Màxim 10 intents
    message: { success: false, error: "Massa intents des d'aquesta IP. Torna-ho a provar en 15 minuts." },
    standardHeaders: true, // Retorna info als headers `RateLimit-*`
    legacyHeaders: false,
});

// 2. LIMITADOR D'EMAIL (Protecció extra per les escoles)
// Encara que l'atacant canviï d'IP, no podrà enviar més de 3 emails a la mateixa escola en 1 hora.
const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hora
    max: 3, // Màxim 3 intents al mateix email
    message: { success: false, error: "Ja hem enviat massa codis a aquest correu. Espera una hora." },
    keyGenerator: (req) => req.body.email, // Utilitza l'email com a clau única
    standardHeaders: true,
    legacyHeaders: false,
});

// --- RUTES ---

// Ruta per ENVIAR el codi (Protegida amb IP, Email i Captcha)
router.post('/send-code', loginIpLimiter, emailLimiter, async (req, res) => {
    const { email, recaptchaToken } = req.body;

    // 1. VALIDACIÓ RECAPTCHA (Google)
    if (!recaptchaToken) {
        return res.status(400).json({ success: false, error: 'Has de completar el Captcha.' });
    }

    try {
        const secretKey = process.env.RECAPTCHA_SECRET_KEY;
        // Connectem amb Google per veure si el token és real
        const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
        
        const googleResponse = await axios.post(verificationUrl);
        
        // Si Google diu que no és vàlid o és un bot:
        if (!googleResponse.data.success) {
            return res.status(400).json({ success: false, error: 'Verificació Captcha fallida. Ets un robot?' });
        }
    } catch (error) {
        console.error("Error connectant amb Google Recaptcha:", error);
        return res.status(500).json({ success: false, error: 'Error intern verificant seguretat.' });
    }

    // 2. LÒGICA D'ENVIAMENT (Només s'executa si el Captcha és vàlid)
    try {
        const db = getDB();
        // Generar codi aleatori de 6 xifres
        const code = Math.floor(100000 + Math.random() * 900000).toString();
        
        // Guardar a Base de Dades
        await db.collection('login_codes').updateOne(
            { email: email },
            { $set: { code: code, createdAt: new Date(), used: false } },
            { upsert: true }
        );

        console.log(`📨 (Debug) Codi generat per ${email}: ${code}`);

        // Enviar email real
        const emailSent = await sendVerificationCode(email, code);

        if (emailSent) {
            res.json({ success: true, message: 'Codi enviat al correu' });
        } else {
            res.status(500).json({ success: false, error: 'Error enviant el correu electrònic' });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error Server/DB' });
    }
});

// Ruta per VERIFICAR el codi (També protegida per IP per evitar força bruta)
router.post('/verify-code', loginIpLimiter, async (req, res) => {
    const { email, code } = req.body;
    try {
        const db = getDB();
        const reg = await db.collection('login_codes').findOne({ email });

        if (!reg) return res.status(401).json({ success: false, message: 'Email no trobat o codi caducat' });
        
        // Verificar coincidència
        if (String(reg.code) !== String(code)) return res.status(401).json({ success: false, message: 'Codi incorrecte' });
        
        // Verificar si ja s'ha utilitzat
        if (reg.used) return res.status(401).json({ success: false, message: 'Aquest codi ja s\'ha utilitzat' });

        // Marcar com a usat
        await db.collection('login_codes').updateOne({ email }, { $set: { used: true } });

        // Retornar èxit
        res.json({ success: true, token: 'fake-jwt', user: { email } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error DB' });
    }
});

module.exports = router;