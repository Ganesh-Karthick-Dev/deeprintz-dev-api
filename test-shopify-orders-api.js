#!/usr/bin/env node

/**
 * Test Shopify Orders API
 * Verify that getAllStoreOrders can filter and return Shopify orders
 */

const axios = require('axios');

const API_URL = 'http://localhost:6969/api/deeprintz/dev';

async function testShopifyOrders() {
  console.log('🧪 TESTING SHOPIFY ORDERS API');
  console.log('='.repeat(80));
  console.log('');

  try {
    // Test 1: Get ALL store orders
    console.log('1️⃣ Testing: Get ALL store orders');
    console.log('   GET /getAllStoreOrders');
    
    const allOrdersResponse = await axios.post(`${API_URL}/getAllStoreOrders`, null, {
      params: {
        page: 1,
        limit: 10
      }
    });
    
    console.log(`   ✅ Status: ${allOrdersResponse.status}`);
    console.log(`   📊 Total orders: ${allOrdersResponse.data.pagination.total}`);
    console.log(`   📦 Orders returned: ${allOrdersResponse.data.data.length}`);
    
    if (allOrdersResponse.data.data.length > 0) {
      const order = allOrdersResponse.data.data[0];
      console.log(`   📋 Sample order: ${order.order_number} (${order.order_source || 'unknown source'})`);
    }
    console.log('');

    // Test 2: Get ONLY Shopify orders
    console.log('2️⃣ Testing: Get ONLY Shopify orders');
    console.log('   GET /getAllStoreOrders?order_source=shopify');
    
    const shopifyOrdersResponse = await axios.post(`${API_URL}/getAllStoreOrders`, null, {
      params: {
        page: 1,
        limit: 10,
        order_source: 'shopify' // Filter for Shopify orders only
      }
    });
    
    console.log(`   ✅ Status: ${shopifyOrdersResponse.status}`);
    console.log(`   📊 Total Shopify orders: ${shopifyOrdersResponse.data.pagination.total}`);
    console.log(`   📦 Orders returned: ${shopifyOrdersResponse.data.data.length}`);
    console.log('');

    if (shopifyOrdersResponse.data.data.length > 0) {
      console.log('   📋 SHOPIFY ORDERS:');
      shopifyOrdersResponse.data.data.forEach((order, i) => {
        console.log(`      ${i + 1}. Order: ${order.order_number}`);
        console.log(`         Source: ${order.order_source}`);
        console.log(`         Shop: ${order.shopify_domain || order.shopify_store_name || 'N/A'}`);
        console.log(`         Customer: ${order.customer_email}`);
        console.log(`         Total: ₹${order.total}`);
        console.log(`         Status: ${order.status}`);
        console.log(`         Date: ${new Date(order.date_created).toLocaleString()}`);
        console.log('');
      });
    } else {
      console.log('   ⚠️ No Shopify orders found!');
      console.log('   💡 This means no orders were placed yet, or webhooks are not working');
    }

    // Test 3: Get WooCommerce orders only
    console.log('3️⃣ Testing: Get ONLY WooCommerce orders');
    console.log('   GET /getAllStoreOrders?order_source=woocommerce');
    
    const wooOrdersResponse = await axios.post(`${API_URL}/getAllStoreOrders`, null, {
      params: {
        page: 1,
        limit: 10,
        order_source: 'woocommerce'
      }
    });
    
    console.log(`   ✅ Status: ${wooOrdersResponse.status}`);
    console.log(`   📊 Total WooCommerce orders: ${wooOrdersResponse.data.pagination.total}`);
    console.log(`   📦 Orders returned: ${wooOrdersResponse.data.data.length}`);
    console.log('');

    // Summary
    console.log('='.repeat(80));
    console.log('📊 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Total orders: ${allOrdersResponse.data.pagination.total}`);
    console.log(`Shopify orders: ${shopifyOrdersResponse.data.pagination.total}`);
    console.log(`WooCommerce orders: ${wooOrdersResponse.data.pagination.total}`);
    console.log('');
    
    if (shopifyOrdersResponse.data.pagination.total > 0) {
      console.log('✅ SUCCESS! Shopify orders are being stored and can be retrieved!');
    } else {
      console.log('⚠️ No Shopify orders found. Try placing an order on your Shopify store.');
    }
    console.log('');

    console.log('🔗 API Endpoint for Frontend:');
    console.log(`   POST ${API_URL}/getAllStoreOrders`);
    console.log('   Params: { order_source: "shopify", page: 1, limit: 50 }');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    
    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', JSON.stringify(error.response.data, null, 2));
    }
    
    console.error('');
    process.exit(1);
  }
}

testShopifyOrders();


