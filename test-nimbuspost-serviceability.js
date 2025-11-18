#!/usr/bin/env node

/**
 * 🧪 Test NimbusPost Serviceability
 *
 * This script tests different postal codes to find which ones have courier service
 * Run with: node test-nimbuspost-serviceability.js
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

// Configuration
const CONFIG = {
  ORIGIN_PINCODE: '641603', // Coimbatore, Tamil Nadu
  WEIGHT_KG: 0.5, // 500g
  TEST_POSTAL_CODES: [
    '641603', // Same as origin (Coimbatore)
    '641001', // Near Coimbatore
    '641012', // Near Coimbatore
    '641018', // Near Coimbatore
    '620001', // Trichy (Tamil Nadu)
    '600001', // Chennai (Tamil Nadu)
    '560001', // Bangalore (Karnataka)
    '110001', // Delhi (too far)
    '400001', // Mumbai (too far)
    '700001', // Kolkata (too far)
  ]
};

async function testNimbusPostServiceability() {
  log('\n📦 Testing NimbusPost Serviceability', 'blue');
  log('='.repeat(50), 'blue');
  log(`Origin Pincode: ${CONFIG.ORIGIN_PINCODE} (Coimbatore, Tamil Nadu)`, 'blue');
  log(`Weight: ${CONFIG.WEIGHT_KG}kg`, 'blue');

  try {
    // First, get authentication token
    log('\n🔑 Getting NimbusPost authentication token...', 'yellow');
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

    if (!tokenResponse.data) {
      log('❌ Failed to get authentication token', 'red');
      return;
    }

    const token = tokenResponse.data;
    log('✅ Authentication successful', 'green');

    // Test each postal code
    log('\n🚚 Testing postal codes for courier serviceability...', 'yellow');
    log('='.repeat(60), 'yellow');

    const results = [];

    for (const postalCode of CONFIG.TEST_POSTAL_CODES) {
      try {
        log(`\n📮 Testing postal code: ${postalCode}`, 'blue');

        const courierData = {
          origin: CONFIG.ORIGIN_PINCODE,
          destination: postalCode,
          payment_type: 'prepaid',
          order_amount: "",
          weight: CONFIG.WEIGHT_KG,
          length: "",
          breadth: "",
          height: ""
        };

        const response = await axios.post(
          'https://api.nimbuspost.com/v1/courier/serviceability',
          courierData,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json'
            },
            timeout: 15000
          }
        );

        const result = response.data;
        const hasService = result?.status && result?.data?.length > 0;

        if (hasService) {
          log('✅ Courier service available!', 'green');
          log(`   Found ${result.data.length} courier options:`, 'green');

          result.data.forEach((courier, index) => {
            log(`   ${index + 1}. ${courier.courier_name || courier.name}`, 'green');
            log(`      Shipping cost: ₹${courier.total_charges || courier.shipping_cost || 'N/A'}`, 'green');
            log(`      COD charges: ₹${courier.cod_charge || courier.cod_cost || 0}`, 'green');
            log(`      Estimated delivery: ${courier.estimated_delivery || courier.delivery_time || 'N/A'}`, 'green');
          });

          results.push({
            postalCode,
            available: true,
            courierCount: result.data.length,
            couriers: result.data
          });
        } else {
          log('❌ No courier service available', 'red');
          results.push({
            postalCode,
            available: false,
            courierCount: 0
          });
        }

      } catch (error) {
        log(`❌ Error testing postal code ${postalCode}:`, 'red');
        log(`   ${error.message}`, 'red');
        results.push({
          postalCode,
          available: false,
          error: error.message
        });
      }
    }

    // Summary
    log('\n📊 Summary of Serviceable Postal Codes', 'blue');
    log('='.repeat(50), 'blue');

    const serviceableCodes = results.filter(r => r.available);
    const nonServiceableCodes = results.filter(r => !r.available);

    log(`✅ Serviceable postal codes: ${serviceableCodes.length}`, 'green');
    serviceableCodes.forEach(code => {
      log(`   ${code.postalCode} - ${code.courierCount} couriers available`, 'green');
    });

    if (nonServiceableCodes.length > 0) {
      log(`\n❌ Non-serviceable postal codes: ${nonServiceableCodes.length}`, 'red');
      nonServiceableCodes.forEach(code => {
        log(`   ${code.postalCode}${code.error ? ` - ${code.error}` : ''}`, 'red');
      });
    }

    log('\n💡 Recommendation:', 'yellow');
    if (serviceableCodes.length > 0) {
      log(`   Use postal code ${serviceableCodes[0].postalCode} for testing Shopify checkout`, 'yellow');
      log(`   This will ensure shipping options are available and checkout works`, 'yellow');
    } else {
      log(`   No postal codes found with courier service. Check NimbusPost account setup.`, 'red');
    }

  } catch (error) {
    log('❌ NimbusPost serviceability test failed', 'red');
    log(`   Error: ${error.message}`, 'red');
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  testNimbusPostServiceability().catch(error => {
    log(`\n❌ Test failed: ${error.message}`, 'red');
    process.exit(1);
  });
}

module.exports = { testNimbusPostServiceability };
