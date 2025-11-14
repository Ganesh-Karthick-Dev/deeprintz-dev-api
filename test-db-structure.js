const knex = require('knex');

// Test and fix database structure
async function testAndFixDatabase() {
  try {
    console.log('🔍 Testing database structure...');
    
    // Test basic connection
    const result = await global.dbConnection.raw('SELECT 1 as test');
    console.log('✅ Database connection successful:', result[0][0]);
    
    // Check if woocommerce_frontend_shipping table exists
    const tableExists = await global.dbConnection.schema.hasTable('woocommerce_frontend_shipping');
    console.log('📋 woocommerce_frontend_shipping table exists:', tableExists);
    
    if (!tableExists) {
      console.log('❌ Table missing - needs to be created');
      console.log('Run the CREATE TABLE command from the migration file');
    }
    
    // Check if woocommerce_orders table has correct woo_order_id type
    try {
      const orderColumns = await global.dbConnection('woocommerce_orders').columnInfo();
      console.log('📋 woocommerce_orders columns:', Object.keys(orderColumns));
      
      if (orderColumns.woo_order_id) {
        console.log('📋 woo_order_id column type:', orderColumns.woo_order_id.type);
        if (orderColumns.woo_order_id.type === 'int') {
          console.log('⚠️ woo_order_id is INT but should be VARCHAR - needs ALTER TABLE');
        }
      }
    } catch (error) {
      console.log('❌ Could not check woocommerce_orders table:', error.message);
    }
    
    // Check if users table has role column
    try {
      const userColumns = await global.dbConnection('users').columnInfo();
      console.log('📋 users table columns:', Object.keys(userColumns));
      
      if (!userColumns.role) {
        console.log('❌ users table missing role column - needs ALTER TABLE');
      }
    } catch (error) {
      console.log('❌ Could not check users table:', error.message);
    }
    
    // Check if woocommerce_stores table exists and has vendor 1039
    try {
      const storesTableExists = await global.dbConnection.schema.hasTable('woocommerce_stores');
      console.log('📋 woocommerce_stores table exists:', storesTableExists);
      
      if (storesTableExists) {
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
      console.log('❌ Could not check woocommerce_stores table:', error.message);
    }
    
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
  }
}

// Run the test
testAndFixDatabase();
