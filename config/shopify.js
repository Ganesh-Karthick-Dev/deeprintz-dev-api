// Shopify Configuration
const SHOPIFY_CONFIG = {
  // Your ngrok URL - UPDATE THIS WHEN YOUR NGROK URL CHANGES (for dev testing)
  NGROK_URL: 'https://1b6a724f3299.ngrok-free.app',
  
  // Production API URL (your live backend)
  PRODUCTION_API_URL: process.env.PRODUCTION_API_URL || 'https://api.deeprintz.com', // Update with your actual production API URL
  
  // Environment (dev/live)
  // ENVIRONMENT: 'dev', // Change to 'live' for production
  ENVIRONMENT: 'live', // Change to 'live' for production

  
  // Frontend URL (for redirects after OAuth) - DYNAMIC based on environment
  get FRONTEND_URL() {
    if (this.ENVIRONMENT === 'live') {
      return process.env.FRONTEND_URL || 'https://deeprintz.com'; // Your production website
    } else {
      return process.env.FRONTEND_URL || 'http://localhost:5173'; // Dev frontend
    }
  },
  
  // API Credentials
  CLIENT_ID: '8012fe790c9580e7da274db5dfb8111d',
  SECRET: 'c00ee31814dbdca603697e6e8055d1ba',
  
  // Scopes - matching Shopify app configuration
  SCOPES: [
    // Product scopes
    'read_products',
    'write_products',
    'read_product_listings',
    'write_product_listings',
    // Order scopes
    'read_orders',
    'write_orders',
    // Customer scopes
    'read_customers',
    // Fulfillment scopes
    'read_fulfillments',
    'write_fulfillments',
    // Inventory scopes
    'read_inventory',
    'write_inventory',
    // Location scopes
    'read_locations',
    // Shipping scopes (required for CarrierService registration)
    'read_shipping',
    'write_shipping',
    // Publication scopes (required for publishing products to Online Store)
    'read_publications',
    'write_publications'
  ],
  
  // URLs - DYNAMIC based on environment
  get BASE_URL() {
    if (this.ENVIRONMENT === 'live') {
      return this.PRODUCTION_API_URL; // Use production API URL in live mode
    } else {
      return this.NGROK_URL; // Use ngrok URL in dev mode
    }
  },
  
  get API_BASE() {
    return `${this.BASE_URL}/api/deeprintz/${this.ENVIRONMENT}`;
  },
  
  get OAUTH_CALLBACK_URL() {
    return `${this.API_BASE}/shopify/authCallback`;
  },
  
  get SUCCESS_REDIRECT_URL() {
    // Redirect to frontend StoreConnect page after successful OAuth
    return `${this.FRONTEND_URL}/user/storeconnect`;
  },
  
  // CarrierService URL (for shipping rates)
  get CARRIER_SERVICE_URL() {
    return `${this.API_BASE}/shopify/carrier/rates`;
  },
  
  // Webhook URLs
  get WEBHOOK_URL_ORDERS() {
    return `${this.API_BASE}/shopify/webhooks/orders`;
  },
  
  // Helper method to get webhook URL with userId query parameter (legacy format)
  getWebhookUrlWithUserId(userId) {
    return `${this.API_BASE}/shopify/orders/webhook?userId=${userId}`;
  }
};

module.exports = SHOPIFY_CONFIG;
