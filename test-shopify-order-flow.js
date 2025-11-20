#!/usr/bin/env node

/**
 * 🧪 Test Complete Shopify Order Flow
 *
 * This simulates the complete order flow from Shopify to your system
 * Run with: node test-shopify-order-flow.js
 */

const axios = require('axios');
const SHOPIFY_CONFIG = require('./config/shopify');

// Configuration
const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com'
};

// Simulate a Shopify order webhook payload
const mockShopifyOrder = {
  id: 1234567890,
  name: '#1234',
  order_number: 1234,
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  total_price: '1500.00',
  subtotal_price: '1500.00',
  total_tax: '0.00',
  total_shipping_price_set: { shop_money: { amount: '50.00' } },
  currency: 'INR',
  financial_status: 'paid',
  fulfillment_status: 'unfulfilled',
  gateway: 'Cash on Delivery (COD)',
  payment_gateway_names: ['Cash on Delivery (COD)'],
  shipping_address: {
    first_name: 'John',
    last_name: 'Doe',
    address1: '123 Test Street',
    city: 'New Delhi',
    province: 'Delhi',
    zip: '110001',
    country: 'India',
    phone: '+91-9876543210'
  },
  billing_address: {
    first_name: 'John',
    last_name: 'Doe',
    address1: '123 Test Street',
    city: 'New Delhi',
    province: 'Delhi',
    zip: '110001',
    country: 'India',
    phone: '+91-9876543210'
  },
  line_items: [
    {
      id: 987654321,
      product_id: 7526124388419, // Your product ID from console
      variant_id: 123456789,
      sku: 'TEST-001',
      name: 'Mens Round Neck Half Sleeve',
      quantity: 1,
      price: '1500.00',
      grams: 500,
      fulfillment_status: 'unfulfilled'
    }
  ],
  fulfillments: [],
  shipping_lines: [
    {
      title: 'Standard Delivery',
      price: '50.00',
      code: 'STD_DELIVERY'
    }
  ]
};

async function testOrderFlow() {
  console.log('🛒 Testing Complete Shopify Order Flow');
  console.log('='.repeat(50));

  console.log('\n📋 SIMULATED ORDER:');
  console.log(`   Order: ${mockShopifyOrder.name}`);
  console.log(`   Customer: ${mockShopifyOrder.email}`);
  console.log(`   Product: ${mockShopifyOrder.line_items[0].name}`);
  console.log(`   Total: ₹${mockShopifyOrder.total_price}`);
  console.log(`   Status: ${mockShopifyOrder.financial_status} / ${mockShopifyOrder.fulfillment_status}`);
  console.log('');

  // Test 1: Webhook endpoint accessibility
  console.log('📡 Test 1: Webhook Endpoint');
  try {
    const webhookUrl = SHOPIFY_CONFIG.WEBHOOK_URL_ORDERS;
    console.log(`   Testing: ${webhookUrl}`);

    const webhookResponse = await axios.post(webhookUrl, mockShopifyOrder, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Topic': 'orders/create',
        'X-Shopify-Shop-Domain': CONFIG.SHOP_DOMAIN,
        'X-Shopify-Hmac-Sha256': 'test-hmac'
      },
      timeout: 10000
    });

    console.log('✅ Webhook endpoint responded');
    console.log(`   Status: ${webhookResponse.status}`);

  } catch (error) {
    console.log('❌ Webhook endpoint failed');
    console.log(`   Error: ${error.message}`);
    console.log('\n🔧 ISSUE: Webhooks are not reaching your server!');
    console.log('   This means orders placed on Shopify are not being processed.');
    return;
  }

  console.log('\n🎯 EXPECTED FLOW:');
  console.log('='.repeat(20));
  console.log('1. Customer places order on Shopify store');
  console.log('2. Shopify sends "orders/create" webhook to your server');
  console.log('3. Your server receives webhook and processes the order');
  console.log('4. Order data is stored in your database');
  console.log('5. If payment is successful, order is automatically fulfilled');
  console.log('6. You create shipping label through NimbusPost');
  console.log('');

  console.log('📊 WHAT SHOULD HAPPEN IN YOUR DATABASE:');
  console.log('='.repeat(40));
  console.log('• New record in woocommerce_orders table');
  console.log('• Order marked with order_source = "shopify"');
  console.log('• Fulfillment record created automatically');
  console.log('• Order status becomes "fulfilled" in Shopify');
  console.log('');

  console.log('🔍 TO VERIFY IF WORKING:');
  console.log('='.repeat(25));
  console.log('1. Place a real order on your Shopify store');
  console.log('2. Check your database for new orders');
  console.log('3. Check if order status is "fulfilled" in Shopify');
  console.log('4. You should receive the order for shipping via NimbusPost');
  console.log('');

  console.log('🚨 CURRENT ISSUE IDENTIFIED:');
  console.log('='.repeat(30));
  console.log('❌ Webhook URL in shopify.app.toml points to production server');
  console.log('❌ But you\'re using ngrok tunnel for development');
  console.log('❌ Orders are going to wrong endpoint!');
  console.log('');

  console.log('🛠️ SOLUTION:');
  console.log('='.repeat(12));
  console.log('1. ✅ Fixed: Updated webhook URL in shopify.app.toml:');
  console.log('   uri = "https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/live/shopify/webhooks/orders"');
  console.log('');
  console.log('2. Re-register webhooks by running product creation again');
  console.log('3. Test with a real order on Shopify');
  console.log('');
  console.log('4. Also fix the CarrierService callback URL in Shopify Admin');
}

// Run if called directly
if (require.main === module) {
  testOrderFlow().catch(error => {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  });
}

module.exports = { testOrderFlow };
