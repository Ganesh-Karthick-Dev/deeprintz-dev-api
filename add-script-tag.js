const axios = require('axios');

// Shopify Script Tag API endpoint
const SHOPIFY_SCRIPT_TAG_API = 'https://myn11.myshopify.com/admin/api/2023-10/script_tags.json';

// Our shipping script URL
const SCRIPT_URL = 'https://devapi.deeprintz.com/api/deeprintz/live/shopify/app-proxy/shipping/script?userId=1039&shop=myn11.myshopify.com';

// Shopify access token (you'll need to get this from your Shopify app)
const ACCESS_TOKEN = 'YOUR_SHOPIFY_ACCESS_TOKEN'; // Replace with your actual access token

async function addScriptTag() {
  try {
    console.log('🚀 Adding shipping script as Shopify Script Tag...');
    
    const scriptTagData = {
      script_tag: {
        event: 'onload',
        src: SCRIPT_URL,
        display_scope: 'checkout'
      }
    };

    const response = await axios.post(SHOPIFY_SCRIPT_TAG_API, scriptTagData, {
      headers: {
        'X-Shopify-Access-Token': ACCESS_TOKEN,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Script Tag added successfully!');
    console.log('📋 Script Tag ID:', response.data.script_tag.id);
    console.log('🔗 Script URL:', response.data.script_tag.src);
    console.log('📍 Display Scope:', response.data.script_tag.display_scope);
    
  } catch (error) {
    console.error('❌ Error adding Script Tag:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('🔑 Authentication failed. Please check your access token.');
    } else if (error.response?.status === 422) {
      console.log('⚠️ Script Tag already exists or validation failed.');
    }
  }
}

// Run the script
addScriptTag();
