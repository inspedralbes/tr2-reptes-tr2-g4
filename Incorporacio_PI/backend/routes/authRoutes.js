// backend/routes/authRoutes.js

const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { sendVerificationCode } = require('../utils/nodemailer');
const { registrarAcces } = require('../utils/logger'); 

// --- MANTENIM ELS LIMITADORS ---
const rateLimit = require('express-rate-limit');
// JA NO NECESSITEM AXIOS NI DOTENV PER AL CAPTCHA
// const axios = require('axios'); 
// require('dotenv').config();

// ... (MANTENIM EL CODI DELS LIMITADORS loginIpLimiter I emailLimiter IGUAL QUE ABANS) ...
// Copia aquí els const loginIpLimiter = ... i const emailLimiter = ... del teu codi original

// --- RUTES MODIFICADES ---

// Ruta per ENVIAR el codi (SENSE CAPTCHA)
router.post('/send-code', loginIpLimiter, emailLimiter, async (req, res) => {
    // 1. JA NO DEMANEM recaptchaToken
    const { email } = req.body; 

    // 2. HEM ESBORRAT TOTA LA PART DE GOOGLE / AXIOS

    // 3. Enviament directe
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
            res.json({ success: true, message: 'Codi enviat' });
        } else {
            res.status(500).json({ success: false, error: 'Error enviant correu' });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error Server/DB' });
    }
});

// Ruta per VERIFICAR (Aquesta es queda igual)
router.post('/verify-code', loginIpLimiter, async (req, res) => {
    // ... El codi de verify-code es queda EXACTAMENT IGUAL que el tenies ...
    const { email, code } = req.body;
    try {
        const db = getDB();
        const reg = await db.collection('login_codes').findOne({ email });

        if (!reg) return res.status(401).json({ success: false, message: 'Codi caducat' });
        if (String(reg.code) !== String(code)) {
            return res.status(401).json({ success: false, message: 'Codi incorrecte' });
        }
        if (reg.used) return res.status(401).json({ success: false, message: 'Codi ja usat' });

        await db.collection('login_codes').updateOne({ email }, { $set: { used: true } });
        await registrarAcces(email, 'Login Correcte', 'Accés a plataforma');

        res.json({ success: true, token: 'fake-jwt', user: { email } });

    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error DB' });
    }
});

module.exports = router;