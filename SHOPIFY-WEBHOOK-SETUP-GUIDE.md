# 📋 Shopify Webhook Setup Guide

## ✅ **NO MANUAL CONFIGURATION NEEDED!**

**You do NOT need to manually add webhooks in the Shopify Admin Dashboard!**

Webhooks are automatically registered when:
1. ✅ App is installed/reinstalled
2. ✅ OAuth callback completes successfully
3. ✅ The `registerOrderWebhooks()` function runs automatically

---

## 🎯 **How It Works**

### **Automatic Registration Flow:**

```
1. User installs app → OAuth starts
2. OAuth completes → authCallback() runs
3. authCallback() → registerOrderWebhooks() automatically
4. Webhooks registered → orders/create, orders/updated, orders/paid
```

### **Registered Webhooks:**

- **Topic**: `orders/create`
  - **URL**: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId={userId}`
  
- **Topic**: `orders/updated`
  - **URL**: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId={userId}`
  
- **Topic**: `orders/paid`
  - **URL**: `https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId={userId}`

---

## 🔍 **How to Verify Webhooks Are Registered**

### **Option 1: Shopify Partner Dashboard** (Recommended)

1. Go to https://partners.shopify.com/
2. Log in with your Partner account
3. Select your app ("Deeprintz")
4. Go to **"Configuration"** → **"Webhooks"** section
5. You should see:
   - ✅ `orders/create`
   - ✅ `orders/updated`
   - ✅ `orders/paid`

### **Option 2: Via API** (Advanced)

```bash
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
     https://myn11.myshopify.com/admin/api/2024-10/webhooks.json
```

### **Option 3: Check Server Logs**

After installing the app, check your server logs for:
```
✅ Webhook registered: orders/create
✅ Webhook registered: orders/updated
✅ Webhook registered: orders/paid
```

---

## 🔧 **Manual Registration (If Needed)**

If webhooks weren't registered automatically, you can manually trigger registration:

### **API Endpoint:**

```bash
POST https://devapi.deeprintz.com/api/deeprintz/live/shopify/webhooks/register
Content-Type: application/json

{
  "userId": "1039"
}
```

### **Response:**

```json
{
  "success": true,
  "message": "Webhooks registered successfully",
  "webhooks": [
    {
      "id": 123456789,
      "topic": "orders/create",
      "address": "https://devapi.deeprintz.com/api/deeprintz/live/shopify/orders/webhook?userId=1039"
    },
    ...
  ]
}
```

---

## 🚨 **Troubleshooting**

### **Problem: Webhooks not triggering**

**Solution 1: Reinstall the App**
1. Uninstall app from Shopify store
2. Reinstall the app
3. Webhooks will be registered automatically

**Solution 2: Manual Registration**
Use the manual registration endpoint above

**Solution 3: Check Webhook Status**
```bash
# List all webhooks
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
     https://myn11.myshopify.com/admin/api/2024-10/webhooks.json

# Check specific webhook
curl -H "X-Shopify-Access-Token: YOUR_TOKEN" \
     https://myn11.myshopify.com/admin/api/2024-10/webhooks/WEBHOOK_ID.json
```

### **Problem: Webhooks are registered but not receiving data**

**Check:**
1. ✅ Webhook URL is accessible (not blocked by firewall)
2. ✅ Webhook endpoint is returning 200 OK
3. ✅ Server logs show webhook requests
4. ✅ Order events are being triggered (create a test order)

### **Problem: "Webhook already exists" error**

**Solution:** This is normal! Shopify might return an error if webhook already exists. The code handles this gracefully and continues with other webhooks.

---

## 📝 **Important Notes**

1. **Webhooks are shop-specific** - Each shop needs its own webhook registration
2. **Webhooks persist** - They remain active even after app updates
3. **Webhook security** - HMAC signatures are verified automatically
4. **Database storage** - Webhook config is stored in `shopify_webhook_configs` table

---

## 🎉 **That's It!**

**No manual configuration needed in Shopify Admin Dashboard!**

The webhooks will:
- ✅ Register automatically on app install
- ✅ Handle order events automatically
- ✅ Store orders in your database
- ✅ Work with your existing order system

---

## 📞 **Need Help?**

Check:
1. Server logs for webhook registration messages
2. Shopify Partner Dashboard for webhook status
3. Database `shopify_webhook_configs` table for stored configs
4. Test order creation to trigger webhooks
