#!/usr/bin/env node

/**
 * Update Shopify Webhooks to use Ngrok URL for local testing
 */

const axios = require('axios');
const SHOPIFY_CONFIG = require('./config/shopify');

const CONFIG = {
  SHOP_DOMAIN: 'mayu-12351.myshopify.com'
};

// Use dynamic webhook URL from config
const WEBHOOK_URL = SHOPIFY_CONFIG.getWebhookUrlWithUserId(2004); // userId 2004

console.log('🔄 UPDATING SHOPIFY WEBHOOKS TO NGROK');
console.log('='.repeat(80));
console.log('Shop:', CONFIG.SHOP_DOMAIN);
console.log('New URL:', WEBHOOK_URL);
console.log('='.repeat(80));
console.log('');

async function updateWebhooks() {
  try {
    const dbConfigs = require('./utils/knexfile');
    const knex = require('knex');
    const db = knex(dbConfigs.deeprintzDev);
    
    // Get shop
    const shop = await db('shopify_stores')
      .where('shop_domain', CONFIG.SHOP_DOMAIN)
      .first();
    
    if (!shop) {
      throw new Error('Shop not found');
    }
    
    console.log('✅ Shop found');
    console.log('');
    
    // GraphQL to list webhooks
    const listQuery = `
      query {
        webhookSubscriptions(first: 50) {
          edges {
            node {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
          }
        }
      }
    `;
    
    const listResponse = await axios.post(
      `https://${shop.shop_domain}/admin/api/2025-01/graphql.json`,
      { query: listQuery },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': shop.access_token
        }
      }
    );
    
    const webhooks = listResponse.data.data?.webhookSubscriptions?.edges || [];
    
    console.log(`📋 Found ${webhooks.length} existing webhooks`);
    console.log('');
    
    // Find order-related webhooks
    const orderWebhooks = webhooks.filter(e => 
      e.node.topic.startsWith('ORDERS_')
    );
    
    console.log(`🎯 Found ${orderWebhooks.length} order webhooks to update:`);
    orderWebhooks.forEach(e => {
      console.log(`   - ${e.node.topic}: ${e.node.endpoint?.callbackUrl}`);
    });
    console.log('');
    
    // Update each webhook
    for (const edge of orderWebhooks) {
      const webhook = edge.node;
      
      console.log(`🔄 Updating ${webhook.topic}...`);
      
      const updateMutation = `
        mutation webhookSubscriptionUpdate($id: ID!, $webhookSubscription: WebhookSubscriptionInput!) {
          webhookSubscriptionUpdate(id: $id, webhookSubscription: $webhookSubscription) {
            webhookSubscription {
              id
              topic
              endpoint {
                __typename
                ... on WebhookHttpEndpoint {
                  callbackUrl
                }
              }
            }
            userErrors {
              field
              message
            }
          }
        }
      `;
      
      const result = await axios.post(
        `https://${shop.shop_domain}/admin/api/2025-01/graphql.json`,
        {
          query: updateMutation,
          variables: {
            id: webhook.id,
            webhookSubscription: {
              callbackUrl: WEBHOOK_URL
            }
          }
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': shop.access_token
          }
        }
      );
      
      if (result.data.data?.webhookSubscriptionUpdate?.userErrors?.length > 0) {
        console.log(`   ❌ Error:`, result.data.data.webhookSubscriptionUpdate.userErrors[0].message);
      } else {
        const updated = result.data.data.webhookSubscriptionUpdate.webhookSubscription;
        console.log(`   ✅ Updated to: ${updated.endpoint?.callbackUrl}`);
      }
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('🎉 WEBHOOKS UPDATED!');
    console.log('='.repeat(80));
    console.log('');
    console.log('🧪 TEST NOW:');
    console.log('   1. Place another order on your Shopify store');
    console.log('   2. Check your console - you should see webhook logs!');
    console.log('   3. Order will be stored in woocommerce_orders table');
    console.log('');
    
    process.exit(0);
    
  } catch (error) {
    console.error('');
    console.error('❌ ERROR:', error.message);
    console.error('');
    process.exit(1);
  }
}

updateWebhooks();

