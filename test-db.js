const knex = require('knex');

// Test database connection
async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test basic connection
    const result = await global.dbConnection.raw('SELECT 1 as test');
    console.log('✅ Database connection successful:', result[0][0]);
    
    // Check if woocommerce_frontend_shipping table exists
    const tableExists = await global.dbConnection.schema.hasTable('woocommerce_frontend_shipping');
    console.log('✅ woocommerce_frontend_shipping table exists:', tableExists);
    
    if (tableExists) {
      // Get table structure
      const columns = await global.dbConnection('woocommerce_frontend_shipping').columnInfo();
      console.log('✅ Table columns:', Object.keys(columns));
    }
    
    // Check if woocommerce_stores table exists
    const storesTableExists = await global.dbConnection.schema.hasTable('woocommerce_stores');
    console.log('✅ woocommerce_stores table exists:', storesTableExists);
    
    if (storesTableExists) {
      // Check for vendor 1039
      const store = await global.dbConnection('woocommerce_stores')
        .where('user_id', 1039)
        .first();
      
      if (store) {
        console.log('✅ Store found for vendor 1039:', {
          id: store.id,
          store_url: store.store_url,
          wp_username: store.wp_username,
          wp_api_enabled: store.wp_api_enabled
        });
      } else {
        console.log('❌ No store found for vendor 1039');
      }
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

// Run the test
testDatabase();
