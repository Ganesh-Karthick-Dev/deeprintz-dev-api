# 🚚 SHOPIFY SHIPPING FIX GUIDE

## ❌ **THE PROBLEM**

When customers try to checkout on your Shopify dev store, they see:
```
Shipping method
Shipping not available
Your order cannot be shipped to the selected address.
```

## 🔍 **ROOT CAUSE**

You have **2 CarrierServices** registered in your Shopify store:

1. ❌ **Old CarrierService** (ID: 68872470595)
   - Name: "Deeprintz Live Shipping Rates"
   - **Callback URL: NOT SET** ← This is the problem!
   - Shopify tries to call this one first (because it was created first)
   - Since it has no callback URL, Shopify can't get shipping rates
   - Result: "Shipping not available" error

2. ✅ **New CarrierService** (ID: 69263753283)
   - Name: "Deeprintz Live Shipping Rates"
   - Callback URL: https://devapi.deeprintz.com/api/deeprintz/live/shopify/carrier/rates
   - **This one works, but it's for LIVE environment, not DEV!**

## ✅ **THE SOLUTION**

You need to **manually delete** the old CarrierServices from Shopify Admin and create a new one for DEV environment.

---

## 📋 **STEP-BY-STEP FIX** (Follow carefully)

### **STEP 1: Access Shopify Admin**

1. Go to: **https://mayu-12351.myshopify.com/admin**
2. Log in with your Shopify credentials

---

### **STEP 2: Go to Shipping Settings**

1. In the left sidebar, click **"Settings"** (gear icon at bottom)
2. Click **"Shipping and delivery"**

---

### **STEP 3: Find CarrierServices**

Look for any of these sections (Shopify UI changes, so check all):

- **"Carrier accounts"**
- **"Apps and sales channels"**
- **"Third-party shipping rates"**
- **"App-based rates"**
- **"Managed shipping rates"**

You should see entries for **"Deeprintz Live Shipping Rates"** (possibly appearing twice).

---

### **STEP 4: Screenshot What You See** 📸

**BEFORE YOU DELETE ANYTHING**, please take a screenshot and share it with me so I can confirm you're looking at the right section.

---

### **STEP 5: Delete/Disable Old CarrierServices**

Once you find the section:

1. Look for **"Deeprintz Live Shipping Rates"**
2. You may see:
   - A toggle switch (Active/Inactive)
   - A "Remove" or "Delete" button
   - A "Manage" or "Edit" option
   - A three-dot menu (⋮) with "Delete" option

3. **Delete or Disable** any Deeprintz CarrierServices you find

---

### **STEP 6: Verify Deletion**

After deletion:
- Refresh the page
- Make sure no "Deeprintz" CarrierServices are listed
- Take a screenshot to confirm

---

### **STEP 7: Create New DEV CarrierService**

Now we'll create a fresh CarrierService with the correct DEV callback URL.

**Option A: Via Push Product** (Easiest)

1. Go to your Deeprintz dashboard
2. Select any product
3. Click **"Push to Shopify"**
4. The system will automatically create a NEW CarrierService with the correct callback URL

**Option B: Via API** (Alternative)

Run this command in your terminal:
```bash
cd /home/ganesh/Documents/Deeprintz/dev/deeprintz-dev-api
node -e "
const ModernShopifyController = require('./controllers/shopify/modernController');
const controller = ModernShopifyController;
const dbConfigs = require('./utils/knexfile');
const knex = require('knex');

async function fix() {
  global.dbConnection = knex(dbConfigs.deeprintzDev);
  
  const shop = await global.dbConnection('shopify_stores')
    .where('shop_domain', 'mayu-12351.myshopify.com')
    .where('status', 'connected')
    .first();
  
  if (!shop) {
    console.error('Shop not found');
    process.exit(1);
  }
  
  try {
    const result = await controller.registerCarrierService(shop.shop_domain, shop.access_token);
    console.log('✅ CarrierService registered:', result);
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

fix();
"
```

---

### **STEP 8: Test Checkout** 🧪

1. Go to your Shopify store: **https://mayu-12351.myshopify.com**
2. Add a product to cart
3. Click **"Checkout"**
4. Enter a shipping address (use a valid Indian postal code like **110001**)
5. Click **"Continue to shipping method"**
6. **You should now see shipping options!** 🎉

Expected shipping options:
- Standard Delivery - ₹50.00 (3-5 business days)
- Express Delivery - ₹100.00 (1-2 business days)

---

## 🐛 **TROUBLESHOOTING**

### **If you still see "Shipping not available":**

1. **Check if ngrok is running:**
   ```bash
   curl https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/dev/shopify/carrier/rates/test
   ```
   - If you get a connection error, ngrok is down. Restart it.

2. **Verify CarrierService callback URL:**
   - Run: `node debug-shopify-shipping.js`
   - Check if the endpoint is accessible

3. **Check Shopify logs:**
   - Go to: Shopify Admin → Settings → Notifications
   - Look for any errors related to shipping calculations

4. **Clear browser cache:**
   - Shopify caches shipping calculations
   - Try in an incognito window

---

## 📊 **HOW SHOPIFY SHIPPING WORKS** (Detailed Flow)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        SHOPIFY CHECKOUT FLOW                             │
└─────────────────────────────────────────────────────────────────────────┘

1. CUSTOMER ADDS PRODUCT TO CART
   └─→ Shopify creates cart session

2. CUSTOMER CLICKS "CHECKOUT"
   └─→ Shopify loads checkout page

3. CUSTOMER ENTERS SHIPPING ADDRESS
   └─→ Postal code: 110001
   └─→ City: New Delhi
   └─→ Country: India

4. SHOPIFY REQUESTS SHIPPING RATES ⚡ (THIS IS WHERE THE PROBLEM WAS)
   │
   ├─→ Shopify looks for registered CarrierServices
   │   ├─→ Found: "Deeprintz Live Shipping Rates" (OLD, NO CALLBACK URL) ❌
   │   └─→ Tries to call: undefined/null
   │       └─→ FAILS! → "Shipping not available" error
   │
   └─→ AFTER FIX:
       ├─→ Found: "Deeprintz DEV Shipping" (NEW, WITH CALLBACK URL) ✅
       └─→ Calls: https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/dev/shopify/carrier/rates
           │
           └─→ YOUR APP RECEIVES REQUEST:
               {
                 "rate": {
                   "destination": {
                     "postal_code": "110001",
                     "city": "New Delhi"
                   },
                   "items": [{
                     "grams": 500,
                     "price": 16150 (₹161.50 in cents)
                   }]
                 }
               }
               │
               └─→ YOUR APP CALLS NIMBUSPOST API:
                   - Origin: Your warehouse pincode
                   - Destination: 110001
                   - Weight: 500g
                   - Order value: ₹161.50
                   │
                   └─→ NIMBUSPOST RETURNS:
                       [
                         { courier: "Delhivery", cost: ₹50, days: "3-5" },
                         { courier: "Blue Dart", cost: ₹80, days: "1-2" }
                       ]
                       │
                       └─→ YOUR APP FORMATS FOR SHOPIFY:
                           {
                             "rates": [
                               {
                                 "service_name": "Standard Delivery",
                                 "total_price": "5000", (₹50 in cents)
                                 "currency": "INR",
                                 "description": "3-5 business days"
                               },
                               {
                                 "service_name": "Express Delivery",
                                 "total_price": "8000", (₹80 in cents)
                                 "currency": "INR",
                                 "description": "1-2 business days"
                               }
                             ]
                           }
                           │
                           └─→ SHOPIFY SHOWS TO CUSTOMER:
                               ┌────────────────────────────────────┐
                               │ Shipping method                     │
                               │ ○ Standard Delivery - ₹50.00       │
                               │ ○ Express Delivery - ₹80.00        │
                               └────────────────────────────────────┘

5. CUSTOMER SELECTS SHIPPING METHOD
   └─→ Selects "Standard Delivery"

6. CUSTOMER PROCEEDS TO PAYMENT
   └─→ Pays via Credit Card/UPI/COD

7. ORDER IS PLACED ✅
   └─→ Shopify sends webhook to: https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/live/shopify/webhooks/orders
       └─→ Your app stores order in database
       └─→ Your app auto-fulfills order
       └─→ Your production team receives notification
```

---

## 🤔 **WHY THIS HAPPENED**

1. **Initial Setup**: When you first connected your Shopify store, a CarrierService was created
2. **Callback URL Not Set**: Due to OAuth token not having shipping scopes, the callback URL was not set
3. **Multiple Attempts**: Each time you pushed a product, the system tried to update the CarrierService
4. **Shopify Limitation**: Shopify doesn't allow updating callback URLs via API once a CarrierService is created
5. **Result**: Multiple CarrierServices with wrong/missing callback URLs

---

## 🛡️ **PREVENTION** (For Future)

To avoid this issue in the future:

1. **Always ensure OAuth scopes** include `read_shipping` and `write_shipping` BEFORE connecting a store
2. **Test CarrierService** immediately after connecting a store (run `debug-shopify-shipping.js`)
3. **Keep ngrok URL updated** in `config/shopify.js` whenever ngrok restarts
4. **For production**, use a permanent domain (not ngrok) to avoid callback URL changes

---

## 📞 **NEED HELP?**

If you're stuck at any step:

1. **Take screenshots** of:
   - Shopify Admin → Settings → Shipping and delivery page
   - Any error messages you see
   - The checkout page showing "Shipping not available"

2. **Run diagnostic script**:
   ```bash
   cd /home/ganesh/Documents/Deeprintz/dev/deeprintz-dev-api
   node debug-shopify-shipping.js
   ```
   Copy and share the output

3. **Check logs**:
   - Your app's console logs (when ngrok is running)
   - Shopify's webhook logs
   - Browser console logs (F12 → Console tab)

---

## ✅ **SUMMARY**

**Problem**: Old CarrierService with no callback URL → "Shipping not available" error

**Solution**: 
1. Delete old CarrierServices from Shopify Admin
2. Create new CarrierService with correct DEV callback URL
3. Test checkout

**Result**: Customers can now see shipping options and complete orders! 🎉

---

**Last Updated**: 2025-11-18
**Your Shopify Store**: mayu-12351.myshopify.com
**Your DEV Callback URL**: https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/dev/shopify/carrier/rates


