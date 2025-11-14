# 🚚 WooCommerce Shipping Integration Guide

## 📋 Overview
This guide explains how to integrate your existing NimbusPost shipping calculation with WooCommerce so that shipping charges are automatically calculated and displayed when customers enter their pincode.

## 🎯 What This Integration Does
- **Automatic Shipping Calculation**: When customers enter a pincode, shipping charges are calculated using your existing `fetchCourierPartners` API
- **Real-time Rates**: Shows multiple courier options with delivery times and costs
- **Seamless Integration**: Works with existing WooCommerce checkout without breaking anything
- **Vendor-specific**: Each vendor gets their own shipping configuration

## 🚀 Quick Start

### Step 1: Add JavaScript to Your WooCommerce Theme

Add this code to your theme's `functions.php` file or create a custom plugin:

```php
<?php
// Add this to your theme's functions.php or create a plugin

function add_custom_shipping_integration() {
    // Only load on checkout and cart pages
    if (is_checkout() || is_cart()) {
        wp_enqueue_script(
            'woocommerce-shipping-integration',
            get_template_directory_uri() . '/woocommerce-shipping-integration.js',
            array('jquery'),
            '1.0.0',
            true
        );
        
        // Pass configuration to JavaScript
        wp_localize_script('woocommerce-shipping-integration', 'wcShippingConfig', array(
            'apiBaseUrl' => '/api/woocommerce',
            'userId' => get_current_user_id(), // Or get vendor ID from your system
            'storeId' => 1, // Get from your system
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wc_shipping_nonce')
        ));
    }
}
add_action('wp_enqueue_scripts', 'add_custom_shipping_integration');
```

### Step 2: Initialize the Integration

Add this JavaScript code to your theme or create a separate file:

```javascript
// Initialize shipping integration when page loads
document.addEventListener('DOMContentLoaded', function() {
    if (typeof wcShippingConfig !== 'undefined') {
        // Initialize the shipping integration
        const shippingIntegration = new WooCommerceShippingIntegration(wcShippingConfig);
        
        // Store reference globally for debugging
        window.shippingIntegration = shippingIntegration;
        
        console.log('🚀 WooCommerce Shipping Integration initialized');
    }
});
```

## 🔧 Configuration

### Required Configuration
```javascript
const config = {
    apiBaseUrl: '/api/woocommerce',  // Your API endpoint
    userId: 1039,                     // Vendor user ID
    storeId: 1,                       // WooCommerce store ID
    // Optional settings
    autoCalculate: true,              // Auto-calculate on pincode change
    cacheTimeout: 300000,             // Cache timeout in milliseconds (5 minutes)
    debugMode: true                   // Enable console logging
};
```

### API Endpoints
The integration expects these API endpoints:

1. **POST** `/api/woocommerce/shipping/calculate` - Calculate shipping charges
2. **GET** `/api/woocommerce/shipping/status?userId={id}` - Check integration status
3. **GET** `/api/woocommerce/shipping/zones?userId={id}` - Get shipping zones

## 📱 How It Works

### 1. Customer Enters Pincode
```javascript
// When customer types in pincode field
input[name="billing_postcode"] → triggers shipping calculation
```

### 2. API Call to Your Backend
```javascript
POST /api/woocommerce/shipping/calculate
{
    "userId": 1039,
    "postCode": "642126",
    "weight": 500,
    "orderAmount": 550,
    "paymentMode": "prepaid"
}
```

### 3. Your Backend Calls NimbusPost
```javascript
// Your existing function
const courierData = await fetchCourierPartners(
    token, postCode, paymentMode, weight, orderAmount
);
```

### 4. Shipping Options Displayed
```javascript
// Frontend shows multiple courier options
- DTDC Express: ₹120 (3-5 days)
- Blue Dart: ₹150 (2-3 days)
- Professional: ₹80 (5-7 days)
```

## 🎨 Customization

### Custom Shipping Method Display
```javascript
// Override the shipping method HTML
addCustomShippingMethod(option, index) {
    const customHTML = `
        <div class="custom-shipping-option">
            <img src="${option.courier_logo}" alt="${option.courier_name}">
            <span class="courier-name">${option.courier_name}</span>
            <span class="shipping-cost">₹${option.total_cost}</span>
            <span class="delivery-time">${option.delivery_time}</span>
        </div>
    `;
    // ... rest of the method
}
```

### Custom Styling
```css
/* Add to your theme's CSS */
.custom-shipping-method {
    border: 2px solid #0073aa;
    border-radius: 8px;
    padding: 15px;
    margin: 10px 0;
    background: #f8f9fa;
}

.custom-shipping-method:hover {
    border-color: #005a87;
    background: #e9ecef;
}

.courier-name {
    font-weight: bold;
    color: #0073aa;
}

.shipping-cost {
    float: right;
    font-size: 18px;
    font-weight: bold;
    color: #28a745;
}
```

## 🧪 Testing

### Test Page
Use the included `test-shipping.html` file to test the integration:

1. Open `test-shipping.html` in your browser
2. Enter your vendor ID and store details
3. Test with pincode `642126`
4. Verify shipping calculation works

### Browser Console
Check the browser console for integration logs:
```
🚀 WooCommerce Shipping Integration initialized
✅ WooCommerce detected, setup complete
👀 Watching for pincode changes...
📍 Pincode entered: 642126
🚚 Calculating shipping for pincode: 642126
✅ Shipping calculated and updated successfully
```

## 🚨 Troubleshooting

### Common Issues

#### 1. "No available delivery option" Still Shows
**Problem**: WooCommerce default shipping methods are overriding custom ones
**Solution**: Ensure your shipping method is properly configured in WooCommerce admin

#### 2. Shipping Not Calculating
**Problem**: API calls failing
**Solution**: Check browser console and network tab for errors

#### 3. Shipping Methods Not Displaying
**Problem**: JavaScript not loading or WooCommerce not detected
**Solution**: Verify script is loaded and WooCommerce is available

### Debug Mode
Enable debug mode to see detailed logs:
```javascript
const config = {
    // ... other config
    debugMode: true
};
```

### Check API Response
Verify your API is returning the correct format:
```json
{
    "success": true,
    "data": {
        "shipping_options": [
            {
                "courier_id": "dtdc",
                "courier_name": "DTDC Express",
                "shipping_cost": 120,
                "cod_charge": 0,
                "total_cost": 120,
                "delivery_time": "3-5 days"
            }
        ]
    }
}
```

## 🔒 Security Considerations

### API Protection
- Use authentication for your shipping API
- Validate user permissions
- Rate limit API calls
- Sanitize input data

### WooCommerce Security
- Use nonces for AJAX requests
- Validate user capabilities
- Sanitize output data

## 📊 Performance Optimization

### Caching
- Shipping calculations are cached for 5 minutes
- Reduces API calls for repeated pincodes
- Improves checkout experience

### Lazy Loading
- Shipping calculation only triggers when needed
- No unnecessary API calls on page load
- Efficient resource usage

## 🚀 Advanced Features

### Multiple Payment Modes
```javascript
// Support for COD and prepaid
const paymentMode = document.querySelector('input[name="payment_method"]:checked')?.value || 'prepaid';
```

### Weight Calculation
```javascript
// Calculate weight from cart items
const totalWeight = cartItems.reduce((sum, item) => sum + (item.weight * item.quantity), 0);
```

### Real-time Updates
```javascript
// Update shipping when cart changes
jQuery(document.body).on('updated_cart_totals', () => {
    // Recalculate shipping if pincode is entered
});
```

## 📞 Support

If you encounter issues:

1. **Check Browser Console** for JavaScript errors
2. **Verify API Endpoints** are working
3. **Test with Postman** to isolate backend issues
4. **Check WooCommerce Logs** for any conflicts

## 🎉 Success Indicators

When everything is working correctly, you should see:

✅ **Checkout Page**: Shipping options appear when pincode is entered
✅ **Multiple Couriers**: Different shipping options with costs and delivery times
✅ **Real-time Calculation**: Shipping updates automatically
✅ **Seamless Integration**: No conflicts with existing WooCommerce functionality
✅ **Vendor-specific**: Each vendor gets their own shipping configuration

---

**Happy Shipping! 🚚✨**
