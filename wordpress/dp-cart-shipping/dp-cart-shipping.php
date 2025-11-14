<?php
/*
Plugin Name: Deeprintz Cart Shipping
Description: Shows real-time shipping cost on WooCommerce cart and checkout pages by calling Deeprintz API.
Version: 1.0.0
Author: Deeprintz
License: GPLv2 or later
*/

if (!defined('ABSPATH')) { exit; }

// Define plugin constants
define('DP_CART_SHIPPING_VERSION', '1.0.0');
define('DP_CART_SHIPPING_URL', plugin_dir_url(__FILE__));

// Enqueue assets on cart and checkout pages only
add_action('wp_enqueue_scripts', function () {
	if (!function_exists('is_cart') || !function_exists('is_checkout')) { return; }
	if (!is_cart() && !is_checkout()) { return; }

	wp_enqueue_style(
		'dp-cart-shipping',
		DP_CART_SHIPPING_URL . 'assets/css/dp-cart-shipping.css',
		[],
		DP_CART_SHIPPING_VERSION
	);

	wp_enqueue_script(
		'dp-cart-shipping',
		DP_CART_SHIPPING_URL . 'assets/js/dp-cart-shipping.js',
		[],
		DP_CART_SHIPPING_VERSION,
		true
	);

	// Provide API endpoint to the script
	wp_localize_script('dp-cart-shipping', 'DP_SHIP', [
		'apiUrl' => 'https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/shipping/calculate'
	]);
});









