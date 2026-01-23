const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const pdf = require('pdf-parse-fork');
const AdmZip = require('adm-zip');
const cheerio = require('cheerio');

async function extractDocxSmart(buffer) {
    try {
        const result = await mammoth.convertToHtml({ buffer: buffer });
        const $ = cheerio.load(result.value);
        let extractedLines = [];

        $('tr').each((i, row) => {
            const cells = $(row).find('td, th');
            let hasSelection = false;
            let rowText = [];

            cells.each((j, cell) => {
                const text = $(cell).text().trim();
                if (text.match(/^[xX]$|^[sS][íi]$/)) {
                    hasSelection = true;
                } else if (text.length > 0) {
                    rowText.push(text);
                }
            });

            if (hasSelection && rowText.length > 0) {
                // Filtramos "basura" común
                const cleanRow = rowText.join(" - ").replace(/Adaptació|Mesura|Suport/gi, "").trim();
                if (cleanRow.length > 2) {
                    extractedLines.push("✅ SELECCIONAT: " + cleanRow);
                }
            }
        });

        let inOrientations = false;
        $('p, h1, h2, h3, li').each((i, el) => {
            if ($(el).parents('table').length === 0) {
                const text = $(el).text().trim();
                if (text.match(/Orientacions|Pautes|Recomanacions|Criteris d'avaluació/i)) inOrientations = true;
                if (text.match(/Signatura|Lloc i data|Vistiplau|Conformitat/i)) inOrientations = false;

                if (inOrientations && text.length > 10 && !text.match(/Orientacions|Pautes/i)) {
                    extractedLines.push("💡 ORIENTACIÓ: " + text);
                }
            }
        });

        const smartText = extractedLines.join("\n");
        if (smartText.length < 100) {
            const raw = await mammoth.extractRawText({ buffer: buffer });
            return raw.value;
        }
        return smartText;
    } catch (e) {
        return "";
    }
}

async function extractPdfText(buffer) {
    try {
        const data = await pdf(buffer);
        return data.text.replace(/\s+/g, ' ').trim();
    } catch (e) { return ""; }
}

function extractOdtSmart(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        let text = contentXml
            .replace(/<text:p[^>]*>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/[ \t]+/g, ' ')
            .trim();
        return text;
    } catch (e) { return ""; }
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

    // YA NO BUSCAMOS EL NOMBRE. Solo curso y diagnóstico.
    const headerText = context.substring(0, 3000);
    const metadata = {
        nom: "Alumne ANONIMITZAT",
        curs: extractRegex(headerText, /(?:Curs|Nivell|Estudis|Grup)[:\.\-\s]+([^\n\r]+)/i),
        diagnostic: extractRegex(context, /(?:Diagnòstic|Motiu|NESE|Trastorn|Descripció NESE)[:\.\-\s]+([\s\S]{5,200?})(?:\n|\.|\.|$)/i)
    };

    return { metadata, context };
}

function extractRegex(text, regex) {
    const match = text.match(regex);
    return match ? match[1].trim() : null;
}

module.exports = { parseFile };
