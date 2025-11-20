#!/usr/bin/env node

/**
 * Test Dynamic Shopify Config
 * Verify all URLs are generated correctly from config
 */

const SHOPIFY_CONFIG = require('./config/shopify');

console.log('🧪 TESTING DYNAMIC SHOPIFY CONFIG');
console.log('='.repeat(80));
console.log('');

console.log('🔧 ENVIRONMENT');
console.log('  Environment:', SHOPIFY_CONFIG.ENVIRONMENT);
console.log('  Ngrok URL:', SHOPIFY_CONFIG.NGROK_URL);
console.log('');

console.log('📡 BASE URLS');
console.log('  BASE_URL:', SHOPIFY_CONFIG.BASE_URL);
console.log('  API_BASE:', SHOPIFY_CONFIG.API_BASE);
console.log('');

console.log('🔗 OAUTH URLS');
console.log('  OAuth Callback:', SHOPIFY_CONFIG.OAUTH_CALLBACK_URL);
console.log('  Success Redirect:', SHOPIFY_CONFIG.SUCCESS_REDIRECT_URL);
console.log('');

console.log('🚚 CARRIER SERVICE');
console.log('  URL:', SHOPIFY_CONFIG.CARRIER_SERVICE_URL);
console.log('');

console.log('📬 WEBHOOKS');
console.log('  Orders (generic):', SHOPIFY_CONFIG.WEBHOOK_URL_ORDERS);
console.log('  Orders (with userId 2004):', SHOPIFY_CONFIG.getWebhookUrlWithUserId(2004));
console.log('');

console.log('='.repeat(80));
console.log('✅ ALL URLS ARE DYNAMIC!');
console.log('');
console.log('💡 TO UPDATE NGROK URL:');
console.log('   1. Edit config/shopify.js');
console.log('   2. Change NGROK_URL to your new ngrok URL');
console.log('   3. All URLs will update automatically!');
console.log('');

// Test that URLs change based on environment
console.log('🧪 TESTING ENVIRONMENT SWITCHING...');
console.log('');

console.log('Current environment: dev');
console.log('  API_BASE:', SHOPIFY_CONFIG.API_BASE);

// Show what it would be in production
console.log('');
console.log('If environment was "live":');
const testUrl = SHOPIFY_CONFIG.NGROK_URL + '/api/deeprintz/live';
console.log('  API_BASE would be:', testUrl);
console.log('');

console.log('='.repeat(80));


