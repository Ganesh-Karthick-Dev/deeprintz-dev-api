-- Create table for tracking GDPR compliance requests
-- This table stores customer data requests, customer redact requests, and shop redact requests

CREATE TABLE IF NOT EXISTS `shopify_gdpr_requests` (
  `id` INT(11) NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `request_type` ENUM('data_request', 'customer_redact', 'shop_redact') NOT NULL,
  `shop_id` BIGINT(20) DEFAULT NULL,
  `shop_domain` VARCHAR(255) DEFAULT NULL,
  `customer_id` BIGINT(20) DEFAULT NULL,
  `customer_email` VARCHAR(255) DEFAULT NULL,
  `payload` TEXT,
  `status` ENUM('pending', 'processed', 'completed') DEFAULT 'pending',
  `processed_at` DATETIME DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_shop_domain` (`shop_domain`),
  INDEX `idx_customer_email` (`customer_email`),
  INDEX `idx_request_type` (`request_type`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='GDPR compliance requests from Shopify';

