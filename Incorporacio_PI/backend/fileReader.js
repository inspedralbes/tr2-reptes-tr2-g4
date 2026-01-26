const pdf = require('pdf-parse-fork');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');

async function extractTextFromPDF(buffer) {
    try {
        const data = await pdf(buffer);
        const fullText = data.text;
        if (!fullText || fullText.trim().length < 10) {
            console.log("WARNING: PDF seems empty or is a scanned image.");
        } else {
            console.log(`PDF read successfully: ${fullText.length} characters extracted.`);
        }
        return fullText;
    } catch (error) {
        console.error("Error in extractTextFromPDF:", error.message);
        return "";
    }
}

async function extractTextFromDOCX(buffer) {
    try {
        const result = await mammoth.extractRawText({ buffer });
        console.log(`DOCX read successfully: ${result.value.length} characters extracted.`);
        return result.value;
    } catch (error) {
        console.error("Error in extractTextFromDOCX:", error.message);
        return "";
    }
}

async function extractTextFromODT(buffer) {
    try {
        const zip = new AdmZip(buffer);
        const contentXml = zip.readAsText("content.xml");
        const text = contentXml.replace(/<text:p[^>]*>/g, '\n').replace(/<[^>]+>/g, ' ').trim();
        console.log(`ODT read successfully: ${text.length} characters extracted.`);
        return text;
    } catch (error) {
        console.error("Error in extractTextFromODT:", error.message);
        return "";
    }
}

async function extractTextFromFile(buffer, filename) {
    const ext = filename.split('.').pop().toLowerCase();
    switch (ext) {
        case 'pdf':
            return await extractTextFromPDF(buffer);
        case 'docx':
            return await extractTextFromDOCX(buffer);
        case 'odt':
            return await extractTextFromODT(buffer);
        default:
            console.warn(`Unsupported file extension: .${ext}`);
            return "";
    }
}

module.exports = { extractTextFromFile, extractTextFromPDF, extractTextFromDOCX, extractTextFromODT };