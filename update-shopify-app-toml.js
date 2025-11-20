#!/usr/bin/env node

/**
 * Update shopify.app.toml webhook URIs dynamically
 * Usage:
 *   node update-shopify-app-toml.js dev   (for development with ngrok)
 *   node update-shopify-app-toml.js live  (for production)
 */

const fs = require('fs');
const path = require('path');

// Import the Shopify config
const SHOPIFY_CONFIG = require('./config/shopify');

const args = process.argv.slice(2);
const environment = args[0] || SHOPIFY_CONFIG.ENVIRONMENT;

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  📝 Updating shopify.app.toml with dynamic webhook URLs       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Temporarily override the environment
const originalEnv = SHOPIFY_CONFIG.ENVIRONMENT;
SHOPIFY_CONFIG.ENVIRONMENT = environment;

console.log(`🔧 Environment: ${SHOPIFY_CONFIG.ENVIRONMENT}`);
console.log(`🌐 Base URL: ${SHOPIFY_CONFIG.BASE_URL}`);
console.log(`🌐 API Base: ${SHOPIFY_CONFIG.API_BASE}`);
console.log(`🌐 Frontend URL: ${SHOPIFY_CONFIG.FRONTEND_URL}\n`);

// Construct webhook URLs
const baseWebhookUrl = `${SHOPIFY_CONFIG.API_BASE}/shopify/webhooks`;
const gdprWebhooks = {
  customers_data_request: `${baseWebhookUrl}/customers/data_request`,
  customers_redact: `${baseWebhookUrl}/customers/redact`,
  shop_redact: `${baseWebhookUrl}/shop/redact`,
  orders: `${baseWebhookUrl}/orders`
};

console.log('📡 Generated Webhook URLs:');
console.log(`   🔒 customers/data_request: ${gdprWebhooks.customers_data_request}`);
console.log(`   🔒 customers/redact:       ${gdprWebhooks.customers_redact}`);
console.log(`   🔒 shop/redact:            ${gdprWebhooks.shop_redact}`);
console.log(`   📦 orders/*:                ${gdprWebhooks.orders}\n`);

// Read the shopify.app.toml file
const tomlPath = path.join(__dirname, 'shopify.app.toml');
let tomlContent = fs.readFileSync(tomlPath, 'utf8');

// Replace webhook URIs using regex
const replacements = [
  {
    pattern: /(topics = \[ "customers\/data_request" \]\s*uri = ")([^"]+)(")/,
    replacement: `$1${gdprWebhooks.customers_data_request}$3`,
    name: 'customers/data_request'
  },
  {
    pattern: /(topics = \[ "customers\/redact" \]\s*uri = ")([^"]+)(")/,
    replacement: `$1${gdprWebhooks.customers_redact}$3`,
    name: 'customers/redact'
  },
  {
    pattern: /(topics = \[ "shop\/redact" \]\s*uri = ")([^"]+)(")/,
    replacement: `$1${gdprWebhooks.shop_redact}$3`,
    name: 'shop/redact'
  },
  {
    pattern: /(topics = \[ "orders\/create", "orders\/updated", "orders\/fulfilled", "orders\/partially_fulfilled" \]\s*uri = ")([^"]+)(")/,
    replacement: `$1${gdprWebhooks.orders}$3`,
    name: 'orders/*'
  }
];

let updatedCount = 0;
replacements.forEach(({ pattern, replacement, name }) => {
  if (pattern.test(tomlContent)) {
    tomlContent = tomlContent.replace(pattern, replacement);
    console.log(`✅ Updated: ${name}`);
    updatedCount++;
  } else {
    console.log(`⚠️  Pattern not found: ${name}`);
  }
});

// Write the updated content back
fs.writeFileSync(tomlPath, tomlContent, 'utf8');

// Restore original environment
SHOPIFY_CONFIG.ENVIRONMENT = originalEnv;

console.log(`\n✅ Successfully updated ${updatedCount} webhook URIs in shopify.app.toml`);
console.log(`📄 File: ${tomlPath}\n`);

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║  ⚠️  IMPORTANT: Run these commands to apply changes:          ║');
console.log('╠════════════════════════════════════════════════════════════════╣');
console.log('║  1. shopify app deploy                                         ║');
console.log('║     (to update production app configuration)                   ║');
console.log('║                                                                ║');
console.log('║  OR                                                            ║');
console.log('║                                                                ║');
console.log('║  2. Manually update webhooks in Shopify Partners Dashboard     ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

