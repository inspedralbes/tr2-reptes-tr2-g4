const crypto = require('crypto');

const generarHash = (id) => crypto.createHash('sha256').update(id).digest('hex');

const obtenerIniciales = (nombre) => {
    if (!nombre) return '';
    return nombre
        .trim()
        .split(/\s+/)
        .map(n => n[0].toUpperCase())
        .join('.') + '.';
};

module.exports = { generarHash, obtenerIniciales };