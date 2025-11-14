/**
 * Shopify Webhook Verification Guide
 * 
 * NO MANUAL CONFIGURATION NEEDED IN SHOPIFY ADMIN DASHBOARD!
 * 
 * Webhooks are automatically registered when:
 * 1. App is installed/reinstalled
 * 2. OAuth callback completes successfully
 * 
 * The registerOrderWebhooks() function runs automatically after OAuth
 */

// How to verify webhooks are registered:

// Option 1: Check Shopify Admin Dashboard
// 1. Go to: https://partners.shopify.com/
// 2. Select your app
// 3. Go to "Webhooks" section
// 4. You should see: orders/create, orders/updated, orders/paid

// Option 2: Use Shopify API (run this script)
const axios = require('axios');

async function verifyWebhooks() {
  const shop = 'myn11.myshopify.com';
  
  // Get access token from database
  // You can query: SELECT access_token FROM shopify_stores WHERE shop_domain = 'myn11.myshopify.com';
  const accessToken = 'YOUR_ACCESS_TOKEN_HERE';
  
  try {
    const response = await axios.get(
      `https://${shop}/admin/api/2024-10/webhooks.json`,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken
        }
      }
    );
    
    console.log('📋 Registered Webhooks:');
    response.data.webhooks.forEach(webhook => {
      console.log(`✅ ${webhook.topic}`);
      console.log(`   URL: ${webhook.address}`);
      console.log(`   Status: ${webhook.state}`);
      console.log('');
    });
    
    // Check if our order webhooks are there
    const orderWebhooks = response.data.webhooks.filter(w => 
      w.address.includes('orders/webhook')
    );
    
    if (orderWebhooks.length > 0) {
      console.log('✅ Order webhooks are registered!');
    } else {
      console.log('⚠️ Order webhooks NOT found. Reinstall the app to register them.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// To verify, uncomment and run:
// verifyWebhooks();
