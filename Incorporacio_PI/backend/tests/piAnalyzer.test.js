const { analyzePI } = require('../services/piAnalyzer');

describe('PI Analyzer - Logic Tests', () => {
    test('should clean noisy text (emails, phones, websites)', () => {
        const noisyText = "Contactar con info@escuela.cat o llamar al 93 123 45 67. Web: www.escuela.cat. El alumno tiene TDAH.";
        const result = analyzePI(noisyText);
        expect(result.perfil[0]).toContain('TDAH');
        const preview = result.stats.preview.toLowerCase();
        expect(preview).not.toContain('info@escuela.cat');
    });

    test('should correctly classify student difficulties', () => {
        const text = "L'alumne presenta una gran lentitud en la lectura i dificultat per comprendre textos llargs.";
        const result = analyzePI(text);
        expect(result.dificultats.length).toBeGreaterThan(0);
        expect(result.dificultats[0].toLowerCase()).toContain('lentitud');
    });

    test('should identify classroom recommendations or adaptations', () => {
        const text = "Cal situar l'alumne a prop del docent i prioritzar les tasques curtes.";
        const result = analyzePI(text);
        // Comprobamos que entra en alguna categoría de apoyo
        const hasMatch = result.recomanacions.length > 0 || result.adaptacions.length > 0;
        expect(hasMatch).toBe(true);
    });

    test('should detect evaluation and spelling mentions', () => {
        const text = "No penalitzar l'ortografia en els exàmens de llengua.";
        const result = analyzePI(text);
        // Verificamos que se captura la frase en adaptaciones o evaluación
        const combined = [...result.adaptacions, ...result.avaluacio].join(' ').toLowerCase();
        expect(combined).toContain('ortografia');
        expect(combined).toContain('exàmens');
    });
});
