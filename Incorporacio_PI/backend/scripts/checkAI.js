const { generateSummaryLocal } = require('../services/aiService');

async function testAI() {
    console.log("🤖 Test de IA: Verificando generación...");
    
    // Timeout de seguridad de 300 segundos (5 min) para el test (necesario si el servidor es lento o está cargando el modelo)
    const timeout = setTimeout(() => {
        console.error("❌ Error: La IA ha tardado demasiado en responder (Timeout).");
        process.exit(1);
    }, 300000);

    try {
        const testPrompt = "Escriu només una frase curta: 'IA FUNCIONANT'.";
        // Usamos el rol 'docent' que es el más ligero
        const result = await generateSummaryLocal(testPrompt, 'docent', (err, prog) => {
            if (prog) process.stdout.write(`...${prog}%`);
        });

        clearTimeout(timeout);
        console.log("\n✅ Respuesta de la IA recibida:");
        console.log("-----------------------------------");
        console.log(result);
        console.log("-----------------------------------");

        if (result && result.length > 5) {
            console.log("🚀 TEST SUPERADO: La IA está generando texto correctamente.");
            process.exit(0);
        } else {
            console.error("❌ Error: La IA ha devuelto una respuesta vacía o demasiado corta.");
            process.exit(1);
        }
    } catch (error) {
        clearTimeout(timeout);
        console.error("❌ Error crítico en el test de IA:", error.message);
        process.exit(1);
    }
}

testAI();
