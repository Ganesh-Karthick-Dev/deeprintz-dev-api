const axios = require('axios');

// Test if the webhook endpoint is accessible
async function testWebhookAccessibility() {
  const webhookUrl = 'https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/webhooks/orders';
  
  console.log('🧪 Testing webhook endpoint accessibility...\n');
  console.log(`📍 Testing URL: ${webhookUrl}\n`);
  
  try {
    // Test 1: Simple GET request to see if endpoint exists
    console.log('1️⃣ Testing endpoint existence...');
    try {
      const response = await axios.get(webhookUrl);
      console.log('✅ Endpoint exists and responds to GET');
      console.log('📊 Status:', response.status);
      console.log('📊 Response:', response.data);
    } catch (error) {
      if (error.response && error.response.status === 405) {
        console.log('✅ Endpoint exists (Method Not Allowed for GET is expected)');
      } else {
        console.log('❌ Endpoint not accessible:', error.message);
      }
    }
    
    // Test 2: POST request with minimal data
    console.log('\n2️⃣ Testing POST request...');
    const testData = {
      topic: 'order.created',
      resource_id: 12345,
      test: true
    };
    
    const postResponse = await axios.post(webhookUrl, testData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Webhook-Test/1.0'
      },
      timeout: 10000 // 10 second timeout
    });
    
    console.log('✅ POST request successful!');
    console.log('📊 Status:', postResponse.status);
    console.log('📊 Response:', postResponse.data);
    
  } catch (error) {
    console.log('❌ Webhook test failed:');
    
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📊 Data:', error.response.data);
      console.log('📊 Headers:', error.response.headers);
    } else if (error.request) {
      console.log('📊 Request was made but no response received');
      console.log('📊 Error:', error.message);
    } else {
      console.log('📊 Error:', error.message);
    }
  }
  
  // Test 3: Check if server is responding
  console.log('\n3️⃣ Testing server response...');
  try {
    const serverResponse = await axios.get('https://phpstack-1481791-5628315.cloudwaysapps.com/', {
      timeout: 5000
    });
    console.log('✅ Server is responding');
    console.log('📊 Status:', serverResponse.status);
  } catch (error) {
    console.log('❌ Server not responding:', error.message);
  }
}

// Test alternative URLs
async function testAlternativeUrls() {
  console.log('\n🔍 Testing alternative webhook URLs...\n');
  
  const urls = [
    'https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/live/woocommerce/webhooks/orders',
    'https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/webhooks/orders',
    'https://phpstack-1481791-5628315.cloudwaysapps.com/woocommerce/webhooks/orders',
    'https://phpstack-1481791-5628315.cloudwaysapps.com/api/woocommerce/webhooks/orders'
  ];
  
  for (const url of urls) {
    console.log(`📍 Testing: ${url}`);
    try {
      const response = await axios.post(url, { test: true }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000
      });
      console.log(`✅ Working: ${url}`);
      console.log(`📊 Status: ${response.status}`);
    } catch (error) {
      if (error.response) {
        console.log(`❌ Failed (${error.response.status}): ${url}`);
      } else {
        console.log(`❌ Failed: ${url}`);
      }
    }
    console.log('');
  }
}

// Main test function
async function runAllTests() {
  console.log('🚀 Starting webhook accessibility tests...\n');
  
  await testWebhookAccessibility();
  await testAlternativeUrls();
  
  console.log('\n🎯 Test Summary:');
  console.log('• If any URL works: Use that one for your WooCommerce webhook');
  console.log('• If all fail: There\'s a server configuration issue');
  console.log('\n🔧 Common Solutions:');
  console.log('1. Check if your server is running');
  console.log('2. Verify HTTPS is working');
  console.log('3. Check firewall/security settings');
  console.log('4. Ensure the route is properly registered');
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testWebhookAccessibility,
  testAlternativeUrls,
  runAllTests
};
