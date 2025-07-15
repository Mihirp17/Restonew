#!/usr/bin/env node

/**
 * Performance Monitoring Script
 * 
 * This script can be used to monitor the server's performance and health.
 * Run it periodically to check if the server is running smoothly.
 */

import http from 'http';

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const HEALTH_ENDPOINT = '/api/health';

function checkServerHealth() {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    const req = http.get(`${SERVER_URL}${HEALTH_ENDPOINT}`, (res) => {
      const duration = Date.now() - startTime;
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          resolve({
            status: res.statusCode,
            duration,
            response,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });
    
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

async function monitorPerformance() {
  console.log(`[${new Date().toISOString()}] Starting performance check...`);
  
  try {
    const result = await checkServerHealth();
    
    console.log(`[${result.timestamp}] Server Health Check:`);
    console.log(`  Status: ${result.status}`);
    console.log(`  Response Time: ${result.duration}ms`);
    console.log(`  Environment: ${result.response.environment || 'unknown'}`);
    console.log(`  Message: ${result.response.message}`);
    
    // Alert if response time is too high
    if (result.duration > 1000) {
      console.warn(`  ⚠️  WARNING: High response time (${result.duration}ms)`);
    }
    
    // Alert if server is not healthy
    if (result.status !== 200) {
      console.error(`  ❌ ERROR: Server returned status ${result.status}`);
    }
    
    console.log('  ✅ Server is healthy\n');
    
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ❌ Health check failed: ${error.message}\n`);
  }
}

// Run the check
monitorPerformance();

// If run with --watch flag, run continuously
if (process.argv.includes('--watch')) {
  const interval = parseInt(process.argv[process.argv.indexOf('--watch') + 1]) || 30000; // Default 30 seconds
  
  console.log(`Starting continuous monitoring (checking every ${interval/1000} seconds)...`);
  
  setInterval(monitorPerformance, interval);
}