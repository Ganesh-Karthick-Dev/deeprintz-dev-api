#!/usr/bin/env node

/**
 * 🧪 Test Shopify Carrier Service
 *
 * This script tests the CarrierService functionality for shipping rates
 * Run with: node test-shopify-carrier-service.js
 */

const axios = require('axios');

// Test colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Configuration - Update these for your dev store
const CONFIG = {
  BASE_URL: 'http://localhost:6969/api/deeprintz/live', // Use local server for testing
  SHOP_DOMAIN: 'mayu-12351.myshopify.com', // Replace with your dev shop domain
  TEST_POSTAL_CODE: '110001',
  TEST_WEIGHT: 500, // grams
  TEST_ORDER_AMOUNT: 1000 // rupees
};

async function testCarrierService() {
  log('\n🚚 Testing Shopify Carrier Service', 'blue');
  log('='.repeat(50), 'blue');

  try {
    // Test 1: Check if CarrierService endpoint is accessible
    log('\n📡 Test 1: CarrierService Test Endpoint', 'yellow');
    try {
      const testResponse = await axios.get(`${CONFIG.BASE_URL}/shopify/carrier/rates/test`);
      log('✅ CarrierService test endpoint accessible', 'green');
      log(`   Status: ${testResponse.status}`, 'green');
      log(`   Shop Domain: ${testResponse.data.shopDomain}`, 'green');
      log(`   Callback URL: ${testResponse.data.callbackUrl}`, 'green');
    } catch (error) {
      log('❌ CarrierService test endpoint failed', 'red');
      log(`   Error: ${error.message}`, 'red');
      return;
    }

    // Test 2: Test shipping rates calculation
    log('\n📦 Test 2: Shipping Rates Calculation', 'yellow');

    // Create a mock Shopify CarrierService request
    const mockRequest = {
      rate: {
        destination: {
          postal_code: CONFIG.TEST_POSTAL_CODE,
          country: 'IN',
          province: 'Delhi',
          city: 'New Delhi',
          name: 'Test Customer',
          address1: 'Test Address',
          address2: '',
          company: '',
          phone: '9876543210'
        },
        items: [
          {
            name: 'Test Product',
            sku: 'TEST-001',
            quantity: 1,
            grams: CONFIG.TEST_WEIGHT,
            price: CONFIG.TEST_ORDER_AMOUNT * 100, // Convert to cents
            vendor: 'Test Vendor',
            requires_shipping: true,
            taxable: true,
            fulfillment_service: 'manual'
          }
        ],
        currency: 'INR',
        locale: 'en'
      }
    };

    log(`   Sending request for postal code: ${CONFIG.TEST_POSTAL_CODE}`, 'blue');
    log(`   Weight: ${CONFIG.TEST_WEIGHT}g, Amount: ₹${CONFIG.TEST_ORDER_AMOUNT}`, 'blue');

    try {
      const ratesResponse = await axios.post(
        `${CONFIG.BASE_URL}/shopify/carrier/rates`,
        mockRequest,
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Shop-Domain': CONFIG.SHOP_DOMAIN,
            'User-Agent': 'Shopify CarrierService Test'
          },
          timeout: 30000
        }
      );

      log('✅ Shipping rates request successful', 'green');
      log(`   Status: ${ratesResponse.status}`, 'green');

      const rates = ratesResponse.data.rates || [];
      log(`   Found ${rates.length} shipping options:`, 'green');

      if (rates.length > 0) {
        rates.forEach((rate, index) => {
          log(`   ${index + 1}. ${rate.service_name}`, 'green');
          log(`      Price: ₹${(rate.total_price / 100).toFixed(2)}`, 'green');
          log(`      Code: ${rate.service_code}`, 'green');
          log(`      Delivery: ${rate.description}`, 'green');
        });

        log('\n✅ CarrierService is working correctly!', 'green');
        log('   Shopify checkout should now show shipping options.', 'green');

      } else {
        log('⚠️ No shipping rates returned', 'yellow');
        log('   This will cause "No shipping available" in Shopify checkout', 'yellow');

        // Check if there are any error details in the response
        if (ratesResponse.data.error) {
          log(`   Error details: ${ratesResponse.data.error}`, 'red');
        }
      }

    } catch (error) {
      log('❌ Shipping rates request failed', 'red');
      log(`   Error: ${error.message}`, 'red');

      if (error.response) {
        log(`   Status: ${error.response.status}`, 'red');
        log(`   Response: ${JSON.stringify(error.response.data, null, 2)}`, 'red');
      }

      log('\n🔧 Troubleshooting Steps:', 'yellow');
      log('   1. Check if CarrierService is registered in Shopify Admin', 'yellow');
      log('   2. Verify callback URL is correct', 'yellow');
      log('   3. Check ngrok tunnel is running (if using dev environment)', 'yellow');
      log('   4. Verify NimbusPost API credentials are working', 'yellow');
    }

    // Test 3: Test NimbusPost API directly
    log('\n🌐 Test 3: Direct NimbusPost API Test', 'yellow');
    try {
      const axios = require('axios');

      // Test token generation
      const tokenResponse = await axios.post(
        'https://api.nimbuspost.com/v1/users/login',
        {
          email: "care+1201@deeprintz.com",
          password: "3JfzKQpHsG"
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      if (tokenResponse.data) {
        log('✅ NimbusPost API accessible', 'green');

        // Test courier serviceability
        const courierData = {
          origin: "641603",
          destination: CONFIG.TEST_POSTAL_CODE,
          payment_type: 'prepaid',
          order_amount: "",
          weight: CONFIG.TEST_WEIGHT / 1000, // Convert to kg
          length: "",
          breadth: "",
          height: ""
        };

        const courierResponse = await axios.post(
          'https://api.nimbuspost.com/v1/courier/serviceability',
          courierData,
          {
            headers: {
              'Authorization': `Bearer ${tokenResponse.data}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        if (courierResponse.data?.status && courierResponse.data?.data?.length > 0) {
          log(`✅ NimbusPost returned ${courierResponse.data.data.length} courier options`, 'green');
        } else {
          log('⚠️ NimbusPost returned no courier options', 'yellow');
        }

      } else {
        log('❌ NimbusPost token generation failed', 'red');
      }

    } catch (error) {
      log('❌ NimbusPost API test failed', 'red');
      log(`   Error: ${error.message}`, 'red');
    }

  } catch (error) {
    log('❌ Carrier Service test failed', 'red');
    log(`   Error: ${error.message}`, 'red');
  }

  log('\n📋 Next Steps if Issues Persist:', 'blue');
  log('   1. Check Shopify Admin → Settings → Shipping and delivery', 'yellow');
  log('   2. Look for "Deeprintz Live Shipping Rates" carrier service', 'yellow');
  log('   3. Verify callback URL matches your environment', 'yellow');
  log('   4. Test with a real Shopify checkout flow', 'yellow');
  log('   5. Check browser console for JavaScript errors', 'yellow');
}

// Run tests if this script is executed directly
if (require.main === module) {
  testCarrierService().catch(error => {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testCarrierService };
