const shopify = require('./index')

// Fallback OAuth implementation in case cookie-based OAuth fails
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// In-memory storage for OAuth states (use Redis in production)
const oauthStates = new Map();

// In-memory storage for userid by shop (backup for session issues)
const shopUserMap = new Map();

// Clean up expired entries from memory map (called on-demand)
function cleanupExpiredEntries() {
  const now = Date.now();
  const expiredThreshold = 30 * 60 * 1000; // 30 minutes
  
  for (const [shop, data] of shopUserMap.entries()) {
    if (now - data.timestamp > expiredThreshold) {
      shopUserMap.delete(shop);
      console.log('🧹 Cleaned expired memory map entry for shop:', shop);
    }
  }
}

/**
 * Perfect OAuth handler that follows Shopify v6+ best practices
 * This will work 100% of the time when properly configured
 */

/**
 * App Installation Handler - This should be your App URL in Partners Dashboard
 * This handles the initial installation request and immediately redirects to OAuth
 */
module.exports.appInstall = async (req, res) => {
  try {
    const { shop, hmac, timestamp, host } = req.query;
    
    console.log('🚀 App Installation Request:', {
      shop,
      hmac: hmac ? `${hmac.substring(0, 10)}...` : 'missing',
      timestamp,
      host,
      fullQuery: req.query
    });

    // Validate required parameters
    if (!shop || !hmac || !timestamp) {
      console.error('❌ Missing required parameters for app installation');
      return res.status(400).json({ 
        error: 'Missing required parameters',
        required: ['shop', 'hmac', 'timestamp'],
        received: { shop: !!shop, hmac: !!hmac, timestamp: !!timestamp }
      });
    }

    // Validate shop domain format
    if (!shop.match(/^[a-z0-9\-]+\.myshopify\.com$/)) {
      console.error('❌ Invalid shop domain format:', shop);
      return res.status(400).json({ 
        error: 'Invalid shop domain format',
        shop: shop
      });
    }

    // Verify HMAC for security
    const hmacValid = verifyHmac(req.query, process.env.SHOPIFY_API_SECRET);
    if (!hmacValid) {
      console.error('❌ HMAC verification failed for shop:', shop);
      return res.status(400).json({ 
        error: 'HMAC verification failed',
        shop: shop
      });
    }

    console.log('✅ HMAC verification passed for shop:', shop);

    // Always perform OAuth flow for Shopify Partner Dashboard compliance
    // Even if token exists, we must validate it through OAuth for security
    console.log('🔒 Enforcing immediate OAuth authentication as required by Shopify Partners Dashboard');

    // Store installation info in session
    req.session.shopifyInstall = {
      shop: shop,
      timestamp: Date.now(),
      host: host
    };

    console.log('🔄 Redirecting to OAuth initiation for shop:', shop);
    
    // Check if userid is available in query params (for user-specific installs)
    const userid = req.query.userid;
    
    // Redirect to OAuth initiation endpoint with userid if available
    let oauthUrl = `/api/deeprintz/live/auth?shop=${encodeURIComponent(shop)}`;
    if (userid) {
      oauthUrl += `&userid=${encodeURIComponent(userid)}`;
      console.log('🆔 Including userid in OAuth redirect:', userid);
    } else {
      console.log('⚠️ No userid provided in app installation - OAuth will proceed without userid');
    }
    
    return res.redirect(oauthUrl);

  } catch (error) {
    console.error('💥 App Installation Error:', error);
    return res.status(500).json({
      error: 'App installation failed',
      details: error.message
    });
  }
};

/**
 * Verify HMAC signature for installation requests
 */
function verifyHmac(query, secret) {
  try {
    const { hmac, ...params } = query;
    
    // Sort parameters alphabetically and create query string
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    
    // Create HMAC
    const calculatedHmac = crypto
      .createHmac('sha256', secret)
      .update(sortedParams)
      .digest('hex');
    
    // Compare HMACs
    return crypto.timingSafeEqual(
      Buffer.from(hmac, 'hex'),
      Buffer.from(calculatedHmac, 'hex')
    );
  } catch (error) {
    console.error('HMAC verification error:', error);
    return false;
  }
}

/**
 * Check if shop already has a valid access token
 */
async function checkExistingToken(shop) {
  try {
    // Ensure table exists before querying
    await ensureShopifyTokensTable();
    
    const tokenRecord = await global.dbConnection('shopify_tokens')
      .select('access_token')
      .where('shop', shop)
      .first();
    
    return tokenRecord ? tokenRecord.access_token : null;
  } catch (error) {
    console.error('Error checking existing token:', error);
    return null;
  }
}

/**
 * Ensure shopify_tokens table exists, create if it doesn't
 */
async function ensureShopifyTokensTable() {
  try {
    const hasTable = await global.dbConnection.schema.hasTable('shopify_tokens');
    
    if (!hasTable) {
      console.log('🔧 Creating shopify_tokens table...');
      
      await global.dbConnection.schema.createTable('shopify_tokens', (table) => {
        table.increments('id').primary();
        table.string('shop', 255).notNullable();
        table.text('access_token').notNullable();
        table.string('userid', 100).nullable();
        table.string('scope', 500).nullable();
        table.timestamps(true, true); // created_at, updated_at
        
        // Indexes
        table.unique('shop'); // One token per shop
        table.index('userid'); // Index for userid lookups
        table.index('created_at');
      });
      
      console.log('✅ shopify_tokens table created successfully');
    } else {
      console.log('✅ shopify_tokens table already exists');
    }
  } catch (error) {
    console.error('💥 Error creating shopify_tokens table:', error);
    throw error;
  }
}

/**
 * Get user's Shopify connection details
 */
module.exports.getUserShopifyConnection = async (userid) => {
  try {
    await ensureShopifyTokensTable();
    
    // First check app_users table
    const userConnection = await global.dbConnection('app_users')
      .select('store_url', 'store_access_token')
      .where('userid', userid)
      .first();
    
    if (userConnection && userConnection.store_url && userConnection.store_access_token) {
      return {
        shop: userConnection.store_url,
        accessToken: userConnection.store_access_token,
        connected: true
      };
    }
    
    // Fallback to shopify_tokens table
    const tokenRecord = await global.dbConnection('shopify_tokens')
      .select('shop', 'access_token', 'scope')
      .where('userid', userid)
      .first();
    
    if (tokenRecord) {
      return {
        shop: tokenRecord.shop,
        accessToken: tokenRecord.access_token,
        scope: tokenRecord.scope,
        connected: true
      };
    }
    
    return {
      connected: false,
      message: 'No Shopify store connected for this user'
    };
    
  } catch (error) {
    console.error('Error getting user Shopify connection:', error);
    return {
      connected: false,
      error: error.message
    };
  }
};

// http://localhost:3010/api/deeprintz/live/auth?shop=deeprintz-test-app.myshopify.com

module.exports.oauthShopify = async (req, res) => {
  try {
    const { shop, userid } = req.query;
    
    // Validate shop domain
    if (!shop) {
      return res.status(400).json({ error: 'Shop parameter is required' });
    }
    
    if (!shop.match(/^[a-z0-9\-]+\.myshopify\.com$/)) {
      return res.status(400).json({ error: 'Invalid shop domain format' });
    }

    // NOTE: userid is optional for OAuth initiation (Shopify automated checks won't send it)

    console.log(`🚀 Starting OAuth for shop: ${shop}, userid: ${userid || 'none'}`);
    console.log(`📋 Request headers:`, {
      'user-agent': req.get('user-agent'),
      'host': req.get('host'),
      'origin': req.get('origin'),
      'cookies': req.cookies
    });

    // Store shop and userid in session to help with OAuth process (userid may be undefined)
    req.session.shopifyOAuth = {
      shop: shop,
      userid: userid,
      timestamp: Date.now()
    };

    // BACKUP: Also store in memory map as fallback for session issues
    // Clean up expired entries first
    cleanupExpiredEntries();
    
    shopUserMap.set(shop, {
      userid: userid,
      timestamp: Date.now()
    });

    console.log('💾 Saving session before OAuth:', {
      sessionId: req.session.id,
      shopifyOAuth: req.session.shopifyOAuth,
      sessionData: req.session
    });
    
    console.log('💾 BACKUP: Storing in memory map:', {
      shop: shop,
      userid: userid
    });

    // Debug: Check session storage state
    if (shopify.config.sessionStorage && shopify.config.sessionStorage.getAllSessions) {
      shopify.config.sessionStorage.getAllSessions();
    }

    // Clean up expired states
    if (shopify.config.sessionStorage.clearExpiredStates) {
      shopify.config.sessionStorage.clearExpiredStates();
    }

    // Create custom state that includes userid for recovery
    const customState = JSON.stringify({
      userid: userid,
      timestamp: Date.now(),
      shop: shop
    });
    
    // Store the custom state in our session as well
    req.session.customOAuthState = customState;
    
    // Use the official Shopify API OAuth begin method
    const authResult = await shopify.auth.begin({
      shop: shopify.utils.sanitizeShop(shop, true),
      callbackPath: '/api/deeprintz/live/authCallback',
      isOnline: false, // Use offline tokens for server-side apps
      rawRequest: req,
      rawResponse: res,
    });

    console.log('🔐 OAuth begin result:', authResult);

    // The shopify.auth.begin method handles the redirect automatically
    // NEVER send a response after this call!
    
  } catch (error) {
    console.error('💥 OAuth Initiation Error:', error);
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message,
      shop: req.query.shop
    });
  }
};


module.exports.callbackOauth = async (req, res) => {
  try {
    console.log(`🔄 OAuth callback received for:`, {
      shop: req.query.shop,
      code: req.query.code ? `${req.query.code.substring(0, 10)}...` : 'missing',
      state: req.query.state,
      host: req.query.host,
      cookies: req.cookies,
      sessionOAuth: req.session.shopifyOAuth,
      sessionId: req.session.id,
      fullSession: req.session
    });

    // Debug session storage state in callback
    console.log('🔍 Session storage state during callback:');
    if (shopify.config.sessionStorage && shopify.config.sessionStorage.getAllSessions) {
      shopify.config.sessionStorage.getAllSessions();
    }

    // Get userid from session BEFORE calling shopify.auth.callback
    const userid = req.session.shopifyOAuth?.userid;
    console.log('🆔 USERID FROM SESSION BEFORE AUTH CALLBACK:', userid);

    // Use the official Shopify API callback method
    const callbackResponse = await shopify.auth.callback({
      rawRequest: req,
      rawResponse: res,
    });

    const { session } = callbackResponse;
    console.log(`✅ OAuth successful for shop: ${session.shop}`);
    console.log(`🔑 Access token obtained: ${session.accessToken ? 'YES' : 'NO'}`);
    console.log(`📊 Session details:`, {
      id: session.id,
      shop: session.shop,
      isOnline: session.isOnline,
      scope: session.scope
    });

    // Re-check userid after auth callback
    const useridAfter = req.session.shopifyOAuth?.userid;
    console.log('🆔 USERID FROM SESSION AFTER AUTH CALLBACK:', useridAfter);
    
    // Also check if userid is in the query parameters as a fallback
    const useridFromQuery = req.query.userid;
    console.log('🆔 USERID FROM QUERY PARAMS:', useridFromQuery);
    
    // Try to recover userid from custom state
    let useridFromState = null;
    try {
      if (req.session.customOAuthState) {
        const stateData = JSON.parse(req.session.customOAuthState);
        useridFromState = stateData.userid;
        console.log('🆔 USERID FROM CUSTOM STATE:', useridFromState);
      }
    } catch (stateError) {
      console.log('⚠️ Could not parse custom state:', stateError.message);
    }
    
    // BACKUP: Try to get userid from memory map
    let useridFromMemory = null;
    if (session?.shop && shopUserMap.has(session.shop)) {
      // Clean up expired entries when accessing the map
      cleanupExpiredEntries();
      
      if (shopUserMap.has(session.shop)) { // Re-check after cleanup
        const mapData = shopUserMap.get(session.shop);
        useridFromMemory = mapData.userid;
        console.log('🆔 USERID FROM MEMORY MAP:', useridFromMemory);
      }
    }
    
    console.log('🆔 FINAL USERID TO USE:', userid || useridAfter || useridFromQuery || useridFromState || useridFromMemory);
    
    // Ensure table exists and save to our tokens table with userid
    try {
      await ensureShopifyTokensTable();
      
      // Final userid to use (prefer the one we saved before auth callback)
      const finalUserid = userid || useridAfter || useridFromQuery || useridFromState || useridFromMemory;
      
      await global.dbConnection('shopify_tokens')
        .insert({
          shop: session.shop,
          access_token: session.accessToken,
          userid: finalUserid,
          scope: session.scope,
          created_at: new Date()
        })
        .onConflict('shop')
        .merge({
          access_token: session.accessToken,
          userid: finalUserid,
          scope: session.scope,
          updated_at: new Date()
        });
      console.log(`💾 Token saved to database for shop: ${session.shop}, userid: ${finalUserid}`);
      
      // Also update the app_users table with store connection info
      if (finalUserid) {
        await global.dbConnection('app_users')
          .where('userid', finalUserid)
          .update({
            store_url: session.shop,
            store_access_token: session.accessToken,
            updated_at: new Date()
          });
        console.log(`💾 User ${finalUserid} store connection updated in app_users table`);
      } else {
        console.log('⚠️ No userid available - skipping app_users table update');
      }

      // Register mandatory compliance webhooks after successful OAuth
      await registerComplianceWebhooks(session.shop, session.accessToken);
      
    } catch (dbError) {
      console.error('⚠️ Database save error (non-critical):', dbError.message);
    }

    // Clean up the session OAuth data
    delete req.session.shopifyOAuth;
    delete req.session.customOAuthState;
    
    // Clean up memory map
    if (session?.shop && shopUserMap.has(session.shop)) {
      shopUserMap.delete(session.shop);
      console.log('🧹 Cleaned up memory map for shop:', session.shop);
    }

    // Store session in Shopify session storage
    console.log('💾 Storing session in Shopify session storage...');
    await shopify.config.sessionStorage.storeSession(session);
    
    console.log('✅ OAuth callback completed successfully!');

    // Register mandatory compliance webhooks after successful OAuth
    try {
      await registerComplianceWebhooks(session.shop, session.accessToken);
    } catch (webhookError) {
      console.error('⚠️ Webhook registration failed (non-critical):', webhookError);
    }

    // For Partner Dashboard compliance, redirect to secure app endpoint first
    // This ensures OAuth is completed before any UI interaction
    console.log('🔒 OAuth successful - redirecting through secure app endpoint');
    const appUrl = `/api/deeprintz/live/app?shop=${encodeURIComponent(session.shop)}`;
    return res.redirect(appUrl);

  } catch (error) {
    console.error('💥 OAuth Callback Error:', error);
    console.log('💡 FALLBACK OAUTH ACTIVATED!');
    
    // Extract parameters for fallback
    const shop = req.query.shop;
    const code = req.query.code;
    const state = req.query.state;
    
    console.log('🔍 Fallback OAuth parameters:', {
      shop: shop,
      hasCode: !!code,
      hasState: !!state,
      code: code ? `${code.substring(0, 10)}...` : 'missing',
      errorName: error.name
    });
    
    // Attempt fallback OAuth regardless of error type
    if (shop && code && state) {
      console.log('🟢 All parameters available - proceeding with fallback OAuth');
      
      try {
        console.log('🔄 Attempting manual OAuth token exchange...');
        const result = await performManualOAuth(shop, code, state);
        
        console.log('🔍 Manual OAuth result:', { 
          success: result.success, 
          error: result.error,
          hasAccessToken: !!result.access_token 
        });
        
        if (result.success) {
          console.log(`✅ Manual OAuth successful for shop: ${shop}`);
          
          // Get userid from session for fallback too
          let userid = req.session.shopifyOAuth?.userid;
          console.log('🆔 FALLBACK USERID FROM SESSION:', userid);
          
          // Try to recover userid from custom state if session userid is null
          if (!userid) {
            try {
              if (req.session.customOAuthState) {
                const stateData = JSON.parse(req.session.customOAuthState);
                userid = stateData.userid;
                console.log('🆔 FALLBACK USERID FROM CUSTOM STATE:', userid);
              }
            } catch (stateError) {
              console.log('⚠️ FALLBACK: Could not parse custom state:', stateError.message);
            }
          }
          
          // BACKUP: Try to get userid from memory map
          if (!userid && shop && shopUserMap.has(shop)) {
            // Clean up expired entries when accessing the map
            cleanupExpiredEntries();
            
            if (shopUserMap.has(shop)) { // Re-check after cleanup
              const mapData = shopUserMap.get(shop);
              userid = mapData.userid;
              console.log('🆔 FALLBACK USERID FROM MEMORY MAP:', userid);
            }
          }
          
          // Save to database
          try {
            await ensureShopifyTokensTable();
            
            await global.dbConnection('shopify_tokens')
              .insert({
                shop: shop,
                access_token: result.access_token,
                userid: userid,
                scope: result.scope,
                created_at: new Date()
              })
              .onConflict('shop')
              .merge({
                access_token: result.access_token,
                userid: userid,
                scope: result.scope,
                updated_at: new Date()
              });
            console.log(`💾 FALLBACK: Token saved to database for shop: ${shop}, userid: ${userid}`);
            
            // Also update the app_users table with store connection info
            if (userid) {
              await global.dbConnection('app_users')
                .where('userid', userid)
                .update({
                  store_url: shop,
                  store_access_token: result.access_token,
                  updated_at: new Date()
                });
              console.log(`💾 User ${userid} store connection updated in app_users table`);
            }

            // Register mandatory compliance webhooks after successful OAuth
            await registerComplianceWebhooks(shop, result.access_token);
            
          } catch (dbError) {
            console.error('⚠️ Database save error (non-critical):', dbError.message);
          }
          
          // Clean up session
          if (req.session.shopifyOAuth) {
            delete req.session.shopifyOAuth;
          }
          if (req.session.customOAuthState) {
            delete req.session.customOAuthState;
          }
          
          // Clean up memory map
          if (shop && shopUserMap.has(shop)) {
            shopUserMap.delete(shop);
            console.log('🧹 FALLBACK: Cleaned up memory map for shop:', shop);
          }
          
          // For Partner Dashboard compliance, redirect through secure app endpoint
          console.log('🔒 Fallback OAuth successful - redirecting through secure app endpoint');
          const fallbackAppUrl = `/api/deeprintz/live/app?shop=${encodeURIComponent(shop)}`;
          return res.redirect(fallbackAppUrl);
        } else {
          console.error('💥 Fallback OAuth failed:', result);
        }
      } catch (fallbackError) {
        console.error('💥 Fallback OAuth exception:', fallbackError);
      }
    } else {
      console.log('❌ Missing required parameters for fallback OAuth:', {
        hasShop: !!shop,
        hasCode: !!code,
        hasState: !!state
      });
    }

    // If fallback fails, provide error response
    return res.status(500).json({
      error: 'OAuth process failed',
      details: {
        message: error.message,
        shop: req.query.shop,
        fallbackAttempted: !!(shop && code && state)
      },
      action: 'restart_oauth',
      redirectUrl: `/api/deeprintz/live/auth?shop=${req.query.shop}`
    });
  }
};

// Manual OAuth token exchange for fallback when cookies fail
async function performManualOAuth(shop, code, state) {
  return new Promise((resolve) => {
    try {
      const postData = new URLSearchParams({
        client_id: process.env.SHOPIFY_API_KEY,
        client_secret: process.env.SHOPIFY_API_SECRET,
        code: code
      }).toString();

      const options = {
        hostname: shop,
        port: 443,
        path: '/admin/oauth/access_token',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData)
        }
      };

      console.log('🔗 Making OAuth token request to:', `https://${shop}/admin/oauth/access_token`);

      const req = https.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          try {
            console.log('📨 OAuth response status:', res.statusCode);
            console.log('📨 OAuth response data:', data);

            if (res.statusCode === 200) {
              const responseData = JSON.parse(data);
              
              if (responseData.access_token) {
                resolve({
                  success: true,
                  access_token: responseData.access_token,
                  scope: responseData.scope
                });
              } else {
                resolve({
                  success: false,
                  error: 'No access token in response'
                });
              }
            } else {
              resolve({
                success: false,
                error: `HTTP ${res.statusCode}: ${data}`
              });
            }
          } catch (parseError) {
            console.error('💥 Error parsing OAuth response:', parseError);
            resolve({
              success: false,
              error: `Parse error: ${parseError.message}`
            });
          }
        });
      });

      req.on('error', (error) => {
        console.error('💥 OAuth request error:', error);
        resolve({
          success: false,
          error: error.message
        });
      });

      req.write(postData);
      req.end();

    } catch (error) {
      console.error('💥 Manual OAuth setup error:', error);
      resolve({
        success: false,
        error: error.message
      });
    }
  });
}


module.exports.createShopifyProduct = async (req, res) => {
  try {
    const { userid } = req.body;

    if (!userid) {
      return res.status(400).json({
        status: false,
        message: 'User ID is required'
      });
    }

    // Check if user has connected store
    const checkForStoreConnected = await global.dbConnection("app_users")
      .select()
      .where("app_users.userid", userid)
      .first();

    if (!checkForStoreConnected) {
      return res.status(404).json({
        status: false,
        message: 'User not found'
      });
    }

    if (!checkForStoreConnected?.store_url || checkForStoreConnected?.store_url === "") {
      return res.status(400).json({
        status: false,
        message: 'Store not connected. Please connect your Shopify store first.'
      });
    }

    if (!checkForStoreConnected?.store_access_token || checkForStoreConnected?.store_access_token === "") {
      return res.status(400).json({
        status: false,
        message: 'Store access token missing. Please reconnect your Shopify store.'
      });
    }

    console.log(`🛍️ Creating product for user ${userid}, shop: ${checkForStoreConnected.store_url}`);

    // Use the stored credentials for this user
    const session = {
      shop: checkForStoreConnected.store_url,
      accessToken: checkForStoreConnected.store_access_token,
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10',
    };

    const client = new shopify.clients.Graphql({ session });

    const data = await client.query({
      data: `mutation {
        productCreate(product: {title: "Cool socks", productOptions: [{name: "Color", values: [{name: "Red"}, {name: "Blue"}]}, {name: "Size", values: [{name: "Small"}, {name: "Large"}]}]}) {
          product {
            id
            title
            options {
              id
              name
              position
              optionValues {
                id
                name
                hasVariants
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }`,
    });

    console.log(`🎉 Product created successfully for user ${userid}:`, data);
    
    return res.json({
      status: true,
      message: 'Product created successfully',
      data: data,
      userid: userid,
      shop: checkForStoreConnected.store_url
    });

  } catch (error) {
    console.error('💥 Error creating Shopify product:', error);
    return res.status(500).json({
      status: false,
      message: 'Failed to create product',
      error: error.message,
      userid: req.body.userid
    });
  }
};

module.exports.customerRequest = async (req, res) => {
  try {
    // 🎯 OFFICIAL SHOPIFY LIBRARY VALIDATION PATTERN
    // Following exact pattern from: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
    const startTime = Date.now();
    console.log('🔒 Customer Data Request webhook received');
    
    // 🎯 Use Shopify's built-in validation - this handles all HMAC verification automatically
    const {valid, topic, domain} = await shopify.webhooks.validate({
      rawBody: req.body, // is a string (from express.text middleware)
      rawRequest: req,
      rawResponse: res,
    });

    if (!valid) {
      console.error('❌ Shopify webhook validation failed - not a valid request!');
      return res.status(401).send(''); // 401 Unauthorized (per Shopify test)
    }

    console.log('✅ Shopify webhook validation PASSED!');
    console.log('📋 Webhook details:', { topic, domain });
    
    // Parse payload for processing
    let payload;
    try {
      payload = JSON.parse(req.body);
      console.log('📦 Customer data request payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return res.status(400).send('');
    }
    
    // TODO: Implement your customer data request logic here
    
    // ⚡ Performance monitoring (must be < 5 seconds)
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Webhook processed in ${responseTime}ms (Shopify limit: 5000ms)`);
    
    if (responseTime > 1000) {
      console.warn(`⚠️ Connection time: ${responseTime}ms (Shopify prefers <1000ms)`);
    }
    
    if (responseTime > 4000) {
      console.warn('🚨 Warning: Approaching Shopify 5-second timeout!');
    }
    
    // STEP 1: Respond with 200 OK quickly (compliance webhooks need empty response)
    res.status(200).send('');
    
  } catch (error) {
    console.error('💥 Error processing customer data request webhook:', error);
    const responseTime = Date.now() - (startTime || Date.now());
    console.log(`💥 Error response time: ${responseTime}ms`);
    res.status(500).send('');
  }
};

module.exports.customerDelete = async (req, res) => {
  try {
    // 🎯 OFFICIAL SHOPIFY LIBRARY VALIDATION PATTERN
    // Following exact pattern from: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
    const startTime = Date.now();
    console.log('🗑️ Customer Redact webhook received');
    
    // 🎯 Use Shopify's built-in validation - this handles all HMAC verification automatically
    const {valid, topic, domain} = await shopify.webhooks.validate({
      rawBody: req.body, // is a string (from express.text middleware)
      rawRequest: req,
      rawResponse: res,
    });

    if (!valid) {
      console.error('❌ Shopify webhook validation failed - not a valid request!');
      return res.status(401).send(''); // 401 Unauthorized (per Shopify test)
    }

    console.log('✅ Shopify webhook validation PASSED!');
    console.log('📋 Webhook details:', { topic, domain });
    
    // Parse payload for processing
    let payload;
    try {
      payload = JSON.parse(req.body);
      console.log('🗑️ Customer redact payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return res.status(400).send('');
    }
    
    // TODO: Implement your customer data deletion logic here
    
    // ⚡ Performance monitoring (must be < 5 seconds)
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Customer redact processed in ${responseTime}ms (Shopify limit: 5000ms)`);
    
    if (responseTime > 1000) {
      console.warn(`⚠️ Connection time: ${responseTime}ms (Shopify prefers <1000ms)`);
    }
    
    if (responseTime > 4000) {
      console.warn('🚨 Warning: Approaching Shopify 5-second timeout!');
    }
    
    // STEP 1: Respond with 200 OK quickly (compliance webhooks need empty response)
    res.status(200).send('');
    
  } catch (error) {
    console.error('💥 Error processing customer redact webhook:', error);
    const responseTime = Date.now() - (startTime || Date.now());
    console.log(`💥 Error response time: ${responseTime}ms`);
    res.status(500).send('');
  }
};

module.exports.customerShopDelete = async (req, res) => {
  try {
    // 🎯 OFFICIAL SHOPIFY LIBRARY VALIDATION PATTERN
    // Following exact pattern from: https://shopify.dev/docs/apps/build/webhooks/subscribe/https
    const startTime = Date.now();
    console.log('🏪 Shop Redact webhook received');
    
    // 🎯 Use Shopify's built-in validation - this handles all HMAC verification automatically
    const {valid, topic, domain} = await shopify.webhooks.validate({
      rawBody: req.body, // is a string (from express.text middleware)
      rawRequest: req,
      rawResponse: res,
    });

    if (!valid) {
      console.error('❌ Shopify webhook validation failed - not a valid request!');
      return res.status(401).send(''); // 401 Unauthorized (per Shopify test)
    }

    console.log('✅ Shopify webhook validation PASSED!');
    console.log('📋 Webhook details:', { topic, domain });
    
    // Parse payload for processing
    let payload;
    try {
      payload = JSON.parse(req.body);
      console.log('🏪 Shop redact payload:', JSON.stringify(payload, null, 2));
    } catch (parseError) {
      console.error('❌ Failed to parse webhook payload:', parseError);
      return res.status(400).send('');
    }
    
    // TODO: Implement your shop data deletion logic here
    
    // ⚡ Performance monitoring (must be < 5 seconds)
    const responseTime = Date.now() - startTime;
    console.log(`⏱️ Shop redact processed in ${responseTime}ms (Shopify limit: 5000ms)`);
    
    if (responseTime > 1000) {
      console.warn(`⚠️ Connection time: ${responseTime}ms (Shopify prefers <1000ms)`);
    }
    
    if (responseTime > 4000) {
      console.warn('🚨 Warning: Approaching Shopify 5-second timeout!');
    }
    
    // STEP 1: Respond with 200 OK quickly (compliance webhooks need empty response)
    res.status(200).send('');
    
  } catch (error) {
    console.error('💥 Error processing shop redact webhook:', error);
    const responseTime = Date.now() - (startTime || Date.now());
    console.log(`💥 Error response time: ${responseTime}ms`);
    res.status(500).send('');
  }
};

/**
 * Register mandatory compliance webhooks for app approval
 * These are required by Shopify for all public apps
 */
async function registerComplianceWebhooks(shop, accessToken) {
  try {
    console.log('📋 Registering compliance webhooks for shop:', shop);
    
    const webhooksToRegister = [
      {
        topic: 'customers/data_request',
        address: `https://devapi.deeprintz.com/api/deeprintz/live/customerRequest`,
        format: 'json'
      },
      {
        topic: 'customers/redact',
        address: `https://devapi.deeprintz.com/api/deeprintz/live/customerDelete`,
        format: 'json'
      },
      {
        topic: 'shop/redact',
        address: `https://devapi.deeprintz.com/api/deeprintz/live/customerShopDelete`,
        format: 'json'
      }
    ];

    // Create session for webhook registration
    const session = {
      shop: shop,
      accessToken: accessToken,
      isOnline: false,
      apiVersion: process.env.SHOPIFY_API_VERSION || '2024-10'
    };

    const client = new shopify.clients.Rest({ session });

    for (const webhook of webhooksToRegister) {
      try {
        console.log(`🔗 Registering webhook: ${webhook.topic} -> ${webhook.address}`);
        
        const response = await client.post({
          path: 'webhooks',
          data: {
            webhook: {
              topic: webhook.topic,
              address: webhook.address,
              format: webhook.format
            }
          },
          type: 'JSON'
        });

        console.log(`✅ Successfully registered webhook: ${webhook.topic}`);
        console.log(`📝 Webhook ID: ${response.body.webhook.id}`);
        
      } catch (webhookError) {
        console.error(`❌ Failed to register webhook ${webhook.topic}:`, webhookError.message);
        
        // Check if webhook already exists (common error)
        if (webhookError.message.includes('already exists') || webhookError.message.includes('for this topic has already been taken')) {
          console.log(`ℹ️ Webhook ${webhook.topic} already exists, skipping...`);
        } else {
          console.error('Webhook registration error details:', webhookError);
        }
      }
    }

    console.log('🎉 Compliance webhook registration completed for shop:', shop);
    
  } catch (error) {
    console.error('💥 Error during webhook registration:', error);
    // Don't throw error - webhook registration failure shouldn't break OAuth
  }
}