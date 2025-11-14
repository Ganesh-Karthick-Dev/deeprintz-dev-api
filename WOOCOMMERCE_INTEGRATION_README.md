# 🛒 WooCommerce Integration for Vendor Product Listing

This integration allows you to connect your vendors' WooCommerce stores and list products from your system to their stores.

## 🚀 Quick Start

### 1. Install Dependencies
The WooCommerce REST API package is already included in your `package.json`:
```bash
npm install @woocommerce/woocommerce-rest-api
```

### 2. Set Up Database
Run the SQL file to create the necessary tables:
```bash
mysql -u your_username -p your_database < database/woocommerce_stores.sql
```

### 3. Get WooCommerce API Credentials
Each vendor needs to provide:
- **Store URL**: Their WooCommerce store domain (e.g., `https://mystore.com`)
- **Consumer Key**: WooCommerce REST API consumer key
- **Consumer Secret**: WooCommerce REST API consumer secret

## 📋 API Endpoints

### Connect WooCommerce Store
```http
POST /api/woocommerce/connect
```
**Body:**
```json
{
  "vendor_id": 123,
  "store_url": "https://mystore.com",
  "consumer_key": "ck_xxxxxxxxxxxxxxxxxxxxx",
  "consumer_secret": "cs_xxxxxxxxxxxxxxxxxxxxx"
}
```

### Test Connection
```http
POST /api/woocommerce/test-connection
```
**Body:**
```json
{
  "store_url": "https://mystore.com",
  "consumer_key": "ck_xxxxxxxxxxxxxxxxxxxxx",
  "consumer_secret": "cs_xxxxxxxxxxxxxxxxxxxxx"
}
```

### List Products for Vendors
```http
POST /api/woocommerce/list-products
```
**Body:**
```json
{
  "vendor_id": 123
}
```

### Create Product in WooCommerce
```http
POST /api/woocommerce/create-product
```
**Body:**
```json
{
  "vendor_id": 123,
  "product_data": {
    "name": "Product Name",
    "description": "Product description",
    "price": "29.99",
    "sku": "PROD-001",
    "stock_quantity": 100,
    "categories": [{"id": 15}],
    "images": [{"src": "https://example.com/image.jpg"}]
  }
}
```

### Update Product in WooCommerce
```http
POST /api/woocommerce/update-product
```
**Body:**
```json
{
  "vendor_id": 123,
  "product_id": 456,
  "product_data": {
    "name": "Updated Product Name",
    "price": "39.99"
  }
}
```

### Delete Product from WooCommerce
```http
POST /api/woocommerce/delete-product
```
**Body:**
```json
{
  "vendor_id": 123,
  "product_id": 456
}
```

### Get Vendor Stores
```http
POST /api/woocommerce/vendor-stores
```
**Body:**
```json
{
  "vendor_id": 123
}
```

## 🔧 How to Use

### Step 1: Vendor Connects Their Store
1. Vendor goes to your system
2. Enters their WooCommerce store details
3. System tests the connection
4. If successful, stores the credentials

### Step 2: List Products to Vendor Store
1. Select products from your system
2. Choose the vendor's WooCommerce store
3. System creates/updates products in their store
4. Tracks sync status in database

### Step 3: Monitor and Manage
- Track sync status for each product
- Handle errors and retry failed syncs
- Monitor store connections

## 🗄️ Database Schema

### `woocommerce_stores` Table
- Stores vendor store connections
- Tracks connection status and sync history
- Stores API credentials securely

### `woocommerce_products_sync` Table
- Tracks product sync operations
- Stores sync status and error messages
- Links local products to WooCommerce products

### `woocommerce_orders_sync` Table
- Tracks order sync operations
- Useful for order management integration

## 🔐 Security Considerations

1. **API Credentials**: Store consumer keys and secrets securely
2. **HTTPS Only**: Always use HTTPS for API communications
3. **Rate Limiting**: Implement rate limiting to avoid API abuse
4. **Access Control**: Validate vendor permissions before operations

## 📱 Frontend Integration

### Connect Store Form
```html
<form id="wooConnectForm">
  <input type="text" name="store_url" placeholder="Store URL" required>
  <input type="text" name="consumer_key" placeholder="Consumer Key" required>
  <input type="text" name="consumer_secret" placeholder="Consumer Secret" required>
  <button type="submit">Connect Store</button>
</form>
```

### JavaScript Example
```javascript
// Connect WooCommerce store
async function connectWooStore(formData) {
  try {
    const response = await fetch('/api/woocommerce/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    const result = await response.json();
    if (result.success) {
      alert('Store connected successfully!');
    } else {
      alert('Connection failed: ' + result.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

// List products to vendor store
async function listProductsToStore(vendorId, productIds) {
  try {
    const response = await fetch('/api/woocommerce/create-product', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendorId,
        product_data: productIds
      })
    });
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error:', error);
  }
}
```

## 🚨 Error Handling

### Common Errors
1. **Invalid Credentials**: Check consumer key and secret
2. **Store URL Issues**: Ensure URL is accessible and has WooCommerce
3. **API Rate Limits**: Implement retry logic with exponential backoff
4. **Network Issues**: Handle timeouts and connection errors

### Error Response Format
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## 🔄 Sync Strategies

### Real-time Sync
- Sync products immediately when created/updated
- Good for small catalogs

### Batch Sync
- Collect changes and sync in batches
- Better for large catalogs

### Scheduled Sync
- Run sync operations on a schedule
- Good for performance and reliability

## 📊 Monitoring and Analytics

### Track Metrics
- Number of connected stores
- Sync success/failure rates
- API response times
- Error patterns

### Logging
- Log all API requests and responses
- Track sync operations
- Monitor store connection health

## 🆘 Support

### Troubleshooting
1. Check WooCommerce REST API is enabled
2. Verify API credentials are correct
3. Ensure store URL is accessible
4. Check API rate limits

### Testing
- Use the test connection endpoint first
- Test with a single product before bulk operations
- Monitor API responses for detailed error information

## 🔮 Future Enhancements

1. **Webhook Support**: Real-time updates from WooCommerce
2. **Inventory Sync**: Sync stock levels between systems
3. **Order Management**: Handle orders from WooCommerce
4. **Multi-store Support**: Manage multiple stores per vendor
5. **Analytics Dashboard**: Visual sync status and metrics

---

## 📝 Notes

- Replace placeholder credentials with actual WooCommerce API keys
- Implement proper error handling and logging
- Add authentication middleware for vendor operations
- Consider implementing webhook endpoints for real-time updates
- Test thoroughly with different WooCommerce versions and configurations
