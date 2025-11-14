# 🛠️ Shopify App Configuration - Step by Step Guide

## 📋 **What You Need to Do**

### **1. Shopify Partner Dashboard Setup**

#### **Step 1.1: Access Your App**
1. Go to https://partners.shopify.com/
2. Log in with your Shopify Partner account
3. Find your app in the dashboard
4. Click on your app name

#### **Step 1.2: Configure App Proxy**
1. In your app dashboard, go to **"App setup"**
2. Scroll down to **"App proxy"** section
3. Click **"Create app proxy"** or **"Edit"** if it exists
4. Fill in these details:
   ```
   Subpath prefix: tools
   Subpath: app-proxy  
   URL: https://devapi.deeprintz.com/tools/app-proxy
   ```
5. Click **"Save"**

### **2. Theme Integration (Choose One Method)**

#### **Method A: Automatic Integration (Easiest)**
✅ **No theme changes needed!**
- The script automatically loads on checkout/cart pages
- Works with any Shopify theme
- No manual configuration required

#### **Method B: Manual Theme Integration**
1. Go to **Shopify Admin > Online Store > Themes**
2. Click **"Actions" > "Edit code"**
3. Find `theme.liquid` file
4. Add this code before `</head>`:
   ```html
   <script src="https://devapi.deeprintz.com/tools/app-proxy/shipping/script?userId=1039&shop={{ shop.permanent_domain }}"></script>
   ```
5. Replace `YOUR_USER_ID` with your actual user ID
6. Click **"Save"**

### **3. Testing Your Integration**

#### **Step 3.1: Test API Endpoints**
```bash
# Test 1: Main shipping endpoint
curl -X POST https://devapi.deeprintz.com/api/shopify/shipping/calculate \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Shop-Domain: your-store.myshopify.com" \
  -d '{
    "postCode": "641603",
    "weight": 500,
    "orderAmount": 1000,
    "paymentMode": "prepaid",
    "userId": "123"
  }'

# Test 2: App proxy endpoint
curl -X GET "https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/calculate?postCode=641603&weight=500&orderAmount=1000&paymentMode=prepaid&userId=123"

# Test 3: Script serving
curl -X GET "https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/script?userId=123&shop=your-store.myshopify.com"
```

#### **Step 3.2: Test in Shopify Store**
1. **Add products to cart**
2. **Go to checkout page**
3. **Look for shipping calculator** (should appear automatically)
4. **Enter pincode** (try: 641603, 400001, 560001)
5. **Verify shipping options appear**

#### **Step 3.3: Check Browser Console**
1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for: `🚀 Initializing Deeprintz Shipping Integration`
4. No errors should appear

### **4. Troubleshooting Common Issues**

#### **Issue: "No shipping options available"**
- **Solution**: Try different pincodes (641603, 400001, 560001)
- **Reason**: Some pincodes may not have courier coverage

#### **Issue: Script not loading**
- **Check**: Browser console for errors
- **Verify**: App proxy URL is accessible
- **Test**: Script URL directly in browser

#### **Issue: API returns 404**
- **Check**: Server is running
- **Verify**: Routes are registered in router.js
- **Test**: API endpoints directly

#### **Issue: Authentication fails**
- **Check**: X-Shopify-Shop-Domain header
- **Verify**: Shop domain format (.myshopify.com)
- **Test**: With correct headers

### **5. Expected Results**

#### **✅ Successful Integration Shows:**
- Shipping calculator appears on checkout page
- Pincode input field with "Calculate" button
- Shipping options display with prices
- Loading spinner during calculation
- Error messages for invalid pincodes

#### **✅ API Response Format:**
```json
{
  "rates": [
    {
      "service_name": "DTDC Express",
      "service_code": "dtdc",
      "total_price": 12000,
      "description": "3-5 days delivery",
      "currency": "INR"
    }
  ]
}
```

### **6. Monitoring & Maintenance**

#### **Check Server Logs:**
```bash
# Monitor shipping requests
tail -f /var/log/your-app/shopify-shipping.log

# Check for errors
grep "ERROR" /var/log/your-app/shopify-shipping.log
```

#### **Monitor API Performance:**
- Response time should be < 2 seconds
- Success rate should be > 95%
- Error rate should be < 5%

## 🎯 **Quick Start Checklist**

- [ ] App proxy configured in Shopify Partner Dashboard
- [ ] Server running without errors
- [ ] API endpoints responding (test with curl)
- [ ] Script loading in browser (check console)
- [ ] Shipping calculator visible on checkout
- [ ] Pincode input working
- [ ] Shipping options displaying
- [ ] No console errors

## 🆘 **Need Help?**

If you encounter issues:

1. **Check the browser console** for JavaScript errors
2. **Check server logs** for API errors  
3. **Test API endpoints** directly with curl
4. **Verify app proxy URL** is accessible
5. **Try different pincodes** for testing

## 🎉 **Success!**

Once everything is working, your customers will see:
- Real-time shipping calculation on checkout
- Professional UI with your branding
- Multiple courier options with prices
- Seamless integration with Shopify

Your Shopify shipping integration is now live! 🚚✨
