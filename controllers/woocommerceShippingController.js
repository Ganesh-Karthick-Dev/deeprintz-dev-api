const WooCommerceShippingService = require('../service/woocommerce/shippingService');

class WooCommerceShippingController {
  constructor() {
    this.shippingService = WooCommerceShippingService;
  }

  // Calculate shipping rates
  async calculateShipping(req, res) {
    try {
      console.log('🚚 WooCommerce shipping calculation request:', req.body);
      
      const { userId, postCode, weight, orderAmount, paymentMode, items } = req.body;
      
      // Validate required fields
      if (!postCode || !weight || !orderAmount) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: postCode, weight, orderAmount'
        });
      }

      // Get store configuration (you'll need to implement this based on your user system)
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Calculate shipping rates
      const shippingData = {
        postCode,
        weight,
        orderAmount,
        paymentMode: paymentMode || 'prepaid',
        items: items || []
      };

      const result = await this.shippingService.calculateShippingRates(storeConfig, shippingData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Shipping rates calculated successfully',
          data: {
            shipping_options: result.rates,
            calculation_time: new Date().toISOString(),
            postcode: postCode,
            weight: weight,
            order_amount: orderAmount
          }
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to calculate shipping rates'
        });
      }
    } catch (error) {
      console.error('❌ Error in calculateShipping:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Update order shipping
  async updateOrderShipping(req, res) {
    try {
      console.log('🔄 WooCommerce order shipping update request:', req.body);
      
      const { userId, orderId, shippingRate } = req.body;
      
      if (!userId || !orderId || !shippingRate) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, orderId, shippingRate'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Update order shipping
      const result = await this.shippingService.updateOrderShipping(storeConfig, orderId, shippingRate);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Order shipping updated successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to update order shipping'
        });
      }
    } catch (error) {
      console.error('❌ Error in updateOrderShipping:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Setup webhooks
  async setupWebhooks(req, res) {
    try {
      console.log('🔗 WooCommerce webhook setup request:', req.body);
      
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: userId'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Setup webhooks
      const result = await this.shippingService.setupShippingWebhooks(storeConfig);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Webhooks setup completed successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to setup webhooks'
        });
      }
    } catch (error) {
      console.error('❌ Error in setupWebhooks:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // List webhooks
  async listWebhooks(req, res) {
    try {
      console.log('📋 WooCommerce webhook list request:', req.query);
      
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // List webhooks
      const result = await this.shippingService.listWebhooks(storeConfig);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Webhooks retrieved successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to retrieve webhooks'
        });
      }
    } catch (error) {
      console.error('❌ Error in listWebhooks:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Delete webhook
  async deleteWebhook(req, res) {
    try {
      console.log('🗑️ WooCommerce webhook delete request:', req.params, req.query);
      
      const { webhookId } = req.params;
      const { userId } = req.query;
      
      if (!userId || !webhookId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameters: userId, webhookId'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Delete webhook
      const result = await this.shippingService.deleteWebhook(storeConfig, webhookId);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Webhook deleted successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to delete webhook'
        });
      }
    } catch (error) {
      console.error('❌ Error in deleteWebhook:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Test connection
  async testConnection(req, res) {
    try {
      console.log('🔍 WooCommerce connection test request:', req.body);
      
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required field: userId'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Test connection
      const result = await this.shippingService.testConnection(storeConfig);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Connection test successful',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Connection test failed'
        });
      }
    } catch (error) {
      console.error('❌ Error in testConnection:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Get shipping zones
  async getShippingZones(req, res) {
    try {
      console.log('🌍 WooCommerce shipping zones request:', req.query);
      
      const { userId } = req.query;
      
      if (!userId) {
        return res.status(400).json({
          success: false,
          message: 'Missing required parameter: userId'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Get shipping zones
      const result = await this.shippingService.getShippingZones(storeConfig);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Shipping zones retrieved successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to retrieve shipping zones'
        });
      }
    } catch (error) {
      console.error('❌ Error in getShippingZones:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Create shipping method
  async createShippingMethod(req, res) {
    try {
      console.log('➕ WooCommerce shipping method creation request:', req.body);
      
      const { userId, zoneId, methodData } = req.body;
      
      if (!userId || !zoneId || !methodData) {
        return res.status(400).json({
          success: false,
          message: 'Missing required fields: userId, zoneId, methodData'
        });
      }

      // Get store configuration
      const storeConfig = await this.getStoreConfig(userId);
      if (!storeConfig) {
        return res.status(400).json({
          success: false,
          message: 'Store configuration not found for this user'
        });
      }

      // Create shipping method
      const result = await this.shippingService.createShippingMethod(storeConfig, zoneId, methodData);
      
      if (result.success) {
        res.json({
          success: true,
          message: 'Shipping method created successfully',
          data: result
        });
      } else {
        res.status(400).json({
          success: false,
          message: result.error || 'Failed to create shipping method'
        });
      }
    } catch (error) {
      console.error('❌ Error in createShippingMethod:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  }

  // Webhook endpoint for order created
  async handleOrderCreatedWebhook(req, res) {
    try {
      console.log('📨 WooCommerce order created webhook received');
      
      // Validate webhook signature if needed
      const signature = req.headers['x-wc-webhook-signature'];
      if (signature && process.env.WOOCOMMERCE_WEBHOOK_SECRET) {
        const isValid = this.shippingService.validateWebhookSignature(
          JSON.stringify(req.body),
          signature,
          process.env.WOOCOMMERCE_WEBHOOK_SECRET
        );
        
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Process the webhook
      const webhookData = {
        topic: 'order.created',
        data: req.body
      };

      // Get store configuration from webhook data or use default
      const storeConfig = await this.getStoreConfigFromWebhook(req.body);
      if (storeConfig) {
        await this.shippingService.processWebhook(webhookData, storeConfig);
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('❌ Error processing order created webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Webhook endpoint for order updated
  async handleOrderUpdatedWebhook(req, res) {
    try {
      console.log('📨 WooCommerce order updated webhook received');
      
      // Validate webhook signature if needed
      const signature = req.headers['x-wc-webhook-signature'];
      if (signature && process.env.WOOCOMMERCE_WEBHOOK_SECRET) {
        const isValid = this.shippingService.validateWebhookSignature(
          JSON.stringify(req.body),
          signature,
          process.env.WOOCOMMERCE_WEBHOOK_SECRET
        );
        
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Process the webhook
      const webhookData = {
        topic: 'order.updated',
        data: req.body
      };

      // Get store configuration from webhook data or use default
      const storeConfig = await this.getStoreConfigFromWebhook(req.body);
      if (storeConfig) {
        await this.shippingService.processWebhook(webhookData, storeConfig);
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('❌ Error processing order updated webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Webhook endpoint for checkout created
  async handleCheckoutCreatedWebhook(req, res) {
    try {
      console.log('📨 WooCommerce checkout created webhook received');
      
      // Validate webhook signature if needed
      const signature = req.headers['x-wc-webhook-signature'];
      if (signature && process.env.WOOCOMMERCE_WEBHOOK_SECRET) {
        const isValid = this.shippingService.validateWebhookSignature(
          JSON.stringify(req.body),
          signature,
          process.env.WOOCOMMERCE_WEBHOOK_SECRET
        );
        
        if (!isValid) {
          console.error('❌ Invalid webhook signature');
          return res.status(401).json({ error: 'Invalid signature' });
        }
      }

      // Process the webhook
      const webhookData = {
        topic: 'checkout.created',
        data: req.body
      };

      // Get store configuration from webhook data or use default
      const storeConfig = await this.getStoreConfigFromWebhook(req.body);
      if (storeConfig) {
        await this.shippingService.processWebhook(webhookData, storeConfig);
      }

      res.status(200).json({ success: true, message: 'Webhook processed successfully' });
    } catch (error) {
      console.error('❌ Error processing checkout created webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // Get store configuration for a user
  async getStoreConfig(userId) {
    try {
      // This is a placeholder - you'll need to implement this based on your user system
      // You might store this in a database or configuration file
      
      // For now, return a default configuration
      // In production, you should fetch this from your database
      return {
        storeUrl: process.env.WOOCOMMERCE_STORE_URL || 'https://your-store.com',
        consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || 'your_consumer_key',
        consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || 'your_consumer_secret',
        userId: userId
      };
    } catch (error) {
      console.error('Error getting store config:', error);
      return null;
    }
  }

  // Get store configuration from webhook data
  async getStoreConfigFromWebhook(webhookData) {
    try {
      // Extract store information from webhook data
      // This might be in the webhook payload or you might need to infer it
      
      // For now, return a default configuration
      return {
        storeUrl: process.env.WOOCOMMERCE_STORE_URL || 'https://your-store.com',
        consumerKey: process.env.WOOCOMMERCE_CONSUMER_KEY || 'your_consumer_key',
        consumerSecret: process.env.WOOCOMMERCE_CONSUMER_SECRET || 'your_consumer_secret',
        userId: 'default'
      };
    } catch (error) {
      console.error('Error getting store config from webhook:', error);
      return null;
    }
  }
}

module.exports = new WooCommerceShippingController();
