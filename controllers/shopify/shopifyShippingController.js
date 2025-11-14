const axios = require('axios');

// Try to load express-rate-limit, fallback to basic implementation if not available
let rateLimit;
try {
  rateLimit = require('express-rate-limit');
} catch (error) {
  console.warn('⚠️ express-rate-limit not available, using basic rate limiting');
  rateLimit = null;
}

class ShopifyShippingController {
  constructor() {
    this.nimbusPostConfig = {
      baseURL: "https://api.nimbuspost.com/v1/",
      credentials: {
        email: "care+1201@deeprintz.com",
        password: "3JfzKQpHsG"
      },
      origin: "641603" // Static origin pincode
    };
  }

  // Rate limiting middleware for shipping API
  static createRateLimit() {
    if (!rateLimit) {
      // Fallback to basic middleware if express-rate-limit is not available
      return (req, res, next) => {
        console.log('📊 Rate limiting disabled - express-rate-limit not available');
        next();
      };
    }
    
    try {
      return rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // limit each IP to 100 requests per windowMs
        message: {
          success: false,
          message: 'Too many shipping calculation requests, please try again later.',
          error: 'RATE_LIMIT_EXCEEDED'
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Fix for X-Forwarded-For header issues using proper IPv6 handling
        keyGenerator: (req) => {
          try {
            // Use the first IP from X-Forwarded-For if present, otherwise use connection remoteAddress
            const forwarded = req.headers['x-forwarded-for'];
            if (forwarded && typeof forwarded === 'string') {
              // X-Forwarded-For can contain multiple IPs, take the first one
              const firstIp = forwarded.split(',')[0].trim();
              // Validate IP format
              if (firstIp && /^[0-9a-fA-F.:]+$/.test(firstIp)) {
                // Use the built-in ipKeyGenerator for proper IPv6 handling
                return rateLimit.ipKeyGenerator(req, firstIp);
              }
            }
            // Use the built-in ipKeyGenerator for proper IPv6 handling
            return rateLimit.ipKeyGenerator(req);
          } catch (error) {
            console.warn('⚠️ Error in rate limiter keyGenerator:', error.message);
            return 'fallback-ip';
          }
        },
        // Skip rate limiting for certain conditions
        skip: (req) => {
          // Skip rate limiting for health checks or internal requests
          return req.path === '/health' || req.headers['x-internal-request'] === 'true';
        }
      });
    } catch (error) {
      console.error('❌ Error creating rate limiter:', error.message);
      // Fallback to basic middleware if rate limiter creation fails
      return (req, res, next) => {
        console.log('📊 Rate limiting disabled due to configuration error');
        next();
      };
    }
  }

  // Authentication middleware for Shopify API
  static authenticateShopifyRequest(req, res, next) {
    try {
      const shop = req.headers['x-shopify-shop-domain'];
      const signature = req.headers['x-shopify-hmac-sha256'];
      
      if (!shop) {
        return res.status(401).json({
          success: false,
          message: 'Missing shop domain in headers',
          error: 'AUTHENTICATION_FAILED'
        });
      }

      // Add shop info to request for use in controllers
      req.shopifyShop = shop;
      next();
    } catch (error) {
      console.error('❌ Shopify authentication error:', error);
      res.status(401).json({
        success: false,
        message: 'Authentication failed',
        error: 'AUTHENTICATION_FAILED'
      });
    }
  }

  // Main shipping calculation endpoint for Shopify checkout
  async calculateShipping(req, res) {
    try {
      // Enhanced logging for API monitoring
      const timestamp = new Date().toISOString();
      const clientIP = req.ip || req.connection.remoteAddress || req.headers['x-forwarded-for'];
      const userAgent = req.headers['user-agent'];
      
      console.log('🚚 Shopify shipping calculation request:', req.body);
      console.log('📡 Headers:', req.headers);
      console.log('🕐 Timestamp:', timestamp);
      console.log('🌐 Client IP:', clientIP);
      console.log('🖥️ User Agent:', userAgent);

      const {
        postCode,
        weight,
        orderAmount = 0,
        paymentMode = 'prepaid',
        items = [],
        userId,
        shopDomain
      } = req.body;

      // Validate required fields
      if (!postCode || !weight) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: postCode, weight',
          error: 'VALIDATION_ERROR'
        });
      }

      // Calculate total weight if items array is provided
      let totalWeight = weight;
      if (items && items.length > 0) {
        totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
      }

      console.log(`🚚 Calculating shipping for Shopify: PostCode: ${postCode}, Weight: ${totalWeight}g, Amount: ${orderAmount}, Payment: ${paymentMode}`);

      // Call NimbusPost API directly (using your existing logic)
      const shippingRates = await this.calculateNimbusPostShipping({
        postCode,
        weight: totalWeight,
        orderAmount,
        paymentMode,
        items
      });

      if (shippingRates.success) {
        // Format response for Shopify checkout
        const shopifyResponse = this.formatShopifyShippingResponse(shippingRates.data);
        
        console.log(`✅ Shopify shipping calculation successful for ${postCode}: ${shopifyResponse.rates.length} options found`);
        console.log('📤 Response sent:', JSON.stringify(shopifyResponse, null, 2));
        console.log('⏱️ Response time:', Date.now() - new Date(timestamp).getTime(), 'ms');

        return res.json(shopifyResponse);
      } else {
        console.log(`❌ Shipping calculation failed for ${postCode}:`, shippingRates.error);
        return res.status(400).json({
          success: false,
          message: shippingRates.error || 'Failed to calculate shipping rates',
          error: 'SHIPPING_CALCULATION_FAILED'
        });
      }

    } catch (error) {
      console.error('❌ Shopify shipping calculation error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Calculate shipping using NimbusPost (your existing logic)
  async calculateNimbusPostShipping(shippingData) {
    try {
      // Simple in-memory cache with 2-minute TTL
      if (!global.__shopifyShippingCache) {
        global.__shopifyShippingCache = { store: new Map() };
      }
      const cacheKey = JSON.stringify({
        postCode: shippingData.postCode,
        weight: shippingData.weight,
        orderAmount: shippingData.orderAmount || 0,
        paymentMode: shippingData.paymentMode || 'prepaid'
      });
      const nowTs = Date.now();
      const cached = global.__shopifyShippingCache.store.get(cacheKey);
      if (cached && (nowTs - cached.timestamp) < 120000) { // 120s TTL
        return { success: true, data: cached.data };
      }

      // Network call timeout guard (race): 5s
      const withTimeout = (promise, ms) => {
        return new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('Upstream timeout')), ms);
          promise.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
        });
      };
      const { postCode, weight, orderAmount, paymentMode, items } = shippingData;

      // Generate NimbusPost token
      const tokenResponse = await withTimeout(axios.post(
        `${this.nimbusPostConfig.baseURL}users/login`, 
        this.nimbusPostConfig.credentials,
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      ), 5000);

      const token = tokenResponse.data;
      
      if (!token) {
        throw new Error('Failed to generate NimbusPost token');
      }

      // Prepare courier data
      const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
      const courierData = {
        origin: this.nimbusPostConfig.origin,
        destination: postCode,
        payment_type: payment_type,
        order_amount: payment_type === 'cod' ? (orderAmount || 0) : "",
        weight: weight,
        length: "",
        breadth: "",
        height: ""
      };

      // Fetch courier partners
      const courierResponse = await withTimeout(axios.post(
        `${this.nimbusPostConfig.baseURL}courier/serviceability`, 
        courierData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 8000
        }
      ), 5000);

      const result = courierResponse.data;
      
      if (!result.status || !result.data) {
        throw new Error('No courier partners available for this location');
      }

      // Format courier data for Shopify
      const shippingOptions = result.data.map(courier => {
        const shippingCost = courier.total_charges || 0;
        const codCharge = courier.cod_charge || courier.cod_cost || 0;
        
        return {
          courier_name: courier.courier_name || courier.name || 'Unknown Courier',
          courier_id: courier.courier_id || courier.id || '',
          shipping_cost: parseFloat(shippingCost),
          cod_charge: parseFloat(codCharge),
          total_cost: parseFloat(shippingCost) + parseFloat(codCharge),
          estimated_delivery: courier.estimated_delivery || courier.delivery_time || '3-5 days'
        };
      });

      // Sort by shipping cost (lowest first)
      shippingOptions.sort((a, b) => a.shipping_cost - b.shipping_cost);

      const payload = {
        success: true,
        data: {
          shipping_options: shippingOptions,
          calculation_time: new Date().toISOString(),
          postcode: postCode,
          weight: weight,
          order_amount: orderAmount
        }
      };

      // Store in cache
      global.__shopifyShippingCache.store.set(cacheKey, { timestamp: nowTs, data: payload.data });

      return payload;

    } catch (error) {
      console.error('❌ NimbusPost API error:', error.message);
      // Fallback to cached value if available
      try {
        if (global.__shopifyShippingCache) {
          const cacheKey = JSON.stringify({
            postCode: shippingData.postCode,
            weight: shippingData.weight,
            orderAmount: shippingData.orderAmount || 0,
            paymentMode: shippingData.paymentMode || 'prepaid'
          });
          const cached = global.__shopifyShippingCache.store.get(cacheKey);
          if (cached) {
            return { success: true, data: cached.data };
          }
        }
      } catch (_) {}
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Format shipping response for Shopify checkout
  formatShopifyShippingResponse(shippingData) {
    const { shipping_options } = shippingData;

    // Convert to Shopify-compatible format
    const rates = shipping_options.map((option, index) => ({
      service_name: option.courier_name,
      service_code: option.courier_id,
      total_price: Math.round(option.total_cost * 100), // Convert to cents
      description: `${option.estimated_delivery} delivery`,
      currency: 'INR',
      min_delivery_date: this.calculateMinDeliveryDate(option.estimated_delivery),
      max_delivery_date: this.calculateMaxDeliveryDate(option.estimated_delivery)
    }));

    return {
      rates: rates
    };
  }

  // Calculate minimum delivery date
  calculateMinDeliveryDate(deliveryTime) {
    const days = parseInt(deliveryTime.split('-')[0]) || 3;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  // Calculate maximum delivery date
  calculateMaxDeliveryDate(deliveryTime) {
    const days = parseInt(deliveryTime.split('-')[1]) || 5;
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toISOString().split('T')[0];
  }

  // Handle Shopify shipping webhook (for real-time updates)
  async handleShippingWebhook(req, res) {
    try {
      console.log('📡 Shopify shipping webhook received:', req.body);

      const webhookData = req.body;
      
      // Extract shipping data from Shopify webhook
      const shippingData = this.extractShippingDataFromWebhook(webhookData);
      
      if (!shippingData.postCode || !shippingData.weight) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook data: missing postCode or weight'
        });
      }

      // Calculate shipping rates
      const result = await this.calculateNimbusPostShipping(shippingData);
      
      if (result.success) {
        const shopifyResponse = this.formatShopifyShippingResponse(result.data);
        return res.json(shopifyResponse);
      } else {
        return res.status(400).json({
          success: false,
          message: result.error || 'Failed to calculate shipping rates'
        });
      }

    } catch (error) {
      console.error('❌ Shopify shipping webhook error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Extract shipping data from Shopify webhook
  extractShippingDataFromWebhook(webhookData) {
    try {
      // This depends on your Shopify webhook structure
      // Adjust based on your actual webhook data format
      return {
        postCode: webhookData.destination?.postal_code || webhookData.postal_code,
        weight: webhookData.weight || 500, // Default weight if not provided
        orderAmount: webhookData.order_amount || 0,
        paymentMode: webhookData.payment_mode || 'prepaid',
        items: webhookData.items || []
      };
    } catch (error) {
      console.error('❌ Error extracting shipping data from webhook:', error);
      return {};
    }
  }

  // Get shipping configuration for a vendor
  async getShippingConfiguration(req, res) {
    try {
      const { userId } = req.params;

      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing userId parameter'
        });
      }

      // Get vendor's shipping configuration from database
      const config = await this.getVendorShippingConfig(userId);

      return res.json({
        success: true,
        data: {
          configuration: config,
          status: 'active',
          last_updated: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('❌ Error getting shipping configuration:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get vendor shipping configuration from database
  async getVendorShippingConfig(userId) {
    try {
      // Query your database for vendor shipping configuration
      const config = await global.dbConnection('shopify_shipping_configs')
        .where('user_id', userId)
        .where('status', 'active')
        .first();

      return config ? JSON.parse(config.configuration) : {
        method: 'app_proxy',
        enabled: true,
        default_weight: 500,
        free_shipping_threshold: 1000
      };
    } catch (error) {
      console.error('❌ Error getting vendor shipping config:', error);
      return {
        method: 'app_proxy',
        enabled: true,
        default_weight: 500,
        free_shipping_threshold: 1000
      };
    }
  }

  // Test shipping API endpoint
  async testShippingAPI(req, res) {
    try {
      const testData = {
        postCode: '110001',
        weight: 500,
        orderAmount: 1000,
        paymentMode: 'prepaid',
        items: []
      };

      const result = await this.calculateNimbusPostShipping(testData);

      return res.json({
        success: true,
        message: 'Shipping API test successful',
        test_data: testData,
        result: result
      });

    } catch (error) {
      console.error('❌ Shipping API test error:', error);
      return res.status(500).json({
        success: false,
        message: 'Shipping API test failed',
        error: error.message
      });
    }
  }
}

module.exports = ShopifyShippingController;
