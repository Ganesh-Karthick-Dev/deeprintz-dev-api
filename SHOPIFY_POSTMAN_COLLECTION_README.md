# Shopify Integration - Complete Postman Collection

## Overview

This Postman collection provides comprehensive testing coverage for the Shopify integration, including OAuth setup, product management, order handling, shipping calculations, and webhook processing.

## 🚀 Quick Start

### 1. Import the Collection
- Open Postman
- Click "Import" button
- Select "File"
- Choose `Shopify_Postman_Collection.json`

### 2. Set Environment Variables

Create a new environment in Postman and set these variables:

| Variable | Description | Example Value |
|----------|-------------|---------------|
| `base_url` | Your API base URL | `https://devapi.deeprintz.com` |
| `shop_domain` | Your Shopify store domain | `your-store.myshopify.com` |
| `user_id` | User ID for testing | `123` |
| `shopify_access_token` | Shopify access token (obtained after OAuth) | `shpat_xxxxxxxxxxxxxxxxxxxxxxxx` |
| `product_id` | Shopify product ID (auto-set by tests) | Auto-populated |
| `order_id` | Order ID for testing (auto-set by tests) | Auto-populated |

## 📋 Collection Structure

### 1. AUTHENTICATION & SETUP
- **Install Shopify App (OAuth)**: Initiates OAuth flow
- **Test Store Connection**: Verifies connection status
- **Get Connection Status**: Retrieves current connection info
- **Get Store Statistics**: Gets detailed store information
- **Disconnect Store**: Removes store connection

### 2. PRODUCT MANAGEMENT
- **Get Products**: Retrieves products from store
- **Create Product (Simple/Variants)**: Creates products in Shopify
- **Update Product**: Modifies existing products
- **Delete Product**: Removes products from Shopify
- **Bulk Create Products**: Creates multiple products at once
- **Resync Product Inventory**: Updates inventory across locations

### 3. ORDER MANAGEMENT
- **Get Orders**: Retrieves order list
- **Get Order by ID**: Fetches specific order details

### 4. SHIPPING & CARRIER SERVICES
- **Calculate Shipping Rates**: Computes shipping costs
- **Register Carrier Service**: Sets up shipping integration
- **List Carrier Services**: Shows registered carriers

### 5. WEBHOOKS & AUTOMATION
- **Register Order Webhooks**: Sets up webhook endpoints
- **Simulate Order Create Webhook**: Tests order webhook handling
- **Simulate Shipping Webhook**: Tests shipping webhook processing

### 6. DIRECT SHOPIFY API CALLS
- **Get Shop Info**: Direct Shopify API calls
- **Get Products**: Direct product retrieval
- **Get Orders**: Direct order retrieval
- **Get Locations**: Direct location information

### 7. ERROR TESTING & EDGE CASES
- Tests for invalid inputs and error conditions

## 🔄 Testing Workflow

### Initial Setup (Do this first)
1. **Install Shopify App (OAuth)**
   - This redirects to Shopify for permission approval
   - Complete OAuth flow in browser
   - Copy the access token from the success redirect

2. **Set Access Token**
   - Update `shopify_access_token` environment variable
   - Run "Test Store Connection" to verify setup

### Product Testing
1. **Create Product**: Test product creation from local database
2. **Get Products**: Verify products appear in Shopify
3. **Update Product**: Test product modifications
4. **Resync Inventory**: Test inventory synchronization

### Order Testing
1. **Get Orders**: Check existing orders
2. **Simulate Webhook**: Test webhook processing

### Shipping Testing
1. **Calculate Shipping**: Test rate calculations
2. **Register Carrier Service**: Setup shipping integration

## 🔧 Test Scripts

The collection includes automatic test scripts that:
- Check response times (< 30 seconds)
- Validate JSON structure
- Auto-populate variables (product_id, order_id)
- Verify success/error responses

## ⚠️ Important Notes

### Authentication
- OAuth flow must be completed before most operations
- Access tokens expire; re-run OAuth if needed
- Test with valid Shopify store credentials

### Rate Limits
- Shopify has API rate limits (40 requests per minute for REST API)
- GraphQL has different limits (1000 points per minute)
- Collection includes delays between requests

### Webhook Testing
- Webhooks require valid HMAC signatures
- Test webhooks will show signature validation warnings (expected)
- Use ngrok or similar for local webhook testing

### Error Testing
- Error cases are included for comprehensive testing
- Expect some failures for invalid inputs (this is normal)

## 🐛 Troubleshooting

### Common Issues

1. **"Invalid shop domain"**
   - Ensure shop domain includes `.myshopify.com`
   - Check spelling and format

2. **"No connected store found"**
   - Complete OAuth flow first
   - Verify user_id matches the one used in OAuth

3. **"Access token expired"**
   - Re-run OAuth installation
   - Update access token in environment

4. **Webhook signature errors**
   - Expected in test environment
   - Use proper HMAC for production

5. **Rate limit exceeded**
   - Wait 1-2 minutes between requests
   - Check Shopify admin for rate limit status

### Debug Steps

1. Check environment variables are set correctly
2. Verify API endpoints match your server configuration
3. Check server logs for detailed error messages
4. Test with a simple request first (like "Test Store Connection")

## 📊 Response Examples

### Successful Product Creation
```json
{
    "success": true,
    "message": "Product created in Shopify successfully with automatic shipping setup!",
    "data": {
        "product": {
            "id": "gid://shopify/Product/123456789",
            "title": "Test Product",
            "status": "ACTIVE"
        },
        "original_product": {...},
        "has_variations": true,
        "shipping_configured": true
    }
}
```

### Shipping Calculation Response
```json
{
    "success": true,
    "message": "Shipping rates calculated successfully",
    "data": {
        "shipping_options": [
            {
                "service_name": "Standard Shipping",
                "service_code": "STD",
                "total_price": "0.00",
                "currency": "INR",
                "estimated_delivery": "3-5 business days"
            }
        ]
    }
}
```

## 🚀 Production Deployment

Before production use:
1. Update `base_url` to production URL
2. Change environment to 'live' in config
3. Test all endpoints thoroughly
4. Monitor rate limits and error logs
5. Setup proper webhook endpoints

## 📞 Support

For issues with this collection:
1. Check the troubleshooting section above
2. Review server logs for detailed errors
3. Test individual requests to isolate problems
4. Verify all environment variables are correct

---

**Collection Version**: 1.0
**Last Updated**: November 2025
**Shopify API Version**: 2024-10

