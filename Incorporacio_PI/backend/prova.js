// prova.js
const { connectDB, getDB, closeDB } = require('./db');

async function gestionarCentres() {
    try {
        // 1. Connectar a la base de dades
        await connectDB();
        const db = getDB();

        // 2. Obtenim la col·lecció 'centres'
        const centresCol = db.collection('centres');

        // 3. Definim el centre que volem inserir
        const nouCentre = {
            nom: "Institut Pedralbes",
            ubicacio: {
                adreca: "Av. d'Esplugues, 36-42",
                ciutat: "Barcelona",
                codiPostal: "08034"
            },
            tipus: "Públic",
            ofertaEducativa: ["ESO", "Batxillerat Científic", "Batxillerat Humanístic"],
            contacte: {
                email: "institutpedralbes@xtec.cat",
                telefon: "932033332"
            },
            actiu: true,
            dataCreacio: new Date()
        };

        // 4. Comprovem si ja existeix per no duplicar-lo (Opcional, però bona pràctica)
        const centreExisteix = await centresCol.findOne({ nom: "Institut Pedralbes" });

        if (!centreExisteix) {
            // Si no existeix, l'inserim
            const resultat = await centresCol.insertOne(nouCentre);
            console.log(`✅ S'ha creat el centre correctament.`);
            console.log(`   ID del document: ${resultat.insertedId}`);
        } else {
            console.log(`ℹ️ El centre "Institut Pedralbes" ja existeix a la base de dades.`);
        }

        // 5. Mostrem tots els centres de la col·lecció per verificar
        console.log('\n--- LLISTAT DE CENTRES ACTUAL ---');
        const llistaCentres = await centresCol.find().toArray();
        
        llistaCentres.forEach(centre => {
            console.log(`- ${centre.nom} (${centre.ubicacio.ciutat})`);
        });

    } catch (error) {
        console.error('❌ Error durant l\'execució:', error);
    } finally {
        // 6. Tanquem la connexió
        await closeDB();
    }
}

// Executem la funció principal
gestionarCentres();