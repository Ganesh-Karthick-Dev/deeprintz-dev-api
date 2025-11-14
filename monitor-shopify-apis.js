#!/usr/bin/env node

/**
 * 🔍 API Monitoring Script for Shopify Shipping Integration
 * 
 * This script helps you monitor API calls and responses
 * Run with: node monitor-shopify-apis.js
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  logFile: '/tmp/shopify-shipping-api.log',
  monitorInterval: 1000, // Check every 1 second
  maxLogLines: 1000
};

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function createLogFile() {
  try {
    // Create log file if it doesn't exist
    if (!fs.existsSync(CONFIG.logFile)) {
      fs.writeFileSync(CONFIG.logFile, '');
      log('📝 Created API monitoring log file', 'green');
    }
  } catch (error) {
    log(`❌ Error creating log file: ${error.message}`, 'red');
  }
}

function logApiCall(method, url, data, response) {
  try {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      method,
      url,
      requestData: data,
      response: response,
      responseTime: response?.responseTime || 'N/A'
    };
    
    const logLine = `${timestamp} | ${method} ${url} | ${JSON.stringify(logEntry)}\n`;
    fs.appendFileSync(CONFIG.logFile, logLine);
  } catch (error) {
    log(`❌ Error logging API call: ${error.message}`, 'red');
  }
}

function monitorLogFile() {
  try {
    if (!fs.existsSync(CONFIG.logFile)) {
      log('⚠️ Log file not found, creating...', 'yellow');
      createLogFile();
      return;
    }

    const logContent = fs.readFileSync(CONFIG.logFile, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      log('📊 No API calls logged yet', 'yellow');
      return;
    }

    // Show recent API calls
    const recentLines = lines.slice(-10); // Last 10 calls
    log('\n📊 Recent API Calls:', 'blue');
    log('=' .repeat(60), 'blue');
    
    recentLines.forEach((line, index) => {
      try {
        const logEntry = JSON.parse(line.split(' | ')[2]);
        const timestamp = logEntry.timestamp;
        const method = logEntry.method;
        const url = logEntry.url;
        const status = logEntry.response?.success ? '✅' : '❌';
        
        log(`${index + 1}. ${timestamp} | ${method} ${url} ${status}`, 'cyan');
        
        if (logEntry.requestData?.postCode) {
          log(`   📍 Pincode: ${logEntry.requestData.postCode}`, 'yellow');
        }
        
        if (logEntry.response?.rates?.length) {
          log(`   🚚 Shipping options: ${logEntry.response.rates.length}`, 'green');
        }
        
        if (logEntry.responseTime !== 'N/A') {
          log(`   ⏱️ Response time: ${logEntry.responseTime}ms`, 'magenta');
        }
        
      } catch (parseError) {
        log(`   Raw log: ${line}`, 'yellow');
      }
    });

  } catch (error) {
    log(`❌ Error monitoring log file: ${error.message}`, 'red');
  }
}

function showApiStatistics() {
  try {
    if (!fs.existsSync(CONFIG.logFile)) {
      log('📊 No API calls logged yet', 'yellow');
      return;
    }

    const logContent = fs.readFileSync(CONFIG.logFile, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    if (lines.length === 0) {
      log('📊 No API calls logged yet', 'yellow');
      return;
    }

    // Parse and analyze logs
    const apiCalls = [];
    lines.forEach(line => {
      try {
        const logEntry = JSON.parse(line.split(' | ')[2]);
        apiCalls.push(logEntry);
      } catch (error) {
        // Skip malformed entries
      }
    });

    // Calculate statistics
    const totalCalls = apiCalls.length;
    const successfulCalls = apiCalls.filter(call => call.response?.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const avgResponseTime = apiCalls.reduce((sum, call) => {
      return sum + (parseInt(call.responseTime) || 0);
    }, 0) / totalCalls;

    // Group by pincode
    const pincodeStats = {};
    apiCalls.forEach(call => {
      if (call.requestData?.postCode) {
        const pincode = call.requestData.postCode;
        if (!pincodeStats[pincode]) {
          pincodeStats[pincode] = { count: 0, success: 0 };
        }
        pincodeStats[pincode].count++;
        if (call.response?.success) {
          pincodeStats[pincode].success++;
        }
      }
    });

    // Display statistics
    log('\n📊 API Statistics:', 'blue');
    log('=' .repeat(50), 'blue');
    log(`📞 Total API calls: ${totalCalls}`, 'green');
    log(`✅ Successful calls: ${successfulCalls}`, 'green');
    log(`❌ Failed calls: ${failedCalls}`, 'red');
    log(`📈 Success rate: ${((successfulCalls / totalCalls) * 100).toFixed(1)}%`, 'yellow');
    log(`⏱️ Average response time: ${avgResponseTime.toFixed(0)}ms`, 'magenta');

    if (Object.keys(pincodeStats).length > 0) {
      log('\n📍 Pincode Statistics:', 'blue');
      Object.entries(pincodeStats).forEach(([pincode, stats]) => {
        const successRate = ((stats.success / stats.count) * 100).toFixed(1);
        log(`   ${pincode}: ${stats.count} calls, ${successRate}% success`, 'cyan');
      });
    }

  } catch (error) {
    log(`❌ Error calculating statistics: ${error.message}`, 'red');
  }
}

function startMonitoring() {
  log('🔍 Starting API Monitoring for Shopify Shipping Integration', 'blue');
  log('=' .repeat(60), 'blue');
  
  createLogFile();
  
  // Show initial statistics
  showApiStatistics();
  
  // Monitor every second
  const interval = setInterval(() => {
    monitorLogFile();
  }, CONFIG.monitorInterval);
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\n🛑 Stopping API monitoring...', 'yellow');
    clearInterval(interval);
    log('📊 Final Statistics:', 'blue');
    showApiStatistics();
    log('👋 Monitoring stopped', 'green');
    process.exit(0);
  });
  
  log('\n💡 Tips:', 'yellow');
  log('   - API calls will be logged automatically', 'yellow');
  log('   - Press Ctrl+C to stop monitoring', 'yellow');
  log('   - Check your server console for detailed logs', 'yellow');
  log('   - Test APIs using: curl or browser', 'yellow');
}

// Test API endpoints
async function testApiEndpoints() {
  log('\n🧪 Testing API Endpoints:', 'blue');
  
  const testEndpoints = [
    {
      name: 'Main Shipping API',
      url: 'https://devapi.deeprintz.com/api/shopify/shipping/calculate',
      method: 'POST',
      data: {
        postCode: '641603',
        weight: 500,
        orderAmount: 1000,
        paymentMode: 'prepaid',
        userId: '1039'
      }
    },
    {
      name: 'App Proxy API',
      url: 'https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/calculate',
      method: 'GET',
      params: {
        postCode: '641603',
        weight: 500,
        orderAmount: 1000,
        paymentMode: 'prepaid',
        userId: '1039'
      }
    },
    {
      name: 'Script Serving API',
      url: 'https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/script',
      method: 'GET',
      params: {
        userId: '1039',
        shop: 'test.myshopify.com'
      }
    }
  ];

  for (const endpoint of testEndpoints) {
    log(`\n🔍 Testing ${endpoint.name}...`, 'yellow');
    log(`   URL: ${endpoint.url}`, 'cyan');
    
    // Note: This is just showing the test structure
    // Actual testing would require making HTTP requests
    log(`   Method: ${endpoint.method}`, 'cyan');
    if (endpoint.data) {
      log(`   Data: ${JSON.stringify(endpoint.data)}`, 'cyan');
    }
    if (endpoint.params) {
      log(`   Params: ${JSON.stringify(endpoint.params)}`, 'cyan');
    }
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testApiEndpoints();
  } else if (args.includes('--stats')) {
    showApiStatistics();
  } else {
    startMonitoring();
  }
}

module.exports = {
  logApiCall,
  monitorLogFile,
  showApiStatistics,
  testApiEndpoints
};
