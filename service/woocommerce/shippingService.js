const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const axios = require('axios');

class WooCommerceShippingService {
  constructor() {
    this.defaultConfig = {
      version: "wc/v3",
      timeout: 30000,
    };
  }

  // Initialize WooCommerce API client
  createClient(storeUrl, consumerKey, consumerSecret) {
    return new WooCommerceRestApi({
      url: storeUrl,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      version: this.defaultConfig.version,
      timeout: this.defaultConfig.timeout
    });
  }

  // Calculate shipping rates for WooCommerce
  async calculateShippingRates(storeConfig, shippingData) {
    try {
      console.log('🚚 Calculating shipping rates for WooCommerce:', shippingData);
      
      // Extract shipping parameters
      const { postCode, weight, orderAmount, paymentMode, items } = shippingData;
      
      // Call your existing shipping API
      const shippingResponse = await this.callShippingAPI({
        userId: storeConfig.userId,
        postCode,
        weight,
        orderAmount,
        paymentMode,
        items
      });

      if (shippingResponse.success && shippingResponse.data.shipping_options) {
        // Format shipping options for WooCommerce
        const formattedRates = this.formatShippingRatesForWooCommerce(
          shippingResponse.data.shipping_options,
          storeConfig
        );

        console.log('✅ Shipping rates calculated successfully:', formattedRates);
        
        return {
          success: true,
          rates: formattedRates,
          raw_data: shippingResponse.data
        };
      } else {
        throw new Error(shippingResponse.message || 'Failed to calculate shipping rates');
      }
    } catch (error) {
      console.error('❌ Error calculating shipping rates:', error);
      return {
        success: false,
        error: error.message,
        rates: []
      };
    }
  }

  // Call your existing shipping API
  async callShippingAPI(shippingData) {
    try {
      // This should point to your existing shipping calculation endpoint
      const response = await axios.post(
        `${process.env.API_BASE_URL || 'http://localhost:6996'}/api/shipping/calculate`,
        shippingData,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.API_TOKEN || ''}`
          },
          timeout: 10000
        }
      );

      return response.data;
    } catch (error) {
      console.error('Error calling shipping API:', error);
      
      // Fallback to mock data for testing
      if (process.env.NODE_ENV === 'development') {
        return this.getMockShippingData(shippingData);
      }
      
      throw error;
    }
  }

  // Format shipping rates for WooCommerce
  formatShippingRatesForWooCommerce(shippingOptions, storeConfig) {
    return shippingOptions.map((option, index) => ({
      id: `custom_shipping_${option.courier_id}`,
      title: `${option.courier_name} - ${option.delivery_time}`,
      cost: parseFloat(option.total_cost),
      method_id: 'custom_shipping',
      method_title: 'Custom Shipping',
      total: parseFloat(option.total_cost),
      meta_data: [
        {
          key: '_courier_id',
          value: option.courier_id
        },
        {
          key: '_courier_name',
          value: option.courier_name
        },
        {
          key: '_delivery_time',
          value: option.delivery_time
        },
        {
          key: '_estimated_delivery',
          value: option.estimated_delivery || ''
        },
        {
          key: '_shipping_cost',
          value: option.shipping_cost || option.total_cost
        },
        {
          key: '_cod_charge',
          value: option.cod_charge || 0
        }
      ],
      // WooCommerce specific fields
      method_description: `Delivered by ${option.courier_name} in ${option.delivery_time}`,
      enabled: true,
      settings: {
        title: {
          value: option.courier_name,
          id: 'title'
        },
        cost: {
          value: option.total_cost.toString(),
          id: 'cost'
        }
      }
    }));
  }

  // Update WooCommerce order with shipping information
  async updateOrderShipping(storeConfig, orderId, shippingRate) {
    try {
      console.log('🔄 Updating WooCommerce order shipping:', { orderId, shippingRate });
      
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      // Prepare shipping line data
      const shippingLine = {
        method_id: shippingRate.method_id,
        method_title: shippingRate.method_title,
        total: shippingRate.total.toString(),
        meta_data: shippingRate.meta_data
      };

      // Update the order
      const response = await client.put(`orders/${orderId}`, {
        shipping_lines: [shippingLine],
        meta_data: [
          {
            key: '_custom_shipping_rate',
            value: JSON.stringify(shippingRate)
          },
          {
            key: '_shipping_calculated_at',
            value: new Date().toISOString()
          }
        ]
      });

      if (response.status === 200) {
        console.log('✅ Order shipping updated successfully');
        return {
          success: true,
          order: response.data,
          shipping_line: shippingLine
        };
      } else {
        throw new Error('Failed to update order shipping');
      }
    } catch (error) {
      console.error('❌ Error updating order shipping:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get shipping zones and methods from WooCommerce
  async getShippingZones(storeConfig) {
    try {
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const response = await client.get('shipping/zones');
      
      if (response.status === 200) {
        return {
          success: true,
          zones: response.data
        };
      } else {
        throw new Error('Failed to fetch shipping zones');
      }
    } catch (error) {
      console.error('Error fetching shipping zones:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create or update shipping method in WooCommerce
  async createShippingMethod(storeConfig, zoneId, methodData) {
    try {
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const response = await client.post(`shipping/zones/${zoneId}/methods`, methodData);
      
      if (response.status === 201) {
        return {
          success: true,
          method: response.data
        };
      } else {
        throw new Error('Failed to create shipping method');
      }
    } catch (error) {
      console.error('Error creating shipping method:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Setup webhooks for automatic shipping calculation
  async setupShippingWebhooks(storeConfig) {
    try {
      console.log('🔗 Setting up WooCommerce shipping webhooks...');
      
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const webhookEndpoints = [
        {
          name: 'Order Created',
          topic: 'order.created',
          delivery_url: `${process.env.API_BASE_URL || 'http://localhost:6996'}/api/woocommerce/webhooks/order-created`,
          status: 'active'
        },
        {
          name: 'Order Updated',
          topic: 'order.updated',
          delivery_url: `${process.env.API_BASE_URL || 'http://localhost:6996'}/api/woocommerce/webhooks/order-updated`,
          status: 'active'
        },
        {
          name: 'Checkout Created',
          topic: 'checkout.created',
          delivery_url: `${process.env.API_BASE_URL || 'http://localhost:6996'}/api/woocommerce/webhooks/checkout-created`,
          status: 'active'
        }
      ];

      const createdWebhooks = [];

      for (const webhookData of webhookEndpoints) {
        try {
          const response = await client.post('webhooks', webhookData);
          
          if (response.status === 201) {
            createdWebhooks.push(response.data);
            console.log(`✅ Webhook created: ${webhookData.name}`);
          }
        } catch (webhookError) {
          console.log(`⚠️ Webhook ${webhookData.name} already exists or failed to create`);
        }
      }

      return {
        success: true,
        webhooks: createdWebhooks
      };
    } catch (error) {
      console.error('❌ Error setting up webhooks:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // List existing webhooks
  async listWebhooks(storeConfig) {
    try {
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const response = await client.get('webhooks');
      
      if (response.status === 200) {
        return {
          success: true,
          webhooks: response.data
        };
      } else {
        throw new Error('Failed to fetch webhooks');
      }
    } catch (error) {
      console.error('Error fetching webhooks:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete webhook
  async deleteWebhook(storeConfig, webhookId) {
    try {
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const response = await client.delete(`webhooks/${webhookId}`);
      
      if (response.status === 200) {
        return {
          success: true,
          message: 'Webhook deleted successfully'
        };
      } else {
        throw new Error('Failed to delete webhook');
      }
    } catch (error) {
      console.error('Error deleting webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Validate webhook signature
  validateWebhookSignature(payload, signature, secret) {
    try {
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('base64');
      
      return crypto.timingSafeEqual(
        Buffer.from(signature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  // Process webhook payload
  async processWebhook(webhookData, storeConfig) {
    try {
      console.log('📨 Processing WooCommerce webhook:', webhookData.topic);
      
      switch (webhookData.topic) {
        case 'order.created':
          return await this.processOrderCreated(webhookData, storeConfig);
        
        case 'order.updated':
          return await this.processOrderUpdated(webhookData, storeConfig);
        
        case 'checkout.created':
          return await this.processCheckoutCreated(webhookData, storeConfig);
        
        default:
          console.log('⚠️ Unknown webhook topic:', webhookData.topic);
          return { success: false, message: 'Unknown webhook topic' };
      }
    } catch (error) {
      console.error('❌ Error processing webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process order created webhook
  async processOrderCreated(webhookData, storeConfig) {
    try {
      const order = webhookData.data;
      console.log('🆕 Processing new order:', order.id);
      
      // Auto-calculate shipping if not already set
      if (!order.shipping_lines || order.shipping_lines.length === 0) {
        const shippingData = {
          postCode: order.billing.postcode,
          weight: this.calculateOrderWeight(order),
          orderAmount: parseFloat(order.total),
          paymentMode: order.payment_method === 'cod' ? 'cod' : 'prepaid',
          items: order.line_items.map(item => ({
            name: item.name,
            quantity: item.quantity,
            weight: item.weight || 500 // Default weight in grams
          }))
        };

        const shippingRates = await this.calculateShippingRates(storeConfig, shippingData);
        
        if (shippingRates.success && shippingRates.rates.length > 0) {
          // Use the first (cheapest) shipping option
          const selectedRate = shippingRates.rates[0];
          await this.updateOrderShipping(storeConfig, order.id, selectedRate);
          
          return {
            success: true,
            message: 'Order shipping calculated and updated automatically',
            shipping_rate: selectedRate
          };
        }
      }

      return {
        success: true,
        message: 'Order processed successfully'
      };
    } catch (error) {
      console.error('❌ Error processing order created webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process order updated webhook
  async processOrderUpdated(webhookData, storeConfig) {
    try {
      const order = webhookData.data;
      console.log('🔄 Processing order update:', order.id);
      
      // Handle shipping method changes
      if (order.shipping_lines && order.shipping_lines.length > 0) {
        const shippingLine = order.shipping_lines[0];
        
        // Update your system with the new shipping information
        console.log('📦 Shipping method updated:', shippingLine);
      }

      return {
        success: true,
        message: 'Order update processed successfully'
      };
    } catch (error) {
      console.error('❌ Error processing order updated webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Process checkout created webhook
  async processCheckoutCreated(webhookData, storeConfig) {
    try {
      const checkout = webhookData.data;
      console.log('🛒 Processing checkout created:', checkout.id);
      
      // This is where you can implement real-time shipping calculation
      // during the checkout process
      
      return {
        success: true,
        message: 'Checkout processed successfully'
      };
    } catch (error) {
      console.error('❌ Error processing checkout created webhook:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Calculate order weight from line items
  calculateOrderWeight(order) {
    let totalWeight = 0;
    
    if (order.line_items && order.line_items.length > 0) {
      order.line_items.forEach(item => {
        const itemWeight = parseFloat(item.weight || 500); // Default 500g per item
        totalWeight += itemWeight * item.quantity;
      });
    }
    
    return totalWeight;
  }

  // Mock shipping data for development/testing
  getMockShippingData(shippingData) {
    console.log('🧪 Using mock shipping data for development');
    
    return {
      success: true,
      data: {
        shipping_options: [
          {
            courier_id: 'delhivery',
            courier_name: 'Delhivery',
            delivery_time: '2-3 days',
            estimated_delivery: '2024-01-15',
            shipping_cost: 150,
            cod_charge: 0,
            total_cost: 150
          },
          {
            courier_id: 'bluedart',
            courier_name: 'Blue Dart',
            delivery_time: '1-2 days',
            estimated_delivery: '2024-01-14',
            shipping_cost: 250,
            cod_charge: 0,
            total_cost: 250
          },
          {
            courier_id: 'fedex',
            courier_name: 'FedEx',
            delivery_time: '3-4 days',
            estimated_delivery: '2024-01-16',
            shipping_cost: 120,
            cod_charge: 0,
            total_cost: 120
          }
        ]
      }
    };
  }

  // Test WooCommerce connection
  async testConnection(storeConfig) {
    try {
      const client = this.createClient(
        storeConfig.storeUrl,
        storeConfig.consumerKey,
        storeConfig.consumerSecret
      );

      const response = await client.get('system_status');
      
      if (response.status === 200) {
        return {
          success: true,
          store_info: {
            name: response.data.name,
            version: response.data.version,
            url: storeConfig.storeUrl,
            status: 'connected'
          }
        };
      } else {
        throw new Error('Failed to connect to WooCommerce store');
      }
    } catch (error) {
      console.error('WooCommerce connection test error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new WooCommerceShippingService();
