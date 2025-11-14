#!/usr/bin/env node

/**
 * Test Actual Webhook Data
 * 
 * This script tests the signature verification with the actual webhook data
 * from your console to verify the fix.
 */

const crypto = require('crypto');

// Your actual webhook data from the console
const actualPayload = {
  id: 122,
  parent_id: 0,
  status: 'processing',
  currency: 'INR',
  version: '10.1.0',
  prices_include_tax: false,
  date_created: '2025-08-21T04:52:49',
  date_modified: '2025-08-21T04:59:00',
  discount_total: '0.00',
  discount_tax: '0.00',
  shipping_total: '0.00',
  shipping_tax: '0.00',
  cart_tax: '0.00',
  total: '450.00',
  total_tax: '0.00',
  customer_id: 1,
  order_key: 'wc_order_XMmh92Zsdtnh9',
  billing: {
    first_name: 'test',
    last_name: 'M',
    company: '',
    address_1: '1/69 Sennimalaipalayam',
    address_2: '',
    city: '3683',
    state: 'TN',
    postcode: '642128',
    country: 'IN',
    email: 'care@deeprintz.com',
    phone: '+918825830680'
  },
  shipping: {
    first_name: 'test',
    last_name: 'M',
    company: '',
    address_1: '1/69 Sennimalaipalayam',
    address_2: '',
    city: '3683',
    state: 'TN',
    postcode: '642128',
    country: 'IN',
    phone: '+918825830680'
  },
  payment_method: 'cod',
  payment_method_title: 'Cash on delivery',
  transaction_id: '',
  customer_ip_address: '49.204.233.0',
  customer_user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
  created_via: 'store-api',
  customer_note: '',
  date_completed: null,
  date_paid: null,
  cart_hash: '86d1efa6f74d7861bb323acea1e5ae5b',
  number: '122',
  meta_data: [
    {
      id: 123,
      key: '_coupons_hash',
      value: 'd751713988987e9331980363e24189ce'
    },
    {
      id: 124,
      key: '_fees_hash',
      value: 'd751713988987e9331980363e24189ce'
    },
    {
      id: 122,
      key: '_shipping_hash',
      value: '64656d37dd2ad316b3e09febf0b4dff2'
    },
    {
      id: 125,
      key: '_taxes_hash',
      value: 'd751713988987e9331980363e24189ce'
    },
    {
      id: 136,
      key: '_wc_order_attribution_device_type',
      value: 'Desktop'
    },
    { id: 134, key: '_wc_order_attribution_session_count', value: '1' },
    {
      id: 131,
      key: '_wc_order_attribution_session_entry',
      value: 'https://wordpress-1481791-5775074.cloudwaysapps.com/'
    },
    {
      id: 133,
      key: '_wc_order_attribution_session_pages',
      value: '10'
    },
    {
      id: 132,
      key: '_wc_order_attribution_session_start_time',
      value: '2025-08-21 04:08:20'
    },
    {
      id: 129,
      key: '_wc_order_attribution_source_type',
      value: 'typein'
    },
    {
      id: 135,
      key: '_wc_order_attribution_user_agent',
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
    },
    {
      id: 130,
      key: '_wc_order_attribution_utm_source',
      value: '(direct)'
    },
    { id: 126, key: 'is_vat_exempt', value: 'no' }
  ],
  line_items: [
    {
      id: 9,
      name: 'Supima Mens Round Neck Half Sleeve',
      product_id: 119,
      variation_id: 0,
      quantity: 1,
      tax_class: '',
      subtotal: '450.00',
      subtotal_tax: '0.00',
      total: '450.00',
      total_tax: '0.00',
      taxes: [],
      meta_data: [],
      sku: 'DP-11',
      global_unique_id: '',
      price: 450,
      image: {},
      parent_name: null
    }
  ],
  tax_lines: [],
  shipping_lines: [],
  fee_lines: [],
  coupon_lines: [],
  refunds: [],
  payment_url: 'https://wordpress-1481791-5775074.cloudwaysapps.com/checkout/order-pay/122/?pay_for_order=true&key=wc_order_XMmh92Zsdtnh9',
  is_editable: false,
  needs_payment: false,
  needs_processing: true,
  date_created_gmt: '2025-08-21T04:52:49',
  date_modified_gmt: '2025-08-21T04:59:00',
  date_completed_gmt: null,
  date_paid_gmt: null,
  currency_symbol: '₹',
  _links: {
    self: [{}],
    collection: [{}],
    email_templates: [{}],
    customer: [{}]
  }
};

// Your secret from WooCommerce
const SECRET = 'Deeprintz@2025';

// The signature WooCommerce actually sent
const RECEIVED_SIGNATURE = 'ucZEEF2hCXEomPFCdjDuuAv0msw+7WxLXFo5ehm/dn4=';

function testActualWebhook() {
  console.log('🧪 Testing Actual Webhook Data...\n');
  
  const payloadString = JSON.stringify(actualPayload);
  console.log('📋 Payload ID:', actualPayload.id);
  console.log('📋 Payload Number:', actualPayload.number);
  console.log('📋 Payload Length:', payloadString.length);
  console.log('📋 Secret:', SECRET);
  console.log('📋 Received Signature:', RECEIVED_SIGNATURE);
  
  // Generate signatures in different formats
  const base64Signature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadString)
    .digest('base64');
    
  const hexSignature = crypto
    .createHmac('sha256', SECRET)
    .update(payloadString)
    .digest('hex');
    
  console.log('\n📋 Generated Signatures:');
  console.log('  Base64:  ', base64Signature);
  console.log('  Hex:     ', hexSignature);
  
  console.log('\n📋 Signature Comparison:');
  console.log('  Base64 Match:', RECEIVED_SIGNATURE === base64Signature ? '✅ YES' : '❌ NO');
  console.log('  Hex Match:   ', RECEIVED_SIGNATURE === hexSignature ? '✅ YES' : '❌ NO');
  
  if (RECEIVED_SIGNATURE === base64Signature) {
    console.log('\n🎉 SUCCESS: Base64 signature matches! WooCommerce uses base64 format.');
  } else if (RECEIVED_SIGNATURE === hexSignature) {
    console.log('\n🎉 SUCCESS: Hex signature matches! WooCommerce uses hex format.');
  } else {
    console.log('\n❌ FAILURE: No signature format matches. Check your secret configuration.');
    
    // Try with different variations of the secret
    console.log('\n🔍 Debugging: Trying different secret variations...');
    
    // Try trimming whitespace
    const trimmedSecret = SECRET.trim();
    const trimmedBase64 = crypto
      .createHmac('sha256', trimmedSecret)
      .update(payloadString)
      .digest('base64');
    console.log('  Trimmed secret base64:', trimmedBase64, 'Match:', RECEIVED_SIGNATURE === trimmedBase64 ? '✅' : '❌');
    
    // Try without special characters
    const cleanSecret = SECRET.replace(/[^a-zA-Z0-9]/g, '');
    const cleanBase64 = crypto
      .createHmac('sha256', cleanSecret)
      .update(payloadString)
      .digest('base64');
    console.log('  Clean secret base64:', cleanBase64, 'Match:', RECEIVED_SIGNATURE === cleanBase64 ? '✅' : '❌');
  }
  
  return {
    base64Signature,
    hexSignature,
    receivedSignature: RECEIVED_SIGNATURE,
    secret: SECRET
  };
}

// Run the test
if (require.main === module) {
  testActualWebhook();
}

module.exports = { testActualWebhook };
