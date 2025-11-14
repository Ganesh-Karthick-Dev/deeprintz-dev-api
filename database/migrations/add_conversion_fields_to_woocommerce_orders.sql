-- Add conversion tracking fields to woocommerce_orders table
-- This allows store orders to be optionally converted to website orders

ALTER TABLE `woocommerce_orders` 
ADD COLUMN `converted_to_website_order` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Whether this store order has been converted to a website order',
ADD COLUMN `converted_at` DATETIME NULL COMMENT 'When the order was converted to a website order',
ADD COLUMN `website_order_id` INT(11) NULL COMMENT 'Reference to the website order if converted',
ADD COLUMN `order_source` VARCHAR(50) NOT NULL DEFAULT 'woocommerce' COMMENT 'Source of the order (woocommerce, shopify, etc.)',
ADD COLUMN `stage_workflow_status` VARCHAR(100) NULL COMMENT 'Current status in the stage workflow (if integrated)';

-- Add indexes for better performance
ALTER TABLE `woocommerce_orders` 
ADD INDEX `idx_converted_to_website_order` (`converted_to_website_order`),
ADD INDEX `idx_website_order_id` (`website_order_id`),
ADD INDEX `idx_order_source` (`order_source`),
ADD INDEX `idx_stage_workflow_status` (`stage_workflow_status`);

-- Add comments to existing fields for clarity
ALTER TABLE `woocommerce_orders` 
MODIFY COLUMN `status` VARCHAR(100) NOT NULL COMMENT 'WooCommerce order status (pending, processing, completed, etc.)',
MODIFY COLUMN `vendor_id` INT(11) NOT NULL DEFAULT 0 COMMENT 'Vendor ID (0 for unknown vendor)';
