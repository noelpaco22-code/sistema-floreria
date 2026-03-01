const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  host: 'localhost',      // O la IP de tu servidor si no es tu propia PC
  database: 'floreria_margarita',    // El nombre de la base de datos que creaste
  password: '10802949', 
  port: 5432,             // El puerto por defecto de Postgres
  // Eliminamos el SSL porque en local suele dar problemas
  ssl: false 
});

// Prueba de conexión
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Error de conexión:', err.message);
    } else {
        console.log('✅ ¡Conexión exitosa a tu PostgreSQL local!');
    }
});

module.exports = pool;