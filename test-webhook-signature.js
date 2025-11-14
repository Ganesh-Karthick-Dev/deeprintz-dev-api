#!/usr/bin/env node

/**
 * Webhook Signature Verification Test Script
 * 
 * This script helps debug WooCommerce webhook signature verification issues.
 * Use it to test different signature formats and compare with what WooCommerce sends.
 */

const crypto = require('crypto');
const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust to your server URL
const TEST_SECRET = 'Deeprintz@2025'; // Your WooCommerce webhook secret

// Test data (simulate a WooCommerce order)
const testPayload = {
  id: 12345,
  number: "12345",
  status: "processing",
  total: "99.99",
  date_created: "2024-01-15T10:30:00",
  line_items: [
    {
      id: 1,
      name: "Test Product",
      quantity: 2,
      total: "99.99"
    }
  ]
};

// Test different signature formats
function testLocalSignatureGeneration() {
  console.log('🧪 Testing Local Signature Generation...\n');
  
  const payloadString = JSON.stringify(testPayload);
  console.log('📋 Test Payload:', payloadString);
  console.log('📋 Secret:', TEST_SECRET);
  console.log('📋 Payload Length:', payloadString.length);
  
  // Generate signatures in different formats
  const hexSignature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(payloadString)
    .digest('hex');
    
  const base64Signature = crypto
    .createHmac('sha256', TEST_SECRET)
    .update(payloadString)
    .digest('base64');
    
  console.log('\n📋 Generated Signatures:');
  console.log('  Hex:     ', hexSignature);
  console.log('  Base64:  ', base64Signature);
  
  // WooCommerce format (algorithm=signature)
  console.log('\n📋 WooCommerce Format:');
  console.log('  sha256=  ', `sha256=${hexSignature}`);
  console.log('  sha256=  ', `sha256=${base64Signature}`);
  
  return { hexSignature, base64Signature };
}

// Test the API endpoint
async function testAPIEndpoint(hexSignature, base64Signature) {
  console.log('\n🌐 Testing API Endpoint...\n');
  
  try {
    // Test with hex signature
    console.log('📋 Testing with hex signature...');
    const hexResponse = await axios.post(`${BASE_URL}/woocommerce/webhooks/test-signature`, {
      payload: JSON.stringify(testPayload),
      secret: TEST_SECRET,
      signature: hexSignature
    });
    
    if (hexResponse.data.success) {
      console.log('✅ Hex signature test: SUCCESS');
      console.log('   Hex matches:', hexResponse.data.hex_matches);
      console.log('   Base64 matches:', hexResponse.data.base64_matches);
    }
    
    // Test with base64 signature
    console.log('\n📋 Testing with base64 signature...');
    const base64Response = await axios.post(`${BASE_URL}/woocommerce/webhooks/test-signature`, {
      payload: JSON.stringify(testPayload),
      secret: TEST_SECRET,
      signature: base64Signature
    });
    
    if (base64Response.data.success) {
      console.log('✅ Base64 signature test: SUCCESS');
      console.log('   Hex matches:', base64Response.data.hex_matches);
      console.log('   Base64 matches:', base64Response.data.base64_matches);
    }
    
  } catch (error) {
    console.log('❌ API test failed:', error.message);
    if (error.response) {
      console.log('   Response:', error.response.data);
    }
  }
}

// Simulate WooCommerce webhook call
async function simulateWooCommerceWebhook(hexSignature, base64Signature) {
  console.log('\n🔄 Simulating WooCommerce Webhook Call...\n');
  
  try {
    // Test with hex signature (WooCommerce format)
    console.log('📋 Simulating webhook with hex signature...');
    const hexWebhookResponse = await axios.post(`${BASE_URL}/woocommerce/webhooks/orders`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-wc-webhook-signature': `sha256=${hexSignature}`,
        'x-wc-webhook-topic': 'order.created'
      }
    });
    
    if (hexWebhookResponse.status === 200) {
      console.log('✅ Hex webhook simulation: SUCCESS');
      console.log('   Response:', hexWebhookResponse.data);
    }
    
    // Test with base64 signature (WooCommerce format)
    console.log('\n📋 Simulating webhook with base64 signature...');
    const base64WebhookResponse = await axios.post(`${BASE_URL}/woocommerce/webhooks/orders`, testPayload, {
      headers: {
        'Content-Type': 'application/json',
        'x-wc-webhook-signature': `sha64=${base64Signature}`,
        'x-wc-webhook-topic': 'order.created'
      }
    });
    
    if (base64WebhookResponse.status === 200) {
      console.log('✅ Base64 webhook simulation: SUCCESS');
      console.log('   Response:', base64WebhookResponse.data);
    }
    
  } catch (error) {
    console.log('❌ Webhook simulation failed:', error.message);
    if (error.response) {
      console.log('   Response:', error.response.data);
    }
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting Webhook Signature Verification Tests...\n');
  console.log('📋 Configuration:');
  console.log('   Base URL:', BASE_URL);
  console.log('   Secret:', TEST_SECRET);
  console.log('   Test Payload ID:', testPayload.id);
  
  try {
    // Test 1: Local signature generation
    const signatures = testLocalSignatureGeneration();
    
    // Test 2: API endpoint testing
    await testAPIEndpoint(signatures.hexSignature, signatures.base64Signature);
    
    // Test 3: Webhook simulation
    await simulateWooCommerceWebhook(signatures.hexSignature, signatures.base64Signature);
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Check your server logs for detailed signature verification info');
    console.log('2. Compare the generated signatures with what WooCommerce sends');
    console.log('3. Update your webhook secret if needed');
    console.log('4. Test with a real WooCommerce order');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your server is running');
    console.log('2. Check that the webhook routes are properly configured');
    console.log('3. Verify your database connection');
    console.log('4. Check server logs for detailed error messages');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testLocalSignatureGeneration,
  testAPIEndpoint,
  simulateWooCommerceWebhook,
  runAllTests
};
