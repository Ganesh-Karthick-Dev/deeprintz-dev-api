-- Create woocommerce_orders table for storing WooCommerce orders
-- Run this SQL script in your database to fix the webhook storage issue

CREATE TABLE IF NOT EXISTS `woocommerce_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL DEFAULT 0,
  `woo_order_id` bigint(20) NOT NULL,
  `order_number` varchar(255) NOT NULL,
  `status` varchar(100) NOT NULL,
  `date_created` datetime NOT NULL,
  `date_modified` datetime NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `total_tax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `shipping_total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `customer_id` bigint(20) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `billing_address` text,
  `shipping_address` text,
  `payment_method` varchar(100) DEFAULT NULL,
  `payment_method_title` varchar(255) DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `customer_note` text,
  `line_items` text,
  `synced_at` datetime NOT NULL,
  `webhook_received` tinyint(1) NOT NULL DEFAULT 0,
  `needs_vendor_assignment` tinyint(1) NOT NULL DEFAULT 0,
  
  -- Conversion tracking fields
  `converted_to_website_order` tinyint(1) NOT NULL DEFAULT 0,
  `converted_at` datetime NULL,
  `website_order_id` int(11) NULL,
  `order_source` varchar(50) NOT NULL DEFAULT 'woocommerce',
  `stage_workflow_status` varchar(100) NULL,
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
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
  KEY `idx_stage_workflow_status` (`stage_workflow_status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert a sample record to test the table
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
  `webhook_received`
) VALUES (
  0, 
  123, 
  '123', 
  'processing', 
  NOW(), 
  NOW(), 
  450.00, 
  450.00, 
  'INR', 
  'test@example.com', 
  'Test User', 
  NOW(), 
  1
);

-- Verify the table was created
SELECT 'woocommerce_orders table created successfully!' as message;
SELECT COUNT(*) as total_records FROM woocommerce_orders;
