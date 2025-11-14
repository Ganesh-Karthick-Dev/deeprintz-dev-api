const crypto = require('crypto');
const _ = require('lodash');

// Simple webhook handler - no database operations needed for shipping calculation
module.exports.handleOrderWebhook = async (req, res) => {
  try {

    const topic = req.headers['x-wc-webhook-topic'];
    const resource = req.headers['x-wc-webhook-resource'];
    const event = req.headers['x-wc-webhook-event'];
    const resourceId = req.body.id;

    if (req.headers['x-wc-webhook-signature']) {
      const signature = req.headers['x-wc-webhook-signature'];
      const payload = JSON.stringify(req.body);

      let receivedSignature = signature;

      const expectedSignature = crypto
        .createHmac('sha256', process.env.WOOCOMMERCE_WEBHOOK_SECRET || 'default-secret')
        .update(payload)
        .digest('base64');

      if (receivedSignature !== expectedSignature) {
        const expectedSignatureHex = crypto
          .createHmac('sha256', process.env.WOOCOMMERCE_WEBHOOK_SECRET || 'default-secret')
          .update(payload)
          .digest('hex');
      } else {
        console.log('✅ Webhook signature verified successfully');
      }
    } else {
      console.log('ℹ️ No webhook signature received - proceeding without verification');
    }

    console.log("🚀 WooCommerce webhook req.body", req.body);

    const storedOrderId = await storeOrderWithProductDetails(req.body);

    // // Handle different webhook topics based on WooCommerce headers
    // if (topic === 'order.created' || event === 'created') {
    //   await handleOrderCreated(req.body);
    // } else if (topic === 'order.updated' || event === 'updated') {
    //   await handleOrderUpdated(req.body);
    // } else if (topic === 'order.deleted' || event === 'deleted') {
    //   await handleOrderDeleted(req.body);
    // } else if (topic === 'order.restored' || event === 'restored') {
    //   await handleOrderRestored(req.body);
    // } else {
    //   console.log(`ℹ️ Unhandled webhook topic: ${topic} (event: ${event})`);
    //   // Try to handle based on event type if topic is not clear
    //   if (event === 'created') {
    //     await handleOrderCreated(req.body);
    //   }
    // }

    // Acknowledge webhook receipt
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      topic: topic,
      event: event,
      resource: resource,
      resource_id: resourceId,
      //  stored_order_id: storedOrderId
    });

  } catch (error) {
    console.error('❌ Error processing WooCommerce webhook:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

// Export other webhook handlers if needed (but they won't be used for shipping)
module.exports.handleShippingWebhook = async (req, res) => {
  try {
    console.log('🚚 Shipping webhook received');
    res.status(200).json({ success: true, message: 'Shipping webhook received' });
  } catch (error) {
    console.error('❌ Error in shipping webhook:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Product webhook handler - no database operations
module.exports.handleProductWebhook = async (req, res) => {
  try {
    console.log('📦 Product webhook received');
    if (req.body && req.body.id) {
      console.log(`📦 Product ID: ${req.body.id}`);
      console.log(`📦 Product Name: ${req.body.name || 'N/A'}`);
      console.log(`📦 Product Status: ${req.body.status || 'N/A'}`);
    }
    res.status(200).json({ success: true, message: 'Product webhook received' });
  } catch (error) {
    console.error('❌ Error in product webhook:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Customer webhook handler - no database operations
module.exports.handleCustomerWebhook = async (req, res) => {
  try {
    console.log('👤 Customer webhook received');
    if (req.body && req.body.id) {
      console.log(`👤 Customer ID: ${req.body.id}`);
      console.log(`👤 Customer Email: ${req.body.email || 'N/A'}`);
      console.log(`👤 Customer Name: ${req.body.first_name || ''} ${req.body.last_name || ''}`);
    }
    res.status(200).json({ success: true, message: 'Customer webhook received' });
  } catch (error) {
    console.error('❌ Error in customer webhook:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Test signature verification webhook handler
module.exports.testSignatureVerification = async (req, res) => {
  try {
    console.log('🧪 Testing webhook signature verification');
    res.status(200).json({ success: true, message: 'Signature verification test endpoint' });
  } catch (error) {
    console.error('❌ Error in signature test:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

// Test store API webhook handler
module.exports.testStoreAPI = async (req, res) => {
  try {
    console.log('🧪 Testing store API');
    res.status(200).json({ success: true, message: 'Store API test endpoint' });
  } catch (error) {
    console.error('❌ Error in store API test:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};

async function storeWooCommerceOrder(orderData, vendorId) {
  try {
    //const orderData = req.body;

    let storeUrl = null;

    // ✅ Extract store URL
    if (orderData?.meta_data) {
      const entryMeta = orderData.meta_data.find(
        (meta) => meta.key === "_wc_order_attribution_session_entry"
      );
      if (entryMeta?.value) {
        try {
          const url = new URL(entryMeta.value);
          storeUrl = `${url.protocol}//${url.hostname}`;
        } catch (err) {
          console.error("Invalid URL in meta_data:", entryMeta.value);
        }
      }
    }

    // ✅ Fallback to payment_url
    if (!storeUrl && orderData?.payment_url) {
      const url = new URL(orderData.payment_url);
      storeUrl = `${url.protocol}//${url.hostname}`;
    }

    // ✅ Fetch user details
    const userDetails = await global.dbConnection("woocommerce_stores")
      .leftJoin("app_users", "woocommerce_stores.user_id", "app_users.userid")
      .where("woocommerce_stores.store_url", storeUrl)
      .select("app_users.userid as userId")
      .first();

    console.log("🚀 WooCommerce webhook userDetails", userDetails);

    // ✅ Build ordered product details
    let orderedProductOverAllDetails = [];
    if (orderData?.line_items && Array.isArray(orderData.line_items)) {
      orderedProductOverAllDetails = await Promise.all(
        orderData.line_items.map(async (item) => {
          const localProducts = await global
            .dbConnection("woocommerce_products_sync")
            .leftJoin(
              "shopify_products",
              "shopify_products.id",
              "woocommerce_products_sync.local_product_id"
            )
            .leftJoin(
              "products",
              "products.productid",
              "shopify_products.productid"
            )
            .where("woocommerce_products_sync.woo_product_id", item.product_id)
            .select(
              "woocommerce_products_sync.woo_product_id",
              "shopify_products.id as shopify_product_id",
              "shopify_products.productcost as shopify_product_cost",
              "shopify_products.plain as shopify_product_plain",
              "shopify_products.position as shopify_product_position",
              "shopify_products.width as shopify_product_width",
              "shopify_products.height as shopify_product_height",
              "shopify_products.designurl as shopify_design_url",
              "shopify_products.variants as shopify_variants",
              "products.productid as deeprintz_product_id",
              "products.productcategoryid as deeprintz_product_category_id",
              "products.productname as deeprintz_product_name",
              "products.productdesc as deeprintz_product_desc",
              "products.productstock as deeprintz_product_stock",
              "products.productcost as deeprintz_product_cost",
              "products.othercost",
              "products.handlingcost as deeprintz_product_handling_cost",
              "products.retailprice as deeprintz_product_retail_price",
              "products.productsku as deeprintz_product_sku",
              "products.baseprice as deeprintz_product_base_price"
            )
            .first();

          let shopifyVariants = [];
          try {
            shopifyVariants = localProducts?.shopify_variants
              ? JSON.parse(localProducts.shopify_variants)
              : [];
          } catch (e) {
            console.error("Invalid JSON in shopify_variants:", localProducts?.shopify_variants);
            shopifyVariants = [];
          }

          return {
            wooProductId: localProducts?.woo_product_id || null,
            shopifyProductId: localProducts?.shopify_product_id || null,
            deeprintzProductId: localProducts?.deeprintz_product_id || null,
            deeprintzProductCategoryId:
              localProducts?.deeprintz_product_category_id || null,
            deeprintzProductName: localProducts?.deeprintz_product_name || null,
            deeprintzProductDesc: localProducts?.deeprintz_product_desc || null,
            deeprintzProductStock:
              localProducts?.deeprintz_product_stock || null,
            deeprintzProductCost: localProducts?.deeprintz_product_cost || null,
            deeprintzProductHandlingCost:
              localProducts?.deeprintz_product_handling_cost || null,
            deeprintzProductRetailPrice:
              localProducts?.deeprintz_product_retail_price || null,
            deeprintzProductSku: localProducts?.deeprintz_product_sku || null,
            deeprintzProductBasePrice:
              localProducts?.deeprintz_product_base_price || null,

            // 🛒 From order line item
            shopifyOrderProductId: item.product_id,
            shopifyOrderVariationId: item.variation_id,
            shopifyOrderProductSku: item.sku,
            shopifyOrderProductPrice: item.price,
            shopifyOrderProductQuantity: item.quantity,
            n: item.shopify_design_url,
            shopifyOrderProductTotal: item.total,

            shopifyVariants
          };
        })
      );
    }
    const paymentMethod = orderData?.payment_method;
    const customerNote = orderData?.customer_note;
    const billingAddress = orderData?.billing ? JSON.stringify(orderData.billing) : "{}";
    const shippingAddress = orderData?.shipping ? JSON.stringify(orderData.shipping) : "{}";

    // 🗄️ Store order in woocommerce_orders table
    let storedOrderId;
    try {
      // Check if woocommerce_orders table exists
      const ordersTableExists = await global.dbConnection.schema.hasTable('woocommerce_orders');
      if (!ordersTableExists) {
        console.log('ℹ️ woocommerce_orders table does not exist, creating it...');
        await createWooCommerceOrdersTable();
      }

      // Create a mock order record for testing
      const orderRecord = {
        vendor_id: vendorId || userDetails?.userId || 0,
        woo_order_id: `WOO-ORD${orderData.id || Math.floor(Math.random() * 1000000)}`, // Generate random ID for testing with W-ORD prefix
        order_number: orderData.number || `TEST_${Date.now()}`,
        status: orderData.status || 'pending',
        date_created: orderData.date_created || new Date(),
        date_modified: orderData.date_modified || new Date(),
        total: orderData.total || 480.00,
        subtotal: orderData.subtotal || 480.00,
        total_tax: orderData.total_tax || 0,
        shipping_total: orderData.shipping_total || 0,
        discount_total: orderData.discount_total || 0,
        currency: orderData.currency || 'INR',
        customer_id: orderData.customer_id || null,
        customer_email: orderData.billing?.email || 'care@deeprintz.com',
        customer_name: orderData.billing ? `${orderData.billing.first_name || ''} ${orderData.billing.last_name || ''}`.trim() : 'test M',
        billing_address: billingAddress,
        shipping_address: shippingAddress,
        payment_method: paymentMethod || 'cod',
        payment_method_title: orderData.payment_method_title || 'Cash on Delivery',
        transaction_id: orderData.transaction_id || null,
        customer_note: customerNote || '',
        line_items: JSON.stringify(orderedProductOverAllDetails),
        synced_at: new Date(),
        webhook_received: true,
        needs_vendor_assignment: !vendorId,
        order_source: 'woocommerce',
        // Additional fields for better tracking
        order_key: orderData.order_key || null,
        parent_id: orderData.parent_id || null,
        version: orderData.version || null,
        prices_include_tax: orderData.prices_include_tax || false,
        discount_codes: JSON.stringify(orderData.discount_codes || []),
        coupon_lines: JSON.stringify(orderData.coupon_lines || []),
        fee_lines: JSON.stringify(orderData.fee_lines || []),
        shipping_lines: JSON.stringify(orderData.shipping_lines || []),
        tax_lines: JSON.stringify(orderData.tax_lines || []),
        refunds: JSON.stringify(orderData.refunds || []),
        meta_data: JSON.stringify(orderData.meta_data || [])
      };

      // Check if order already exists
      const existingOrder = await global.dbConnection('woocommerce_orders')
        .where('woo_order_id', orderRecord.woo_order_id)
        .first();

      if (existingOrder) {
        // Update existing order
        await global.dbConnection('woocommerce_orders')
          .where('id', existingOrder.id)
          .update(orderRecord);
        storedOrderId = existingOrder.id;
        console.log(`🔄 Order ${orderRecord.order_number} updated in woocommerce_orders table`);
      } else {
        // Insert new order
        const [newOrderId] = await global.dbConnection('woocommerce_orders').insert(orderRecord);
        storedOrderId = newOrderId;
        console.log(`💾 Order ${orderRecord.order_number} inserted in woocommerce_orders table with ID: ${newOrderId}`);
      }

      // 🗄️ Store order items in woocommerce_order_items table
      if (storedOrderId && orderedProductOverAllDetails.length > 0) {
        await storeProcessedOrderProductDetails(storedOrderId, orderedProductOverAllDetails);
      }

    } catch (dbError) {
      console.error('❌ Error storing order in database:', dbError);
      return null
    }

    // return res.json({
    //   success: true,
    //   message: 'Order stored successfully in database',
    //   storedOrderId,
    //   storeUrl,
    //   userDetails,
    //   orderedProductOverAllDetails,
    //   paymentMethod,
    //   customerNote,
    //   billingAddress,
    //   shippingAddress
    // });
    return true;
  } catch (error) {
    console.error("❌ Error testing signature verification:", error);
    return res.status(500).json({
      success: false,
      message: "Error testing signature verification",
      error: error.message
    });
  }
};

async function storeOrderWithProductDetails(orderData) {
  try {

    const vendorId = await extractVendorFromOrder(orderData);
    console.log("vendorId", vendorId);
    const orderRecord = {
      vendor_id: vendorId || 0,
      woo_order_id: orderData.id,
      order_number: orderData.number,
      status: orderData.status,
      date_created: orderData.date_created,
      date_modified: orderData.date_modified,
      total: orderData.total,
      subtotal: orderData.subtotal,
      total_tax: orderData.total_tax || 0,
      shipping_total: orderData.shipping_total || 0,
      discount_total: orderData.discount_total || 0,
      currency: orderData.currency,
      customer_id: orderData.customer_id,
      customer_email: orderData.billing?.email,
      customer_name: `${orderData.billing?.first_name || ''} ${orderData.billing?.last_name || ''}`.trim(),
      billing_address: JSON.stringify(orderData.billing || {}),
      shipping_address: JSON.stringify(orderData.shipping || {}),
      payment_method: orderData.payment_method,
      payment_method_title: orderData.payment_method_title,
      transaction_id: orderData.transaction_id,
      customer_note: orderData.customer_note,
      line_items: JSON.stringify(orderData.line_items || []),
      synced_at: new Date(),
      webhook_received: true,
      needs_vendor_assignment: !vendorId,
      // Additional fields for better tracking
      order_key: orderData.order_key,
      parent_id: orderData.parent_id,
      version: orderData.version,
      prices_include_tax: orderData.prices_include_tax,
      discount_codes: JSON.stringify(orderData.discount_codes || []),
      coupon_lines: JSON.stringify(orderData.coupon_lines || []),
      fee_lines: JSON.stringify(orderData.fee_lines || []),
      shipping_lines: JSON.stringify(orderData.shipping_lines || []),
      tax_lines: JSON.stringify(orderData.tax_lines || []),
      refunds: JSON.stringify(orderData.refunds || []),
      meta_data: JSON.stringify(orderData.meta_data || [])
    };
    //console.log('🚀 WooCommerce webhook orderRecord', orderRecord);
    //console.log('🚀 WooCommerce webhook orderData', orderData);
    const storedOrderId = await storeWooCommerceOrder(orderData, vendorId);

  } catch (error) {
    console.error('❌ Error storing order with product details:', error);
    throw error;
  }
}

async function extractVendorFromOrder(orderData) {
  try {
    if (!orderData?.payment_url) {
      console.log("⚠️ No payment_url found in order");
      return null;
    }

    // ✅ Extract base URL
    const url = new URL(orderData.payment_url);
    const storeUrl = `${url.protocol}//${url.hostname}`;

    // ✅ Query using whereIn (single value)
    const userDetails = await global.dbConnection("woocommerce_stores")
      .leftJoin("app_users", "woocommerce_stores.user_id", "app_users.userid")
      .whereIn("woocommerce_stores.store_url", [storeUrl, `${storeUrl}/`])
      .select("app_users.userid as userId")
      .first();

    if (userDetails?.userId) {
      console.log(`🔍 Found vendor ID from store URL: ${userDetails.userId}`);
      return userDetails.userId;
    }

    console.log(`⚠️ No vendor ID found for store URL: ${storeUrl}`);
    return null;
  } catch (error) {
    console.error("❌ Error extracting vendor from order:", error);
    return null;
  }
}

async function extractVendorFromProduct(productId, storeUrl) {
  try {
    if (!productId || !storeUrl) {
      return null;
    }

    // Get store credentials
    const store = await global.dbConnection("woocommerce_stores")
      .where("store_url", storeUrl)
      .where("status", "connected")
      .first();

    if (!store) {
      console.log(`⚠️ No store found for URL: ${storeUrl}`);
      return null;
    }

    // Initialize WooCommerce API client
    const WooCommerceRestApi = require('@woocommerce/woocommerce-rest-api').default;
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: 'wc/v3',
      timeout: 30000
    });

    // Fetch product details from WooCommerce
    const response = await WooCommerce.get(`products/${productId}`);

    if (response.status === 200 && response.data) {
      const product = response.data;

      // Check product meta_data for vendor information
      if (product.meta_data && Array.isArray(product.meta_data)) {
        const vendorMeta = product.meta_data.find(meta =>
          meta.key === '_vendor_user_id' ||
          meta.key === '_vendor_id' ||
          meta.key === 'vendor_id' ||
          meta.key === 'vendor'
        );

        if (vendorMeta && vendorMeta.value) {
          console.log(`🔍 Found vendor ID in product ${productId} meta_data: ${vendorMeta.value}`);
          return vendorMeta.value;
        }
      }
    }

    return null;
  } catch (error) {
    console.error(`❌ Error extracting vendor from product ${productId}:`, error);
    return null;
  }
}

async function verifyVendorExists(vendorId) {
  try {
    // Check if vendor exists in your system
    // const vendor = await global.dbConnection('users')
    //   .where('id', vendorId)
    //   .where('role', 'vendor')
    //   .first();

    return true;
  } catch (error) {
    console.error('❌ Error verifying vendor exists:', error);
    return false;
  }
}

async function createWooCommerceOrdersTable() {
  try {
    console.log('🔧 Creating woocommerce_orders table...');

    const tableExists = await global.dbConnection.schema.hasTable('woocommerce_orders');
    if (tableExists) {
      console.log('ℹ️ woocommerce_orders table already exists');
      return;
    }

    await global.dbConnection.schema.createTable('woocommerce_orders', (table) => {
      table.increments('id').primary();
      table.integer('vendor_id').notNullable().defaultTo(0);
      table.bigInteger('woo_order_id').notNullable();
      table.string('order_number', 255).notNullable();
      table.string('status', 100).notNullable();
      table.datetime('date_created').notNullable();
      table.datetime('date_modified').notNullable();
      table.decimal('total', 10, 2).notNullable();
      table.decimal('subtotal', 10, 2).notNullable();
      table.decimal('total_tax', 10, 2).notNullable().defaultTo(0);
      table.decimal('shipping_total', 10, 2).notNullable().defaultTo(0);
      table.decimal('discount_total', 10, 2).notNullable().defaultTo(0);
      table.string('currency', 10).notNullable().defaultTo('USD');
      table.bigInteger('customer_id').nullable();
      table.string('customer_email', 255).nullable();
      table.string('customer_name', 255).nullable();
      table.text('billing_address').nullable();
      table.text('shipping_address').nullable();
      table.string('payment_method', 100).nullable();
      table.string('payment_method_title', 255).nullable();
      table.string('transaction_id', 255).nullable();
      table.text('customer_note').nullable();
      table.text('line_items').nullable();
      table.datetime('synced_at').notNullable();
      table.boolean('webhook_received').notNullable().defaultTo(false);
      table.boolean('needs_vendor_assignment').notNullable().defaultTo(false);
      table.boolean('converted_to_website_order').notNullable().defaultTo(false);
      table.datetime('converted_at').nullable();
      table.integer('website_order_id').nullable();
      table.string('order_source', 50).notNullable().defaultTo('woocommerce');
      table.string('stage_workflow_status', 100).nullable();
      table.string('order_key', 255).nullable();
      table.bigInteger('parent_id').nullable();
      table.string('version', 50).nullable();
      table.boolean('prices_include_tax').notNullable().defaultTo(false);
      table.text('discount_codes').nullable();
      table.text('coupon_lines').nullable();
      table.text('fee_lines').nullable();
      table.text('shipping_lines').nullable();
      table.text('tax_lines').nullable();
      table.text('refunds').nullable();
      table.text('meta_data').nullable();
      table.timestamps(true, true);

      table.unique(['vendor_id', 'woo_order_id'], 'unique_vendor_order');
      table.index('vendor_id', 'idx_vendor_id');
      table.index('woo_order_id', 'idx_woo_order_id');
      table.index('status', 'idx_status');
      table.index('date_created', 'idx_date_created');
      table.index('synced_at', 'idx_synced_at');
      table.index('webhook_received', 'idx_webhook_received');
    });

    console.log('✅ woocommerce_orders table created successfully');
  } catch (error) {
    console.error('❌ Error creating woocommerce_orders table:', error);
    throw error;
  }
}

// Helper function to extract size from line item data
function extractSizeFromLineItem(item) {
  try {
    console.log(`🔍 Extracting size for product ${item.wooProductId}, SKU: ${item.shopifyOrderProductSku}`);

    // First, try to get size from WooCommerce line item meta_data
    if (item.meta_data && Array.isArray(item.meta_data)) {
      console.log(`📋 Checking meta_data for size:`, item.meta_data);
      const sizeMeta = item.meta_data.find(meta =>
        meta.key === 'Size' ||
        meta.key === 'size' ||
        meta.key === 'pa_size' ||
        meta.key === 'attribute_pa_size'
      );
      if (sizeMeta && sizeMeta.value) {
        console.log(`✅ Found size in meta_data: ${sizeMeta.value}`);
        return sizeMeta.value;
      }
    }

    // Try to get size from shopifyVariants if available
    if (item.shopifyVariants && Array.isArray(item.shopifyVariants)) {
      console.log(`📋 Checking shopifyVariants for size:`, item.shopifyVariants);
      // Find the variant that matches the variation_id or SKU
      const matchingVariant = item.shopifyVariants.find(variant => {
        // Match by variation_id if available
        if (item.shopifyOrderVariationId && variant.variation_id === item.shopifyOrderVariationId) {
          return true;
        }
        // Match by SKU if available
        if (item.shopifyOrderProductSku && variant.sizesku === item.shopifyOrderProductSku.split('-').pop()) {
          return true;
        }
        return false;
      });

      if (matchingVariant && matchingVariant.size) {
        console.log(`✅ Found size in shopifyVariants: ${matchingVariant.size}`);
        return matchingVariant.size;
      }
    }

    // Try to extract size from SKU pattern (e.g., DP-11-S, DP-11-M, DP-11-L)
    if (item.shopifyOrderProductSku) {
      const skuParts = item.shopifyOrderProductSku.split('-');
      if (skuParts.length >= 3) {
        const sizeCode = skuParts[skuParts.length - 1]; // Last part is usually the size
        // Map common size codes to full names
        const sizeMap = {
          'XS': 'Extra Small',
          'S': 'Small',
          'M': 'Medium',
          'L': 'Large',
          'XL': 'Extra Large',
          'XXL': 'Double Extra Large',
          'XXXL': 'Triple Extra Large'
        };
        const extractedSize = sizeMap[sizeCode] || sizeCode;
        console.log(`✅ Found size from SKU pattern: ${extractedSize} (from ${sizeCode})`);
        return extractedSize;
      }
    }

    console.log(`⚠️ No size found for product ${item.wooProductId}`);
    return null;
  } catch (error) {
    console.error('❌ Error extracting size from line item:', error);
    return null;
  }
}

async function storeProcessedOrderProductDetails(orderId, processedProducts) {
  try {
    console.log(`📦 Storing processed product details for order ID: ${orderId}`);

    // Check if woocommerce_order_items table exists
    const tableExists = await global.dbConnection.schema.hasTable('woocommerce_order_items');

    if (!tableExists) {
      console.log('ℹ️ woocommerce_order_items table does not exist, creating it...');
      await createWooCommerceOrderItemsTable();
    }

    // Store each processed product
    for (const product of processedProducts) {
      const productRecord = {
        order_id: orderId,
        woo_order_id: product.wooProductId || 0,
        product_id: product.shopifyOrderProductId || product.wooProductId || 0,
        variation_id: product.shopifyOrderVariationId || 0,
        name: product.deeprintzProductName || 'Unknown Product',
        quantity: product.shopifyOrderProductQuantity || 1,
        tax_class: '',
        subtotal: product.shopifyOrderProductTotal || 0,
        subtotal_tax: 0,
        total: product.shopifyOrderProductTotal || 0,
        total_tax: 0,
        sku: product.shopifyOrderProductSku || product.deeprintzProductSku || '',
        price: product.shopifyOrderProductPrice || 0,
        meta_data: JSON.stringify({
          wooProductId: product.wooProductId,
          shopifyProductId: product.shopifyProductId,
          deeprintzProductId: product.deeprintzProductId,
          deeprintzProductCategoryId: product.deeprintzProductCategoryId,
          deeprintzProductDesc: product.deeprintzProductDesc,
          deeprintzProductStock: product.deeprintzProductStock,
          deeprintzProductCost: product.deeprintzProductCost,
          deeprintzProductHandlingCost: product.deeprintzProductHandlingCost,
          deeprintzProductRetailPrice: product.deeprintzProductRetailPrice,
          deeprintzProductBasePrice: product.deeprintzProductBasePrice,
          shopifyVariants: product.shopifyVariants
        }),
        product_url: '',
        image_url: '',
        vendor_id: null,
        created_at: new Date()
      };

      // Check if product item already exists
      const existingProduct = await global.dbConnection('woocommerce_order_items')
        .where('order_id', orderId)
        .where('product_id', productRecord.product_id)
        .where('variation_id', productRecord.variation_id)
        .first();

      if (existingProduct) {
        // Update existing product item
        await global.dbConnection('woocommerce_order_items')
          .where('id', existingProduct.id)
          .update(productRecord);
        console.log(`🔄 Product ${productRecord.name} updated for order ${orderId}`);
      } else {
        // Insert new product item
        await global.dbConnection('woocommerce_order_items').insert(productRecord);
        console.log(`💾 Product ${productRecord.name} stored for order ${orderId}`);
      }
    }

    console.log(`✅ All processed product details stored for order ${orderId}`);
    const walletUpdate = await updateWallet(orderId);
    console.log("walletUpdate", walletUpdate);
  } catch (error) {
    console.error('❌ Error storing processed order product details:', error);
    // Don't throw error here to avoid breaking the main order storage
  }
}

async function updateWallet(orderId) {
  try {


    if (!orderId) {
      return {
        success: false,
        message: 'orderId is required'
      };
    }

    // Map short codes to full variant size names
    const sizeMap = {
      S: "Small",
      M: "Medium",
      L: "Large",
      XL: "XL",
      XXL: "XXL"
    };


    const order = await global.dbConnection('woocommerce_orders')
      .leftJoin('woocommerce_order_items', 'woocommerce_orders.id', 'woocommerce_order_items.order_id')
      .select('woocommerce_orders.line_items', 'woocommerce_orders.vendor_id', 'woocommerce_order_items.quantity', 'woocommerce_order_items.sku')
      .where('woocommerce_orders.id', orderId)
      .first();

    console.log('📦 Order found:', order);

    if (!order) {
      console.log('❌ Order not found in database');
      return {
        success: false,
        message: 'Order not found',
        data: { orderId }
      };
    }

    if (!order.vendor_id || order.vendor_id <= 0) {
      console.log('❌ Invalid vendor_id:', order.vendor_id);
      return {
        success: false,
        message: 'Invalid or missing vendor_id',
        data: { orderId, vendorId: order.vendor_id }
      };
    }

    if (!order.line_items) {
      console.log('❌ No line_items found in order');
      return {
        success: false,
        message: 'No line items found in order',
        data: { orderId, vendorId: order.vendor_id }
      };
    }

    if (order && order.vendor_id !== null && order.vendor_id !== undefined && order.vendor_id > 0 && order.line_items) {
      // Parse line_items JSON
      const lineItems = JSON.parse(order.line_items);
      console.log('📋 Line items:', lineItems);

      let totalCost = 0;

      // Loop through line items
      // Loop through line items
      for (const item of lineItems) {
        console.log('🔍 Processing item:', {
          productName: item.deeprintzProductName,
          quantity: item.shopifyOrderProductQuantity,
          orderPrice: item.shopifyOrderProductPrice,
          variants: item.shopifyVariants,
          dbSku: order.sku // <-- sku directly from DB
        });

        if (!order.sku || !item.shopifyVariants) {
          console.log('⚠️ Skipping item - missing sku or variants');
          continue;
        }

        // Extract size from DB SKU (e.g. DP-11-1756979182217-L-1756979190843 → L)
        // Extract size code from SKU
        const skuParts = order.sku.split("-");
        const sizeCode = skuParts.length >= 4 ? skuParts[3] : null;
        console.log("📏 Extracted size code from SKU:", sizeCode);

        // Convert size code → actual variant size
        const selectedSize = sizeMap[sizeCode] || sizeCode;
        console.log("📐 Mapped size:", selectedSize);

        // Find matching variant price
        const variant = item.shopifyVariants.find(v => v.size === selectedSize);


        if (variant) {
          const price = parseFloat(variant.price);
          const qty = parseInt(item.shopifyOrderProductQuantity, 10) || 1;
          const itemTotal = price * qty;
          totalCost += itemTotal;

          console.log(`💵 Item calculation: ${price} × ${qty} = ${itemTotal}`);
        } else {
          console.log('❌ No matching variant found for size:', selectedSize);
        }
      }


      // Deduct from wallet
      // const updated = await global.dbConnection('tenants')
      //     .where('userid', order.vendor_id)
      //     .decrement('wallet', totalCost);

      const response = await global.dbConnection('tenants')
        .select('wallet', 'tenantid').where({ user_id: order.vendor_id })

      // Check if tenant record exists
      if (!response || response.length === 0) {
        console.log(`❌ No tenant record found for vendor_id: ${order.vendor_id}`);
        return {
          success: false,
          message: 'No tenant record found for this vendor',
          data: { orderId, vendorId: order.vendor_id }
        };
      }

      const walletamount = response[0].wallet
      const balance = walletamount - (_.toNumber(totalCost))

      console.log("💰 Current wallet amount:", walletamount)
      console.log("💸 Total cost to deduct:", totalCost)
      console.log("💳 Balance after deduction:", balance)

      // Check if balance is sufficient
      if (balance < 0) {
        console.log("❌ Insufficient balance! Updating order status to 'Onhold'")

        // Update order status to 'onhold'
        const updateOrderStatus = await global.dbConnection('woocommerce_orders')
          .update({ status: 'Onhold' })
          .where({ id: orderId })

        console.log("📋 Order status updated:", updateOrderStatus)

        return {
          success: false,
          message: 'Insufficient wallet balance. Order status updated to Onhold.',
          data: {
            orderId,
            vendorId: order.vendor_id,
            currentWallet: walletamount,
            totalCost,
            balance,
            orderStatus: 'Onhold'
          }
        };
      }

      // Proceed with wallet deduction if balance is sufficient
      const updateBalance = await global.dbConnection('tenants')
        .update({ wallet: balance })
        .where({ tenantid: response[0].tenantid })

      console.log("✅ Wallet updated:", updateBalance)

      const paymentlog = await global.dbConnection('paymentlogs').insert({
        tenantid: response[0].tenantid,
        orderid: orderId,
        amount_debited: totalCost,
        balance: balance
      });

      console.log("📝 Payment log created:", paymentlog)

      console.log(`✅ Deducted ${totalCost} from wallet for vendor ID: ${order.vendor_id}`);

      return {
        success: true,
        message: 'Wallet updated successfully',
        data: {
          orderId,
          vendorId: order.vendor_id,
          totalCost,
          lineItemsCount: lineItems.length
        }
      };
    } else {
      console.log('❌ Order not found or missing required data');
      return {
        success: false,
        message: 'Order not found or missing required data',
        data: { orderId }
      };
    }
  } catch (error) {
    console.error('❌ Error in updateWallet:', error);
    return {
      success: false,
      message: 'Internal server error',
      error: error.message
    };
  }
}


async function createWooCommerceOrderItemsTable() {
  try {
    console.log('🔧 Creating woocommerce_order_items table...');

    const tableExists = await global.dbConnection.schema.hasTable('woocommerce_order_items');
    if (tableExists) {
      console.log('ℹ️ woocommerce_order_items table already exists');
      return;
    }

    await global.dbConnection.schema.createTable('woocommerce_order_items', (table) => {
      table.increments('id').primary();
      table.integer('order_id').notNullable();
      table.bigInteger('woo_order_id').nullable();
      table.bigInteger('product_id').nullable();
      table.bigInteger('variation_id').defaultTo(0);
      table.string('name', 500).nullable();
      table.integer('quantity').notNullable();
      table.string('tax_class', 100).nullable();
      table.decimal('subtotal', 10, 2).notNullable();
      table.decimal('subtotal_tax', 10, 2).defaultTo(0.00);
      table.decimal('total', 10, 2).notNullable();
      table.decimal('total_tax', 10, 2).defaultTo(0.00);
      table.string('sku', 255).nullable();
      table.decimal('price', 10, 2).notNullable();
      table.string('size', 100).nullable();
      table.text('meta_data').nullable();
      table.text('product_data').nullable();
      table.string('product_url', 500).nullable();
      table.string('image_url', 500).nullable();
      table.integer('vendor_id').nullable();
      table.timestamps(true, true);

      table.index('order_id', 'idx_order_id');
      table.index('woo_order_id', 'idx_woo_order_id');
      table.index('product_id', 'idx_product_id');
      table.index('vendor_id', 'idx_vendor_id');
    });

    console.log('✅ woocommerce_order_items table created successfully');
  } catch (error) {
    console.error('❌ Error creating woocommerce_order_items table:', error);
    throw error;
  }
}