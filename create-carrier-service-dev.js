#!/usr/bin/env node

/**
 * 🆕 CREATE SHOPIFY CARRIER SERVICE FOR DEV
 * 
 * This script creates a NEW CarrierService specifically for DEV environment
 * with the correct ngrok callback URL
 * 
 * Run with: node create-carrier-service-dev.js
 */

const axios = require('axios');

// Configuration
const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
  USER_ID: 2004,
  NGROK_URL: 'https://df5b0a4dbe35.ngrok-free.app',
  ENVIRONMENT: 'dev'
};

// Get correct callback URL for dev
const CALLBACK_URL = `${CONFIG.NGROK_URL}/api/deeprintz/${CONFIG.ENVIRONMENT}/shopify/carrier/rates`;

console.log('🆕 CREATING NEW CARRIER SERVICE FOR DEV');
console.log('='.repeat(80));
console.log('📋 Configuration:');
console.log(`   Shop Domain: ${CONFIG.SHOP_DOMAIN}`);
console.log(`   Callback URL: ${CALLBACK_URL}`);
console.log(`   Environment: ${CONFIG.ENVIRONMENT}`);
console.log('='.repeat(80));
console.log('');

/**
 * Initialize database connection
 */
async function initDatabase() {
  const dbConfigs = require('./utils/knexfile');
  const knex = require('knex');
  
  const dbConfig = CONFIG.ENVIRONMENT === 'live' ? dbConfigs.deeprintzLive : dbConfigs.deeprintzDev;
  
  if (!global.dbConnection) {
    global.dbConnection = knex(dbConfig);
  }
  
  await global.dbConnection.raw('SELECT 1');
  console.log('✅ Database connection established');
  console.log('');
}

/**
 * Get shop connection details from database
 */
async function getShopConnection() {
  const shop = await global.dbConnection('shopify_stores')
    .where('shop_domain', CONFIG.SHOP_DOMAIN)
    .where('status', 'connected')
    .first();
  
  if (!shop) {
    throw new Error('Shop connection not found in database');
  }
  
  return shop;
}

/**
 * Make GraphQL request to Shopify
 */
async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  try {
    const response = await axios.post(
      `https://${shop}/admin/api/2025-01/graphql.json`,
      {
        query,
        variables
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': accessToken
        }
      }
    );
    
    if (response.data.errors) {
      throw new Error(JSON.stringify(response.data.errors));
    }
    
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Shopify API error: ${JSON.stringify(error.response.data)}`);
    }
    throw error;
  }
}

/**
 * List existing CarrierServices
 */
async function listCarrierServices(shop, accessToken) {
  console.log('📋 Listing existing CarrierServices...');
  
  const query = `
    query {
      carrierServices(first: 50) {
        edges {
          node {
            id
            name
            callbackUrl
            active
          }
        }
      }
    }
  `;
  
  const result = await shopifyGraphQL(shop, accessToken, query);
  const services = result.data?.carrierServices?.edges || [];
  
  console.log(`   Found ${services.length} CarrierService(s)`);
  
  services.forEach((edge, index) => {
    const service = edge.node;
    console.log(`   ${index + 1}. ${service.name}`);
    console.log(`      Callback URL: ${service.callbackUrl || 'NOT SET'}`);
  });
  
  console.log('');
  
  return services;
}

/**
 * Create a new CarrierService
 */
async function createCarrierService(shop, accessToken) {
  const serviceName = `Deeprintz DEV Shipping (${new Date().toISOString().slice(0, 10)})`;
  
  console.log(`➕ Creating new CarrierService: ${serviceName}...`);
  console.log(`   Callback URL: ${CALLBACK_URL}`);
  console.log('');
  
  const mutation = `
    mutation carrierServiceCreate($input: DeliveryCarrierServiceCreateInput!) {
      carrierServiceCreate(input: $input) {
        carrierService {
          id
          name
          callbackUrl
          active
          supportsServiceDiscovery
        }
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const input = {
    name: serviceName,
    callbackUrl: CALLBACK_URL,
    active: true,
    supportsServiceDiscovery: true
  };
  
  const result = await shopifyGraphQL(shop, accessToken, mutation, { input });
  
  if (result.data?.carrierServiceCreate?.userErrors?.length > 0) {
    const errors = result.data.carrierServiceCreate.userErrors;
    throw new Error(`Create failed: ${JSON.stringify(errors)}`);
  }
  
  const service = result.data.carrierServiceCreate.carrierService;
  
  console.log('✅ CarrierService created successfully!');
  console.log('');
  console.log('📋 New CarrierService Details:');
  console.log(`   ID: ${service.id}`);
  console.log(`   Name: ${service.name}`);
  console.log(`   Callback URL: ${service.callbackUrl}`);
  console.log(`   Active: ${service.active}`);
  console.log(`   Service Discovery: ${service.supportsServiceDiscovery}`);
  console.log('');
  
  return service;
}

/**
 * Main function
 */
async function main() {
  try {
    await initDatabase();
    
    console.log('🔍 Getting shop connection from database...');
    const shop = await getShopConnection();
    console.log(`   ✅ Shop connection found for vendor ID: ${shop.vendor_id}`);
    console.log('');
    
    // List existing services
    const services = await listCarrierServices(shop.shop_domain, shop.access_token);
    
    // Check if we already have a dev service with correct URL
    const existingDevService = services.find(edge => 
      edge.node.callbackUrl === CALLBACK_URL
    );
    
    if (existingDevService) {
      console.log('✅ A CarrierService with the correct DEV callback URL already exists!');
      console.log(`   Name: ${existingDevService.node.name}`);
      console.log(`   Callback URL: ${existingDevService.node.callbackUrl}`);
      console.log('');
      console.log('🎉 No action needed! Your shipping should work now.');
      console.log('');
      console.log('🧪 TEST NOW:');
      console.log('   1. Go to your Shopify store checkout');
      console.log('   2. You should see shipping options!');
      console.log('');
      return;
    }
    
    // Create new dev CarrierService
    await createCarrierService(shop.shop_domain, shop.access_token);
    
    console.log('='.repeat(80));
    console.log('🎉 SUCCESS!');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ New DEV CarrierService created with correct callback URL!');
    console.log('');
    console.log('🧪 TEST YOUR STORE NOW:');
    console.log('   1. Go to: https://mayu-12351.myshopify.com');
    console.log('   2. Add a product to cart');
    console.log('   3. Proceed to checkout');
    console.log('   4. Enter a shipping address');
    console.log('   5. You should see shipping options! 🎊');
    console.log('');
    console.log('⚠️ OPTIONAL CLEANUP:');
    console.log('   You can delete the old CarrierServices from Shopify Admin:');
    console.log('   → Settings → Shipping and delivery');
    console.log('   → Remove any old "Deeprintz" services');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ ERROR');
    console.error('='.repeat(80));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { main };

