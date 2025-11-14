# Shopify Shipping Integration with WooCommerce API

This integration allows you to use your existing WooCommerce shipping calculation API (`calculateWooCommerceShipping`) with Shopify stores. When users enter a pincode on Shopify checkout, it calculates shipping prices using your WooCommerce API and displays them on the Shopify checkout page.

## Overview

The integration consists of several components:

1. **ShopifyShippingService** - Service that calls your WooCommerce API and formats responses for Shopify
2. **ModernShopifyController** - Controller with shipping calculation endpoints
3. **Shopify App Script** - JavaScript that runs on Shopify stores to provide shipping calculation UI
4. **Routes** - API endpoints for shipping calculation

## How It Works

1. **Product Push**: When you push products to Shopify, they are created with shipping calculation capability
2. **User Interaction**: Customer enters pincode on Shopify checkout/cart page
3. **API Call**: JavaScript calls your shipping calculation API with pincode and cart data
4. **Shipping Options**: API returns shipping options from your WooCommerce courier partners
5. **Display**: Options are displayed to customer with prices and delivery estimates
6. **Selection**: Customer can select preferred shipping option

## API Endpoints

### Calculate Shipping
```
POST /api/shopify/shipping/calculate
```

**Request Body:**
```json
{
  "userId": "123",
  "shopDomain": "mystore.myshopify.com",
  "postCode": "110001",
  "weight": 500,
  "orderAmount": 1000,
  "paymentMode": "prepaid",
  "items": [
    {
      "id": "product_1",
      "name": "Product Name",
      "weight": 250,
      "price": 500,
      "quantity": 2
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "message": "Shipping rates calculated successfully",
  "data": {
    "shipping_options": [
      {
        "courier_name": "Blue Dart",
        "courier_id": "bluedart",
        "shipping_cost": 15000,
        "estimated_delivery": "2-3 days",
        "cod_charge": 0
      }
    ],
    "calculation_time": "2024-01-15T10:30:00.000Z",
    "postcode": "110001",
    "weight": 500,
    "order_amount": 1000
  }
}
```

### Shipping Webhook
```
POST /api/shopify/shipping/webhook
```

Handles Shopify's shipping calculation webhooks for real-time checkout integration.

## Implementation Steps

### 1. Install the Integration

Add the shipping calculation script to your Shopify store:

```html
<!-- Add to your Shopify theme's checkout.liquid or cart.liquid -->
<script>
  window.shopifyShippingConfig = {
    apiBaseUrl: 'https://devdevapi.deeprintz.com/api',
    userId: 'YOUR_USER_ID',
    shopDomain: 'YOUR_SHOP_DOMAIN'
  };
</script>
<script src="https://devdevapi.deeprintz.com/public/shopify-app-script.js"></script>
```

### 2. Configure Meta Tags

Add these meta tags to your Shopify theme:

```html
<meta name="deeprintz-user-id" content="YOUR_USER_ID">
<meta name="shopify-shop-domain" content="YOUR_SHOP_DOMAIN">
```

### 3. Test the Integration

1. Push a product to Shopify using your existing `pushProductsToWooCommerce` API
2. Visit the product page on your Shopify store
3. Add product to cart
4. Go to checkout
5. Enter a pincode in the shipping calculator
6. Verify shipping options are displayed

## Features

### Automatic Detection
- Detects checkout, cart, and product pages automatically
- Shows appropriate shipping calculator for each page type

### Real-time Calculation
- Calculates shipping as user types pincode
- Caches results for better performance
- Shows loading states and error handling

### Multiple Courier Options
- Displays all available courier partners
- Shows delivery estimates and COD charges
- Allows customer to select preferred option

### Responsive Design
- Works on desktop and mobile devices
- Integrates seamlessly with Shopify themes
- Customizable styling

## Customization

### Styling
The integration includes default styles that can be customized by overriding CSS classes:

```css
.deeprintz-shipping-calculator {
  /* Custom styles */
}

.shipping-option {
  /* Custom option styles */
}
```

### Configuration
You can customize the behavior by modifying the configuration:

```javascript
window.shopifyShippingConfig = {
  apiBaseUrl: 'https://your-api.com/api',
  userId: 'your_user_id',
  shopDomain: 'your-shop.myshopify.com',
  debug: true, // Enable debug logging
  autoCalculate: true, // Auto-calculate on 6-digit pincode
  cacheTimeout: 300000 // Cache timeout in milliseconds
};
```

## Error Handling

The integration handles various error scenarios:

- Invalid pincode format
- API connection errors
- No shipping options available
- Network timeouts

Error messages are displayed to users in a user-friendly format.

## Performance Optimization

- **Caching**: Results are cached to avoid repeated API calls
- **Debouncing**: Input is debounced to prevent excessive API calls
- **Lazy Loading**: Script only loads when needed
- **Minimal DOM**: Lightweight DOM manipulation

## Security

- API calls are made from the client-side (browser)
- No sensitive data is stored in the browser
- User ID and shop domain are required for API calls
- CORS is properly configured for cross-origin requests

## Troubleshooting

### Common Issues

1. **Shipping options not showing**
   - Check if pincode is valid (6 digits)
   - Verify API endpoint is accessible
   - Check browser console for errors

2. **API errors**
   - Verify userId and shopDomain are correct
   - Check API base URL is accessible
   - Ensure WooCommerce shipping API is working

3. **Styling issues**
   - Check if CSS is loading properly
   - Verify theme compatibility
   - Override styles if needed

### Debug Mode

Enable debug mode to see detailed logging:

```javascript
window.shopifyShippingConfig = {
  debug: true
};
```

## Support

For issues or questions:
1. Check browser console for error messages
2. Verify API endpoints are working
3. Test with different pincodes
4. Check network requests in browser dev tools

## Future Enhancements

Potential improvements:
- Integration with Shopify's native shipping API
- Support for international shipping
- Advanced caching strategies
- Analytics and reporting
- Multi-language support
