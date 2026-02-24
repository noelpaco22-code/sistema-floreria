const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',           // Tu usuario de PostgreSQL
    host: 'localhost',          // Tu servidor (normalmente localhost)
    database: 'floreria_margarita', // El nombre que creamos
    password: '10802949',    // LA CONTRASEÑA DE TU POSTGRES
    port: 5432,                 // El puerto por defecto
});

// Prueba de conexión rápida
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error(' Error conectando a la DB:', err.stack);
    } else {
        console.log(' Conexión a la base de datos exitosa');
    }
});

module.exports = pool;