const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

// Esto es solo para confirmar en la consola que se conectó
pool.on('connect', () => {
  console.log('✅ ¡Conexión a la base de datos establecida exitosamente!');
});

module.exports = pool;
