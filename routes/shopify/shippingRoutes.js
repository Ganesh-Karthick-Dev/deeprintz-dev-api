const express = require('express');
const router = express.Router();
const ShopifyShippingController = require('../../controllers/shopify/shopifyShippingController');
const shippingController = new ShopifyShippingController(); // Create instance

// Apply rate limiting to all shipping routes
const shippingRateLimit = ShopifyShippingController.createRateLimit();
router.use(shippingRateLimit);

// ============================================================================
// PUBLIC ROUTES (no authentication required)
// ============================================================================

/**
 * @route OPTIONS /api/shopify/app-proxy/shipping/script
 * @desc Handle CORS preflight requests for script serving
 * @access Public
 */
router.options('/app-proxy/shipping/script', (req, res) => {
  const origin = req.headers.origin || req.headers.referer;
  if (origin && (origin.includes('myshopify.com') || origin.includes('shopify.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  res.status(200).end();
});

/**
 * @route GET /api/shopify/app-proxy/shipping/script
 * @desc Serve shipping calculator script for Shopify checkout
 * @access Public (no authentication needed for script serving)
 * @query { userId, shop }
 */
router.get('/app-proxy/shipping/script', async (req, res) => {
  try {
    const { userId, shop } = req.query;
    
    if (!userId || !shop) {
      return res.status(400).send('Missing required parameters: userId, shop');
    }

    // Set CORS headers to allow cross-origin requests from Shopify domains
    const origin = req.headers.origin || req.headers.referer || (shop ? `https://${shop}` : undefined);
    if (origin && (origin.includes('myshopify.com') || origin.includes('shopify.com'))) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain');
    res.setHeader('Access-Control-Allow-Credentials', 'false');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    // Allow script to be loaded cross-origin (avoid NotSameOrigin blocking)
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    const scriptContent = `
      // Deeprintz Shopify Shipping Calculator Script
      (function() {
        'use strict';
        
        console.log('🚀 Initializing Deeprintz Shipping Integration');
        
        // Configuration - uses dynamic API base URL
        const config = {
          apiBaseUrl: '${SHOPIFY_CONFIG.API_BASE}/shopify',
          userId: '${userId}',
          shop: '${shop}',
          debug: true
        };
        
        // Shipping calculator class
        class ShopifyShippingCalculator {
          constructor(config) {
            this.config = config;
            this.isInitialized = false;
            this.currentPincode = '';
            this.shippingOptions = [];
            this.init();
          }
          
          init() {
            console.log('🔧 Initializing shipping calculator...');
            this.setupEventListeners();
            this.checkExistingPincode();
            this.isInitialized = true;
            console.log('✅ Shipping calculator initialized');
          }
          
          setupEventListeners() {
            // Listen for pincode changes
            const pincodeSelectors = [
              'input[name="checkout[shipping_address][zip]"]',
              'input[name="checkout[shipping_address][postal_code]"]',
              'input[name="zip"]',
              'input[name="postal_code"]',
              'input[name="postcode"]',
              '#checkout_shipping_address_zip',
              '#checkout_shipping_address_postal_code'
            ];
            
            pincodeSelectors.forEach(selector => {
              const element = document.querySelector(selector);
              if (element) {
                console.log('📍 Found pincode input:', selector);
                element.addEventListener('input', this.debounce((e) => {
                  this.handlePincodeChange(e.target.value);
                }, 500));
                
                element.addEventListener('blur', (e) => {
                  this.handlePincodeChange(e.target.value);
                });
              }
            });
            
            // Listen for checkout updates
            document.addEventListener('shopify:section:load', () => {
              console.log('🔄 Checkout section reloaded, reinitializing...');
              setTimeout(() => this.init(), 100);
            });
          }
          
          checkExistingPincode() {
            const pincodeSelectors = [
              'input[name="checkout[shipping_address][zip]"]',
              'input[name="checkout[shipping_address][postal_code]"]',
              'input[name="zip"]',
              'input[name="postal_code"]',
              'input[name="postcode"]',
              '#checkout_shipping_address_zip',
              '#checkout_shipping_address_postal_code'
            ];
            
            for (const selector of pincodeSelectors) {
              const element = document.querySelector(selector);
              if (element && element.value && element.value.length >= 6) {
                console.log('📍 Found existing pincode:', element.value);
                this.handlePincodeChange(element.value);
                break;
              }
            }
          }
          
          handlePincodeChange(pincode) {
            if (!pincode || pincode.length < 6) {
              return;
            }
            
            if (pincode === this.currentPincode) {
              return;
            }
            
            console.log('📍 Pincode changed:', pincode);
            this.currentPincode = pincode;
            this.calculateShipping(pincode);
          }
          
          async calculateShipping(pincode) {
            try {
              console.log('🚚 Calculating shipping for pincode:', pincode);
              
              // Get cart data
              const cartData = await this.getCartData();
              console.log('📦 Cart data:', cartData);
              
              // Show loading state
              this.showLoading();
              
              // Call shipping API
              const response = await fetch(\`\${this.config.apiBaseUrl}/app-proxy/shipping/calculate?\${new URLSearchParams({
                postCode: pincode,
                weight: cartData.weight,
                orderAmount: cartData.total,
                paymentMode: 'prepaid',
                userId: this.config.userId
              })}\`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Shop-Domain': this.config.shop
                }
              });
              
              const data = await response.json();
              console.log('📡 Shipping API response:', data);
              
              if (data.success && data.rates && data.rates.length > 0) {
                this.displayShippingOptions(data.rates);
              } else {
                this.showNoShippingAvailable();
              }
              
            } catch (error) {
              console.error('❌ Shipping calculation error:', error);
              this.showError('Failed to calculate shipping rates. Please try again.');
            } finally {
              this.hideLoading();
            }
          }
          
          async getCartData() {
            try {
              // Try to get cart data from Shopify's global objects
              if (window.Shopify && window.Shopify.checkout) {
                const checkout = window.Shopify.checkout;
                return {
                  weight: checkout.total_weight || 500,
                  total: checkout.total_price || 0,
                  items: checkout.line_items || []
                };
              }
              
              // Fallback: calculate from DOM
              const weight = 500; // Default weight
              const total = this.getCartTotal();
              
              return { weight, total, items: [] };
            } catch (error) {
              console.error('Error getting cart data:', error);
              return { weight: 500, total: 0, items: [] };
            }
          }
          
          getCartTotal() {
            try {
              const totalElement = document.querySelector('.order-summary__total .order-summary__emphasis');
              if (totalElement) {
                const totalText = totalElement.textContent.replace(/[^0-9.]/g, '');
                return parseFloat(totalText) * 100; // Convert to cents
              }
              return 0;
            } catch (error) {
              console.error('Error getting cart total:', error);
              return 0;
            }
          }
          
          displayShippingOptions(rates) {
            console.log('📋 Displaying shipping options:', rates);
            
            // Create shipping options display
            const shippingContainer = this.getOrCreateShippingContainer();
            
            const optionsHtml = rates.map(rate => \`
              <div class="shipping-option" data-rate-id="\${rate.service_code}">
                <label>
                  <input type="radio" name="custom_shipping" value="\${rate.service_code}" data-price="\${rate.total_price}">
                  <span class="shipping-name">\${rate.service_name}</span>
                  <span class="shipping-price">₹\${(rate.total_price / 100).toFixed(2)}</span>
                  <span class="shipping-delivery">\${rate.description}</span>
                </label>
              </div>
            \`).join('');
            
            shippingContainer.innerHTML = \`
              <div class="custom-shipping-options">
                <h3>🚚 Shipping Options</h3>
                <div class="shipping-list">
                  \${optionsHtml}
                </div>
              </div>
            \`;
            
            // Add event listeners for shipping selection
            shippingContainer.querySelectorAll('input[name="custom_shipping"]').forEach(input => {
              input.addEventListener('change', (e) => {
                this.handleShippingSelection(e.target.value, e.target.dataset.price);
              });
            });
            
            this.showShippingContainer();
          }
          
          handleShippingSelection(serviceCode, price) {
            console.log('🚚 Shipping selected:', serviceCode, price);
            
            // Update checkout with selected shipping
            this.updateCheckoutShipping(serviceCode, price);
          }
          
          updateCheckoutShipping(serviceCode, price) {
            try {
              console.log('🚚 Shipping selected via CarrierService:', serviceCode, price);
              
              // With CarrierService, Shopify will automatically show the rates
              // We just need to update our UI to show selection
              this.updateShippingDisplay(serviceCode, price);
              
              // Show success message
              this.showSuccessMessage(serviceCode, price);
              
            } catch (error) {
              console.error('Error updating checkout shipping:', error);
            }
          }
          
          updateShippingDisplay(serviceCode, price) {
            const shippingElement = document.querySelector('.order-summary__section--shipping .order-summary__small-text');
            if (shippingElement) {
              shippingElement.textContent = \`Custom Shipping - ₹\${(price / 100).toFixed(2)}\`;
            }
          }
          
          showSuccessMessage(serviceCode, price) {
            const container = this.getOrCreateShippingContainer();
            container.innerHTML = \`
              <div style="text-align: center; color: #28a745; padding: 15px;">
                <h3 style="margin: 0; color: #28a745; font-size: 18px;">✅ Shipping Method Selected</h3>
                <p style="margin: 10px 0; color: #333; font-size: 16px;">\${serviceCode} - ₹\${(price / 100).toFixed(2)}</p>
                <p style="margin: 5px 0; color: #666; font-size: 14px;">Shopify will now show this rate in the checkout.</p>
              </div>
            \`;
          }
          
          getOrCreateShippingContainer() {
            let container = document.getElementById('deeprintz-shipping-container');
            if (!container) {
              container = document.createElement('div');
              container.id = 'deeprintz-shipping-container';
              container.style.cssText = \`
                margin: 20px 0;
                padding: 15px;
                border: 1px solid #e1e5e9;
                border-radius: 4px;
                background: #f8f9fa;
              \`;
              
              // Insert after shipping address section
              const shippingSection = document.querySelector('.step__sections .step__section:first-child');
              if (shippingSection) {
                shippingSection.appendChild(container);
              }
            }
            return container;
          }
          
          showShippingContainer() {
            const container = document.getElementById('deeprintz-shipping-container');
            if (container) {
              container.style.display = 'block';
            }
          }
          
          hideShippingContainer() {
            const container = document.getElementById('deeprintz-shipping-container');
            if (container) {
              container.style.display = 'none';
            }
          }
          
          showLoading() {
            const container = this.getOrCreateShippingContainer();
            container.innerHTML = \`
              <div class="shipping-loading">
                <p>🔄 Calculating shipping rates...</p>
              </div>
            \`;
            this.showShippingContainer();
          }
          
          hideLoading() {
            // Loading will be hidden when results are displayed
          }
          
          showError(message) {
            const container = this.getOrCreateShippingContainer();
            container.innerHTML = \`
              <div class="shipping-error">
                <p>❌ \${message}</p>
              </div>
            \`;
            this.showShippingContainer();
          }
          
          showNoShippingAvailable() {
            const container = this.getOrCreateShippingContainer();
            container.innerHTML = \`
              <div class="no-shipping">
                <p>🚫 No shipping options available for this pincode</p>
                <p>Please try a different pincode or contact support</p>
              </div>
            \`;
            this.showShippingContainer();
          }
          
          debounce(func, wait) {
            let timeout;
            return function executedFunction(...args) {
              const later = () => {
                clearTimeout(timeout);
                func(...args);
              };
              clearTimeout(timeout);
              timeout = setTimeout(later, wait);
            };
          }
        }
        
        // Initialize when DOM is ready
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            new ShopifyShippingCalculator(config);
          });
        } else {
          new ShopifyShippingCalculator(config);
        }
        
      })();
    `;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(scriptContent);
    
  } catch (error) {
    console.error('❌ Error serving shipping script:', error);
    res.status(500).send('Error serving script');
  }
});

/**
 * @route GET /api/shopify/app-proxy/shipping/calculate
 * @desc App proxy endpoint to calculate shipping rates (GET for script fetch)
 * @access Public (no authentication needed for app proxy)
 * @query { postCode, weight, orderAmount, paymentMode, items, userId }
 */
router.get('/app-proxy/shipping/calculate', async (req, res) => {
  console.log('🎯 APP PROXY SHIPPING CALCULATE ROUTE HIT!');
  
  // Set CORS headers for API calls
  const origin = req.headers.origin || req.headers.referer;
  if (origin && (origin.includes('myshopify.com') || origin.includes('shopify.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  try {
    console.log('🚚 App proxy shipping calculation request:', req.query);
    console.log('📡 Headers:', req.headers);
    
    // Convert GET query params to POST body format for the main controller
    req.body = {
      postCode: req.query.postCode,
      weight: parseFloat(req.query.weight),
      orderAmount: parseFloat(req.query.orderAmount),
      paymentMode: req.query.paymentMode || 'prepaid',
      items: req.query.items ? JSON.parse(req.query.items) : [],
      userId: req.query.userId,
      shopDomain: req.headers['x-shopify-shop-domain']
    };
    
    console.log('📦 Converted body:', req.body);
    
    // Call the main shipping controller
    await shippingController.calculateShipping(req, res);
    
  } catch (error) {
    console.error('❌ App proxy shipping calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

/**
 * @route GET /api/shopify/shipping-calc
 * @desc Legacy shipping calc route (for backward compatibility)
 * @access Public
 */
router.get('/shipping-calc', async (req, res) => {
  console.log('🎯 LEGACY SHIPPING CALC ROUTE HIT!');
  
  // Set CORS headers for API calls
  const origin = req.headers.origin || req.headers.referer;
  if (origin && (origin.includes('myshopify.com') || origin.includes('shopify.com'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain');
  res.setHeader('Access-Control-Allow-Credentials', 'false');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  return res.json({
    success: true,
    message: 'Legacy shipping calc route working',
    query: req.query,
    timestamp: new Date().toISOString()
  });
});

// Test route to verify routing is working
router.get('/test-route', async (req, res) => {
  console.log('🎯 TEST ROUTE HIT!');
  return res.json({
    success: true,
    message: 'Test route working',
    timestamp: new Date().toISOString()
  });
});

router.get('/app-proxy/shipping/calculate-debug', async (req, res) => {
  console.log('🎯 APP PROXY DEBUG ROUTE HIT!');
  try {
    console.log('🚚 App proxy shipping calculation request:', req.query);
    console.log('📡 Headers:', req.headers);
    
    // Convert GET query params to POST body format for the main controller
    req.body = {
      postCode: req.query.postCode,
      weight: parseFloat(req.query.weight),
      orderAmount: parseFloat(req.query.orderAmount),
      paymentMode: req.query.paymentMode || 'prepaid',
      items: req.query.items ? JSON.parse(req.query.items) : [],
      userId: req.query.userId,
      shopDomain: req.headers['x-shopify-shop-domain']
    };
    
    console.log('📦 Converted body:', req.body);
    
    // Test direct NimbusPost call
    try {
      const axios = require('axios');
      
      // Generate NimbusPost token
      const tokenResponse = await axios.post(
        'https://api.nimbuspost.com/v1/users/login', 
        {
          email: "care+1201@deeprintz.com",
          password: "3JfzKQpHsG"
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: 10000
        }
      );

      const token = tokenResponse.data;
      console.log('🔑 NimbusPost token generated:', token ? 'Success' : 'Failed');
      
      if (!token) {
        return res.json({
          success: false,
          message: 'Failed to generate NimbusPost token',
          error: 'NIMBUSPOST_TOKEN_FAILED'
        });
      }

      // Prepare courier data
      const courierData = {
        origin: "641603",
        destination: req.query.postCode,
        payment_type: req.query.paymentMode === 'cod' ? 'cod' : 'prepaid',
        order_amount: req.query.paymentMode === 'cod' ? (req.query.orderAmount || 0) : "",
        weight: req.query.weight,
        length: "",
        breadth: "",
        height: ""
      };

      console.log('📦 Courier data:', courierData);

      // Fetch courier partners
      const courierResponse = await axios.post(
        'https://api.nimbuspost.com/v1/courier/serviceability', 
        courierData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          timeout: 15000
        }
      );

      const result = courierResponse.data;
      console.log('📡 NimbusPost response:', result);
      
      if (!result.status || !result.data) {
        return res.json({
          success: false,
          message: 'No courier partners available for this location',
          error: 'SHIPPING_CALCULATION_FAILED'
        });
      }

      // Format courier data for Shopify
      const shippingOptions = result.data.map(courier => ({
        service_name: courier.name,
        service_code: courier.id,
        total_price: Math.round(courier.total_charges * 100), // Convert to cents
        currency: 'INR',
        min_delivery_date: courier.edd,
        max_delivery_date: courier.edd,
        description: `${courier.name} - ${courier.edd}`,
        phone_required: false,
        delivery_category: 'standard',
        _metadata: {
          courier_id: courier.id,
          estimated_delivery: courier.edd,
          cod_charge: courier.cod_charges,
          original_cost: courier.total_charges,
          postcode: req.query.postCode
        }
      }));

      console.log('✅ Shipping options formatted:', shippingOptions.length);

      return res.json({
        success: true,
        rates: shippingOptions,
        message: 'Shipping rates calculated successfully'
      });

    } catch (error) {
      console.error('❌ Direct NimbusPost call error:', error);
      return res.json({
        success: false,
        message: 'Shipping calculation failed',
        error: error.message
      });
    }
  } catch (error) {
    console.error('❌ App proxy shipping calculation error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ============================================================================
// SHOPIFY CARRIER SERVICE ROUTES (for native checkout integration)
// MUST BE BEFORE AUTHENTICATION - Shopify calls this directly without auth
// ============================================================================

/**
 * @route GET /api/shopify/carrier/rates/test
 * @desc Test endpoint to verify CarrierService endpoint is accessible
 * @access Public
 */
router.get('/carrier/rates/test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'CarrierService endpoint is accessible',
    timestamp: new Date().toISOString(),
    shopDomain: req.headers['x-shopify-shop-domain'] || 'not provided',
    callbackUrl: `${req.protocol}://${req.get('host')}${req.originalUrl.replace('/test', '')}`
  });
});

/**
 * @route POST /api/shopify/carrier/rates
 * @desc CarrierService rates endpoint - Shopify calls this to get shipping rates
 * @access Public (Shopify calls this directly - NO AUTHENTICATION REQUIRED)
 * @body Shopify CarrierService request with rate object
 * 
 * Shopify sends:
 * {
 *   "rate": {
 *     "destination": { "postal_code": "641012", ... },
 *     "items": [{ "grams": 200, "price": 16150, ... }]
 *   }
 * }
 * 
 * We must return:
 * {
 *   "rates": [
 *     {
 *       "service_name": "Blue Dart Standard",
 *       "service_code": "BLUEDART_STD",
 *       "total_price": "5000",  // String in cents (₹50.00)
 *       "currency": "INR",
 *       "description": "Blue Dart - 3-5 days",
 *       "min_delivery_date": "2024-01-15",
 *       "max_delivery_date": "2024-01-17"
 *     }
 *   ]
 * }
 */
router.post('/carrier/rates', async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('='.repeat(80));
    console.log('🚚 CarrierService rates request received at:', new Date().toISOString());
    console.log('📡 Request headers:', JSON.stringify(req.headers, null, 2));
    console.log('📦 Request body:', JSON.stringify(req.body, null, 2));
    console.log('📋 Request method:', req.method);
    console.log('🔗 Request URL:', req.url);
    
    // Extract shop domain from headers (Shopify sends this)
    const shopDomain = req.headers['x-shopify-shop-domain'] || 
                       req.headers['x-shopify-shop'] || 
                       req.headers['x-shopify-shop-domain']?.toLowerCase();
    
    console.log('🏪 Shop domain extracted:', shopDomain);
    
    if (!shopDomain) {
      console.error('❌ No shop domain in request headers');
      console.error('❌ Available headers:', Object.keys(req.headers));
      return res.status(200).json({ rates: [] }); // Shopify expects 200 OK even on error
    }
    
    // Normalize shop domain
    const normalizedShopDomain = shopDomain.includes('.myshopify.com') 
      ? shopDomain 
      : `${shopDomain}.myshopify.com`;
    
    console.log('🏪 Normalized shop domain:', normalizedShopDomain);
    
    // Get userId from shop domain (optional - for logging/tracking)
    let userId = null;
    try {
      const AppProxyController = require('../../controllers/shopify/appProxyController');
      const appProxyController = new AppProxyController();
      userId = await appProxyController.getUserIdFromShop(normalizedShopDomain);
      console.log('✅ Found userId from shop domain:', userId);
    } catch (userIdError) {
      console.log('ℹ️ Could not get userId from shop domain (continuing anyway):', userIdError.message);
      console.log('ℹ️ Error stack:', userIdError.stack);
    }
    
    // Extract data from Shopify's CarrierService request
    // Shopify sends: { rate: { destination: { postal_code: "..." }, items: [...], ... } }
    const { rate } = req.body;
    
    console.log('📊 Rate object:', JSON.stringify(rate, null, 2));
    
    if (!rate) {
      console.error('❌ No rate object in request body');
      console.error('❌ Request body structure:', Object.keys(req.body || {}));
      return res.status(200).json({ rates: [] }); // Shopify expects 200 OK
    }
    
    const { destination, items, currency, origin } = rate;
    
    console.log('📍 Destination:', destination);
    console.log('📦 Items:', items);
    console.log('💰 Currency:', currency);
    console.log('🏠 Origin:', origin);
    
    if (!destination) {
      console.error('❌ No destination object in rate');
      return res.status(200).json({ rates: [] });
    }
    
    if (!destination.postal_code) {
      console.error('❌ No destination postal_code in rate');
      console.error('❌ Destination object:', destination);
      return res.status(200).json({ rates: [] });
    }
    
    const postalCode = destination.postal_code.toString().trim();
    
    if (!postalCode || postalCode.length < 5) {
      console.error('❌ Invalid postal code:', postalCode);
      return res.status(200).json({ rates: [] });
    }
    
    console.log('📮 Postal code:', postalCode);
    
    // Calculate total weight and value from items
    // Shopify sends: grams (e.g., 200g) and price in cents (e.g., 16150 = ₹161.50)
    let totalWeightGrams = 0;
    let totalValueCents = 0;
    
    if (items && items.length > 0) {
      // First, try to get weights from Shopify payload
      totalWeightGrams = items.reduce((sum, item) => sum + (item.grams || 0), 0);
      totalValueCents = items.reduce((sum, item) => sum + (item.price || 0), 0);
      
      // If weight is 0, try to fetch from database
      if (totalWeightGrams === 0) {
        console.log('⚠️ Shopify payload has 0 weight, fetching from database...');
        
        try {
          // Fetch weights from productvariants table
          // Use product name to find the Deeprintz product
          for (const item of items) {
            console.log(`🔍 Looking up weight for: "${item.name}", SKU: ${item.sku}`);
            
            // Extract product name (remove size variant like "- Small")
            const productName = item.name.split(' - ')[0].trim();
            console.log(`   Product name extracted: "${productName}"`);
            
            // Find the Deeprintz product by name
            const deeprintzProduct = await global.dbConnection('products')
              .where('productname', 'like', `%${productName}%`)
              .select('productid', 'productname')
              .first();
            
            if (deeprintzProduct) {
              console.log(`✅ Found Deeprintz product: ID ${deeprintzProduct.productid} - ${deeprintzProduct.productname}`);
              
              // Now get a variant for this product (any variant will have the weight)
              const variant = await global.dbConnection('productvariants')
                .where('productid', deeprintzProduct.productid)
                .select('weight', 'unit')
                .first();
              
              if (variant && variant.weight) {
                let weightInGrams = parseFloat(variant.weight);
                
                // Convert to grams if needed
                if (variant.unit === 'kg') {
                  weightInGrams = weightInGrams * 1000;
                } else if (variant.unit !== 'gms' && variant.unit !== 'grams') {
                  // Assume grams
                  console.log(`⚠️ Unknown unit "${variant.unit}", assuming grams`);
                }
                
                totalWeightGrams += weightInGrams * (item.quantity || 1);
                console.log(`✅ Found weight in DB: ${weightInGrams}g (unit: ${variant.unit})`);
              } else {
                console.log(`⚠️ No variant weight found for product ${deeprintzProduct.productid}`);
              }
            } else {
              console.log(`⚠️ No product found matching name: "${productName}"`);
            }
          }
        } catch (dbError) {
          console.log('⚠️ Database lookup failed:', dbError.message);
          console.log('   Stack:', dbError.stack);
        }
      }
    } else {
      // Default values if no items
      totalWeightGrams = 250; // 250g default
      totalValueCents = 0;
    }
    
    // Final fallback: if still 0 after database lookup, use default
    if (totalWeightGrams === 0) {
      totalWeightGrams = 250; // 250g fallback for apparel
      console.log('⚠️ No weight found anywhere, using fallback: 250g');
    }
    
    // Convert for Nimbus Post API:
    // - Weight: grams → kg (Nimbus Post expects kg)
    // - Order amount: cents → rupees (Nimbus Post expects rupees)
    const totalWeightKg = totalWeightGrams / 1000;
    const totalValueRupees = totalValueCents / 100;
    
    console.log('📦 Calculated totals:', { 
      postalCode, 
      weightGrams: totalWeightGrams, 
      weightKg: totalWeightKg,
      valueCents: totalValueCents,
      valueRupees: totalValueRupees,
      userId, 
      shopDomain 
    });
    
    // Use the shipping controller which has NimbusPost + fallback logic
    let shippingResult = null;

    try {
      console.log('🚚 Calculating shipping rates using controller...');

      // Use the shipping controller which has NimbusPost + fallback logic
      shippingResult = await shippingController.calculateNimbusPostShipping({
        postCode: postalCode,
        weight: totalWeightGrams, // Use grams as expected by controller
        orderAmount: totalValueRupees,
        paymentMode: 'prepaid', // Always prepaid for Shopify
        items: []
      });

      console.log('📦 Shipping calculation result:', {
        success: shippingResult.success,
        source: shippingResult.data?.source,
        optionsCount: shippingResult.data?.shipping_options?.length || 0
      });

    } catch (shippingError) {
      console.error('❌ Shipping calculation failed:', shippingError.message);
      shippingResult = { success: false, error: shippingError.message };
    }

    let shopifyRates = [];

    if (shippingResult.success && shippingResult.data?.shipping_options?.length > 0) {
      // Convert shipping options to Shopify CarrierService format
      shopifyRates = shippingResult.data.shipping_options
        .map(option => {
          // Convert rupees to cents for Shopify
          const totalPriceCents = Math.round(option.total_cost * 100);

          // Calculate delivery dates
          let minDays = 3;
          let maxDays = 5;

          // Try to extract days from delivery time
          const deliveryTime = option.estimated_delivery || '3-5 days';
          const daysMatch = deliveryTime.match(/(\d+)(?:\s*-\s*(\d+))?/);
          if (daysMatch) {
            minDays = parseInt(daysMatch[1]) || 3;
            maxDays = daysMatch[2] ? parseInt(daysMatch[2]) : (minDays + 2);
          }

          const minDate = new Date();
          minDate.setDate(minDate.getDate() + minDays);
          const maxDate = new Date();
          maxDate.setDate(maxDate.getDate() + maxDays);

          return {
            service_name: option.courier_name,
            service_code: option.courier_id,
            total_price: totalPriceCents.toString(),
            currency: currency || 'INR',
            description: `${option.courier_name} - ${deliveryTime}`,
            min_delivery_date: minDate.toISOString().split('T')[0],
            max_delivery_date: maxDate.toISOString().split('T')[0]
          };
        })
        .filter(rate => rate !== null);
    }

    // If no rates from controller, provide fallback mock rates
    if (shopifyRates.length === 0) {
      console.log('⚠️ No shipping options available, providing mock rates for testing');

      shopifyRates = [
        {
          service_name: 'Standard Delivery',
          service_code: 'STD_DELIVERY',
          total_price: '5000', // ₹50.00 in cents
          currency: currency || 'INR',
          description: 'Standard Delivery - 3-5 business days',
          min_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          max_delivery_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        },
        {
          service_name: 'Express Delivery',
          service_code: 'EXP_DELIVERY',
          total_price: '10000', // ₹100.00 in cents
          currency: currency || 'INR',
          description: 'Express Delivery - 1-2 business days',
          min_delivery_date: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          max_delivery_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        }
      ];
    }

    // Sort by price (lowest first)
    shopifyRates.sort((a, b) => parseInt(a.total_price) - parseInt(b.total_price));

    const responseTime = Date.now() - startTime;
    console.log('✅ Returning Shopify rates:', shopifyRates.length);
    console.log('⏱️ Response time:', responseTime, 'ms');
    console.log('📤 Rates:', JSON.stringify(shopifyRates, null, 2));
    console.log('='.repeat(80));

    // Set proper headers for Shopify
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('X-Response-Time', responseTime.toString());

    // Return rates (Shopify expects 200 OK with { rates: [...] })
    return res.status(200).json({ rates: shopifyRates });
    
  } catch (error) {
    const responseTime = Date.now() - startTime;
    console.error('='.repeat(80));
    console.error('❌ CarrierService rates error:', error.message);
    console.error('❌ Error type:', error.constructor.name);
    console.error('❌ Error stack:', error.stack);
    console.error('⏱️ Response time before error:', responseTime, 'ms');
    console.error('='.repeat(80));
    
    // Always return empty rates array on error (Shopify expects 200 OK)
    // Shopify will show "No shipping available" if rates array is empty
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ rates: [] });
  }
});

// Apply Shopify authentication to all remaining routes
router.use(ShopifyShippingController.authenticateShopifyRequest);

// ============================================================================
// SHOPIFY SHIPPING API ROUTES (require authentication)
// ============================================================================

/**
 * @route POST /api/shopify/shipping/calculate
 * @desc Calculate shipping rates for Shopify checkout
 * @access Public (with Shopify authentication)
 * @body { postCode, weight, orderAmount, paymentMode, items, userId, shopDomain }
 */
router.post('/shipping/calculate', async (req, res) => {
  await shippingController.calculateShipping(req, res);
});

/**
 * @route POST /api/shopify/shipping/webhook
 * @desc Handle Shopify shipping webhook
 * @access Public (with Shopify authentication)
 * @body Shopify webhook data
 */
router.post('/shipping/webhook', async (req, res) => {
  await shippingController.handleShippingWebhook(req, res);
});

/**
 * @route GET /api/shopify/shipping/config/:userId
 * @desc Get shipping configuration for a vendor
 * @access Public (with Shopify authentication)
 * @param userId - Vendor ID
 */
router.get('/shipping/config/:userId', async (req, res) => {
  await shippingController.getShippingConfiguration(req, res);
});

/**
 * @route GET /api/shopify/shipping/test
 * @desc Test shipping API endpoint
 * @access Public (with Shopify authentication)
 */
router.get('/shipping/test', async (req, res) => {
  await shippingController.testShippingAPI(req, res);
});

// ============================================================================
// SHOPIFY APP PROXY ROUTES (for checkout integration)
// ============================================================================

module.exports = router;