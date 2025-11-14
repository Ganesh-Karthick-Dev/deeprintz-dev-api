# Order Management Split System

This document explains the new split order management system that separates **Website Orders** from **Store Orders** for better organization and workflow management.

## 🏗️ System Architecture

### 1. **Website Orders** (Your Existing System)
- **Source**: Orders placed directly on your website
- **Storage**: `orders` table
- **Workflow**: Live → Picklist Generated → To Printed → Printed → QC → Dispatched
- **Management**: Through your existing order management system

### 2. **Store Orders** (WooCommerce Orders)
- **Source**: Orders placed on WooCommerce stores
- **Storage**: `woocommerce_orders` table
- **Workflow**: Can optionally integrate with your stage system
- **Management**: Through new store order management functions

## 🛣️ API Endpoints

### Website Orders Management
```http
POST /website-orders/getAllWebsiteOrders
POST /website-orders/getWebsiteOrderDetails
POST /website-orders/updateWebsiteOrderStatus
POST /website-orders/getWebsiteOrderCounts
```

### Store Orders Management
```http
POST /store-orders/getAllStoreOrders
POST /store-orders/getStoreOrderDetails
POST /store-orders/updateStoreOrderStatus
POST /store-orders/getStoreOrderCounts
POST /store-orders/convertToWebsiteOrder
```

### Legacy Endpoints (Maintained for Backward Compatibility)
```http
POST /getAllOrders          # Still works, but now clearly for website orders
POST /updateOrderStatus     # Still works, but now clearly for website orders
```

## 📊 Database Schema

### woocommerce_orders Table (Enhanced)
```sql
CREATE TABLE `woocommerce_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL DEFAULT 0,
  `woo_order_id` bigint(20) NOT NULL,
  `order_number` varchar(255) NOT NULL,
  `status` varchar(100) NOT NULL,
  `date_created` datetime NOT NULL,
  `date_modified` datetime NOT NULL,
  `total` decimal(10,2) NOT NULL,
  `subtotal` decimal(10,2) NOT NULL,
  `total_tax` decimal(10,2) NOT NULL DEFAULT '0.00',
  `shipping_total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `discount_total` decimal(10,2) NOT NULL DEFAULT '0.00',
  `currency` varchar(10) NOT NULL DEFAULT 'USD',
  `customer_id` bigint(20) DEFAULT NULL,
  `customer_email` varchar(255) DEFAULT NULL,
  `customer_name` varchar(255) DEFAULT NULL,
  `billing_address` text,
  `shipping_address` text,
  `payment_method` varchar(100) DEFAULT NULL,
  `payment_method_title` varchar(255) DEFAULT NULL,
  `transaction_id` varchar(255) DEFAULT NULL,
  `customer_note` text,
  `line_items` text,
  `synced_at` datetime NOT NULL,
  `webhook_received` tinyint(1) NOT NULL DEFAULT 0,
  `needs_vendor_assignment` tinyint(1) NOT NULL DEFAULT 0,
  
  -- New conversion tracking fields
  `converted_to_website_order` tinyint(1) NOT NULL DEFAULT 0,
  `converted_at` datetime NULL,
  `website_order_id` int(11) NULL,
  `order_source` varchar(50) NOT NULL DEFAULT 'woocommerce',
  `stage_workflow_status` varchar(100) NULL,
  
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_order` (`vendor_id`, `woo_order_id`)
);
```

## 🔄 Workflow Integration Options

### Option 1: Separate Workflows
- **Website Orders**: Use your existing stage system
- **Store Orders**: Keep WooCommerce statuses separate
- **Benefits**: Clean separation, no interference

### Option 2: Integrated Workflows
- **Website Orders**: Use your existing stage system
- **Store Orders**: Can optionally enter your stage workflow
- **Benefits**: Unified processing, better tracking

### Option 3: Conversion Workflow
- **Website Orders**: Use your existing stage system
- **Store Orders**: Convert to website orders when entering your workflow
- **Benefits**: Full integration, single source of truth

## 📱 Frontend Implementation Examples

### Get All Website Orders
```javascript
async function getAllWebsiteOrders(status = 1, offset = 0, limit = 50) {
  try {
    const response = await fetch('/website-orders/getAllWebsiteOrders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: status,
        offset: offset,
        limit: limit,
        all: 0
      })
    });
    
    const data = await response.json();
    if (data.status) {
      return data.response;
    }
  } catch (error) {
    console.error('Error fetching website orders:', error);
  }
}
```

### Get All Store Orders
```javascript
async function getAllStoreOrders(vendor_id = 0, status = 'any', offset = 0, limit = 50) {
  try {
    const response = await fetch('/store-orders/getAllStoreOrders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_id: vendor_id,
        status: status,
        offset: offset,
        limit: limit,
        all: 0
      })
    });
    
    const data = await response.json();
    if (data.success) {
      return data.orders;
    }
  } catch (error) {
    console.error('Error fetching store orders:', error);
  }
}
```

### Update Store Order Status
```javascript
async function updateStoreOrderStatus(orderId, newStatus, note = '') {
  try {
    const response = await fetch('/store-orders/updateStoreOrderStatus', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: orderId,
        status: newStatus,
        note: note
      })
    });
    
    const data = await response.json();
    if (data.success) {
      console.log('Store order status updated successfully');
      return true;
    }
  } catch (error) {
    console.error('Error updating store order status:', error);
  }
}
```

## 🎯 Usage Scenarios

### Scenario 1: Separate Management
- **Admin Dashboard**: Two separate tabs for Website Orders and Store Orders
- **Workflows**: Each type maintains its own workflow
- **Reporting**: Separate analytics for each order source

### Scenario 2: Unified View with Filtering
- **Admin Dashboard**: Single "All Orders" view with source filter
- **Workflows**: Can choose which workflow to apply
- **Reporting**: Combined analytics with source breakdown

### Scenario 3: Stage Integration
- **Admin Dashboard**: Single view showing orders in different stages
- **Workflows**: Store orders can enter your stage workflow
- **Reporting**: Unified stage-based analytics

## 🔧 Configuration

### Environment Variables
```bash
# WooCommerce Integration
WOOCOMMERCE_WEBHOOK_SECRET=your_webhook_secret
WOOCOMMERCE_DEFAULT_VENDOR_ID=0

# Order Management
ENABLE_STORE_ORDER_STAGES=true
AUTO_CONVERT_STORE_ORDERS=false
```

### Database Migration
```bash
# Run the migration to add new fields
mysql -u username -p database_name < database/migrations/add_conversion_fields_to_woocommerce_orders.sql
```

## 🚀 Getting Started

### 1. Run Database Migration
```bash
mysql -u username -p your_database < database/migrations/add_conversion_fields_to_woocommerce_orders.sql
```

### 2. Test the New Endpoints
```bash
# Test website orders
curl -X POST http://localhost:3000/website-orders/getAllWebsiteOrders \
  -H "Content-Type: application/json" \
  -d '{"status": 1, "offset": 0, "limit": 10, "all": 0}'

# Test store orders
curl -X POST http://localhost:3000/store-orders/getAllStoreOrders \
  -H "Content-Type: application/json" \
  -d '{"vendor_id": 0, "status": "any", "offset": 0, "limit": 10, "all": 0}'
```

### 3. Update Frontend
- Add new API calls for store orders
- Create separate UI sections for each order type
- Implement filtering and source indicators

## 🔍 Monitoring and Debugging

### Log Files
- **Website Orders**: Check your existing order logs
- **Store Orders**: Check WooCommerce webhook logs
- **Integration**: Check conversion and workflow logs

### Database Queries
```sql
-- Check store orders that need vendor assignment
SELECT * FROM woocommerce_orders WHERE needs_vendor_assignment = 1;

-- Check converted store orders
SELECT * FROM woocommerce_orders WHERE converted_to_website_order = 1;

-- Check store orders by source
SELECT order_source, COUNT(*) as count FROM woocommerce_orders GROUP BY order_source;
```

## 🆘 Troubleshooting

### Common Issues

1. **Store orders not appearing**
   - Check WooCommerce webhook configuration
   - Verify database connection
   - Check webhook endpoint accessibility

2. **Status updates not working**
   - Verify API endpoint permissions
   - Check request body format
   - Verify order ID exists

3. **Conversion errors**
   - Check database migration completed
   - Verify field constraints
   - Check for duplicate entries

### Support
- Check the logs for detailed error messages
- Verify all required fields are present
- Test with sample data first

## 🔮 Future Enhancements

### Planned Features
- **Multi-store support** (Shopify, Magento, etc.)
- **Advanced workflow customization**
- **Real-time order synchronization**
- **Advanced reporting and analytics**
- **Bulk operations for store orders**

### Integration Possibilities
- **ERP systems** (SAP, Oracle, etc.)
- **Shipping providers** (FedEx, UPS, DHL)
- **Payment gateways** (Stripe, PayPal, etc.)
- **Inventory management systems**
- **Customer relationship management (CRM)**

---

This split system provides a clean, organized way to manage different types of orders while maintaining the flexibility to integrate them when needed. Choose the workflow option that best fits your business requirements.
