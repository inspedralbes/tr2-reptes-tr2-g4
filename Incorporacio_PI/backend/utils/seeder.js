const { getDB } = require('../db');
const { generarHash, obtenerIniciales } = require('./helpers');

const dbAlumnosRaw = [
    { id: "111222333", nombre: "Joan Garcia" },
    { id: "444555666", nombre: "Maria Martinez" },
    { id: "777888999", nombre: "Pau López" },
    { id: "123456789", nombre: "Laura Sánchez" },
    { id: "987654321", nombre: "Marc Fernández" },
    { id: "555666777", nombre: "Anna Puig" },
    { id: "222333444", nombre: "Oriol Casas" },
    { id: "888999000", nombre: "Clara Vidal" }
];

async function runSeed() {
    const db = getDB();
    const count = await db.collection('students').countDocuments();
    
    if (count === 0) {
        console.log("Seed: Inserint dades inicials...");
        const docs = dbAlumnosRaw.map(a => ({
            hash_id: generarHash(a.id), 
            visual_identity: {
                iniciales: obtenerIniciales(a.nombre),
                ralc_suffix: `***${a.id.slice(-3)}`
            },
            has_file: false
        }));
        await db.collection('students').insertMany(docs);
    }
}

module.exports = { runSeed };