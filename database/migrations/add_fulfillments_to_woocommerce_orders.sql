-- Add fulfillments column to woocommerce_orders table for Shopify fulfillment tracking
ALTER TABLE `woocommerce_orders`
ADD COLUMN `fulfillments` text DEFAULT NULL AFTER `refunds`;

ALTER TABLE `woocommerce_orders`
ADD COLUMN `order_source` varchar(50) NOT NULL DEFAULT 'woocommerce' AFTER `needs_vendor_assignment`;

ALTER TABLE `woocommerce_orders`
ADD COLUMN `order_key` varchar(255) DEFAULT NULL AFTER `order_source`;

-- Add index for order_source for better query performance
ALTER TABLE `woocommerce_orders`
ADD KEY `idx_order_source` (`order_source`);
