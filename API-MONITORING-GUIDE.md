# 🔍 How to Monitor Shopify Shipping APIs

## 📊 **Multiple Ways to Track API Calls**

### **Method 1: Server Console Logs (Real-time)**

When your server is running, you'll see detailed logs like this:

```bash
🚚 Shopify shipping calculation request: { postCode: '641603', weight: 500, orderAmount: 1000 }
📡 Headers: { 'x-shopify-shop-domain': 'your-store.myshopify.com', 'user-agent': 'Mozilla/5.0...' }
🕐 Timestamp: 2024-01-15T10:30:45.123Z
🌐 Client IP: 192.168.1.100
🖥️ User Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
✅ Shopify shipping calculation successful for 641603: 3 options found
📤 Response sent: { "rates": [...] }
⏱️ Response time: 1250ms
```

### **Method 2: Browser Developer Tools**

1. **Open your Shopify store**
2. **Press F12** to open Developer Tools
3. **Go to Network tab**
4. **Add products to cart and go to checkout**
5. **Enter a pincode**
6. **Look for these API calls:**

```
🔍 API Calls to Monitor:
├── /api/shopify/shipping/calculate (POST)
├── /api/shopify/app-proxy/shipping/calculate (GET)  
├── /api/shopify/app-proxy/shipping/script (GET)
└── /cart.js (GET) - Shopify's cart API
```

### **Method 3: Using the Monitoring Script**

```bash
# Start monitoring
node monitor-shopify-apis.js

# View statistics only
node monitor-shopify-apis.js --stats

# Test endpoints
node monitor-shopify-apis.js --test
```

### **Method 4: Direct API Testing**

```bash
# Test main shipping API
curl -X POST https://devapi.deeprintz.com/api/shopify/shipping/calculate \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Shop-Domain: your-store.myshopify.com" \
  -d '{
    "postCode": "641603",
    "weight": 500,
    "orderAmount": 1000,
    "paymentMode": "prepaid",
    "userId": "1039"
  }'

# Test app proxy API
curl -X GET "https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/calculate?postCode=641603&weight=500&orderAmount=1000&paymentMode=prepaid&userId=1039"

# Test script serving
curl -X GET "https://devapi.deeprintz.com/api/shopify/app-proxy/shipping/script?userId=1039&shop=your-store.myshopify.com"
```

### **Method 5: Check Server Logs**

```bash
# Monitor application logs
tail -f /var/log/your-app.log | grep -E "(shipping|shopify)"

# Check nginx access logs
tail -f /var/log/nginx/access.log | grep -E "(shipping|shopify)"

# Check error logs
tail -f /var/log/nginx/error.log | grep -E "(shipping|shopify)"
```

## 🎯 **What to Look For**

### **✅ Successful API Calls:**
- Status: 200 OK
- Response contains shipping rates
- Response time < 2 seconds
- No errors in console

### **❌ Failed API Calls:**
- Status: 400, 401, 404, 500
- Error messages in response
- Long response times
- Console errors

### **📊 Key Metrics:**
- **Response Time**: Should be < 2 seconds
- **Success Rate**: Should be > 95%
- **Error Rate**: Should be < 5%
- **Pincode Coverage**: Track which pincodes work

## 🔧 **Troubleshooting Common Issues**

### **Issue: "No API calls appearing"**
- Check if server is running
- Verify script is loaded in browser
- Check browser console for errors
- Test API endpoints directly

### **Issue: "API returns 404"**
- Check if routes are registered
- Verify URL paths are correct
- Check server logs for routing errors

### **Issue: "API returns 401"**
- Check X-Shopify-Shop-Domain header
- Verify shop domain format
- Check authentication middleware

### **Issue: "Slow response times"**
- Check NimbusPost API response time
- Monitor server resources
- Check database connection
- Verify network connectivity

## 📈 **Performance Monitoring**

### **Expected Performance:**
- **API Response Time**: 1-2 seconds
- **NimbusPost API**: 500-1000ms
- **Database Queries**: < 100ms
- **Total Processing**: < 2 seconds

### **Monitoring Commands:**
```bash
# Monitor in real-time
node monitor-shopify-apis.js

# Check specific endpoint
curl -w "@curl-format.txt" -X POST https://devapi.deeprintz.com/api/shopify/shipping/calculate

# Test with different pincodes
for pincode in 641603 400001 560001 110001; do
  echo "Testing pincode: $pincode"
  curl -X POST https://devapi.deeprintz.com/api/shopify/shipping/calculate \
    -H "Content-Type: application/json" \
    -d "{\"postCode\":\"$pincode\",\"weight\":500,\"orderAmount\":1000,\"userId\":\"1039\"}"
done
```

## 🎉 **Success Indicators**

When everything is working correctly, you'll see:

1. **Browser Console**: `🚀 Initializing Deeprintz Shipping Integration`
2. **Network Tab**: API calls to your shipping endpoints
3. **Server Logs**: Detailed request/response logging
4. **Checkout Page**: Shipping calculator with options
5. **Response Times**: < 2 seconds for shipping calculation

Your APIs are being triggered successfully! 🚚✨
