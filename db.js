const { Pool } = require('pg');

// Esta línea lee automáticamente el link de Supabase desde Render
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
    connectionString: connectionString,
    ssl: {
        rejectUnauthorized: false // Esto es VITAL para que Supabase no rechace la conexión
    }
});

// Prueba de conexión rápida
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error(' Error conectando a la DB:', err.message);
    } else {
        console.log(' ¡Conexión exitosa a Supabase desde la nube!');
    }
});

module.exports = pool;
