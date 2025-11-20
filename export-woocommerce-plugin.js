/**
 * Export WooCommerce Shipping Plugin for Manual Installation
 * This extracts your friend's plugin code and creates a downloadable file
 * 
 * Run: node export-woocommerce-plugin.js
 */

const fs = require('fs');
const path = require('path');
const knexConfig = require('./utils/knexfile');
const knex = require('knex')(knexConfig.deeprintzLive);

// Import the plugin generation function from controller
const woocommerceController = require('./controllers/woocommerce/index');

async function exportPlugin() {
  try {
    console.log('╔══════════════════════════════════════════════════════════════════════════╗');
    console.log('║   📦 EXPORT WOOCOMMERCE PLUGIN (YOUR FRIEND\'S WORK!)                    ║');
    console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

    // Get vendor info
    const store = await knex('woocommerce_stores')
      .where({ status: 'connected' })
      .orderBy('id', 'desc')
      .first();

    if (!store) {
      console.error('❌ No connected WooCommerce store found!');
      process.exit(1);
    }

    const userId = store.vendor_id || store.user_id || 2004;
    
    console.log('✅ Found WooCommerce store:');
    console.log(`   Store: ${store.store_url}`);
    console.log(`   User ID: ${userId}`);
    console.log('');

    // Use the actual plugin generation function from controller
    const pluginResult = await woocommerceController.createEnhancedShippingPlugin(store, userId);
    const pluginContent = pluginResult.content;

    // Save plugin file
    const pluginDir = path.join(__dirname, 'woocommerce-plugins');
    if (!fs.existsSync(pluginDir)) {
      fs.mkdirSync(pluginDir, { recursive: true });
    }

    const pluginFileName = `deeprintz-courier-shipping.php`;
    const pluginFilePath = path.join(pluginDir, pluginFileName);
    
    fs.writeFileSync(pluginFilePath, pluginContent);
    
    console.log('✅ Plugin file created!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('📁 Plugin Location:');
    console.log(`   ${pluginFilePath}`);
    console.log('');
    console.log('🔧 HOW TO INSTALL:');
    console.log('');
    console.log('1. Download the plugin file from above location');
    console.log('2. Go to WordPress Admin:');
    console.log(`   ${store.store_url}/wp-admin/plugins.php`);
    console.log('3. Click "Add New" → "Upload Plugin"');
    console.log('4. Choose the file and click "Install Now"');
    console.log('5. Click "Activate Plugin"');
    console.log('');
    console.log('OR via FTP:');
    console.log(`1. Upload to: /wp-content/plugins/deeprintz-courier-shipping/`);
    console.log('2. Activate in WordPress Admin → Plugins');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    console.log('✅ This is your friend\'s custom checkout code!');
    console.log('   It shows real Nimbuspost rates at checkout');
    console.log('');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    process.exit(1);
  }
}

exportPlugin();

