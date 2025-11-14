const express = require('express');
const router = express.Router();
const modernShopifyController = require('../../controllers/shopify/modernController');
const appProxyController = require('../../controllers/shopify/appProxyController');

// Raw body middleware for Shopify webhooks (captures raw buffer for HMAC verification)
const shopifyRaw = express.raw({
	type: 'application/json',
	verify: (req, res, buf) => {
		try { req.rawBody = buf; } catch (_) {}
	}
});

// Modern Shopify OAuth and Installation Routes
router.get('/install', modernShopifyController.install);
router.get('/authCallback', modernShopifyController.authCallback);

// Modern Shopify Connection Management Routes
router.post('/test-connection', modernShopifyController.testConnection);
router.get('/connection-status', modernShopifyController.getConnectionStatus);
router.post('/disconnect', modernShopifyController.disconnect);

// Modern Shopify Product Management Routes (GraphQL)
router.get('/products', modernShopifyController.getProducts);
router.post('/products', modernShopifyController.createProduct);
router.put('/products/:productId', modernShopifyController.updateProduct);
router.delete('/products/:productId', modernShopifyController.deleteProduct);
router.post('/products/bulk', modernShopifyController.bulkCreateProducts);
router.post('/products/resync-inventory', modernShopifyController.resyncProductInventory);

// Modern Shopify Product Push Route (compatible with pushProductsToWooCommerce)
router.post('/push-products', modernShopifyController.createProduct);

// Modern Shopify Order Management Routes (GraphQL)
router.get('/orders', modernShopifyController.getOrders);
router.get('/orders/:orderId', modernShopifyController.getOrderById);

// Modern Shopify Store Information Routes
router.get('/stats', modernShopifyController.getStoreStats);

// Modern Shopify Shipping Calculation Routes
router.post('/shipping/calculate', modernShopifyController.calculateShipping);
router.post('/shipping/webhook', modernShopifyController.handleShippingWebhook);

// Shopify Orders Webhook (store orders after placement)
router.post('/webhooks/orders', shopifyRaw, modernShopifyController.handleOrderWebhook);
router.post('/orders/webhook', shopifyRaw, modernShopifyController.handleOrderWebhook);

// Manual webhook registration (for troubleshooting)
router.post('/webhooks/register', modernShopifyController.manualRegisterWebhooks);

// CarrierService admin helpers
router.post('/carrier/register', modernShopifyController.manualRegisterCarrierService);
router.get('/carrier/list', modernShopifyController.listCarrierServices);

// App Proxy Routes (for Shopify store integration)
router.all('/proxy/*', appProxyController.handleProxy);
router.get('/proxy/shipping/script', appProxyController.serveShippingScript);

module.exports = router;
