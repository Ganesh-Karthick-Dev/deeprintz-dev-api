# 🚀 Complete Guide: Adding Your API to Shopify

This guide shows you **3 different methods** to add your shipping calculation API to Shopify stores.

## 📋 **Method 1: App Proxy (Recommended)**

### ✅ **Advantages:**
- **No CORS issues** - Requests come from Shopify's domain
- **Automatic authentication** - Shopify handles shop verification
- **Easy integration** - Just add a script tag to your theme
- **Production ready** - Works with any Shopify theme

### 🔧 **Setup Steps:**

#### 1. **App Proxy is Already Configured**
Your `shopify.app.toml` is already set up with:
```toml
[app_proxy]
prefix = "tools"
subpath = "app-proxy"
url = "https://devapi.deeprintz.com/api/deeprintz/live/proxy"

[[app_proxy.subroutes]]
prefix = "shipping"
subpath = "calculate"
url = "https://devapi.deeprintz.com/api/shopify/shipping/calculate"
```

#### 2. **Add Script to Shopify Theme**
Add this to your Shopify theme's `theme.liquid` file (in the `<head>` section):

```html
<!-- Deeprintz Shipping Calculator -->
<script src="https://devapi.deeprintz.com/tools/app-proxy/shipping/script"></script>
```

#### 3. **API Endpoints Available:**
- **Shipping Calculation**: `https://devapi.deeprintz.com/tools/app-proxy/shipping/calculate`
- **Shipping Script**: `https://devapi.deeprintz.com/tools/app-proxy/shipping/script`

#### 4. **Usage Example:**
```javascript
// This will work from any Shopify store
fetch('https://devapi.deeprintz.com/tools/app-proxy/shipping/calculate?postCode=110001&weight=500&orderAmount=1000')
  .then(response => response.json())
  .then(data => console.log(data));
```

---

## 📋 **Method 2: Direct API Integration**

### ✅ **Advantages:**
- **Full control** - Direct access to your API
- **Custom implementation** - Build exactly what you need
- **Real-time updates** - No proxy delays

### 🔧 **Setup Steps:**

#### 1. **Add to Shopify Theme**
Add this to your theme's `checkout.liquid` or `cart.liquid`:

```html
<script>
  // Configuration
  const SHIPPING_CONFIG = {
    apiBaseUrl: 'https://devapi.deeprintz.com/api',
    userId: 'YOUR_USER_ID', // Get this from your database
    shopDomain: '{{ shop.permanent_domain }}'
  };

  // Shipping Calculator
  class ShopifyShippingCalculator {
    constructor(config) {
      this.config = config;
      this.init();
    }

    init() {
      this.createShippingUI();
      this.bindEvents();
    }

    createShippingUI() {
      const calculatorHTML = `
        <div id="shipping-calculator">
          <h3>Calculate Shipping</h3>
          <div class="pincode-container">
            <input type="text" id="pincode-input" placeholder="Enter pincode" maxlength="6">
            <button id="calculate-btn">Calculate</button>
          </div>
          <div id="shipping-results"></div>
        </div>
      `;
      
      // Insert into checkout or cart
      const targetElement = document.querySelector('.order-summary') || 
                           document.querySelector('.cart');
      if (targetElement) {
        targetElement.insertAdjacentHTML('afterbegin', calculatorHTML);
      }
    }

    bindEvents() {
      document.getElementById('calculate-btn').addEventListener('click', () => {
        this.calculateShipping();
      });
    }

    async calculateShipping() {
      const pincode = document.getElementById('pincode-input').value;
      
      if (!pincode || pincode.length !== 6) {
        alert('Please enter a valid 6-digit pincode');
        return;
      }

      try {
        const response = await fetch(`${this.config.apiBaseUrl}/shopify/shipping/calculate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId: this.config.userId,
            shopDomain: this.config.shopDomain,
            postCode: pincode,
            weight: await this.getCartWeight(),
            orderAmount: await this.getCartTotal(),
            paymentMode: 'prepaid'
          })
        });

        const result = await response.json();
        
        if (result.success) {
          this.displayShippingOptions(result.data.shipping_options);
        } else {
          alert('Failed to calculate shipping: ' + result.message);
        }
      } catch (error) {
        console.error('Shipping calculation error:', error);
        alert('Error calculating shipping. Please try again.');
      }
    }

    async getCartWeight() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        
        let totalWeight = 0;
        cart.items.forEach(item => {
          totalWeight += (item.grams || 100) * item.quantity;
        });
        
        return totalWeight;
      } catch (error) {
        return 500; // Default weight
      }
    }

    async getCartTotal() {
      try {
        const response = await fetch('/cart.js');
        const cart = await response.json();
        return cart.total_price / 100; // Convert from cents
      } catch (error) {
        return 0;
      }
    }

    displayShippingOptions(options) {
      const resultsDiv = document.getElementById('shipping-results');
      resultsDiv.innerHTML = '';

      options.forEach(option => {
        const price = (option.shipping_cost / 100).toFixed(2);
        const optionDiv = document.createElement('div');
        optionDiv.className = 'shipping-option';
        optionDiv.innerHTML = `
          <div class="shipping-info">
            <strong>${option.courier_name}</strong>
            <small>${option.estimated_delivery || 'Standard delivery'}</small>
          </div>
          <div class="shipping-price">₹${price}</div>
        `;
        
        optionDiv.addEventListener('click', () => {
          this.selectShippingOption(option);
        });
        
        resultsDiv.appendChild(optionDiv);
      });
    }

    selectShippingOption(option) {
      // Store selected option
      sessionStorage.setItem('selectedShipping', JSON.stringify(option));
      
      // Update UI
      document.querySelectorAll('.shipping-option').forEach(el => {
        el.classList.remove('selected');
      });
      event.currentTarget.classList.add('selected');
      
      console.log('Selected shipping:', option);
    }
  }

  // Initialize when page loads
  document.addEventListener('DOMContentLoaded', () => {
    new ShopifyShippingCalculator(SHIPPING_CONFIG);
  });
</script>

<style>
  #shipping-calculator {
    background: #f8f9fa;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  
  .pincode-container {
    display: flex;
    gap: 10px;
    margin: 15px 0;
  }
  
  #pincode-input {
    flex: 1;
    padding: 12px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  
  #calculate-btn {
    padding: 12px 20px;
    background: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .shipping-option {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px;
    margin: 8px 0;
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 4px;
    cursor: pointer;
  }
  
  .shipping-option:hover {
    border-color: #007bff;
  }
  
  .shipping-option.selected {
    border-color: #007bff;
    background: #f8f9ff;
  }
</style>
```

---

## 📋 **Method 3: Shopify App with Admin Integration**

### ✅ **Advantages:**
- **Admin dashboard** - Manage shipping settings from Shopify admin
- **Automatic installation** - Users can install from Shopify App Store
- **Professional integration** - Full app experience

### 🔧 **Setup Steps:**

#### 1. **Install Your App**
Users install your app from Shopify App Store or via your app URL:
```
https://devapi.deeprintz.com/api/deeprintz/live/install?shop=STORE_NAME.myshopify.com&userid=USER_ID
```

#### 2. **App Automatically Adds Script**
Your app automatically injects the shipping calculator into the store.

#### 3. **Admin Configuration**
Store owners can configure shipping settings from your app's admin panel.

---

## 🎯 **Quick Start (Recommended)**

### **For Immediate Testing:**

1. **Add this single line to your Shopify theme:**
```html
<script src="https://devapi.deeprintz.com/tools/app-proxy/shipping/script"></script>
```

2. **That's it!** The shipping calculator will automatically appear on:
   - Checkout pages
   - Cart pages
   - Product pages

### **For Production:**

1. **Install your app** on the Shopify store
2. **Configure user mapping** in your database
3. **Test with real products and pincodes**

---

## 🔧 **API Usage Examples**

### **Direct API Call:**
```javascript
fetch('https://devapi.deeprintz.com/api/shopify/shipping/calculate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    userId: '123',
    shopDomain: 'mystore.myshopify.com',
    postCode: '110001',
    weight: 500,
    orderAmount: 1000,
    paymentMode: 'prepaid'
  })
})
.then(response => response.json())
.then(data => {
  console.log('Shipping options:', data.data.shipping_options);
});
```

### **App Proxy Call:**
```javascript
fetch('https://devapi.deeprintz.com/tools/app-proxy/shipping/calculate?postCode=110001&weight=500&orderAmount=1000')
.then(response => response.json())
.then(data => {
  console.log('Shipping rates:', data.rates);
});
```

---

## 🚀 **Testing Your Integration**

### **1. Test API Endpoints:**
```bash
# Test direct API
curl -X POST https://devapi.deeprintz.com/api/shopify/shipping/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "123",
    "shopDomain": "test.myshopify.com",
    "postCode": "110001",
    "weight": 500,
    "orderAmount": 1000
  }'

# Test app proxy
curl "https://devapi.deeprintz.com/tools/app-proxy/shipping/calculate?postCode=110001&weight=500&orderAmount=1000"
```

### **2. Test in Shopify Store:**
1. Add the script to your theme
2. Go to checkout with items in cart
3. Enter a pincode
4. Verify shipping options appear

---

## 🛠️ **Troubleshooting**

### **Common Issues:**

1. **Script not loading:**
   - Check if app proxy is enabled
   - Verify URL is accessible
   - Check browser console for errors

2. **API not responding:**
   - Verify your WooCommerce shipping API is working
   - Check user ID mapping in database
   - Test API endpoints directly

3. **CORS errors:**
   - Use app proxy method instead of direct API
   - Check if your API allows cross-origin requests

### **Debug Mode:**
Enable debug logging by adding this to your script:
```javascript
window.shopifyShippingConfig = {
  debug: true
};
```

---

## 📞 **Support**

If you need help:
1. Check browser console for errors
2. Test API endpoints directly
3. Verify your WooCommerce shipping API is working
4. Check user ID and shop domain mapping

The integration is now ready to use! 🎉
