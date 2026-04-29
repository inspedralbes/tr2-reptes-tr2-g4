const { parseSummaryToJSON } = require('../services/aiService');

describe('AI Service - parseSummaryToJSON', () => {
    test('should parse a standard markdown summary into the expected JSON structure', () => {
        const markdown = `
# PERFIL I DIAGNOSTIC
Joan es un alumno con TDAH.

# ORIENTACIO A L'AULA
Sentarlo en primera fila.
Usar apoyos visuales.

# ADAPTACIONS PER ASSIGNATURES
Más tiempo en exámenes.

# CRITERIS D'AVALUACIO
No penalizar faltas de ortografía.
        `;

        const result = parseSummaryToJSON(markdown);

        expect(result.perfil).toContain('Joan es un alumno con TDAH.');
        expect(result.recomanacions).toContain('Sentarlo en primera fila.');
        expect(result.adaptacions).toContain('Más tiempo en exámenes.');
        expect(result.avaluacio).toContain('No penalizar faltas de ortografía.');
    });

    test('should return empty arrays if text is empty', () => {
        const result = parseSummaryToJSON("");
        expect(result.perfil).toEqual([]);
        expect(result.adaptacions).toEqual([]);
    });

    test('should handle sections with different names correctly', () => {
        const markdown = `
## DADES DE L'ALUMNE
Nombre: Marc.
## DIAGNOSTIC
Dislexia.
        `;
        const result = parseSummaryToJSON(markdown);
        expect(result.perfil).toContain('Nombre: Marc.');
        expect(result.dificultats).toContain('Dislexia.');
    });
});
