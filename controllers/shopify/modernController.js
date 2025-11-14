const ModernShopifyService = require('../../service/shopify/modernShopifyService');
const ShopifyShippingService = require('../../service/shopify/shopifyShippingService');
const SHOPIFY_CONFIG = require('../../config/shopify');

class ModernShopifyController {
  constructor() {
    this.shopifyService = ModernShopifyService;

    // Bind all methods to preserve 'this' context
    this.install = this.install.bind(this);
    this.authCallback = this.authCallback.bind(this);
    this.testConnection = this.testConnection.bind(this);
    this.getConnectionStatus = this.getConnectionStatus.bind(this);
    this.disconnect = this.disconnect.bind(this);
    this.getProducts = this.getProducts.bind(this);
    this.createProduct = this.createProduct.bind(this);
    this.updateProduct = this.updateProduct.bind(this);
    this.deleteProduct = this.deleteProduct.bind(this);
    this.getOrders = this.getOrders.bind(this);
    this.getOrderById = this.getOrderById.bind(this);
    this.getStoreStats = this.getStoreStats.bind(this);
    this.bulkCreateProducts = this.bulkCreateProducts.bind(this);
    this.calculateShipping = this.calculateShipping.bind(this);
    this.resyncProductInventory = this.resyncProductInventory.bind(this);
    this.handleShippingWebhook = this.handleShippingWebhook.bind(this);
    this.handleOrderWebhook = this.handleOrderWebhook.bind(this);
    this.manualRegisterWebhooks = this.manualRegisterWebhooks.bind(this);
    this.manualRegisterCarrierService = this.manualRegisterCarrierService.bind(this);
    this.listCarrierServices = this.listCarrierServices.bind(this);
  }

  // Safely parse a date-like value to a JS Date; fallback to now
  parseDateOrNow(value) {
    try {
      if (!value) return new Date();
      const d = new Date(value);
      if (isNaN(d.getTime())) return new Date();
      return d;
    } catch (_) {
      return new Date();
    }
  }

  // OAuth Installation - Entry point for Shopify app installation
  async install(req, res) {
    try {
      console.log('🛍️ Shopify installation request:', req.query);

      const { shop, userid } = req.query;

      // Validate required parameters
      if (!shop) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: shop'
        });
      }

      if (!userid) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userid'
        });
      }

      // Normalize shop domain
      const normalizedShop = typeof shop === 'string'
        ? shop.replace(/^https?:\/\//, '').replace(/\/$/, '')
        : shop;

      // Validate shop domain format
      if (!normalizedShop.includes('.myshopify.com')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid shop domain. Must be a valid .myshopify.com domain'
        });
      }

      // Generate OAuth URL using modern service
      const authResult = await this.shopifyService.beginAuth(req, res, normalizedShop, SHOPIFY_CONFIG.OAUTH_CALLBACK_URL, userid);

      console.log(`authResult: ${JSON.stringify(authResult)}`);


      if (authResult.success) {
        // Store userid in session for OAuth callback (with fallback if session not available)
        if (req.session) {
          req.session.shopify_userid = userid;
        } else {
          // If session is not available, store in a temporary way or pass as state
          console.log('Session not available, storing userid in state');
        }

        return res.redirect(authResult.authUrl);
      } else {
        return res.status(400).json({
          success: false,
          message: authResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern Shopify install:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Handle Shopify order webhooks (orders/create, orders/updated)
  async handleOrderWebhook(req, res) {
    try {
      console.log('📥 Shopify order webhook received');
      console.log('↪️ Headers:', {
        topic: req.headers['x-shopify-topic'],
        shop: req.headers['x-shopify-shop-domain'],
        hmacPresent: Boolean(req.headers['x-shopify-hmac-sha256'])
      });
      // Log minimal payload info to avoid huge logs
      try {
        const bodySummary = {
          id: req.body?.id,
          name: req.body?.name,
          order_number: req.body?.order_number,
          created_at: req.body?.created_at,
          line_items_count: Array.isArray(req.body?.line_items) ? req.body.line_items.length : 0
        };
        console.log('🧾 Payload summary:', bodySummary);
      } catch (_) {}
      // Acknowledge immediately to avoid Shopify timeouts (5s limit)
      try {
        if (!res.headersSent) {
          res.status(200).send('OK');
        }
      } catch (_) {}
      const topic = req.headers['x-shopify-topic'] || '';
      const shopDomain = req.headers['x-shopify-shop-domain'] || req.query.shop || req.body.shop_domain;
      const signature = req.headers['x-shopify-hmac-sha256'];

      try {
        const rawBody = req.rawBody ? req.rawBody.toString('utf8') : JSON.stringify(req.body || {});
        const valid = this.shopifyService.validateWebhookSignature(rawBody, signature || '', SHOPIFY_CONFIG.SECRET);
        if (!valid) {
          console.log('⚠️ Shopify webhook signature invalid');
        }
      } catch (e) {
        console.log('⚠️ Error validating Shopify webhook signature:', e.message);
      }

      if (!shopDomain) {
        return res.status(400).json({ success: false, message: 'Missing shop domain' });
      }

      const orderPayload = req.body || {};

      const shopRow = await global.dbConnection('shopify_stores')
        .where('shop_domain', shopDomain)
        .where('status', 'connected')
        .first();

      const vendorId = shopRow?.vendor_id || 0;

      await this.ensureWooCommerceOrdersTable();
      await this.ensureWooCommerceOrderItemsTable();

      let processedItems = [];
      if (orderPayload?.line_items && Array.isArray(orderPayload.line_items)) {
        processedItems = await Promise.all(orderPayload.line_items.map(async (item) => {
          const localProduct = await global
            .dbConnection('shopify_products')
            .leftJoin('products', 'products.productid', 'shopify_products.productid')
            .where('shopify_products.id', item.product_id)
            .select(
              'shopify_products.id as shopify_product_id',
              'shopify_products.productcost as shopify_product_cost',
              'shopify_products.plain as shopify_product_plain',
              'shopify_products.position as shopify_product_position',
              'shopify_products.width as shopify_product_width',
              'shopify_products.height as shopify_product_height',
              'shopify_products.designurl as shopify_design_url',
              'shopify_products.variants as shopify_variants',
              'products.productid as deeprintz_product_id',
              'products.productcategoryid as deeprintz_product_category_id',
              'products.productname as deeprintz_product_name',
              'products.productdesc as deeprintz_product_desc',
              'products.productstock as deeprintz_product_stock',
              'products.productcost as deeprintz_product_cost',
              'products.othercost',
              'products.handlingcost as deeprintz_product_handling_cost',
              'products.retailprice as deeprintz_product_retail_price',
              'products.productsku as deeprintz_product_sku',
              'products.baseprice as deeprintz_product_base_price'
            )
            .first();

          let shopifyVariants = [];
          try { shopifyVariants = localProduct?.shopify_variants ? JSON.parse(localProduct.shopify_variants) : []; } catch (_) { shopifyVariants = []; }

          return {
            wooProductId: null,
            shopifyProductId: localProduct?.shopify_product_id || item.product_id || null,
            deeprintzProductId: localProduct?.deeprintz_product_id || null,
            deeprintzProductCategoryId: localProduct?.deeprintz_product_category_id || null,
            deeprintzProductName: localProduct?.deeprintz_product_name || item.name || null,
            deeprintzProductDesc: localProduct?.deeprintz_product_desc || null,
            deeprintzProductStock: localProduct?.deeprintz_product_stock || null,
            deeprintzProductCost: localProduct?.deeprintz_product_cost || null,
            deeprintzProductHandlingCost: localProduct?.deeprintz_product_handling_cost || null,
            deeprintzProductRetailPrice: localProduct?.deeprintz_product_retail_price || null,
            deeprintzProductSku: localProduct?.deeprintz_product_sku || item.sku || null,
            deeprintzProductBasePrice: localProduct?.deeprintz_product_base_price || null,
            shopifyOrderProductId: item.product_id,
            shopifyOrderVariationId: item.variant_id,
            shopifyOrderProductSku: item.sku,
            shopifyOrderProductPrice: item.price,
            shopifyOrderProductQuantity: item.quantity,
            shopifyOrderProductTotal: (Number(item.price) || 0) * (Number(item.quantity) || 1),
            shopifyVariants
          };
        }));
      }

      const billing = orderPayload.billing_address || {};
      const shipping = orderPayload.shipping_address || {};
      const customerName = billing?.name || `${billing?.first_name || ''} ${billing?.last_name || ''}`.trim();

      const orderRecord = {
        vendor_id: vendorId,
        woo_order_id: orderPayload.id || 0,
        order_number: orderPayload.name || orderPayload.order_number || `S_${Date.now()}`,
        status: orderPayload.financial_status || orderPayload.fulfillment_status || 'pending',
        date_created: this.parseDateOrNow(orderPayload.created_at),
        date_modified: this.parseDateOrNow(orderPayload.updated_at),
        total: orderPayload.total_price || 0,
        subtotal: orderPayload.subtotal_price || orderPayload.total_price || 0,
        total_tax: orderPayload.total_tax || 0,
        shipping_total: orderPayload.total_shipping_price_set?.shop_money?.amount || 0,
        discount_total: orderPayload.total_discounts || 0,
        currency: orderPayload.currency || 'INR',
        customer_id: orderPayload.customer?.id || null,
        customer_email: orderPayload.email || orderPayload.contact_email || null,
        customer_name: customerName || orderPayload.customer?.first_name || null,
        billing_address: JSON.stringify(billing || {}),
        shipping_address: JSON.stringify(shipping || {}),
        payment_method: (orderPayload.gateway || (orderPayload.payment_gateway_names && orderPayload.payment_gateway_names[0])) || null,
        payment_method_title: (orderPayload.gateway || (orderPayload.payment_gateway_names && orderPayload.payment_gateway_names[0])) || null,
        transaction_id: orderPayload.transaction_id || null,
        customer_note: orderPayload.note || '',
        line_items: JSON.stringify(processedItems),
        synced_at: new Date(),
        webhook_received: true,
        needs_vendor_assignment: !vendorId,
        order_source: 'shopify',
        order_key: orderPayload.id ? String(orderPayload.id) : null,
        parent_id: null,
        version: null,
        prices_include_tax: false,
        discount_codes: JSON.stringify(orderPayload.discount_applications || []),
        coupon_lines: JSON.stringify([]),
        fee_lines: JSON.stringify([]),
        shipping_lines: JSON.stringify(orderPayload.shipping_lines || []),
        tax_lines: JSON.stringify(orderPayload.tax_lines || []),
        refunds: JSON.stringify(orderPayload.refunds || []),
        meta_data: JSON.stringify(orderPayload)
      };

      const existingOrder = await global.dbConnection('woocommerce_orders')
        .where('vendor_id', vendorId)
        .where('woo_order_id', orderRecord.woo_order_id)
        .first();

      let storedOrderId;
      if (existingOrder) {
        await global.dbConnection('woocommerce_orders')
          .where('id', existingOrder.id)
          .update(orderRecord);
        storedOrderId = existingOrder.id;
      } else {
        const [newOrderId] = await global.dbConnection('woocommerce_orders').insert(orderRecord);
        storedOrderId = newOrderId;
      }

      if (storedOrderId && processedItems.length > 0) {
        for (const product of processedItems) {
          const productRecord = {
            order_id: storedOrderId,
            woo_order_id: product.wooProductId || 0,
            product_id: product.shopifyOrderProductId || 0,
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
            size: null,
            meta_data: JSON.stringify({
              shopifyProductId: product.shopifyProductId,
              deeprintzProductId: product.deeprintzProductId,
              shopifyVariants: product.shopifyVariants
            }),
            product_data: null,
            product_url: '',
            image_url: '',
            vendor_id: null,
            created_at: new Date()
          };

          const existingItem = await global.dbConnection('woocommerce_order_items')
            .where('order_id', storedOrderId)
            .where('product_id', productRecord.product_id)
            .where('variation_id', productRecord.variation_id)
            .first();

          if (existingItem) {
            await global.dbConnection('woocommerce_order_items')
              .where('id', existingItem.id)
              .update(productRecord);
          } else {
            await global.dbConnection('woocommerce_order_items').insert(productRecord);
          }
        }
      }

      console.log('✅ Shopify order processed and stored', { topic, vendor_id: vendorId, order_id: storedOrderId });
      return;
    } catch (error) {
      console.error('❌ Error in handleOrderWebhook:', error);
      try {
        if (!res.headersSent) {
          return res.status(200).send('OK');
        }
      } catch (_) {}
      return;
    }
  }

  // OAuth Callback - Handle OAuth callback from Shopify
  async authCallback(req, res) {
    try {
      console.log('🔄 Shopify OAuth callback:', req.query);

      // Handle OAuth callback using modern service
      const oauthResult = await this.shopifyService.validateAuthCallback(req, res);

      if (oauthResult.success) {
        const { session } = oauthResult;

        // Extract userId from state parameter (format: "state:userId")
        let userId = req.session?.shopify_userid;
        if (!userId && req.query.state) {
          const stateParts = req.query.state.split(':');
          if (stateParts.length > 1) {
            userId = stateParts[1];
            console.log('Extracted userId from state:', userId);
          }
        }

        if (!userId) {
          // If no userid found, try to get from query params or use a default
          const fallbackUserId = req.query.userid || '123';
          console.log('No userid found, using fallback:', fallbackUserId);
          userId = fallbackUserId;
        }

        // Store shop connection in database
        const storeResult = await this.storeShopConnection(userId, session);

        if (storeResult.success) {
          // Register CarrierService for shipping rates
          try {
            await this.registerCarrierService(session.shop, session.accessToken);
            console.log('✅ CarrierService registered successfully');
          } catch (carrierError) {
            console.error('⚠️ CarrierService registration failed:', carrierError);
            // Don't fail the OAuth flow if CarrierService registration fails
          }

          // Register order webhooks
          try {
            await this.registerOrderWebhooks(session.shop, session.accessToken, userId);
            console.log('✅ Order webhooks registered successfully');
          } catch (webhookError) {
            console.error('⚠️ Order webhook registration failed:', webhookError);
            // Don't fail the OAuth flow if webhook registration fails
          }

          // Clear session if it exists
          if (req.session) {
            delete req.session.shopify_userid;
          }

          // Redirect to success page or frontend
          return res.redirect(`${SHOPIFY_CONFIG.SUCCESS_REDIRECT_URL}?shop=${session.shop}`);
        } else {
          return res.status(400).json({
            success: false,
            message: storeResult.error
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          message: oauthResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern Shopify authCallback:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Store shop connection in database
  async storeShopConnection(vendorId, session) {
    try {
      if (!session || !session.shop || !session.accessToken) {
        return {
          success: false,
          error: 'Invalid session data'
        };
      }

      // Ensure shopify_stores table exists
      await this.ensureShopifyStoresTable();

      // Check if shop already exists
      const existingShop = await global.dbConnection('shopify_stores')
        .where('shop_domain', session.shop)
        .where('vendor_id', vendorId)
        .first();

      const shopData = {
        vendor_id: vendorId,
        shop_domain: session.shop,
        shop_name: session.shop.replace('.myshopify.com', ''),
        access_token: session.accessToken,
        scope: session.scope,
        status: 'connected',
        connected_at: new Date(),
        last_sync: new Date(),
        shop_info: JSON.stringify({
          shop: session.shop,
          scope: session.scope,
          expires: session.expires,
          isOnline: session.isOnline
        })
      };

      if (existingShop) {
        // Update existing shop
        await global.dbConnection('shopify_stores')
          .where('id', existingShop.id)
          .update(shopData);

        return {
          success: true,
          shop_id: existingShop.id,
          message: 'Shop connection updated successfully'
        };
      } else {
        // Create new shop connection
        const [shopId] = await global.dbConnection('shopify_stores').insert(shopData);

        return {
          success: true,
          shop_id: shopId,
          message: 'Shop connection created successfully'
        };
      }
    } catch (error) {
      console.error('Error storing shop connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Ensure shopify_stores table exists
  async ensureShopifyStoresTable() {
    try {
      // Check if table exists
      const tableExists = await global.dbConnection.schema.hasTable('shopify_stores');

      if (!tableExists) {
        console.log('📋 Creating shopify_stores table...');

        await global.dbConnection.schema.createTable('shopify_stores', (table) => {
          table.increments('id').primary();
          table.integer('vendor_id').notNullable();
          table.string('shop_domain', 255).notNullable();
          table.string('shop_name', 255).notNullable();
          table.text('access_token').notNullable();
          table.text('scope');
          table.enum('status', ['connected', 'disconnected']).defaultTo('connected');
          table.timestamp('connected_at').defaultTo(global.dbConnection.fn.now());
          table.timestamp('last_sync').defaultTo(global.dbConnection.fn.now());
          table.json('shop_info');
          table.timestamps(true, true);

          // Unique constraint
          table.unique(['vendor_id', 'shop_domain'], 'unique_vendor_shop');

          // Indexes
          table.index('vendor_id', 'idx_vendor_id');
          table.index('shop_domain', 'idx_shop_domain');
          table.index('status', 'idx_status');
        });

        console.log('✅ shopify_stores table created successfully');
      } else {
        console.log('✅ shopify_stores table already exists');
      }

      return true;
    } catch (error) {
      console.error('Error ensuring shopify_stores table:', error);
      return false;
    }
  }

  // Ensure shopify_products_sync table exists
  async ensureShopifyProductsSyncTable() {
    try {
      // Check if table exists
      const tableExists = await global.dbConnection.schema.hasTable('shopify_products_sync');

      if (!tableExists) {
        console.log('📋 Creating shopify_products_sync table...');

        await global.dbConnection.schema.createTable('shopify_products_sync', (table) => {
          table.increments('id').primary();
          table.integer('store_id').notNullable();
          table.integer('local_product_id').notNullable();
          table.string('shopify_product_id', 255);
          table.enum('sync_type', ['create', 'update', 'delete']).notNullable();
          table.enum('sync_status', ['success', 'failed', 'pending']).notNullable();
          table.json('sync_data');
          table.text('error_message');
          table.timestamp('last_sync_attempt').defaultTo(global.dbConnection.fn.now());
          table.timestamps(true, true);

          // Indexes
          table.index('store_id', 'idx_store_id');
          table.index('local_product_id', 'idx_local_product_id');
          table.index('shopify_product_id', 'idx_shopify_product_id');
          table.index('sync_status', 'idx_sync_status');
        });

        console.log('✅ shopify_products_sync table created successfully');
      } else {
        console.log('✅ shopify_products_sync table already exists');
      }

      return true;
    } catch (error) {
      console.error('Error ensuring shopify_products_sync table:', error);
      return false;
    }
  }

  // Store Shopify product sync record
  async storeShopifyProductSync(vendorId, localProductId, shopifyProductId, syncType, syncStatus, syncData) {
    try {
      // Ensure tables exist
      await this.ensureShopifyStoresTable();
      await this.ensureShopifyProductsSyncTable();

      // Get store ID
      const store = await global.dbConnection('shopify_stores')
        .where('vendor_id', vendorId)
        .where('status', 'connected')
        .first();

      if (!store) {
        console.error('No connected Shopify store found for vendor:', vendorId);
        return { success: false, error: 'No connected store found' };
      }

      // Check if sync record already exists
      const existingSync = await global.dbConnection('shopify_products_sync')
        .where('store_id', store.id)
        .where('local_product_id', localProductId)
        .first();

      if (existingSync) {
        // Update existing sync record
        await global.dbConnection('shopify_products_sync')
          .where('id', existingSync.id)
          .update({
            shopify_product_id: shopifyProductId,
            sync_type: syncType,
            sync_status: syncStatus,
            sync_data: JSON.stringify(syncData),
            error_message: syncStatus === 'failed' ? syncData.error : null,
            last_sync_attempt: new Date()
          });
      } else {
        // Create new sync record
        await global.dbConnection('shopify_products_sync').insert({
          store_id: store.id,
          local_product_id: localProductId,
          shopify_product_id: shopifyProductId,
          sync_type: syncType,
          sync_status: syncStatus,
          sync_data: JSON.stringify(syncData),
          error_message: syncStatus === 'failed' ? syncData.error : null,
          last_sync_attempt: new Date()
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error storing Shopify product sync record:', error);
      return { success: false, error: error.message };
    }
  }

  // Get shop connection by vendor ID
  async getShopConnection(vendorId) {
    try {
      const shop = await global.dbConnection('shopify_stores')
        .where('vendor_id', vendorId)
        .where('status', 'connected')
        .first();

      if (shop) {
        return {
          success: true,
          shop: {
            id: shop.id,
            shop_domain: shop.shop_domain,
            shop_name: shop.shop_name,
            access_token: shop.access_token,
            scope: shop.scope,
            status: shop.status,
            connected_at: shop.connected_at,
            last_sync: shop.last_sync
          }
        };
      } else {
        return {
          success: false,
          error: 'No connected shop found for this vendor'
        };
      }
    } catch (error) {
      console.error('Error getting shop connection:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Test Shopify connection
  async testConnection(req, res) {
    try {
      console.log('🔍 Modern Shopify connection test request:', req.body);

      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Test connection using modern service
      const testResult = await this.shopifyService.testConnection(shop.shop_domain, shop.access_token);

      if (testResult.success) {
        res.json({
          success: true,
          message: 'Connection test successful',
          data: {
            shop_info: testResult.shop_info,
            connection_status: 'connected',
            last_sync: shop.last_sync
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: testResult.error || 'Connection test failed'
        });
      }
    } catch (error) {
      console.error('❌ Error in modern testConnection:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get connection status
  async getConnectionStatus(req, res) {
    try {
      console.log('📊 Modern Shopify connection status request:', req.query);

      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (shopResult.success) {
        res.json({
          success: true,
          message: 'Connection status retrieved successfully',
          data: {
            connected: true,
            shop: shopResult.shop,
            connection_status: 'active'
          }
        });
      } else {
        res.json({
          success: true,
          message: 'No active connection found',
          data: {
            connected: false,
            connection_status: 'disconnected'
          }
        });
      }
    } catch (error) {
      console.error('❌ Error in modern getConnectionStatus:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Disconnect Shopify store
  async disconnect(req, res) {
    try {
      console.log('🔌 Modern Shopify disconnect request:', req.body);

      const { userId, shopDomain } = req.body;

      if (!userId || !shopDomain) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, shopDomain'
        });
      }

      // Disconnect shop
      const result = await global.dbConnection('shopify_stores')
        .where('vendor_id', userId)
        .where('shop_domain', shopDomain)
        .update({
          status: 'disconnected',
          access_token: null,
          updated_at: new Date()
        });

      if (result > 0) {
        res.json({
          success: true,
          message: 'Shop disconnected successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Shop not found or already disconnected'
        });
      }
    } catch (error) {
      console.error('❌ Error in modern disconnect:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get products from Shopify using GraphQL
  async getProducts(req, res) {
    try {
      console.log('📦 Modern Shopify products request:', req.query);

      const { userId, limit = 10, cursor = null } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Get products using modern GraphQL service
      const productsResult = await this.shopifyService.getProducts(
        shop.shop_domain,
        shop.access_token,
        { limit: parseInt(limit), cursor }
      );

      if (productsResult.success) {
        res.json({
          success: true,
          message: 'Products retrieved successfully',
          data: {
            products: productsResult.products,
            pageInfo: productsResult.pageInfo,
            total_products: productsResult.total_products
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: productsResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern getProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create product in Shopify using GraphQL (compatible with pushProductsToWooCommerce data structure)
  async createProduct(req, res) {
    try {
      console.log('➕ Modern Shopify create product request:', req.body);

      const { userId, productId } = req.body;

      if (!userId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, productId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Get the product data using the same service as pushProductsToWooCommerce
      const shopifyService = require('../../service/shopify-old/index');
      const product = await shopifyService.getShopifyProductById(productId);

      console.log("🔍 Product data from database:", JSON.stringify(product, null, 2));

      if (!product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }
      console.log("product.productdescproduct.productdesc", product.productdesc);
      // Check if product has variants (sizes)
      const hasVariants = product.variants && product.variants.length > 0;

      // Prepare product data for Shopify (similar to WooCommerce structure)
      const shopifyProductData = {
        title: product.productname,
        description: product.productdesc || '',
        productType: 'Print-on-Demand',
        vendor: 'Deeprintz',
        tags: ['print-on-demand', 'custom-design'],
        status: 'ACTIVE',
        images: product.designurl ? [
          {
            src: product.designurl,
            altText: product.productname
          }
        ] : [],
        variants: [],
        options: [],
        metafields: [
          {
            namespace: 'custom',
            key: 'position',
            value: product.position || '',
            type: 'single_line_text_field'
          },
          {
            namespace: 'custom',
            key: 'dimensions',
            value: `${product.width || 0}x${product.height || 0}`,
            type: 'single_line_text_field'
          },
          {
            namespace: 'custom',
            key: 'deeprintz_product_id',
            value: product.deeprintzProductId?.toString() || '',
            type: 'single_line_text_field'
          }
        ]
      };

      // Handle variants (sizes) similar to WooCommerce
      if (hasVariants) {
        console.log("🔍 Processing variants:", JSON.stringify(product.variants, null, 2));

        // Add size option
        shopifyProductData.options = [
          {
            name: 'Size',
            values: product.variants.map(variant => variant.size)
          }
        ];

        // Create variants for each size with proper pricing (use original prices as INR)
        shopifyProductData.variants = product.variants.map(variant => {
          const price = variant.retailPrice || variant.price || product.shopifyProductCost || "0";
          const sku = `DP-${product.deeprintzProductId}-${variant.sizesku || variant.size}-${Date.now()}`;

          console.log(`📦 Creating variant: ${variant.size} - INR Price: ${price} - SKU: ${sku}`);

          return {
            price: price.toString(),
            sku: sku,
            inventoryQuantity: 999999
          };
        });
      } else {
        // Simple product without variants (use original price as INR)
        const price = product.variants?.[0]?.retailPrice || product.shopifyProductCost || "0";
        const sku = `DP-${product.deeprintzProductId}-${Date.now()}`;

        console.log(`📦 Creating simple product - INR Price: ${price} - SKU: ${sku}`);

        shopifyProductData.variants = [{
          price: price.toString(),
          sku: sku,
          inventoryQuantity: 999999
        }];
      }

      console.log("Shopify product data:", JSON.stringify(shopifyProductData, null, 2));

      // Create product using modern GraphQL service
      const createResult = await this.shopifyService.createProduct(
        shop.shop_domain,
        shop.access_token,
        shopifyProductData
      );

      if (createResult.success) {
        // Store sync record similar to WooCommerce
        try {
          await this.storeShopifyProductSync(userId, productId, createResult.product.id, 'create', 'success', {
            product_name: product.productname,
            product_description: product.productdesc,
            design_url: product.designurl,
            variants: product.variants,
            prices: {
              cost: product.shopifyProductCost,
              retail: product.variants?.[0]?.retailPrice
            },
            dimensions: {
              width: product.width,
              height: product.height
            },
            position: product.position,
            shopify_product_data: shopifyProductData,
            shopify_response: createResult.product,
            action: 'create'
          });
        } catch (syncError) {
          console.error("Error storing sync record:", syncError);
          // Don't fail the main operation if sync record storage fails
        }

        // ============================================================================
        // AUTOMATIC SHIPPING SETUP WHEN PRODUCT IS PUSHED TO SHOPIFY
        // ============================================================================

        try {
          console.log('🚚 Setting up automatic shipping for Shopify product...');

          // 1. Setup shipping calculator script (most important)
          await this.setupShippingCalculatorForVendor(shop, userId);

          // 2. Setup shipping webhooks
          await this.setupShippingWebhooksForVendor(shop, userId);

          // 3. Store shipping configuration
          await this.storeShippingConfiguration(userId, shop.shop_domain, {
            configured_at: new Date().toISOString(),
            method: 'app_proxy',
            script_url: `https://devapi.deeprintz.com/tools/app-proxy/shipping/script?userId=${userId}&shop=${shop.shop_domain}`
          });

          console.log('✅ Automatic shipping setup completed for Shopify vendor:', userId);
        } catch (shippingError) {
          console.error('❌ Error setting up automatic shipping:', shippingError);
          // Don't fail the main operation if shipping setup fails
        }

        res.json({
          success: true,
          message: 'Product created in Shopify successfully with automatic shipping setup!',
          data: {
            product: createResult.product,
            original_product: product,
            has_variations: hasVariants,
            action: 'created',
            shipping_configured: true
          }
        });
      } else {
        // Store failed sync attempt
        try {
          await this.storeShopifyProductSync(userId, productId, 0, 'create', 'failed', {
            error: createResult.error,
            timestamp: new Date(),
            request_data: req.body
          });
        } catch (syncError) {
          console.error("Error storing failed sync record:", syncError);
        }

        res.status(400).json({
          success: false,
          message: createResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern createProduct:', error);

      // Store failed sync attempt
      try {
        if (req.body.userId && req.body.productId) {
          await this.storeShopifyProductSync(req.body.userId, req.body.productId, 0, 'create', 'failed', {
            error: error.message,
            timestamp: new Date(),
            request_data: req.body
          });
        }
      } catch (syncError) {
        console.error("Error storing failed sync record:", syncError);
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update product in Shopify using GraphQL
  async updateProduct(req, res) {
    try {
      console.log('🔄 Modern Shopify update product request:', req.body);

      const { userId, productId, productData } = req.body;

      if (!userId || !productId || !productData) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, productId, productData'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Update product using modern GraphQL service
      const updateResult = await this.shopifyService.updateProduct(
        shop.shop_domain,
        shop.access_token,
        productId,
        productData
      );

      if (updateResult.success) {
        res.json({
          success: true,
          message: 'Product updated successfully',
          data: {
            product: updateResult.product
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: updateResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern updateProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete product from Shopify using GraphQL
  async deleteProduct(req, res) {
    try {
      console.log('🗑️ Modern Shopify delete product request:', req.body);

      const { userId, productId } = req.body;

      if (!userId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, productId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Delete product using modern GraphQL service
      const deleteResult = await this.shopifyService.deleteProduct(
        shop.shop_domain,
        shop.access_token,
        productId
      );

      if (deleteResult.success) {
        res.json({
          success: true,
          message: 'Product deleted successfully',
          data: {
            deletedProductId: deleteResult.deletedProductId
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: deleteResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern deleteProduct:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get orders from Shopify using GraphQL
  async getOrders(req, res) {
    try {
      console.log('📋 Modern Shopify orders request:', req.query);

      const { userId, limit = 10, cursor = null } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Get orders using modern GraphQL service
      const ordersResult = await this.shopifyService.getOrders(
        shop.shop_domain,
        shop.access_token,
        { limit: parseInt(limit), cursor }
      );

      if (ordersResult.success) {
        res.json({
          success: true,
          message: 'Orders retrieved successfully',
          data: {
            orders: ordersResult.orders,
            pageInfo: ordersResult.pageInfo,
            total_orders: ordersResult.total_orders
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: ordersResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern getOrders:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',                                                     
        error: error.message
      });
    }
  }

  // Get specific order by ID using GraphQL
  async getOrderById(req, res) {
    try {
      console.log('📄 Modern Shopify get order request:', req.params, req.query);

      const { orderId } = req.params;
      const { userId } = req.query;

      if (!userId || !orderId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: userId, orderId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Get order using modern GraphQL service
      const orderResult = await this.shopifyService.getOrderById(
        shop.shop_domain,
        shop.access_token,
        orderId
      );

      if (orderResult.success) {
        res.json({
          success: true,
          message: 'Order retrieved successfully',
          data: {
            order: orderResult.order
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: orderResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern getOrderById:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get store statistics
  async getStoreStats(req, res) {
    try {
      console.log('📊 Modern Shopify store stats request:', req.query);

      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Get shop info using modern service
      const shopInfoResult = await this.shopifyService.getShopInfo(
        shop.shop_domain,
        shop.access_token
      );

      if (shopInfoResult.success) {
        res.json({
          success: true,
          message: 'Store statistics retrieved successfully',
          data: {
            shop_info: shopInfoResult.shop_info,
            connection_info: shop
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: shopInfoResult.error
        });
      }
    } catch (error) {
      console.error('❌ Error in modern getStoreStats:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Bulk create products
  async bulkCreateProducts(req, res) {
    try {
      console.log('📦 Modern Shopify bulk create products request:', req.body);

      const { userId, products } = req.body;

      if (!userId || !products || !Array.isArray(products)) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, products (array)'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);

      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Process products sequentially to avoid rate limits
      const results = [];
      for (const product of products) {
        const result = await this.shopifyService.createProduct(
          shop.shop_domain,
          shop.access_token,
          product
        );
        results.push({
          product_name: product.title,
          success: result.success,
          product_id: result.success ? result.product?.id : null,
          error: result.error || null
        });
      }

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `Bulk operation completed. ${successful} successful, ${failed} failed.`,
        data: {
          results: results,
          summary: {
            total: products.length,
            successful: successful,
            failed: failed
          }
        }
      });
    } catch (error) {
      console.error('❌ Error in modern bulkCreateProducts:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Calculate shipping rates for Shopify checkout
  async calculateShipping(req, res) {
    try {
      console.log('🚚 Shopify shippingss calculation request:', req.body);

      const {
        userId,
        shopDomain,
        postCode,
        weight,
        
        orderAmount,
        paymentMode = 'prepaid',
        items = []
      } = req.body;

      // Validate required fields
      if (!postCode || !weight || !orderAmount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: postCode, weight, orderAmount'
        });
      }

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: userId'
        });
      }

      // Prepare shipping data
      const shippingData = {
        userId,
        shopDomain,
        postCode,
        weight,
        orderAmount,
        paymentMode,
        items
      };

      // Calculate shipping rates using the service
      const result = await ShopifyShippingService.calculateShippingRates(shippingData);

      if (result.success) {
        res.json({
          success: true,
          message: 'Shipping rates calculated successfully',
          data: {
            shipping_options: result.rates,
            calculation_time: new Date().toISOString(),
            postcode: postCode,
            weight: weight,
            order_amount: orderAmount
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to calculate shipping rates'
        });
      }
    } catch (error) {
      console.error('❌ Error in calculateShipping:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Resync inventory for an existing product at all target locations (Canada + India)
  async resyncProductInventory(req, res) {
    try {
      const { userId, productId } = req.body;

      if (!userId || !productId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, productId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);
      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Fetch product variants to get inventory_item_ids
      const client = this.shopifyService.createGraphQLClient(shop.shop_domain, shop.access_token);
      const productQuery = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            variants(first: 50) {
              edges {
                node {
                  id
                  inventoryItem {
                    id
                  }
                }
              }
            }
          }
        }
      `;

      const productResponse = await client.request(productQuery, {
        variables: { id: productId }
      });

      if (!productResponse.data?.product) {
        return res.status(404).json({
          success: false,
          message: 'Product not found'
        });
      }

      const variants = productResponse.data.product.variants.edges.map(edge => edge.node);
      if (variants.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No variants found for this product'
        });
      }

      // Fetch locations and filter for Canada + India
      const locationsUrl = `https://${shop.shop_domain}/admin/api/2025-01/locations.json`;
      const locationsResponse = await fetch(locationsUrl, {
        headers: {
          'X-Shopify-Access-Token': shop.access_token
        }
      });
      const locationsResult = await locationsResponse.json();

      if (!locationsResult.locations || locationsResult.locations.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No locations found'
        });
      }

      const canadaLocations = locationsResult.locations.filter(loc =>
        loc.country === 'Canada' || loc.country_code === 'CA' || loc.country_name === 'Canada'
      );
      const indiaLocations = locationsResult.locations.filter(loc =>
        loc.country === 'India' || loc.country_code === 'IN' || loc.country_name === 'India'
      );
      const targetLocations = canadaLocations.length > 0 || indiaLocations.length > 0
        ? [...canadaLocations, ...indiaLocations]
        : locationsResult.locations;

      console.log(`📍 Resync target locations (Canada: ${canadaLocations.length}, India: ${indiaLocations.length}):`,
        targetLocations.map(loc => `${loc.name} (${loc.country || loc.country_code})`));

      const results = [];

      // For each variant, connect and set inventory at each target location
      for (const variant of variants) {
        const inventoryItemId = variant.inventoryItem.id.split('/').pop();
        const variantResults = [];

        for (const location of targetLocations) {
          try {
            // Connect inventory item to location
            const connectUrl = `https://${shop.shop_domain}/admin/api/2025-01/inventory_levels/connect.json`;
            const connectData = {
              location_id: location.id,
              inventory_item_id: inventoryItemId
            };

            const connectResponse = await fetch(connectUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': shop.access_token
              },
              body: JSON.stringify(connectData)
            });
            const connectResult = await connectResponse.json();
            if (connectResponse.status >= 400) {
              console.warn(`⚠️ Connect failed for variant ${variant.id} at location ${location.id}:`, JSON.stringify(connectResult));
            }

            // Set available quantity
            const inventoryUrl = `https://${shop.shop_domain}/admin/api/2025-01/inventory_levels/set.json`;
            const inventoryData = {
              location_id: location.id,
              inventory_item_id: inventoryItemId,
              available: 999999
            };

            const inventoryResponse = await fetch(inventoryUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': shop.access_token
              },
              body: JSON.stringify(inventoryData)
            });
            const inventoryResult = await inventoryResponse.json();

            variantResults.push({
              location: location.name,
              country: location.country || location.country_code,
              connect: { status: connectResponse.status, result: connectResult },
              inventory: { status: inventoryResponse.status, result: inventoryResult }
            });
          } catch (err) {
            variantResults.push({
              location: location.name,
              country: location.country || location.country_code,
              error: err.message
            });
          }
        }
        results.push({ variantId: variant.id, inventoryItemId, results: variantResults });
      }

      res.json({
        success: true,
        message: 'Inventory resync completed',
        data: {
          productId,
          targetLocations: targetLocations.map(loc => ({ id: loc.id, name: loc.name, country: loc.country || loc.country_code })),
          results
        }
      });
    } catch (error) {
      console.error('❌ Error in resyncProductInventory:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Handle Shopify shipping webhook
  async handleShippingWebhook(req, res) {
    try {
      console.log('📡 Shopify shipping webhook received:', req.body);

      // Validate webhook data
      const webhookData = req.body;
      ShopifyShippingService.validateShopifyWebhookData(webhookData);

      // Extract shipping data from webhook
      const shippingData = ShopifyShippingService.extractShippingDataFromWebhook(webhookData);

      // Add user context (you'll need to determine this from the webhook)
      const userId = req.headers['x-shopify-user-id'] || req.body.user_id;
      const shopDomain = req.headers['x-shopify-shop-domain'] || req.body.shop_domain;

      if (!userId || !shopDomain) {
        return res.status(400).json({
          success: false,
          message: 'Missing user or shop context in webhook'
        });
      }

      // Prepare full shipping data
      const fullShippingData = {
        userId,
        shopDomain,
        ...shippingData
      };

      // Calculate shipping rates
      const result = await ShopifyShippingService.calculateShippingRates(fullShippingData);

      if (result.success) {
        // Return Shopify-compatible response
        const shopifyResponse = ShopifyShippingService.createShopifyShippingResponse(result.rates);
        res.json(shopifyResponse);
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to calculate shipping rates'
        });
      }
    } catch (error) {
      console.error('❌ Error in handleShippingWebhook:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // ============================================================================
  // AUTOMATIC SHIPPING SETUP METHODS
  // ============================================================================

  // Setup Shopify shipping zones and methods automatically
  async setupShopifyShippingForVendor(shop, userId) {
    try {
      console.log('🚚 Setting up Shopify shipping zones for vendor:', userId);

      const client = this.shopifyService.createGraphQLClient(shop.shop_domain, shop.access_token);

      // 1. Create shipping zones
      const shippingZones = await this.createShippingZones(client, userId);

      // 2. Create shipping methods
      const shippingMethods = await this.createShippingMethods(client, shippingZones, userId);

      // 3. Store shipping configuration in database
      await this.storeShippingConfiguration(userId, shop.shop_domain, {
        zones: shippingZones,
        methods: shippingMethods,
        configured_at: new Date().toISOString()
      });

      console.log('✅ Shopify shipping zones and methods created successfully');
      return { success: true, zones: shippingZones, methods: shippingMethods };
    } catch (error) {
      console.error('❌ Error setting up Shopify shipping:', error);
      throw error;
    }
  }

  // Create shipping zones for India using REST API
  async createShippingZones(client, userId) {
    try {
      console.log('🚚 Creating shipping zones using REST API for vendor:', userId);

      // Use REST API instead of GraphQL for shipping zones
      const axios = require('axios');

      // Get shop domain from client session
      const shopDomain = client.session?.shop || 'myn11.myshopify.com';
      const accessToken = client.session?.accessToken;

      if (!accessToken) {
        throw new Error('No access token available for REST API calls');
      }

      // Create shipping zone using REST API
      const zoneData = {
        shipping_zone: {
          name: `Deeprintz Shipping Zone - ${userId}`,
          countries: [
            {
              id: 100, // India country ID
              name: "India"
            }
          ]
        }
      };

      const response = await axios.post(
        `https://${shopDomain}/admin/api/2024-10/shipping_zones.json`,
        zoneData,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data && response.data.shipping_zone) {
        console.log('✅ Shipping zone created:', response.data.shipping_zone.id);
        return response.data.shipping_zone;
      } else {
        throw new Error('Failed to create shipping zone');
      }
    } catch (error) {
      console.error('❌ Error creating shipping zone:', error);
      // Return a mock zone for now to continue the process
      return {
        id: `mock_zone_${userId}`,
        name: `Deeprintz Shipping Zone - ${userId}`,
        countries: [{ id: 100, name: "India" }]
      };
    }
  }

  // Create shipping methods for the zone using REST API
  async createShippingMethods(client, zone, userId) {
    try {
      console.log('🚚 Creating shipping methods using REST API for zone:', zone.id);

      // Use REST API instead of GraphQL for shipping methods
      const axios = require('axios');

      // Get shop domain from client session
      const shopDomain = client.session?.shop || 'myn11.myshopify.com';
      const accessToken = client.session?.accessToken;

      if (!accessToken) {
        throw new Error('No access token available for REST API calls');
      }

      const methods = [
        {
          title: "Standard Shipping (Deeprintz)",
          price: "0.00",
          zone_id: zone.id
        },
        {
          title: "Express Shipping (Deeprintz)",
          price: "0.00",
          zone_id: zone.id
        }
      ];

      const createdMethods = [];

      for (const methodData of methods) {
        try {
          const response = await axios.post(
            `https://${shopDomain}/admin/api/2024-10/shipping_rates.json`,
            {
              shipping_rate: methodData
            },
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              }
            }
          );

          if (response.data && response.data.shipping_rate) {
            createdMethods.push(response.data.shipping_rate);
            console.log('✅ Shipping method created:', response.data.shipping_rate.id);
          }
        } catch (methodError) {
          console.error('❌ Error creating shipping method:', methodError.response?.data || methodError.message);
          // Continue with other methods
        }
      }

      return createdMethods;
    } catch (error) {
      console.error('❌ Error creating shipping methods:', error);
      // Return mock methods to continue the process
      return [
        {
          id: `mock_method_1_${userId}`,
          title: "Standard Shipping (Deeprintz)",
          price: "0.00",
          zone_id: zone.id
        },
        {
          id: `mock_method_2_${userId}`,
          title: "Express Shipping (Deeprintz)",
          price: "0.00",
          zone_id: zone.id
        }
      ];
    }
  }

  // Setup shipping calculator script automatically
  async setupShippingCalculatorForVendor(shop, userId) {
    try {
      console.log('📱 Setting up shipping calculator script for vendor:', userId);

      // Create a custom script tag for the shipping calculator
      const scriptTag = {
        event: "onload",
        src: `https://devapi.deeprintz.com/tools/app-proxy/shipping/script?userId=${userId}&shop=${shop.shop_domain}`,
        display_scope: "online_store"
      };

      // Store script configuration in database
      await this.storeScriptConfiguration(userId, shop.shop_domain, scriptTag);

      console.log('✅ Shipping calculator script configured');
      return { success: true, script: scriptTag };
    } catch (error) {
      console.error('❌ Error setting up shipping calculator:', error);
      throw error;
    }
  }

  // Setup shipping webhooks
  async setupShippingWebhooksForVendor(shop, userId) {
    try {
      console.log('🔗 Setting up shipping webhooks for vendor:', userId);

      const webhooks = [
        {
          topic: "orders/create",
          address: `https://devapi.deeprintz.com/api/shopify/shipping/webhook?userId=${userId}`,
          format: "json"
        },
        {
          topic: "orders/updated",
          address: `https://devapi.deeprintz.com/api/shopify/shipping/webhook?userId=${userId}`,
          format: "json"
        }
      ];

      // Store webhook configuration
      await this.storeWebhookConfiguration(userId, shop.shop_domain, webhooks);

      console.log('✅ Shipping webhooks configured');
      return { success: true, webhooks };
    } catch (error) {
      console.error('❌ Error setting up shipping webhooks:', error);
      throw error;
    }
  }

  // Store shipping configuration in database
  async storeShippingConfiguration(userId, shopDomain, config) {
    try {
      await global.dbConnection('shopify_shipping_configs').insert({
        user_id: userId,
        shop_domain: shopDomain,
        configuration: JSON.stringify(config),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict(['user_id', 'shop_domain']).merge();

      console.log('✅ Shipping configuration stored in database');
    } catch (error) {
      console.error('❌ Error storing shipping configuration:', error);
      throw error;
    }
  }

  // Store script configuration in database
  async storeScriptConfiguration(userId, shopDomain, script) {
    try {
      await global.dbConnection('shopify_script_configs').insert({
        user_id: userId,
        shop_domain: shopDomain,
        script_config: JSON.stringify(script),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict(['user_id', 'shop_domain']).merge();

      console.log('✅ Script configuration stored in database');
    } catch (error) {
      console.error('❌ Error storing script configuration:', error);
      throw error;
    }
  }

  // Store webhook configuration in database
  async storeWebhookConfiguration(userId, shopDomain, webhooks) {
    try {
      await global.dbConnection('shopify_webhook_configs').insert({
        user_id: userId,
        shop_domain: shopDomain,
        webhook_config: JSON.stringify(webhooks),
        status: 'active',
        created_at: new Date(),
        updated_at: new Date()
      }).onConflict(['user_id', 'shop_domain']).merge();

      console.log('✅ Webhook configuration stored in database');
    } catch (error) {
      console.error('❌ Error storing webhook configuration:', error);
      throw error;
    }
  }

  // Register CarrierService for shipping rates
  async registerCarrierService(shop, accessToken) {
    try {
      console.log('🚚 Registering CarrierService for shop:', shop);
      
      const axios = require('axios');
      
      const carrierServiceData = {
        carrier_service: {
          name: "Deeprintz Live Shipping Rates",
          callback_url: "https://devapi.deeprintz.com/api/deeprintz/live/shopify/carrier/rates",
          service_discovery: true,
          format: "json"
        }
      };

      const response = await axios.post(
        `https://${shop}/admin/api/2024-10/carrier_services.json`,
        carrierServiceData,
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      if (response.data && response.data.carrier_service) {
        console.log('✅ CarrierService registered:', response.data.carrier_service.id);
        return {
          success: true,
          carrierServiceId: response.data.carrier_service.id
        };
      } else {
        throw new Error('Invalid response from Shopify API');
      }

    } catch (error) {
      console.error('❌ Error registering CarrierService:', error.response?.data || error.message);
      throw error;
    }
  }

  // Manual webhook registration endpoint (for troubleshooting)
  async manualRegisterWebhooks(req, res) {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: userId'
        });
      }

      // Get shop connection
      const shopResult = await this.getShopConnection(userId);
      if (!shopResult.success) {
        return res.status(400).json({
          success: false,
          message: shopResult.error
        });
      }

      const { shop } = shopResult;

      // Register webhooks
      const result = await this.registerOrderWebhooks(shop.shop_domain, shop.access_token, userId);

      res.json({
        success: true,
        message: 'Webhooks registered successfully',
        webhooks: result.webhooks
      });

    } catch (error) {
      console.error('❌ Error in manualRegisterWebhooks:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Manually register CarrierService for a vendor's connected shop
  async manualRegisterCarrierService(req, res) {
    try {
      const { userId } = req.body;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing required field: userId' });
      }

      const shopResult = await this.getShopConnection(userId);
      if (!shopResult.success) {
        return res.status(400).json({ success: false, message: shopResult.error });
      }

      const { shop } = shopResult;
      const result = await this.registerCarrierService(shop.shop_domain, shop.access_token);

      return res.json({ success: true, message: 'CarrierService registered', data: result });
    } catch (error) {
      console.error('❌ Error in manualRegisterCarrierService:', error);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // List CarrierServices for the connected shop
  async listCarrierServices(req, res) {
    try {
      const { userId } = req.query;

      if (!userId) {
        return res.status(400).json({ success: false, message: 'Missing required parameter: userId' });
      }

      const shopResult = await this.getShopConnection(userId);
      if (!shopResult.success) {
        return res.status(400).json({ success: false, message: shopResult.error });
      }

      const { shop } = shopResult;
      const axios = require('axios');
      const response = await axios.get(`https://${shop.shop_domain}/admin/api/2024-10/carrier_services.json`, {
        headers: { 'X-Shopify-Access-Token': shop.access_token }
      });

      return res.json({ success: true, data: response.data });
    } catch (error) {
      console.error('❌ Error in listCarrierServices:', error.response?.data || error.message);
      return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
    }
  }

  // Register order webhooks
  async registerOrderWebhooks(shop, accessToken, userId) {
    try {
      console.log('🔗 Registering order webhooks for shop:', shop, 'userId:', userId);
      
      const axios = require('axios');
      
      const webhooksToRegister = [
        {
          webhook: {
            topic: "orders/create",
            address: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId=${userId}`,
            format: "json"
          }
        },
        {
          webhook: {
            topic: "orders/updated",
            address: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId=${userId}`,
            format: "json"
          }
        },
        {
          webhook: {
            topic: "orders/paid",
            address: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId=${userId}`,
            format: "json"
          }
        }
      ];

      const registeredWebhooks = [];

      for (const webhookData of webhooksToRegister) {
        try {
          const response = await axios.post(
            `https://${shop}/admin/api/2024-10/webhooks.json`,
            webhookData,
            {
              headers: {
                'X-Shopify-Access-Token': accessToken,
                'Content-Type': 'application/json'
              },
              timeout: 10000
            }
          );

          if (response.data && response.data.webhook) {
            console.log(`✅ Webhook registered: ${webhookData.webhook.topic}`, response.data.webhook.id);
            registeredWebhooks.push({
              id: response.data.webhook.id,
              topic: webhookData.webhook.topic,
              address: webhookData.webhook.address
            });
          }
        } catch (webhookError) {
          console.error(`❌ Error registering webhook ${webhookData.webhook.topic}:`, webhookError.response?.data || webhookError.message);
          // Continue with other webhooks even if one fails
        }
      }

      // Store webhook configuration in database
      await this.storeWebhookConfiguration(userId, shop, registeredWebhooks);

      return {
        success: true,
        webhooks: registeredWebhooks
      };

    } catch (error) {
      console.error('❌ Error registering order webhooks:', error.response?.data || error.message);
      throw error;
    }
  }
}

// Ensure Woo-style orders table exists (used for unified storage with WooCommerce)
ModernShopifyController.prototype.ensureWooCommerceOrdersTable = async function () {
  try {
    const exists = await global.dbConnection.schema.hasTable('woocommerce_orders');
    if (exists) return true;

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
      table.string('currency', 10).notNullable().defaultTo('INR');
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
      table.string('order_source', 50).notNullable().defaultTo('shopify');
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
    return true;
  } catch (error) {
    console.error('❌ Error ensuring woocommerce_orders table:', error);
    return false;
  }
};

// Ensure Woo-style order items table exists
ModernShopifyController.prototype.ensureWooCommerceOrderItemsTable = async function () {
  try {
    const exists = await global.dbConnection.schema.hasTable('woocommerce_order_items');
    if (exists) return true;

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
    return true;
  } catch (error) {
    console.error('❌ Error ensuring woocommerce_order_items table:', error);
    return false;
  }
};


module.exports = new ModernShopifyController();
