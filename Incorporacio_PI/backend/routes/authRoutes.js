const express = require('express');
const router = express.Router();
const { getDB } = require('../db');
const { sendVerificationCode } = require('../utils/nodemailer');
const { registrarAcces } = require('../utils/logger'); 

const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

const loginIpLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 10, 
    message: { success: false, error: "Massa intents des d'aquesta IP. Torna-ho a provar en 15 minuts." },
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res, next, options) => {
        const ip = req.ip || req.connection.remoteAddress;
        console.warn(`IP Bloquejada: ${ip}`);
        await registrarAcces(`IP: ${ip}`, 'Bloqueig de Seguretat (IP)', 'Massa intents de login');
        res.status(options.statusCode).send(options.message);
    }
});

const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, 
    max: 10, 
    message: { success: false, error: "Ja hem enviat massa codis a aquest correu. Espera una hora." },
    keyGenerator: (req) => req.body.email, 
    standardHeaders: true,
    legacyHeaders: false,
    handler: async (req, res, next, options) => {
        const email = req.body.email || 'Desconegut';
        console.warn(`Email Bloquejat: ${email}`);
        await registrarAcces(email, 'Bloqueig de Seguretat (Email)', 'Excés de sol·licituds de codi');
        res.status(options.statusCode).send(options.message);
    }
});

router.post('/send-code', loginIpLimiter, emailLimiter, async (req, res) => {

    const { email, recaptchaToken, isDesktop } = req.body;

    if (!isDesktop) {
        if (!recaptchaToken) return res.status(400).json({ success: false, error: 'Falta Captcha.' });

        try {
            const secretKey = process.env.RECAPTCHA_SECRET_KEY;
            const verificationUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${secretKey}&response=${recaptchaToken}`;
            const googleResponse = await axios.post(verificationUrl);
            
            if (!googleResponse.data.success) {
                await registrarAcces(email, 'Intent de Login Fallit', 'Bot detectat (Captcha)');
                return res.status(400).json({ success: false, error: 'Error Captcha.' });
            }
        } catch (error) {
            return res.status(500).json({ success: false, error: 'Error intern verificació Captcha.' });
        }
    } else {
        console.log(`Login des d'Electron (sense Captcha) per: ${email}`);
    }

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

router.post('/verify-code', loginIpLimiter, async (req, res) => {
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