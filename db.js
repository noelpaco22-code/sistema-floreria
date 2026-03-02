const { Pool } = require('pg');

const pool = new Pool({
  // Si existe la variable DATABASE_URL (en la nube), la usa. Si no, usa los datos locales.
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:10802949@localhost:5432/floreria_margarita',
  // La mayoría de las bases de datos en la nube requieren SSL
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false 
});

pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión:', err.message);
    } else {
        console.log('✅ ¡Conexión exitosa!');
    }
});

module.exports = pool;
