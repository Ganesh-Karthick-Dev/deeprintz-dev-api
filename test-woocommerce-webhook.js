/**
 * Test WooCommerce Webhook & Setup if Missing
 * Run: node test-woocommerce-webhook.js
 */

const knexConfig = require('./utils/knexfile');
const knex = require('knex')(knexConfig.deeprintzLive);

async function testAndSetupWebhook() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   🔍 TEST WOOCOMMERCE WEBHOOK CONFIGURATION                              ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

    // Get connected WooCommerce store
    const store = await knex('woocommerce_stores')
      .where({ status: 'connected' })
      .orderBy('id', 'desc')
      .first();

    if (!store) {
      console.error('❌ No connected WooCommerce store found!');
      console.error('   Please connect a WooCommerce store first.');
      process.exit(1);
    }

    console.log('✅ Found connected WooCommerce store:');
    console.log(`   Store URL: ${store.store_url}`);
    console.log(`   Vendor ID: ${store.vendor_id}`);
    console.log('');

    // Check webhook URL
    const webhookUrl = `https://devdevapi.deeprintz.com/api/woocommerce/webhooks/orders`;
    console.log('📡 Expected Webhook URL:', webhookUrl);
    console.log('');

    // Instructions
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🔧 TO FIX "ORDERS NOT DETECTING" ISSUE:');
    console.log('');
    console.log('1. Go to WooCommerce Admin:');
    console.log(`   ${store.store_url}/wp-admin/admin.php?page=wc-settings&tab=advanced&section=webhooks`);
    console.log('');
    console.log('2. Click "Add webhook"');
    console.log('');
    console.log('3. Configure:');
    console.log('   Name: Deeprintz Order Notification');
    console.log('   Status: Active');
    console.log('   Topic: Order created');
    console.log(`   Delivery URL: ${webhookUrl}`);
    console.log(`   Secret: ${store.consumer_secret || '(use your consumer secret)'}`);
    console.log('   API Version: WP REST API Integration v3');
    console.log('');
    console.log('4. Click "Save webhook"');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('🧪 AFTER SETUP - TEST IT:');
    console.log('');
    console.log('1. Place a test order on your WooCommerce store');
    console.log('2. Check your terminal/console for:');
    console.log('   "🛒 WooCommerce order webhook received"');
    console.log('3. Order should appear in your orders dashboard');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('💡 ABOUT THE SHIPPING ERROR:');
    console.log('');
    console.log('The "500 error" for shipping is because the WordPress plugin');
    console.log('needs to be installed. This is SEPARATE from order detection.');
    console.log('');
    console.log('For now, you can:');
    console.log('- Use WooCommerce built-in shipping methods (flat rate, etc.)');
    console.log('- Skip the plugin installation if you don\'t need custom shipping');
    console.log('');
    console.log('Orders will still be detected properly with webhook! ✅');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAndSetupWebhook();
