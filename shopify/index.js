const { shopifyApi, LATEST_API_VERSION, Session } = require('@shopify/shopify-api');
const { HybridSessionStorage } = require('./shopifySession');

// Import the Node.js adapter
require('@shopify/shopify-api/adapters/node');

const sessionStorage = new HybridSessionStorage();

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || 'd7ea6ccac76b1b4b00f7d5d8eb2ba3e6',
  // CRITICAL: Replace 'YOUR_SHOPIFY_API_SECRET_HERE' with your actual API secret from Partners Dashboard
  // This is required for webhook HMAC verification to pass Partners Dashboard tests
  apiSecretKey: process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_API_SECRET_HERE',
  scopes: process.env.SCOPES?.split(',') || ['read_products', 'write_products', 'read_orders', 'write_orders', 'read_customers', 'write_customers'],
  hostName: process.env.HOST?.replace(/https?:\/\//, "") || 'ac156baa2f14.ngrok-free.app',
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: false, // Non-embedded for Partner Dashboard compliance
  sessionStorage: sessionStorage,
  userAgentPrefix: 'Deeprintz-App',
  // Enable logging for debugging
  logger: {
    level: 'info',
    httpRequests: false,
    timestamps: true,
  },
  // Webhook configuration for HMAC verification
  webhooks: {
    deliveryMethod: 'http'
  },
  // Enforce immediate OAuth authentication
  auth: {
    path: '/api/deeprintz/dev/auth',
    callbackPath: '/api/deeprintz/dev/authCallback'
  },
  // Ensure proper token validation
  useOnlineTokens: false // Use offline tokens for server-side apps
});

// test
// const shopify = shopifyApi({
//   apiKey: process.env.SHOPIFY_CLIENT_ID,
//   apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET,
//   scopes: ["write_products", "read_orders"],
//   hostName: "df90-49-204-233-0.ngrok-free.app",
//   apiVersion: LATEST_API_VERSION,
//   isEmbeddedApp: false,
// });
// test

module.exports = shopify;
