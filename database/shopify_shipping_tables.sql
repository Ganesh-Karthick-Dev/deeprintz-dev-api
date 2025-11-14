-- Shopify Shipping Configuration Tables
-- These tables store automatic shipping configurations for Shopify vendors

-- Table to store shipping zone and method configurations
CREATE TABLE IF NOT EXISTS `shopify_shipping_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `configuration` longtext NOT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_shop` (`user_id`, `shop_domain`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store script configurations (shipping calculator scripts)
CREATE TABLE IF NOT EXISTS `shopify_script_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `script_config` longtext NOT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_shop` (`user_id`, `shop_domain`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store webhook configurations
CREATE TABLE IF NOT EXISTS `shopify_webhook_configs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `webhook_config` longtext NOT NULL,
  `status` enum('active','inactive','pending') DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_shop` (`user_id`, `shop_domain`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store product sync records for Shopify
CREATE TABLE IF NOT EXISTS `shopify_product_sync` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `deeprintz_product_id` int(11) NOT NULL,
  `shopify_product_id` varchar(255) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `action` enum('create','update','delete') NOT NULL,
  `status` enum('success','failed','pending') NOT NULL,
  `sync_data` longtext,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_deeprintz_product_id` (`deeprintz_product_id`),
  KEY `idx_shopify_product_id` (`shopify_product_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_action` (`action`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store shipping calculation logs
CREATE TABLE IF NOT EXISTS `shopify_shipping_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `postcode` varchar(10) NOT NULL,
  `weight` decimal(10,2) NOT NULL,
  `order_amount` decimal(10,2) NOT NULL,
  `shipping_options` longtext,
  `calculation_time` decimal(10,4) DEFAULT NULL,
  `api_response_time` decimal(10,4) DEFAULT NULL,
  `status` enum('success','failed','error') NOT NULL,
  `error_message` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_postcode` (`postcode`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table to store selected shipping options by customers
CREATE TABLE IF NOT EXISTS `shopify_shipping_selections` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `shop_domain` varchar(255) NOT NULL,
  `session_id` varchar(255) NOT NULL,
  `postcode` varchar(10) NOT NULL,
  `selected_option` longtext NOT NULL,
  `cart_data` longtext,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_shop_domain` (`shop_domain`),
  KEY `idx_session_id` (`session_id`),
  KEY `idx_postcode` (`postcode`),
  KEY `idx_created_at` (`created_at`),
  KEY `idx_expires_at` (`expires_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data for testing (optional)
-- INSERT INTO `shopify_shipping_configs` (`user_id`, `shop_domain`, `configuration`, `status`) VALUES
-- (1, 'test-store.myshopify.com', '{"zones":[{"id":"gid://shopify/DeliveryZone/123","name":"Deeprintz Shipping Zone - 1"}],"methods":[{"id":"gid://shopify/DeliveryMethod/456","title":"Standard Shipping (Deeprintz)"}],"configured_at":"2024-01-15T10:30:00.000Z"}', 'active');

-- Add indexes for better performance
ALTER TABLE `shopify_shipping_configs` ADD INDEX `idx_created_at` (`created_at`);
ALTER TABLE `shopify_script_configs` ADD INDEX `idx_created_at` (`created_at`);
ALTER TABLE `shopify_webhook_configs` ADD INDEX `idx_created_at` (`created_at`);

-- Add foreign key constraints (optional, uncomment if needed)
-- ALTER TABLE `shopify_shipping_configs` ADD CONSTRAINT `fk_shopify_shipping_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
-- ALTER TABLE `shopify_script_configs` ADD CONSTRAINT `fk_shopify_script_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
-- ALTER TABLE `shopify_webhook_configs` ADD CONSTRAINT `fk_shopify_webhook_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
-- ALTER TABLE `shopify_product_sync` ADD CONSTRAINT `fk_shopify_sync_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
-- ALTER TABLE `shopify_shipping_logs` ADD CONSTRAINT `fk_shopify_logs_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
-- ALTER TABLE `shopify_shipping_selections` ADD CONSTRAINT `fk_shopify_selections_user` FOREIGN KEY (`user_id`) REFERENCES `app_users` (`userid`) ON DELETE CASCADE;
