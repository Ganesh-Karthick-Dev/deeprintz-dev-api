# Deeprintz Cart Shipping (WooCommerce)

Shows real-time shipping cost on WooCommerce Cart and Checkout by calling your API.

API used: https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/shipping/calculate

## Install
1. Zip the `wordpress/dp-cart-shipping` folder as `dp-cart-shipping.zip`.
2. WordPress Admin → Plugins → Add New → Upload Plugin → upload zip → Activate.

## What it does
- Adds a PIN code field on Cart/Checkout
- Calls the API to calculate shipping
- Hides WooCommerce default shipping block (no "Flat rate FREE")
- Inserts a Shipping row with the real amount and updates the total

## Files
- `dp-cart-shipping.php` – plugin loader and asset enqueue
- `assets/js/dp-cart-shipping.js` – frontend logic
- `assets/css/dp-cart-shipping.css` – basic styles

## Notes
- Weight is currently hardcoded as `500`. Change in `assets/js/dp-cart-shipping.js` if needed.
- COD handling: we add COD charge if returned by the API (`cod_charge`).
- Works on themes that render standard WooCommerce totals markup.


















