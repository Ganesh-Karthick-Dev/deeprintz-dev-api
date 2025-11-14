#!/usr/bin/env node

/**
 * Test Script for Split Order Management System
 * 
 * This script tests the new endpoints to ensure they're working correctly.
 * Run this after implementing the split system to verify everything is working.
 */

const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust to your server URL
const TEST_TIMEOUT = 10000; // 10 seconds

// Test data
const testData = {
  websiteOrders: {
    status: 1,
    offset: 0,
    limit: 10,
    all: 0
  },
  storeOrders: {
    vendor_id: 0,
    status: 'any',
    offset: 0,
    limit: 10,
    all: 0
  },
  storeOrderUpdate: {
    order_id: 1, // Adjust to an existing order ID
    status: 'processing',
    note: 'Test status update'
  }
};

// Test functions
async function testWebsiteOrders() {
  console.log('🧪 Testing Website Orders Endpoints...');
  
  try {
    // Test getAllWebsiteOrders
    console.log('  📋 Testing getAllWebsiteOrders...');
    const response = await axios.post(`${BASE_URL}/website-orders/getAllWebsiteOrders`, testData.websiteOrders, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.status) {
      console.log('  ✅ getAllWebsiteOrders: SUCCESS');
      console.log(`     Found ${response.data.response?.length || 0} orders`);
    } else {
      console.log('  ❌ getAllWebsiteOrders: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ getAllWebsiteOrders: ERROR');
    console.log(`     ${error.message}`);
  }
  
  try {
    // Test getWebsiteOrderCounts
    console.log('  📊 Testing getWebsiteOrderCounts...');
    const response = await axios.post(`${BASE_URL}/website-orders/getWebsiteOrderCounts`, {
      all: 0
    }, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.status) {
      console.log('  ✅ getWebsiteOrderCounts: SUCCESS');
      console.log(`     Counts: ${JSON.stringify(response.data.response)}`);
    } else {
      console.log('  ❌ getWebsiteOrderCounts: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ getWebsiteOrderCounts: ERROR');
    console.log(`     ${error.message}`);
  }
}

async function testStoreOrders() {
  console.log('\n🏪 Testing Store Orders Endpoints...');
  
  try {
    // Test getAllStoreOrders
    console.log('  📋 Testing getAllStoreOrders...');
    const response = await axios.post(`${BASE_URL}/store-orders/getAllStoreOrders`, testData.storeOrders, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.success) {
      console.log('  ✅ getAllStoreOrders: SUCCESS');
      console.log(`     Found ${response.data.orders?.length || 0} orders`);
    } else {
      console.log('  ❌ getAllStoreOrders: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ getAllStoreOrders: ERROR');
    console.log(`     ${error.message}`);
  }
  
  try {
    // Test getStoreOrderCounts
    console.log('  📊 Testing getStoreOrderCounts...');
    const response = await axios.post(`${BASE_URL}/store-orders/getStoreOrderCounts`, {
      vendor_id: 0,
      all: 0
    }, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.success) {
      console.log('  ✅ getStoreOrderCounts: SUCCESS');
      console.log(`     Counts: ${JSON.stringify(response.data.counts)}`);
    } else {
      console.log('  ❌ getStoreOrderCounts: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ getStoreOrderCounts: ERROR');
    console.log(`     ${error.message}`);
  }
  
  try {
    // Test updateStoreOrderStatus (only if you have existing orders)
    console.log('  🔄 Testing updateStoreOrderStatus...');
    const response = await axios.post(`${BASE_URL}/store-orders/updateStoreOrderStatus`, testData.storeOrderUpdate, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.success) {
      console.log('  ✅ updateStoreOrderStatus: SUCCESS');
      console.log(`     Updated order ${response.data.order_id} to ${response.data.new_status}`);
    } else {
      console.log('  ❌ updateStoreOrderStatus: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ updateStoreOrderStatus: ERROR');
    console.log(`     ${error.message}`);
  }
}

async function testLegacyEndpoints() {
  console.log('\n🔄 Testing Legacy Endpoints (Backward Compatibility)...');
  
  try {
    // Test legacy getAllOrders
    console.log('  📋 Testing legacy getAllOrders...');
    const response = await axios.post(`${BASE_URL}/getAllOrders`, testData.websiteOrders, {
      timeout: TEST_TIMEOUT,
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.data.status) {
      console.log('  ✅ Legacy getAllOrders: SUCCESS');
      console.log(`     Found ${response.data.response?.length || 0} orders`);
    } else {
      console.log('  ❌ Legacy getAllOrders: FAILED');
      console.log(`     Error: ${response.data.message}`);
    }
  } catch (error) {
    console.log('  ❌ Legacy getAllOrders: ERROR');
    console.log(`     ${error.message}`);
  }
}

async function runAllTests() {
  console.log('🚀 Starting Split Order Management System Tests...\n');
  
  try {
    await testWebsiteOrders();
    await testStoreOrders();
    await testLegacyEndpoints();
    
    console.log('\n🎉 All tests completed!');
    console.log('\n📝 Next Steps:');
    console.log('1. Check the test results above');
    console.log('2. Verify your database migration was successful');
    console.log('3. Test the endpoints with your frontend application');
    console.log('4. Check the documentation at docs/order-management-split-system.md');
    
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure your server is running');
    console.log('2. Check that all routes are properly configured');
    console.log('3. Verify database connection and migrations');
    console.log('4. Check server logs for detailed error messages');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testWebsiteOrders,
  testStoreOrders,
  testLegacyEndpoints,
  runAllTests
};
