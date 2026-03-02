const { Pool } = require('pg');

const pool = new Pool({
  // Esto busca una variable llamada DATABASE_URL en la nube, no en tu PC
  connectionString: process.env.DATABASE_URL, 
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;
