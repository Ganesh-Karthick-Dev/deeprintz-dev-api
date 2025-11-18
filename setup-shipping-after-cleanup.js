#!/usr/bin/env node

/**
 * 🔧 SETUP SHIPPING AFTER MANUAL CLEANUP
 * 
 * Run this script AFTER you've manually deleted the old CarrierServices from Shopify Admin.
 * This will create a fresh CarrierService with the correct DEV callback URL.
 * 
 * Usage: node setup-shipping-after-cleanup.js
 */

const axios = require('axios');

const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
  NGROK_URL: 'https://df5b0a4dbe35.ngrok-free.app',
  ENVIRONMENT: 'dev'
};

const CALLBACK_URL = `${CONFIG.NGROK_URL}/api/deeprintz/${CONFIG.ENVIRONMENT}/shopify/carrier/rates`;

console.log('🔧 SETTING UP SHOPIFY SHIPPING (AFTER CLEANUP)');
console.log('='.repeat(80));
console.log('');

/**
 * Initialize database
 */
async function initDB() {
  const dbConfigs = require('./utils/knexfile');
  const knex = require('knex');
  const dbConfig = CONFIG.ENVIRONMENT === 'live' ? dbConfigs.deeprintzLive : dbConfigs.deeprintzDev;
  
  if (!global.dbConnection) {
    global.dbConnection = knex(dbConfig);
  }
  
  await global.dbConnection.raw('SELECT 1');
}

/**
 * Get shop connection
 */
async function getShop() {
  const shop = await global.dbConnection('shopify_stores')
    .where('shop_domain', CONFIG.SHOP_DOMAIN)
    .where('status', 'connected')
    .first();
  
  if (!shop) {
    throw new Error('Shop not found in database');
  }
  
  return shop;
}

/**
 * GraphQL request
 */
async function graphql(shop, token, query, variables = {}) {
  const response = await axios.post(
    `https://${shop}/admin/api/2025-01/graphql.json`,
    { query, variables },
    {
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      }
    }
  );
  
  if (response.data.errors) {
    throw new Error(JSON.stringify(response.data.errors));
  }
  
  return response.data;
}

/**
 * Main setup function
 */
async function setup() {
  try {
    await initDB();
    console.log('✅ Database connected');
    
    const shop = await getShop();
    console.log('✅ Shop found:', shop.shop_domain);
    console.log('');
    
    // Step 1: List existing CarrierServices
    console.log('📋 Step 1: Checking existing CarrierServices...');
    const listQuery = `
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
    
    const listResult = await graphql(shop.shop_domain, shop.access_token, listQuery);
    const services = listResult.data?.carrierServices?.edges || [];
    
    console.log(`   Found ${services.length} existing CarrierService(s)`);
    
    if (services.length > 0) {
      services.forEach((edge, i) => {
        console.log(`   ${i + 1}. ${edge.node.name}`);
        console.log(`      Callback: ${edge.node.callbackUrl || 'NOT SET'}`);
      });
    }
    
    console.log('');
    
    // Check if we already have a service with correct URL
    const existingCorrect = services.find(e => e.node.callbackUrl === CALLBACK_URL);
    
    if (existingCorrect) {
      console.log('✅ A CarrierService with correct callback URL already exists!');
      console.log(`   Name: ${existingCorrect.node.name}`);
      console.log('');
      console.log('🎉 Shipping is already configured correctly!');
      console.log('');
      testCheckout();
      return;
    }
    
    // Step 2: Create new CarrierService
    console.log('➕ Step 2: Creating new CarrierService...');
    console.log(`   Name: Deeprintz DEV Shipping`);
    console.log(`   Callback URL: ${CALLBACK_URL}`);
    console.log('');
    
    const createMutation = `
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
      name: 'Deeprintz DEV Shipping',
      callbackUrl: CALLBACK_URL,
      active: true,
      supportsServiceDiscovery: true
    };
    
    const createResult = await graphql(shop.shop_domain, shop.access_token, createMutation, { input });
    
    if (createResult.data?.carrierServiceCreate?.userErrors?.length > 0) {
      const errors = createResult.data.carrierServiceCreate.userErrors;
      const errorMsg = errors.map(e => e.message).join(', ');
      
      if (errorMsg.includes('already configured') || errorMsg.includes('already exists')) {
        console.log('⚠️  CarrierService already exists (this might be okay)');
        console.log('');
        console.log('📋 MANUAL CLEANUP REQUIRED:');
        console.log('   The error suggests there are still old CarrierServices.');
        console.log('   Please go to Shopify Admin and delete them:');
        console.log('   1. Go to: https://mayu-12351.myshopify.com/admin/settings/shipping');
        console.log('   2. Find and delete any "Deeprintz" CarrierServices');
        console.log('   3. Run this script again');
        console.log('');
        process.exit(1);
      }
      
      throw new Error(`Failed to create CarrierService: ${errorMsg}`);
    }
    
    const service = createResult.data.carrierServiceCreate.carrierService;
    
    console.log('✅ CarrierService created successfully!');
    console.log('');
    console.log('📋 Details:');
    console.log(`   ID: ${service.id}`);
    console.log(`   Name: ${service.name}`);
    console.log(`   Callback URL: ${service.callbackUrl}`);
    console.log(`   Active: ${service.active}`);
    console.log('');
    
    console.log('='.repeat(80));
    console.log('🎉 SUCCESS! Shipping is now configured!');
    console.log('='.repeat(80));
    console.log('');
    
    testCheckout();
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    
    if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('🚨 PERMISSION ERROR!');
      console.error('');
      console.error('Your app does not have shipping scopes. Fix:');
      console.error('1. Go to Shopify Partner Dashboard');
      console.error('2. Ensure read_shipping and write_shipping scopes are enabled');
      console.error('3. Disconnect and reconnect your store in Deeprintz app');
      console.error('4. Run this script again');
      console.error('');
    }
    
    process.exit(1);
  }
}

/**
 * Display test instructions
 */
function testCheckout() {
  console.log('🧪 TEST YOUR CHECKOUT NOW:');
  console.log('');
  console.log('1. Open: https://mayu-12351.myshopify.com');
  console.log('2. Add any product to cart');
  console.log('3. Click "Checkout"');
  console.log('4. Enter shipping address (e.g., postal code: 110001)');
  console.log('5. Click "Continue to shipping method"');
  console.log('');
  console.log('✅ You should see shipping options like:');
  console.log('   • Standard Delivery - ₹50.00 (3-5 days)');
  console.log('   • Express Delivery - ₹100.00 (1-2 days)');
  console.log('');
  console.log('🐛 If you see "Shipping not available":');
  console.log('   → Run: node debug-shopify-shipping.js');
  console.log('   → Check if ngrok is still running');
  console.log('   → Check Shopify Admin for old CarrierServices');
  console.log('');
}

// Run
if (require.main === module) {
  setup().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { setup };

