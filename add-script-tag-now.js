const ModernShopifyController = require('./controllers/shopify/modernController');

async function addScriptTag() {
  try {
    console.log('🚀 Adding shipping script as Shopify Script Tag...');
    
    const controller = new ModernShopifyController();
    
    // Mock shop object
    const shop = {
      shop_domain: 'myn11.myshopify.com',
      access_token: 'YOUR_ACCESS_TOKEN' // You'll need to replace this
    };
    
    const userId = '1039';
    
    // Use your existing method
    const result = await controller.setupShippingCalculatorForVendor(shop, userId);
    
    console.log('✅ Script Tag added successfully!');
    console.log('📋 Result:', result);
    
  } catch (error) {
    console.error('❌ Error adding Script Tag:', error.message);
    console.log('💡 Make sure you have a valid access token for your Shopify app');
  }
}

// Run the script
addScriptTag();
