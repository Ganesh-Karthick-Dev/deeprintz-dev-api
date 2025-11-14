const knex = require("knex");

module.exports.deleteTestOrders = async (req, res) => {
  try {
    const db = knex({
      client: "mysql2",
      connection: {
        host: '68.183.59.159',
        user: 'rgvmknndvr',
        password: 'ggj76gXxNw',
        database: 'rgvmknndvr',
      },
      debug: false
    });

    const { orderids } = req.body;

    // Array of orderids to delete
    //   const orderids = ["1461_1005", "1461_1006"];

    // Step 1: Get the orderheaderid for the given orderids
    const orderHeaderIds = await db("orders")
      .select("orderheaderid")
      .whereIn("orders.orderid", orderids);

    if (orderHeaderIds.length === 0) {
      console.log("No orders found for the provided orderids.");
      return res.send({status : false , message : 'No orders found for the provided orderids.'})
    }

    const orderheaderids = orderHeaderIds.map((order) => order.orderheaderid);

    // Step 2: Delete related records from other tables based on the orderheaderid

    // Deleting from tenantinvoice
    await db("tenantinvoice").whereIn("orderheaderid", orderheaderids).del();

    // Deleting from orderlogs
    await db("orderslog").whereIn("orderheaderid", orderheaderids).del();

    // Deleting from ordered_items
    await db("ordered_items").whereIn("orderheaderid", orderheaderids).del();

    // Deleting from orderdetails
    await db("orderdetails").whereIn("orderheaderid", orderheaderids).del();

    // Deleting from deliveries
    await db("deliveries").whereIn("orderheaderid", orderheaderids).del();

    // Step 3: Finally, delete the order from the orders table using the orderid
    const result = await db("orders").whereIn("orderid", orderids).del();
    console.log("Successfully deleted the order and related records.");

    return result ? res.send({status : true , message : 'test orders deleted successfully'}) : res.send({status : false , message : 'something is wrong !'})

  } catch (error) {
    console.log(`deleteTestOrders - `, error);
  }
};

// this.deleteTestOrders();
