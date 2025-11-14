const knex = require("knex");
const config = require("./utils/knexfile");

async function testDatabaseConnection() {
  console.log("Testing database connection...");
  
  try {
    // Test the live configuration
    console.log("Testing deeprintzLive configuration...");
    const liveConnection = knex(config.deeprintzLive);
    
    // Test basic connectivity
    const result = await liveConnection.raw('SELECT 1 as test, NOW() as current_time');
    console.log("✅ Live database connection successful:", result[0][0]);
    
    // Test a simple query
    const tables = await liveConnection.raw('SHOW TABLES');
    console.log("✅ Found", tables[0].length, "tables in the database");
    
    // Test connection to orders table (used in deleteTestOrders)
    const orderCount = await liveConnection('orders').count('* as count').first();
    console.log("✅ Orders table accessible, total orders:", orderCount.count);
    
    // Close the connection
    await liveConnection.destroy();
    console.log("✅ Connection closed successfully");
    
    console.log("\n🎉 All database tests passed! The ETIMEDOUT issue should be resolved.");
    
  } catch (error) {
    console.error("❌ Database connection test failed:");
    console.error("Error type:", error.code || error.name);
    console.error("Error message:", error.message);
    
    if (error.code === 'ETIMEDOUT') {
      console.error("\n💡 ETIMEDOUT error still occurring. Possible solutions:");
      console.error("1. Check if the database server is running");
      console.error("2. Verify network connectivity to the database host");
      console.error("3. Check firewall settings");
      console.error("4. Increase timeout values in knexfile.js");
      console.error("5. Contact your database administrator");
    }
  }
}

// Run the test
testDatabaseConnection(); 