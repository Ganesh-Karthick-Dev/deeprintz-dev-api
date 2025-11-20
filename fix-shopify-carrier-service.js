#!/usr/bin/env node

/**
 * 🔧 FIX SHOPIFY CARRIER SERVICE
 * 
 * This script fixes the "Shipping not available" error by:
 * 1. Deleting the old CarrierService with wrong/unset callback URL
 * 2. Creating a new CarrierService with the correct callback URL
 * 3. Using latest Shopify GraphQL API (2025-01)
 * 
 * Run with: node fix-shopify-carrier-service.js
 */

const axios = require('axios');
require('dotenv').config();

const SHOPIFY_CONFIG = require('./config/shopify');

// Configuration
const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
  USER_ID: 2004,
  DB_CONFIG: {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'deeprintz'
  }
};

// Get correct callback URL from config
const CALLBACK_URL = SHOPIFY_CONFIG.CARRIER_SERVICE_URL;

console.log('🔧 FIXING SHOPIFY CARRIER SERVICE');
console.log('='.repeat(80));
console.log('📋 Configuration:');
console.log(`   Shop Domain: ${CONFIG.SHOP_DOMAIN}`);
console.log(`   User ID: ${CONFIG.USER_ID}`);
console.log(`   Callback URL: ${CALLBACK_URL}`);
console.log(`   Environment: ${CONFIG.ENVIRONMENT}`);
console.log('='.repeat(80));
console.log('');

/**
 * Initialize database connection
 */
async function initDatabase() {
  // Load database configuration and setup global connection
  // This mimics how index.js sets up the database
  const dbConfigs = require('./utils/knexfile');
  const knex = require('knex');
  
  // Use the correct environment config
  const dbConfig = CONFIG.ENVIRONMENT === 'live' ? dbConfigs.deeprintzLive : dbConfigs.deeprintzDev;
  
  if (!global.dbConnection) {
    global.dbConnection = knex(dbConfig);
  }
  
  // Test connection
  await global.dbConnection.raw('SELECT 1');
  console.log('   ✅ Database connection established');
}

/**
 * Get shop connection details from database
 */
async function getShopConnection() {
  try {
    const shop = await global.dbConnection('shopify_stores')
      .where('shop_domain', CONFIG.SHOP_DOMAIN)
      .where('status', 'connected')
      .first();
    
    if (!shop) {
      throw new Error('Shop connection not found in database');
    }
    
    return shop;
  } catch (error) {
    throw new Error(`Database error: ${error.message}`);
  }
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
 * List all CarrierServices
 */
async function listCarrierServices(shop, accessToken) {
  console.log('📋 Step 1: Listing all CarrierServices...');
  
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
  
  const result = await shopifyGraphQL(shop, accessToken, query);
  const services = result.data?.carrierServices?.edges || [];
  
  console.log(`   Found ${services.length} CarrierService(s)`);
  console.log('');
  
  services.forEach((edge, index) => {
    const service = edge.node;
    console.log(`   ${index + 1}. ${service.name}`);
    console.log(`      ID: ${service.id}`);
    console.log(`      Callback URL: ${service.callbackUrl || 'NOT SET ⚠️'}`);
    console.log(`      Active: ${service.active}`);
    console.log(`      Service Discovery: ${service.supportsServiceDiscovery}`);
    console.log('');
  });
  
  return services;
}

/**
 * Delete a CarrierService
 */
async function deleteCarrierService(shop, accessToken, serviceId, serviceName) {
  console.log(`🗑️  Step 2: Deleting old CarrierService: ${serviceName}...`);
  console.log(`   ID: ${serviceId}`);
  
  const mutation = `
    mutation carrierServiceDelete($id: ID!) {
      carrierServiceDelete(id: $id) {
        deletedId
        userErrors {
          field
          message
        }
      }
    }
  `;
  
  const result = await shopifyGraphQL(shop, accessToken, mutation, { id: serviceId });
  
  if (result.data?.carrierServiceDelete?.userErrors?.length > 0) {
    const errors = result.data.carrierServiceDelete.userErrors;
    throw new Error(`Delete failed: ${JSON.stringify(errors)}`);
  }
  
  console.log('   ✅ CarrierService deleted successfully');
  console.log('');
  
  return true;
}

/**
 * Create a new CarrierService
 */
async function createCarrierService(shop, accessToken, name, callbackUrl) {
  console.log(`➕ Step 3: Creating new CarrierService: ${name}...`);
  console.log(`   Callback URL: ${callbackUrl}`);
  
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
    name: name,
    callbackUrl: callbackUrl,
    active: true,
    supportsServiceDiscovery: true
  };
  
  const result = await shopifyGraphQL(shop, accessToken, mutation, { input });
  
  if (result.data?.carrierServiceCreate?.userErrors?.length > 0) {
    const errors = result.data.carrierServiceCreate.userErrors;
    throw new Error(`Create failed: ${JSON.stringify(errors)}`);
  }
  
  const service = result.data.carrierServiceCreate.carrierService;
  
  console.log('   ✅ CarrierService created successfully');
  console.log(`      ID: ${service.id}`);
  console.log(`      Name: ${service.name}`);
  console.log(`      Callback URL: ${service.callbackUrl}`);
  console.log(`      Active: ${service.active}`);
  console.log('');
  
  return service;
}

/**
 * Main fix function
 */
async function fixCarrierService() {
  try {
    // Initialize database connection
    await initDatabase();
    
    // Step 0: Get shop connection from database
    console.log('🔍 Step 0: Getting shop connection from database...');
    const shop = await getShopConnection();
    console.log(`   ✅ Shop connection found for vendor ID: ${shop.vendor_id}`);
    console.log('');
    
    // Step 1: List all CarrierServices
    const services = await listCarrierServices(shop.shop_domain, shop.access_token);
    
    // Find Deeprintz services
    const deeprintzServices = services.filter(edge => 
      edge.node.name.includes('Deeprintz') || 
      edge.node.name.includes('Live Shipping Rates')
    );
    
    if (deeprintzServices.length === 0) {
      console.log('ℹ️  No Deeprintz CarrierServices found. Creating new one...');
      console.log('');
    } else {
      console.log(`🔍 Found ${deeprintzServices.length} Deeprintz CarrierService(s)`);
      console.log('');
      
      // Delete all old Deeprintz CarrierServices
      for (const edge of deeprintzServices) {
        const service = edge.node;
        
        // Check if callback URL is correct
        if (service.callbackUrl === CALLBACK_URL) {
          console.log(`✅ CarrierService "${service.name}" already has correct callback URL!`);
          console.log('   No action needed. Your shipping should work now.');
          console.log('');
          return;
        }
        
        // Delete services with wrong/unset callback URL
        await deleteCarrierService(
          shop.shop_domain, 
          shop.access_token, 
          service.id, 
          service.name
        );
      }
    }
    
    // Step 3: Create new CarrierService with correct callback URL
    const newService = await createCarrierService(
      shop.shop_domain,
      shop.access_token,
      'Deeprintz Live Shipping Rates',
      CALLBACK_URL
    );
    
    console.log('='.repeat(80));
    console.log('🎉 SUCCESS! CarrierService fixed!');
    console.log('='.repeat(80));
    console.log('');
    console.log('✅ What was fixed:');
    console.log('   1. Deleted old CarrierService(s) with wrong/unset callback URL');
    console.log('   2. Created new CarrierService with correct callback URL');
    console.log('   3. Enabled service discovery for dynamic shipping rates');
    console.log('');
    console.log('🧪 TEST YOUR STORE NOW:');
    console.log('   1. Go to your Shopify store: https://mayu-12351.myshopify.com');
    console.log('   2. Add a product to cart');
    console.log('   3. Proceed to checkout');
    console.log('   4. Enter a shipping address');
    console.log('   5. You should see shipping options! 🎊');
    console.log('');
    console.log('📋 New CarrierService Details:');
    console.log(`   Name: ${newService.name}`);
    console.log(`   ID: ${newService.id}`);
    console.log(`   Callback URL: ${newService.callbackUrl}`);
    console.log(`   Active: ${newService.active}`);
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ ERROR: Failed to fix CarrierService');
    console.error('='.repeat(80));
    console.error('');
    console.error('Error:', error.message);
    console.error('');
    
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('🚨 PERMISSION ERROR: Your app does not have shipping scopes!');
      console.error('');
      console.error('📋 FIX STEPS:');
      console.error('   1. Go to Shopify Partner Dashboard');
      console.error('   2. Go to your app → Configuration → API scopes');
      console.error('   3. Make sure these scopes are enabled:');
      console.error('      ✓ read_shipping');
      console.error('      ✓ write_shipping');
      console.error('   4. Save changes');
      console.error('   5. Go to your Deeprintz app and DISCONNECT the store');
      console.error('   6. RECONNECT the store (this triggers OAuth with new scopes)');
      console.error('   7. Run this script again');
      console.error('');
    } else if (error.message.includes('Database')) {
      console.error('🚨 DATABASE ERROR: Could not connect to database');
      console.error('');
      console.error('📋 CHECK:');
      console.error('   1. Make sure your .env file has correct database credentials');
      console.error('   2. Make sure MySQL is running');
      console.error('   3. Make sure deeprintz database exists');
      console.error('');
    } else {
      console.error('📋 MANUAL FIX (if script fails):');
      console.error('   1. Go to Shopify Admin: https://mayu-12351.myshopify.com/admin');
      console.error('   2. Go to: Settings → Shipping and delivery');
      console.error('   3. Find "Deeprintz Live Shipping Rates"');
      console.error('   4. Delete it');
      console.error('   5. Push a product again from Deeprintz - it will recreate with correct URL');
      console.error('');
    }
    
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixCarrierService().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { fixCarrierService };
