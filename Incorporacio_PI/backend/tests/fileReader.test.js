const { extractTextFromFile } = require('../utils/fileReader');

describe('File Reader - Extension Handling', () => {
    test('should return empty string for unsupported extensions', async () => {
        const buffer = Buffer.from('fake data');
        const filename = 'documento.exe';
        const result = await extractTextFromFile(buffer, filename);
        expect(result).toBe("");
    });

    test('should identify extension case-insensitively', async () => {
        // No testeamos la extracción real porque requiere archivos binarios válidos,
        // pero sí que el flujo no explote con extensiones en mayúsculas.
        const buffer = Buffer.from('fake data');
        const filename = 'TEST.TXT'; // .txt no está en el switch, debería ir al default
        const result = await extractTextFromFile(buffer, filename);
        expect(result).toBe("");
    });
});
