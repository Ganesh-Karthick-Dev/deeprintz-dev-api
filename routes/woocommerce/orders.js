const express = require('express');
const router = express.Router();
const woocommerceController = require('../../controllers/woocommerce/index');
const webhookController = require('../../controllers/woocommerce/webhooks');

// Get all orders for a vendor
router.get('/vendor/:vendor_id', woocommerceController.getVendorOrders);

// Get a specific order by ID
router.get('/vendor/:vendor_id/order/:order_id', woocommerceController.getOrderById);

// Update order status
router.put('/vendor/:vendor_id/order/:order_id/status', woocommerceController.updateOrderStatus);

// Get order statistics for a vendor
router.get('/vendor/:vendor_id/statistics', woocommerceController.getOrderStatistics);

// Sync orders from WooCommerce to local database
router.post('/sync', woocommerceController.syncOrdersFromWooCommerce);

// WooCommerce webhook endpoint for real-time order notifications
router.post('/webhook', webhookController.handleOrderWebhook);

module.exports = router;
