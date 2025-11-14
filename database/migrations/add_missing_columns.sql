-- Add missing columns to existing woocommerce_frontend_shipping table
-- Run this if you already have the table but missing these columns

ALTER TABLE `woocommerce_frontend_shipping` 
ADD COLUMN `plugin_uploaded` tinyint(1) DEFAULT 0 AFTER `automatic_calculation`,
ADD COLUMN `plugin_activated` tinyint(1) DEFAULT 0 AFTER `plugin_uploaded`,
ADD COLUMN `fallback_method_used` tinyint(1) DEFAULT 0 AFTER `plugin_activated`,
ADD COLUMN `plugin_file_path` varchar(500) DEFAULT NULL AFTER `fallback_method_used`,
ADD COLUMN `plugin_file_name` varchar(255) DEFAULT NULL AFTER `plugin_file_path`,
ADD COLUMN `plugin_uploaded_at` timestamp NULL DEFAULT NULL AFTER `plugin_file_name`,
ADD COLUMN `plugin_installed` tinyint(1) DEFAULT 0 AFTER `plugin_uploaded_at`,
ADD COLUMN `manual_installation_required` tinyint(1) DEFAULT 0 AFTER `plugin_installed`,
ADD COLUMN `manual_install_file` varchar(500) DEFAULT NULL AFTER `manual_installation_required`;
