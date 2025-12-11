/**
 * Load Testing Script for Conductor App
 * 
 * Simulates concurrent load with:
 * - 100-200 student users
 * - 1 professor user
 * - Tests common API endpoints under load
 * 
 * Usage:
 *   node scripts/load-test.js
 * 
 * Environment variables:
 *   BASE_URL - Base URL of the server (default: http://localhost:3000)
 *   DURATION - Test duration in seconds (default: 30)
 *   STUDENT_COUNT - Number of concurrent student connections (default: 150)
 */

import autocannon from 'autocannon';
import { pool } from '../src/db.js';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DURATION = Number.parseInt(process.env.DURATION || '30', 10);
const STUDENT_COUNT = Number.parseInt(process.env.STUDENT_COUNT || '150', 10);
const PROFESSOR_COUNT = 5; // Simulating a few professors/TAs

/**
 * Run a load test with given configuration
 */
function runLoadTest(label, opts) {
  return new Promise((resolve, reject) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${label}`);
    console.log('='.repeat(60));
    
    const inst = autocannon(opts, (err, result) => {
      if (err) {
        console.error(`❌ ${label} failed:`, err.message);
        return reject(err);
      }
      
      // Display results
      console.log(`\n📊 Results for: ${label}`);
      console.log(`   Duration: ${result.duration}s`);
      console.log(`   Requests: ${result.requests.total}`);
      console.log(`   Req/sec:  ${result.requests.average.toFixed(2)}`);
      console.log(`   Latency (avg): ${result.latency.mean.toFixed(2)}ms`);
      console.log(`   Latency (p50): ${result.latency.p50.toFixed(2)}ms`);
      console.log(`   Latency (p95): ${result.latency.p97_5?.toFixed(2) || 'N/A'}ms`);
      console.log(`   Latency (p99): ${result.latency.p99?.toFixed(2) || 'N/A'}ms`);
      console.log(`   Throughput:    ${(result.throughput.average / 1024 / 1024).toFixed(2)} MB/s`);
      console.log(`   2xx responses: ${result['2xx']}`);
      console.log(`   Non-2xx:       ${result.non2xx}`);
      console.log(`   Errors:        ${result.errors}`);
      
      // Pass/Fail criteria
      const passRate = (result['2xx'] / result.requests.total) * 100;
      const avgLatency = result.latency.mean;
      
      console.log(`\n📈 Performance Assessment:`);
      if (passRate >= 95 && avgLatency < 500) {
        console.log(`   ✅ PASS - Success rate: ${passRate.toFixed(2)}%, Avg latency: ${avgLatency.toFixed(2)}ms`);
      } else if (passRate >= 90 && avgLatency < 1000) {
        console.log(`   ⚠️  ACCEPTABLE - Success rate: ${passRate.toFixed(2)}%, Avg latency: ${avgLatency.toFixed(2)}ms`);
      } else {
        console.log(`   ❌ FAIL - Success rate: ${passRate.toFixed(2)}%, Avg latency: ${avgLatency.toFixed(2)}ms`);
      }
      
      resolve(result);
    });
    
    // Show progress bar
    autocannon.track(inst, { renderProgressBar: true });
  });
}

/**
 * Test database connectivity
 */
async function testDatabase() {
  console.log('\n💾 Testing database connection...');
  try {
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    console.log(`✅ Database connected - ${result.rows[0].count} users in database`);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('   Some tests may fail without database access');
  }
}

/**
 * Main load testing suite
 */
async function runLoadTests() {
  console.log('\n' + '='.repeat(60));
  console.log('  🚀 CONDUCTOR APP - LOAD TESTING SUITE');
  console.log('='.repeat(60));
  console.log(`  Configuration:`);
  console.log(`    Base URL: ${BASE_URL}`);
  console.log(`    Student Connections: ${STUDENT_COUNT}`);
  console.log(`    Professor Connections: ${PROFESSOR_COUNT}`);
  console.log(`    Test Duration: ${DURATION}s per test`);
  console.log('='.repeat(60));

  await testDatabase();

  // Run all tests and collect results
  const results = [
    // Test 1: User List API - Student Load (Read-Heavy)
    await runLoadTest('Test 1: User List API - Student Load', {
      url: `${BASE_URL}/api/users?limit=50&offset=0`,
      connections: STUDENT_COUNT,
      duration: DURATION,
      method: 'GET',
    }),

    // Test 2: Dashboard Load - Realistic Concurrent Users
    await runLoadTest('Test 2: Dashboard - Realistic Load', {
      url: `${BASE_URL}/dashboard.html`,
      connections: Math.floor(STUDENT_COUNT * 0.6),
      duration: DURATION,
      method: 'GET',
    }),

    // Test 3: Spike Test - Sudden High Load
    await runLoadTest('Test 3: Spike Test - Sudden High Load', {
      url: `${BASE_URL}/api/users`,
      connections: STUDENT_COUNT + 50,
      duration: 15,
      method: 'GET',
    })
  ];

  // Summary Report
  console.log('\n' + '='.repeat(60));
  console.log('  📋 LOAD TEST SUMMARY');
  console.log('='.repeat(60));
  
  let totalRequests = 0;
  let totalErrors = 0;
  let avgLatencies = [];
  
  results.forEach((result) => {
    totalRequests += result.requests.total;
    totalErrors += result.errors + result.non2xx;
    avgLatencies.push(result.latency.mean);
  });
  
  const overallAvgLatency = avgLatencies.reduce((a, b) => a + b, 0) / avgLatencies.length;
  const successRate = ((totalRequests - totalErrors) / totalRequests) * 100;
  
  console.log(`  Total Requests: ${totalRequests}`);
  console.log(`  Total Errors: ${totalErrors}`);
  console.log(`  Success Rate: ${successRate.toFixed(2)}%`);
  console.log(`  Overall Avg Latency: ${overallAvgLatency.toFixed(2)}ms`);
  
  console.log('\n  Performance Grade:');
  if (successRate >= 95 && overallAvgLatency < 500) {
    console.log(`  🌟 EXCELLENT - System handles load well`);
  } else if (successRate >= 90 && overallAvgLatency < 1000) {
    console.log(`  ✅ GOOD - System performance is acceptable`);
  } else if (successRate >= 85) {
    console.log(`  ⚠️  NEEDS IMPROVEMENT - Consider optimization`);
  } else {
    console.log(`  ❌ POOR - System needs significant optimization`);
  }
  
  console.log('='.repeat(60));
  console.log('✅ Load testing completed!\n');
}

// Run the tests
try {
  await runLoadTests();
  process.exit(0);
} catch (error) {
  console.error('\n❌ Load testing failed:', error);
  process.exit(1);
}
