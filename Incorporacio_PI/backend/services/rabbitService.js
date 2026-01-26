const amqp = require('amqplib');
const { getDB } = require('../db');
const { generateSummaryLocal } = require('./aiService');
const fs = require('fs');
const path = require('path');

const RABBIT_URL = process.env.RABBITMQ_URL || 'amqp://guest:guest@rabbitmq:5672';
const QUEUE_NAME = 'summary_jobs';
let channel = null;
const localQueue = [];
let isProcessing = false;

// SSE broadcast helper (to be connected from server.js)
let broadcastProgress = null;
function setBroadcastFn(fn) { broadcastProgress = fn; }

async function connectRabbit() {
    try {
        const conn = await amqp.connect(RABBIT_URL);
        conn.on('error', (err) => console.error("RabbitMQ Error:", err.message));
        conn.on('close', () => setTimeout(connectRabbit, 5000));

        channel = await conn.createChannel();
        await channel.assertQueue(QUEUE_NAME, { durable: true });
        channel.prefetch(1);
        console.log("RabbitMQ: Connected.");

        channel.consume(QUEUE_NAME, (msg) => {
            if (msg !== null) {
                channel.ack(msg);
                localQueue.push(msg);
                processNext();
            }
        });
    } catch (error) {
        setTimeout(connectRabbit, 5000);
    }
}

const cleanTextInternal = (text) => text.replace(/[\r\v\f]/g, '\n').replace(/[ \t]+/g, ' ').trim();

async function processNext() {
    if (isProcessing || localQueue.length === 0) return;
    isProcessing = true;
    const msg = localQueue.shift();

    try {
        const { text, filename, role, studentHash, userEmail } = JSON.parse(msg.content.toString());
        const db = getDB();

        let query = role === 'global' ? { hash_id: studentHash } : { "files.filename": filename };
        let updateField = role === 'global' ? "global_summary" : "files.$.ia_data";

        // Per als resums de rol (docent/orientador), afegim el subnivell del rol
        const finalField = role === 'global' ? updateField : `${updateField}.${role}`;

        // Initial state
        await db.collection('students').updateOne(query, {
            $set: { [`${finalField}.estado`]: "LLEGINT...", [`${finalField}.progress`]: 1 }
        });

        if (broadcastProgress) broadcastProgress(filename, { status: "LLEGINT...", progress: 1, role });

        const summary = await generateSummaryLocal(cleanTextInternal(text), role, async (partial, progress, isReading) => {
            const statusText = isReading ? "LLEGINT..." : "GENERANT...";
            if (broadcastProgress) broadcastProgress(filename, { status: statusText, progress, resumen: partial, role });

            // Throttled DB update
            if (progress % 10 === 0) {
                await db.collection('students').updateOne(query, {
                    $set: { [`${finalField}.estado`]: statusText, [`${finalField}.progress`]: progress, [`${finalField}.resumen`]: partial }
                });
            }
        });

        await db.collection('students').updateOne(query, {
            $set: {
                [`${finalField}.estado`]: "COMPLETAT",
                [`${finalField}.resumen`]: summary,
                [`${finalField}.fecha`]: new Date()
            }
        });

        if (broadcastProgress) broadcastProgress(filename, { status: "COMPLETAT", progress: 100, resumen: summary, role });

        // --- REGISTRE I NOTIFICACIÓ ---
        try {
            const studentDoc = await db.collection('students').findOne(query);
            const initials = studentDoc?.visual_identity?.iniciales || "Alumne";
            const ralcSuffix = studentDoc?.visual_identity?.ralc_suffix || "N/A";
            const studentLabel = `${initials} (${ralcSuffix})`;
            const descriptiveRole = role === 'global' ? 'Evolutiu' : (role === 'docent' ? 'Docent' : 'Orientador');

            const { registrarAcces } = require('../utils/logger');
            await registrarAcces(
                userEmail || 'sistema@ia.cat',
                `AI: Resum ${descriptiveRole} completat per a ${studentLabel}`,
                ralcSuffix
            );
        } catch (logErr) {
            console.error("Error logging summary completion:", logErr);
        }

    } catch (error) {
        console.error("Worker Error:", error);
    } finally {
        isProcessing = false;
        setTimeout(processNext, 500);
    }
}

function sendToQueue(data) {
    if (!channel) return false;
    channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(data)), { persistent: true });
    return true;
}

module.exports = { connectRabbit, sendToQueue, setBroadcastFn };
