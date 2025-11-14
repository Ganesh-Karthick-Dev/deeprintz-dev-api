/**
 * Test Script for WooCommerce Shipping Setup
 * Run this to test the shipping setup without pushing products
 */

const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// Configuration - Update these values
const config = {
  store_url: 'https://wordpress-1481791-5775074.cloudwaysapps.com',
  consumer_key: 'ck_7840bdfbf8d74409d6d50ec3b3a9b8730525037d',
  consumer_secret: 'cs_e143075b5c4c5ff988772140f2f67843cb4e8acb',
  version: 'wc/v3',
  timeout: 30000
};

async function testShippingSetup() {
  try {
    console.log('🚀 Testing WooCommerce Shipping Setup...\n');
    
    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi(config);
    
    // Test 1: Check connection
    console.log('1️⃣ Testing WooCommerce connection...');
    try {
      const statusResponse = await WooCommerce.get("system_status");
      if (statusResponse.status === 200) {
        console.log('✅ Connection successful');
        console.log(`   Store: ${statusResponse.data.name}`);
        console.log(`   Version: ${statusResponse.data.version}`);
      } else {
        console.log('❌ Connection failed:', statusResponse.status);
        return;
      }
    } catch (error) {
      console.log('❌ Connection error:', error.message);
      return;
    }
    
    // Test 2: Check existing shipping zones
    console.log('\n2️⃣ Checking existing shipping zones...');
    try {
      const zonesResponse = await WooCommerce.get("shipping/zones");
      if (zonesResponse.status === 200) {
        console.log(`✅ Found ${zonesResponse.data.length} shipping zones:`);
        zonesResponse.data.forEach(zone => {
          console.log(`   Zone ${zone.id}: ${zone.name}`);
          if (zone.locations && zone.locations.length > 0) {
            zone.locations.forEach(loc => {
              console.log(`     - ${loc.type}: ${loc.code}`);
            });
          }
        });
        
        // Look for India zone
        const indiaZone = zonesResponse.data.find(zone => 
          zone.name === "India" || 
          zone.name === "india" ||
          zone.locations.some(loc => loc.code === "IN")
        );
        
        if (indiaZone) {
          console.log(`\n   🎯 Found India zone: ${indiaZone.id} - ${indiaZone.name}`);
        } else {
          console.log('\n   ❌ No India zone found');
        }
      } else {
        console.log('❌ Failed to fetch zones:', zonesResponse.status);
      }
    } catch (error) {
      console.log('❌ Error fetching zones:', error.message);
    }
    
    // Test 3: Check shipping methods in first zone
    console.log('\n3️⃣ Checking shipping methods in first zone...');
    try {
      if (zonesResponse.data && zonesResponse.data.length > 0) {
        const firstZone = zonesResponse.data[0];
        console.log(`   Checking zone: ${firstZone.id} - ${firstZone.name}`);
        
        const methodsResponse = await WooCommerce.get(`shipping/zones/${firstZone.id}/methods`);
        if (methodsResponse.status === 200) {
          console.log(`   ✅ Found ${methodsResponse.data.length} shipping methods:`);
          methodsResponse.data.forEach(method => {
            console.log(`     - ${method.method_id}: ${method.method_title} (${method.enabled ? 'enabled' : 'disabled'})`);
          });
        } else {
          console.log('   ❌ Failed to fetch methods:', methodsResponse.status);
        }
      }
    } catch (error) {
      console.log('   ❌ Error fetching methods:', error.message);
    }
    
    // Test 4: Try to create a test shipping method
    console.log('\n4️⃣ Testing shipping method creation...');
    try {
      if (zonesResponse.data && zonesResponse.data.length > 0) {
        const testZone = zonesResponse.data[0];
        console.log(`   Using zone: ${testZone.id} - ${testZone.name}`);
        
        const testMethodData = {
          method_id: "flat_rate",
          method_title: "Test Courier Partners",
          method_description: "Test shipping method",
          enabled: true,
          settings: {
            title: {
              value: "Test Courier Partners",
              description: "Test title"
            },
            cost: {
              value: "0",
              description: "Test cost"
            }
          }
        };
        
        console.log('   Attempting to create test method...');
        const createResponse = await WooCommerce.post(
          `shipping/zones/${testZone.id}/methods`, 
          testMethodData
        );
        
        if (createResponse.status === 201) {
          console.log('   ✅ Test method created successfully!');
          console.log(`      Method ID: ${createResponse.data.id}`);
          
          // Clean up - delete the test method
          console.log('   🧹 Cleaning up test method...');
          try {
            await WooCommerce.delete(`shipping/zones/${testZone.id}/methods/${createResponse.data.id}`);
            console.log('   ✅ Test method deleted');
          } catch (deleteError) {
            console.log('   ⚠️ Could not delete test method:', deleteError.message);
          }
        } else {
          console.log('   ❌ Failed to create test method:', createResponse.status);
          if (createResponse.data) {
            console.log('      Error:', createResponse.data.message);
          }
        }
      }
    } catch (error) {
      console.log('   ❌ Error creating test method:', error.message);
      if (error.response && error.response.data) {
        console.log('      WooCommerce error:', error.response.data.message);
        console.log('      Error code:', error.response.data.code);
      }
    }
    
    console.log('\n🏁 Testing completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testShippingSetup();
