# WooCommerce Order Management

This document explains how to use the WooCommerce order management system to retrieve and process orders when vendors place them.

## Overview

After vendors push products to WooCommerce, customers can place orders. The system provides several endpoints to:

1. **Retrieve orders** from WooCommerce stores
2. **Get order details** by ID
3. **Update order status** 
4. **Get order statistics** for analytics
5. **Sync orders** to local database for faster access

## API Endpoints

### 1. Get Vendor Orders

Retrieve all orders for a specific vendor from their WooCommerce store.

```http
GET /api/woocommerce/orders/vendor/{vendor_id}?status={status}&per_page={per_page}&page={page}
```

**Query Parameters:**
- `status` (optional): Filter by order status (e.g., 'processing', 'completed', 'cancelled')
- `per_page` (optional): Number of orders per page (default: 50)
- `page` (optional): Page number (default: 1)

**Example Response:**
```json
{
  "success": true,
  "message": "Found 25 orders",
  "total_orders": 25,
  "total_pages": 1,
  "current_page": 1,
  "orders": [
    {
      "id": 1234,
      "order_number": "1234",
      "status": "processing",
      "date_created": "2024-01-15T10:30:00",
      "total": "99.99",
      "customer": {
        "id": 567,
        "first_name": "John",
        "last_name": "Doe",
        "email": "john@example.com"
      },
      "line_items": [
        {
          "id": 1,
          "name": "Custom T-Shirt",
          "product_id": 789,
          "quantity": 2,
          "total": "99.99"
        }
      ]
    }
  ]
}
```

### 2. Get Order by ID

Retrieve detailed information about a specific order.

```http
GET /api/woocommerce/orders/vendor/{vendor_id}/order/{order_id}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Order retrieved successfully",
  "order": {
    "id": 1234,
    "order_number": "1234",
    "status": "processing",
    "date_created": "2024-01-15T10:30:00",
    "total": "99.99",
    "subtotal": "89.99",
    "total_tax": "10.00",
    "shipping_total": "0.00",
    "currency": "USD",
    "customer": {
      "id": 567,
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone": "+1234567890"
    },
    "billing": {
      "first_name": "John",
      "last_name": "Doe",
      "address_1": "123 Main St",
      "city": "New York",
      "state": "NY",
      "postcode": "10001",
      "country": "US"
    },
    "line_items": [
      {
        "id": 1,
        "name": "Custom T-Shirt",
        "product_id": 789,
        "variation_id": 0,
        "quantity": 2,
        "total": "99.99",
        "sku": "DP-12345-M"
      }
    ],
    "payment_method": "stripe",
    "payment_method_title": "Credit Card (Stripe)"
  }
}
```

### 3. Update Order Status

Update the status of an order in WooCommerce.

```http
PUT /api/woocommerce/orders/vendor/{vendor_id}/order/{order_id}/status
```

**Request Body:**
```json
{
  "status": "completed",
  "note": "Order has been shipped and delivered"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "order": {
    "id": 1234,
    "status": "completed",
    "date_modified": "2024-01-16T14:30:00"
  }
}
```

### 4. Get Order Statistics

Retrieve analytics and statistics for a vendor's orders.

```http
GET /api/woocommerce/orders/vendor/{vendor_id}/statistics?period={period}
```

**Query Parameters:**
- `period` (optional): Number of days to analyze (default: 30)

**Example Response:**
```json
{
  "success": true,
  "message": "Order statistics for the last 30 days",
  "period": "30",
  "statistics": {
    "total_orders": 45,
    "total_revenue": 2245.50,
    "orders_by_status": {
      "processing": 15,
      "completed": 25,
      "cancelled": 5
    },
    "revenue_by_status": {
      "processing": 750.00,
      "completed": 1495.50,
      "cancelled": 0.00
    },
    "average_order_value": 49.90
  }
}
```

### 5. Sync Orders

Synchronize orders from WooCommerce to the local database for faster access.

```http
POST /api/woocommerce/orders/sync
```

**Request Body:**
```json
{
  "vendor_id": 123,
  "sync_all": true
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Orders synced successfully",
  "summary": {
    "total_orders_fetched": 100,
    "new_orders_synced": 25,
    "existing_orders_updated": 75,
    "errors": 0
  },
  "errors": []
}
```

## Database Schema

The system uses a `woocommerce_orders` table to store synced orders locally:

```sql
CREATE TABLE `woocommerce_orders` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `vendor_id` int(11) NOT NULL,
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
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_vendor_order` (`vendor_id`, `woo_order_id`)
);
```

## Usage Examples

### Frontend Integration

```javascript
// Get all orders for a vendor
async function getVendorOrders(vendorId, status = 'any') {
  try {
    const response = await fetch(`/api/woocommerce/orders/vendor/${vendorId}?status=${status}`);
    const data = await response.json();
    
    if (data.success) {
      return data.orders;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

// Update order status
async function updateOrderStatus(vendorId, orderId, newStatus, note = '') {
  try {
    const response = await fetch(`/api/woocommerce/orders/vendor/${vendorId}/order/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: newStatus, note })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.order;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

// Sync orders from WooCommerce
async function syncOrders(vendorId, syncAll = false) {
  try {
    const response = await fetch('/api/woocommerce/orders/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ vendor_id: vendorId, sync_all: syncAll })
    });
    
    const data = await response.json();
    
    if (data.success) {
      return data.summary;
    } else {
      throw new Error(data.message);
    }
  } catch (error) {
    console.error('Error syncing orders:', error);
    throw error;
  }
}
```

### Backend Integration

```javascript
// Example: Process new orders automatically
async function processNewOrders(vendorId) {
  try {
    // First sync orders from WooCommerce
    const syncResult = await syncOrdersFromWooCommerce({ 
      body: { vendor_id: vendorId, sync_all: false } 
    });
    
    if (syncResult.success) {
      // Get newly synced orders
      const orders = await getVendorOrders({ 
        query: { vendor_id: vendorId, status: 'processing' } 
      });
      
      // Process each order
      for (const order of orders.response.orders) {
        await processOrder(order);
      }
      
      return {
        success: true,
        processed_orders: orders.response.orders.length
      };
    }
  } catch (error) {
    console.error('Error processing orders:', error);
    throw error;
  }
}

// Example: Order processing logic
async function processOrder(order) {
  try {
    // Update inventory
    await updateInventory(order.line_items);
    
    // Send confirmation email
    await sendOrderConfirmation(order);
    
    // Update order status to 'processing'
    await updateOrderStatus({
      params: { vendor_id: order.vendor_id, order_id: order.id },
      body: { status: 'processing', note: 'Order is being processed' }
    });
    
  } catch (error) {
    console.error(`Error processing order ${order.id}:`, error);
    throw error;
  }
}
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing parameters)
- `404`: Not Found (vendor/store not found)
- `500`: Internal Server Error

## Best Practices

1. **Regular Syncing**: Sync orders regularly to keep local data up-to-date
2. **Error Handling**: Always handle API errors gracefully
3. **Rate Limiting**: Respect WooCommerce API rate limits
4. **Data Validation**: Validate order data before processing
5. **Logging**: Log all order operations for debugging
6. **Security**: Ensure vendor authentication before accessing orders

## Troubleshooting

### Common Issues

1. **Connection Errors**: Check WooCommerce store credentials and connection status
2. **Missing Orders**: Verify order status filters and date ranges
3. **Sync Failures**: Check database connectivity and table structure
4. **Permission Errors**: Ensure WooCommerce API keys have proper permissions

### Debug Steps

1. Test WooCommerce connection first
2. Check API response headers for pagination info
3. Verify database table exists and has correct structure
4. Monitor server logs for detailed error messages
