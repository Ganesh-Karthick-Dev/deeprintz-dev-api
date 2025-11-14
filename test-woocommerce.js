const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// Test WooCommerce API connection
async function testWooCommerceAPI() {
  console.log('🧪 Testing WooCommerce API Integration...\n');

  // Test configuration
  const testConfig = {
    url: 'https://your-test-store.com', // Replace with actual test store URL
    consumerKey: 'ck_test_key',         // Replace with actual test consumer key
    consumerSecret: 'cs_test_secret',   // Replace with actual test consumer secret
    version: 'wc/v3',
    timeout: 10000
  };

  try {
    console.log('📡 Initializing WooCommerce API client...');
    const WooCommerce = new WooCommerceRestApi(testConfig);
    
    console.log('🔗 Testing connection to WooCommerce store...');
    const response = await WooCommerce.get("system_status");
    
    if (response.status === 200) {
      console.log('✅ Connection successful!');
      console.log('🏪 Store Name:', response.data.name);
      console.log('📦 WooCommerce Version:', response.data.version);
      console.log('🌐 Store URL:', testConfig.url);
      
      // Test getting products
      console.log('\n📋 Testing product retrieval...');
      const productsResponse = await WooCommerce.get("products", { per_page: 5 });
      
      if (productsResponse.status === 200) {
        console.log('✅ Products retrieved successfully!');
        console.log(`📊 Found ${productsResponse.data.length} products`);
        console.log(`📈 Total products: ${productsResponse.headers['x-wp-total']}`);
        
        if (productsResponse.data.length > 0) {
          console.log('\n📝 Sample product:');
          const sampleProduct = productsResponse.data[0];
          console.log(`   - Name: ${sampleProduct.name}`);
          console.log(`   - Price: ${sampleProduct.price}`);
          console.log(`   - SKU: ${sampleProduct.sku || 'N/A'}`);
          console.log(`   - Status: ${sampleProduct.status}`);
        }
      } else {
        console.log('❌ Failed to retrieve products');
      }
      
    } else {
      console.log('❌ Connection failed with status:', response.status);
    }
    
  } catch (error) {
    console.error('💥 Error testing WooCommerce API:', error.message);
    
    if (error.response) {
      console.error('📡 Response status:', error.response.status);
      console.error('📄 Response data:', error.response.data);
    }
    
    console.log('\n🔧 Troubleshooting tips:');
    console.log('1. Check if the store URL is correct and accessible');
    console.log('2. Verify consumer key and secret are valid');
    console.log('3. Ensure WooCommerce REST API is enabled');
    console.log('4. Check if the store has proper SSL certificate');
  }
}

// Test product creation (commented out for safety)
async function testProductCreation() {
  console.log('\n🚫 Product creation test is commented out for safety');
  console.log('To test product creation, uncomment the code below and use a test store');
  
  /*
  try {
    const WooCommerce = new WooCommerceRestApi(testConfig);
    
    const testProduct = {
      name: "Test Product - " + new Date().toISOString(),
      description: "This is a test product created via API",
      regular_price: "19.99",
      short_description: "Test product for API testing",
      categories: [],
      images: []
    };
    
    const response = await WooCommerce.post("products", testProduct);
    
    if (response.status === 201) {
      console.log('✅ Test product created successfully!');
      console.log('🆔 Product ID:', response.data.id);
      console.log('📝 Product Name:', response.data.name);
    }
    
  } catch (error) {
    console.error('❌ Error creating test product:', error.message);
  }
  */
}

// Run tests
async function runTests() {
  console.log('🚀 Starting WooCommerce Integration Tests\n');
  
  await testWooCommerceAPI();
  await testProductCreation();
  
  console.log('\n✨ Tests completed!');
  console.log('\n📚 Next steps:');
  console.log('1. Update the test configuration with real store details');
  console.log('2. Run the database migration: mysql -u username -p database < database/woocommerce_stores.sql');
  console.log('3. Test the API endpoints in your application');
  console.log('4. Check the README for detailed usage instructions');
}

// Check if running directly
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testWooCommerceAPI, testProductCreation };
