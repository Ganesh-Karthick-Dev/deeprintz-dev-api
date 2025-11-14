const { shopifyApi, LATEST_API_VERSION } = require("@shopify/shopify-api");
const { NodeAdapter } = require("@shopify/shopify-api/adapters/node");
const shopifyService = require('../../service/shopify-old/index')
const axios = require('axios')
const crypto = require('crypto');



// const shop = 'deeprintz-test-app.myshopify.com';
// const apiUrl = 'https://ab84-49-204-233-0.ngrok-free.app';
const nonce = 'random-unique-nonce'; // Use a unique value for nonce


const clientId = '3413a2a8a1d921fba71de1b3fd190069'; // Your Shopify app's client ID
const clientSecret = '3d23df8a329147004819f84b91af6d8a'; // Your Shopify app's client secret
const apiUrl = 'https://phpstack-1202035-4288105.cloudwaysapps.com';
const scopes = ['read_products', 'write_orders','write_products','read_orders']; // Scopes you want to request from Shopify
const accessMode = 'online'; // Can be 'offline' or 'online'



module.exports.shopifyConnect = async (req, res) => {
  try {

    const {userid , shop} = req.body

    // const nonce = userid

    // Generate the Shopify OAuth URL
    // const redirectUri = `https://951d-49-204-233-0.ngrok-free.app/api/deeprintz/live/shopify-oauth/redirect`;
    const redirectUri = `https://phpstack-1202035-4288105.cloudwaysapps.com/api/deeprintz/live/shopify-oauth/redirect`;
    const url = `https://${shop}/admin/oauth/authorize?client_id=${clientId}&scope=${scopes.join(',')}&redirect_uri=${redirectUri}&state=${nonce}&grant_options[]=${accessMode}`;

    console.log(`Generated Shopify OAuth URL: ${url}`);
    
    // Redirect the user to Shopify OAuth URL
    // return res.redirect(url);
    return res.json({ url });

  } catch (error) {
    console.log("shopifyConnect Error:", error);
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false,
        error: "Shopify connection failed",
        details: error.message
      });
    }
  }
};


function verifyHmac(params, hmac) {
  // Create a string to compare
  const queryString = Object.keys(params)
    .filter((key) => key !== 'hmac')  // Exclude 'hmac' from the params
    .sort()                          // Sort by key
    .map((key) => `${key}=${params[key]}`)
    .join('&');                      // Join with '&' to form the query string

  // Hash the query string with the Shopify app's secret
  const calculatedHmac = crypto
    .createHmac('sha256', clientSecret)
    .update(queryString)
    .digest('hex');

  // Compare the calculated HMAC with the received HMAC
  return hmac === calculatedHmac;
}

module.exports.shopifyAuthRedirect = async (req, res) => {
  try {
    const { shop, code, hmac, state } = req.query;
    console.log(`result shop - `, shop);
    console.log(`result code - `, code);
    console.log(`result state - `, state);

    // Check the state parameter to prevent CSRF attacks
    if (state !== 'random-unique-nonce') {
      return res.status(400).send('State mismatch');
    }

    // Verify the HMAC to ensure this request is coming from Shopify
    const isValidHmac = verifyHmac(req.query, hmac);
    if (!isValidHmac) {
      return res.status(400).send('Invalid HMAC');
    }

    console.log('HMAC verified successfully');

    // Step 2: Exchange the code for an access token
    const accessTokenResponse = await axios.post(`https://${shop}/admin/oauth/access_token`, {
      client_id: clientId,
      client_secret: clientSecret,
      code: code, // The authorization code
    });

    const accessToken = accessTokenResponse.data.access_token;
    console.log('Access token:', accessToken);

    // You can store the access token and use it for future API calls
    // const storeToken = await global.dbConnection('app_users')
    // .update({
    //   store_url : state,
    //   store_access_token : accessToken
    // })
    // .where('app_users.userid',userid)


    if(accessToken){
      return res.send({
        status : true,
        message : 'OAuth process complete'
      })
    }
    else {
      return res.send({
        status : false,
        message : 'OAuth process Failed'
      })
    }



  } catch (error) {
    console.log('shopifyAuthRedirect Error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to complete Shopify OAuth process',
      details: error.message,
    });
  }
};


module.exports.getAllProducts = async (req, res) => {
  try {
    // Define the request URL to fetch products
    const url = `https://deeprintz-test-app.myshopify.com/admin/api/2023-01/products.json`;

    // Make the GET request to Shopify
    const response = await axios.get(url, {
      headers: {
        'X-Shopify-Access-Token': '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', // Provide the access token in the header
      },
    });

    // Log and return the fetched products
    const products = response.data.products;
    console.log('Fetched Products:', products);

    // Send the products data back in the response
    res.json({
      success: true,
      products: products,
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products from Shopify',
      details: error.message,
    });
  }
};


module.exports.updateProduct = async (req, res) => {

  const shop = 'deeprintz-test-app.myshopify.com';
const accessToken = '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';  // Replace with the actual access token you received from OAuth
const productId = 8887332405481; 

// Define the new product title
const newTitle = "Updated Green Snowboard";

// Prepare the data to send in the request body
const updatedProductData = {
  product: {
    id: productId,
    title: newTitle,  // Update the title
  }
};

  try {
    // Make the PUT request to update the product
    const response = await axios.put(
      `https://${shop}/admin/api/2023-01/products/${productId}.json`,
      updatedProductData,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken, // Provide the access token in the header
        },
      }
    );

    // Return the updated product details
    res.json({
      success: true,
      product: response.data.product,  // The updated product object returned by Shopify
    });
  } catch (error) {
    console.error('Error updating product title:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update product title on Shopify',
      details: error.message,
    });
  }
};


module.exports.createProduct = async (req, res) => {

  const shop = 'deeprintz-test-app.myshopify.com';  // Your shop's domain
const accessToken = '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';  // Replace with your actual access token

// Define the product data
const newProductData = {
  product: {
    title: "umbrella",  // Product title
    body_html: "<strong>umbrella corporation123456</strong>",  // Product description
    vendor: "deeprintz-test-app",  // Vendor name
    product_type: "accessories",  // Product type/category
    tags: "essential",  // Tags
    variants: [
      {
        option1: "Default Title",  // Variant title (e.g., size, color)
        price: "120.00",  // Price of the product
        sku: "blue-snowboard-001",  // SKU (Stock Keeping Unit)
        inventory_quantity: 100,  // Inventory quantity
        weight: 3.5,  // Weight in kg
        requires_shipping: true,  // Shipping required
        taxable: true,  // Is it taxable?
        inventory_management: "shopify",  // Inventory management by Shopify
      }
    ],
    images: [
      {
        src: "https://www.istationery.com/media/bss/webp/media/catalog/product/cache/c3ffdc2616159f0d22ebcece028e9b6d/l/y/ly010_3_2_1_1_1_1.webp",  // Image URL for the product
      },
    ],
  },
};

  try {
    // Make the POST request to create the product
    const response = await axios.post(
      `https://${shop}/admin/api/2023-01/products.json`,
      newProductData,
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,  // Provide the access token in the header
        },
      }
    );

    // Return the created product details
    res.json({
      success: true,
      product: response.data.product,  // The product object returned by Shopify
    });
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create product on Shopify',
      details: error.message,
    });
  }
};


module.exports.deleteProduct = async (req, res) => {
  try {

    const shop = 'deeprintz-test-app.myshopify.com';  // Your shop's domain
    const accessToken = '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';  // Replace with your actual access token

    const  productId = 8887332405481

    const response = await axios.delete(
      `https://${shop}/admin/api/2023-01/products/${productId}.json`, 
      {
        headers: {
          'X-Shopify-Access-Token': accessToken,
        },
      }
    );

    res.json({
      success: true,
      message: `Product with ID ${productId} deleted successfully`,
    });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete product',
      details: error.message,
    });
  }
};



// compliance webhook
module.exports.customerRequest = async (req, res) => {
  try {
    console.log('🔒 Customer Data Request webhook received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    console.log('Raw body type:', typeof req.body);
    console.log('Raw body length:', req.body ? req.body.length : 0);
    
    const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
    if (!shopifyHmac) {
      console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
      return res.status(400).send('Missing HMAC header');
    }

    // CRITICAL FIX: Use the correct secret - SHOPIFY_API_SECRET, not clientSecret
    const webhookSecret = process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_API_SECRET_HERE';
    console.log('🔑 Using webhook secret:', webhookSecret ? webhookSecret.substring(0, 8) + '...' : 'NOT_SET');
    
    // Ensure we have raw body data
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = Buffer.from(req.body, 'utf8');
    } else {
      rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    }
    
    console.log('📦 Raw body buffer length:', rawBody.length);
    
    // Calculate HMAC digest using the correct webhook secret
    const calculatedHmacDigest = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');
    
    console.log('🧮 Calculated HMAC:', calculatedHmacDigest);
    console.log('📥 Received HMAC:', shopifyHmac);
    
    // Compare HMAC values securely
    const hmacValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHmacDigest), 
      Buffer.from(shopifyHmac)
    );
    
    console.log('✅ HMAC validation result:', hmacValid);
  
    if (hmacValid) {
      console.log('✅ Customer data request webhook verified successfully');
      
      // Process the webhook data here
      const webhookData = JSON.parse(rawBody.toString('utf8'));
      console.log('📋 Customer data request:', webhookData);
      
      // TODO: Implement your customer data request logic
      // This should gather and return customer data as required by GDPR
      
      res.status(200).json({
        message: 'Customer data request processed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ HMAC validation failed for customer data request');
      res.status(401).send('Unauthorized - Invalid HMAC signature');
    }
    
  } catch (error) {
    console.error('💥 Error processing customer data request:', error);
    res.status(500).send('Internal Server Error');
  }
}
 
module.exports.customerDelete = async (req, res) => {
  try {
    console.log('🗑️ Customer Redact webhook received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
    if (!shopifyHmac) {
      console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
      return res.status(400).send('Missing HMAC header');
    }

    // CRITICAL FIX: Use the correct secret - SHOPIFY_API_SECRET, not clientSecret
    const webhookSecret = process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_API_SECRET_HERE';
    console.log('🔑 Using webhook secret:', webhookSecret ? webhookSecret.substring(0, 8) + '...' : 'NOT_SET');
    
    // Ensure we have raw body data
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = Buffer.from(req.body, 'utf8');
    } else {
      rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    }
    
    console.log('📦 Raw body buffer length:', rawBody.length);
    
    // Calculate HMAC digest using the correct webhook secret
    const calculatedHmacDigest = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');
    
    console.log('🧮 Calculated HMAC:', calculatedHmacDigest);
    console.log('📥 Received HMAC:', shopifyHmac);
    
    // Compare HMAC values securely
    const hmacValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHmacDigest), 
      Buffer.from(shopifyHmac)
    );
    
    console.log('✅ HMAC validation result:', hmacValid);
  
    if (hmacValid) {
      console.log('✅ Customer redact webhook verified successfully');
      
      // Process the webhook data here
      const webhookData = JSON.parse(rawBody.toString('utf8'));
      console.log('🗑️ Customer redaction request:', webhookData);
      
      // TODO: Implement your customer data deletion logic
      // This should delete/anonymize customer data as required by GDPR
      
      res.status(200).json({
        message: 'Customer data redaction processed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ HMAC validation failed for customer redact');
      res.status(401).send('Unauthorized - Invalid HMAC signature');
    }
    
  } catch (error) {
    console.error('💥 Error processing customer redact:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports.customerShopDelete = async (req, res) => {
  try {
    console.log('🏪 Shop Redact webhook received');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
    if (!shopifyHmac) {
      console.error('❌ Missing X-Shopify-Hmac-SHA256 header');
      return res.status(400).send('Missing HMAC header');
    }

    // CRITICAL FIX: Use the correct secret - SHOPIFY_API_SECRET, not clientSecret
    const webhookSecret = process.env.SHOPIFY_API_SECRET || 'YOUR_SHOPIFY_API_SECRET_HERE';
    console.log('🔑 Using webhook secret:', webhookSecret ? webhookSecret.substring(0, 8) + '...' : 'NOT_SET');
    
    // Ensure we have raw body data
    let rawBody;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = Buffer.from(req.body, 'utf8');
    } else {
      rawBody = Buffer.from(JSON.stringify(req.body), 'utf8');
    }
    
    console.log('📦 Raw body buffer length:', rawBody.length);
    
    // Calculate HMAC digest using the correct webhook secret
    const calculatedHmacDigest = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('base64');
    
    console.log('🧮 Calculated HMAC:', calculatedHmacDigest);
    console.log('📥 Received HMAC:', shopifyHmac);
    
    // Compare HMAC values securely
    const hmacValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHmacDigest), 
      Buffer.from(shopifyHmac)
    );
    
    console.log('✅ HMAC validation result:', hmacValid);

    if (hmacValid) {
      console.log('✅ Shop redact webhook verified successfully');
      
      // Process the webhook data here
      const webhookData = JSON.parse(rawBody.toString('utf8'));
      console.log('🏪 Shop redaction request:', webhookData);
      
      // TODO: Implement your shop data deletion logic
      // This should delete/anonymize shop data as required by GDPR
      
      res.status(200).json({
        message: 'Shop data redaction processed successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('❌ HMAC validation failed for shop redact');
      res.status(401).send('Unauthorized - Invalid HMAC signature');
    }

  } catch (error) {
    console.error('💥 Error processing shop redact:', error);
    res.status(500).send('Internal Server Error');
  }
};
// compliance webhook




// others

module.exports.checkShopifyConnected = async (req, res) => {
  try {


    const response = await shopifyService.checkShopifyConnected(req.body)

    if(response){
      return res.send({
        status : true,
        message : 'Shopify Connection Exist',
        response : response
      })
    }
    else {
      return res.send({
        status : false,
        message : 'No Shopify Connection Exist'
      })
    }


  } catch (error) {
    console.log("pushProductsToShopify Error:", error);
  }
};

// others









module.exports.pushProductsToShopify = async (req, res) => {
  try {
    const { shop } = req.query;
    
    // Get store credentials
    const [store] = await global.dbConnection('shopify_stores')
      .where('shop', shop)
      .select('access_token');

    if (!store) {
      return res.status(400).json({ error: "Store not connected" });
    }

    // Get products from your database
    const products = await global.dbConnection('products')
      .where('user_id', req.user.id)
      .select('*');

    // Initialize Shopify client
    const client = new shopify.clients.Rest({
      session: {
        shop: shop,
        accessToken: store.access_token
      }
    });

    // Push products to Shopify
    const results = await Promise.all(
      products.map(async (product) => {
        const shopifyProduct = {
          title: product.name,
          body_html: product.description,
          variants: [{
            price: product.price,
            sku: product.sku
          }],
          images: [{ src: product.image_url }]
        };

        const response = await client.post({
          path: 'products',
          data: { product: shopifyProduct },
          type: 'JSON'
        });

        return response.body.product;
      })
    );

    res.json({
      success: true,
      message: `${results.length} products pushed successfully`,
      products: results
    });

  } catch (error) {
    console.log("pushProductsToShopify Error:", error);
    res.status(500).json({
      success: false,
      error: "Product push failed",
      details: error.message
    });
  }
};

module.exports.saveShopifyProduct = async (req,res) => {
  try {

    const response = await shopifyService.saveShopifyProduct(req.body)

    if(response){
      return res.send({
        status : true,
        message : 'Product Save in Library'
      })
    }
    else {
      return res.send({
        status : false,
        message : 'Failed to save Product in Library !'
      })
    }

  }
  catch(error){
    console.log(`error in saveSHopifyProduct controller - `,error);
  }
}

module.exports.getShopifyProducts = async (req,res) => {
  try {

    const response = await shopifyService.getShopifyProducts(req.body)

    if(response){
      return res.send({
        status : true,
        message : 'Shopify Products Fetched Successfully',
        response : response
      })
    }
    else {
      return res.send({
        status : false,
        message : 'Failed to Fetch Product Library !'
      })
    }

  }
  catch(error){
    console.log(`error in getShopifyProducts controller - `,error);
  }
}

module.exports.deleteShopifyProducts = async (req,res) => {
  try {

    const response = await shopifyService.deleteShopifyProducts(req.body)

    if(response){
      return res.send({
        status : true,
        message : 'Shopify Products Deleted Successfully'
      })
    }
    else {
      return res.send({
        status : false,
        message : 'Failed to Delete Shopify Product !'
      })
    }

  }
  catch(error){
    console.log(`error in deleteShopifyProducts controller - `,error);
  }
}

const Joi = require("joi");

module.exports.updateUserProduct = async (req, res) => {
  try {
    // 🔹 Define validation schema
    const schema = Joi.object({
      shopifyProductId: Joi.number().integer().required(),
      shopifyProductName: Joi.string().min(2).required(),
      shopifydesc: Joi.string().allow("", null),
      variants: Joi.array().items(Joi.object()).required(),
    });

    // 🔹 Validate request body
    const { error, value } = schema.validate(req.body);
    if (error) {
      return res.status(400).send({
        status: false,
        message: error.details[0].message,
      });
    }

    // 🔹 Call service
    const response = await shopifyService.updateUserProduct(value);

    // 🔹 Return structured response
    if (response.status) {
      return res.send(response);
    } else {
      return res.status(400).send(response);
    }
  } catch (error) {
    console.log("❌ error in updateUserProduct controller - ", error);
    return res.status(500).send({
      status: false,
      message: "Internal server error",
    });
  }
};
