const { Client } = require('pg');

// Configure your PostgreSQL connection
const client = new Client({
  user: 'postgres',        // Replace with your username
  host: 'localhost',     // Host is localhost for local development
  database: 'tweeter',      // Replace with your database name
  password: 'Gtx1080',// Replace with your password
  port: 5432,            // Default PostgreSQL port
});

(async () => {
  try {
    // Connect to the database
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Run a query
    const res = await client.query('SELECT NOW() AS current_time');
    console.log('Query Result:', res.rows);

    // Close the connection
    await client.end();
    console.log('Disconnected');
  } catch (err) {
    console.error('Error:', err.stack);
  }
})();
