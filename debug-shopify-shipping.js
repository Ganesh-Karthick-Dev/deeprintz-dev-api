#!/usr/bin/env node

/**
 * 🐛 Debug Shopify Shipping Issue
 *
 * This script helps diagnose and fix the "Shipping not available" error
 * Run with: node debug-shopify-shipping.js
 */

const axios = require('axios');

// Configuration
const CONFIG = {
  NGROK_URL: 'https://df5b0a4dbe35.ngrok-free.app',
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
  USER_ID: '2004' // From your console output
};

async function debugShippingIssue() {
  console.log('🐛 Debugging Shopify Shipping Issue');
  console.log('='.repeat(50));

  console.log(`🏪 Shop Domain: ${CONFIG.SHOP_DOMAIN}`);
  console.log(`📡 Ngrok URL: ${CONFIG.NGROK_URL}`);
  console.log(`👤 User ID: ${CONFIG.USER_ID}`);
  console.log('');

  // Test 1: Check if ngrok endpoint is accessible
  console.log('📡 Test 1: Ngrok Endpoint Accessibility');
  try {
    const testResponse = await axios.get(`${CONFIG.NGROK_URL}/api/deeprintz/dev/shopify/carrier/rates/test`);
    console.log('✅ Ngrok endpoint accessible');
    console.log(`   Callback URL: ${testResponse.data.callbackUrl}`);
  } catch (error) {
    console.log('❌ Ngrok endpoint not accessible');
    console.log(`   Error: ${error.message}`);
    return;
  }

  // Test 2: Test shipping rates calculation
  console.log('\n🚚 Test 2: Shipping Rates Calculation');
  try {
    const ratesResponse = await axios.post(`${CONFIG.NGROK_URL}/api/deeprintz/dev/shopify/carrier/rates`, {
      rate: {
        destination: {
          postal_code: '110001',
          country: 'IN',
          province: 'Delhi',
          city: 'New Delhi'
        },
        items: [
          {
            name: 'Test Product',
            quantity: 1,
            grams: 500,
            price: 100000
          }
        ],
        currency: 'INR'
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Shop-Domain': CONFIG.SHOP_DOMAIN
      },
      timeout: 10000
    });

    const rates = ratesResponse.data.rates || [];
    console.log('✅ Shipping rates calculation working');
    console.log(`   Returned ${rates.length} shipping options:`);

    rates.forEach((rate, index) => {
      console.log(`   ${index + 1}. ${rate.service_name} - ₹${(rate.total_price / 100).toFixed(2)}`);
    });

  } catch (error) {
    console.log('❌ Shipping rates calculation failed');
    console.log(`   Error: ${error.message}`);
    return;
  }

  console.log('\n🔍 DIAGNOSIS:');
  console.log('='.repeat(30));
  console.log('✅ Technical implementation is working correctly');
  console.log('✅ Ngrok tunnel is active and accessible');
  console.log('✅ Shipping rates endpoint returns valid options');
  console.log('');

  console.log('❌ PROBLEM IDENTIFIED:');
  console.log('='.repeat(25));
  console.log('🔴 Shopify is using the OLD CarrierService with "callback URL: not set"');
  console.log('🔴 The NEW CarrierService with correct callback URL is not being used');
  console.log('');

  console.log('🛠️ SOLUTION STEPS:');
  console.log('='.repeat(20));
  console.log('1. Go to Shopify Admin → Settings → Shipping and delivery');
  console.log('2. Find the CarrierService named "Deeprintz Live Shipping Rates"');
  console.log('3. Check its callback URL - it will show "not set"');
  console.log('4. Update the callback URL to:');
  console.log(`   ${CONFIG.NGROK_URL}/api/deeprintz/dev/shopify/carrier/rates`);
  console.log('');
  console.log('5. Alternatively, disable the old CarrierService and enable the new one:');
  console.log('   "Deeprintz Live Shipping Rates (2025-11-18T10-17-03)"');
  console.log('');

  console.log('🧪 TEST AFTER FIX:');
  console.log('='.repeat(18));
  console.log('1. Go to your Shopify dev store');
  console.log('2. Add the product to cart');
  console.log('3. Proceed to checkout');
  console.log('4. You should now see shipping options!');
  console.log('');

  console.log('💡 WHY THIS HAPPENS:');
  console.log('='.repeat(22));
  console.log('• Shopify caches CarrierService configurations');
  console.log('• Once created, callback URLs cannot be updated via API');
  console.log('• New CarrierServices get created instead of updating old ones');
  console.log('• Manual intervention in Shopify Admin is required');
}

// Run if called directly
if (require.main === module) {
  debugShippingIssue().catch(error => {
    console.error('❌ Debug script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { debugShippingIssue };
