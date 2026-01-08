const pdf = require('pdf-parse-fork'); // Changed from 'pdf-parse'

/**
 * Reads a PDF buffer and returns plain text.
 * @param {Buffer} buffer - The PDF file in memory
 */
async function extractTextFromPDF(buffer) {
    try {
        // pdf-parse-fork works exactly like pdf-parse
        const data = await pdf(buffer);
        const fullText = data.text;

        // Debug logs
        if (!fullText || fullText.trim().length < 10) {
            console.log("⚠️ WARNING: PDF seems empty or is a scanned image.");
        } else {
            console.log(`✅ PDF read successfully: ${fullText.length} characters extracted.`);
        }

        return fullText;

    } catch (error) {
        console.error("❌ Error in fileReader:", error.message);
        return ""; // Return empty string instead of crashing
    }
}

module.exports = { extractTextFromPDF };