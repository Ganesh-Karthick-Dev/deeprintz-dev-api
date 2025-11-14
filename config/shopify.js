// Shopify Configuration
const SHOPIFY_CONFIG = {
  // Your ngrok URL - UPDATE THIS WHEN YOUR NGROK URL CHANGES
  NGROK_URL: 'https://ac156baa2f14.ngrok-free.app',
  
  // Environment (dev/live)
  ENVIRONMENT: 'dev', // Change to 'live' for production
  
  // API Credentials
  CLIENT_ID: '8012fe790c9580e7da274db5dfb8111d',
  SECRET: 'c00ee31814dbdca603697e6e8055d1ba',
  
  // Scopes
  SCOPES: [
    'read_products',
    'write_products',
    'read_orders',
    'write_orders',
    'read_customers',
    'write_customers',
    'write_shipping',
    'read_shipping'
  ],
  
  // URLs
  get BASE_URL() {
    return this.NGROK_URL;
  },
  
  get API_BASE() {
    return `${this.BASE_URL}/api/deeprintz/${this.ENVIRONMENT}`;
  },
  
  get OAUTH_CALLBACK_URL() {
    return `${this.API_BASE}/shopify/authCallback`;
  },
  
  get SUCCESS_REDIRECT_URL() {
    return `${this.BASE_URL}/shopify/success`;
  }
};

module.exports = SHOPIFY_CONFIG;
