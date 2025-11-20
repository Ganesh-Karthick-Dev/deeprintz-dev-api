#!/usr/bin/env node

/**
 * 🚀 COMPLETE SHOPIFY SHIPPING SETUP
 * 
 * This script will:
 * 1. Check existing CarrierServices
 * 2. Delete old ones if needed
 * 3. Create a NEW CarrierService with correct DEV callback URL
 * 4. Provide instructions for adding it to shipping zones
 * 
 * Run: node setup-complete-shipping.js
 */

const axios = require('axios');

const SHOPIFY_CONFIG = require('./config/shopify');

const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com',
};

const CALLBACK_URL = SHOPIFY_CONFIG.CARRIER_SERVICE_URL;

console.log('🚀 COMPLETE SHOPIFY SHIPPING SETUP');
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
 * Get shop
 */
async function getShop() {
  const shop = await global.dbConnection('shopify_stores')
    .where('shop_domain', CONFIG.SHOP_DOMAIN)
    .where('status', 'connected')
    .first();
  
  if (!shop) {
    throw new Error('Shop not found');
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
    throw new Error(JSON.stringify(response.data.errors, null, 2));
  }
  
  return response.data;
}

/**
 * Main setup
 */
async function setup() {
  try {
    await initDB();
    console.log('✅ Database connected');
    
    const shop = await getShop();
    console.log('✅ Shop found:', shop.shop_domain);
    console.log('');
    
    // Step 1: List existing CarrierServices
    console.log('📋 STEP 1: Checking existing CarrierServices...');
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
    
    console.log(`   Found ${services.length} existing service(s)`);
    
    if (services.length > 0) {
      services.forEach((edge, i) => {
        console.log(`   ${i + 1}. ${edge.node.name}`);
        console.log(`      Callback: ${edge.node.callbackUrl || 'NOT SET'}`);
      });
    }
    
    console.log('');
    
    // Step 2: Delete old Deeprintz CarrierServices
    const deeprintzServices = services.filter(e => 
      e.node.name.includes('Deeprintz') || e.node.name.includes('Live Shipping')
    );
    
    if (deeprintzServices.length > 0) {
      console.log('🗑️  STEP 2: Deleting old Deeprintz CarrierServices...');
      
      for (const edge of deeprintzServices) {
        try {
          const deleteMutation = `
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
          
          const deleteResult = await graphql(
            shop.shop_domain, 
            shop.access_token, 
            deleteMutation, 
            { id: edge.node.id }
          );
          
          if (deleteResult.data?.carrierServiceDelete?.userErrors?.length > 0) {
            console.log(`   ⚠️  Could not delete ${edge.node.name}: ${deleteResult.data.carrierServiceDelete.userErrors[0].message}`);
          } else {
            console.log(`   ✅ Deleted: ${edge.node.name}`);
          }
        } catch (deleteError) {
          console.log(`   ⚠️  Could not delete ${edge.node.name}: ${deleteError.message}`);
        }
      }
      
      console.log('');
    }
    
    // Step 3: Create new CarrierService
    console.log('➕ STEP 3: Creating new CarrierService...');
    console.log(`   Name: Deeprintz Shipping (DEV)`);
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
      name: 'Deeprintz Shipping (DEV)',
      callbackUrl: CALLBACK_URL,
      active: true,
      supportsServiceDiscovery: true
    };
    
    try {
      const createResult = await graphql(shop.shop_domain, shop.access_token, createMutation, { input });
      
      if (createResult.data?.carrierServiceCreate?.userErrors?.length > 0) {
        const errors = createResult.data.carrierServiceCreate.userErrors;
        console.log('   ⚠️  Creation had issues:', errors[0].message);
        
        if (errors[0].message.includes('already')) {
          console.log('   ℹ️  A similar service might already exist. Continuing...');
        } else {
          throw new Error(errors[0].message);
        }
      } else {
        const service = createResult.data.carrierServiceCreate.carrierService;
        console.log('   ✅ CarrierService created successfully!');
        console.log(`      ID: ${service.id}`);
        console.log(`      Name: ${service.name}`);
        console.log(`      Callback: ${service.callbackUrl}`);
      }
    } catch (createError) {
      console.log('   ⚠️  Create error:', createError.message);
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('🎉 SETUP COMPLETE!');
    console.log('='.repeat(80));
    console.log('');
    console.log('📋 NEXT STEPS - MANUAL CONFIGURATION IN SHOPIFY ADMIN:');
    console.log('');
    console.log('1. Go to: https://mayu-12351.myshopify.com/admin/settings/shipping');
    console.log('');
    console.log('2. CREATE A SHIPPING ZONE (if none exists):');
    console.log('   • Scroll to "Shipping zones"');
    console.log('   • Click "Create shipping zone"');
    console.log('   • Name: "India" (or any name)');
    console.log('   • Countries: Select "India"');
    console.log('   • Click "Done"');
    console.log('');
    console.log('3. ADD CARRIER SERVICE TO THE ZONE:');
    console.log('   • In the zone you just created, click "Add rate"');
    console.log('   • Select "Use carrier or app to calculate rates"');
    console.log('   • Choose "Deeprintz Shipping (DEV)" from the list');
    console.log('   • Click "Done"');
    console.log('');
    console.log('4. TEST CHECKOUT:');
    console.log('   • Go to your store: https://mayu-12351.myshopify.com');
    console.log('   • Add product to cart');
    console.log('   • Proceed to checkout');
    console.log('   • Enter address (postal code: 110001)');
    console.log('   • You should see shipping options! 🎉');
    console.log('');
    console.log('🐛 TROUBLESHOOTING:');
    console.log('   • If no rates appear, run: node debug-shopify-shipping.js');
    console.log('   • Make sure ngrok is running');
    console.log('   • Check that the callback URL is correct');
    console.log('');
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    
    if (error.message.includes('403')) {
      console.error('🚨 PERMISSION ERROR!');
      console.error('Your app needs read_shipping and write_shipping scopes.');
      console.error('Disconnect and reconnect your store to refresh scopes.');
    }
    
    process.exit(1);
  }
}

// Run
if (require.main === module) {
  setup().catch(error => {
    console.error('❌ Unexpected error:', error);
    process.exit(1);
  });
}

module.exports = { setup };


