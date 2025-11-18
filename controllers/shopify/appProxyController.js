const ShopifyShippingService = require('../../service/shopify/shopifyShippingService');
const ShopifyShippingController = require('./shopifyShippingController');

class AppProxyController {
  constructor() {
    this.shopifyShippingService = ShopifyShippingService;
    this.shopifyShippingController = ShopifyShippingController;
  }

  // Handle app proxy requests
  async handleProxy(req, res) {
    try {
      console.log('🔗 App Proxy request received:', req.url);
      console.log('📡 Headers:', req.headers);
      console.log('📦 Body:', req.body);
      console.log('🔍 Query:', req.query);

      // Extract shop information from headers
      const shop = req.headers['x-shopify-shop-domain'];
      const signature = req.headers['x-shopify-hmac-sha256'];
      
      if (!shop) {
        return res.status(400).json({
          success: false,
          message: 'Missing shop domain in headers'
        });
      }

      // Route to appropriate handler based on path
      const path = req.path;
      
      if (path.includes('/shipping/calculate')) {
        return await this.handleShippingCalculate(req, res, shop);
      } else if (path.includes('/shipping/webhook')) {
        return await this.handleShippingWebhook(req, res, shop);
      } else if (path.includes('/shipping/script')) {
        return await this.serveShippingScript(req, res);
      } else {
        return res.status(404).json({
          success: false,
          message: 'Endpoint not found'
        });
      }
    } catch (error) {
      console.error('❌ App Proxy error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Handle shipping calculation via app proxy
  async handleShippingCalculate(req, res, shop) {
    try {
      console.log('🚚 Shipping calculation via app proxy for shop:', shop);
      
      // Get data from query parameters or body
      const { 
        postCode, 
        weight, 
        orderAmount, 
        paymentMode = 'prepaid',
        userId,
        items
      } = req.method === 'GET' ? req.query : req.body;

      // Validate required fields
      if (!postCode || !weight || !orderAmount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: postCode, weight, orderAmount'
        });
      }

      // Get user ID from shop domain (you'll need to implement this mapping)
      const mappedUserId = await this.getUserIdFromShop(shop);
      if (!mappedUserId && !userId) {
        return res.status(400).json({
          success: false,
          message: 'User ID not found for this shop'
        });
      }

      // Prepare shipping data
      const shippingData = {
        userId: userId || mappedUserId,
        shopDomain: shop,
        postCode,
        weight: parseFloat(weight),
        orderAmount: parseFloat(orderAmount),
        paymentMode,
        items: items ? JSON.parse(items) : []
      };

      console.log('📦 Shipping data:', shippingData);

      // Use the new shipping controller
      req.body = shippingData;
      await this.shopifyShippingController.calculateShipping(req, res);
      
    } catch (error) {
      console.error('❌ Shipping calculation error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Handle shipping webhook via app proxy
  async handleShippingWebhook(req, res, shop) {
    try {
      console.log('📡 Shipping webhook via app proxy for shop:', shop);
      
      // Use the new shipping controller
      await this.shopifyShippingController.handleShippingWebhook(req, res);
      
    } catch (error) {
      console.error('❌ Shipping webhook error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get user ID from shop domain
  async getUserIdFromShop(shop) {
    try {
      // Normalize shop domain (remove .myshopify.com if present, add it if missing)
      let normalizedShop = shop;
      if (!normalizedShop.includes('.')) {
        normalizedShop = `${normalizedShop}.myshopify.com`;
      }
      
      // Query shopify_stores table to find vendor_id by shop_domain
      const shopifyStore = await global.dbConnection('shopify_stores')
        .where('shop_domain', normalizedShop)
        .orWhere('shop_domain', shop)
        .first();

      if (shopifyStore && shopifyStore.vendor_id) {
        console.log('✅ Found vendor_id from shopify_stores:', shopifyStore.vendor_id);
        return shopifyStore.vendor_id;
      }

      // Fallback: Try app_users table (for WooCommerce stores)
      const user = await global.dbConnection('app_users')
        .where('store_url', 'like', `%${shop}%`)
        .orWhere('store_url', 'like', `%${shop.replace('.myshopify.com', '')}%`)
        .first();

      return user ? user.userid : null;
    } catch (error) {
      console.error('❌ Error getting user ID from shop:', error);
      console.error('❌ Error details:', error.message);
      console.error('❌ Shop domain:', shop);
      return null;
    }
  }

  // Serve shipping calculator script
  async serveShippingScript(req, res) {
    try {
      const { userId, shop } = req.query;
      
      if (!userId || !shop) {
        return res.status(400).send('Missing required parameters: userId, shop');
      }

      const scriptContent = `
        // Deeprintz Shipping Calculator Script for Shopify
        (function() {
          'use strict';
          
          const SHIPPING_CONFIG = {
            apiBaseUrl: 'https://devapi.deeprintz.com/api/shopify/app-proxy/shipping',
            userId: '${userId}',
            shopDomain: '${shop}',
            debug: false
          };

          // Initialize shipping integration
          function initShippingIntegration() {
            console.log('🚀 Initializing Deeprintz Shipping Integration');
            
            if (isCheckoutPage()) {
              initCheckoutShipping();
            } else if (isCartPage()) {
              initCartShipping();
            }
          }

          function isCheckoutPage() {
            return window.location.pathname.includes('/checkout') || 
                   document.querySelector('.checkout') ||
                   document.querySelector('[data-checkout]');
          }

          function isCartPage() {
            return window.location.pathname.includes('/cart') ||
                   document.querySelector('.cart') ||
                   document.querySelector('[data-cart]');
          }

          function initCheckoutShipping() {
            console.log('🛒 Initializing checkout shipping');
            
            // Start watching native ZIP immediately, before section appears
            bindNativeZipWatcher();

            const checkoutInterval = setInterval(() => {
              const shippingSection = document.querySelector('.step[data-step="shipping_method"]') ||
                                     document.querySelector('.section--shipping-method') ||
                                     document.querySelector('[data-shipping-method]');
              
              if (shippingSection) {
                clearInterval(checkoutInterval);
                addShippingCalculatorToCheckout(shippingSection);
              }
            }, 500);

            setTimeout(() => clearInterval(checkoutInterval), 10000);
          }

          function initCartShipping() {
            console.log('🛍️ Initializing cart shipping');
            
            const cartContainer = document.querySelector('.cart') ||
                                 document.querySelector('[data-cart]') ||
                                 document.querySelector('.cart-page');
            
            if (cartContainer) {
              addShippingCalculatorToCart(cartContainer);
            }
          }

          function addShippingCalculatorToCheckout(container) {
            const calculatorHTML = \`
              <div id="deeprintz-shipping-calculator" class="deeprintz-shipping-calculator">
                <div class="shipping-calculator-header">
                  <h3>Calculate Shipping</h3>
                </div>
                <div class="pincode-input-container">
                  <input 
                    type="text" 
                    id="shipping-pincode" 
                    placeholder="Enter your pincode" 
                    maxlength="6"
                    class="pincode-input"
                  />
                  <button id="calculate-shipping-btn" class="calculate-btn">Calculate</button>
                </div>
                <div id="shipping-results" class="shipping-results"></div>
                <div id="shipping-loading" class="shipping-loading" style="display: none;">
                  <div class="loading-spinner"></div>
                  <span>Calculating shipping...</span>
                </div>
                <div id="shipping-error" class="shipping-error" style="display: none;"></div>
              </div>
            \`;

            const shippingMethods = container.querySelector('.section__content') ||
                                   container.querySelector('.shipping-methods') ||
                                   container;
            
            shippingMethods.insertAdjacentHTML('afterbegin', calculatorHTML);
            
            addShippingStyles();
            bindShippingEvents();
            bindNativeZipWatcher();
          }

          function ensureCalculatorExists() {
            if (document.getElementById('deeprintz-shipping-calculator')) return true;
            const container = document.querySelector('.step__sections .step__section') ||
                              document.querySelector('.step__section') ||
                              document.querySelector('.main__content') ||
                              document.querySelector('.content') ||
                              document.body;
            if (!container) return false;
            const node = document.createElement('div');
            node.id = 'deeprintz-shipping-calculator';
            node.className = 'deeprintz-shipping-calculator';
            node.innerHTML = '<div class="shipping-calculator-header">\
                  <h3>Calculate Shipping</h3>\
                </div>\
                <div class="pincode-input-container">\
                  <input type="text" id="shipping-pincode" placeholder="Enter your pincode" maxlength="6" class="pincode-input" />\
                  <button id="calculate-shipping-btn" class="calculate-btn">Calculate</button>\
                </div>\
                <div id="shipping-results" class="shipping-results"></div>\
                <div id="shipping-loading" class="shipping-loading" style="display: none;">\
                  <div class="loading-spinner"></div>\
                  <span>Calculating shipping...</span>\
                </div>\
                <div id="shipping-error" class="shipping-error" style="display: none;"></div>';
            if (node) {
              container.insertAdjacentElement('afterbegin', node);
              addShippingStyles();
              bindShippingEvents();
              return true;
            }
            return false;
          }

          function addShippingCalculatorToCart(container) {
            const calculatorHTML = \`
              <div id="deeprintz-shipping-calculator" class="deeprintz-shipping-calculator cart-shipping">
                <div class="shipping-calculator-header">
                  <h3>Estimate Shipping</h3>
                </div>
                <div class="pincode-input-container">
                  <input 
                    type="text" 
                    id="shipping-pincode" 
                    placeholder="Enter your pincode" 
                    maxlength="6"
                    class="pincode-input"
                  />
                  <button id="calculate-shipping-btn" class="calculate-btn">Calculate</button>
                </div>
                <div id="shipping-results" class="shipping-results"></div>
                <div id="shipping-loading" class="shipping-loading" style="display: none;">
                  <div class="loading-spinner"></div>
                  <span>Calculating shipping...</span>
                </div>
                <div id="shipping-error" class="shipping-error" style="display: none;"></div>
              </div>
            \`;

            container.insertAdjacentHTML('beforeend', calculatorHTML);
            
            addShippingStyles();
            bindShippingEvents();
          }

          function addShippingStyles() {
            if (document.getElementById('deeprintz-shipping-styles')) return;

            const style = document.createElement('style');
            style.id = 'deeprintz-shipping-styles';
            style.textContent = \`
              .deeprintz-shipping-calculator {
                background: #f8f9fa;
                border: 1px solid #e9ecef;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              }
              
              .deeprintz-shipping-calculator h3 {
                margin: 0 0 15px 0;
                color: #333;
                font-size: 16px;
                font-weight: 600;
              }
              
              .pincode-input-container {
                display: flex;
                gap: 10px;
                margin-bottom: 15px;
              }
              
              .pincode-input {
                flex: 1;
                padding: 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
              }
              
              .pincode-input:focus {
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
              }
              
              .calculate-btn {
                padding: 12px 20px;
                background: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: background-color 0.2s;
              }
              
              .calculate-btn:hover {
                background: #0056b3;
              }
              
              .calculate-btn:disabled {
                background: #6c757d;
                cursor: not-allowed;
              }
              
              .shipping-results {
                margin-top: 15px;
              }
              
              .shipping-option {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px;
                margin: 8px 0;
                background: white;
                border: 1px solid #e9ecef;
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
              }
              
              .shipping-option:hover {
                border-color: #007bff;
                box-shadow: 0 2px 4px rgba(0, 123, 255, 0.1);
              }
              
              .shipping-option.selected {
                border-color: #007bff;
                background: #f8f9ff;
              }
              
              .shipping-option-info {
                flex: 1;
              }
              
              .shipping-option-name {
                font-weight: 600;
                color: #333;
                margin-bottom: 4px;
              }
              
              .shipping-option-details {
                font-size: 12px;
                color: #666;
              }
              
              .shipping-option-price {
                font-weight: 600;
                color: #007bff;
                font-size: 16px;
              }
              
              .shipping-loading {
                text-align: center;
                padding: 20px;
                color: #666;
              }
              
              .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007bff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 10px;
              }
              
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              
              .shipping-error {
                background: #f8d7da;
                color: #721c24;
                padding: 12px;
                border-radius: 4px;
                border: 1px solid #f5c6cb;
                margin-top: 15px;
              }
              
              .no-shipping {
                text-align: center;
                padding: 20px;
                color: #666;
                background: #f8f9fa;
                border-radius: 4px;
                margin-top: 15px;
              }

              .shipping-confirmation {
                background: #d4edda;
                color: #155724;
                padding: 12px;
                border-radius: 4px;
                margin-top: 10px;
                border: 1px solid #c3e6cb;
              }

              @media (max-width: 768px) {
                .pincode-input-container {
                  flex-direction: column;
                }
                
                .calculate-btn {
                  width: 100%;
                }
              }
            \`;
            document.head.appendChild(style);
          }

          function bindShippingEvents() {
            const pincodeInput = document.getElementById('shipping-pincode');
            const calculateBtn = document.getElementById('calculate-shipping-btn');

            if (pincodeInput) {
              pincodeInput.addEventListener('input', handlePincodeInput);
              pincodeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                  calculateShipping();
                }
              });
            }

            if (calculateBtn) {
              calculateBtn.addEventListener('click', calculateShipping);
            }
          }

          function bindNativeZipWatcher() {
            const selectors = [
              'input#checkout_shipping_address_zip',
              'input[name="checkout[shipping_address][zip]"]',
              'input[data-checkout="shipping_address[zip]"]',
              'input[name="checkout[attributes][zip]"]',
              // Billing fallbacks
              'input#checkout_billing_address_zip',
              'input[name="checkout[billing_address][zip]"]',
              'input[data-checkout="billing_address[zip]"]'
            ];
            let zipInput = null;
            for (const sel of selectors) {
              const el = document.querySelector(sel);
              if (el) { zipInput = el; break; }
            }

            if (!zipInput) {
              const retryInterval = setInterval(() => {
                for (const sel of selectors) {
                  const el = document.querySelector(sel);
                  if (el) { zipInput = el; break; }
                }
                if (zipInput) {
                  clearInterval(retryInterval);
                  attachZipListeners(zipInput);
                }
              }, 500);
              setTimeout(() => clearInterval(retryInterval), 5000);
              return;
            }

            attachZipListeners(zipInput);
          }

          function attachZipListeners(zipInput) {
            const localInput = document.getElementById('shipping-pincode');
            let debounceTimer = null;

            const handler = () => {
              const raw = (zipInput.value || '').replace(/\D/g, '');
              if (localInput) localInput.value = raw;
              if (raw.length === 6) {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                  const current = (zipInput.value || '').replace(/\D/g, '');
                  if (current.length === 6) {
                    if (!document.getElementById('deeprintz-shipping-calculator')) {
                      ensureCalculatorExists();
                    }
                    calculateShipping(current);
                  }
                }, 400);
              }
            };

            zipInput.addEventListener('input', handler);
            zipInput.addEventListener('change', handler);

            // Fire once on load if already filled
            handler();
          }

          function handlePincodeInput(e) {
            const pincode = e.target.value.replace(/\\D/g, '');
            e.target.value = pincode;
            
            if (pincode.length === 6) {
              setTimeout(() => {
                if (e.target.value.length === 6) {
                  calculateShipping();
                }
              }, 500);
            }
          }

          async function calculateShipping(pincodeOverride) {
            let pincode = (pincodeOverride || '').replace(/\D/g, '');
            if (!pincode || pincode.length !== 6) {
              const pincodeInput = document.getElementById('shipping-pincode');
              pincode = (pincodeInput?.value || '').replace(/\D/g, '');
            }
            if (!pincode || pincode.length !== 6) {
              const nativeSel = [
                'input#checkout_shipping_address_zip',
                'input[name="checkout[shipping_address][zip]"]',
                'input[data-checkout="shipping_address[zip]"]',
                'input[name="checkout[attributes][zip]"]'
              ];
              for (const sel of nativeSel) {
                const el = document.querySelector(sel);
                if (el && el.value) {
                  pincode = String(el.value).replace(/\D/g, '');
                  if (pincode.length === 6) break;
                }
              }
            }

            if (!pincode || pincode.length !== 6) {
              showError('Please enter a valid 6-digit pincode');
              return;
            }

            try {
              showLoading();
              hideError();

              const cartData = await getCartData();
              
              const response = await fetch(\`\${SHIPPING_CONFIG.apiBaseUrl}/calculate?postCode=\${pincode}&weight=\${cartData.weight}&orderAmount=\${cartData.total}&paymentMode=prepaid\`);

              const result = await response.json();
              
              if (result.rates && result.rates.length > 0) {
                displayShippingOptions(result.rates);
              } else {
                showNoShippingAvailable();
              }
            } catch (error) {
              console.error('Shipping calculation error:', error);
              showError('Failed to calculate shipping. Please try again.');
            } finally {
              hideLoading();
            }
          }

          async function getCartData() {
            try {
              const response = await fetch('/cart.js');
              const cart = await response.json();
              
              let totalWeight = 0;
              
              cart.items.forEach(item => {
                const weight = item.grams || 100;
                totalWeight += weight * item.quantity;
              });

              return {
                weight: totalWeight,
                total: cart.total_price / 100
              };
            } catch (error) {
              console.error('Error getting cart data:', error);
              return {
                weight: 500,
                total: 0
              };
            }
          }

          function displayShippingOptions(shippingOptions) {
            const resultsDiv = document.getElementById('shipping-results');
            if (!resultsDiv) return;

            resultsDiv.innerHTML = '';

            shippingOptions.forEach((option, index) => {
              const optionDiv = document.createElement('div');
              optionDiv.className = 'shipping-option';
              optionDiv.dataset.optionIndex = index;
              
              const price = (option.total_price / 100).toFixed(2);
              
              optionDiv.innerHTML = \`
                <div class="shipping-option-info">
                  <div class="shipping-option-name">\${option.service_name}</div>
                  <div class="shipping-option-details">
                    \${option.description || 'Standard delivery'}
                  </div>
                </div>
                <div class="shipping-option-price">₹\${price}</div>
              \`;

              optionDiv.addEventListener('click', () => {
                selectShippingOption(option, index);
              });

              resultsDiv.appendChild(optionDiv);
            });
          }

          function selectShippingOption(option, index) {
            document.querySelectorAll('.shipping-option').forEach(el => {
              el.classList.remove('selected');
            });

            const selectedOption = document.querySelector(\`[data-option-index="\${index}"]\`);
            if (selectedOption) {
              selectedOption.classList.add('selected');
            }

            sessionStorage.setItem('selectedShippingOption', JSON.stringify(option));
            showShippingConfirmation(option);
          }

          function showShippingConfirmation(option) {
            const price = (option.total_price / 100).toFixed(2);
            
            const confirmation = document.createElement('div');
            confirmation.className = 'shipping-confirmation';
            confirmation.innerHTML = \`
              ✅ Selected: \${option.service_name} - ₹\${price}
            \`;

            const resultsDiv = document.getElementById('shipping-results');
            if (resultsDiv) {
              resultsDiv.appendChild(confirmation);
            }
          }

          function showLoading() {
            const loadingDiv = document.getElementById('shipping-loading');
            if (loadingDiv) {
              loadingDiv.style.display = 'block';
            }
          }

          function hideLoading() {
            const loadingDiv = document.getElementById('shipping-loading');
            if (loadingDiv) {
              loadingDiv.style.display = 'none';
            }
          }

          function showError(message) {
            const errorDiv = document.getElementById('shipping-error');
            if (errorDiv) {
              errorDiv.textContent = message;
              errorDiv.style.display = 'block';
            }
          }

          function hideError() {
            const errorDiv = document.getElementById('shipping-error');
            if (errorDiv) {
              errorDiv.style.display = 'none';
            }
          }

          function showNoShippingAvailable() {
            const resultsDiv = document.getElementById('shipping-results');
            if (resultsDiv) {
              resultsDiv.innerHTML = \`
                <div class="no-shipping">
                  <p>🚫 No shipping options available for this pincode</p>
                  <p>Please try a different pincode or contact support</p>
                </div>
              \`;
            }
          }

          if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initShippingIntegration);
          } else {
            initShippingIntegration();
          }

        })();
      `;

      res.setHeader('Content-Type', 'application/javascript');
      const origin = req.headers.origin || req.headers.referer || `https://${shop}`;
      if (origin && (String(origin).includes('myshopify.com') || String(origin).includes('shopify.com'))) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shopify-Shop-Domain');
      res.setHeader('Access-Control-Max-Age', '86400');
      // Allow loading this JS across origins (avoid NotSameOrigin block)
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      res.send(scriptContent);
    } catch (error) {
      console.error('❌ Error serving shipping script:', error);
      res.status(500).send('Error loading shipping script');
    }
  }
}

module.exports = new AppProxyController();