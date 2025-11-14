const axios = require('axios');

class ShopifyShippingService {
  constructor() {
    this.defaultConfig = {
      timeout: 30000,
      retries: 3
    };
  }

  // Calculate shipping rates for Shopify using WooCommerce API
  async calculateShippingRates(shopifyData) {
    try {
      console.log('🚚 Calculating shipping rates for Shopify:', shopifyData);
      
      const { 
        postCode, 
        weight, 
        orderAmount, 
        paymentMode = 'prepaid',
        items = [],
        userId,
        shopDomain
      } = shopifyData;
      
      // Validate required fields
      if (!postCode || !weight || !orderAmount) {
        throw new Error('Missing required fields: postCode, weight, orderAmount');
      }

      // Call your existing WooCommerce shipping API
      const shippingResponse = await this.callWooCommerceShippingAPI({
        postCode,
        weight,
        orderAmount,
        paymentMode,
        items,
        userId
      });

      if (shippingResponse.success && shippingResponse.data.shipping_options) {
        // Format shipping options for Shopify
        const formattedRates = this.formatShippingRatesForShopify(
          shippingResponse.data.shipping_options,
          shopifyData
        );

        console.log('✅ Shopify shipping rates calculated successfully:', formattedRates);
        
        return {
          success: true,
          rates: formattedRates,
          raw_data: shippingResponse.data
        };
      } else {
        throw new Error(shippingResponse.message || 'Failed to calculate shipping rates');
      }
    } catch (error) {
      console.error('❌ Error calculating Shopify shipping rates:', error);
      return {
        success: false,
        error: error.message,
        rates: []
      };
    }
  }

  // Call your existing WooCommerce shipping API
  async callWooCommerceShippingAPI(shippingData) {
    try {
      const apiUrl = `${process.env.API_BASE_URL || 'https://devapi.deeprintz.com'}/api/deeprintz/live/woocommerce/shipping/calculate`;
      
      console.log('📡 Calling WooCommerce shipping API:', apiUrl);
      console.log('📦 Shipping data:', shippingData);

      const response = await axios.post(apiUrl, shippingData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: this.defaultConfig.timeout
      });

      console.log('📡 WooCommerce API Response:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ WooCommerce shipping API error:', error.response?.data || error.message);
      throw new Error(`Shipping API error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Format shipping rates for Shopify checkout
  formatShippingRatesForShopify(shippingOptions, shopifyData) {
    const formattedRates = [];

    shippingOptions.forEach((option, index) => {
      const rate = {
        service_name: option.courier_name || `Shipping Option ${index + 1}`,
        service_code: option.courier_id || `shipping_${index + 1}`,
        total_price: this.convertToShopifyPrice(option.shipping_cost),
        currency: 'INR',
        min_delivery_date: this.calculateMinDeliveryDate(option.estimated_delivery),
        max_delivery_date: this.calculateMaxDeliveryDate(option.estimated_delivery),
        description: this.generateShippingDescription(option),
        // Shopify-specific fields
        phone_required: false,
        delivery_category: 'standard',
        // Custom metadata
        _metadata: {
          courier_id: option.courier_id,
          estimated_delivery: option.estimated_delivery,
          cod_charge: option.cod_charge || 0,
          original_cost: option.shipping_cost,
          postcode: shopifyData.postCode
        }
      };

      formattedRates.push(rate);
    });

    return formattedRates;
  }

  // Convert price to Shopify format (in paise/cents)
  convertToShopifyPrice(price) {
    // Convert to paise (multiply by 100)
    return Math.round(parseFloat(price) * 100);
  }

  // Calculate minimum delivery date
  calculateMinDeliveryDate(estimatedDelivery) {
    if (!estimatedDelivery) return null;
    
    const today = new Date();
    const days = parseInt(estimatedDelivery.split(' ')[0]) || 3;
    const minDate = new Date(today.getTime() + (days * 24 * 60 * 60 * 1000));
    
    return minDate.toISOString().split('T')[0];
  }

  // Calculate maximum delivery date
  calculateMaxDeliveryDate(estimatedDelivery) {
    if (!estimatedDelivery) return null;
    
    const today = new Date();
    const days = parseInt(estimatedDelivery.split(' ')[0]) || 3;
    const maxDate = new Date(today.getTime() + ((days + 2) * 24 * 60 * 60 * 1000));
    
    return maxDate.toISOString().split('T')[0];
  }

  // Generate shipping description
  generateShippingDescription(option) {
    let description = `${option.courier_name}`;
    
    if (option.estimated_delivery) {
      description += ` - ${option.estimated_delivery}`;
    }
    
    if (option.cod_charge && option.cod_charge > 0) {
      description += ` (COD Charge: ₹${option.cod_charge})`;
    }
    
    return description;
  }

  // Create Shopify shipping rate response
  createShopifyShippingResponse(rates) {
    return {
      rates: rates.map(rate => ({
        service_name: rate.service_name,
        service_code: rate.service_code,
        total_price: rate.total_price,
        currency: rate.currency,
        min_delivery_date: rate.min_delivery_date,
        max_delivery_date: rate.max_delivery_date,
        description: rate.description,
        phone_required: rate.phone_required,
        delivery_category: rate.delivery_category
      }))
    };
  }

  // Validate Shopify webhook data
  validateShopifyWebhookData(webhookData) {
    const { destination, items } = webhookData;
    
    if (!destination || !destination.postal_code) {
      throw new Error('Missing destination postal code');
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Missing or invalid items array');
    }
    
    return true;
  }

  // Extract shipping data from Shopify webhook
  extractShippingDataFromWebhook(webhookData) {
    const { destination, items } = webhookData;
    
    // Calculate total weight and amount
    let totalWeight = 0;
    let totalAmount = 0;
    const itemDetails = [];
    
    items.forEach(item => {
      const weight = item.grams || 0;
      const price = parseFloat(item.price) || 0;
      const quantity = item.quantity || 1;
      
      totalWeight += weight * quantity;
      totalAmount += price * quantity;
      
      itemDetails.push({
        id: item.id,
        name: item.name,
        weight: weight,
        price: price,
        quantity: quantity
      });
    });
    
    return {
      postCode: destination.postal_code,
      weight: totalWeight,
      orderAmount: totalAmount,
      items: itemDetails,
      destination: destination
    };
  }
}

module.exports = new ShopifyShippingService();
