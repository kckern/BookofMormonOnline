const mysql = require('mysql2/promise');
const yaml = require('js-yaml');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Database configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DB || 'bookofmormon',
  port: process.env.MYSQL_PORT || 3306
};

async function executeSQL(query) {
  let connection;
  
  try {
    // Start timing
    const startTime = process.hrtime.bigint();
    
    // Create connection
    connection = await mysql.createConnection(dbConfig);
    
    // Execute query
    const [rows, fields] = await connection.execute(query);
    
    // Calculate execution time
    const endTime = process.hrtime.bigint();
    const executionTime = Number(endTime - startTime) / 1000000; // Convert to milliseconds
    
    // Output results with execution time as YAML
    const result = {
      executionTime: executionTime,
      rowCount: rows.length,
      data: rows
    };
    
    console.log(yaml.dump(result, { indent: 2, lineWidth: -1 }));
    
  } catch (error) {
    console.error(yaml.dump({
      error: error.message,
      code: error.code,
      sqlState: error.sqlState
    }, { indent: 2 }));
    process.exit(1);
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
    }
  }
}

// Main function
async function main() {
  // Get SQL query from command line arguments
  const sqlQuery = process.argv[2];
  
  if (!sqlQuery) {
    console.error(yaml.dump({
      error: "No SQL query provided",
      usage: "node sql.js \"SHOW TABLES\"",
      examples: [
        "node sql.js \"SHOW TABLES\"",
        "node sql.js \"SELECT * FROM bom_page LIMIT 5\"",
        "node sql.js \"DESCRIBE bom_page\""
      ]
    }, { indent: 2 }));
    process.exit(1);
  }
  
  await executeSQL(sqlQuery);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nQuery interrupted');
  process.exit(0);
});

// Run the script
main().catch((error) => {
  console.error(yaml.dump({
    error: error.message
  }, { indent: 2 }));
  process.exit(1);
});