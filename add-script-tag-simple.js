const axios = require('axios');

// Configuration
const SHOP_DOMAIN = 'myn11.myshopify.com';
const SCRIPT_URL = 'https://devapi.deeprintz.com/api/deeprintz/live/shopify/app-proxy/shipping/script?userId=1039&shop=myn11.myshopify.com';

// You need to get this from your Shopify app settings
const ACCESS_TOKEN = 'YOUR_SHOPIFY_ACCESS_TOKEN'; // Replace with your actual access token

async function addScriptTag() {
  try {
    console.log('🚀 Adding shipping script as Shopify Script Tag...');
    console.log('📋 Shop:', SHOP_DOMAIN);
    console.log('🔗 Script URL:', SCRIPT_URL);
    
    const scriptTagData = {
      script_tag: {
        event: 'onload',
        src: SCRIPT_URL,
        display_scope: 'online_store'
      }
    };

    const response = await axios.post(
      `https://${SHOP_DOMAIN}/admin/api/2023-10/script_tags.json`,
      scriptTagData,
      {
        headers: {
          'X-Shopify-Access-Token': ACCESS_TOKEN,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Script Tag added successfully!');
    console.log('📋 Script Tag ID:', response.data.script_tag.id);
    console.log('🔗 Script URL:', response.data.script_tag.src);
    console.log('📍 Display Scope:', response.data.script_tag.display_scope);
    console.log('🎯 Event:', response.data.script_tag.event);
    
  } catch (error) {
    console.error('❌ Error adding Script Tag:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('🔑 Authentication failed. Please check your access token.');
      console.log('💡 Get your access token from: https://partners.shopify.com/');
    } else if (error.response?.status === 422) {
      console.log('⚠️ Script Tag already exists or validation failed.');
      console.log('📋 Response:', error.response.data);
    } else if (error.response?.status === 403) {
      console.log('🚫 Access denied. Check your app permissions.');
    }
  }
}

// Run the script
addScriptTag();
