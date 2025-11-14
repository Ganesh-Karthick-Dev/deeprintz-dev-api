const axios = require('axios');

// Test the WooCommerce webhook endpoint
async function testWooCommerceWebhook() {
  try {
    console.log('🧪 Testing WooCommerce webhook endpoint...\n');
    
    // Test the debug route first
    console.log('1️⃣ Testing debug route...');
    try {
      const debugResponse = await axios.get('https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/test');
      console.log('✅ Debug route working:', debugResponse.data);
    } catch (error) {
      console.log('❌ Debug route failed:', error.response?.data || error.message);
    }
    
    console.log('\n2️⃣ Testing webhook endpoint...');
    
    // Test data that mimics a WooCommerce order webhook
    const testWebhookData = {
      topic: 'order.created',
      resource_id: 12345,
      resource_type: 'order',
      id: 12345,
      number: '12345',
      status: 'pending',
      date_created: new Date().toISOString(),
      date_modified: new Date().toISOString(),
      total: '99.99',
      subtotal: '89.99',
      total_tax: '10.00',
      shipping_total: '0.00',
      discount_total: '0.00',
      currency: 'USD',
      customer_id: 678,
      billing: {
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com'
      },
      shipping: {
        first_name: 'John',
        last_name: 'Doe'
      },
      line_items: [
        {
          id: 1,
          name: 'Test Product',
          product_id: 789,
          quantity: 1,
          total: '99.99',
          sku: 'DP-123-TEST'
        }
      ],
      payment_method: 'stripe',
      payment_method_title: 'Credit Card (Stripe)'
    };
    
    // Test the webhook endpoint
    const webhookResponse = await axios.post(
      'https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/webhooks/orders',
      testWebhookData,
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'WooCommerce-Webhook-Test/1.0'
        }
      }
    );
    
    console.log('✅ Webhook endpoint working!');
    console.log('📊 Response:', webhookResponse.data);
    
  } catch (error) {
    console.log('❌ Webhook test failed:');
    if (error.response) {
      console.log('📊 Status:', error.response.status);
      console.log('📊 Data:', error.response.data);
      console.log('📊 Headers:', error.response.headers);
    } else {
      console.log('📊 Error:', error.message);
    }
  }
}

// Test both endpoints
async function testAllEndpoints() {
  console.log('🚀 Starting WooCommerce endpoint tests...\n');
  
  // Test 1: Debug route
  console.log('📍 Test 1: Debug Route');
  console.log('URL: https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/test\n');
  
  // Test 2: Webhook endpoint
  console.log('📍 Test 2: Webhook Endpoint');
  console.log('URL: https://phpstack-1481791-5628315.cloudwaysapps.com/api/deeprintz/dev/woocommerce/webhooks/orders\n');
  
  await testWooCommerceWebhook();
  
  console.log('\n🎯 Test Summary:');
  console.log('• If both tests pass: Your webhook endpoint is working correctly');
  console.log('• If debug route fails: There\'s an issue with route registration');
  console.log('• If webhook route fails: There\'s an issue with the webhook controller');
  console.log('\n🔧 Next Steps:');
  console.log('1. Check your server logs for any errors');
  console.log('2. Verify the database table exists');
  console.log('3. Test with a real WooCommerce webhook');
}

// Run the tests
if (require.main === module) {
  testAllEndpoints();
}

module.exports = {
  testWooCommerceWebhook,
  testAllEndpoints
};
