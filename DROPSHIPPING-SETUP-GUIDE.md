# 🚀 ADVANCED DROPSHIPPING SETUP GUIDE
## Option 2: Your App Provides Shipping Rates

---

## 🎯 **WHAT YOU'RE BUILDING**

An advanced dropshipping app where:
- Store owners install YOUR app
- YOU push products to THEIR stores via API
- YOUR app provides shipping rates (via NimbusPost)
- Customers see YOUR shipping options at checkout
- Orders come to YOU for fulfillment

---

## ✅ **CURRENT STATUS**

### **What's Already Done:**

1. ✅ **OAuth Integration** - Store can connect to your app
2. ✅ **Product API** - You can push products to Shopify
3. ✅ **CarrierService Created** - "Deeprintz Shipping (DEV)" is registered
   - ID: `gid://shopify/DeliveryCarrierService/69264736323`
   - Callback URL: `https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/dev/shopify/carrier/rates`
4. ✅ **Shipping Endpoint** - Your API handles shipping rate requests
5. ✅ **NimbusPost Integration** - Fetches real courier rates
6. ✅ **Webhook Handling** - Receives orders automatically

---

## ⏸️ **WHAT'S PENDING**

### **One Manual Step Required:**

Add the CarrierService to a shipping zone so Shopify knows to call your API for rates.

---

## 📋 **COMPLETE SETUP STEPS**

### **STEP 1: Create Shipping Zone (If None Exists)**

1. Go to: https://mayu-12351.myshopify.com/admin/settings/shipping

2. Scroll to **"Shipping zones"** section

3. Click **"Create shipping zone"**

4. Configure:
   - **Name**: India
   - **Countries/Regions**: Click "Add countries" → Select "India"
   - Click **"Done"**

---

### **STEP 2: Add CarrierService to Zone**

This is where Shopify's UI can be confusing. Try **Method A** first:

#### **Method A: Via "Add rate" button**

1. In the shipping zone you created, look for **"Add rate"** button

2. Click it - you should see options:
   ```
   ○ Set up your own rates
   ● Use carrier or app to calculate rates  ← CLICK THIS
   ```

3. If you see a dropdown with carrier options:
   - Select: **"Deeprintz Shipping (DEV)"**
   - Click **"Done"**

4. ✅ Success! The zone should now show "Deeprintz Shipping (DEV)"

---

#### **Method B: Via Carrier Accounts Section**

If Method A doesn't work, try this:

1. On the Shipping and delivery page, scroll down

2. Look for sections named:
   - **"Apps and sales channels"**
   - **"Carrier accounts"**
   - **"Third-party carriers"**

3. You should see: **"Deeprintz Shipping (DEV)"**

4. Click on it or click a **"Manage"** button

5. Enable/activate it for your shipping zones

---

#### **Method C: Via Shopify Admin Search**

If you can't find it:

1. Press `Ctrl + K` (or `Cmd + K` on Mac)

2. Search for: "Carrier services"

3. You should see "Deeprintz Shipping (DEV)" in results

4. Click to manage it

---

### **STEP 3: Verify Setup**

After adding the CarrierService:

1. Go back to: Settings → Shipping and delivery

2. In your "India" shipping zone, you should see:
   ```
   India
   🇮🇳 India
   
   Deeprintz Shipping (DEV) (Rates provided by app)
   Calculated transit time • Carrier rate
   ```

3. ✅ If you see this, setup is complete!

---

## 🧪 **TESTING THE COMPLETE FLOW**

### **Test 1: Verify CarrierService Endpoint**

```bash
cd /home/ganesh/Documents/Deeprintz/dev/deeprintz-dev-api
node debug-shopify-shipping.js
```

Expected output:
```
✅ Ngrok endpoint accessible
✅ Shipping rates calculation working
✅ Returned 2 shipping options
```

---

### **Test 2: Checkout Test**

1. **Go to your store**: https://mayu-12351.myshopify.com

2. **Add product to cart**:
   - Find any product you created via API
   - Click "Add to Cart"
   - Click "Checkout"

3. **Enter shipping address**:
   ```
   First Name: Test
   Last Name: Customer
   Address: 123 Test Street
   City: New Delhi
   State: Delhi
   Postal Code: 110001
   Country: India
   Phone: +91 9999999999
   ```

4. **Click "Continue to shipping method"**

5. **Expected result**: You should see shipping options like:
   ```
   ○ Standard Delivery - ₹50.00
     3-5 business days
   
   ○ Express Delivery - ₹100.00
     1-2 business days
   ```

6. **Select an option** and proceed to payment

7. ✅ Success! Your advanced dropshipping is working!

---

## 🔧 **TROUBLESHOOTING**

### **Problem: "Shipping not available" error**

**Cause**: Shopify can't reach your callback URL

**Fix**:
1. Make sure ngrok is running:
   ```bash
   curl https://df5b0a4dbe35.ngrok-free.app/api/deeprintz/dev/shopify/carrier/rates/test
   ```
2. If error, restart ngrok and update URL in `config/shopify.js`
3. Re-run: `node setup-complete-shipping.js`

---

### **Problem: No shipping options appear**

**Cause**: CarrierService not added to shipping zone

**Fix**:
1. Check Shopify Admin → Settings → Shipping
2. Verify "Deeprintz Shipping (DEV)" is in the zone
3. If not, follow STEP 2 above again

---

### **Problem: Wrong rates showing**

**Cause**: NimbusPost API returning different rates

**Fix**:
1. Check NimbusPost credentials in code
2. Verify origin pincode is set correctly
3. Check logs in terminal for NimbusPost API response

---

## 🚀 **PRODUCTION DEPLOYMENT**

When you're ready to go live:

### **1. Update Configuration**

Edit `config/shopify.js`:
```javascript
NGROK_URL: 'https://your-production-domain.com',
ENVIRONMENT: 'live'
```

### **2. Update Shopify App Settings**

In Shopify Partner Dashboard:
- Update redirect URLs
- Update webhook URLs
- Use production domain instead of ngrok

### **3. Automatic Setup for New Stores**

When store owners install your app:

✅ **Automatic** (your code does this):
- OAuth authentication
- CarrierService registration
- Webhook subscriptions

⚠️ **Manual** (store owner does this):
- Add "Deeprintz Live Shipping Rates" to their shipping zone
- Configure products to use the shipping zone

### **4. Onboarding Instructions**

Provide store owners with:

```
After installing Deeprintz app:

1. Go to Settings → Shipping and delivery
2. In your shipping zone, click "Add rate"
3. Select "Use carrier or app to calculate rates"
4. Choose "Deeprintz Live Shipping Rates"
5. Click Done

Now your customers will see live shipping rates from Deeprintz!
```

---

## 📊 **HOW IT WORKS (Technical Flow)**

```
┌──────────────────────────────────────────────────────────────────┐
│                     COMPLETE FLOW DIAGRAM                         │
└──────────────────────────────────────────────────────────────────┘

1. STORE OWNER INSTALLS YOUR APP
   Store Owner → Clicks "Install Deeprintz"
              ↓
   Your OAuth URL
              ↓
   Store Owner → Approves scopes
              ↓
   Your authCallback endpoint
              ↓
   Store connection saved in database
              ↓
   CarrierService automatically registered ✅

2. YOU PUSH PRODUCTS VIA API
   Your Dashboard → "Push to Shopify"
                 ↓
   Your API → Shopify GraphQL: productCreate
           ↓
   Product appears on THEIR store ✅

3. CUSTOMER CHECKOUT (THIS IS THE NEW PART)
   Customer → Adds product to cart on THEIR store
           ↓
   Customer → Clicks "Checkout"
           ↓
   Customer → Enters shipping address (pincode: 110001)
           ↓
   Shopify → Looks for shipping rates
          ↓
   Shopify → Finds "Deeprintz Shipping (DEV)" CarrierService
          ↓
   Shopify → Calls YOUR API: POST /api/deeprintz/dev/shopify/carrier/rates
          ↓
          Headers: X-Shopify-Shop-Domain: their-store.myshopify.com
          Body: {
            rate: {
              destination: { postal_code: "110001" },
              items: [{ grams: 500, price: 16150 }]
            }
          }
          ↓
   YOUR API → Extracts postal code, weight, price
           ↓
   YOUR API → Calls NimbusPost API:
           POST /courier/serviceability
           {
             origin: "YOUR_WAREHOUSE_PINCODE",
             destination: "110001",
             weight: 500,
             payment_type: "prepaid"
           }
           ↓
   NimbusPost → Returns courier options:
             [
               { courier: "Delhivery", cost: 50, days: "3-5" },
               { courier: "Blue Dart", cost: 80, days: "1-2" }
             ]
           ↓
   YOUR API → Formats for Shopify:
           {
             rates: [
               {
                 service_name: "Standard Delivery",
                 total_price: "5000", (₹50 in cents)
                 currency: "INR",
                 description: "3-5 business days"
               },
               {
                 service_name: "Express Delivery",
                 total_price: "8000", (₹80 in cents)
                 currency: "INR",
                 description: "1-2 business days"
               }
             ]
           }
           ↓
   YOUR API → Returns to Shopify
           ↓
   Shopify → Shows options to customer ✅
          ↓
   Customer → Selects "Standard Delivery - ₹50"
           ↓
   Customer → Completes payment
           ↓
   Order placed! ✅

4. ORDER FULFILLMENT
   Shopify → Sends webhook: POST /webhooks/orders
          Topic: orders/create
          ↓
   YOUR API → Receives order webhook
           ↓
   YOUR API → Stores in database (woocommerce_orders)
           ↓
   YOUR API → Auto-fulfills order (GraphQL: fulfillmentCreate)
           ↓
   Your Production Team → Prints design
                       ↓
   Your Production Team → Creates shipment in NimbusPost
                       ↓
   Your Production Team → Ships via Delhivery
                       ↓
   Customer → Receives product ✅
```

---

## 🎯 **KEY POINTS**

1. ✅ **CarrierService is per-store**: Each store that installs your app gets their own CarrierService instance

2. ✅ **Callback URL is the same**: All stores call the same endpoint on YOUR server

3. ✅ **Shop identification**: Shopify sends `X-Shopify-Shop-Domain` header so you know which store is requesting rates

4. ✅ **Real-time rates**: Every checkout calls your API → NimbusPost → fresh rates

5. ✅ **Store owner setup**: One-time: they add your CarrierService to their shipping zone

6. ✅ **You control everything**: Shipping rates, fulfillment, tracking - all through your system

---

## 📞 **SUPPORT**

If you're stuck on adding CarrierService to shipping zone:

**Take screenshot showing**:
1. Full "Shipping and delivery" settings page
2. The shipping zone section
3. Any "Add rate" options you see

This will help identify the exact UI issue!

---

## ✅ **SUCCESS CHECKLIST**

- [ ] CarrierService created (Done ✅)
- [ ] Shipping zone exists
- [ ] CarrierService added to zone ⏸️ (In progress)
- [ ] Checkout test shows rates
- [ ] Order webhook received
- [ ] Order stored in database
- [ ] Production fulfillment working

---

**You're building an advanced dropshipping system! Once you add the CarrierService to the zone, you're done!** 🚀

**Current Status**: 90% complete, just need to add it to the shipping zone!

