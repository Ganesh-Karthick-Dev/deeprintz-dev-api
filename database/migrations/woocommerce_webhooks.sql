-- WooCommerce Webhook Management Tables
-- Run this SQL to create the necessary tables for webhook management

-- Table to store webhook configurations
CREATE TABLE IF NOT EXISTS `woocommerce_webhooks` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `webhook_id` int(11) NOT NULL,
  `name` varchar(255) NOT NULL,
  `topic` varchar(100) NOT NULL,
  `delivery_url` text NOT NULL,
  `status` varchar(20) DEFAULT 'active',
  `secret` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_webhook` (`store_id`, `webhook_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_topic` (`topic`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store shipping calculations (enhanced version)
CREATE TABLE IF NOT EXISTS `woocommerce_shipping_calculations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `user_id` int(11) NOT NULL,
  `post_code` varchar(10) NOT NULL,
  `weight` int(11) NOT NULL,
  `order_amount` decimal(10,2) DEFAULT 0.00,
  `payment_mode` varchar(20) DEFAULT 'prepaid',
  `shipping_options` longtext,
  `calculated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `source` varchar(50) DEFAULT 'api',
  `webhook_id` int(11) DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  PRIMARY KEY (`id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_post_code` (`post_code`),
  KEY `idx_calculated_at` (`calculated_at`),
  KEY `idx_source` (`source`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store webhook delivery logs
CREATE TABLE IF NOT EXISTS `woocommerce_webhook_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `webhook_id` int(11) NOT NULL,
  `store_id` int(11) NOT NULL,
  `topic` varchar(100) NOT NULL,
  `delivery_url` text NOT NULL,
  `request_headers` text,
  `request_body` longtext,
  `response_status` int(11) DEFAULT NULL,
  `response_headers` text,
  `response_body` longtext,
  `delivery_time` int(11) DEFAULT NULL,
  `success` tinyint(1) DEFAULT 0,
  `error_message` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_webhook_id` (`webhook_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_topic` (`topic`),
  KEY `idx_success` (`success`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store shipping method configurations
CREATE TABLE IF NOT EXISTS `woocommerce_shipping_methods` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `zone_id` int(11) NOT NULL,
  `method_id` int(11) NOT NULL,
  `method_type` varchar(100) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `settings` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_method` (`store_id`, `zone_id`, `method_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_zone_id` (`zone_id`),
  KEY `idx_method_type` (`method_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for testing (optional)
-- INSERT INTO `woocommerce_webhooks` (`store_id`, `webhook_id`, `name`, `topic`, `delivery_url`, `status`, `secret`) VALUES
-- (1, 1, 'Order Created', 'order.created', 'https://yourdomain.com/api/woocommerce/webhooks/orders', 'active', 'sample_secret_123');

-- Add indexes for better performance
ALTER TABLE `woocommerce_shipping_calculations` 
ADD INDEX `idx_weight_amount` (`weight`, `order_amount`),
ADD INDEX `idx_payment_mode` (`payment_mode`);

ALTER TABLE `woocommerce_webhook_logs` 
ADD INDEX `idx_delivery_time` (`delivery_time`),
ADD INDEX `idx_response_status` (`response_status`);

-- Add foreign key constraints (optional - uncomment if you want referential integrity)
-- ALTER TABLE `woocommerce_webhooks` 
-- ADD CONSTRAINT `fk_webhooks_store` FOREIGN KEY (`store_id`) REFERENCES `woocommerce_stores` (`id`) ON DELETE CASCADE;

-- ALTER TABLE `woocommerce_shipping_calculations` 
-- ADD CONSTRAINT `fk_shipping_store` FOREIGN KEY (`store_id`) REFERENCES `woocommerce_stores` (`id`) ON DELETE CASCADE;

-- ALTER TABLE `woocommerce_webhook_logs` 
-- ADD CONSTRAINT `fk_logs_webhook` FOREIGN KEY (`webhook_id`) REFERENCES `woocommerce_webhooks` (`id`) ON DELETE CASCADE;
