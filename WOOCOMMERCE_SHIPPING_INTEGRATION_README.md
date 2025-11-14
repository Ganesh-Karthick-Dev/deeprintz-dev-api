# WooCommerce Shipping Integration with Courier Partners

This integration allows you to use your existing `fetchCourierPartners` shipping calculation function with WooCommerce stores. Customers can now see real-time shipping rates from multiple courier partners directly on your WooCommerce frontend.

## 🚀 Features

- **Real-time shipping calculation** using your existing courier partner APIs
- **Multiple courier options** displayed to customers
- **Automatic pincode validation** and shipping rate fetching
- **WooCommerce integration** for cart and checkout pages
- **Responsive design** that works on all devices
- **Caching system** to improve performance
- **Error handling** and user-friendly messages

## 📋 Prerequisites

1. **WooCommerce store** connected via the existing API
2. **NimbusPost API token** configured in vendor settings
3. **Existing `fetchCourierPartners` function** working in your order controller
4. **Database tables** for storing shipping calculations (optional)

## 🔧 Installation

### 1. Backend API Setup

The shipping integration APIs are already added to your WooCommerce controller. The following endpoints are now available:

- `POST /api/woocommerce/shipping/setup` - Setup shipping zones and methods
- `POST /api/woocommerce/shipping/calculate` - Calculate shipping charges
- `GET /api/woocommerce/shipping/rates/:postcode` - Get shipping rates for a postcode
- `GET /api/woocommerce/shipping/zones` - Get WooCommerce shipping zones

### 2. Frontend Integration

#### Option A: Add to Your WooCommerce Theme

1. **Copy the JavaScript file** to your theme:
   ```bash
   cp public/woocommerce-shipping-integration.js wp-content/themes/your-theme/js/
   ```

2. **Copy the CSS file** to your theme:
   ```bash
   cp public/woocommerce-shipping-styles.css wp-content/themes/your-theme/css/
   ```

3. **Enqueue the files** in your theme's `functions.php`:
   ```php
   function enqueue_woocommerce_shipping_integration() {
       if (is_woocommerce() || is_cart() || is_checkout()) {
           wp_enqueue_script(
               'woocommerce-shipping-integration',
               get_template_directory_uri() . '/js/woocommerce-shipping-integration.js',
               array('jquery'),
               '1.0.0',
               true
           );
           
           wp_enqueue_style(
               'woocommerce-shipping-styles',
               get_template_directory_uri() . '/css/woocommerce-shipping-styles.css',
               array(),
               '1.0.0'
           );
           
           // Pass configuration to JavaScript
           wp_localize_script('woocommerce-shipping-integration', 'wooShippingConfig', array(
               'apiBaseUrl' => '/api/woocommerce',
               'userId' => get_current_user_id(), // Or your vendor ID logic
               'storeId' => 'your_store_id'
           ));
       }
   }
   add_action('wp_enqueue_scripts', 'enqueue_woocommerce_shipping_integration');
   ```

#### Option B: Add via Plugin

1. **Create a custom plugin** and include the JavaScript and CSS files
2. **Use WordPress hooks** to enqueue the files only on WooCommerce pages

#### Option C: Add via Code Snippets Plugin

1. **Install Code Snippets plugin**
2. **Add the JavaScript code** as a snippet
3. **Add the CSS code** as another snippet
4. **Set execution** to run on WooCommerce pages

### 3. Configuration

Update the configuration in the JavaScript file:

```javascript
const config = {
    apiBaseUrl: '/api/woocommerce', // Your API base URL
    userId: 'YOUR_VENDOR_ID',        // Replace with actual vendor ID
    storeId: 'YOUR_STORE_ID'         // Replace with actual store ID
};
```

## 🎯 Usage

### 1. Setup Shipping Zones

First, setup the shipping zones in WooCommerce:

```javascript
// Call this once to setup shipping zones
fetch('/api/woocommerce/shipping/setup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: 'your_vendor_id' })
});
```

### 2. Automatic Integration

Once installed, the integration will:

- **Automatically detect** WooCommerce pages (cart, checkout)
- **Add a shipping calculator** to cart and checkout pages
- **Calculate shipping** when customers enter their pincode
- **Display multiple courier options** with prices and delivery times
- **Allow customers to select** their preferred shipping method

### 3. Manual Integration

You can also manually trigger shipping calculations:

```javascript
// Calculate shipping for a specific postcode
const shippingData = await wooShippingIntegration.calculateShipping('641603', 500, 1000);

// Get shipping rates for a postcode
const rates = await wooShippingIntegration.getShippingRates('641603', 500, 1000);
```

## 🔌 API Endpoints

### Calculate Shipping
```http
POST /api/woocommerce/shipping/calculate
Content-Type: application/json

{
    "userId": "vendor_id",
    "postCode": "641603",
    "weight": 500,
    "orderAmount": 1000,
    "paymentMode": "prepaid",
    "items": [
        {
            "name": "Product Name",
            "quantity": 2,
            "weight": 250
        }
    ]
}
```

### Get Shipping Rates
```http
GET /api/woocommerce/shipping/rates/641603?userId=vendor_id&weight=500&orderAmount=1000
```

### Setup Shipping
```http
POST /api/woocommerce/shipping/setup
Content-Type: application/json

{
    "userId": "vendor_id"
}
```

## 📱 Frontend Features

### Shipping Calculator
- **Pincode input** with validation
- **Real-time calculation** as user types
- **Multiple courier options** displayed
- **Price comparison** (cheapest first)
- **Delivery time estimates**
- **Courier logos** (if available)

### Integration Points
- **Cart page** - Shipping calculator above cart totals
- **Checkout page** - Automatic calculation on pincode change
- **Responsive design** - Works on mobile and desktop
- **WooCommerce hooks** - Integrates with existing functionality

## 🎨 Customization

### Styling
The CSS file includes comprehensive styling that can be customized:

```css
/* Custom colors */
#custom-shipping-calculator {
    background: #your-color;
    border-color: #your-border-color;
}

/* Custom button styles */
.select-shipping-btn {
    background: #your-button-color;
}
```

### Functionality
Extend the JavaScript class to add custom features:

```javascript
class CustomWooCommerceShipping extends WooCommerceShippingIntegration {
    constructor(config) {
        super(config);
        this.customFeature();
    }
    
    customFeature() {
        // Add your custom functionality
    }
}
```

## 🚨 Troubleshooting

### Common Issues

1. **Shipping not calculating**
   - Check if `fetchCourierPartners` function is working
   - Verify NimbusPost API token is configured
   - Check browser console for errors

2. **API endpoints not found**
   - Ensure routes are properly added to `routes/woocommerce/index.js`
   - Check if WooCommerce controller is loaded

3. **Styling not applied**
   - Verify CSS file is enqueued
   - Check if theme CSS is overriding styles
   - Use browser dev tools to inspect elements

4. **JavaScript errors**
   - Check browser console for errors
   - Verify jQuery is loaded before the script
   - Ensure configuration values are correct

### Debug Mode

Enable debug mode in the JavaScript:

```javascript
window.wooShippingIntegration.debug = true;
```

This will log detailed information to the console.

## 📊 Database Tables

The integration optionally uses these tables (create if needed):

### woocommerce_shipping_methods
```sql
CREATE TABLE woocommerce_shipping_methods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    zone_id INT NOT NULL,
    method_id INT NOT NULL,
    method_type VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### woocommerce_shipping_calculations
```sql
CREATE TABLE woocommerce_shipping_calculations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    user_id INT NOT NULL,
    post_code VARCHAR(10) NOT NULL,
    weight INT NOT NULL,
    order_amount DECIMAL(10,2),
    payment_mode VARCHAR(20),
    shipping_options TEXT,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 🔒 Security Considerations

1. **API Rate Limiting** - Implement rate limiting for shipping calculations
2. **Input Validation** - Validate all user inputs (postcode, weight, etc.)
3. **Authentication** - Ensure only authenticated users can access APIs
4. **CORS** - Configure CORS if frontend and backend are on different domains

## 📈 Performance Optimization

1. **Caching** - Shipping calculations are cached for 5 minutes
2. **Debouncing** - Pincode input is debounced to reduce API calls
3. **Lazy Loading** - Shipping calculator only loads on WooCommerce pages
4. **Minification** - Minify CSS and JavaScript for production

## 🤝 Support

For issues or questions:

1. **Check the troubleshooting section** above
2. **Review browser console** for JavaScript errors
3. **Verify API endpoints** are working with Postman/curl
4. **Check database connections** and table structures

## 📝 Changelog

### Version 1.0.0
- Initial release
- WooCommerce shipping integration
- Real-time courier partner rates
- Responsive design
- Cart and checkout integration

## 📄 License

This integration is part of your existing system and follows the same licensing terms.

---

**Note**: This integration uses your existing `fetchCourierPartners` function and database structure. Make sure all dependencies are properly configured before testing.
