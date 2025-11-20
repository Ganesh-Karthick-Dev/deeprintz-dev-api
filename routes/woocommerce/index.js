const express = require('express');
const router = express.Router();
const woocommerceController = require('../../controllers/woocommerce/index');
const webhookController = require('../../controllers/woocommerce/webhooks');

// WooCommerce store connection and management
router.post('/connect', woocommerceController.wooConnect);
router.get('/connection-status', woocommerceController.getConnectionStatus);
router.delete('/disconnect', woocommerceController.disconnectWooCommerce);
router.post('/test-connection', woocommerceController.testWooCommerceConnection);

// Product management
router.get('/products', woocommerceController.listProductsForVendors);
router.post('/products', woocommerceController.createProductInWooCommerce);
router.put('/products/:product_id', woocommerceController.updateProductInWooCommerce);
router.delete('/products/:product_id', woocommerceController.deleteProductFromWooCommerce);
router.post('/push-products', woocommerceController.pushProductsToWooCommerce);

// Store management
router.get('/stores', woocommerceController.getVendorStores);
router.get('/plugin-config', woocommerceController.getPluginConfig);

// Order management
router.get('/orders/vendor/:vendor_id', woocommerceController.getVendorOrders);
router.get('/orders/vendor/:vendor_id/order/:order_id', woocommerceController.getOrderById);
router.put('/orders/vendor/:vendor_id/order/:order_id/status', woocommerceController.updateOrderStatus);
router.get('/orders/vendor/:vendor_id/statistics', woocommerceController.getOrderStatistics);
router.post('/orders/sync', woocommerceController.syncOrdersFromWooCommerce);

// WooCommerce webhooks for real-time order notifications
router.post('/webhooks/orders', webhookController.handleOrderWebhook);
router.post('/webhooks/products', webhookController.handleProductWebhook);
router.post('/webhooks/customers', webhookController.handleCustomerWebhook);

// Webhook management
router.post('/webhooks/setup', woocommerceController.setupWooCommerceWebhooks);
router.get('/webhooks/list', woocommerceController.listWooCommerceWebhooks);
router.delete('/webhooks/:webhook_id', woocommerceController.deleteWooCommerceWebhook);

// Shipping integration with courier partners
router.post('/shipping/calculate', woocommerceController.calculateWooCommerceShipping);
router.get('/shipping/zones', woocommerceController.getWooCommerceShippingZones);
router.post('/shipping/setup', woocommerceController.setupWooCommerceShipping);
router.get('/shipping/rates/:postcode', woocommerceController.getShippingRatesForPostcode);
router.post('/shipping/webhook', woocommerceController.handleShippingWebhook);
router.get('/shipping/status', woocommerceController.getVendorShippingStatus);

module.exports = router;
