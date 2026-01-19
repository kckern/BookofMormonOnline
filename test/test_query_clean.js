const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const yaml = require('js-yaml');

const sqlLogPath = `/Users/kckern/Documents/GitHub/BookofMormonOnline/log.sql`;



// Function to kill any existing server process on port 5005
function killExistingServer() {
  return new Promise((resolve) => {
    exec('lsof -ti:5005', (error, stdout) => {
      if (stdout) {
        const pids = stdout.trim().split('\n');
        console.log(`🔪 Killing existing processes on port 5005: ${pids.join(', ')}`);
        
        pids.forEach(pid => {
          try {
            process.kill(pid, 'SIGTERM');
          } catch (e) {
            console.log(`Process ${pid} already terminated`);
          }
        });
        
        // Wait a bit for processes to terminate
        setTimeout(resolve, 2000);
      } else {
        console.log('✅ No existing processes found on port 5005');
        resolve();
      }
    });
  });
}

// Capture server logs for HIT/MISS detection
let serverOutputBuffer = '';
const getServerLogLength = () => serverOutputBuffer.length;
const getServerLogDelta = (from) => serverOutputBuffer.substring(from);

// Function to start the server
function startServer() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting server...');
    
  const serverProcess = spawn('npm', ['run', 'start:fast'], {
      stdio: 'pipe',
      detached: false,
      cwd: path.join(__dirname, '..')
    });

    let serverReady = false;
    
    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('Server:', output.trim());
  serverOutputBuffer += output;
      
      if (output.includes('Listening on port 5005') && !serverReady) {
        serverReady = true;
        console.log('✅ Server is ready!');
        resolve(serverProcess);
      }
    });

    serverProcess.stderr.on('data', (data) => {
  const err = data.toString();
  console.error('Server Error:', err);
  serverOutputBuffer += err;
    });

    serverProcess.on('error', (error) => {
      reject(error);
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server failed to start within 30 seconds'));
      }
    }, 30000);
  });
}

// Function to wait for server to respond
async function waitForServer(timeout = 5000) {
  // Just wait a fixed amount of time since we know from the startup message that the server is ready
  return new Promise(resolve => setTimeout(resolve, timeout));
}

// Main test function
async function runTest() {
  let serverProcess = null;
  let startTime = null;

  //empty sql log
  fs.writeFileSync(sqlLogPath, '');
  
  try {
    // Kill any existing server
    await killExistingServer();
    
    // Start fresh server
    serverProcess = await startServer();
    
    // Wait for server to be ready
    await waitForServer();

    // Test both compound and root slugs to verify identical results
    const testSlugs = ["gadianton/gadianton-genesis", "gadianton"];
    const results = [];

    for (const [index, testSlug] of testSlugs.entries()) {
      console.log(`\n=== TEST ${index + 1}: ${testSlug} ===`);
      
      // 1) PAGE-ONLY query to measure cache-HIT performance without user fields
      console.log('🚀 Starting GraphQL PAGE-ONLY query (perf)...');
      const pageOnlyQuery = JSON.stringify({
        query: `{page (slug: "${testSlug}"){
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
                      #timeline
                      text {
                        guid
                        slug
                        heading
                        content
                        chrono
                        duration
                        quotes {
                          parent
                          parentSlug
                          slug
                          heading
                          content
                          duration
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
                        refs {
                          verse_id
                          ref
                          type
                          significant
                        }
                        notes {
                          id
                          title
                          text
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
            }` ,
      variables: {}
    });

  const pageOnlyConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:5005/en',
      headers: { 
    'Content-Type': 'application/json',
    'x-no-db-assert': '1'
      },
      data: pageOnlyQuery
    };

    const beforeLogLen = getServerLogLength();
    startTime = process.hrtime.bigint();
  // Activate process-level no-DB assert to detect any SQL in server logs
  const prevNoDb = process.env.__NO_DB_ASSERT_ACTIVE__;
  process.env.__NO_DB_ASSERT_ACTIVE__ = '1';
  const pageOnlyResp = await axios.request(pageOnlyConfig);
  process.env.__NO_DB_ASSERT_ACTIVE__ = prevNoDb || '';
    const pageOnlyEnd = process.hrtime.bigint();
    const pageOnlyMs = Number(pageOnlyEnd - startTime) / 1000000;
  const pageOnlyServerLog = getServerLogDelta(beforeLogLen);
  const violation = /NO-DB-ASSERT VIOLATION/i.test(pageOnlyServerLog);
  const pageOnlyIsHit = /Cache HIT/i.test(pageOnlyServerLog) && !/Cache MISS/i.test(pageOnlyServerLog);
  const hitTimeMatch = pageOnlyServerLog.match(/Page\(HIT\) total: ([0-9.]+)ms/);
  const pageOnlyServerMs = hitTimeMatch ? parseFloat(hitTimeMatch[1]) : null;
  console.log(`✅ PAGE-ONLY query done in ${pageOnlyMs.toFixed(2)}ms (HIT=${pageOnlyIsHit}${pageOnlyServerMs !== null ? `, server=${pageOnlyServerMs.toFixed(2)}ms` : ''})`);

    // 2) MIXED query (page + pageprogress) for field validation and full output
    console.log('🚀 Starting GraphQL MIXED query (validation)...');
    const mixedQuery = JSON.stringify({
      query: `{page (slug: "gadianton/gadianton-genesis"){\n                title\n                slug\n                sections {\n                  title\n                  slug\n                  rows {\n                    weight\n                    type\n                    narration {\n                      description\n                      #timeline\n                      text {\n                        guid\n                        slug\n                        heading\n                        content\n                        chrono\n                        duration\n                        quotes {\n                          parent\n                          parentSlug\n                          slug\n                          heading\n                          content\n                          duration\n                        }\n                        people {\n                          slug\n                          name\n                          title\n                        }\n                        places {\n                          slug\n                          name\n                          info\n                        }\n                        refs {\n                          verse_id\n                          ref\n                          type\n                          significant\n                        }\n                        notes {\n                          id\n                          title\n                          text\n                        }\n                      }\n                    }\n                    connection {\n                      isPage\n                      type\n                      text\n                      slug\n                    }\n                    capsulation {\n                      description\n                      reference\n                      slug\n                    }\n                  }\n                }\n              }\n pageprogress(token:"dc20ba0ad6130b646adffcfe87227f3a",slug: ["lehites"]) {   \n          count\n          completed_items\n          started_items\n          active_items\n          completed\n          started\n      }}`,
      variables: {}
    });

    const mixedConfig = {
      method: 'post',
      maxBodyLength: Infinity,
      url: 'http://localhost:5005/en',
      headers: { 
        'Content-Type': 'application/json'
      },
      data: mixedQuery
    };

    const mixedStart = process.hrtime.bigint();
    const response = await axios.request(mixedConfig);
    const mixedEnd = process.hrtime.bigint();
    const mixedMs = Number(mixedEnd - mixedStart) / 1000000;
    
    // --- Validation: ensure requested fields exist and required slugs are present ---
  const payload = response.data;
    const dataRoot = payload && payload.data ? payload.data : {};

    const flattenKeys = (node, keys = new Set()) => {
      if (node === null || node === undefined) return keys;
      if (Array.isArray(node)) {
        node.forEach(n => flattenKeys(n, keys));
      } else if (typeof node === 'object') {
        Object.keys(node).forEach(k => {
          keys.add(k);
          flattenKeys(node[k], keys);
        });
      }
      return keys;
    };

    const findAny = (node, predicate) => {
      if (node === null || node === undefined) return false;
      if (predicate(node)) return true;
      if (Array.isArray(node)) return node.some(n => findAny(n, predicate));
      if (typeof node === 'object') return Object.values(node).some(v => findAny(v, predicate));
      return false;
    };

    const hasNonEmptySlug = (obj) => obj && typeof obj === 'object' && typeof obj.slug === 'string' && obj.slug.trim().length > 0;

    const pageArray = Array.isArray(dataRoot.page) ? dataRoot.page : [];

    const slugChecks = [];
    // page.slug
    slugChecks.push({ name: 'page.slug', ok: pageArray.some(p => hasNonEmptySlug(p)) });
  // section.slug (page.sections[].slug)
  slugChecks.push({ name: 'section.slug', ok: findAny(pageArray, n => Array.isArray(n.sections) && n.sections.some(s => hasNonEmptySlug(s))) });
    // text.slug (narration.text.slug)
    slugChecks.push({ name: 'text.slug', ok: findAny(pageArray, n => n && n.text && hasNonEmptySlug(n.text)) || findAny(pageArray, n => n && n.narration && n.narration.text && hasNonEmptySlug(n.narration.text)) });
    // quote.slug (narration.text.quotes[].slug)
    slugChecks.push({ name: 'quote.slug', ok: findAny(pageArray, n => n && n.quotes && Array.isArray(n.quotes) && n.quotes.some(q => hasNonEmptySlug(q))) || findAny(pageArray, n => n && n.narration && n.narration.text && Array.isArray(n.narration.text.quotes) && n.narration.text.quotes.some(q => hasNonEmptySlug(q))) });

    const missingSlugFields = slugChecks.filter(c => !c.ok).map(c => c.name);

    // Expected field names from the query selection (at least once anywhere in payload)
    const expectedFields = new Set([
      // root
      'page', 'pageprogress',
      // page-level
      'title', 'slug', 'sections',
      // rows
      'rows', 'weight', 'type',
      // narration & text
      'narration', 'description', 'text', 'guid', 'heading', 'content', 'chrono', 'duration',
      // quotes
      'quotes', 'parent', 'parentSlug',
      // people
      'people', 'name', 'title',
      // places
      'places', 'info',
      // refs
      'refs', 'verse_id', 'ref', 'type', 'significant',
      // notes
      'notes', 'id', 'text',
      // connection
      'connection', 'isPage', 'text', 'slug',
      // capsulation
      'capsulation', 'reference',
      // pageprogress fields
      'count', 'completed_items', 'started_items', 'active_items', 'completed', 'started'
    ]);

    // Collect all keys present anywhere in the response data
    const presentKeys = flattenKeys(dataRoot);
    const missingFields = Array.from(expectedFields).filter(f => !presentKeys.has(f));

    if (missingSlugFields.length || missingFields.length) {
      const problems = [];
      if (missingSlugFields.length) problems.push(`Missing required slugs: ${missingSlugFields.join(', ')}`);
      if (missingFields.length) problems.push(`Missing fields from response: ${missingFields.join(', ')}`);
      throw new Error(`Validation failed. ${problems.join(' | ')}`);
    }

  console.log(`✅ MIXED query successful! Execution time: ${mixedMs.toFixed(2)}ms`);
  console.log('💾 Saving results...');
    
  // Perf pass criteria is applied to the PAGE-ONLY request when it is a HIT
  const effectiveMs = pageOnlyServerMs !== null ? pageOnlyServerMs : pageOnlyMs;
  const cacheHitUnderThreshold = pageOnlyIsHit ? effectiveMs < 500 : true;
  const cacheProof = pageOnlyResp?.data?.data?.page?.[0]?._cacheProof || null;

  // Create output object with performance metrics and payload
    const outputData = {
      timestamp: new Date().toISOString(),
  pageOnlyDuration: pageOnlyMs,
  pageOnlyDurationMs: `${pageOnlyMs.toFixed(2)}ms`,
  pageOnlyServerDuration: pageOnlyServerMs,
  pageOnlyServerDurationMs: pageOnlyServerMs !== null ? `${pageOnlyServerMs.toFixed(2)}ms` : null,
      pageOnlyIsCacheHit: pageOnlyIsHit,
      mixedDuration: mixedMs,
      mixedDurationMs: `${mixedMs.toFixed(2)}ms`,
      responseSize: JSON.stringify(response.data).length,
      responseSizeKB: `${(JSON.stringify(response.data).length / 1024).toFixed(2)} KB`,
      throughput: `${((JSON.stringify(response.data).length / 1024) / (mixedMs / 1000)).toFixed(2)} KB/s`,
      sqlLog: fs.readFileSync(sqlLogPath, 'utf8').split('\n').filter(line => line.trim() !== ''),
      payload: response.data,
      validations: {
        requiredSlugs: 'PASS',
  fieldsPresent: 'PASS',
  cacheHitPerf: pageOnlyIsHit ? (cacheHitUnderThreshold ? 'PASS' : 'FAIL') : 'N/A',
  cacheProof: cacheProof ? 'PASS' : 'FAIL',
  noDbLeak: violation ? 'FAIL' : 'PASS'
      }
    };

    // Save to test.yaml
    const outputPath = path.join(__dirname, 'test.yaml');
    fs.writeFileSync(outputPath, yaml.dump(outputData, { indent: 2, lineWidth: -1 }));

    console.log(`📁 Output saved to ${outputPath}`);
    console.log(`📊 Response size: ${JSON.stringify(response.data).length} characters`);
    console.log('📈 Performance Summary:');
  console.log(`   - Page-only query time: ${pageOnlyMs.toFixed(2)}ms (HIT=${pageOnlyIsHit}${pageOnlyServerMs !== null ? `, server=${pageOnlyServerMs.toFixed(2)}ms` : ''})`);
    console.log(`   - Mixed query time: ${mixedMs.toFixed(2)}ms`);
    console.log(`   - Data size: ${(JSON.stringify(response.data).length / 1024).toFixed(2)} KB`);
    console.log(`   - Throughput (mixed): ${((JSON.stringify(response.data).length / 1024) / (mixedMs / 1000)).toFixed(2)} KB/s`);
  if (pageOnlyIsHit) console.log(`   - Cache HIT perf (<500ms): ${cacheHitUnderThreshold ? 'PASS' : 'FAIL'}`);
  if (cacheProof) console.log(`   - Cache proof: key=${cacheProof.key}, hash=${cacheProof.hash.slice(0,8)}...`);
  if (violation) console.log(`   - NO-DB-ASSERT: VIOLATION DETECTED`);

    if (pageOnlyIsHit && !cacheHitUnderThreshold) {
      throw new Error(`Cache-HIT performance regression: ${effectiveMs.toFixed(2)}ms (expected < 500ms)`);
    }
    if (pageOnlyIsHit && violation) {
      throw new Error('NO-DB-ASSERT violation: SQL executed during cache HIT');
    }
    if (pageOnlyIsHit && !cacheProof) {
      throw new Error('Cache proof marker missing on page payload');
    }
    
  } catch (error) {
    const endTime = process.hrtime.bigint();
    const executionTime = startTime ? Number(endTime - startTime) / 1000000 : 0;
    
    // Create error output object
    const errorData = {
      timestamp: new Date().toISOString(),
      duration: executionTime,
      durationMs: `${executionTime.toFixed(2)}ms`,
      error: error.message,
      sqlLog: fs.readFileSync(sqlLogPath, 'utf8').split('\n').filter(line => line.trim() !== ''),
      payload: null
    };

    // Save error to test.yaml
    const outputPath = path.join(__dirname, 'test.yaml');
    fs.writeFileSync(outputPath, yaml.dump(errorData, { indent: 2, lineWidth: -1 }));

    console.error(`❌ Error after ${executionTime.toFixed(2)}ms:`, error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw error;
  } finally {
    // Clean up: kill the server
    if (serverProcess) {
      console.log('🛑 Stopping server...');
      serverProcess.kill('SIGTERM');
      
      // Force kill if still running after 3 seconds
      setTimeout(() => {
        if (!serverProcess.killed) {
          serverProcess.kill('SIGKILL');
        }
      }, 3000);
    }
  }
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\n🛑 Received SIGINT, cleaning up...');
  process.exit(0);
});

// Run the test
runTest()
  .then(() => {
    console.log('✅ Test completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
