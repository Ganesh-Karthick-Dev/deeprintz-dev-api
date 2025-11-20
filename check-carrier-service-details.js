#!/usr/bin/env node

/**
 * Check CarrierService Details
 * This will show you the exact callback URL that's currently configured
 */

const axios = require('axios');
const SHOPIFY_CONFIG = require('./config/shopify');

const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
};

async function checkCarrierService() {
  try {
    // Initialize database
    const dbConfigs = require('./utils/knexfile');
    const knex = require('knex');
    const dbConfig = CONFIG.ENVIRONMENT === 'live' ? dbConfigs.deeprintzLive : dbConfigs.deeprintzDev;
    
    global.dbConnection = knex(dbConfig);
    await global.dbConnection.raw('SELECT 1');
    
    // Get shop connection
    const shop = await global.dbConnection('shopify_stores')
      .where('shop_domain', CONFIG.SHOP_DOMAIN)
      .where('status', 'connected')
      .first();
    
    if (!shop) {
      console.error('❌ Shop not found in database');
      process.exit(1);
    }
    
    console.log('🔍 CHECKING CARRIER SERVICE DETAILS');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 Shop:', shop.shop_domain);
    console.log('📋 Vendor ID:', shop.vendor_id);
    console.log('');
    
    // GraphQL query to list all CarrierServices
    const query = `
      query {
        carrierServices(first: 50) {
          edges {
            node {
              id
              name
              callbackUrl
              active
              supportsServiceDiscovery
            }
          }
        }
      }
    `;
    
    const response = await axios.post(
      `https://${shop.shop_domain}/admin/api/2025-01/graphql.json`,
      { query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shop.access_token
        }
      }
    );
    
    if (response.data.errors) {
      console.error('❌ GraphQL Error:', JSON.stringify(response.data.errors, null, 2));
      process.exit(1);
    }
    
    const services = response.data.data?.carrierServices?.edges || [];
    
    console.log(`📦 Found ${services.length} CarrierService(s):`);
    console.log('');
    
    services.forEach((edge, index) => {
      const service = edge.node;
      console.log(`${index + 1}. ${service.name}`);
      console.log(`   ID: ${service.id}`);
      console.log(`   Callback URL: ${service.callbackUrl || '❌ NOT SET'}`);
      console.log(`   Active: ${service.active ? '✅' : '❌'}`);
      console.log(`   Service Discovery: ${service.supportsServiceDiscovery ? '✅' : '❌'}`);
      console.log('');
    });
    
    console.log('='.repeat(80));
    console.log('');
    console.log('🎯 EXPECTED CALLBACK URL FOR DEV:');
    console.log('   ' + SHOPIFY_CONFIG.CARRIER_SERVICE_URL);
    console.log('');
    
    // Check if any service has the correct URL
    const correctService = services.find(e => 
      e.node.callbackUrl === SHOPIFY_CONFIG.CARRIER_SERVICE_URL
    );
    
    if (correctService) {
      console.log('✅ FOUND: A CarrierService with the CORRECT callback URL!');
      console.log('   This service should be working.');
      console.log('');
      console.log('🧪 Next step: Test the endpoint directly');
      console.log('   Run: node debug-shopify-shipping.js');
    } else {
      console.log('❌ PROBLEM: No CarrierService with the correct DEV callback URL found!');
      console.log('');
      console.log('📋 Action required:');
      console.log('   1. Delete the old CarrierService(s) from Shopify Admin');
      console.log('   2. Run: node setup-shipping-after-cleanup.js');
    }
    
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkCarrierService();

