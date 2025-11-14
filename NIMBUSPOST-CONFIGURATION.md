# 🚚 NimbusPost Configuration Guide

## 🎯 **What You Need to Do**

**PERFECT!** You don't need to configure anything! 🎉

The system now has **NimbusPost integration built directly into the WooCommerce shipping functions** - no more function calls or HTTP requests needed!

## 🔧 **Step 1: Set Environment Variable**

### **Option A: No Configuration Needed!**
```bash
# Nothing to set! 🎉
```

### **Option B: Your .env File**
```bash
# WooCommerce Shipping Integration
# No special configuration needed - NimbusPost integration is built-in!
```

**Note**: You don't need to set anything - the system has NimbusPost integration built directly into the WooCommerce shipping functions!

## 🎯 **Step 2: Restart Your Application**

After setting the environment variable, restart your Node.js application:
```bash
# If using PM2
pm2 restart all

# If using systemd
sudo systemctl restart your-app

# If running directly
node index.js
```

## 🧪 **Step 3: Test the Configuration**

### **Test API Endpoint**
```bash
curl -X POST http://yourdomain.com/api/deeprintz/live/woocommerce/shipping/calculate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": 1039,
    "postCode": "642126",
    "weight": 500,
    "orderAmount": 550,
    "paymentMode": "prepaid"
  }'
```

### **Expected Response**
```json
{
  "success": true,
  "message": "Shipping charges calculated successfully",
  "data": {
    "shipping_options": [
      {
        "courier_id": "dtdc",
        "courier_name": "DTDC Express",
        "shipping_cost": 120,
        "cod_charge": 0,
        "total_cost": 120,
        "delivery_time": "3-5 days"
      }
    ]
  }
}
```

## 🚨 **If You Still Get Errors**

### **Error: "Failed to generate NimbusPost token"**
This means there's an issue with NimbusPost authentication.

**Solutions:**
1. **Check if NimbusPost API is accessible:**
   ```bash
   curl -X POST https://api.nimbuspost.com/v1/users/login \
     -H "Content-Type: application/json" \
     -d '{"email": "care+1201@deeprintz.com", "password": "3JfzKQpHsG"}'
   ```

2. **Verify the credentials are correct:**
   - Check the email and password in the code
   - Ensure NimbusPost service is working

3. **Check network connectivity:**
   ```javascript
   console.log('NimbusPost API response:', response.data);
   ```

## 🔍 **How It Works Now**

### **Before (Wrong Flow):**
1. Vendor pushes product → WooCommerce
2. Customer enters pincode → WooCommerce
3. WooCommerce calls API → **Tries to call getCourierPartners function** ❌
4. **Fails because of response object issues** ❌

### **After (Correct Flow):**
1. Vendor pushes product → WooCommerce ✅
2. Customer enters pincode → WooCommerce ✅
3. WooCommerce calls API → **Has NimbusPost integration built-in** ✅
4. **Generates token and fetches courier data directly** ✅
5. **Returns shipping rates to WooCommerce** ✅

## 🎉 **Result**

- ✅ **Vendors don't need NimbusPost tokens**
- ✅ **NimbusPost integration built directly into WooCommerce functions**
- ✅ **All vendors get shipping calculation automatically**
- ✅ **Shipping charges appear when customers enter pincode**
- ✅ **No more function call issues or response object problems**
- ✅ **Much faster and more reliable**
- ✅ **Self-contained shipping calculation**

## 📱 **Test the Complete Flow**

1. **No configuration needed!** 🎉
2. **Restart your application**
3. **Test with pincode `642126`**
4. **Shipping charges should appear automatically!**

---

**🎯 Goal**: Have NimbusPost integration built directly into WooCommerce shipping functions for ALL vendors automatically!

**🚚 Result**: Professional shipping experience with real-time rates from multiple courier partners, self-contained and reliable!
