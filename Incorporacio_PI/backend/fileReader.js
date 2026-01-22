const pdf = require('pdf-parse-fork'); // Changed from 'pdf-parse'

/**
 * Reads a PDF buffer and returns plain text.
 * @param {Buffer} buffer - The PDF file in memory
 */
async function extractTextFromPDF(buffer) {
    try {
        const data = await pdf(buffer);
        const fullText = data.text;

        if (!fullText || fullText.trim().length < 10) {
            console.log("AVÍS: El PDF sembla buit o és una imatge escanejada.");
        } else {
            console.log(`PDF llegit correctament: ${fullText.length} caràcters extrets.`);
        }

        return fullText;

    } catch (error) {
        console.error("Error in fileReader:", error.message);
        return "";
    }
}

module.exports = { extractTextFromPDF };