const express = require('express');
const router = express.Router();
const ShopifyShippingController = require('../../controllers/shopify/shopifyShippingController');

// Create controller instance
const shippingController = new ShopifyShippingController();

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
        
        // Configuration
        const config = {
          apiBaseUrl: 'https://devapi.deeprintz.com/api/deeprintz/live/shopify',
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

// Apply Shopify authentication to all remaining routes
router.use(ShopifyShippingController.authenticateShopifyRequest);

// ============================================================================
// SHOPIFY SHIPPING API ROUTES
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
// SHOPIFY CARRIER SERVICE ROUTES (for native checkout integration)
// ============================================================================

/**
 * @route POST /api/shopify/carrier/rates
 * @desc CarrierService rates endpoint - Shopify calls this to get shipping rates
 * @access Public (Shopify calls this directly)
 * @body Shopify CarrierService request with rate object
 */
router.post('/carrier/rates', async (req, res) => {
  try {
    console.log('🚚 CarrierService rates request received:', JSON.stringify(req.body, null, 2));
    
    // Extract data from Shopify's CarrierService request
    const { rate } = req.body;
    if (!rate) {
      console.log('❌ No rate object in request');
      return res.json({ rates: [] });
    }
    
    const { destination, items, currency, origin } = rate;
    
    if (!destination || !destination.postal_code) {
      console.log('❌ No destination postal code');
      return res.json({ rates: [] });
    }
    
    // Calculate total weight and value from items
    let totalWeight = 0;
    let totalValue = 0;
    
    if (items && items.length > 0) {
      totalWeight = items.reduce((sum, item) => sum + (item.grams || 0), 0) / 1000; // Convert grams to kg
      totalValue = items.reduce((sum, item) => sum + (item.price || 0), 0) / 100; // Convert cents to currency
    } else {
      totalWeight = 0.5; // Default weight
      totalValue = 0;
    }
    
    console.log('📦 Calculated totals:', { totalWeight, totalValue, postalCode: destination.postal_code });
    
    // Prepare request for shipping controller
    const shippingRequest = {
      body: {
        postCode: destination.postal_code,
        weight: totalWeight,
        orderAmount: totalValue,
        paymentMode: 'prepaid',
        items: items || [],
        userId: 'default', // You might want to get this from shop domain
        shopDomain: req.headers['x-shopify-shop-domain']
      }
    };
    
    // Create a mock response object to capture the controller's response
    let controllerResponse = null;
    const mockRes = {
      json: (data) => { controllerResponse = data; },
      status: (code) => ({ json: (data) => { controllerResponse = data; } })
    };
    
    // Call the shipping controller
    await shippingController.calculateShipping(shippingRequest, mockRes);

    // Support both controller shapes:
    // A) { rates: [...] }  (current controller output)
    // B) { success: true, data: { shipping_options: [...] } }
    let shopifyRates = [];
    if (controllerResponse && Array.isArray(controllerResponse.rates)) {
      // Already in Shopify format
      shopifyRates = controllerResponse.rates;
    } else if (controllerResponse && controllerResponse.success && controllerResponse.data && Array.isArray(controllerResponse.data.shipping_options)) {
      shopifyRates = controllerResponse.data.shipping_options.map(option => ({
        service_name: option.service_name,
        service_code: option.service_code,
        total_price: option.total_price,
        currency: 'INR',
        min_delivery_date: option.min_delivery_date,
        max_delivery_date: option.max_delivery_date,
        description: option.description
      }));
    } else {
      console.log('❌ Shipping calculation failed or unexpected shape:', controllerResponse);
      return res.json({ rates: [] });
    }
    
    console.log('✅ Returning Shopify rates:', shopifyRates.length);
    
    res.json({ rates: shopifyRates });
    
  } catch (error) {
    console.error('❌ CarrierService rates error:', error);
    res.json({ rates: [] });
  }
});

// ============================================================================
// SHOPIFY APP PROXY ROUTES (for checkout integration)
// ============================================================================

module.exports = router;