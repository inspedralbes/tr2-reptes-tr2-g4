const { generateSummaryLocal } = require('./services/aiService');

async function testAI() {
    console.log("🤖 Test de IA: Verificando generación...");
    
    // Timeout de seguridad de 60 segundos para el test
    const timeout = setTimeout(() => {
        console.error("❌ Error: La IA ha tardado demasiado en responder (Timeout).");
        process.exit(1);
    }, 60000);

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
