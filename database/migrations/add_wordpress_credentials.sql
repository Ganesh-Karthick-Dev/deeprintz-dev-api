-- Add WordPress credentials to woocommerce_stores table
-- This allows automatic plugin installation and activation

ALTER TABLE `woocommerce_stores` 
ADD COLUMN `wp_username` VARCHAR(100) NULL AFTER `consumer_secret`,
ADD COLUMN `wp_password` VARCHAR(255) NULL AFTER `wp_username`,
ADD COLUMN `wp_api_enabled` BOOLEAN DEFAULT FALSE AFTER `wp_password`;

-- Add index for WordPress credentials
CREATE INDEX `idx_wp_credentials` ON `woocommerce_stores` (`wp_username`, `wp_api_enabled`);

-- Update existing stores with default WordPress credentials (you should change these)
UPDATE `woocommerce_stores` 
SET `wp_username` = 'admin', 
    `wp_password` = 'admin', 
    `wp_api_enabled` = TRUE 
WHERE `id` = 1;

-- Add comment to explain the new fields
ALTER TABLE `woocommerce_stores` 
MODIFY COLUMN `wp_username` VARCHAR(100) NULL COMMENT 'WordPress admin username for plugin installation',
MODIFY COLUMN `wp_password` VARCHAR(255) NULL COMMENT 'WordPress admin password for plugin installation',
MODIFY COLUMN `wp_api_enabled` BOOLEAN DEFAULT FALSE COMMENT 'Whether WordPress REST API is enabled for this store';
