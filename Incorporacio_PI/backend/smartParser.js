const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse-fork');
const AdmZip = require('adm-zip');

/**
 * SMART PARSER STRATEGY
 * Instead of dumping the whole text to the AI, we:
 * 1. Extract raw text cleanly.
 * 2. Snipe Metadata (Name, ID, Date) using Regex on the first 1000 chars.
 * 3. Crop the text to only the "Adaptacions" section for the AI to process.
 */

// --- 1. DOCX RAW TEXT EXTRACTOR (MAMMOTH) ---
async function extractDocxText(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer: buffer });
        return result.value.trim();
    } catch (e) {
        console.error("❌ SmartParser DOCX Error:", e);
        return "";
    }
}

// --- 2. ODT EXTRACTOR ---
function extractOdtText(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        return contentXml
            .replace(/<text:p[^>]*>/g, '\n') // Paragraphs to newlines
            .replace(/<[^>]+>/g, ' ')        // Remove tags
            .replace(/\s+/g, ' ')            // Normalize spaces
            .trim();
    } catch (e) {
        console.error("❌ SmartParser ODT Error:", e);
        return "";
    }
}

// --- 3. PDF EXTRACTOR ---
async function extractPdfText(buffer) {
    try {
        const data = await pdf(buffer);
        return data.text;
    } catch (e) {
        console.error("❌ SmartParser PDF Error:", e);
        return "";
    }
}

// --- MAIN SMART LOGIC ---
async function parseFile(filePath, originalFileName = '') {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ [SmartParser] File not found at path: ${filePath}`);
        return null;
    }

    const buffer = fs.readFileSync(filePath);
    console.log(`📂 [SmartParser] Reading file: ${filePath} (Size: ${buffer.length} bytes)`);

    if (buffer.length === 0) {
        console.error("❌ [SmartParser] File is empty (0 bytes).");
        return null;
    }

    // Use original filename for extension if provided, otherwise fallback to filePath
    const nameToCheck = originalFileName || filePath;
    const ext = path.extname(nameToCheck).toLowerCase();

    console.log(`Current Extension detected: ${ext} for file ${nameToCheck}`);

    // A. READ RAW TEXT
    let rawText = "";
    try {
        if (ext === '.docx') rawText = await extractDocxText(buffer);
        else if (ext === '.odt') rawText = extractOdtText(buffer);
        else if (ext === '.pdf') rawText = await extractPdfText(buffer);
        else {
            console.error(`❌ Extension not supported: ${ext} (File: ${nameToCheck})`);
            return null;
        }
    } catch (parseErr) {
        console.error(`❌ [SmartParser] Parser crashed for ${ext}:`, parseErr);
        return null;
    }

    console.log(`✅ [SmartParser] Raw text extracted. Length: ${rawText ? rawText.length : 0} chars.`);

    if (!rawText || rawText.length < 50) {
        console.warn(`⚠️ [SmartParser] Extracted text is too short (<50 chars). Content: "${rawText}"`);
        return null;
    }

    // B. METADATA SNIPER (First 1500 chars)
    const headerText = rawText.substring(0, 1500);
    const metadata = {
        nom: extractRegex(headerText, /(?:Nom|Alumne|Nombre)[:\.\-\s]+([^\n\r]+)/i),
        data: extractRegex(headerText, /(?:Data de naixement|Naixement)[:\.\-\s]+([0-9\/]+)/i),
        curs: extractRegex(headerText, /(?:Curs|Nivell)[:\.\-\s]+([^\n\r]+)/i),
        diagnostic: extractRegex(rawText.substring(0, 3000), /(?:Diagnòstic|Motiu|Trastorn)[:\.\-\s]+([^\n\r\.]+)/i)
    };

    // Clean up Name
    if (metadata.nom) metadata.nom = metadata.nom.replace(/Nom i cognoms/i, "").trim();

    // C. SECTION FILTERING (The "Smart Crop")
    // Find where "Adaptacions" or "Metodologia" starts
    let context = "";
    const lowerText = rawText.toLowerCase();

    // Keywords to START capturing
    const startKeywords = ["adaptacions", "metodologia", "mesures", "proposta educativa"];
    let startIndex = -1;

    for (const kw of startKeywords) {
        const idx = lowerText.indexOf(kw);
        if (idx !== -1) {
            startIndex = idx;
            break;
        }
    }

    if (startIndex !== -1) {
        // Capture ~3000 chars after the keyword (enough for the section)
        // Use rawText (preserve case)
        context = rawText.substring(startIndex, startIndex + 3500);
        console.log(`✅ [SmartParser] Found section at index ${startIndex}. Cropping text...`);
    } else {
        // Fallback: If no section found, look at the middle of the document
        console.warn("⚠️ [SmartParser] Section 'Adaptacions' not found. Using middle chunk.");
        const mid = Math.floor(rawText.length / 3);
        context = rawText.substring(mid, mid + 3500);
    }

    return {
        metadata,
        context, // The filtered text for AI
        fullTextLength: rawText.length,
        contextLength: context.length
    };
}

function extractRegex(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

module.exports = { parseFile };
