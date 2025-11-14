const { shopifyApi, LATEST_API_VERSION } = require('@shopify/shopify-api');
const { NodeAdapter } = require('@shopify/shopify-api/adapters/node');
require('dotenv').config();

const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET,
  scopes: ['write_products', 'read_products'],
  hostName: new URL(process.env.APP_URL).host,
  apiVersion: LATEST_API_VERSION,
  isEmbeddedApp: true,
  adapter: NodeAdapter,
});

module.exports = shopify;