require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const app = express();
const cors = require("cors");
const helmet = require('helmet');
const { dbCheck } = require("./middleware/connection/dbCheck");
const session = require('express-session');



// REMOVE THIS BLOCK - it overwrites the Shopify OAuth cookie and breaks OAuth!
// app.use((req, res, next) => {
//   res.setHeader(
//     'Set-Cookie',
//     `shopify_app_session=...; Path=/; Secure; SameSite=None; HttpOnly`
//   );
//   next();
// });

// Perfect CORS setup for Shopify OAuth
app.use(cors({ 
  credentials: true,
  origin: true // Allow all origins for development
}));





app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));



const http = require('http');
const { Server } = require('socket.io');
const { processInvoice } = require("./utils/invoiceHelper");
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  }
});

//io.origins('*:*');

io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for messages from client dashboard
  socket.on('clientMessage', (message) => {
    console.log('Client Message:', message);
    // Broadcast the message to admin interface
    socket.broadcast.emit('adminMessage', message);
  });

  // Listen for messages from admin interface
  socket.on('adminMessage', (message) => {
    console.log('Admin Message:', message);
    // Broadcast the message to client dashboard
    socket.broadcast.emit('clientMessage', message);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});



// processInvoice()


// ✅ FIXED: Removed conflicting webhook middleware - now handled in routes/router.js
// Each webhook route has its own express.raw() middleware for proper HMAC verification

// 🎯 STEP 1: HTTP Keep-Alive optimization (Official Shopify recommendation)
// "Shopify's webhook delivery system uses HTTP Keep-Alive to reuse connections"
app.use((req, res, next) => {
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Keep-Alive', 'timeout=5, max=1000');
  next();
});

app.use(express.json());




app.use(helmet())

app.use(dbCheck);




const PORT = 6969

// WooCommerce Shipping Integration Routes
const WooCommerceShippingController = require('./controllers/woocommerceShippingController');

// Shipping calculation endpoint
app.post('/api/woocommerce/shipping/calculate', async (req, res) => {
  await WooCommerceShippingController.calculateShipping(req, res);
});

// Update order shipping endpoint
app.post('/api/woocommerce/shipping/update-order', async (req, res) => {
  await WooCommerceShippingController.updateOrderShipping(req, res);
});

// Webhook setup endpoint
app.post('/api/woocommerce/webhooks/setup', async (req, res) => {
  await WooCommerceShippingController.setupWebhooks(req, res);
});

// List webhooks endpoint
app.get('/api/woocommerce/webhooks/list', async (req, res) => {
  await WooCommerceShippingController.listWebhooks(req, res);
});

// Delete webhook endpoint
app.delete('/api/woocommerce/webhooks/:webhookId', async (req, res) => {
  await WooCommerceShippingController.deleteWebhook(req, res);
});

// Test connection endpoint
app.post('/api/woocommerce/test-connection', async (req, res) => {
  await WooCommerceShippingController.testConnection(req, res);
});

// Get shipping zones endpoint
app.get('/api/woocommerce/shipping/zones', async (req, res) => {
  await WooCommerceShippingController.getShippingZones(req, res);
});

// Create shipping method endpoint
app.post('/api/woocommerce/shipping/methods', async (req, res) => {
  await WooCommerceShippingController.createShippingMethod(req, res);
});

// Webhook endpoints (these need raw body parsing for signature validation)
app.post('/api/woocommerce/webhooks/order-created', express.raw({ type: 'application/json' }), async (req, res) => {
  await WooCommerceShippingController.handleOrderCreatedWebhook(req, res);
});

app.post('/api/woocommerce/webhooks/order-updated', express.raw({ type: 'application/json' }), async (req, res) => {
  await WooCommerceShippingController.handleOrderUpdatedWebhook(req, res);
});

app.post('/api/woocommerce/webhooks/checkout-created', express.raw({ type: 'application/json' }), async (req, res) => {
  await WooCommerceShippingController.handleCheckoutCreatedWebhook(req, res);
});

// Use the same server for both Express app and Socket.IO
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
  console.log(`WebSocket server available on ws://localhost:${PORT}`);
});

require("./apigateway/gateway")(app);

