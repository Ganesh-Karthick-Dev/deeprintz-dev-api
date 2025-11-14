-- WooCommerce Frontend Shipping Configuration Table
-- This table stores frontend shipping settings for each vendor

CREATE TABLE IF NOT EXISTS `woocommerce_frontend_shipping` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL,
  `vendor_id` int(11) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `shipping_calculator_enabled` tinyint(1) DEFAULT 1,
  `automatic_calculation` tinyint(1) DEFAULT 1,
  `plugin_uploaded` tinyint(1) DEFAULT 0,
  `plugin_activated` tinyint(1) DEFAULT 0,
  `fallback_method_used` tinyint(1) DEFAULT 0,
  `shipping_display_options` json DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_shipping` (`store_id`, `vendor_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample configuration (optional)
-- INSERT INTO `woocommerce_frontend_shipping` (`store_id`, `vendor_id`, `is_active`, `shipping_calculator_enabled`, `automatic_calculation`) VALUES
-- (1, 1, 1, 1, 1);

-- Add indexes for better performance
ALTER TABLE `woocommerce_frontend_shipping` 
ADD INDEX `idx_created_at` (`created_at`),
ADD INDEX `idx_updated_at` (`updated_at`);

-- Add foreign key constraints (optional - uncomment if you want referential integrity)
-- ALTER TABLE `woocommerce_frontend_shipping` 
-- ADD CONSTRAINT `fk_frontend_shipping_store` FOREIGN KEY (`store_id`) REFERENCES `woocommerce_stores` (`id`) ON DELETE CASCADE;
