# WooCommerce Webhook Setup Guide for Shipping Calculation

This guide explains how to set up WooCommerce webhooks to automatically trigger shipping calculations when various events occur in your store.

## 🎯 What Webhooks Do

Webhooks automatically notify your system when specific events happen in WooCommerce, such as:
- **Order creation/updates** - Trigger shipping calculation
- **Cart changes** - Recalculate shipping rates
- **Product updates** - Update shipping weights
- **Customer changes** - Update shipping addresses

## 🔧 Backend Setup (Already Done)

The following webhook endpoints are already configured in your system:

### 1. Webhook Management APIs
- `POST /api/woocommerce/webhooks/setup` - Setup all webhooks
- `GET /api/woocommerce/webhooks/list` - List configured webhooks
- `DELETE /api/woocommerce/webhooks/:id` - Delete specific webhook

### 2. Shipping Webhook API
- `POST /api/woocommerce/shipping/webhook` - Handle shipping calculation requests

### 3. Database Tables
The following tables are created to manage webhooks:
- `woocommerce_webhooks` - Webhook configurations
- `woocommerce_shipping_calculations` - Shipping calculation history
- `woocommerce_webhook_logs` - Webhook delivery logs
- `woocommerce_shipping_methods` - Shipping method configurations

## 🚀 Frontend Setup

### 1. Enhanced JavaScript Integration

The JavaScript file now includes webhook functionality:

```javascript
// Initialize with webhook support
window.wooShippingIntegration.enhancedInit().then(() => {
  console.log('Webhooks configured successfully');
});

// Manual webhook management
await wooShippingIntegration.setupWebhooks();
await wooShippingIntegration.listWebhooks();
await wooShippingIntegration.deleteWebhook(webhookId);
```

### 2. Automatic Event Handling

The system automatically handles these WooCommerce events:
- **Cart updates** - Recalculates shipping when items added/removed
- **Checkout changes** - Updates shipping when postcode changes
- **Product variations** - Adjusts shipping based on product weight
- **Address changes** - Triggers shipping calculation for new addresses

## 📋 Webhook Configuration

### 1. Setup All Webhooks

```javascript
// Setup all webhooks at once
const setupWebhooks = async () => {
  try {
    const response = await fetch('/api/woocommerce/webhooks/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'your_vendor_id' })
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Webhooks setup completed:', result.data);
    }
  } catch (error) {
    console.error('Webhook setup failed:', error);
  }
};
```

### 2. List Configured Webhooks

```javascript
// List all webhooks
const listWebhooks = async () => {
  try {
    const response = await fetch('/api/woocommerce/webhooks/list?userId=your_vendor_id');
    const result = await response.json();
    if (result.success) {
      console.log('Webhooks:', result.data.webhooks);
    }
  } catch (error) {
    console.error('Failed to list webhooks:', error);
  }
};
```

### 3. Delete Specific Webhook

```javascript
// Delete a webhook
const deleteWebhook = async (webhookId) => {
  try {
    const response = await fetch(`/api/woocommerce/webhooks/${webhookId}?userId=your_vendor_id`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    if (result.success) {
      console.log('Webhook deleted successfully');
    }
  } catch (error) {
    console.error('Failed to delete webhook:', error);
  }
};
```

## 🔄 Webhook Events Handled

### 1. Order Events
- **`order.created`** - New order placed
- **`order.updated`** - Order status/address changed
- **`order.deleted`** - Order removed

### 2. Product Events
- **`product.created`** - New product added
- **`product.updated`** - Product details changed
- **`product.deleted`** - Product removed

### 3. Customer Events
- **`customer.created`** - New customer registered
- **`customer.updated`** - Customer details changed
- **`customer.deleted`** - Customer removed

## 📱 Automatic Shipping Calculation

### 1. Cart Updates
When items are added/removed from cart:
```javascript
// Automatically triggered
jQuery(document.body).on('added_to_cart', handleCartItemAdded);
jQuery(document.body).on('removed_from_cart', handleCartItemRemoved);
```

### 2. Checkout Changes
When postcode or address changes:
```javascript
// Automatically triggered
jQuery(document.body).on('change', 'input[name="billing_postcode"]', handlePostcodeChange);
jQuery(document.body).on('change', 'input[name="shipping_postcode"]', handleShippingPostcodeChange);
```

### 3. Product Variations
When product options change:
```javascript
// Automatically triggered
jQuery(document.body).on('found_variation', handleProductVariationChange);
jQuery(document.body).on('reset_image', handleProductVariationReset);
```

## 🎨 Customization Options

### 1. Custom Webhook Topics
Add custom webhook topics in the controller:
```javascript
const customWebhooks = [
  {
    name: "Custom Event",
    topic: "custom.event",
    delivery_url: "your_custom_endpoint",
    status: "active"
  }
];
```

### 2. Custom Event Handlers
Extend the event handling:
```javascript
class CustomWooCommerceShipping extends WooCommerceShippingIntegration {
  setupCustomEventListeners() {
    // Add your custom event listeners
    jQuery(document.body).on('custom_event', this.handleCustomEvent.bind(this));
  }
  
  handleCustomEvent(event, data) {
    // Handle custom event
    console.log('Custom event triggered:', data);
  }
}
```

### 3. Custom Shipping Logic
Modify shipping calculation behavior:
```javascript
async customShippingCalculation(postcode, weight, orderAmount) {
  // Your custom shipping logic
  const customRates = await this.calculateCustomRates(postcode, weight);
  return this.formatCustomShippingOptions(customRates);
}
```

## 🔒 Security Considerations

### 1. Webhook Secrets
Each webhook has a unique secret for verification:
```javascript
// Webhook secret is automatically generated
const webhookData = {
  name: "Order Created",
  topic: "order.created",
  delivery_url: "your_endpoint",
  secret: crypto.randomBytes(32).toString('hex') // Auto-generated
};
```

### 2. Authentication
Webhooks are authenticated via:
- **User ID validation** - Only authorized vendors can setup webhooks
- **Store verification** - Webhooks are tied to specific stores
- **Secret verification** - Each webhook has a unique secret

### 3. Rate Limiting
Consider implementing rate limiting:
```javascript
// Example rate limiting
const rateLimiter = {
  maxRequests: 100,
  timeWindow: 60000, // 1 minute
  checkLimit: (userId) => { /* implementation */ }
};
```

## 📊 Monitoring and Debugging

### 1. Webhook Logs
All webhook deliveries are logged:
```sql
SELECT * FROM woocommerce_webhook_logs 
WHERE webhook_id = ? 
ORDER BY created_at DESC;
```

### 2. Shipping Calculation History
Track all shipping calculations:
```sql
SELECT * FROM woocommerce_shipping_calculations 
WHERE store_id = ? 
ORDER BY calculated_at DESC;
```

### 3. Debug Mode
Enable debug logging:
```javascript
// Enable debug mode
window.wooShippingIntegration.debug = true;

// Check webhook status
const webhooks = await wooShippingIntegration.listWebhooks();
console.log('Active webhooks:', webhooks.filter(w => w.status === 'active'));
```

## 🚨 Troubleshooting

### 1. Webhooks Not Working
- Check if webhooks are properly configured
- Verify delivery URLs are accessible
- Check webhook status in WooCommerce admin
- Review webhook logs for errors

### 2. Shipping Not Calculating
- Ensure NimbusPost API token is configured
- Check if `fetchCourierPartners` function is working
- Verify postcode format and validation
- Check browser console for JavaScript errors

### 3. Performance Issues
- Implement caching for shipping calculations
- Use debouncing for postcode input
- Monitor webhook delivery times
- Optimize database queries

## 📈 Best Practices

### 1. Webhook Management
- **Setup webhooks once** during store initialization
- **Monitor webhook health** regularly
- **Clean up unused webhooks** to avoid clutter
- **Use descriptive names** for easy identification

### 2. Shipping Calculation
- **Cache results** to reduce API calls
- **Validate inputs** before calculation
- **Handle errors gracefully** with fallbacks
- **Log all calculations** for analytics

### 3. Event Handling
- **Use event delegation** for dynamic content
- **Debounce frequent events** like postcode input
- **Prioritize critical events** like checkout
- **Test all event scenarios** thoroughly

## 🔄 Migration from Manual to Webhook

### 1. Phase 1: Setup Webhooks
```javascript
// Setup webhooks without affecting existing functionality
await wooShippingIntegration.setupWebhooks();
```

### 2. Phase 2: Enable Automatic Calculation
```javascript
// Enable automatic shipping calculation
wooShippingIntegration.enableAutomaticCalculation = true;
```

### 3. Phase 3: Remove Manual Triggers
```javascript
// Gradually remove manual shipping calculation calls
// The system will handle everything automatically
```

## 📞 Support and Maintenance

### 1. Regular Checks
- Monitor webhook delivery success rates
- Review shipping calculation accuracy
- Check for API rate limit issues
- Update webhook configurations as needed

### 2. Updates and Maintenance
- Keep webhook endpoints secure
- Monitor WooCommerce version compatibility
- Update shipping calculation logic
- Backup webhook configurations

---

**Note**: This webhook system integrates seamlessly with your existing `fetchCourierPartners` function and provides automatic shipping calculation for WooCommerce. The system is designed to be robust, secure, and easy to maintain.
