-- Create WooCommerce Orders and Order Items Tables
-- This script creates the necessary tables for storing WooCommerce order data

-- Drop tables if they exist (for development/testing)
-- DROP TABLE IF EXISTS `woocommerce_order_items`;
-- DROP TABLE IF EXISTS `woocommerce_orders`;

-- Create woocommerce_orders table
CREATE TABLE IF NOT EXISTS `woocommerce_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL DEFAULT 0 COMMENT 'Vendor ID (0 for unknown vendor)',
  `woo_order_id` bigint(20) NOT NULL COMMENT 'WooCommerce order ID',
  `order_number` varchar(255) NOT NULL COMMENT 'Order number/reference',
  `status` varchar(100) NOT NULL COMMENT 'Order status (pending, processing, completed, etc.)',
  `date_created` datetime NOT NULL COMMENT 'Order creation date from WooCommerce',
  `date_modified` datetime NOT NULL COMMENT 'Order last modification date from WooCommerce',
  `total` decimal(10,2) NOT NULL COMMENT 'Total order amount',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Subtotal before tax and shipping',
  `total_tax` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Total tax amount',
  `shipping_total` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Total shipping cost',
  `discount_total` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Total discount amount',
  `currency` varchar(10) NOT NULL DEFAULT 'USD' COMMENT 'Order currency',
  `customer_id` bigint(20) DEFAULT NULL COMMENT 'WooCommerce customer ID',
  `customer_email` varchar(255) DEFAULT NULL COMMENT 'Customer email address',
  `customer_name` varchar(255) DEFAULT NULL COMMENT 'Customer full name',
  `billing_address` text COMMENT 'Billing address as JSON',
  `shipping_address` text COMMENT 'Shipping address as JSON',
  `payment_method` varchar(100) DEFAULT NULL COMMENT 'Payment method used',
  `payment_method_title` varchar(255) DEFAULT NULL COMMENT 'Payment method display name',
  `transaction_id` varchar(255) DEFAULT NULL COMMENT 'Payment transaction ID',
  `customer_note` text COMMENT 'Customer order notes',
  `line_items` text COMMENT 'Order line items as JSON',
  
  -- Additional WooCommerce fields
  `order_key` varchar(255) DEFAULT NULL COMMENT 'WooCommerce order key',
  `parent_id` bigint(20) DEFAULT NULL COMMENT 'Parent order ID (for refunds/subscriptions)',
  `version` varchar(20) DEFAULT NULL COMMENT 'WooCommerce version when order was created',
  `prices_include_tax` tinyint(1) DEFAULT 0 COMMENT 'Whether prices include tax',
  `discount_codes` text COMMENT 'Applied discount codes as JSON',
  `coupon_lines` text COMMENT 'Coupon information as JSON',
  `fee_lines` text COMMENT 'Fee information as JSON',
  `shipping_lines` text COMMENT 'Shipping information as JSON',
  `tax_lines` text COMMENT 'Tax line details as JSON',
  `refunds` text COMMENT 'Refund information as JSON',
  `meta_data` text COMMENT 'Additional meta data as JSON',
  
  -- Sync and tracking fields
  `synced_at` datetime NOT NULL COMMENT 'When order was synced to local database',
  `webhook_received` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether webhook was received',
  `needs_vendor_assignment` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether vendor needs to be assigned',
  
  -- Conversion tracking fields
  `converted_to_website_order` tinyint(1) NOT NULL DEFAULT 0 COMMENT 'Whether converted to website order',
  `converted_at` datetime NULL COMMENT 'When order was converted to website order',
  `website_order_id` int(11) NULL COMMENT 'Reference to website order if converted',
  `order_source` varchar(50) NOT NULL DEFAULT 'woocommerce' COMMENT 'Order source (woocommerce, shopify, etc.)',
  `stage_workflow_status` varchar(100) NULL COMMENT 'Current status in stage workflow',
  
  -- Timestamps
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_order` (`vendor_id`, `woo_order_id`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_woo_order_id` (`woo_order_id`),
  KEY `idx_status` (`status`),
  KEY `idx_date_created` (`date_created`),
  KEY `idx_synced_at` (`synced_at`),
  KEY `idx_webhook_received` (`webhook_received`),
  KEY `idx_needs_vendor_assignment` (`needs_vendor_assignment`),
  KEY `idx_converted_to_website_order` (`converted_to_website_order`),
  KEY `idx_website_order_id` (`website_order_id`),
  KEY `idx_order_source` (`order_source`),
  KEY `idx_stage_workflow_status` (`stage_workflow_status`),
  KEY `idx_customer_email` (`customer_email`),
  KEY `idx_order_number` (`order_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WooCommerce orders synced from stores';

-- Create woocommerce_order_items table
CREATE TABLE IF NOT EXISTS `woocommerce_order_items` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `order_id` int(11) NOT NULL COMMENT 'Reference to woocommerce_orders table',
  `woo_order_id` bigint(20) NOT NULL COMMENT 'WooCommerce order ID for reference',
  `product_id` bigint(20) NOT NULL COMMENT 'WooCommerce product ID',
  `variation_id` bigint(20) NOT NULL DEFAULT 0 COMMENT 'WooCommerce variation ID (0 for simple products)',
  `name` varchar(500) NOT NULL COMMENT 'Product name',
  `quantity` int(11) NOT NULL COMMENT 'Product quantity ordered',
  `tax_class` varchar(100) DEFAULT '' COMMENT 'Tax class for the product',
  `subtotal` decimal(10,2) NOT NULL COMMENT 'Line item subtotal',
  `subtotal_tax` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Subtotal tax amount',
  `total` decimal(10,2) NOT NULL COMMENT 'Line item total',
  `total_tax` decimal(10,2) NOT NULL DEFAULT '0.00' COMMENT 'Total tax amount for line item',
  `sku` varchar(255) DEFAULT '' COMMENT 'Product SKU',
  `price` decimal(10,2) NOT NULL COMMENT 'Unit price',
  
  -- Additional product details
  `meta_data` text COMMENT 'Product meta data as JSON (includes deeprintz and shopify details)',
  `product_url` varchar(500) DEFAULT '' COMMENT 'Product URL',
  `image_url` varchar(500) DEFAULT '' COMMENT 'Product image URL',
  `vendor_id` int(11) DEFAULT NULL COMMENT 'Vendor ID if available',
  
  -- Timestamps
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Record creation timestamp',
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Record update timestamp',
  
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_woo_order_id` (`woo_order_id`),
  KEY `idx_product_id` (`product_id`),
  KEY `idx_variation_id` (`variation_id`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_sku` (`sku`),
  KEY `idx_name` (`name`(255)),
  
  -- Foreign key constraint
  CONSTRAINT `fk_woo_order_items_order` FOREIGN KEY (`order_id`) REFERENCES `woocommerce_orders` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Individual items within WooCommerce orders';

-- Insert sample data for testing (optional)
INSERT INTO `woocommerce_orders` (
  `vendor_id`, 
  `woo_order_id`, 
  `order_number`, 
  `status`, 
  `date_created`, 
  `date_modified`, 
  `total`, 
  `subtotal`, 
  `currency`, 
  `customer_email`, 
  `customer_name`, 
  `synced_at`, 
  `webhook_received`,
  `order_source`
) VALUES (
  2531, 
  12345, 
  '12345', 
  'pending', 
  NOW(), 
  NOW(), 
  480.00, 
  480.00, 
  'INR', 
  'care@deeprintz.com', 
  'test M', 
  NOW(), 
  1,
  'woocommerce'
);

-- Insert sample order item
INSERT INTO `woocommerce_order_items` (
  `order_id`,
  `woo_order_id`,
  `product_id`,
  `variation_id`,
  `name`,
  `quantity`,
  `subtotal`,
  `total`,
  `sku`,
  `price`,
  `meta_data`
) VALUES (
  1, -- This should match the order ID from above
  12345,
  129,
  130,
  'Supima Mens Round Neck Half Sleeve',
  1,
  480.00,
  480.00,
  'DP-11-S',
  480.00,
  '{"wooProductId": 129, "shopifyProductId": 45, "deeprintzProductId": 11, "deeprintzProductCategoryId": 1, "deeprintzProductName": "Supima Mens Round Neck Half Sleeve", "deeprintzProductDesc": "A Supima t-shirt is made from 100% Supima cotton which is known for its exceptional softness, durability, and breathability.", "deeprintzProductStock": null, "deeprintzProductCost": "0.00", "deeprintzProductHandlingCost": null, "deeprintzProductRetailPrice": "0.00", "deeprintzProductSku": "Su", "deeprintzProductBasePrice": "450.00", "shopifyOrderProductId": 129, "shopifyOrderVariationId": 130, "shopifyOrderProductSku": "DP-11-S", "shopifyOrderProductPrice": 480, "shopifyOrderProductQuantity": 1, "shopifyOrderProductTotal": "480.00", "shopifyVariants": [{"size": "Small", "sizeid": null, "sizesku": "S", "price": "480.000", "retailPrice": "500"}, {"size": "Medium", "sizeid": null, "sizesku": "M", "price": "480.000", "retailPrice": "505"}, {"size": "Large", "sizeid": null, "sizesku": "L", "price": "480.000", "retailPrice": "500"}, {"size": "ExtraLarge", "sizeid": null, "sizesku": "E", "price": "480.000", "retailPrice": "500"}, {"size": "2XL", "sizeid": null, "sizesku": "2", "price": "480.000", "retailPrice": "550"}]}'
);

-- Verify tables were created successfully
SELECT 'woocommerce_orders table created successfully!' as message;
SELECT 'woocommerce_order_items table created successfully!' as message;

-- Show table structure
DESCRIBE `woocommerce_orders`;
DESCRIBE `woocommerce_order_items`;

-- Show sample data
SELECT COUNT(*) as total_orders FROM `woocommerce_orders`;
SELECT COUNT(*) as total_order_items FROM `woocommerce_order_items`;
