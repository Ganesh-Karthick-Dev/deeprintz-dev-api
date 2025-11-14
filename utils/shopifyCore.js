// import '@shopify/shopify-api/adapters/node';
// import { shopifyApi, LATEST_API_VERSION } from '@shopify/shopify-api';

// // Configure Shopify
// const shopify = shopifyApi({
//     apiKey: process.env.SHOPIFY_CLIENT_ID,
//     apiSecretKey: process.env.SHOPIFY_CLIENT_SECRET,
//     apiVersion: LATEST_API_VERSION,
//     isEmbeddedApp: true,
//     scopes: ['write_products', 'read_products'],
//     hostName: new URL(process.env.APP_URL).hostname,
//     hostScheme: 'https',
//     future: {
//       v3_webhookAdminContext: true,
//       v3_authenticatePublic: true,
//       unstable_managedPricingSupport: true, // Enable managed pricing
//       newBillingApi: true, // Enable new billing API
//     },
//   });

//   export const shopifyInstall = async (req, res) => {
//     try {
        
//     //   const shop = req.query.shop;
//     const shop = 'deeprintz-test-app.myshopify.com'
      
//       if (!shopify.utils.sanitizeShop(shop)) {
//         return res.status(400).send('Invalid shop domain');
//       }
  
//       const authUrl = await shopify.auth.begin({
//         shop,
//         callbackPath: '/shopify/callback',
//         isOnline: true,
//         rawRequest: req,
//         rawResponse: res,
//       });
  
//       res.redirect(authUrl);
//     } catch (err) {
//       console.error('Install error:', err);
//       res.status(500).send('Installation failed');
//     }
//   };
  
//   export const callback = async (req, res) => {
//     try {
//       const { session } = await shopify.auth.callback({
//         rawRequest: req,
//         rawResponse: res,
//       });
  
//       await knex('shops').insert({
//         id: session.id,
//         shop_domain: session.shop,
//         access_token: session.accessToken,
//       }).onConflict('id').merge();
  
//       const token = jwt.sign(
//         { shop: session.shop, sessionId: session.id },
//         process.env.JWT_SECRET,
//         { expiresIn: '1h' }
//       );
  
//       res.redirect(`${process.env.FRONTEND_URL}/dashboard?token=${token}`);
//     } catch (err) {
//       console.error('Callback error:', err);
//       res.status(500).send(`Authentication failed: ${err.message}`);
//     }
//   };