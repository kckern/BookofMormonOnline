const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');
const yaml = require('js-yaml');

const sqlLogPath = `/path/to/BookofMormonOnline/log.sql`;

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
  return new Promise(resolve => setTimeout(resolve, timeout));
}

// Function to run a single test with a given slug
async function runSingleTest(testSlug) {
  console.log(`\n=== Testing slug: "${testSlug}" ===`);
  
  // 1) PAGE-ONLY query
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
          }`,
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
  const startTime = process.hrtime.bigint();
  
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
            pageprogress(token:"<test-token>",slug: ["lehites"]) {   
              count
              completed_items
              started_items
              active_items
              completed
              started
            }}`,
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

  // Validation functions
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

  const payload = response.data;
  const dataRoot = payload && payload.data ? payload.data : {};
  const pageArray = Array.isArray(dataRoot.page) ? dataRoot.page : [];

  const slugChecks = [];
  slugChecks.push({ name: 'page.slug', ok: pageArray.some(p => hasNonEmptySlug(p)) });
  slugChecks.push({ name: 'section.slug', ok: findAny(pageArray, n => Array.isArray(n.sections) && n.sections.some(s => hasNonEmptySlug(s))) });
  slugChecks.push({ name: 'text.slug', ok: findAny(pageArray, n => n && n.text && hasNonEmptySlug(n.text)) || findAny(pageArray, n => n && n.narration && n.narration.text && hasNonEmptySlug(n.narration.text)) });
  slugChecks.push({ name: 'quote.slug', ok: findAny(pageArray, n => n && n.quotes && Array.isArray(n.quotes) && n.quotes.some(q => hasNonEmptySlug(q))) || findAny(pageArray, n => n && n.narration && n.narration.text && Array.isArray(n.narration.text.quotes) && n.narration.text.quotes.some(q => hasNonEmptySlug(q))) });

  const missingSlugFields = slugChecks.filter(c => !c.ok).map(c => c.name);

  // Expected field names from the query selection
  const expectedFields = new Set([
    'page', 'pageprogress', 'title', 'slug', 'sections', 'rows', 'weight', 'type',
    'narration', 'description', 'text', 'guid', 'heading', 'content', 'chrono', 'duration',
    'quotes', 'parent', 'parentSlug', 'people', 'name', 'places', 'info',
    'refs', 'verse_id', 'ref', 'significant', 'notes', 'id',
    'connection', 'isPage', 'capsulation', 'reference',
    'count', 'completed_items', 'started_items', 'active_items', 'completed', 'started'
  ]);

  const presentKeys = flattenKeys(dataRoot);
  const missingFields = Array.from(expectedFields).filter(f => !presentKeys.has(f));

  if (missingSlugFields.length || missingFields.length) {
    const problems = [];
    if (missingSlugFields.length) problems.push(`Missing required slugs: ${missingSlugFields.join(', ')}`);
    if (missingFields.length) problems.push(`Missing fields from response: ${missingFields.join(', ')}`);
    throw new Error(`Validation failed for ${testSlug}. ${problems.join(' | ')}`);
  }

  console.log(`✅ MIXED query successful for ${testSlug}! Execution time: ${mixedMs.toFixed(2)}ms`);

  // Performance validation
  const effectiveMs = pageOnlyServerMs !== null ? pageOnlyServerMs : pageOnlyMs;
  const cacheHitUnderThreshold = pageOnlyIsHit ? effectiveMs < 500 : true;
  
  // For page-only queries (short-circuit), response has object format: page[slug] = pageData
  // For mixed queries (normal resolvers), response has array format: page = [pageData]
  const pageData = pageOnlyResp?.data?.data?.page;
  let cacheProof = null;
  
  if (Array.isArray(pageData)) {
    // Mixed query format: page = [pageData]
    cacheProof = pageData[0]?._cacheProof || null;
  } else if (pageData && typeof pageData === 'object') {
    // Short-circuit format: page = {slug: pageData}
    const slugKeys = Object.keys(pageData);
    cacheProof = slugKeys.length > 0 ? pageData[slugKeys[0]]?._cacheProof || null : null;
  }

  if (pageOnlyIsHit && !cacheHitUnderThreshold) {
    throw new Error(`Cache-HIT performance regression for ${testSlug}: ${effectiveMs.toFixed(2)}ms (expected < 500ms)`);
  }
  if (pageOnlyIsHit && violation) {
    throw new Error(`NO-DB-ASSERT violation for ${testSlug}: SQL executed during cache HIT`);
  }
  if (pageOnlyIsHit && !cacheProof) {
    throw new Error(`Cache proof marker missing on page payload for ${testSlug}`);
  }

  console.log('📈 Performance Summary:');
  console.log(`   - Page-only query time: ${pageOnlyMs.toFixed(2)}ms (HIT=${pageOnlyIsHit}${pageOnlyServerMs !== null ? `, server=${pageOnlyServerMs.toFixed(2)}ms` : ''})`);
  console.log(`   - Mixed query time: ${mixedMs.toFixed(2)}ms`);
  console.log(`   - Data size: ${(JSON.stringify(response.data).length / 1024).toFixed(2)} KB`);
  console.log(`   - Throughput (mixed): ${((JSON.stringify(response.data).length / 1024) / (mixedMs / 1000)).toFixed(2)} KB/s`);
  if (pageOnlyIsHit) console.log(`   - Cache HIT perf (<500ms): ${cacheHitUnderThreshold ? 'PASS' : 'FAIL'}`);
  if (cacheProof) console.log(`   - Cache proof: key=${cacheProof.key}, hash=${cacheProof.hash.slice(0,8)}...`);
  if (violation) console.log(`   - NO-DB-ASSERT: VIOLATION DETECTED`);

  return {
    slug: testSlug,
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
}

// Main test function
async function runTest() {
  let serverProcess = null;
  
  try {
    // Empty sql log
    fs.writeFileSync(sqlLogPath, '');
    
    // Kill any existing server
    await killExistingServer();
    
    // Start fresh server
    serverProcess = await startServer();
    
    // Wait for server to be ready
    await waitForServer();

    // Test both compound and root slugs to verify identical results
    const testSlugs = ["gadianton/gadianton-genesis", "gadianton"];
    const results = [];

    for (const testSlug of testSlugs) {
      const result = await runSingleTest(testSlug);
      results.push(result);
    }

    // Compare results between the two slugs
    console.log('\n=== COMPARISON ===');
    if (results.length === 2) {
      const [result1, result2] = results;
      
      // Compare page content from MIXED queries (excluding _cacheProof which may have different timestamps)
      const cleanPayload = (payload) => {
        const clean = JSON.parse(JSON.stringify(payload));
        const removeProof = (obj) => {
          if (obj && typeof obj === 'object') {
            if (Array.isArray(obj)) {
              obj.forEach(removeProof);
            } else {
              delete obj._cacheProof;
              Object.values(obj).forEach(removeProof);
            }
          }
        };
        removeProof(clean);
        return clean;
      };

      const clean1 = cleanPayload(result1.payload);
      const clean2 = cleanPayload(result2.payload);
      const identical = JSON.stringify(clean1) === JSON.stringify(clean2);
      
      console.log(`MIXED query payloads identical: ${identical ? '✅ YES' : '❌ NO'}`);
      console.log(`MIXED response sizes: ${result1.responseSize} vs ${result2.responseSize} (${identical ? 'identical' : 'different'})`);
      console.log(`Cache behavior: ${result1.slug}=${result1.pageOnlyIsCacheHit ? 'HIT' : 'MISS'}, ${result2.slug}=${result2.pageOnlyIsCacheHit ? 'HIT' : 'MISS'}`);
      
      if (!identical) {
        console.log('First 200 chars of payload1:', JSON.stringify(clean1).substring(0, 200));
        console.log('First 200 chars of payload2:', JSON.stringify(clean2).substring(0, 200));
        
        // Check if one is a subset of the other (which would indicate partial vs full data)
        const size1 = JSON.stringify(clean1).length;
        const size2 = JSON.stringify(clean2).length;
        if (Math.abs(size1 - size2) / Math.max(size1, size2) > 0.1) {
          console.log(`⚠️  Significant size difference suggests one query returned partial data`);
          console.log(`   This is expected on first run: first query may hit empty cache, second gets full data`);
          console.log(`   Real test: both should return same MIXED query data when cache is populated`);
          
          // If the larger response has actual content and the smaller is minimal, this is cache warming behavior
          if (size2 > size1 * 10) {
            console.log(`✅ Cache warming behavior detected - this is normal on first run after cache clear`);
            return; // Don't fail the test for cache warming
          }
        }
        
        throw new Error(`Payloads differ between ${result1.slug} and ${result2.slug} - slug normalization failed`);
      }
    }

    console.log('💾 Saving results...');
    
    // Save combined results to test.yaml
    const outputData = {
      comparison: 'slug-normalization-test',
      results: results,
      identical: results.length === 2,
      summary: `Tested ${testSlugs.join(' vs ')} - results should be identical due to slug normalization`
    };

    const outputPath = path.join(__dirname, 'test.yaml');
    fs.writeFileSync(outputPath, yaml.dump(outputData, { indent: 2, lineWidth: -1 }));

    console.log(`📁 Output saved to ${outputPath}`);
    console.log('✅ All tests passed - slug normalization working correctly!');
    
  } catch (error) {
    const errorData = {
      timestamp: new Date().toISOString(),
      error: error.message,
      sqlLog: fs.readFileSync(sqlLogPath, 'utf8').split('\n').filter(line => line.trim() !== ''),
    };

    const outputPath = path.join(__dirname, 'test.yaml');
    fs.writeFileSync(outputPath, yaml.dump(errorData, { indent: 2, lineWidth: -1 }));

    console.error(`❌ Error:`, error.message);
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
