const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse-fork');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');

async function extractDocxSmart(buffer) {
    try {
        // Convertimos a HTML para poder usar Cheerio y analizar las tablas
        const result = await mammoth.convertToHtml({ buffer: buffer });
        const $ = cheerio.load(result.value);
        let extractedLines = [];

        // BUSCAR EN TABLAS (Donde suelen estar las X)
        $('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            let hasX = false;
            let rowText = [];

            cells.each((j, cell) => {
                const text = $(cell).text().trim();
                // Si la celda tiene una X sola, es una marca
                if (text.match(/^[xX]$|^[sS][íi]$/)) {
                    hasX = true;
                } else if (text.length > 0) {
                    rowText.push(text);
                }
            });

            if (hasX && rowText.length > 0) {
                extractedLines.push("✅ SELECCIONAT: " + rowText.join(" - "));
            }
        });

        // BUSCAR ORIENTACIONES (Párrafos fuera de tablas)
        let inOrientations = false;
        $('p, h1, h2, h3, li').each((i, el) => {
            if ($(el).parents('table').length === 0) {
                const text = $(el).text().trim();
                if (text.match(/Orientacions|Pautes|Recomanacions/i)) inOrientations = true;
                if (text.match(/Signatura|Lloc i data|Vistiplau/i)) inOrientations = false;

                if (inOrientations && text.length > 10 && !text.match(/Orientacions/i)) {
                    extractedLines.push("💡 ORIENTACIÓ: " + text);
                }
            }
        });

        const smartText = extractedLines.join("\n");
        // Si no hemos encontrado marcas, devolvemos el texto normal como fallback
        if (smartText.length < 100) {
            const raw = await mammoth.extractRawText({ buffer: buffer });
            return raw.value;
        }

        return smartText;
    } catch (e) {
        console.error("❌ Error en extractDocxSmart:", e);
        return "";
    }
}

async function extractPdfText(buffer) {
    try {
        const data = await pdf(buffer);
        // En el PDF es difícil buscar tablas, pero podemos limpiar el texto redundante
        return data.text.replace(/\s+/g, ' ').trim();
    } catch (e) {
        return "";
    }
}

function extractOdtSmart(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        // Lógica simplificada para ODT
        let text = contentXml
            .replace(/<text:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
        return text;
    } catch (e) {
        return "";
    }
}

async function parseFile(filePath, originalFileName = '') {
    if (!fs.existsSync(filePath)) return null;
    const buffer = fs.readFileSync(filePath);
    const nameToCheck = originalFileName || filePath;
    const ext = path.extname(nameToCheck).toLowerCase();

    let context = "";
    if (ext === '.docx') context = await extractDocxSmart(buffer);
    else if (ext === '.odt') context = extractOdtSmart(buffer);
    else if (ext === '.pdf') context = await extractPdfText(buffer);
    else return null;

    // METADATA SNIPER (Evitar directores/tutores)
    const headerText = context.substring(0, 2000);
    const metadata = {
        nom: null,
        curs: extractRegex(headerText, /(?:Curs|Nivell|Estudis)[:\.\-\s]+([^\n\r]+)/i),
        diagnostic: extractRegex(context.substring(0, 5000), /(?:Diagnòstic|Motiu|NESE|Trastorn)[:\.\-\s]+([^\n\r]+)/i)
    };

    // Búsqueda de nombre con filtro de "Staff"
    const nameMatch = headerText.match(/(?:Nom i cognoms|Nom|Alumne|Nombre)[:\.\-\s]+([^\n\r]+)/i);
    if (nameMatch) {
        const candidate = nameMatch[1].trim();
        const isStaff = candidate.match(/Director|Tutor|Coordinador|Pare|Mare|Representant/i);
        if (!isStaff) metadata.nom = candidate;
    }

    return { metadata, context };
}

function extractRegex(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

module.exports = { parseFile };
