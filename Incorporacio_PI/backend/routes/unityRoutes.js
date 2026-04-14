const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

let datosEscuelas = [];
try {
    datosEscuelas = require('../centres-educatius.json'); 
    console.log(`JSON cargado: ${datosEscuelas.length} escuelas.`);
} catch (e) {
    console.error("Error cargando JSON escuelas", e);
}

router.get('/home', async (req, res) => {
    try {
        const db = getDB();
        const students = await db.collection('students').find().toArray();

        const contadorEscuelas = {};

        students.forEach(alumno => {
            const numDocs = (alumno.files && Array.isArray(alumno.files)) ? alumno.files.length : 0;
            
            if (numDocs > 0 && alumno.codi_centre) {
                contadorEscuelas[alumno.codi_centre] = (contadorEscuelas[alumno.codi_centre] || 0) + numDocs;
            }
        });

        const ranking = Object.entries(contadorEscuelas)
            .map(([codigo, total]) => {
                const infoEscuela = datosEscuelas.find(e => e.codi_centre === codigo);
                return {
                    nombre: infoEscuela ? infoEscuela.denominacio_completa : "Escuela " + codigo,
                    dato: total + " PIs" 
                };
            })
            .sort((a, b) => parseInt(b.dato) - parseInt(a.dato)) 
            .slice(0, 10); 

        const ultimos = students
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 10)
            .map(alumno => {
                const infoEscuela = datosEscuelas.find(e => e.codi_centre === alumno.codi_centre);
                return {
                    nombre: (alumno.visual_identity?.iniciales || "S.N.") + " - " + (infoEscuela ? infoEscuela.denominacio_completa : "Desconocido"),
                    dato: "Hace poco"
                };
            });

        res.json({
            topEscuelas: ranking,
            ultimosPI: ultimos
        });

    } catch (error) {
        console.error("Error Stats:", error);
        res.status(500).json({ error: "Error calculando stats" });
    }
});

router.get('/buscar', async (req, res) => {
    try {
        const db = getDB();
        const textoBusqueda = req.query.nombre.toLowerCase(); 
        console.log(`Buscando: "${textoBusqueda}"`);

        const coincidencias = datosEscuelas.filter(escuela => 
            (escuela.codi_centre && escuela.codi_centre.startsWith(textoBusqueda)) || 
            (escuela.email && escuela.email.toLowerCase().includes(textoBusqueda)) ||  
            (escuela.denominacio_completa && escuela.denominacio_completa.toLowerCase().includes(textoBusqueda)) 
        );

        if (coincidencias.length === 0) {
            console.log("inguna escuela encontrada.");
            return res.json({ tipo: "error", mensaje: "No se encontraron escuelas." });
        }

        if (coincidencias.length > 1) {
            console.log(`Encontradas ${coincidencias.length} escuelas posibles.`);
            return res.json({
                tipo: "lista",
                resultados: coincidencias.map(e => ({
                    nombre: e.denominacio_completa,
                    codigo: e.codi_centre
                }))
            });
        }

        const escuelaEncontrada = coincidencias[0];
        console.log(`Escuela única: ${escuelaEncontrada.denominacio_completa}`);

        const collection = db.collection('students'); 
        const alumnosEncontrados = await collection.find({
            codi_centre: escuelaEncontrada.codi_centre
        }).toArray();

        const listaAlumnosLimpia = alumnosEncontrados.map(alumno => {
            const numeroDeArchivos = (alumno.files && Array.isArray(alumno.files)) ? alumno.files.length : 0;
            return {
                iniciales: alumno.visual_identity ? alumno.visual_identity.iniciales : "S.N.",
                numDocumentos: numeroDeArchivos
            };
        });

        res.json({
            tipo: "detalle",
            nombre: escuelaEncontrada.denominacio_completa,
            listaAlumnos: listaAlumnosLimpia
        });

    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ error: "Error servidor" });
    }
});

module.exports = router;