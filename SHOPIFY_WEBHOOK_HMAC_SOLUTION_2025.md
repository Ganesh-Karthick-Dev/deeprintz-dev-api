# Shopify Webhook HMAC Verification Solution - 2025 Standards

## Problem Summary
The Shopify Partners Dashboard test "Verifies webhooks with HMAC signatures" is failing because:

1. **Missing API Secret**: The `SHOPIFY_API_SECRET` environment variable is not set on the server
2. **Wrong Secret**: The code was falling back to `SHOPIFY_CLIENT_SECRET` which is incorrect for webhook verification
3. **Implementation Issues**: The webhook handlers needed updates to follow Shopify's 2025 standards exactly

## Critical Understanding: API Secret vs Client Secret

### What You Need:
- **API Secret Key** (for webhook HMAC verification) - Found in Partners Dashboard under "API credentials"
- **NOT the Client Secret** (OAuth client secret) - This is different and won't work for webhooks

### Where to Find Your API Secret:
1. Log in to Shopify Partners Dashboard
2. Navigate to your app
3. Go to "Configuration" or "API credentials"
4. Look for **"API secret key"** (NOT "Client secret")
5. This is the value you need for `SHOPIFY_API_SECRET`

## Solution Steps

### Step 1: Set the Environment Variable on Your Server

#### For Cloudways (Your Production Server):

1. Log in to Cloudways platform
2. Select your application
3. Go to "Application Settings" → "Environment Variables"
4. Add a new variable:
   - **Name**: `SHOPIFY_API_SECRET`
   - **Value**: Your API secret key from Partners Dashboard
5. Save and restart the application

#### For Local Development:

Create or update your `.env` file:
```env
# Shopify App Credentials
SHOPIFY_API_KEY=your_api_key_here
SHOPIFY_API_SECRET=your_api_secret_key_here  # This is the API secret, NOT client secret!
SHOPIFY_CLIENT_SECRET=your_client_secret_here  # This is for OAuth, not webhooks
```

### Step 2: Verify the Implementation (Already Updated)

The webhook handlers have been updated to:
1. Use `SHOPIFY_API_SECRET` exclusively for HMAC verification
2. Properly handle raw body from `express.raw()` middleware
3. Use timing-safe comparison for security
4. Return empty 200 response on success
5. Return 401 on HMAC failure

### Step 3: Test the Webhooks

#### Quick Test Script:
```bash
#!/bin/bash
# Test webhook HMAC verification

# Your webhook URL
WEBHOOK_URL="https://devapi.deeprintz.com/api/deeprintz/live/customerRequest"

# Test payload
PAYLOAD='{"shop_id":123456789,"shop_domain":"test-shop.myshopify.com","customer":{"id":1234567890,"email":"test@example.com"}}'

# Your API secret (use the actual value)
API_SECRET="your_actual_api_secret_here"

# Calculate HMAC
HMAC=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$API_SECRET" -binary | base64)

# Send test webhook
curl -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "X-Shopify-Hmac-SHA256: $HMAC" \
  -d "$PAYLOAD" \
  -v
```

### Step 4: Monitor Server Logs

When Shopify's test runs, check your server logs for:
```
🔒 Customer Data Request webhook received
🔑 Using webhook secret (first 8 chars): xxxxxxxx...
✅ Webhook HMAC verified successfully!
```

If you see:
```
❌ SHOPIFY_API_SECRET not set!
```
Then the environment variable is not properly set on your server.

## Common Issues and Solutions

### Issue 1: "SHOPIFY_API_SECRET not set"
**Solution**: The environment variable is missing. Set it on your server as described above.

### Issue 2: "Invalid webhook signature - HMAC verification failed"
**Solution**: The API secret is incorrect. Double-check you're using the API secret key, not the client secret.

### Issue 3: "No raw body available"
**Solution**: The express.raw() middleware is not properly configured. This should already be fixed in the router.

## Verification Checklist

- [ ] `SHOPIFY_API_SECRET` is set on production server (Cloudways)
- [ ] The value is the API secret key from Partners Dashboard (NOT client secret)
- [ ] Server has been restarted after setting environment variable
- [ ] Webhook routes use `express.raw()` middleware (already implemented)
- [ ] Webhook handlers return empty 200 response on success
- [ ] Webhook handlers return 401 on HMAC failure

## Final Testing

1. Deploy the updated code to your production server
2. Set the `SHOPIFY_API_SECRET` environment variable
3. Restart your application
4. Run the Partners Dashboard test again

The test should now pass with a green checkmark ✅

## Support

If the test still fails after following these steps:
1. Check server logs for specific error messages
2. Verify the API secret is correct (copy it fresh from Partners Dashboard)
3. Ensure no proxy or middleware is modifying the request body
4. Test with the provided test script to isolate issues

Remember: The most common cause of failure is using the wrong secret or not having the environment variable set properly on the production server. 