# 🚚 WooCommerce Shipping Integration Setup Guide

This guide will help you set up the WooCommerce shipping integration that automatically calculates shipping rates and integrates with your WooCommerce checkout process.

## 📋 Prerequisites

- Node.js (v14 or higher)
- WooCommerce store with REST API access
- Your existing shipping calculation service
- Basic knowledge of WooCommerce configuration

## 🔧 Installation Steps

### 1. Environment Configuration

Create a `.env` file in your project root with the following variables:

```bash
# WooCommerce Configuration
WOOCOMMERCE_STORE_URL=https://your-store.com
WOOCOMMERCE_CONSUMER_KEY=your_consumer_key_here
WOOCOMMERCE_CONSUMER_SECRET=your_consumer_secret_here
WOOCOMMERCE_WEBHOOK_SECRET=your_webhook_secret_here

# API Configuration
API_BASE_URL=http://localhost:6996
API_TOKEN=your_api_token_here

# Environment
NODE_ENV=development

# Session Secret
SESSION_SECRET=your_session_secret_here
```

### 2. WooCommerce API Setup

1. **Generate API Keys:**
   - Go to WooCommerce → Settings → Advanced → REST API
   - Click "Add Key"
   - Set Description: "Shipping Integration"
   - Set Permissions: "Read/Write"
   - Click "Generate API Key"
   - Copy the Consumer Key and Consumer Secret

2. **Configure Webhooks:**
   - Go to WooCommerce → Settings → Advanced → Webhooks
   - The integration will automatically create these webhooks:
     - `order.created` - Triggers when a new order is created
     - `order.updated` - Triggers when an order is updated
     - `checkout.created` - Triggers when checkout is created

### 3. Start the Server

```bash
npm start
```

The server will start on port 6996 with the following endpoints:

## 🌐 API Endpoints

### Shipping Calculation
- **POST** `/api/woocommerce/shipping/calculate`
  - Calculates shipping rates for a given pincode and order details

### Order Management
- **POST** `/api/woocommerce/shipping/update-order`
  - Updates order shipping information

### Webhook Management
- **POST** `/api/woocommerce/webhooks/setup`
  - Sets up WooCommerce webhooks
- **GET** `/api/woocommerce/webhooks/list`
  - Lists configured webhooks
- **DELETE** `/api/woocommerce/webhooks/:webhookId`
  - Deletes a specific webhook

### Connection Testing
- **POST** `/api/woocommerce/test-connection`
  - Tests WooCommerce connection
- **GET** `/api/woocommerce/shipping/zones`
  - Gets shipping zones
- **POST** `/api/woocommerce/shipping/methods`
  - Creates shipping methods

### Webhook Endpoints
- **POST** `/api/woocommerce/webhooks/order-created`
- **POST** `/api/woocommerce/webhooks/order-updated`
- **POST** `/api/woocommerce/webhooks/checkout-created`

## 🧪 Testing the Integration

### 1. Test Page
Open `test-woocommerce-shipping.html` in your browser to test all endpoints.

### 2. Manual Testing
Use the test page to:
- Test WooCommerce connection
- Calculate shipping rates
- Setup webhooks
- Test order shipping updates

### 3. API Testing with cURL

```bash
# Test connection
curl -X POST http://localhost:6996/api/woocommerce/test-connection \
  -H "Content-Type: application/json" \
  -d '{"userId": "test_user"}'

# Calculate shipping
curl -X POST http://localhost:6996/api/woocommerce/shipping/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user",
    "postCode": "110001",
    "weight": 500,
    "orderAmount": 1000,
    "paymentMode": "prepaid",
    "items": []
  }'
```

## 🔄 How It Works

### 1. Shipping Calculation Flow
1. Customer enters pincode on WooCommerce checkout
2. JavaScript calls `/api/woocommerce/shipping/calculate`
3. Service calculates shipping rates using your existing API
4. Rates are formatted for WooCommerce
5. Shipping options appear on checkout page

### 2. Webhook Processing
1. WooCommerce sends webhook when order is created
2. Your server receives webhook at `/api/woocommerce/webhooks/order-created`
3. Service automatically calculates shipping if not set
4. Order is updated with shipping information

### 3. Real-time Integration
- Shipping rates update automatically when pincode changes
- Cart updates trigger shipping recalculation
- Selected shipping method updates order totals

## 🎨 Frontend Integration

### 1. Include CSS
Add this to your WooCommerce theme:

```html
<link rel="stylesheet" href="/path/to/woocommerce-shipping-styles.css">
```

### 2. Include JavaScript
Add this to your WooCommerce theme:

```html
<script src="/path/to/woocommerce-shipping-integration.js"></script>
```

### 3. Initialize Integration
```javascript
// Configuration
const config = {
  apiBaseUrl: '/api/woocommerce',
  userId: 'YOUR_VENDOR_ID',
  storeId: 'YOUR_STORE_ID'
};

// Initialize
window.wooShippingIntegration = new WooCommerceShippingIntegration(config);
```

## 🚨 Troubleshooting

### Common Issues

1. **Connection Failed**
   - Check WooCommerce API keys
   - Verify store URL is correct
   - Ensure WooCommerce REST API is enabled

2. **Shipping Not Calculating**
   - Check browser console for errors
   - Verify API endpoints are accessible
   - Check network tab for failed requests

3. **Webhooks Not Working**
   - Verify webhook URLs are accessible
   - Check WooCommerce webhook settings
   - Ensure proper permissions on API keys

4. **CORS Issues**
   - Check CORS configuration in your server
   - Verify domain settings

### Debug Mode

Enable debug logging by setting:

```bash
NODE_ENV=development
```

Check server console for detailed logs.

## 🔒 Security Considerations

1. **API Keys**: Keep WooCommerce API keys secure
2. **Webhook Validation**: Webhook signatures are validated
3. **Rate Limiting**: Consider implementing rate limiting
4. **HTTPS**: Use HTTPS in production

## 📱 Responsive Design

The integration includes:
- Mobile-friendly shipping calculator
- Responsive shipping option cards
- Touch-friendly buttons and inputs
- Dark mode support
- Print-friendly styles

## 🚀 Production Deployment

1. **Environment Variables**: Set production values
2. **HTTPS**: Enable HTTPS for webhooks
3. **Monitoring**: Set up logging and monitoring
4. **Backup**: Backup WooCommerce data before testing
5. **Testing**: Test thoroughly in staging environment

## 📞 Support

If you encounter issues:

1. Check the server logs
2. Verify all environment variables are set
3. Test individual API endpoints
4. Check WooCommerce settings
5. Review browser console for errors

## 🔄 Updates

To update the integration:

1. Pull latest code
2. Restart the server
3. Test all endpoints
4. Verify webhook functionality

---

**Note**: This integration requires your existing shipping calculation service to be running and accessible. Make sure to update the `API_BASE_URL` and `API_TOKEN` in your environment configuration.
