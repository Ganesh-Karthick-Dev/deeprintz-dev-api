/**
 * Fix Carrier Service - Delete all old ones and create fresh with correct callback URL
 * Run this script to fix the "Shipping not available" checkout issue
 */

const knexConfig = require('./utils/knexfile');
const knex = require('knex')(knexConfig.deeprintzLive);
const { shopifyApi } = require('@shopify/shopify-api');
require('@shopify/shopify-api/adapters/node');

const SHOPIFY_CONFIG = require('./config/shopify');

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: SHOPIFY_CONFIG.CLIENT_ID,
  apiSecretKey: SHOPIFY_CONFIG.SECRET,
  scopes: SHOPIFY_CONFIG.SCOPES,
  hostName: SHOPIFY_CONFIG.BASE_URL.replace('https://', ''),
  apiVersion: '2025-10',
  isEmbeddedApp: false,
});

/**
 * Make a GraphQL request to Shopify
 */
async function shopifyGraphQL(shop, accessToken, query, variables = {}) {
  const client = new shopify.clients.Graphql({ session: { shop, accessToken } });
  return await client.request(query, { variables });
}

/**
 * List all carrier services
 */
async function listCarrierServices(shop, accessToken) {
  console.log('📋 Listing all CarrierServices...');
  
  const query = `
    query carrierServices($first: Int!) {
      carrierServices(first: $first) {
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
  
  const result = await shopifyGraphQL(shop, accessToken, query, { first: 50 });
  const services = result.data.carrierServices.edges.map(e => e.node);
  
  console.log(`Found ${services.length} CarrierService(s):`);
  services.forEach((service, i) => {
    console.log(`\n${i + 1}. ${service.name}`);
    console.log(`   ID: ${service.id}`);
    console.log(`   Callback URL: ${service.callbackUrl || 'not set'}`);
    console.log(`   Active: ${service.active}`);
    console.log(`   Service Discovery: ${service.supportsServiceDiscovery}`);
  });
  
  return services;
}

/**
 * Delete a carrier service using REST API (GraphQL delete is not working)
 */
async function deleteCarrierService(shop, accessToken, serviceId) {
  const numericId = serviceId.split('/').pop();
  console.log(`\n🗑️ Deleting CarrierService: ${serviceId}...`);
  
  try {
    // Use REST API for deletion (more reliable than GraphQL for this)
    const url = `https://${shop}/admin/api/2025-10/carrier_services/${numericId}.json`;
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('   ✅ Deleted successfully');
      return true;
    } else {
      const errorText = await response.text();
      console.log(`   ❌ Delete failed: ${response.status} ${errorText}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Delete error: ${error.message}`);
    return false;
  }
}

/**
 * Create a new CarrierService
 */
async function createCarrierService(shop, accessToken, name, callbackUrl) {
  console.log(`\n➕ Creating new CarrierService: ${name}...`);
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
  
  return service;
}

/**
 * Main fix function
 */
async function fixCarrierService() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   🔧 FIX CARRIER SERVICE - RESOLVE CHECKOUT SHIPPING ISSUE              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');
    
    // Get connected Shopify store
    const shop = await knex('shopify_stores')
      .where({ status: 'connected' })
      .orderBy('id', 'desc')
      .first();
    
    if (!shop) {
      console.error('❌ No connected Shopify store found!');
      console.error('   Please connect a Shopify store first.');
      process.exit(1);
    }
    
    console.log('✅ Found connected Shopify store:');
    console.log(`   Shop: ${shop.shop_domain}`);
    console.log(`   Vendor ID: ${shop.vendor_id}`);
    console.log('');
    
    const correctCallbackUrl = SHOPIFY_CONFIG.CARRIER_SERVICE_URL;
    console.log('📡 Correct callback URL:', correctCallbackUrl);
    console.log('📡 Current ngrok URL:', SHOPIFY_CONFIG.NGROK_URL);
    console.log('📡 Environment:', SHOPIFY_CONFIG.ENVIRONMENT);
    console.log('');
    
    // Step 1: List all existing carrier services
    const services = await listCarrierServices(shop.shop_domain, shop.access_token);
    
    // Step 2: Delete all Deeprintz carrier services
    const deeprintzServices = services.filter(s => 
      s.name.includes('Deeprintz') || s.name.includes('deeprintz')
    );
    
    if (deeprintzServices.length > 0) {
      console.log(`\n🗑️ Found ${deeprintzServices.length} Deeprintz CarrierService(s) to delete...`);
      
      for (const service of deeprintzServices) {
        await deleteCarrierService(shop.shop_domain, shop.access_token, service.id);
        // Wait a bit between deletions
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } else {
      console.log('\nℹ️ No existing Deeprintz CarrierServices found.');
    }
    
    // Step 3: Create fresh CarrierService with correct callback URL
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    const newService = await createCarrierService(
      shop.shop_domain,
      shop.access_token,
      'Deeprintz Live Shipping',
      correctCallbackUrl
    );
    
    console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   ✅ CARRIER SERVICE FIXED SUCCESSFULLY!                                 ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');
    
    console.log('📋 Next Steps:');
    console.log('   1. Go to your Shopify store checkout');
    console.log('   2. Add a product to cart');
    console.log('   3. Proceed to checkout');
    console.log('   4. You should now see "Deeprintz Live Shipping" as a shipping option');
    console.log('');
    console.log('⚠️ IMPORTANT: If your ngrok URL changes, run this script again!');
    console.log('   Current ngrok URL: ' + SHOPIFY_CONFIG.NGROK_URL);
    console.log('');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the fix
fixCarrierService();

