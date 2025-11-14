const axios = require('axios');

// Configuration
const BASE_URL = 'http://localhost:3000'; // Adjust to your server URL
const VENDOR_ID = 123; // Replace with actual vendor ID
const ORDER_ID = 456; // Replace with actual order ID

// Test functions
async function testGetVendorOrders() {
  try {
    console.log('Testing: Get Vendor Orders');
    const response = await axios.get(`${BASE_URL}/api/woocommerce/orders/vendor/${VENDOR_ID}?status=processing&per_page=10`);
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved orders');
      console.log(`Total orders: ${response.data.total_orders}`);
      console.log(`Orders found: ${response.data.orders.length}`);
      
      if (response.data.orders.length > 0) {
        const firstOrder = response.data.orders[0];
        console.log(`First order: #${firstOrder.order_number} - ${firstOrder.status} - $${firstOrder.total}`);
      }
    } else {
      console.log('❌ Failed to retrieve orders:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error getting vendor orders:', error.response?.data || error.message);
  }
}

async function testGetOrderById() {
  try {
    console.log('\nTesting: Get Order by ID');
    const response = await axios.get(`${BASE_URL}/api/woocommerce/orders/vendor/${VENDOR_ID}/order/${ORDER_ID}`);
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved order');
      const order = response.data.order;
      console.log(`Order #${order.order_number}: ${order.status} - $${order.total}`);
      console.log(`Customer: ${order.customer.first_name} ${order.customer.last_name}`);
      console.log(`Items: ${order.line_items.length} products`);
    } else {
      console.log('❌ Failed to retrieve order:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error getting order by ID:', error.response?.data || error.message);
  }
}

async function testUpdateOrderStatus() {
  try {
    console.log('\nTesting: Update Order Status');
    const response = await axios.put(`${BASE_URL}/api/woocommerce/orders/vendor/${VENDOR_ID}/order/${ORDER_ID}/status`, {
      status: 'processing',
      note: 'Order is being processed by vendor'
    });
    
    if (response.data.success) {
      console.log('✅ Successfully updated order status');
      console.log(`New status: ${response.data.order.status}`);
      console.log(`Updated at: ${response.data.order.date_modified}`);
    } else {
      console.log('❌ Failed to update order status:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error updating order status:', error.response?.data || error.message);
  }
}

async function testGetOrderStatistics() {
  try {
    console.log('\nTesting: Get Order Statistics');
    const response = await axios.get(`${BASE_URL}/api/woocommerce/orders/vendor/${VENDOR_ID}/statistics?period=30`);
    
    if (response.data.success) {
      console.log('✅ Successfully retrieved order statistics');
      const stats = response.data.statistics;
      console.log(`Period: Last ${response.data.period} days`);
      console.log(`Total orders: ${stats.total_orders}`);
      console.log(`Total revenue: $${stats.total_revenue}`);
      console.log(`Average order value: $${stats.average_order_value.toFixed(2)}`);
      
      console.log('\nOrders by status:');
      Object.entries(stats.orders_by_status).forEach(([status, count]) => {
        console.log(`  ${status}: ${count} orders`);
      });
    } else {
      console.log('❌ Failed to retrieve statistics:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error getting order statistics:', error.response?.data || error.message);
  }
}

async function testSyncOrders() {
  try {
    console.log('\nTesting: Sync Orders from WooCommerce');
    const response = await axios.post(`${BASE_URL}/api/woocommerce/orders/sync`, {
      vendor_id: VENDOR_ID,
      sync_all: false
    });
    
    if (response.data.success) {
      console.log('✅ Successfully synced orders');
      const summary = response.data.summary;
      console.log(`Orders fetched: ${summary.total_orders_fetched}`);
      console.log(`New orders synced: ${summary.new_orders_synced}`);
      console.log(`Existing orders updated: ${summary.existing_orders_updated}`);
      console.log(`Errors: ${summary.errors}`);
    } else {
      console.log('❌ Failed to sync orders:', response.data.message);
    }
  } catch (error) {
    console.error('❌ Error syncing orders:', error.response?.data || error.message);
  }
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting WooCommerce Order Management Tests\n');
  
  try {
    await testGetVendorOrders();
    await testGetOrderById();
    await testUpdateOrderStatus();
    await testGetOrderStatistics();
    await testSyncOrders();
    
    console.log('\n✨ All tests completed!');
  } catch (error) {
    console.error('\n💥 Test suite failed:', error.message);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests();
}

module.exports = {
  testGetVendorOrders,
  testGetOrderById,
  testUpdateOrderStatus,
  testGetOrderStatistics,
  testSyncOrders,
  runAllTests
};
