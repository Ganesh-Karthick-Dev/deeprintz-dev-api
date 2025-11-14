-- WooCommerce Stores Table
-- This table stores the connection details for vendor WooCommerce stores

CREATE TABLE IF NOT EXISTS `woocommerce_stores` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL COMMENT 'Reference to vendor/user table',
  `store_url` varchar(255) NOT NULL COMMENT 'WooCommerce store URL',
  `store_name` varchar(255) DEFAULT NULL COMMENT 'Store name from WooCommerce',
  `consumer_key` varchar(255) NOT NULL COMMENT 'WooCommerce consumer key',
  `consumer_secret` varchar(255) NOT NULL COMMENT 'WooCommerce consumer secret',
  `status` enum('connected','disconnected','error') DEFAULT 'connected' COMMENT 'Connection status',
  `last_sync` timestamp NULL DEFAULT NULL COMMENT 'Last successful sync timestamp',
  `sync_errors` text DEFAULT NULL COMMENT 'Last sync error details',
  `store_info` json DEFAULT NULL COMMENT 'Additional store information from WooCommerce',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `connected_at` timestamp NULL DEFAULT NULL COMMENT 'When the store was first connected',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_store` (`vendor_id`, `store_url`),
  KEY `idx_vendor_id` (`vendor_id`),
  KEY `idx_status` (`status`),
  KEY `idx_last_sync` (`last_sync`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WooCommerce store connections for vendors';

-- WooCommerce Products Sync Table
-- This table tracks products synced between your system and WooCommerce stores

CREATE TABLE IF NOT EXISTS `woocommerce_products_sync` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL COMMENT 'Reference to woocommerce_stores table',
  `local_product_id` int(11) DEFAULT NULL COMMENT 'Product ID in your local system',
  `woo_product_id` int(11) NOT NULL COMMENT 'Product ID in WooCommerce',
  `sync_type` enum('create','update','delete') NOT NULL COMMENT 'Type of sync operation',
  `sync_status` enum('pending','success','failed') DEFAULT 'pending' COMMENT 'Sync operation status',
  `sync_data` json DEFAULT NULL COMMENT 'Product data that was synced',
  `error_message` text DEFAULT NULL COMMENT 'Error message if sync failed',
  `last_sync_attempt` timestamp NULL DEFAULT NULL COMMENT 'Last sync attempt timestamp',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_store_product` (`store_id`, `woo_product_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_local_product_id` (`local_product_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_last_sync_attempt` (`last_sync_attempt`),
  FOREIGN KEY (`store_id`) REFERENCES `woocommerce_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WooCommerce products sync tracking';

-- WooCommerce Orders Sync Table
-- This table tracks orders synced between your system and WooCommerce stores

CREATE TABLE IF NOT EXISTS `woocommerce_orders_sync` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `store_id` int(11) NOT NULL COMMENT 'Reference to woocommerce_stores table',
  `local_order_id` int(11) DEFAULT NULL COMMENT 'Order ID in your local system',
  `woo_order_id` int(11) NOT NULL COMMENT 'Order ID in WooCommerce',
  `order_data` json DEFAULT NULL COMMENT 'Order data from WooCommerce',
  `sync_status` enum('pending','success','failed') DEFAULT 'pending' COMMENT 'Sync operation status',
  `error_message` text DEFAULT NULL COMMENT 'Error message if sync failed',
  `last_sync_attempt` timestamp NULL DEFAULT NULL COMMENT 'Last sync attempt timestamp',
  `created_at` timestamp DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_store_order` (`store_id`, `woo_order_id`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_local_order_id` (`local_order_id`),
  KEY `idx_sync_status` (`sync_status`),
  KEY `idx_last_sync_attempt` (`last_sync_attempt`),
  FOREIGN KEY (`store_id`) REFERENCES `woocommerce_stores` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='WooCommerce orders sync tracking';

-- Insert sample data for testing (optional)
-- INSERT INTO `woocommerce_stores` (`vendor_id`, `store_url`, `store_name`, `consumer_key`, `consumer_secret`, `status`) 
-- VALUES (1, 'https://example-store.com', 'Example Store', 'ck_example_key', 'cs_example_secret', 'connected');
