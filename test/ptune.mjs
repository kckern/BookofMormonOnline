import axios from 'axios';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

// Register ts-node to handle TypeScript imports
import { register } from 'ts-node';
register({
    transpileOnly: true,
    compilerOptions: {
        module: 'commonjs'
    }
});

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { sequelize } = require('../src/config/database.ts');
import { QueryTypes as SQLQueryTypes } from 'sequelize';
const queryDB = async (sql, params = []) => {
    try {
        const results = await sequelize.query(sql, {
            replacements: params,
            type: SQLQueryTypes.SELECT
        });
        return results;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
}


const logPath = `/Users/kckern/Documents/GitHub/BookofMormonOnline/log.sql`;
const resultsPath = `/Users/kckern/Documents/GitHub/BookofMormonOnline/test/results.md`;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results object to collect all data
const testResults = {
    timestamp: new Date().toISOString(),
    database: {},
    queries: {},
    server: {},
    errors: []
};

(async () => {
    let serverProcess = null;
    let serverOutput = {
        stdout: [],
        stderr: []
    };
    
    try {
        //clear log

        fs.writeFileSync(logPath, '', 'utf8');

        console.log('Starting server with ts-node...');
        
        // Start the server process
        serverProcess = spawn('npx', ['ts-node', 'src/index.ts'], {
            cwd: join(__dirname, '..'),
            stdio: ['pipe', 'pipe', 'pipe'],
            detached: false
        });
        
        testResults.server.pid = serverProcess.pid;
        testResults.server.startTime = Date.now();
        
        // Handle server output - capture and optionally display
        serverProcess.stdout.on('data', (data) => {
            const output = data.toString();
            serverOutput.stdout.push(output);
        });
        
        serverProcess.stderr.on('data', (data) => {
            const output = data.toString();
            serverOutput.stderr.push(output);
        });
        
        // Wait for server to be ready (assuming it starts on port 5005)
        await waitForServer('http://localhost:5005', 30000);
        testResults.server.readyTime = Date.now() - testResults.server.startTime;

        // check database connection and performance
        
        // 1. Check current connection count
        const processlist = await queryDB(`SELECT * FROM information_schema.processlist WHERE COMMAND != 'Sleep'`);
        testResults.database.activeConnections = processlist.length;
        
        // 2. Check MySQL configuration for query limits
        const mysqlConfig = await queryDB(`
          SHOW VARIABLES WHERE Variable_name IN (
            'max_connections', 'max_execution_time', 'innodb_buffer_pool_size', 
            'innodb_log_file_size', 'query_cache_size', 'tmp_table_size', 
            'max_heap_table_size', 'join_buffer_size', 'sort_buffer_size',
            'innodb_lock_wait_timeout', 'wait_timeout', 'interactive_timeout'
          )
        `);
        testResults.database.config = mysqlConfig.reduce((acc, config) => {
            acc[config.Variable_name] = config.Value;
            return acc;
        }, {});
        
        // 3. Check database size and table stats
        const tableStats = await queryDB(`
          SELECT 
            table_name,
            table_rows,
            ROUND(((data_length + index_length) / 1024 / 1024), 2) AS size_mb
          FROM information_schema.tables 
          WHERE table_schema = DATABASE() 
          AND table_name LIKE 'bom_%' 
          ORDER BY size_mb DESC 
          LIMIT 10
        `);
        testResults.database.largestTables = tableStats;
        
        // 4. Check if there are any long-running queries
        const longQueries = await queryDB(`
          SELECT id, user, host, db, command, time, state, info 
          FROM information_schema.processlist 
          WHERE time > 5 AND command != 'Sleep'
          ORDER BY time DESC
        `);
        testResults.database.longRunningQueries = longQueries.length;
        
        // 5. Check for table locks
        const tableLocks = await queryDB(`SHOW OPEN TABLES WHERE In_use > 0`);
        testResults.database.lockedTables = tableLocks.length;

        // Simple GraphQL query first to test server responsiveness
        const simpleQuery = JSON.stringify({
            query: `{
                page(slug: ["jacobs-sermon"]) {
                    title
                    slug
                }
            }`,
            variables: {}
        });

        const simpleConfig = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'http://localhost:5005/dev',
            headers: { 
                'Content-Type': 'application/json'
            },
            data: simpleQuery,
            timeout: 10000
        };

        try {
            const startTime = Date.now();
            const simpleResponse = await axios.request(simpleConfig);
            const endTime = Date.now();
            testResults.queries.simple = {
                duration: endTime - startTime,
                success: true,
                data: simpleResponse.data
            };
        } catch (simpleError) {
            testResults.queries.simple = {
                duration: null,
                success: false,
                error: simpleError.message
            };
            testResults.errors.push({
                type: 'Simple Query',
                message: simpleError.message
            });
        }

        // Prepare complex GraphQL query
        const data = JSON.stringify({
            query: `{
                page(slug: ["jacobs-sermon"]) {
                    title
                    slug
                    sections {
                        title
                        slug
                        rows {
                            weight
                            type
                            narration {
                                description
                                text {
                                    guid
                                    slug
                                    heading
                                    duration
                                    content
                                    chrono
                                    quotes {
                                        parent
                                        parentSlug
                                        slug
                                        heading
                                        duration
                                        content
                                    }
                                    people {
                                        slug
                                        name
                                        title
                                    }
                                    places {
                                        slug
                                        name
                                        info
                                    }
                                }
                            }
                            connection {
                                isPage
                                type
                                text
                                slug
                            }
                            capsulation {
                                description
                                reference
                                slug
                            }
                        }
                    }
                }
            }`,
            variables: {}
        });

        const config = {
            method: 'post',
            maxBodyLength: Infinity,
            url: 'http://localhost:5005/dev',
            headers: { 
                'Content-Type': 'application/json'
            },
            data: data
        };

        const startTime = Date.now();
        
        try {
            const response = await axios.request({
                ...config,
                timeout: 45000  // 45 second timeout
            });
            
            const endTime = Date.now();
            const queryTime = endTime - startTime;
            
            testResults.queries.complex = {
                duration: queryTime,
                success: true,
                data: response.data
            };
        } catch (queryError) {
            const endTime = Date.now();
            const queryTime = endTime - startTime;
            
            testResults.queries.complex = {
                duration: queryTime,
                success: false,
                error: queryError.message,
                httpStatus: queryError.response?.status,
                responseData: queryError.response?.data
            };
            
            testResults.errors.push({
                type: 'Complex Query',
                message: queryError.message,
                duration: queryTime
            });
            
            // Check if there are any queries still running after our timeout
            const postQueryProcesslist = await queryDB(`
                SELECT id, user, host, db, command, time, state, LEFT(info, 100) as query_preview 
                FROM information_schema.processlist 
                WHERE command != 'Sleep' 
                ORDER BY time DESC
            `);
            testResults.database.postQueryActiveQueries = postQueryProcesslist;
        }

        // Read SQL log
        testResults.server.sqlLog = fs.readFileSync(logPath, 'utf8');

    } catch (error) {
        testResults.errors.push({
            type: 'General Error',
            message: error.message,
            response: error.response ? {
                status: error.response.status,
                data: error.response.data
            } : null
        });
    } finally {
        // Kill the server process
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGTERM');
            
            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (!serverProcess.killed) {
                    serverProcess.kill('SIGKILL');
                }
            }, 5000);
        }
        
        // Capture server output
        testResults.server.output = {
            stdout: serverOutput.stdout.join(''),
            stderr: serverOutput.stderr.join('')
        };
        
        // Generate markdown report
        generateMarkdownReport();

        //kill server
        if (serverProcess && !serverProcess.killed) {
            serverProcess.kill('SIGTERM');

            // Force kill after 5 seconds if still running
            setTimeout(() => {
                if (!serverProcess.killed) {
                    serverProcess.kill('SIGKILL');
                }
            }, 5000);
        }

    }
})();

// Function to generate markdown report
function generateMarkdownReport() {
    const report = `# Performance Test Results

**Test Run:** ${new Date(testResults.timestamp).toLocaleString()}

## 📊 Summary

${testResults.errors.length === 0 ? '✅ **All tests passed**' : `❌ **${testResults.errors.length} error(s) occurred**`}

## 🚀 Server Performance

- **Server PID:** ${testResults.server.pid || 'N/A'}
- **Startup Time:** ${testResults.server.readyTime ? `${testResults.server.readyTime}ms` : 'N/A'}

## 🔍 Query Performance

### Simple Query
- **Status:** ${testResults.queries.simple?.success ? '✅ Success' : '❌ Failed'}
- **Duration:** ${testResults.queries.simple?.duration ? `${testResults.queries.simple.duration}ms` : 'N/A'}
${testResults.queries.simple?.error ? `- **Error:** ${testResults.queries.simple.error}` : ''}

### Complex Query
- **Status:** ${testResults.queries.complex?.success ? '✅ Success' : '❌ Failed'}
- **Duration:** ${testResults.queries.complex?.duration ? `${testResults.queries.complex.duration}ms (${(testResults.queries.complex.duration/1000).toFixed(2)}s)` : 'N/A'}
${testResults.queries.complex?.error ? `- **Error:** ${testResults.queries.complex.error}` : ''}
${testResults.queries.complex?.httpStatus ? `- **HTTP Status:** ${testResults.queries.complex.httpStatus}` : ''}

## 🗃️ Database Analysis

### Connection Status
- **Active Connections:** ${testResults.database.activeConnections || 'N/A'}
- **Long-running Queries:** ${testResults.database.longRunningQueries || 0}
- **Locked Tables:** ${testResults.database.lockedTables || 0}

### Database Configuration
${testResults.database.config ? Object.entries(testResults.database.config).map(([key, value]) => `- **${key}:** ${value}`).join('\n') : 'No configuration data available'}

### Largest Tables
${testResults.database.largestTables ? testResults.database.largestTables.map(table => `- **${table.table_name}:** ${table.table_rows} rows, ${table.size_mb} MB`).join('\n') : 'No table data available'}

${testResults.database.postQueryActiveQueries && testResults.database.postQueryActiveQueries.length > 0 ? `
### Post-Query Active Queries
${testResults.database.postQueryActiveQueries.map(query => `- **ID ${query.id}:** ${query.command} (${query.time}s) - ${query.query_preview || 'N/A'}`).join('\n')}
` : ''}

## ❌ Errors

${testResults.errors.length === 0 ? 'No errors occurred during testing.' : testResults.errors.map(error => `
### ${error.type}
- **Message:** ${error.message}
${error.duration ? `- **Duration:** ${error.duration}ms` : ''}
`).join('\n')}

## 📋 SQL Log

${testResults.server.sqlLog ? '```sql\n' + testResults.server.sqlLog + '\n```' : 'No SQL log available'}

## 🖥️ Server Output

### STDOUT
${testResults.server.output?.stdout ? '```\n' + testResults.server.output.stdout + '\n```' : 'No stdout output'}

### STDERR
${testResults.server.output?.stderr ? '```\n' + testResults.server.output.stderr + '\n```' : 'No stderr output'}

---
*Generated by ptune.mjs on ${new Date().toISOString()}*
`;

    fs.writeFileSync(resultsPath, report, 'utf8');
    console.log(`\n📝 Test results written to: ${resultsPath}`);
    
    // Also output a brief summary to console
    console.log('\n🎯 TEST SUMMARY:');
    console.log(`- Server startup: ${testResults.server.readyTime ? `${testResults.server.readyTime}ms` : 'Failed'}`);
    console.log(`- Simple query: ${testResults.queries.simple?.success ? `✅ ${testResults.queries.simple.duration}ms` : '❌ Failed'}`);
    console.log(`- Complex query: ${testResults.queries.complex?.success ? `✅ ${testResults.queries.complex.duration}ms` : '❌ Failed'}`);
    console.log(`- Errors: ${testResults.errors.length}`);
    console.log(`- Active DB connections: ${testResults.database.activeConnections || 'N/A'}`);
}

// Helper function to wait for server to be ready
async function waitForServer(url, timeout = 30000) {
    const startTime = Date.now();
    const checkInterval = 1000; // Check every 1 second
    
    while (Date.now() - startTime < timeout) {
        try {
            // Try to make a simple GraphQL query to check if server is ready
            await axios.post(`${url}/dev`, {
                query: '{ __typename }'
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 5000
            });
            return; // Server is ready
        } catch (error) {
            // Server not ready yet, wait and retry
            await new Promise(resolve => setTimeout(resolve, checkInterval));
        }
    }
    
    throw new Error(`Server did not start within ${timeout}ms`);
}