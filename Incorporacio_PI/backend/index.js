// index.js

// Aixo es un exemple del exercici 1, d'acces a dades mongdb.










/*

const { connectDB, getDB, closeDB } = require('./db');

async function inserirTasca() {
    try {
        // 1. Primer ens connectem a la base de dades
        await connectDB();
        // 2. Obtenim la referència a la base de dades
        const db = getDB();
        // 3. Obtenim (o creem) la col·lecció 'tasques'
        // Si la col·lecció no existeix, MongoDB la crea automàticament
        const tasques = db.collection('tasques');
        // 4. Definim el document que volem inserir
        // És simplement un objecte JavaScript
        const novaTasca = {
            titol: "Estudiar MongoDB",
            descripcio: "Repassar operacions CRUD",
            completada: false,
            dataCreacio: new Date()
        };
        // 5. Inserim el document a la col·lecció
        // // insertOne() retorna un objecte amb informació sobre l'operació
        const resultat = await tasques.insertOne(novaTasca);
        // 6. Mostrem el resultat
        console.log(' Producte inserit amb ID:', resultat.insertedId);
        // insertedId conté l'ObjectId del document que acabem d'inserir
    } catch (error) {
        // Si alguna cosa falla, capturem l'error i el mostrem
        console.error(' Error inserint producte:', error);
    } finally {
        // Sempre tanquem la connexió, tant si ha anat bé com si ha fallat
        await closeDB();
    }
}

async function inserirVariesTasques() {
    try {
        // 1. Connectem a la base de dades
        await connectDB();
        const db = getDB();
        const tasques = db.collection('tasques');
        // 2. Definim un array de documents per inserir
        const novesTasques = [
            { 
                titol: "Fer exercici pràctic", 
                descripcio: "Implementar funcions a Node.js", 
                completada: false, 
                dataCreacio: new Date() 
            },
            { 
                titol: "Revisar apunts", 
                descripcio: "Llegir la teoria del Mòdul 0486", 
                completada: true, 
                dataCreacio: new Date() 
            },
            { 
                titol: "Preparar examen", 
                descripcio: "Estudiar consultes avançades", 
                completada: false, 
                dataCreacio: new Date() 
            },
            { 
                titol: "Acabar projecte", 
                descripcio: "Finalitzar el backend de la To-Do List", 
                completada: true, 
                dataCreacio: new Date() 
            }
        ];
        // 3. Inserim tots els documents d'un cop
        // insertMany() accepta un array de documents
        const resultat = await tasques.insertMany(novesTasques);
        // 4. Mostrem informació sobre els documents inserits
        console.log(`S'han inserit ${resultat.insertedCount} tasques`);
        console.log('IDs de les tasques inserides:', resultat.insertedIds)
        // insertedIds és un objecte amb els ObjectId de tots els documents inserits
    } catch (error) {
        console.error(' Error inserint tasques:', error);
    } finally {
        await closeDB();
    }
}

async function obtenirTotesLesTasques() {
    try {
        await connectDB();
        const db = getDB();
        const tasques = db.collection('tasques');
        // find() sense paràmetres retorna TOTS els documents
        // toArray() converteix el cursor en un array de JavaScript
        const totesLesTasques = await tasques.find().toArray();
        console.log(`S'han trobat ${totesLesTasques.length} tasques:`);
        // Iterem per totes les tasques i les mostrem
        totesLesTasques.forEach(tasca => {
            console.log(`- ${tasca.titol} - descripcio: ${tasca.descripcio} - Completada: ${tasca.completada} - Data de creació: ${tasca.dataCreacio}`);
        });
    } catch (error) {
        console.error(' Error obtenint tasques:', error);
    } finally {
        await closeDB();
    }
}

async function obtenirTasquesCompletades() {
    try {
        await connectDB();
        const db = getDB();
        const tasques = db.collection('tasques');
        // Exemple 1: Buscar tasques d'una categoria específica
        console.log('--- Tasques completades" ---');
        const completades = await tasques.find({ completada: true }).toArray();
        completades.forEach(p => console.log(`- ${p.titol}`));
    } catch (error) {
        console.error(' Error cercant tasques:', error);
    } finally {
        await closeDB();
    }
}

async function obtenirTascaPerTitol() {
    try {
        await connectDB();
        const db = getDB();
        const tasques = db.collection('tasques');
        // findOne() retorna el PRIMER document que coincideix amb el filtre
        // Filtre: objecte amb els camps i valors que volem buscar
        const tasca = await tasques.findOne({ titol: 'Estudiar MongoDB' });
        // Comprovem si s'ha trobat el producte
        if (tasca) {
            console.log(' Tasca trobada:');
            console.log(` Titol: ${tasca.titol}`);
            console.log(` descripcio: ${tasca.descripcio}`);
            console.log(` completada: ${tasca.completada}`);
            console.log(` dataCreacio: ${tasca.dataCreacio}`);
            console.log(` ID: ${tasca._id}`);
        } else {
            console.log(' No s\'ha trobat cap tasca amb aquest titol');
        }
    } catch (error) {
        console.error(' Error cercant tasca:', error);
    } finally {
        await closeDB();
    }
}

async function main() {
    try {
        await connectDB();

        await inserirTasca();
        await inserirVariesTasques();
        await obtenirTotesLesTasques();
        await obtenirTasquesCompletades();
        await obtenirTascaPerTitol();

    } catch (error) {
        console.error('Hi ha hagut un error en l\'execució:', error);
    } finally {
        await closeDB();
    }
}
main();

*/