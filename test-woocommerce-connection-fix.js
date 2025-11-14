const axios = require('axios');

// Test the WooCommerce connection endpoint
async function testWooCommerceConnection() {
  try {
    console.log('🧪 Testing WooCommerce connection fix...\n');
    
    const testData = {
      store_url: 'https://example.com',
      consumer_key: 'test_key_123',
      consumer_secret: 'test_secret_456',
      vendor_id: 1
    };
    
    console.log('📤 Sending test request with data:', testData);
    
    const response = await axios.post('http://localhost:3000/api/woocommerce/connect', testData);
    
    console.log('✅ Success! Response:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response received:');
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data.message);
      console.log('   Error:', error.response.data.error);
      
      // Check if the circular reference error is fixed
      if (error.response.data.error && error.response.data.error.includes('circular')) {
        console.log('\n🚨 Circular reference error still exists!');
      } else {
        console.log('\n✅ Circular reference error is fixed!');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Test with invalid URL format
async function testInvalidURL() {
  try {
    console.log('\n🧪 Testing invalid URL handling...\n');
    
    const testData = {
      store_url: 'invalid-url',
      consumer_key: 'test_key_123',
      consumer_secret: 'test_secret_456',
      vendor_id: 1
    };
    
    console.log('📤 Sending test request with invalid URL:', testData.store_url);
    
    const response = await axios.post('http://localhost:3000/api/woocommerce/connect', testData);
    
    console.log('✅ Success! Response:', response.data);
    
  } catch (error) {
    if (error.response) {
      console.log('❌ Error response received:');
      console.log('   Status:', error.response.status);
      console.log('   Message:', error.response.data.message);
      
      if (error.response.status === 400 && error.response.data.message.includes('Invalid store URL format')) {
        console.log('\n✅ URL validation is working correctly!');
      } else {
        console.log('\n❌ URL validation not working as expected');
      }
    } else {
      console.log('❌ Network error:', error.message);
    }
  }
}

// Run tests
async function runTests() {
  console.log('🚀 Starting WooCommerce connection tests...\n');
  
  await testWooCommerceConnection();
  await testInvalidURL();
  
  console.log('\n✨ Tests completed!');
}

// Run if this file is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWooCommerceConnection, testInvalidURL };
