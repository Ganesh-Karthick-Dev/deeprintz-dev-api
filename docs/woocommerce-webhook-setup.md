# WooCommerce Webhook Setup Guide

This guide will help you set up WooCommerce webhooks so that orders are **automatically stored in your database** when end users place them.

## 🎯 **What This Achieves**

✅ **Real-time order storage** - Orders appear in your DB instantly  
✅ **No manual syncing needed** - Everything happens automatically  
✅ **Vendor identification** - Orders are automatically assigned to correct vendors  
✅ **Status tracking** - All order updates are captured in real-time  

## 📋 **Prerequisites**

1. WooCommerce store with admin access
2. Your application running and accessible via HTTPS
3. Database tables created (run the migration first)

## 🔧 **Step 1: Configure WooCommerce Webhooks**

### **1.1 Access WooCommerce Settings**

1. Go to your WordPress admin panel
2. Navigate to **WooCommerce → Settings → Advanced → Webhooks**
3. Click **"Add webhook"**

### **1.2 Create Order Webhook**

**Webhook Name:** `Order Notifications`  
**Status:** `Active`  
**Topic:** `Order created`  
**Delivery URL:** `https://yourdomain.com/api/woocommerce/webhooks/orders`  
**Version:** `WP REST API Integration v3`  
**Secret:** Generate a secure secret (save this for your environment variable)

### **1.3 Create Additional Webhooks (Optional)**

**Order Updated Webhook:**
- **Topic:** `Order updated`
- **Delivery URL:** `https://yourdomain.com/api/woocommerce/webhooks/orders`

**Order Deleted Webhook:**
- **Topic:** `Order deleted`
- **Delivery URL:** `https://yourdomain.com/api/woocommerce/webhooks/orders`

**Order Restored Webhook:**
- **Topic:** `Order restored`
- **Delivery URL:** `https://yourdomain.com/api/woocommerce/webhooks/orders`

## 🔑 **Step 2: Set Environment Variables**

Add this to your `.env` file:

```bash
WOOCOMMERCE_WEBHOOK_SECRET=your_generated_secret_here
```

## 🧪 **Step 3: Test the Webhook**

### **3.1 Place a Test Order**

1. Go to your WooCommerce store
2. Add a product to cart
3. Complete checkout process
4. Check your application logs

### **3.2 Check Logs**

You should see logs like:
```
📦 Webhook received: order.created for resource 123
🆕 New order created: #123 for $99.99
🔍 Found vendor ID in meta_data: 456
💾 Order #123 stored in local database
✅ Order #123 automatically stored for vendor 456
```

## 🔍 **Step 4: Vendor Identification Methods**

The system automatically identifies vendors using these methods (in order):

### **Method 1: Meta Data**
Add vendor ID to products when creating them:

```php
// In WooCommerce product creation
add_post_meta($product_id, '_vendor_id', $vendor_id);
```

### **Method 2: SKU Pattern**
Use SKU format: `DP-{VENDOR_ID}-{PRODUCT_ID}`

Example: `DP-123-456` (Vendor ID: 123, Product ID: 456)

### **Method 3: Product Categories**
Assign products to vendor-specific categories

### **Method 4: Product Meta**
Store vendor ID in product custom fields

## 📊 **Step 5: Verify Data Storage**

### **5.1 Check Database**

```sql
-- Check if orders are being stored
SELECT * FROM woocommerce_orders ORDER BY created_at DESC LIMIT 5;

-- Check orders that need vendor assignment
SELECT * FROM woocommerce_orders WHERE needs_vendor_assignment = 1;

-- Check webhook-received orders
SELECT * FROM woocommerce_orders WHERE webhook_received = 1;
```

### **5.2 Check General Orders Table**

```sql
-- Check general orders table
SELECT * FROM orders ORDER BY created_at DESC LIMIT 5;
```

## 🚨 **Troubleshooting**

### **Webhook Not Working?**

1. **Check URL accessibility:**
   ```bash
   curl -X POST https://yourdomain.com/api/woocommerce/webhooks/orders
   ```

2. **Check WooCommerce webhook status:**
   - Go to WooCommerce → Settings → Advanced → Webhooks
   - Look for failed deliveries
   - Check webhook logs

3. **Verify HTTPS:**
   - WooCommerce requires HTTPS for webhooks
   - Ensure your domain has valid SSL certificate

### **Orders Not Being Stored?**

1. **Check database connection:**
   ```javascript
   // Test database connection
   const test = await global.dbConnection('woocommerce_orders').select('*').limit(1);
   console.log('DB connection test:', test);
   ```

2. **Check webhook payload:**
   - Add more logging to see what data is received
   - Verify vendor identification logic

3. **Check table structure:**
   ```sql
   DESCRIBE woocommerce_orders;
   ```

### **Vendor Not Identified?**

1. **Check product meta data:**
   ```sql
   -- Check if products have vendor information
   SELECT p.ID, p.post_title, pm.meta_key, pm.meta_value 
   FROM wp_posts p 
   JOIN wp_postmeta pm ON p.ID = pm.post_id 
   WHERE p.post_type = 'product' 
   AND pm.meta_key LIKE '%vendor%';
   ```

2. **Verify SKU format:**
   - Ensure SKUs follow the pattern: `DP-{VENDOR_ID}-{PRODUCT_ID}`
   - Check if vendor ID exists in your users table

## 🔄 **Step 6: Monitor and Maintain**

### **6.1 Regular Monitoring**

- Check webhook delivery status in WooCommerce
- Monitor application logs for errors
- Verify orders are being stored correctly

### **6.2 Handle Unknown Vendors**

Orders that can't be assigned to vendors are stored with `vendor_id = 0` and `needs_vendor_assignment = 1`. You can:

1. **Manual assignment:**
   ```sql
   UPDATE woocommerce_orders 
   SET vendor_id = 123, needs_vendor_assignment = 0 
   WHERE id = 456;
   ```

2. **Bulk processing:**
   - Create an admin interface to assign vendors
   - Implement automatic vendor detection algorithms

### **6.3 Performance Optimization**

- Add database indexes for frequently queried fields
- Implement webhook queuing for high-volume stores
- Use caching for vendor lookups

## 📱 **Step 7: Vendor Notifications**

### **7.1 Email Notifications**

```javascript
// Example email notification
async function sendVendorNotification(vendorId, orderData) {
  const vendor = await getVendorById(vendorId);
  const emailData = {
    to: vendor.email,
    subject: `New Order #${orderData.number}`,
    body: `You have received a new order for $${orderData.total}`
  };
  
  await sendEmail(emailData);
}
```

### **7.2 SMS Notifications**

```javascript
// Example SMS notification
async function sendVendorSMS(vendorId, orderData) {
  const vendor = await getVendorById(vendorId);
  const message = `New order #${orderData.number} received for $${orderData.total}`;
  
  await sendSMS(vendor.phone, message);
}
```

## ✅ **Success Indicators**

When everything is working correctly, you should see:

1. **Instant order storage** - Orders appear in DB within seconds
2. **Automatic vendor assignment** - Most orders get vendor IDs automatically
3. **Real-time updates** - Status changes are captured immediately
4. **Clean logs** - No webhook errors or database failures
5. **Complete data** - All order information is captured and stored

## 🎉 **You're Done!**

Your system now automatically stores all WooCommerce orders in real-time! Every time a customer places an order:

1. ✅ WooCommerce sends webhook to your system
2. ✅ Order is automatically stored in database
3. ✅ Vendor is identified and assigned
4. ✅ Notifications are sent (if configured)
5. ✅ Order appears in your system instantly

No more manual syncing needed! 🚀
