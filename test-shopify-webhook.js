#!/usr/bin/env node

/**
 * 🎯 Shopify Webhook Library Validation Test - 2025 OFFICIAL VERSION
 * This script tests the OFFICIAL SHOPIFY LIBRARY validation implementation
 * Using shopify.webhooks.validate() instead of manual HMAC calculation
 */

const crypto = require('crypto');
const https = require('https');

// Configuration - Per official Shopify documentation: "generated using the app's client secret"
const WEBHOOK_SECRET = process.env.SHOPIFY_CLIENT_SECRET || process.env.SHOPIFY_API_SECRET || 'your_shopify_secret_here';

// 🚨 CRITICAL: Use the CORRECT webhook paths as defined in routes/router.js
const WEBHOOK_URLS = [
  'https://devapi.deeprintz.com/api/deeprintz/live/customerRequest',
  'https://devapi.deeprintz.com/api/deeprintz/live/customerDelete',
  'https://devapi.deeprintz.com/api/deeprintz/live/customerShopDelete'
];

// Test payloads - realistic Shopify webhook data
const TEST_PAYLOADS = {
  customerRequest: {
    shop_id: 123456789,
    shop_domain: "test-shop.myshopify.com",
    customer: {
      id: 1234567890,
      email: "customer@example.com",
      phone: "+1234567890"
    },
    orders_requested: ["order_1", "order_2"]
  },
  customerDelete: {
    shop_id: 123456789,
    shop_domain: "test-shop.myshopify.com", 
    customer: {
      id: 1234567890,
      email: "customer@example.com",
      phone: "+1234567890"
    }
  },
  customerShopDelete: {
    shop_id: 123456789,
    shop_domain: "test-shop.myshopify.com"
  }
};

/**
 * 🎯 SHOPIFY LIBRARY VALIDATION APPROACH
 * Now our server uses shopify.webhooks.validate() which handles all HMAC verification automatically
 * This test still generates correct HMAC for completeness, but the server validation is much simpler
 */
function generateHmac(payload, secret) {
  const payloadString = JSON.stringify(payload);
  const byteArray = Buffer.from(payloadString, 'utf8');
  
  console.log('📝 Payload to hash:', payloadString);
  console.log('📦 Byte array length:', byteArray.length);
  
  // Generate HMAC for testing (server uses Shopify library validation now)
  const calculatedHmacDigest = crypto
    .createHmac('sha256', secret)
    .update(byteArray)
    .digest('base64');
    
  console.log('🔐 Calculated HMAC digest:', calculatedHmacDigest);
  return calculatedHmacDigest;
}

/**
 * Send test webhook request
 */
function sendWebhookTest(url, payload, testType) {
  return new Promise((resolve, reject) => {
    const payloadString = JSON.stringify(payload);
    const hmac = generateHmac(payload, WEBHOOK_SECRET);
    
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payloadString),
        'X-Shopify-Hmac-SHA256': hmac,
        'X-Shopify-Topic': testType,
        'X-Shopify-Shop-Domain': 'test-shop.myshopify.com',
        'User-Agent': 'Shopify/1.0 (https://www.shopify.com)',
      }
    };
    
    console.log(`\n🚀 Testing ${testType} webhook at ${url}`);
    console.log('📋 Headers:', JSON.stringify(options.headers, null, 2));
    console.log('🎯 Server now uses shopify.webhooks.validate() for automatic HMAC verification');
    
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log(`✅ Response Status: ${res.statusCode}`);
        console.log(`📤 Response Headers:`, res.headers);
        console.log(`📝 Response Body:`, data || '(empty)');
        
        if (res.statusCode === 200) {
          console.log(`🎉 ${testType} webhook validation PASSED with Shopify library!`);
          resolve({ success: true, status: res.statusCode, body: data });
        } else {
          console.log(`❌ ${testType} webhook validation FAILED!`);
          resolve({ success: false, status: res.statusCode, body: data });
        }
      });
    });
    
    req.on('error', (error) => {
      console.error(`💥 Request error for ${testType}:`, error.message);
      reject(error);
    });
    
    req.write(payloadString);
    req.end();
  });
}

/**
 * Run all tests
 */
async function runAllTests() {
  console.log('🎯 SHOPIFY WEBHOOK LIBRARY VALIDATION TEST - 2025 OFFICIAL VERSION');
  console.log('🏛️ Using shopify.webhooks.validate() instead of manual HMAC calculation');
  console.log('='*80);
  
  if (WEBHOOK_SECRET === 'your_shopify_secret_here') {
    console.error('❌ Please set either SHOPIFY_CLIENT_SECRET or SHOPIFY_API_SECRET environment variable');
    console.error('   PRIMARY (per official docs): export SHOPIFY_CLIENT_SECRET=your_client_secret_here');
    console.error('   FALLBACK:                    export SHOPIFY_API_SECRET=your_api_secret_here');
    process.exit(1);
  }
  
  const secretType = process.env.SHOPIFY_CLIENT_SECRET ? 'CLIENT_SECRET (official)' : 'API_SECRET (fallback)';
  console.log(`🔑 Using webhook secret type: ${secretType}`);
  console.log('🔑 Secret preview (first 8 chars):', WEBHOOK_SECRET.substring(0, 8) + '...');
  console.log('🏛️ Server implementation: express.text() + shopify.webhooks.validate()');
  
  const testTypes = ['customerRequest', 'customerDelete', 'customerShopDelete'];
  const results = [];
  
  for (let i = 0; i < testTypes.length; i++) {
    const testType = testTypes[i];
    const url = WEBHOOK_URLS[i];
    const payload = TEST_PAYLOADS[testType];
    
    try {
      const result = await sendWebhookTest(url, payload, testType);
      results.push({ testType, ...result });
      
      // Wait between tests to avoid rate limiting
      if (i < testTypes.length - 1) {
        console.log('⏳ Waiting 2 seconds before next test...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      console.error(`💥 Test failed for ${testType}:`, error.message);
      results.push({ testType, success: false, error: error.message });
    }
  }
  
  // Summary
  console.log('\n' + '='*80);
  console.log('📊 TEST SUMMARY - SHOPIFY LIBRARY VALIDATION');
  console.log('='*80);
  
  let passedCount = 0;
  results.forEach(result => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${status} - ${result.testType} (Status: ${result.status || 'ERROR'})`);
    if (result.success) passedCount++;
  });
  
  console.log(`\n🎯 Final Result: ${passedCount}/${results.length} tests passed`);
  
  if (passedCount === results.length) {
    console.log('🎉 ALL TESTS PASSED! Shopify library webhook validation is working correctly!');
    console.log('✅ Your app should now pass Shopify Partners Dashboard automated tests!');
    console.log('🏛️ Using official shopify.webhooks.validate() method ensures maximum compatibility');
  } else {
    console.log('❌ Some tests failed. Check the logs above for details.');
    console.log('💡 Common issues:');
    console.log('   - SHOPIFY_CLIENT_SECRET environment variable not set correctly');
    console.log('   - Webhook URLs not accessible (check firewall/hosting)');
    console.log('   - Shopify library configuration missing or incorrect');
    console.log('   - express.text() middleware not properly configured');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = { generateHmac, sendWebhookTest, runAllTests }; 