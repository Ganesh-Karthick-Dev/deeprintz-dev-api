-- Create vendor_settings table for storing vendor-specific configuration
CREATE TABLE IF NOT EXISTS `vendor_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL,
  `setting_key` varchar(255) NOT NULL,
  `setting_value` text,
  `setting_description` text,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_setting` (`vendor_id`, `setting_key`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_setting_key` (`setting_key`),
  KEY `idx_is_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default NimbusPost token for vendor 1039
INSERT INTO `vendor_settings` (`vendor_id`, `setting_key`, `setting_value`, `setting_description`, `is_active`) VALUES
(1039, 'nimbuspost_token', 'your_nimbuspost_token_here', 'NimbusPost API token for shipping calculation', 1),
(1039, 'nimbuspost_origin_pincode', '641603', 'Default origin pincode for shipping calculations', 1),
(1039, 'shipping_enabled', '1', 'Enable/disable shipping calculation for this vendor', 1),
(1039, 'default_shipping_weight', '500', 'Default weight in grams for products without weight', 1),
(1039, 'shipping_calculation_mode', 'real_time', 'Shipping calculation mode: real_time or cached', 1);

-- Create additional vendor settings for other common configurations
INSERT INTO `vendor_settings` (`vendor_id`, `setting_key`, `setting_value`, `setting_description`, `is_active`) VALUES
(1039, 'courier_partners_enabled', '1', 'Enable multiple courier partner options', 1),
(1039, 'cod_enabled', '1', 'Enable Cash on Delivery shipping option', 1),
(1039, 'prepaid_enabled', '1', 'Enable prepaid shipping option', 1),
(1039, 'shipping_cache_duration', '300', 'Shipping calculation cache duration in seconds', 1),
(1039, 'shipping_timeout', '30', 'Shipping API timeout in seconds', 1);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_vendor_settings_vendor_id` ON `vendor_settings` (`vendor_id`);
CREATE INDEX IF NOT EXISTS `idx_vendor_settings_setting_key` ON `vendor_settings` (`setting_key`);
CREATE INDEX IF NOT EXISTS `idx_vendor_settings_active` ON `vendor_settings` (`is_active`);

-- Add foreign key constraint if vendor table exists
-- ALTER TABLE `vendor_settings` 
-- ADD CONSTRAINT `fk_vendor_settings_vendor` 
-- FOREIGN KEY (`vendor_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;
