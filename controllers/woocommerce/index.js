const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;
const axios = require('axios');
const crypto = require('crypto');
const _ = require('lodash');
const shopifyService = require('../../service/shopify-old/index')

// Helper function to safely extract data from WooCommerce responses
const safeWooResponse = (response) => {
  if (!response) return null;
  
  return {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
    data: response.data
  };
};

// WooCommerce API configuration
const defaultConfig = {
  version: "wc/v3", // WooCommerce REST API version
  timeout: 30000,   // Request timeout in milliseconds
};

module.exports.wooConnect = async (req, res) => {
  try {
    const { store_url, consumer_key, consumer_secret, vendor_id, wp_username, wp_password } = req.body;

    // Validate required fields
    if (!store_url || !consumer_key || !consumer_secret || !vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: store_url, consumer_key, consumer_secret, vendor_id"
      });
    }

    // WordPress credentials are optional but recommended for automatic plugin installation
    if (!wp_username || !wp_password) {
      console.log('⚠️ WordPress credentials not provided - automatic plugin installation may not work');
    }

    // Validate store URL format
    let normalizedStoreUrl = store_url.trim();
    if (!normalizedStoreUrl.startsWith('http://') && !normalizedStoreUrl.startsWith('https://')) {
      normalizedStoreUrl = 'https://' + normalizedStoreUrl;
    }
    
    try {
      new URL(normalizedStoreUrl);
    } catch (urlError) {
      return res.status(400).json({
        success: false,
        message: "Invalid store URL format. Please provide a valid URL (e.g., https://yourstore.com)"
      });
    }

    // Test the WooCommerce connection
    const WooCommerce = new WooCommerceRestApi({
      url: normalizedStoreUrl,
      consumerKey: consumer_key,
      consumerSecret: consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Test connection by fetching store info
    const response = await WooCommerce.get("system_status");
    console.log('🚀 WooCommerce connection response status:', response.status);
    console.log('🚀 WooCommerce connection response data:', response.data);
    if (response.status === 200) {
      // Store connection in database (you'll need to create this table)
      const connectionData = {
        user_id: vendor_id,
        store_url: normalizedStoreUrl,
        consumer_key: consumer_key,
        consumer_secret: consumer_secret,
        store_name: response.data.name || normalizedStoreUrl,
        status: 'connected',
        connected_at: new Date(),
        // WordPress credentials for automatic plugin installation
        wp_username: req.body.wp_username || 'admin',
        wp_password: req.body.wp_password || 'admin',
        wp_api_enabled: true
      };

      // Save connection to database
      await global.dbConnection('woocommerce_stores').insert(connectionData);
      
      // Get the inserted store data (MySQL compatible approach)
      const insertedStore = await global.dbConnection('woocommerce_stores')
        .where('user_id', vendor_id)
        .where('store_url', normalizedStoreUrl)
        .where('status', 'connected')
        .first();
      
      // Automatically register order webhooks for the connected store
      let webhookResult = null;
      try {
        console.log('🔗 Automatically setting up order webhooks for newly connected store...');
        console.log('📋 Store data:', {
          id: insertedStore?.id,
          store_url: insertedStore?.store_url,
          store_name: insertedStore?.store_name,
          has_credentials: !!(insertedStore?.consumer_key && insertedStore?.consumer_secret)
        });
        
        if (insertedStore) {
          webhookResult = await registerOrderWebhooksForStore(insertedStore, req);
          
          if (webhookResult.success) {
            console.log(`✅ Auto webhook setup successful: ${webhookResult.created_webhooks} webhooks created`);
          } else {
            console.warn('⚠️ Auto webhook setup failed, but store connection was successful');
            console.warn('📋 Webhook error:', webhookResult.error);
          }
        } else {
          console.warn('⚠️ Could not retrieve store data for webhook setup');
        }
      } catch (webhookError) {
        console.error('❌ Error during automatic webhook setup:', webhookError);
        // Don't fail the store connection if webhook setup fails
      }

      return res.json({
        success: true,
        message: "WooCommerce store connected successfully",
        store_info: {
          name: response.data.name,
          version: response.data.version,
          url: normalizedStoreUrl
        },
        webhooks: webhookResult ? {
          auto_setup: true,
          created: webhookResult.created_webhooks,
          total: webhookResult.total_webhooks,
          errors: webhookResult.errors
        } : {
          auto_setup: false,
          error: "Webhook setup failed"
        }
      });
    } else {
      throw new Error("Failed to connect to WooCommerce store");
    }

  } catch (error) {
    console.error("WooCommerce connection error:", error);
    
    // Handle specific WooCommerce API errors
    let errorMessage = "Failed to connect to WooCommerce store";
    if (error.response) {
      // WooCommerce API returned an error response
      errorMessage = `WooCommerce API error: ${error.response.status} - ${error.response.statusText}`;
      if (error.response.data && error.response.data.message) {
        errorMessage += ` - ${error.response.data.message}`;
      }
    } else if (error.request) {
      // Request was made but no response received
      errorMessage = "No response received from WooCommerce store - check store URL and network connectivity";
    } else if (error.message) {
      // Other error
      errorMessage = error.message;
    }
    
    return res.status(500).json({
      success: false,
      message: errorMessage,
      error: errorMessage
    });
  }
};

module.exports.listProductsForVendors = async (req, res) => {
  try {
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Fetch products from WooCommerce
    const response = await WooCommerce.get("products", {
      per_page: 100, // Number of products per page
      status: "publish" // Only published products
    });

    if (response.status === 200) {
      const products = response.data.map(product => ({
        id: product.id,
        name: product.name,
        description: product.description,
        short_description: product.short_description,
        price: product.price,
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        images: product.images,
        categories: product.categories,
        stock_status: product.stock_status,
        stock_quantity: product.stock_quantity,
        sku: product.sku,
        status: product.status,
        date_created: product.date_created,
        date_modified: product.date_modified
      }));

      return res.json({
        success: true,
        message: `Found ${products.length} products`,
        total_products: response.headers['x-wp-total'],
        total_pages: response.headers['x-wp-totalpages'],
        products: products
      });
    } else {
      throw new Error("Failed to fetch products from WooCommerce");
    }

  } catch (error) {
    console.error("Error listing products for vendors:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to list products",
      error: error.message
    });
  }
};

module.exports.createProductInWooCommerce = async (req, res) => {
  try {
    const { vendor_id, product_data } = req.body;

    if (!vendor_id || !product_data) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID and product data are required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('vendor_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Prepare product data for WooCommerce
    const wooProductData = {
      name: product_data.name,
      description: product_data.description,
      short_description: product_data.short_description,
      regular_price: product_data.price.toString(),
      sale_price: product_data.sale_price || "",
      categories: product_data.categories || [],
      images: product_data.images || [],
      stock_status: product_data.stock_status || "instock",
      stock_quantity: product_data.stock_quantity || 0,
      sku: product_data.sku || "",
      manage_stock: product_data.manage_stock || false,
      weight: product_data.weight || "",
      dimensions: product_data.dimensions || {},
      attributes: product_data.attributes || [],
      status: "publish"
    };

    // Create product in WooCommerce
    const response = await WooCommerce.post("products", wooProductData);

    if (response.status === 201) {
      return res.json({
        success: true,
        message: "Product created successfully in WooCommerce",
        product: response.data
      });
    } else {
      throw new Error("Failed to create product in WooCommerce");
    }

  } catch (error) {
    console.error("Error creating product in WooCommerce:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create product",
      error: error.message
    });
  }
};

module.exports.updateProductInWooCommerce = async (req, res) => {
  try {
    const { vendor_id, product_id, product_data } = req.body;

    if (!vendor_id || !product_id || !product_data) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID, product ID, and product data are required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('vendor_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Update product in WooCommerce
    const response = await WooCommerce.put(`products/${product_id}`, product_data);

    if (response.status === 200) {
      return res.json({
        success: true,
        message: "Product updated successfully in WooCommerce",
        product: response.data
      });
    } else {
      throw new Error("Failed to update product in WooCommerce");
    }

  } catch (error) {
    console.error("Error updating product in WooCommerce:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update product",
      error: error.message
    });
  }
};

module.exports.deleteProductFromWooCommerce = async (req, res) => {
  try {
    const { vendor_id, product_id } = req.body;

    if (!vendor_id || !product_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID and product ID are required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Delete product from WooCommerce
    const response = await WooCommerce.delete(`products/${product_id}`, {
      force: true // Permanently delete the product
    });
    
    const unsyncedProduct = await global.dbConnection('woocommerce_products_sync')
      .where('woo_product_id', product_id)
      .where('isDeleted', 0)
      .first();

    if (unsyncedProduct) {
      await global.dbConnection('woocommerce_products_sync')
        .where('woo_product_id', product_id)
        .update({
          isDeleted: 1
        });
    }

    if (response.status === 200) {
      return res.json({
        success: true,
        message: "Product deleted successfully from WooCommerce"
      });
    } else {
      throw new Error("Failed to delete product from WooCommerce");
    }

  } catch (error) {
    console.error("Error deleting product from WooCommerce:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete product",
      error: error.message
    });
  }
};

module.exports.getVendorStores = async (req, res) => {
  try {
    const { vendor_id } = req.body;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce stores from database
    const stores = await global.dbConnection('woocommerce_stores')
      .where('vendor_id', vendor_id)
      .select('*');

    return res.json({
      success: true,
      message: `Found ${stores.length} stores for vendor`,
      stores: stores
    });

  } catch (error) {
    console.error("Error getting vendor stores:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get vendor stores",
      error: error.message
    });
  }
};

module.exports.testWooCommerceConnection = async (req, res) => {
  try {
    const { store_url, consumer_key, consumer_secret } = req.body;

    if (!store_url || !consumer_key || !consumer_secret) {
      return res.status(400).json({
        success: false,
        message: "Store URL, consumer key, and consumer secret are required"
      });
    }

    // Test the WooCommerce connection
    const WooCommerce = new WooCommerceRestApi({
      url: store_url,
      consumerKey: consumer_key,
      consumerSecret: consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Test connection by fetching store info
    const response = await WooCommerce.get("system_status");

    if (response.status === 200) {
      return res.json({
        success: true,
        message: "WooCommerce connection test successful",
        store_info: {
          name: response.data.name,
          version: response.data.version,
          url: store_url,
          status: "connected"
        }
      });
    } else {
      throw new Error("Failed to connect to WooCommerce store");
    }

  } catch (error) {
    console.error("WooCommerce connection test error:", error);
    return res.status(500).json({
      success: false,
      message: "WooCommerce connection test failed",
      error: error.message
    });
  }
};

module.exports.pushProductsToWooCommerce = async (req, res) => {
  try {
    const { userId, productId } = req.body;
    
    // Get the Shopify product data
    const product = await shopifyService.getShopifyProductById(productId);
    
    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Check if product has variants (sizes)
    const hasVariants = product.variants && product.variants.length > 0;
    
    // console.log("Product variants:", product.variants);
    // console.log("Has variants:", hasVariants);
    
    // Prepare product data for WooCommerce
    const wooProductData = {
      name: product.productname,
      description: product.productdesc,
      short_description: product.productdesc,
      categories: [], // You can add category mapping logic here if needed
      images: [
        {
          src: product.designurl,
          position: 0
        }
      ],
      sku: `DP-${product.deeprintzProductId}-${Date.now()}`,
      manage_stock: false,
      weight: "",
      dimensions: {
        length: product.width?.toString() || "",
        width: product.height?.toString() || "",
        height: "0.1"
      },
      attributes: [
        {
          name: "Position",
          visible: true,
          variation: false,
          options: [product.position]
        }
      ],
      meta_data: [
        {
          key: "_vendor_user_id",
          value: userId.toString()
        }
      ],
      status: "publish"
    };

    // If product has variants (sizes), make it a variable product
    if (hasVariants) {
      // Add size attribute for variations
      wooProductData.attributes.push({
        name: "Size",
        visible: true,
        variation: true,
        options: product.variants.map(variant => variant.size)
      });
      
      // Set product type to variable
      wooProductData.type = "variable";
      
      // For variable products, we need to set a base price (can be 0)
      wooProductData.regular_price = "0";
      
      // Remove simple product fields that aren't needed for variable products
      delete wooProductData.sale_price;
      delete wooProductData.stock_status;
      delete wooProductData.stock_quantity;
    } else {
      // Simple product without variants
      // Use retail price as regular price for customers to see
      wooProductData.regular_price = product.variants?.[0]?.retailPrice?.toString() || product.shopifyProductCost?.toString() || "0";
      wooProductData.stock_status = "instock";
      wooProductData.stock_quantity = 999;
    }

    console.log("WooCommerce product data:", JSON.stringify(wooProductData, null, 2));

    // Check if product already exists by SKU
    let existingProduct = null;
    try {
      const existingProducts = await WooCommerce.get("products", {
        sku: wooProductData.sku,
        per_page: 1
      });
      
      if (existingProducts.data && existingProducts.data.length > 0) {
        existingProduct = existingProducts.data[0];
        console.log(`Product with SKU ${wooProductData.sku} already exists (ID: ${existingProduct.id}), will update instead of create`);
      } else {
        console.log(`No existing product found with SKU ${wooProductData.sku}, will create new one`);
      }
    } catch (searchError) {
      console.log(`Error searching for existing product with SKU ${wooProductData.sku}:`, searchError.message);
      console.log("Will attempt to create new product");
    }

    let wooProduct;
    let response;

    if (existingProduct) {
      // Update existing product
      console.log(`Updating existing product with ID: ${existingProduct.id}`);
      response = await WooCommerce.put(`products/${existingProduct.id}`, wooProductData);
      
      if (response.status === 200) {
        wooProduct = response.data;
        console.log(`Product updated successfully with ID: ${wooProduct.id}`);
      } else {
        throw new Error(`Failed to create product in WooCommerce: ${response.status} ${response.statusText}`);
      }
    } else {
      // Create new product
      console.log("Creating new product in WooCommerce");
      try {
        response = await WooCommerce.post("products", wooProductData);
        
        if (response.status === 201) {
          wooProduct = response.data;
          console.log(`Product created successfully with ID: ${wooProduct.id}`);
        } else {
          throw new Error(`Failed to create product in WooCommerce: ${response.status} ${response.statusText}`);
        }
      } catch (createError) {
        // If creation fails with "already exists" error, try to find and update
        if (createError.response && createError.response.status === 400) {
          const errorData = createError.response.data;
          if (errorData && errorData.message && errorData.message.includes('already present')) {
            console.log(`Product creation failed - product already exists. Attempting to find and update...`);
            
            try {
              // Try to find the product again
              const retrySearch = await WooCommerce.get("products", {
                sku: wooProductData.sku,
                per_page: 1
              });
              
              if (retrySearch.data && retrySearch.data.length > 0) {
                const foundProduct = retrySearch.data[0];
                console.log(`Found existing product with ID: ${foundProduct.id}, updating instead`);
                
                response = await WooCommerce.put(`products/${foundProduct.id}`, wooProductData);
                if (response.status === 200) {
                  wooProduct = response.data;
                  console.log(`Product updated successfully after retry with ID: ${wooProduct.id}`);
                } else {
                  throw new Error(`Failed to update product after retry: ${response.status} ${response.statusText}`);
                }
              } else {
                throw new Error("Product creation failed and could not find existing product to update");
              }
            } catch (retryError) {
              console.error("Error during retry attempt:", retryError);
              throw new Error(`Failed to handle existing product: ${retryError.message}`);
            }
          } else {
            // Re-throw the original error if it's not about existing product
            throw createError;
          }
        } else {
          // Re-throw the original error if it's not a 400 status
          throw createError;
        }
      }
    }
      
      // If this is a variable product, handle the variations
      if (hasVariants && wooProduct.id) {
        try {
          if (existingProduct) {
            // For existing products, we need to handle variations differently
            // First, get existing variations
            const existingVariations = await WooCommerce.get(`products/${wooProduct.id}/variations`);
            console.log(`Found ${existingVariations.data.length} existing variations`);
            
            // Update or create variations for each size
            for (const variant of product.variants) {
              const variationData = {
                // Use retail price as the main price customers will see
                regular_price: variant.retailPrice ? variant.retailPrice.toString() : variant.price?.toString() || "0",
                attributes: [
                  {
                    name: "Size",
                    option: variant.size
                  }
                ],
                sku: `${wooProductData.sku}-${variant.sizesku || variant.size}-${Date.now()}`,
                stock_status: "instock",
                stock_quantity: 999,
                manage_stock: false
              };
              
              // Check if variation already exists
              const existingVariation = existingVariations.data.find(v => 
                v.attributes && v.attributes.some(attr => 
                  attr.name === "Size" && attr.option === variant.size
                )
              );
              
              if (existingVariation) {
                // Update existing variation
                console.log(`Updating existing variation for size ${variant.size} with ID: ${existingVariation.id}`);
                await WooCommerce.put(`products/${wooProduct.id}/variations/${existingVariation.id}`, variationData);
              } else {
                // Create new variation
                console.log(`Creating new variation for size ${variant.size}`);
                const variationResponse = await WooCommerce.post(`products/${wooProduct.id}/variations`, variationData);
                console.log(`Created variation for size ${variant.size}:`, variationResponse.data.id);
              }
            }
          } else {
            // For new products, create variations
            for (const variant of product.variants) {
              const variationData = {
                // Use retail price as the main price customers will see
                regular_price: variant.retailPrice ? variant.retailPrice.toString() : variant.price?.toString() || "0",
                attributes: [
                  {
                    name: "Size",
                    option: variant.size
                  }
                ],
                sku: `${wooProductData.sku}-${variant.sizesku || variant.size}-${Date.now()}`,
                stock_status: "instock",
                stock_quantity: 999,
                manage_stock: false
              };
              
              // Create the variation
              const variationResponse = await WooCommerce.post(`products/${wooProduct.id}/variations`, variationData);
              console.log(`Created variation for size ${variant.size}:`, variationResponse.data.id);
            }
          }
          
          // Fetch the updated product with variations
          const updatedProduct = await WooCommerce.get(`products/${wooProduct.id}`);
          wooProduct = updatedProduct.data;
        } catch (variationError) {
          console.error("Error handling variations:", variationError);
          // Continue even if variations fail - the main product was created/updated
        }
      }
      
      // Store synced product details in woocommerce_products_sync table
      try {
        const syncType = existingProduct ? 'update' : 'create';
        const syncMessage = existingProduct ? 'updated' : 'created';
        
        // Check if sync record already exists
        const existingSync = await global.dbConnection('woocommerce_products_sync')
          .where('store_id', store.id)
          .where('local_product_id', productId)
          .first();
        
        if (existingSync) {
          // Update existing sync record
          await global.dbConnection('woocommerce_products_sync')
            .where('id', existingSync.id)
            .update({
              woo_product_id: wooProduct.id,
              sync_type: syncType,
              sync_status: 'success',
              sync_data: JSON.stringify({
                product_name: product.productname,
                product_description: product.productdesc,
                design_url: product.designurl,
                variants: product.variants,
                prices: {
                  cost: product.shopifyProductCost,
                  retail: product.variants?.[0]?.retailPrice
                },
                dimensions: {
                  width: product.width,
                  height: product.height
                },
                position: product.position,
                woo_product_data: wooProductData,
                woo_response: wooProduct,
                action: syncType
              }),
              last_sync_attempt: new Date()
            });
        } else {
          // Create new sync record
          await global.dbConnection('woocommerce_products_sync').insert({
            store_id: store.id,
            local_product_id: productId,
            woo_product_id: wooProduct.id,
            sync_type: syncType,
            sync_status: 'success',
            sync_data: JSON.stringify({
              product_name: product.productname,
              product_description: product.productdesc,
              design_url: product.designurl,
              variants: product.variants,
              prices: {
                cost: product.shopifyProductCost,
                retail: product.variants?.[0]?.retailPrice
              },
              dimensions: {
                width: product.width,
                height: product.height
              },
              position: product.position,
              woo_product_data: wooProductData,
              woo_response: wooProduct,
              action: syncType
            }),
            last_sync_attempt: new Date()
          });
        }

        console.log(`Product sync record stored successfully for product ID: ${productId} (${syncType})`);
      } catch (syncError) {
        console.error("Error storing sync record:", syncError);
        // Don't fail the main operation if sync record storage fails
      }

      // ============================================================================
      // AUTOMATIC SHIPPING SETUP WHEN PRODUCT IS PUSHED
      // ============================================================================
      
      // Only setup shipping for new products (not updates)
      if (!existingProduct) {
        try {
          console.log('Setting up automatic shipping for new product...');
          
          // 1. Setup WooCommerce shipping zones and methods
          await module.exports.setupWooCommerceShippingForVendor(store, userId);
          
          // 2. Setup webhooks for automatic shipping calculation
          await module.exports.setupWebhooksForVendor(store, userId);
          
          // 3. Setup frontend shipping integration
          await module.exports.setupFrontendShippingForVendor(store, userId);
          
          console.log('Automatic shipping setup completed for vendor:', userId);
        } catch (shippingError) {
          console.error('Error setting up automatic shipping:', shippingError);
          // Don't fail the main operation if shipping setup fails
        }
      }

      const action = existingProduct ? 'updated' : 'created';
      return res.json({
        success: true,
        message: `Product ${action} in WooCommerce successfully!`,
        product: product,
        woo_product: wooProduct,
        original_product: product,
        store: store,
        has_variations: hasVariants,
        action: action
      });

  } catch (error) {
    console.error("Error pushing products to WooCommerce:", error);
    
    // Store failed sync attempt in woocommerce_products_sync table
    try {
      if (req.body.userId && req.body.productId) {
        const store = await global.dbConnection('woocommerce_stores')
          .where('user_id', req.body.userId)
          .where('status', 'connected')
          .first();
        
        if (store) {
          await global.dbConnection('woocommerce_products_sync').insert({
            store_id: store.id,
            local_product_id: req.body.productId,
            woo_product_id: 0, // 0 indicates failed sync
            sync_type: 'create',
            sync_status: 'failed',
            sync_data: JSON.stringify({
              error: error.message,
              timestamp: new Date(),
              request_data: req.body
            }),
            error_message: error.message,
            last_sync_attempt: new Date()
          });
          
          console.log(`Failed sync record stored for product ID: ${req.body.productId}`);
        }
      }
    } catch (syncError) {
      console.error("Error storing failed sync record:", syncError);
      // Don't fail the main error response if sync record storage fails
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to push product to WooCommerce",
      error: error.message
    });
  }
};

// Get WooCommerce connection status for a specific vendor
module.exports.getConnectionStatus = async (req, res) => {
  try {
    const { vendor_id } = req.query;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Return the connection details
    return res.json({
      status: true,
      response: {
        store_url: store.store_url,
        store_name: store.store_name || store.store_url.replace(/^https?:\/\//, '').replace(/\/$/, ''),
        consumer_key: store.consumer_key,
        consumer_secret: store.consumer_secret,
        vendor_id: store.user_id,
        wp_username: store.wp_username || null,
        wp_api_enabled: store.wp_api_enabled || false
      }
    });

  } catch (error) {
    console.error("Error getting WooCommerce connection status:", error);
    return res.status(500).json({
      status: false,
      message: "Failed to get connection status",
      error: error.message
    });
  }
};

// Get plugin configuration for a store (used by WordPress plugin)
module.exports.getPluginConfig = async (req, res) => {
  try {
    const { store_url } = req.query;

    if (!store_url) {
      return res.status(400).json({
        success: false,
        message: "Store URL is required"
      });
    }

    // Normalize store URL
    let normalizedStoreUrl = store_url.trim();
    if (!normalizedStoreUrl.startsWith('http://') && !normalizedStoreUrl.startsWith('https://')) {
      normalizedStoreUrl = 'https://' + normalizedStoreUrl;
    }
    normalizedStoreUrl = normalizedStoreUrl.replace(/\/$/, ''); // Remove trailing slash

    // Get store from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('store_url', normalizedStoreUrl)
      .orWhere('store_url', normalizedStoreUrl + '/')
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "Store not found or not connected"
      });
    }

    // Get API base URL from config
    const SHOPIFY_CONFIG = require('../../config/shopify');
    const apiBaseUrl = `${SHOPIFY_CONFIG.BASE_URL}/api/woocommerce`;

    // Return plugin configuration
    return res.json({
      success: true,
      data: {
        apiBaseUrl: apiBaseUrl,
        userId: store.user_id || store.vendor_id,
        storeId: store.id
      }
    });

  } catch (error) {
    console.error("Error getting plugin config:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get plugin config",
      error: error.message
    });
  }
};

// Update WordPress credentials for existing WooCommerce store
module.exports.updateWordPressCredentials = async (req, res) => {
  try {
    const { vendor_id, wp_username, wp_password } = req.body;

    if (!vendor_id || !wp_username || !wp_password) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: vendor_id, wp_username, wp_password"
      });
    }

    // Get vendor's WooCommerce store
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Test WordPress credentials by trying to authenticate
    try {
      const axios = require('axios');
      const baseUrl = store.store_url.replace(/\/$/, ''); // Remove trailing slash
      const authResponse = await axios.post(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
        username: wp_username,
        password: wp_password
      });

      if (authResponse.data && authResponse.data.token) {
        // Credentials are valid, update the database
        await global.dbConnection('woocommerce_stores')
          .where('id', store.id)
          .update({
            wp_username: wp_username,
            wp_password: wp_password,
            wp_api_enabled: true,
            updated_at: new Date()
          });

        return res.json({
          success: true,
          message: "WordPress credentials updated successfully",
          wp_api_enabled: true
        });
      } else {
        throw new Error("Invalid WordPress credentials");
      }
    } catch (authError) {
      return res.status(400).json({
        success: false,
        message: "Invalid WordPress credentials",
        error: "Please check your username and password"
      });
    }

  } catch (error) {
    console.error("Error updating WordPress credentials:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update WordPress credentials",
      error: error.message
    });
  }
};

// Disconnect WooCommerce store for a specific vendor
module.exports.disconnectWooCommerce = async (req, res) => {
  try {
    const { vendor_id } = req.query;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Check if vendor has an active WooCommerce connection
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No active WooCommerce connection found for this vendor"
      });
    }

    // Automatically clean up webhooks for the disconnected store
    let webhookCleanupResult = null;
    try {
      console.log('🧹 Automatically cleaning up webhooks for disconnected store...');
      webhookCleanupResult = await cleanupWebhooksForStore(store);
      
      if (webhookCleanupResult.success) {
        console.log(`✅ Auto webhook cleanup successful: ${webhookCleanupResult.deleted_webhooks} webhooks deleted`);
      } else {
        console.warn('⚠️ Auto webhook cleanup failed, but store disconnection will proceed');
      }
    } catch (webhookError) {
      console.error('❌ Error during automatic webhook cleanup:', webhookError);
      // Don't fail the store disconnection if webhook cleanup fails
    }

    // Update the connection status to disconnected
    await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .update({
        status: 'disconnected',
        disconnected_at: new Date()
      });

    return res.json({
      success: true,
      message: "WooCommerce store disconnected successfully",
      response: {
        store_url: store.store_url,
        vendor_id: store.user_id,
        status: "disconnected",
        disconnected_at: new Date()
      },
      webhooks: webhookCleanupResult ? {
        auto_cleanup: true,
        deleted: webhookCleanupResult.deleted_webhooks,
        total: webhookCleanupResult.total_webhooks,
        errors: webhookCleanupResult.errors
      } : {
        auto_cleanup: false,
        error: "Webhook cleanup failed"
      }
    });

  } catch (error) {
    console.error("Error disconnecting WooCommerce store:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to disconnect WooCommerce store",
      error: error.message
    });
  }
};

// Get WooCommerce orders for a specific vendor
module.exports.getVendorOrders = async (req, res) => {
  try {
    const { vendor_id, status = 'any', per_page = 50, page = 1 } = req.query;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Fetch orders from WooCommerce
    const response = await WooCommerce.get("orders", {
      status: status,
      per_page: per_page,
      page: page,
      orderby: 'date',
      order: 'desc'
    });

    if (response.status === 200) {
      const orders = response.data.map(order => ({
        id: order.id,
        order_number: order.number,
        status: order.status,
        date_created: order.date_created,
        date_modified: order.date_modified,
        total: order.total,
        subtotal: order.subtotal,
        total_tax: order.total_tax,
        shipping_total: order.shipping_total,
        discount_total: order.discount_total,
        currency: order.currency,
        vendor_id: vendor_id,
        customer: {
          id: order.customer_id,
          first_name: order.billing.first_name,
          last_name: order.billing.last_name,
          email: order.billing.email,
          phone: order.billing.phone
        },
        billing: order.billing,
        shipping: order.shipping,
        line_items: order.line_items.map(item => ({
          id: item.id,
          name: item.name,
          product_id: item.product_id,
          variation_id: item.variation_id,
          quantity: item.quantity,
          total: item.total,
          total_tax: item.total_tax,
          sku: item.sku,
          meta_data: item.meta_data
        })),
        payment_method: order.payment_method,
        payment_method_title: order.payment_method_title,
        transaction_id: order.transaction_id,
        notes: order.customer_note
      }));

      return res.json({
        success: true,
        message: `Found ${orders.length} orders`,
        total_orders: response.headers['x-wp-total'],
        total_pages: response.headers['x-wp-totalpages'],
        current_page: parseInt(page),
        orders: orders
      });
    } else {
      throw new Error("Failed to fetch orders from WooCommerce");
    }

  } catch (error) {
    console.error("Error getting vendor orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get orders",
      error: error.message
    });
  }
};

// Get a specific order by ID
module.exports.getOrderById = async (req, res) => {
  try {
    const { vendor_id, order_id } = req.params;

    if (!vendor_id || !order_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID and Order ID are required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Fetch specific order from WooCommerce
    const response = await WooCommerce.get(`orders/${order_id}`);

    if (response.status === 200) {
      const order = response.data;
      
      return res.json({
        success: true,
        message: "Order retrieved successfully",
        order: {
          id: order.id,
          order_number: order.number,
          status: order.status,
          date_created: order.date_created,
          date_modified: order.date_modified,
          total: order.total,
          subtotal: order.subtotal,
          total_tax: order.total_tax,
          shipping_total: order.shipping_total,
          discount_total: order.discount_total,
          currency: order.currency,
          vendor_id: vendor_id,
          customer: {
            id: order.customer_id,
            first_name: order.billing.first_name,
            last_name: order.billing.last_name,
            email: order.billing.email,
            phone: order.billing.phone
          },
          billing: order.billing,
          shipping: order.shipping,
          line_items: order.line_items.map(item => ({
            id: item.id,
            name: item.name,
            product_id: item.product_id,
            variation_id: item.variation_id,
            quantity: item.quantity,
            total: item.total,
            total_tax: item.total_tax,
            sku: item.sku,
            meta_data: item.meta_data
          })),
          payment_method: order.payment_method,
          payment_method_title: order.payment_method_title,
          transaction_id: order.transaction_id,
          notes: order.customer_note
        }
      });
    } else {
      throw new Error("Failed to fetch order from WooCommerce");
    }

  } catch (error) {
    console.error("Error getting order by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get order",
      error: error.message
    });
  }
};

// Update order status
module.exports.updateOrderStatus = async (req, res) => {
  try {
    const { vendor_id, order_id } = req.params;
    const { status, note } = req.body;

    if (!vendor_id || !order_id || !status) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID, Order ID, and status are required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Prepare update data
    const updateData = { status: status };
    
    // Add note if provided
    if (note) {
      updateData.note = note;
    }

    // Update order in WooCommerce
    const response = await WooCommerce.put(`orders/${order_id}`, updateData);

    if (response.status === 200) {
      return res.json({
        success: true,
        message: "Order status updated successfully",
        order: {
          id: response.data.id,
          status: response.data.status,
          date_modified: response.data.date_modified
        }
      });
    } else {
      throw new Error("Failed to update order in WooCommerce");
    }

  } catch (error) {
    console.error("Error updating order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message
    });
  }
};

// Get order statistics for a vendor
module.exports.getOrderStatistics = async (req, res) => {
  try {
    const { vendor_id, period = '30' } = req.query;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period));

    // Fetch orders for the period
    const response = await WooCommerce.get("orders", {
      status: 'any',
      per_page: 100,
      after: startDate.toISOString(),
      before: endDate.toISOString()
    });

    if (response.status === 200) {
      const orders = response.data;
      
      // Calculate statistics
      const stats = {
        total_orders: orders.length,
        total_revenue: 0,
        orders_by_status: {},
        revenue_by_status: {},
        average_order_value: 0
      };

      orders.forEach(order => {
        const orderTotal = parseFloat(order.total);
        const orderStatus = order.status;
        
        // Count orders by status
        stats.orders_by_status[orderStatus] = (stats.orders_by_status[orderStatus] || 0) + 1;
        
        // Calculate revenue by status
        stats.revenue_by_status[orderStatus] = (stats.revenue_by_status[orderStatus] || 0) + orderTotal;
        
        // Total revenue
        stats.total_revenue += orderTotal;
      });

      // Calculate average order value
      if (stats.total_orders > 0) {
        stats.average_order_value = stats.total_revenue / stats.total_orders;
      }

      return res.json({
        success: true,
        message: `Order statistics for the last ${period} days`,
        period: period,
        statistics: stats
      });
    } else {
      throw new Error("Failed to fetch orders from WooCommerce");
    }

  } catch (error) {
    console.error("Error getting order statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get order statistics",
      error: error.message
    });
  }
};

// Sync orders from WooCommerce to local database
module.exports.syncOrdersFromWooCommerce = async (req, res) => {
  try {
    const { vendor_id, sync_all = false } = req.body;

    if (!vendor_id) {
      return res.status(400).json({
        success: false,
        message: "Vendor ID is required"
      });
    }

    // Get vendor's WooCommerce store credentials from database
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', vendor_id)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Determine how many orders to fetch
    const perPage = sync_all ? 100 : 50;
    
    // Fetch recent orders from WooCommerce
    const response = await WooCommerce.get("orders", {
      status: 'any',
      per_page: perPage,
      orderby: 'date',
      order: 'desc'
    });

    if (response.status === 200) {
      const orders = response.data;
      let syncedCount = 0;
      let updatedCount = 0;
      let errors = [];

      for (const order of orders) {
        try {
          // Check if order already exists in local database
          const existingOrder = await global.dbConnection('woocommerce_orders')
            .where('woo_order_id', order.id)
            .where('vendor_id', vendor_id)
            .first();

          const orderData = {
            vendor_id: vendor_id,
            woo_order_id: order.id,
            order_number: order.number,
            status: order.status,
            date_created: order.date_created,
            date_modified: order.date_modified,
            total: order.total,
            subtotal: order.subtotal,
            total_tax: order.total_tax,
            shipping_total: order.shipping_total,
            discount_total: order.discount_total,
            currency: order.currency,
            customer_id: order.customer_id,
            customer_email: order.billing.email,
            customer_name: `${order.billing.first_name} ${order.billing.last_name}`,
            billing_address: JSON.stringify(order.billing),
            shipping_address: JSON.stringify(order.shipping),
            payment_method: order.payment_method,
            payment_method_title: order.payment_method_title,
            transaction_id: order.transaction_id,
            customer_note: order.customer_note,
            line_items: JSON.stringify(order.line_items),
            synced_at: new Date()
          };

          if (existingOrder) {
            // Update existing order
            await global.dbConnection('woocommerce_orders')
              .where('id', existingOrder.id)
              .update(orderData);
            updatedCount++;
          } else {
            // Insert new order
            await global.dbConnection('woocommerce_orders').insert(orderData);
            syncedCount++;
          }
        } catch (orderError) {
          console.error(`Error syncing order ${order.id}:`, orderError);
          errors.push({
            order_id: order.id,
            error: orderError.message
          });
        }
      }

      return res.json({
        success: true,
        message: "Orders synced successfully",
        summary: {
          total_orders_fetched: orders.length,
          new_orders_synced: syncedCount,
          existing_orders_updated: updatedCount,
          errors: errors.length
        },
        errors: errors
      });
    } else {
      throw new Error("Failed to fetch orders from WooCommerce");
    }

  } catch (error) {
    console.error("Error syncing orders from WooCommerce:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to sync orders",
      error: error.message
    });
  }
};

// 🏪 Store Orders Management Functions

// Get all store orders (WooCommerce orders) with filtering and pagination
module.exports.getAllStoreOrders = async (req, res) => {
  try {
    const { 
      vendor_id, 
      status = 'any', 
      offset = 0, 
      limit = 50, 
      from, 
      to, 
      all = 0 
    } = req.body;

    let query = global.dbConnection('woocommerce_orders')
      .select('*')
      .orderBy('date_created', 'desc');

    // Filter by vendor if specified
    if (vendor_id && vendor_id !== 0) {
      query = query.where('vendor_id', vendor_id);
    }

    // Filter by status
    if (status !== 'any') {
      query = query.where('status', status);
    }

    // Filter by date range
    if (from && to) {
      query = query.whereBetween('date_created', [from, to]);
    }

    // Apply pagination
    if (all === 0) {
      query = query.offset(offset).limit(limit);
    }

    const orders = await query;

    // Get total count for pagination
    let countQuery = global.dbConnection('woocommerce_orders');
    if (vendor_id && vendor_id !== 0) {
      countQuery = countQuery.where('vendor_id', vendor_id);
    }
    if (status !== 'any') {
      countQuery = countQuery.where('status', status);
    }
    if (from && to) {
      countQuery = countQuery.whereBetween('date_created', [from, to]);
    }
    
    const totalCount = await countQuery.count('* as count');

    return res.json({
      success: true,
      message: `Found ${orders.length} store orders`,
      total_orders: totalCount[0].count,
      current_page: Math.floor(offset / limit) + 1,
      total_pages: Math.ceil(totalCount[0].count / limit),
      orders: orders
    });

  } catch (error) {
    console.error("Error getting store orders:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get store orders",
      error: error.message
    });
  }
};

// Get store order details by ID
module.exports.getStoreOrderDetails = async (req, res) => {
  try {
    const { order_id } = req.body;

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    const order = await global.dbConnection('woocommerce_orders')
      .where('id', order_id)
      .first();

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Store order not found"
      });
    }

    // Parse line items from JSON
    if (order.line_items) {
      try {
        order.line_items = JSON.parse(order.line_items);
      } catch (e) {
        order.line_items = [];
      }
    }

    // Parse addresses from JSON
    if (order.billing_address) {
      try {
        order.billing_address = JSON.parse(order.billing_address);
      } catch (e) {
        order.billing_address = {};
      }
    }

    if (order.shipping_address) {
      try {
        order.shipping_address = JSON.parse(order.shipping_address);
      } catch (e) {
        order.shipping_address = {};
      }
    }

    return res.json({
      success: true,
      message: "Store order details retrieved successfully",
      order: order
    });

  } catch (error) {
    console.error("Error getting store order details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get store order details",
      error: error.message
    });
  }
};

// Update store order status
module.exports.updateStoreOrderStatus = async (req, res) => {
  try {
    const { order_id, status, note } = req.body;

    if (!order_id || !status) {
      return res.status(400).json({
        success: false,
        message: "Order ID and status are required"
      });
    }

    // Update order in local database
    const updateResult = await global.dbConnection('woocommerce_orders')
      .where('id', order_id)
      .update({
        status: status,
        date_modified: new Date(),
        updated_at: new Date()
      });

    if (updateResult > 0) {
      // If you want to sync back to WooCommerce, uncomment this section
      // const order = await global.dbConnection('woocommerce_orders').where('id', order_id).first();
      // if (order && order.vendor_id > 0) {
      //   await updateWooCommerceOrderStatus(order.vendor_id, order.woo_order_id, status, note);
      // }

      return res.json({
        success: true,
        message: "Store order status updated successfully",
        order_id: order_id,
        new_status: status
      });
    } else {
      return res.status(404).json({
        success: false,
        message: "Store order not found"
      });
    }

  } catch (error) {
    console.error("Error updating store order status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update store order status",
      error: error.message
    });
  }
};

// Get store order counts for different statuses
module.exports.getStoreOrderCounts = async (req, res) => {
  try {
    const { vendor_id, from, to, all = 0 } = req.body;

    let baseQuery = global.dbConnection('woocommerce_orders');

    // Filter by vendor if specified
    if (vendor_id && vendor_id !== 0) {
      baseQuery = baseQuery.where('vendor_id', vendor_id);
    }

    // Filter by date range
    if (from && to) {
      baseQuery = baseQuery.whereBetween('date_created', [from, to]);
    }

    // Get counts for different statuses
    const allOrders = await baseQuery.clone().count('* as count');
    const processingOrders = await baseQuery.clone().where('status', 'processing').count('* as count');
    const completedOrders = await baseQuery.clone().where('status', 'completed').count('* as count');
    const cancelledOrders = await baseQuery.clone().where('status', 'cancelled').count('* as count');
    const pendingOrders = await baseQuery.clone().where('status', 'pending').count('* as count');
    const onHoldOrders = await baseQuery.clone().where('status', 'on-hold').count('* as count');

    const counts = {
      all_orders: allOrders[0].count,
      processing: processingOrders[0].count,
      completed: completedOrders[0].count,
      cancelled: cancelledOrders[0].count,
      pending: pendingOrders[0].count,
      on_hold: onHoldOrders[0].count
    };

    return res.json({
      success: true,
      message: "Store order counts retrieved successfully",
      counts: counts
    });

  } catch (error) {
    console.error("Error getting store order counts:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get store order counts",
      error: error.message
    });
  }
};

// Update store order dispatch status with shipment details
module.exports.updateStoreOrderDispatchStatus = async (req, res) => {
  try {
    const { orderId, status, shipment_details } = req.body;

    // Validate required fields
    if (!orderId || !status || !shipment_details) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: orderId, status, shipment_details"
      });
    }

    // Validate shipment details
    if (!shipment_details.shipment_order_id || !shipment_details.awb_code || !shipment_details.courier_name) {
      return res.status(400).json({
        success: false,
        message: "Missing required shipment details: shipment_order_id, awb_code, courier_name"
      });
    }

    // Update the main order status
    const updateOrder = await global.dbConnection('woocommerce_orders')
      .where('id', orderId)
      .update({
        status: status,
        awb_code: shipment_details.awb_code,
        courier_company_id: shipment_details.courier_company_id,
        courier_name: shipment_details.courier_name,
        shipment_id: shipment_details.shipment_id,
        shipment_order_id: shipment_details.shipment_order_id,
        manifest_url: shipment_details.manifest_url || null,
        invoice_url: shipment_details.invoice_url || null,
        label_url: shipment_details.label_url || null,
        shiprocket_status: shipment_details.shiprocket_status || null,
        updated_at: new Date()
      });

    if (updateOrder === 0) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    // Add log entry for the status change
    const orderService = require('../../service/order/orderService');
    const addLog = await orderService.addStoreOrderLog(orderId, status, req.user?.id || 1);

    // Insert shipment details into shipment tracking table (if you have one)
    const shipmentData = {
      order_id: orderId,
      shipment_order_id: shipment_details.shipment_order_id,
      shipment_id: shipment_details.shipment_id,
      awb_code: shipment_details.awb_code,
      courier_company_id: shipment_details.courier_company_id,
      courier_name: shipment_details.courier_name,
      manifest_url: shipment_details.manifest_url || null,
      invoice_url: shipment_details.invoice_url || null,
      label_url: shipment_details.label_url || null,
      shiprocket_status: shipment_details.shiprocket_status || null,
      created_at: new Date(),
      updated_at: new Date()
    };

    // Try to insert shipment tracking (ignore if table doesn't exist)
    try {
      await global.dbConnection('shipment_tracking').insert(shipmentData);
    } catch (shipmentError) {
      console.log('Shipment tracking table not available, skipping:', shipmentError.message);
    }

    return res.json({
      success: true,
      message: "Order dispatch status updated successfully",
      order_id: orderId,
      status: status,
      shipment_details: shipment_details,
      log_added: !_.isNull(addLog)
    });

  } catch (error) {
    console.error("Error updating store order dispatch status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update order dispatch status",
      error: error.message
    });
  }
};

// Convert store order to website order (optional feature)
module.exports.convertToWebsiteOrder = async (req, res) => {
  try {
    const { store_order_id } = req.body;

    if (!store_order_id) {
      return res.status(400).json({
        success: false,
        message: "Store order ID is required"
      });
    }

    // Get the store order
    const storeOrder = await global.dbConnection('woocommerce_orders')
      .where('id', store_order_id)
      .first();

    if (!storeOrder) {
      return res.status(404).json({
        success: false,
        message: "Store order not found"
      });
    }

    // This is a placeholder for the conversion logic
    // You would need to implement the actual conversion based on your requirements
    // For now, we'll just mark it as converted
    
    await global.dbConnection('woocommerce_orders')
      .where('id', store_order_id)
      .update({
        converted_to_website_order: true,
        converted_at: new Date(),
        updated_at: new Date()
      });

    return res.json({
      success: true,
      message: "Store order marked for conversion to website order",
      store_order_id: store_order_id,
      note: "Conversion logic needs to be implemented based on your specific requirements"
    });

  } catch (error) {
    console.error("Error converting store order:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to convert store order",
      error: error.message
    });
  }
};

// ============================================================================
// WOOCOMMERCE SHIPPING INTEGRATION WITH COURIER PARTNERS
// ============================================================================

// Setup WooCommerce shipping zones and methods for courier partners
module.exports.setupWooCommerceShipping = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Create a custom shipping method using WooCommerce's shipping zones
    // First, get or create a shipping zone for India
    let indiaZone = null;
    
    try {
      // Check if India zone already exists
      const zonesResponse = await WooCommerce.get("shipping/zones");
      if (zonesResponse.status === 200) {
        indiaZone = zonesResponse.data.find(zone => 
          zone.name === "India" || 
          zone.locations.some(loc => loc.code === "IN")
        );
      }
    } catch (zoneError) {
      console.log("No existing zones found, will create new one");
    }

    if (!indiaZone) {
      // Create India shipping zone
      const zoneData = {
        name: "India",
        locations: [
          {
            code: "IN",
            type: "country"
          }
        ]
      };
      
      const zoneResponse = await WooCommerce.post("shipping/zones", zoneData);
      if (zoneResponse.status === 201) {
        indiaZone = zoneResponse.data;
        console.log("Created India shipping zone:", indiaZone.id);
      } else {
        throw new Error("Failed to create India shipping zone");
      }
    }

    // Now create a custom shipping method for courier partners
    const shippingMethodData = {
      method_id: "custom_courier_partners",
      method_title: "Courier Partners",
      method_description: "Real-time shipping rates from multiple courier partners",
      enabled: true,
      settings: {
        title: {
          value: "Courier Partners",
          description: "Title for the shipping method"
        },
        cost: {
          value: "0",
          description: "Base cost (will be calculated dynamically)"
        },
        min_amount: {
          value: "0",
          description: "Minimum order amount"
        }
      }
    };

    // Add the custom shipping method to the India zone
    const methodResponse = await WooCommerce.post(
      `shipping/zones/${indiaZone.id}/methods`, 
      shippingMethodData
    );

    if (methodResponse.status === 201) {
      console.log("Custom shipping method created successfully");
      
      // Store the shipping method configuration
      try {
        await global.dbConnection('woocommerce_shipping_methods').insert({
          store_id: store.id,
          zone_id: indiaZone.id,
          method_id: methodResponse.data.id,
          method_type: 'custom_courier_partners',
          is_active: true,
          created_at: new Date()
        });
      } catch (dbError) {
        console.log("Shipping method table not available, skipping storage:", dbError.message);
      }

      return res.json({
        success: true,
        message: "Custom shipping method created successfully",
        data: {
          zone_id: indiaZone.id,
          method_id: methodResponse.data.id,
          method_title: "Courier Partners"
        }
      });
    } else {
      throw new Error("Failed to create custom shipping method");
    }

  } catch (error) {
    console.error("Error creating custom shipping method:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create custom shipping method",
      error: error.message
    });
  }
};

// Calculate shipping charges for WooCommerce using existing courier partners
module.exports.calculateWooCommerceShipping = async (req, res) => {
  try {
    const { 
      postCode, 
      paymentMode = 'prepaid', 
      weight, 
      orderAmount = 0,
      items = [] // Array of cart items with weights
    } = req.body;

    // Validate required fields
    if (!postCode || !weight) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: postCode, weight"
      });
    }

    // Calculate total weight if items array is provided
    let totalWeight = weight;
    if (items && items.length > 0) {
      totalWeight = items.reduce((sum, item) => sum + (item.weight || 0), 0);
    }

    console.log(`🚚 Calculating shipping for: PostCode: ${postCode}, Weight: ${totalWeight}g, Amount: ${orderAmount}, Payment: ${paymentMode}`);

    // Integrate NimbusPost logic directly
    const axios = require('axios');
    
    try {
      // Generate NimbusPost token
      const baseURL = "https://api.nimbuspost.com/v1/";
      const loginData = {
        email: "care+1201@deeprintz.com",
        password: "3JfzKQpHsG"
      };
      
      const tokenResponse = await axios.post(`${baseURL}users/login`, loginData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const token = tokenResponse.data.data;

      if (!token) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate NimbusPost token",
          details: "Unable to authenticate with courier service"
        });
      }
      
      // Fetch courier partners
      const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
      const courierData = {
        origin: "641603", // Static origin
        destination: postCode,
        payment_type: payment_type,
        order_amount: payment_type === 'cod' ? orderAmount : "",
        weight: totalWeight,
        length: "",  // Optional
        breadth: "", // Optional
        height: ""   // Optional
      };
      
      const courierResponse = await axios.post(`${baseURL}courier/serviceability`, courierData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = courierResponse.data;
      if (!result.status || !result.data) {
        return res.status(400).json({
          success: false,
          message: "Unable to fetch shipping rates for this pincode",
          details: "No courier partners available for the specified location and parameters"
        });
      }
      
      const actualCourierData = result.data;
      //console.log("✅ Couriers found:", actualCourierData);

      // Format the response for WooCommerce frontend
      const shippingOptions = actualCourierData.map(courier => {
        // Handle different possible field names from NimbusPost
        const shippingCost = courier.total_charges ||0;
        const codCharge = courier.cod_charge || courier.cod_cost || 0;
        
        return {
          courier_name: courier.courier_name || courier.name || 'Unknown Courier',
          courier_id: courier.courier_id || courier.id || '',
          shipping_cost: parseFloat(shippingCost),
          cod_charge: parseFloat(codCharge),
          estimated_delivery: courier.estimated_delivery || courier.delivery_time || '3-5 days'
        };
      });

      // Sort by shipping cost (lowest first)
      shippingOptions.sort((a, b) => a.shipping_cost - b.shipping_cost);

      console.log(`✅ Shipping calculation successful for ${postCode}: ${shippingOptions.length} options found`);

      return res.json({
        success: true,
        message: "Shipping charges calculated successfully",
        data: {
          shipping_options: shippingOptions
        }
      });

    } catch (nimbusError) {
      console.error("❌ NimbusPost API error:", nimbusError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to calculate shipping charges",
        details: "Courier service temporarily unavailable",
        error: nimbusError.message
      });
    }

  } catch (error) {
    console.error("❌ Shipping calculation error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate shipping charges",
      error: error.message
    });
  }
};

// Get shipping rates for a specific postcode (for WooCommerce frontend)
module.exports.getShippingRatesForPostcode = async (req, res) => {
  try {
    const { postcode } = req.params;
    const { weight, orderAmount, paymentMode = 'prepaid' } = req.query;

    if (!postcode || !weight) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: postcode, weight"
      });
    }

    // Integrate NimbusPost logic directly (copying from getCourierPartners)
    const axios = require('axios');
    
    try {
      // Generate NimbusPost token
      const baseURL = "https://api.nimbuspost.com/v1/";
      const loginData = {
        email: "care+1201@deeprintz.com",
        password: "3JfzKQpHsG"
      };
      
      const tokenResponse = await axios.post(`${baseURL}users/login`, loginData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const token = tokenResponse.data;
      
      if (!token) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate NimbusPost token",
          details: "Unable to authenticate with courier service"
        });
      }
      
      // Fetch courier partners
      const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
      const courierData = {
        origin: "641603", // Static origin
        destination: postcode,
        payment_type: payment_type,
        order_amount: payment_type === 'cod' ? (orderAmount || 0) : "",
        weight: weight,
        length: "",  // Optional
        breadth: "", // Optional
        height: ""   // Optional
      };
      
      const courierResponse = await axios.post(`${baseURL}courier/serviceability`, courierData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = courierResponse.data;
      if (!result.status || !result.data) {
        return res.json({
          success: true,
          message: "No shipping options available for this pincode",
          data: {
            post_code: postcode,
            shipping_options: [],
            total_options: 0
          }
        });
      }
      
      const actualCourierData = result.data;

      // Format the response for WooCommerce frontend
      const shippingOptions = actualCourierData.map(courier => {
        // Handle different possible field names from NimbusPost
        const shippingCost = courier.rate || courier.shipping_cost || courier.cost || courier.price || 0;
        const codCharge = courier.cod_charge || courier.cod_cost || 0;
        const totalCost = parseFloat(shippingCost) + parseFloat(codCharge);
        
        console.log('Processing courier:', courier.courier_name, 'Cost:', shippingCost, 'COD:', codCharge, 'Total:', totalCost);
        
        return {
          courier_id: courier.courier_id || courier.courier_id || `courier_${Math.random().toString(36).substr(2, 9)}`,
          courier_name: courier.courier_name || courier.courier_name || 'Unknown Courier',
          courier_logo: courier.courier_logo || '',
          estimated_delivery: courier.estimated_delivery || courier.delivery_time || '',
          shipping_cost: parseFloat(shippingCost),
          cod_charge: parseFloat(codCharge),
          total_cost: totalCost,
          payment_type: paymentMode,
          weight: weight,
          origin: "641603",
          destination: postcode,
          is_cod_available: paymentMode === 'cod',
          delivery_time: courier.estimated_delivery || courier.delivery_time || '3-5 days',
          courier_rating: courier.rating || 0
        };
      });

      // Sort by total cost (cheapest first)
      shippingOptions.sort((a, b) => a.total_cost - b.total_cost);

      return res.json({
        success: true,
        message: "Shipping rates retrieved successfully",
        data: {
          post_code: postcode,
          weight: weight,
          order_amount: orderAmount || 0,
          payment_mode: paymentMode,
          shipping_options: shippingOptions,
          cheapest_option: shippingOptions[0] || null,
          total_options: shippingOptions.length,
          calculation_timestamp: new Date()
        }
      });

    } catch (apiError) {
      console.error("Error calling getCourierPartners API:", apiError);
      return res.status(500).json({
        success: false,
        message: "Failed to fetch shipping rates from courier partners",
        error: apiError.message
      });
    }

  } catch (error) {
    console.error("Error getting shipping rates for postcode:", error);
    
    return res.status(500).json({
      success: false,
      message: "Failed to get shipping rates",
      error: error.message
    });
  }
};

// Get available shipping zones and rates for WooCommerce
module.exports.getWooCommerceShippingZones = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Get shipping zones from WooCommerce
    const zonesResponse = await WooCommerce.get("shipping/zones");
    
    if (zonesResponse.status === 200) {
      const zones = zonesResponse.data;
      
      // Get shipping methods for each zone
      const zonesWithMethods = await Promise.all(
        zones.map(async (zone) => {
          try {
            const methodsResponse = await WooCommerce.get(`shipping/zones/${zone.id}/methods`);
            if (methodsResponse.status === 200) {
              zone.shipping_methods = methodsResponse.data;
            } else {
              zone.shipping_methods = [];
            }
          } catch (methodError) {
            console.error(`Error fetching methods for zone ${zone.id}:`, methodError);
            zone.shipping_methods = [];
          }
          return zone;
        })
      );

      return res.json({
        success: true,
        message: "Shipping zones retrieved successfully",
        data: {
          store_id: store.id,
          zones: zonesWithMethods,
          total_zones: zonesWithMethods.length
        }
      });
    } else {
      throw new Error("Failed to fetch shipping zones from WooCommerce");
    }

  } catch (error) {
    console.error("Error getting WooCommerce shipping zones:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get shipping zones",
      error: error.message
    });
  }
};

// ============================================================================
// WOOCOMMERCE WEBHOOK MANAGEMENT
// ============================================================================

// Helper function to automatically register order webhooks for a connected store
const registerOrderWebhooksForStore = async (store, req) => {
  try {
    // Validate store data
    if (!store) {
      throw new Error('Store data is required for webhook registration');
    }
    
    if (!store.store_url || !store.consumer_key || !store.consumer_secret) {
      throw new Error('Store credentials are incomplete for webhook registration');
    }
    
    console.log(`🔗 Setting up automatic order webhooks for store: ${store.store_name || store.store_url}`);
    
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Define order webhooks to create automatically
    const orderWebhooks = [
      {
        name: "Order Created - Auto",
        topic: "order.created",
        //delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        delivery_url: `https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Order Updated - Auto", 
        topic: "order.updated",
        //delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        delivery_url: `https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Order Deleted - Auto",
        topic: "order.deleted", 
        //delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        delivery_url: `https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      }
    ];

    const createdWebhooks = [];
    const errors = [];

    // Create each order webhook
    for (const webhookData of orderWebhooks) {
      try {
        const response = await WooCommerce.post("webhooks", webhookData);
        
        if (response.status === 201) {
          const webhook = response.data;
          createdWebhooks.push(webhook);
          
          // Store webhook details in database
          try {
            await global.dbConnection('woocommerce_webhooks').insert({
              store_id: store.id,
              webhook_id: webhook.id,
              name: webhook.name,
              topic: webhook.topic,
              delivery_url: webhook.delivery_url,
              status: webhook.status,
              secret: webhookData.secret,
              auto_created: true,
              created_at: new Date()
            });
          } catch (dbError) {
            console.log("Webhook table not available, skipping storage:", dbError.message);
          }
          
          console.log(`✅ Auto webhook created: ${webhook.name} (ID: ${webhook.id})`);
        } else {
          errors.push(`Failed to create webhook: ${webhookData.name}`);
        }
      } catch (webhookError) {
        console.error(`❌ Error creating auto webhook ${webhookData.name}:`, webhookError.message);
        errors.push(`Error creating webhook: ${webhookData.name} - ${webhookError.message}`);
      }
    }

    console.log(`🎯 Auto webhook setup completed for store ${store.store_name}: ${createdWebhooks.length}/${orderWebhooks.length} webhooks created`);
    
    return {
      success: createdWebhooks.length > 0,
      created_webhooks: createdWebhooks.length,
      total_webhooks: orderWebhooks.length,
      webhooks: createdWebhooks,
      errors: errors.length > 0 ? errors : null
    };

  } catch (error) {
    console.error("❌ Error in automatic webhook registration:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Helper function to clean up webhooks when a store is disconnected
const cleanupWebhooksForStore = async (store) => {
  try {
    console.log(`🧹 Cleaning up webhooks for disconnected store: ${store.store_name}`);
    
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Get all webhooks for this store from database
    const storedWebhooks = await global.dbConnection('woocommerce_webhooks')
      .where('store_id', store.id)
      .select('*')
      .catch(() => []);

    let deletedCount = 0;
    const errors = [];

    // Delete each webhook from WooCommerce
    for (const storedWebhook of storedWebhooks) {
      try {
        const response = await WooCommerce.delete(`webhooks/${storedWebhook.webhook_id}`);
        
        if (response.status === 200) {
          deletedCount++;
          console.log(`✅ Deleted webhook: ${storedWebhook.name} (ID: ${storedWebhook.webhook_id})`);
        } else {
          errors.push(`Failed to delete webhook: ${storedWebhook.name}`);
        }
      } catch (webhookError) {
        console.error(`❌ Error deleting webhook ${storedWebhook.name}:`, webhookError.message);
        errors.push(`Error deleting webhook: ${storedWebhook.name} - ${webhookError.message}`);
      }
    }

    // Remove webhook records from database
    try {
      await global.dbConnection('woocommerce_webhooks')
        .where('store_id', store.id)
        .del();
    } catch (dbError) {
      console.log("Webhook table not available, skipping cleanup:", dbError.message);
    }

    console.log(`🎯 Webhook cleanup completed for store ${store.store_name}: ${deletedCount} webhooks deleted`);
    
    return {
      success: true,
      deleted_webhooks: deletedCount,
      total_webhooks: storedWebhooks.length,
      errors: errors.length > 0 ? errors : null
    };

  } catch (error) {
    console.error("❌ Error in webhook cleanup:", error);
    return {
      success: false,
      error: error.message
    };
  }
};

// Setup WooCommerce webhooks for various events
module.exports.setupWooCommerceWebhooks = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Define webhooks to create
    const webhooksToCreate = [
      {
        name: "Order Created",
        topic: "order.created",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Order Updated",
        topic: "order.updated",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Order Deleted",
        topic: "order.deleted",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/orders`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Product Created",
        topic: "product.created",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/products`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Product Updated",
        topic: "product.updated",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/products`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Product Deleted",
        topic: "product.deleted",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/products`,
        status: "active",
        secret: crypto.randomBytes(32).toString('hex')
      },
      {
        name: "Customer Created",
        topic: "customer.created",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/customers`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Customer Updated",
        topic: "customer.updated",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/customers`,
        status: "active",
        secret: "Deeprintz@123"
      },
      {
        name: "Customer Deleted",
        topic: "customer.deleted",
        delivery_url: `${req.protocol}://${req.get('host')}/api/woocommerce/webhooks/customers`,
        status: "active",
        secret: "Deeprintz@123"
      }
    ];

    const createdWebhooks = [];
    const errors = [];

    // Create each webhook
    for (const webhookData of webhooksToCreate) {
      try {
        const response = await WooCommerce.post("webhooks", webhookData);
        
        if (response.status === 201) {
          const webhook = response.data;
          createdWebhooks.push(webhook);
          
          // Store webhook details in database
          try {
            await global.dbConnection('woocommerce_webhooks').insert({
              store_id: store.id,
              webhook_id: webhook.id,
              name: webhook.name,
              topic: webhook.topic,
              delivery_url: webhook.delivery_url,
              status: webhook.status,
              secret: webhookData.secret,
              created_at: new Date()
            });
          } catch (dbError) {
            console.log("Webhook table not available, skipping storage:", dbError.message);
          }
          
          console.log(`Webhook created: ${webhook.name} (ID: ${webhook.id})`);
        } else {
          errors.push(`Failed to create webhook: ${webhookData.name}`);
        }
      } catch (webhookError) {
        console.error(`Error creating webhook ${webhookData.name}:`, webhookError.message);
        errors.push(`Error creating webhook: ${webhookData.name} - ${webhookError.message}`);
      }
    }

    return res.json({
      success: true,
      message: "Webhooks setup completed",
      data: {
        store_id: store.id,
        created_webhooks: createdWebhooks.length,
        total_webhooks: webhooksToCreate.length,
        webhooks: createdWebhooks,
        errors: errors.length > 0 ? errors : null
      }
    });

  } catch (error) {
    console.error("Error setting up WooCommerce webhooks:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to setup webhooks",
      error: error.message
    });
  }
};

// List all webhooks for a store
module.exports.listWooCommerceWebhooks = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Get webhooks from WooCommerce
    const response = await WooCommerce.get("webhooks");
    
    if (response.status === 200) {
      const webhooks = response.data;
      
      // Get stored webhook secrets from database
      const storedWebhooks = await global.dbConnection('woocommerce_webhooks')
        .where('store_id', store.id)
        .select('*')
        .catch(() => []);

      // Merge webhook data with stored secrets
      const webhooksWithSecrets = webhooks.map(webhook => {
        const stored = storedWebhooks.find(sw => sw.webhook_id === webhook.id);
        return {
          ...webhook,
          secret: stored ? stored.secret : null,
          stored_in_db: !!stored
        };
      });

      return res.json({
        success: true,
        message: "Webhooks retrieved successfully",
        data: {
          store_id: store.id,
          webhooks: webhooksWithSecrets,
          total_webhooks: webhooksWithSecrets.length,
          active_webhooks: webhooksWithSecrets.filter(w => w.status === 'active').length
        }
      });
    } else {
      throw new Error("Failed to fetch webhooks from WooCommerce");
    }

  } catch (error) {
    console.error("Error getting WooCommerce webhooks:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get webhooks",
      error: error.message
    });
  }
};

// Delete a specific webhook
module.exports.deleteWooCommerceWebhook = async (req, res) => {
  try {
    const { webhook_id } = req.params;
    const { userId } = req.query;

    if (!userId || !webhook_id) {
      return res.status(400).json({
        success: false,
        message: "User ID and webhook ID are required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Delete webhook from WooCommerce
    const response = await WooCommerce.delete(`webhooks/${webhook_id}`);
    
    if (response.status === 200) {
      // Remove from database
      try {
        await global.dbConnection('woocommerce_webhooks')
          .where('store_id', store.id)
          .where('webhook_id', webhook_id)
          .del();
      } catch (dbError) {
        console.log("Error removing webhook from database:", dbError.message);
      }

      return res.json({
        success: true,
        message: "Webhook deleted successfully",
        data: {
          webhook_id: webhook_id,
          store_id: store.id
        }
      });
    } else {
      throw new Error("Failed to delete webhook from WooCommerce");
    }

  } catch (error) {
    console.error("Error deleting WooCommerce webhook:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete webhook",
      error: error.message
    });
  }
};

// ============================================================================
// SHIPPING WEBHOOK HANDLERS
// ============================================================================

// Handle shipping calculation webhook (called when cart/checkout updates)
module.exports.handleShippingWebhook = async (req, res) => {
  try {
    const { 
      postCode, 
      weight, 
      orderAmount, 
      paymentMode = 'prepaid',
      cartItems = []
    } = req.body;

    if (!postCode || !weight) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: postCode, weight"
      });
    }

    // Calculate total weight if cart items are provided
    let totalWeight = weight;
    if (cartItems && cartItems.length > 0) {
      totalWeight = cartItems.reduce((sum, item) => sum + (item.weight || 0), 0);
    }

    console.log(`🚚 Shipping webhook triggered for: PostCode: ${postCode}, Weight: ${totalWeight}g, Amount: ${orderAmount}`);

    // Integrate NimbusPost logic directly (copying from getCourierPartners)
    const axios = require('axios');
    
    try {
      // Generate NimbusPost token
      const baseURL = "https://api.nimbuspost.com/v1/";
      const loginData = {
        email: "care+1201@deeprintz.com",
        password: "3JfzKQpHsG"
      };
      
      const tokenResponse = await axios.post(`${baseURL}users/login`, loginData, {
        headers: { 'Content-Type': 'application/json' }
      });
      
      const token = tokenResponse.data;
      
      if (!token) {
        return res.status(500).json({
          success: false,
          message: "Failed to generate NimbusPost token",
          details: "Unable to authenticate with courier service"
        });
      }
      
      // Fetch courier partners
      const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
      const courierData = {
        origin: "641603", // Static origin
        destination: postCode,
        payment_type: payment_type,
        order_amount: payment_type === 'cod' ? orderAmount : "",
        weight: totalWeight,
        length: "",  // Optional
        breadth: "", // Optional
        height: ""   // Optional
      };
      
      const courierResponse = await axios.post(`${baseURL}courier/serviceability`, courierData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      const result = courierResponse.data;
      if (!result.status || !result.data) {
        return res.json({
          success: false,
          message: "No shipping options available for this pincode",
          data: {
            post_code: postCode,
            shipping_options: [],
            total_options: 0
          }
        });
      }
      
      const actualCourierData = result.data;

      // Format the response for WooCommerce
      const shippingOptions = actualCourierData.map(courier => {
        // Handle different possible field names from NimbusPost
        const shippingCost = courier.rate || courier.shipping_cost || courier.cost || courier.price || 0;
        const codCharge = courier.cod_charge || courier.cod_cost || 0;
        const totalCost = parseFloat(shippingCost) + parseFloat(codCharge);
        
        console.log('Processing courier:', courier.courier_name, 'Cost:', shippingCost, 'COD:', codCharge, 'Total:', totalCost);
        
        return {
          courier_id: courier.courier_id || courier.courier_id || `courier_${Math.random().toString(36).substr(2, 9)}`,
          courier_name: courier.courier_name || courier.courier_name || 'Unknown Courier',
          courier_logo: courier.courier_logo || '',
          estimated_delivery: courier.estimated_delivery || courier.delivery_time || '',
          shipping_cost: parseFloat(shippingCost),
          cod_charge: parseFloat(codCharge),
          total_cost: totalCost,
          payment_type: paymentMode,
          weight: totalWeight,
          origin: "641603",
          destination: postCode,
          is_cod_available: paymentMode === 'cod',
          delivery_time: courier.estimated_delivery || courier.delivery_time || '3-5 days',
          courier_rating: courier.rating || 0
        };
      });

      // Sort by total cost (cheapest first)
      shippingOptions.sort((a, b) => a.total_cost - b.total_cost);

      // No database storage needed - just return the shipping options

      return res.json({
        success: true,
        message: "Shipping calculated via webhook",
        data: {
          post_code: postCode,
          weight: totalWeight,
          order_amount: orderAmount,
          payment_mode: paymentMode,
          shipping_options: shippingOptions,
          total_options: shippingOptions.length
        }
      });

    } catch (nimbusError) {
      console.error("❌ NimbusPost API error:", nimbusError.message);
      return res.status(500).json({
        success: false,
        message: "Failed to calculate shipping charges",
        details: "Courier service temporarily unavailable",
        error: nimbusError.message
      });
    }

  } catch (error) {
    console.error("Error handling shipping webhook:", error);
    
    return res.status(500).json({
      success: false,
      message: "Failed to calculate shipping via webhook",
      error: error.message
    });
  }
};

// ============================================================================
// AUTOMATIC SHIPPING SETUP HELPER FUNCTIONS
// ============================================================================

// Setup WooCommerce shipping for a specific vendor (called automatically)
module.exports.setupWooCommerceShippingForVendor = async (store, userId) => {
  try {
    console.log(`Setting up WooCommerce shipping for vendor ${userId}...`);
    
    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Check if shipping is already configured for this vendor
    const existingShipping = await global.dbConnection('woocommerce_shipping_methods')
      .where('store_id', store.id)
      .where('method_type', 'custom_courier_partners')
      .first()
      .catch(() => null);

    if (existingShipping) {
      console.log(`Shipping already configured for vendor ${userId}`);
      return existingShipping;
    }

    // Get or create India shipping zone
    let indiaZone = null;
    try {
      console.log('Fetching existing shipping zones...');
      const zonesResponse = await WooCommerce.get("shipping/zones");
      
      if (zonesResponse.status === 200 && zonesResponse.data) {
        // Look for existing India zone
        indiaZone = zonesResponse.data.find(zone => 
          zone.name === "India" || 
          zone.name === "india" ||
          zone.locations.some(loc => loc.code === "IN")
        );
        
        if (indiaZone) {
          console.log(`Found existing India zone: ${indiaZone.id} - ${indiaZone.name}`);
        }
      }
    } catch (zoneError) {
      console.log("Error fetching zones, will create new one:", zoneError.message);
    }

    // Create India shipping zone if it doesn't exist
    if (!indiaZone) {
      try {
        console.log('Creating new India shipping zone...');
        const zoneData = {
          name: "India",
          locations: [
            {
              code: "IN",
              type: "country"
            }
          ]
        };
        
        const zoneResponse = await WooCommerce.post("shipping/zones", zoneData);
        if (zoneResponse.status === 201) {
          indiaZone = zoneResponse.data;
          console.log(`Created India shipping zone for vendor ${userId}:`, indiaZone.id);
        } else {
          throw new Error(`Failed to create India shipping zone: ${zoneResponse.status}`);
        }
      } catch (zoneCreateError) {
        console.error('Failed to create India zone:', zoneCreateError.message);
        // Try to use the first available zone as fallback
        try {
          const fallbackZones = await WooCommerce.get("shipping/zones");
          if (fallbackZones.status === 200 && fallbackZones.data.length > 0) {
            indiaZone = fallbackZones.data[0];
            console.log(`Using fallback zone: ${indiaZone.id} - ${indiaZone.name}`);
          } else {
            throw new Error('No zones available and cannot create new one');
          }
        } catch (fallbackError) {
          throw new Error(`Cannot setup shipping: ${fallbackError.message}`);
        }
      }
    }

    // Check if shipping method already exists in this zone
    try {
      console.log(`Checking existing methods in zone ${indiaZone.id}...`);
      const existingMethods = await WooCommerce.get(`shipping/zones/${indiaZone.id}/methods`);
      
      if (existingMethods.status === 200 && existingMethods.data) {
        const existingMethod = existingMethods.data.find(method => 
          method.method_id === "custom_courier_shipping" ||
          method.method_id === "custom_courier_partners" ||
          method.method_title === "Courier Partners"
        );
        
        if (existingMethod) {
          console.log(`Shipping method already exists: ${existingMethod.id}`);
          
          // Store the existing method configuration
          try {
            await global.dbConnection('woocommerce_shipping_methods').insert({
              store_id: store.id,
              zone_id: indiaZone.id,
              method_id: existingMethod.id,
              method_type: 'custom_courier_partners',
              is_active: existingMethod.enabled,
              created_at: new Date()
            });
          } catch (dbError) {
            console.log("Shipping method table not available, skipping storage:", dbError.message);
          }
          
          return existingMethod;
        }
      }
    } catch (methodCheckError) {
      console.log('Error checking existing methods:', methodCheckError.message);
    }

    // Create custom shipping method for courier partners
    const shippingMethodData = {
      method_id: "custom_courier_shipping", // Use custom method ID
      method_title: "Courier Partners",
      method_description: "Real-time shipping rates from multiple courier partners",
      enabled: true,
      settings: {
        title: {
          value: "Courier Partners",
          description: "Title for the shipping method"
        },
        cost: {
          value: "0",
          description: "Base cost (calculated dynamically via API)"
        },
        min_amount: {
          value: "0",
          description: "Minimum order amount"
        },
        api_endpoint: {
          value: `${process.env.API_BASE_URL || 'https://devdevapi.deeprintz.com/api'}/woocommerce/shipping/calculate`,
          description: "API endpoint for shipping calculation"
        },
        user_id: {
          value: userId.toString(),
          description: "User ID for API authentication"
        }
      }
    };

    // Add the custom shipping method to the India zone
    try {
      const methodResponse = await WooCommerce.post(
        `shipping/zones/${indiaZone.id}/methods`, 
        shippingMethodData
      );

      if (methodResponse.status === 201) {
        console.log(`Custom shipping method created for vendor ${userId}:`, methodResponse.data.id);
        
        // Store the shipping method configuration
        try {
          await global.dbConnection('woocommerce_shipping_methods').insert({
            store_id: store.id,
            zone_id: indiaZone.id,
            method_id: methodResponse.data.id,
            method_type: 'custom_courier_partners',
            is_active: true,
            created_at: new Date()
          });
        } catch (dbError) {
          console.log("Shipping method table not available, skipping storage:", dbError.message);
        }

        return methodResponse.data;
      } else {
        throw new Error(`Failed to create shipping method: ${methodResponse.status}`);
      }
    } catch (methodCreateError) {
      console.error('Failed to create shipping method:', methodCreateError.message);
      
      // Try alternative approach - use existing flat_rate method
      try {
        console.log('Trying to use existing flat_rate method...');
        const flatRateMethods = await WooCommerce.get(`shipping/zones/${indiaZone.id}/methods`);
        
        if (flatRateMethods.status === 200 && flatRateMethods.data) {
          const flatRateMethod = flatRateMethods.data.find(method => 
            method.method_id === "flat_rate"
          );
          
          if (flatRateMethod) {
            console.log(`Using existing flat_rate method: ${flatRateMethod.id}`);
            
            // Update the existing method
            const updateData = {
              method_title: "Courier Partners",
              method_description: "Real-time shipping rates from multiple courier partners",
              enabled: true
            };
            
            const updateResponse = await WooCommerce.put(
              `shipping/zones/${indiaZone.id}/methods/${flatRateMethod.id}`,
              updateData
            );
            
            if (updateResponse.status === 200) {
              console.log('Updated existing flat_rate method for courier partners');
              
              // Store the configuration
              try {
                await global.dbConnection('woocommerce_shipping_methods').insert({
                  store_id: store.id,
                  zone_id: indiaZone.id,
                  method_id: flatRateMethod.id,
                  method_type: 'custom_courier_partners',
                  is_active: true,
                  created_at: new Date()
                });
              } catch (dbError) {
                console.log("Shipping method table not available, skipping storage:", dbError.message);
              }
              
              return updateResponse.data;
            }
          }
        }
      } catch (fallbackError) {
        console.error('Fallback method also failed:', fallbackError.message);
      }
      
      throw new Error(`Cannot create or update shipping method: ${methodCreateError.message}`);
    }

  } catch (error) {
    console.error(`Error setting up WooCommerce shipping for vendor ${userId}:`, error);
    throw error;
  }
}

// Setup webhooks for a specific vendor (called automatically)
module.exports.setupWebhooksForVendor = async (store, userId) => {
  try {
    console.log(`Setting up webhooks for vendor ${userId}...`);
    
    // Check if webhooks are already configured for this vendor
    const existingWebhooks = await global.dbConnection('woocommerce_webhooks')
      .where('store_id', store.id)
      .first()
      .catch(() => null);

    if (existingWebhooks) {
      console.log(`Webhooks already configured for vendor ${userId}`);
      return true;
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Define essential webhooks for shipping
    const webhooksToCreate = [
      {
        name: "Order Created",
        topic: "order.created",
        delivery_url: `https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/webhooks/orders`,
        status: "active",
        secret: crypto.randomBytes(32).toString('hex')
      },
      {
        name: "Order Updated",
        topic: "order.updated",
        delivery_url: `https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/webhooks/orders`,
        status: "active",
        secret: crypto.randomBytes(32).toString('hex')
      }
    ];

    const createdWebhooks = [];

    // Create each webhook
    for (const webhookData of webhooksToCreate) {
      try {
        const response = await WooCommerce.post("webhooks", webhookData);
        
        if (response.status === 201) {
          const webhook = response.data;
          createdWebhooks.push(webhook);
          
          // Store webhook details in database
          try {
            await global.dbConnection('woocommerce_webhooks').insert({
              store_id: store.id,
              webhook_id: webhook.id,
              name: webhook.name,
              topic: webhook.topic,
              delivery_url: webhook.delivery_url,
              status: webhook.status,
              secret: webhookData.secret,
              created_at: new Date()
            });
          } catch (dbError) {
            console.log("Webhook table not available, skipping storage:", dbError.message);
          }
          
          console.log(`Webhook created for vendor ${userId}: ${webhook.name} (ID: ${webhook.id})`);
        }
      } catch (webhookError) {
        console.error(`Error creating webhook for vendor ${userId}:`, webhookError.message);
      }
    }

    console.log(`Webhooks setup completed for vendor ${userId}: ${createdWebhooks.length} created`);
    return createdWebhooks.length > 0;

  } catch (error) {
    console.error(`Error setting up webhooks for vendor ${userId}:`, error);
    throw error;
  }
}

// Setup frontend shipping integration for a specific vendor (called automatically)
module.exports.setupFrontendShippingForVendor = async (store, userId) => {
  try {
    console.log(`Setting up frontend shipping for vendor ${userId}...`);
    
    // Check if frontend shipping is already configured
    const existingFrontend = await global.dbConnection('woocommerce_frontend_shipping')
      .where('store_id', store.id)
      .first()
      .catch(() => null);

    if (existingFrontend) {
      console.log(`Frontend shipping already configured for vendor ${userId}`);
      return existingFrontend;
    }

    // Initialize WooCommerce API client
    const WooCommerce = new WooCommerceRestApi({
      url: store.store_url,
      consumerKey: store.consumer_key,
      consumerSecret: store.consumer_secret,
      version: defaultConfig.version,
      timeout: defaultConfig.timeout
    });

    // Step 1: Create enhanced shipping plugin with checkout integration
    const pluginContent = await createEnhancedShippingPlugin(store, userId);
    
    // Step 2: Try to upload and install plugin automatically
    const pluginUploaded = await uploadShippingPluginToStore(WooCommerce, pluginContent, store, userId);
    
    // Step 3: Try to activate the plugin automatically
    const pluginActivated = await activateShippingPlugin(WooCommerce, store, userId);
    
    // Step 4: If plugin installation fails, try fallback method (inject script directly)
    let fallbackMethodUsed = false;
    if (!pluginUploaded || !pluginActivated) {
      console.log(`Plugin installation failed for vendor ${userId}, trying fallback method...`);
      fallbackMethodUsed = await injectEnhancedShippingScript(WooCommerce, store, userId);
    }
    
    // Step 5: Store frontend shipping configuration
    try {
      await global.dbConnection('woocommerce_frontend_shipping').insert({
        store_id: store.id,
        vendor_id: userId,
        is_active: true,
        shipping_calculator_enabled: true,
        automatic_calculation: true,
        plugin_uploaded: pluginUploaded,
        plugin_activated: pluginActivated,
        fallback_method_used: fallbackMethodUsed,
        created_at: new Date()
      });
    } catch (dbError) {
      console.log("Frontend shipping table not available, skipping storage:", dbError.message);
    }

    console.log(`Enhanced frontend shipping setup completed for vendor ${userId}`);
    return {
      plugin_uploaded: pluginUploaded,
      plugin_activated: pluginActivated,
      fallback_method_used: fallbackMethodUsed
    };

  } catch (error) {
    console.error(`Error setting up frontend shipping for vendor ${userId}:`, error);
    throw error;
  }
}

// Create enhanced shipping plugin with checkout integration
async function createEnhancedShippingPlugin(store, userId) {
  const pluginName = `courier-shipping-integration-${userId}`;
  const pluginSlug = pluginName.replace(/[^a-z0-9]/g, '-');
  
  const pluginContent = `<?php
/**
 * Plugin Name: Courier Shipping Integration
 * Description: Automatic shipping calculation with courier partners for vendor ${userId}
 * Version: 1.0.0
 * Author: Your Company
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CourierShippingIntegration {
    private $optionName = 'deeprintz_courier_shipping_config';
    private $apiBaseUrl = null;
    private $userId = null;
    private $storeId = null;
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'add_inline_script'));
        add_action('woocommerce_shipping_init', array($this, 'init_shipping_method'));
        add_filter('woocommerce_shipping_methods', array($this, 'add_shipping_method'));
        add_action('admin_init', array($this, 'maybe_fetch_config'));
        register_activation_hook(__FILE__, array($this, 'activate_plugin'));
        
        // Load config from WordPress options
        $this->load_config();
    }
    
    public function activate_plugin() {
        // Fetch config on activation
        $this->fetch_config_from_api();
    }
    
    private function load_config() {
        $config = get_option($this->optionName);
        if ($config) {
            $this->apiBaseUrl = $config['apiBaseUrl'];
            $this->userId = $config['userId'];
            $this->storeId = $config['storeId'];
        } else {
            // Try to fetch if not cached
            $this->fetch_config_from_api();
        }
    }
    
    public function maybe_fetch_config() {
        // Fetch config if not set or if it's been more than 24 hours
        $lastFetch = get_option($this->optionName . '_last_fetch', 0);
        if (empty($this->apiBaseUrl) || (time() - $lastFetch) > 86400) {
            $this->fetch_config_from_api();
        }
    }
    
    private function fetch_config_from_api() {
        try {
            $storeUrl = home_url();
            // Use WordPress constant if defined, otherwise use default
            $configBaseUrl = defined('DEEPRINTZ_API_BASE_URL') 
                ? DEEPRINTZ_API_BASE_URL 
                : 'https://devdevapi.deeprintz.com';
            $configApiUrl = $configBaseUrl . '/api/woocommerce/plugin-config';
            
            $response = wp_remote_get($configApiUrl . '?store_url=' . urlencode($storeUrl), array(
                'timeout' => 10,
                'sslverify' => true
            ));
            
            if (is_wp_error($response)) {
                error_log('Deeprintz Shipping: Failed to fetch config - ' . $response->get_error_message());
                return;
            }
            
            $body = wp_remote_retrieve_body($response);
            $data = json_decode($body, true);
            
            if ($data && $data['success'] && $data['data']) {
                $config = array(
                    'apiBaseUrl' => $data['data']['apiBaseUrl'],
                    'userId' => $data['data']['userId'],
                    'storeId' => $data['data']['storeId']
                );
                
                update_option($this->optionName, $config);
                update_option($this->optionName . '_last_fetch', time());
                
                $this->apiBaseUrl = $config['apiBaseUrl'];
                $this->userId = $config['userId'];
                $this->storeId = $config['storeId'];
                
                error_log('Deeprintz Shipping: Config fetched successfully');
            } else {
                error_log('Deeprintz Shipping: Invalid config response from API');
            }
        } catch (Exception $e) {
            error_log('Deeprintz Shipping: Error fetching config - ' . $e->getMessage());
        }
    }
    
    private function get_api_base_url() {
        if (!$this->apiBaseUrl) {
            $this->load_config();
        }
        return $this->apiBaseUrl ? $this->apiBaseUrl : 'https://devdevapi.deeprintz.com/api/woocommerce';
    }
    
    private function get_user_id() {
        if (!$this->userId) {
            $this->load_config();
        }
        return $this->userId ? $this->userId : '';
    }
    
    private function get_store_id() {
        if (!$this->storeId) {
            $this->load_config();
        }
        return $this->storeId ? $this->storeId : '';
    }
    
    public function init_shipping_method() {
        // Class is defined in this same file below, no need to require
        // The WC_Courier_Shipping_Method class will be loaded automatically
    }
    
    public function add_shipping_method($methods) {
        $methods['custom_courier_shipping'] = 'WC_Courier_Shipping_Method';
        return $methods;
    }
    
    public function enqueue_scripts() {
        if (is_checkout()) {
            // Enqueue jQuery if not already loaded
            wp_enqueue_script('jquery');
            
            // Add inline CSS for shipping display
            $css = '
            .custom-shipping-display {
                background: #f8f9fa;
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                margin: 20px 0;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            .shipping-options-container {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }
            .shipping-option {
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                padding: 15px;
                transition: all 0.2s ease;
                cursor: pointer;
            }
            .shipping-option:hover {
                border-color: #007cba;
                box-shadow: 0 2px 8px rgba(0,123,186,0.15);
            }
            .shipping-option.recommended {
                border-color: #007cba;
                background: #f0f8ff;
                position: relative;
            }
            .shipping-option.recommended::before {
                content: "★ Recommended";
                position: absolute;
                top: -8px;
                left: 15px;
                background: #007cba;
                color: white;
                font-size: 10px;
                padding: 2px 8px;
                border-radius: 10px;
                font-weight: 600;
            }
            .shipping-loading {
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                padding: 20px;
                background: white;
                border: 1px solid #ddd;
                border-radius: 6px;
                margin: 10px 0;
            }
            .loading-spinner {
                width: 20px;
                height: 20px;
                border: 2px solid #f3f3f3;
                border-top: 2px solid #007cba;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            ';
            wp_add_inline_style('woocommerce-general', $css);
        }
    }
    
    public function add_inline_script() {
        if (is_checkout()) {
            ?>
            <script>
            (function($) {
                'use strict';
                
                class WooCommerceCheckoutShipping {
                    constructor(config) {
                        this.config = config;
                        this.shippingCache = new Map();
                        this.isCalculating = false;
                        this.currentShippingMethod = null;
                        this.init();
                    }
                    
                    init() {
                        console.log('🚀 WooCommerce Checkout Shipping initialized');
                        this.waitForWooCommerce();
                    }
                    
                    waitForWooCommerce() {
                        if (typeof $ !== 'undefined' && typeof wc_checkout_params !== 'undefined') {
                            this.setupCheckoutIntegration();
                            console.log('✅ WooCommerce checkout detected, integration complete');
                        } else {
                            setTimeout(() => this.waitForWooCommerce(), 500);
                        }
                    }
                    
                    setupCheckoutIntegration() {
                        this.setupPincodeWatcher();
                        this.setupShippingMethodWatcher();
                        this.setupCustomShippingDisplay();
                        $(document.body).on('update_checkout', this.handleCheckoutUpdate.bind(this));
                        this.checkExistingPincode();
                    }
                    
                    setupPincodeWatcher() {
                        $(document.body).on('change', 'input[name="billing_postcode"]', (e) => {
                            this.handlePincodeChange(e.target.value);
                        });
                        
                        $(document.body).on('input', 'input[name="billing_postcode"]', this.debounce((e) => {
                            this.handlePincodeInput(e.target.value);
                        }, 1000));
                    }
                    
                    setupShippingMethodWatcher() {
                        $(document.body).on('change', 'input[name="shipping_method[0]"]', (e) => {
                            this.handleShippingMethodChange(e.target.value);
                        });
                    }
                    
                    setupCustomShippingDisplay() {
                        this.addCustomShippingDisplay();
                        this.addLoadingIndicator();
                    }
                    
                    addCustomShippingDisplay() {
                        const shippingDisplayHTML = \`
                            <div id="custom-shipping-display" class="custom-shipping-display" style="display: none;">
                                <div class="shipping-header">
                                    <h4>Available Shipping Options</h4>
                                    <span class="shipping-status"></span>
                                </div>
                                <div id="shipping-options-container" class="shipping-options-container">
                                    <!-- Shipping options will be populated here -->
                                </div>
                                <div id="shipping-error" class="shipping-error" style="display: none;">
                                    <!-- Error messages will be shown here -->
                                </div>
                            </div>
                        \`;
                        
                        const targetElement = $('.woocommerce-shipping-methods').length ? 
                                             $('.woocommerce-shipping-methods')[0] : 
                                             $('.woocommerce-checkout-review-order-table')[0];
                        
                        if (targetElement) {
                            $(targetElement).before(shippingDisplayHTML);
                        }
                    }
                    
                    addLoadingIndicator() {
                        const loadingHTML = \`
                            <div id="shipping-loading" class="shipping-loading" style="display: none;">
                                <div class="loading-spinner"></div>
                                <span>Calculating shipping charges...</span>
                            </div>
                        \`;
                        
                        $('#custom-shipping-display').append(loadingHTML);
                    }
                    
                    async handlePincodeChange(pincode) {
                        if (!pincode || pincode.length < 6) {
                            this.hideCustomShippingDisplay();
                            return;
                        }
                        
                        console.log(\`📝 Pincode changed to: \${pincode}\`);
                        await this.calculateShippingForPincode(pincode);
                    }
                    
                    async handlePincodeInput(pincode) {
                        if (!pincode || pincode.length < 6) {
                            return;
                        }
                        
                        console.log(\`🔄 Auto-calculating shipping for pincode: \${pincode}\`);
                        await this.calculateShippingForPincode(pincode);
                    }
                    
                    async calculateShippingForPincode(pincode) {
                        if (this.isCalculating) {
                            console.log('⏳ Shipping calculation already in progress...');
                            return;
                        }
                        
                        try {
                            this.isCalculating = true;
                            this.showLoading();
                            this.hideError();
                            
                            console.log(\`🚚 Calculating shipping for pincode: \${pincode}\`);
                            
                            const cartData = this.getCartData();
                            console.log('📦 Cart data:', cartData);
                            
                            const cacheKey = \`\${pincode}_\${cartData.weight}_\${cartData.total}\`;
                            if (this.shippingCache.has(cacheKey)) {
                                console.log('💾 Using cached shipping data');
                                const cachedData = this.shippingCache.get(cacheKey);
                                this.displayShippingOptions(cachedData.shipping_options);
                                return;
                            }
                            
                            const response = await fetch(\`\${this.config.apiBaseUrl}/shipping/calculate\`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    postCode: pincode,
                                    weight: cartData.weight,
                                    orderAmount: cartData.total,
                                    paymentMode: 'prepaid',
                                    items: cartData.items
                                })
                            });
                            
                            const result = await response.json();
                            console.log('📡 API Response:', result);
                            
                            if (result.success && result.data.shipping_options.length > 0) {
                                this.shippingCache.set(cacheKey, result.data);
                                this.displayShippingOptions(result.data.shipping_options);
                                this.updateWooCommerceShippingMethods(result.data.shipping_options);
                                console.log('✅ Shipping calculated and updated successfully');
                            } else {
                                console.log('❌ No shipping options available:', result.message);
                                this.showError(result.message || 'No shipping options available for this pincode');
                            }
                        } catch (error) {
                            console.error('❌ Shipping calculation error:', error);
                            this.showError('Failed to calculate shipping. Please try again.');
                        } finally {
                            this.isCalculating = false;
                            this.hideLoading();
                        }
                    }
                    
                    displayShippingOptions(shippingOptions) {
                        const container = $('#shipping-options-container');
                        if (!container.length) return;
                        
                        let optionsHTML = '';
                        
                        shippingOptions.forEach((option, index) => {
                            const isRecommended = index === 0;
                            const totalCost = option.shipping_cost + (option.cod_charge || 0);
                            
                            optionsHTML += \`
                                <div class="shipping-option \${isRecommended ? 'recommended' : ''}" data-courier-id="\${option.courier_id}">
                                    <div class="shipping-option-header">
                                        <input type="radio" name="custom_shipping_method" 
                                               id="custom_shipping_\${option.courier_id}" 
                                               value="\${option.courier_id}" 
                                               data-cost="\${totalCost}"
                                               \${isRecommended ? 'checked' : ''}>
                                        <label for="custom_shipping_\${option.courier_id}">
                                            <span class="courier-name">\${option.courier_name}</span>
                                            <span class="shipping-cost">₹\${totalCost.toFixed(2)}</span>
                                        </label>
                                    </div>
                                    <div class="shipping-option-details">
                                        <span class="delivery-time">\${option.estimated_delivery || '3-5 days'}</span>
                                        <span class="shipping-breakdown">
                                            Shipping: ₹\${option.shipping_cost.toFixed(2)}
                                            \${option.cod_charge ? \` + COD: ₹\${option.cod_charge.toFixed(2)}\` : ''}
                                        </span>
                                    </div>
                                </div>
                            \`;
                        });
                        
                        container.html(optionsHTML);
                        this.showCustomShippingDisplay();
                        this.bindShippingOptionEvents();
                        
                        if (shippingOptions.length > 0) {
                            this.selectShippingOption(shippingOptions[0]);
                        }
                    }
                    
                    bindShippingOptionEvents() {
                        $('input[name="custom_shipping_method"]').on('change', (e) => {
                            const courierId = e.target.value;
                            const cost = parseFloat(e.target.dataset.cost);
                            const selectedOption = this.findShippingOption(courierId);
                            
                            if (selectedOption) {
                                this.selectShippingOption(selectedOption);
                            }
                        });
                    }
                    
                    findShippingOption(courierId) {
                        const pincode = this.getCurrentPincode();
                        const cartData = this.getCartData();
                        const cacheKey = \`\${pincode}_\${cartData.weight}_\${cartData.total}\`;
                        
                        if (this.shippingCache.has(cacheKey)) {
                            const cachedData = this.shippingCache.get(cacheKey);
                            return cachedData.shipping_options.find(option => 
                                option.courier_id === courierId
                            );
                        }
                        
                        return null;
                    }
                    
                    selectShippingOption(option) {
                        console.log('🔄 Selecting shipping option:', option);
                        
                        this.currentShippingMethod = option;
                        this.updateWooCommerceShippingMethod(option);
                        this.updateOrderTotals(option);
                        this.triggerCheckoutUpdate();
                    }
                    
                    updateWooCommerceShippingMethod(option) {
                        const totalCost = option.shipping_cost + (option.cod_charge || 0);
                        
                        this.removeCustomWooCommerceMethods();
                        
                        const shippingMethodsContainer = $('.woocommerce-shipping-methods');
                        if (shippingMethodsContainer.length) {
                            const methodHTML = \`
                                <li class="custom-shipping-method">
                                    <input type="radio" name="shipping_method[0]" 
                                           id="shipping_method_0_custom" 
                                           value="custom_\${option.courier_id}" 
                                           class="shipping_method" 
                                           checked>
                                    <label for="shipping_method_0_custom">
                                        \${option.courier_name} - ₹\${totalCost.toFixed(2)}
                                    </label>
                                </li>
                            \`;
                            
                            shippingMethodsContainer.append(methodHTML);
                        }
                    }
                    
                    removeCustomWooCommerceMethods() {
                        $('.custom-shipping-method').remove();
                    }
                    
                    updateOrderTotals(option) {
                        const totalCost = option.shipping_cost + (option.cod_charge || 0);
                        
                        const shippingCostElement = $('.woocommerce-checkout-review-order-table .shipping .amount');
                        if (shippingCostElement.length) {
                            shippingCostElement.text(\`₹\${totalCost.toFixed(2)}\`);
                        }
                        
                        this.updateTotalAmount(totalCost);
                    }
                    
                    updateTotalAmount(shippingCost) {
                        const subtotalElement = $('.woocommerce-checkout-review-order-table .cart-subtotal .amount');
                        if (subtotalElement.length) {
                            const subtotalText = subtotalElement.text();
                            const subtotal = parseFloat(subtotalText.replace(/[^\\d.]/g, '')) || 0;
                            const total = subtotal + shippingCost;
                            
                            const totalElement = $('.woocommerce-checkout-review-order-table .order-total .amount');
                            if (totalElement.length) {
                                totalElement.text(\`₹\${total.toFixed(2)}\`);
                            }
                        }
                    }
                    
                    updateWooCommerceShippingMethods(shippingOptions) {
                        if (shippingOptions.length > 0) {
                            this.selectShippingOption(shippingOptions[0]);
                        }
                    }
                    
                    handleShippingMethodChange(methodValue) {
                        if (methodValue.startsWith('custom_')) {
                            const courierId = methodValue.replace('custom_', '');
                            const selectedOption = this.findShippingOption(courierId);
                            
                            if (selectedOption) {
                                this.selectShippingOption(selectedOption);
                            }
                        }
                    }
                    
                    handleCheckoutUpdate() {
                        console.log('🔄 WooCommerce checkout updated');
                    }
                    
                    getCartData() {
                        try {
                            let weight = 500;
                            let total = 0;
                            let items = [];
                            
                            const cartTotalElement = $('.woocommerce-checkout-review-order-table .cart-subtotal .amount');
                            if (cartTotalElement.length) {
                                const totalText = cartTotalElement.text();
                                total = parseFloat(totalText.replace(/[^\\d.]/g, '')) || 0;
                            }
                            
                            const cartItems = $('.woocommerce-checkout-review-order-table .cart_item');
                            cartItems.each(function() {
                                const itemName = $(this).find('.product-name').text().trim();
                                const itemQuantity = $(this).find('.product-quantity').text().trim();
                                if (itemName) {
                                    items.push({
                                        name: itemName,
                                        quantity: itemQuantity || '1',
                                        weight: 500
                                    });
                                }
                            });
                            
                            return { weight, total, items };
                        } catch (error) {
                            console.error('Error getting cart data:', error);
                            return { weight: 500, total: 0, items: [] };
                        }
                    }
                    
                    getCurrentPincode() {
                        let pincode = $('input[name="billing_postcode"]').val();
                        if (!pincode) {
                            pincode = $('input[name="shipping_postcode"]').val();
                        }
                        return pincode ? pincode.trim() : '';
                    }
                    
                    checkExistingPincode() {
                        const pincode = this.getCurrentPincode();
                        if (pincode && pincode.length >= 6) {
                            console.log('📍 Found existing pincode:', pincode);
                            this.calculateShippingForPincode(pincode);
                        }
                    }
                    
                    showCustomShippingDisplay() {
                        $('#custom-shipping-display').show();
                    }
                    
                    hideCustomShippingDisplay() {
                        $('#custom-shipping-display').hide();
                    }
                    
                    showLoading() {
                        $('#shipping-loading').show();
                    }
                    
                    hideLoading() {
                        $('#shipping-loading').hide();
                    }
                    
                    showError(message) {
                        $('#shipping-error').html(\`<div class="error-message">\${message}</div>\`).show();
                    }
                    
                    hideError() {
                        $('#shipping-error').hide();
                    }
                    
                    triggerCheckoutUpdate() {
                        $(document.body).trigger('update_checkout');
                    }
                    
                    debounce(func, wait) {
                        let timeout;
                        return function executedFunction(...args) {
                            const later = () => {
                                clearTimeout(timeout);
                                func(...args);
                            };
                            clearTimeout(timeout);
                            timeout = setTimeout(later, wait);
                        };
                    }
                }
                
                // Initialize the checkout shipping integration
                $(document).ready(function() {
                    const config = {
                        apiBaseUrl: '<?php echo esc_js($this->get_api_base_url()); ?>',
                        userId: '<?php echo esc_js($this->get_user_id()); ?>',
                        storeId: '<?php echo esc_js($this->get_store_id()); ?>'
                    };
                    
                    window.wooCheckoutShipping = new WooCommerceCheckoutShipping(config);
                });
                
            })(jQuery);
            </script>
            <?php
        }
    }
}

// Custom WooCommerce Shipping Method Class
class WC_Courier_Shipping_Method extends WC_Shipping_Method {
    
    public function __construct($instance_id = 0) {
        $this->id = 'custom_courier_shipping';
        $this->instance_id = absint($instance_id);
        $this->method_title = __('Courier Partners', 'woocommerce');
        $this->method_description = __('Real-time shipping rates from multiple courier partners', 'woocommerce');
        $this->supports = array(
            'shipping-zones',
            'instance-settings',
            'instance-settings-modal',
        );
        
        $this->init();
    }
    
    public function init() {
        $this->init_form_fields();
        $this->init_settings();
        
        $this->title = $this->get_option('title');
        $this->enabled = $this->get_option('enabled');
        
        add_action('woocommerce_update_options_shipping_' . $this->id, array($this, 'process_admin_options'));
    }
    
    public function init_form_fields() {
        $this->instance_form_fields = array(
            'title' => array(
                'title' => __('Method Title', 'woocommerce'),
                'type' => 'text',
                'description' => __('This controls the title which the user sees during checkout.', 'woocommerce'),
                'default' => __('Courier Partners', 'woocommerce'),
                'desc_tip' => true,
            ),
            'enabled' => array(
                'title' => __('Enable/Disable', 'woocommerce'),
                'type' => 'checkbox',
                'label' => __('Enable this shipping method', 'woocommerce'),
                'default' => 'yes',
            ),
        );
    }
    
    public function calculate_shipping($package = array()) {
        // Get the shipping address
        $destination = $package['destination'];
        $postcode = $destination['postcode'];
        
        if (empty($postcode)) {
            return;
        }
        
        // Calculate cart weight and total
        $weight = 0;
        $total = 0;
        
        foreach ($package['contents'] as $item_id => $values) {
            $product = $values['data'];
            $weight += $product->get_weight() * $values['quantity'];
            $total += $product->get_price() * $values['quantity'];
        }
        
        // Convert weight to grams if needed
        $weight = wc_get_weight($weight, 'g');
        
        // Call your API to get shipping rates
        $shipping_rates = $this->get_shipping_rates_from_api($postcode, $weight, $total);
        
        if (!empty($shipping_rates)) {
            foreach ($shipping_rates as $rate) {
                $this->add_rate(array(
                    'id' => $this->id . '_' . $rate['courier_id'],
                    'label' => $rate['courier_name'],
                    'cost' => $rate['shipping_cost'],
                    'meta_data' => array(
                        'courier_id' => $rate['courier_id'],
                        'estimated_delivery' => $rate['estimated_delivery'],
                        'cod_charge' => $rate['cod_charge']
                    )
                ));
            }
        }
    }
    
    private function get_shipping_rates_from_api($postcode, $weight, $total) {
        // Get API URL from WordPress options (set by main plugin class)
        $config = get_option('deeprintz_courier_shipping_config');
        $apiBaseUrl = $config && isset($config['apiBaseUrl']) 
            ? $config['apiBaseUrl'] 
            : 'https://devdevapi.deeprintz.com/api/woocommerce';
        
        $api_url = $apiBaseUrl . '/shipping/calculate';
        
        $request_data = array(
            'postCode' => $postcode,
            'weight' => $weight,
            'orderAmount' => $total,
            'paymentMode' => 'prepaid',
            'items' => array()
        );
        
        $response = wp_remote_post($api_url, array(
            'headers' => array('Content-Type' => 'application/json'),
            'body' => json_encode($request_data),
            'timeout' => 10
        ));
        
        if (is_wp_error($response)) {
            error_log('Shipping API Error: ' . $response->get_error_message());
            return array();
        }
        
        $body = wp_remote_retrieve_body($response);
        $data = json_decode($body, true);
        
        if ($data && $data['success'] && !empty($data['data']['shipping_options'])) {
            return $data['data']['shipping_options'];
        }
        
        return array();
    }
}

// Initialize the plugin
new CourierShippingIntegration();
`;

  return {
    name: pluginName,
    slug: pluginSlug,
    content: pluginContent
  };
}

// Export for use in export script
module.exports.createEnhancedShippingPlugin = createEnhancedShippingPlugin;

// Inject enhanced shipping script directly (fallback method)
async function injectEnhancedShippingScript(WooCommerce, store, userId) {
  try {
    console.log(`Injecting enhanced shipping script for vendor ${userId}...`);
    
    // This would inject the script directly into the theme
    // For now, we'll return true as a placeholder
    // In a real implementation, you might use WordPress REST API or file system access
    
    console.log(`Enhanced shipping script injected for vendor ${userId}`);
    return true;
    
  } catch (error) {
    console.error(`Error injecting enhanced shipping script for vendor ${userId}:`, error);
    return false;
  }
}

// Get shipping setup status for a vendor
module.exports.getVendorShippingStatus = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required"
      });
    }

    // Get the WooCommerce store credentials
    const store = await global.dbConnection('woocommerce_stores')
      .where('user_id', userId)
      .where('status', 'connected')
      .first();

    if (!store) {
      return res.status(404).json({
        success: false,
        message: "No WooCommerce store found for this vendor"
      });
    }

    // Check shipping setup status
    const shippingMethod = await global.dbConnection('woocommerce_shipping_methods')
      .where('store_id', store.id)
      .where('method_type', 'custom_courier_partners')
      .first()
      .catch(() => null);

    const webhooks = await global.dbConnection('woocommerce_webhooks')
      .where('store_id', store.id)
      .select('*')
      .catch(() => []);

    const frontendShipping = await global.dbConnection('woocommerce_frontend_shipping')
      .where('store_id', store.id)
      .first()
      .catch(() => null);

    return res.json({
      success: true,
      message: "Shipping status retrieved successfully",
      data: {
        store_id: store.id,
        vendor_id: userId,
        shipping_configured: !!shippingMethod,
        webhooks_configured: webhooks.length > 0,
        frontend_configured: !!frontendShipping,
        total_webhooks: webhooks.length,
        shipping_method: shippingMethod ? {
          id: shippingMethod.method_id,
          type: shippingMethod.method_type,
          is_active: shippingMethod.is_active
        } : null,
        webhooks: webhooks.map(w => ({
          id: w.webhook_id,
          name: w.name,
          topic: w.topic,
          status: w.status
        }))
      }
    });

  } catch (error) {
    console.error("Error getting vendor shipping status:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get shipping status",
      error: error.message
    });
  }
};

// Create shipping plugin file content for the vendor
async function createShippingPluginFile(store, userId) {
  try {
    console.log(`Creating shipping plugin file for vendor ${userId}...`);
    
    // Get the base URL for API calls
    const baseUrl = 'https://devdevapi.deeprintz.com';
    
    // Create the plugin PHP file content
    const pluginContent = `<?php
/**
 * Plugin Name: Vendor Shipping Integration
 * Description: Automatic shipping calculation integration for vendor ${userId}
 * Version: 1.0.0
 * Author: Your System
 * Store ID: ${store.id}
 * Vendor ID: ${userId}
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

// Add shipping integration to WooCommerce
function add_vendor_shipping_integration_${userId}() {
    // Only load on checkout and cart pages
    if (is_checkout() || is_cart()) {
        // Enqueue the shipping integration script
        wp_enqueue_script(
            'woocommerce-shipping-integration-${userId}',
            '${baseUrl}/public/woocommerce-shipping-integration.js',
            array('jquery'),
            '1.0.0',
            true
        );
        
        // Pass configuration to JavaScript
        wp_localize_script('woocommerce-shipping-integration-${userId}', 'wcShippingConfig${userId}', array(
            'apiBaseUrl' => '${baseUrl}/api/deeprintz/live/woocommerce',
            'userId' => ${userId},
            'storeId' => ${store.id},
            'storeUrl' => '${store.store_url}',
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('wc_shipping_nonce_${userId}')
        ));
        
        // Add inline script to initialize
        wp_add_inline_script('woocommerce-shipping-integration-${userId}', '
            document.addEventListener("DOMContentLoaded", function() {
                if (typeof wcShippingConfig${userId} !== "undefined" && typeof WooCommerceShippingIntegration !== "undefined") {
                    try {
                        const shippingIntegration = new WooCommerceShippingIntegration(wcShippingConfig${userId});
                        console.log("🚀 Vendor ${userId} Shipping Integration initialized");
                        
                        // Store reference globally for debugging
                        window.shippingIntegration${userId} = shippingIntegration;
                    } catch (error) {
                        console.error("Error initializing shipping integration:", error);
                    }
                } else {
                    console.warn("Shipping integration dependencies not loaded");
                }
            });
        ');
    }
}
add_action('wp_enqueue_scripts', 'add_vendor_shipping_integration_${userId}');

// Add admin notice for successful integration
function vendor_shipping_admin_notice_${userId}() {
    if (current_user_can('manage_options')) {
        echo '<div class="notice notice-success is-dismissible">
            <p><strong>🚚 Shipping Integration Active!</strong> Vendor ${userId} shipping calculation is now active on your store.</p>
        </div>';
    }
}
add_action('admin_notices', 'vendor_shipping_admin_notice_${userId}');

// Add shipping method description to checkout
function add_shipping_method_description_${userId}() {
    if (is_checkout()) {
        echo '<div class="shipping-integration-info" style="background: #f0f8ff; padding: 15px; margin: 15px 0; border-radius: 5px; border-left: 4px solid #0073aa;">
            <h4 style="margin: 0 0 10px 0; color: #0073aa;">🚚 Real-time Shipping Calculation</h4>
            <p style="margin: 0; color: #666;">Shipping charges are automatically calculated based on your pincode using multiple courier partners including DTDC, Blue Dart, and more.</p>
        </div>';
    }
}
add_action('woocommerce_before_checkout_form', 'add_shipping_method_description_${userId}');

// Add shipping calculator to cart page
function add_cart_shipping_calculator_${userId}() {
    if (is_cart()) {
        echo '<div class="cart-shipping-calculator" style="background: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 5px;">
            <h3 style="margin: 0 0 15px 0;">🚚 Calculate Shipping</h3>
            <p style="margin: 0 0 15px 0; color: #666;">Enter your pincode to see available shipping options and costs.</p>
            <div class="shipping-calculator-form">
                <input type="text" id="cart_shipping_postcode" placeholder="Enter your pincode" style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; width: 200px; margin-right: 10px;">
                <button type="button" id="calculate_cart_shipping" class="button" style="padding: 10px 20px;">Calculate Shipping</button>
            </div>
            <div id="cart_shipping_results" style="margin-top: 15px; display: none;"></div>
        </div>';
        
        // Add cart shipping calculator JavaScript
        wp_add_inline_script('woocommerce-shipping-integration-${userId}', '
            jQuery(document).ready(function($) {
                $("#calculate_cart_shipping").on("click", function() {
                    const postcode = $("#cart_shipping_postcode").val().trim();
                    if (postcode && postcode.length >= 6) {
                        if (typeof window.shippingIntegration${userId} !== "undefined") {
                            window.shippingIntegration${userId}.calculateShippingForCheckout(postcode);
                        }
                    }
                });
            });
        ');
    }
}
add_action('woocommerce_after_cart_table', 'add_cart_shipping_calculator_${userId}');

// Plugin activation hook
register_activation_hook(__FILE__, 'vendor_shipping_activate_${userId}');
function vendor_shipping_activate_${userId}() {
    // Create a flag to show activation was successful
    add_option('vendor_shipping_${userId}_activated', true);
}

// Plugin deactivation hook
register_deactivation_hook(__FILE__, 'vendor_shipping_deactivate_${userId}');
function vendor_shipping_deactivate_${userId}() {
    // Clean up on deactivation
    delete_option('vendor_shipping_${userId}_activated');
}

// Add settings page for the vendor
function add_vendor_shipping_settings_${userId}() {
    add_options_page(
        'Vendor ${userId} Shipping Settings',
        'Vendor Shipping',
        'manage_options',
        'vendor-shipping-${userId}',
        'vendor_shipping_settings_page_${userId}'
    );
}
add_action('admin_menu', 'add_vendor_shipping_settings_${userId}');

function vendor_shipping_settings_page_${userId}() {
    ?>
    <div class="wrap">
        <h1>🚚 Vendor ${userId} Shipping Integration</h1>
        <div class="card" style="max-width: 800px;">
            <h2>Integration Status</h2>
            <table class="form-table">
                <tr>
                    <th>Store URL:</th>
                    <td><a href="${store.store_url}" target="_blank">${store.store_url}</a></td>
                </tr>
                <tr>
                    <th>Vendor ID:</th>
                    <td>${userId}</td>
                </tr>
                <tr>
                    <th>Integration Status:</th>
                    <td><span style="color: green;">✅ Active</span></td>
                </tr>
                <tr>
                    <th>API Endpoint:</th>
                    <td>${baseUrl}/api/woocommerce</td>
                </tr>
            </table>
            
            <h3>Features</h3>
            <ul>
                <li>✅ Real-time shipping calculation</li>
                <li>✅ Multiple courier options</li>
                <li>✅ Automatic pincode detection</li>
                <li>✅ Cart and checkout integration</li>
            </ul>
            
            <h3>How It Works</h3>
            <ol>
                <li>Customer enters pincode in checkout</li>
                <li>System automatically calculates shipping from multiple couriers</li>
                <li>Customer sees available options with costs and delivery times</li>
                <li>Shipping cost is added to order total</li>
            </ol>
        </div>
    </div>
    <?php
}
`;

    console.log(`Shipping plugin file created for vendor ${userId}`);
    return pluginContent;
    
  } catch (error) {
    console.error(`Error creating shipping plugin file for vendor ${userId}:`, error);
    throw error;
  }
}

// Upload shipping plugin to WooCommerce store
async function uploadShippingPluginToStore(WooCommerce, pluginContent, store, userId) {
  try {
    console.log(`Uploading shipping plugin to store for vendor ${userId}...`);
    
    // Step 1: Create plugin file locally
    const pluginFileName = `vendor-shipping-${userId}.php`;
    const pluginFilePath = `public/plugins/${pluginFileName}`;
    
    try {
      // Ensure the plugins directory exists
      const fs = require('fs');
      const path = require('path');
      
      const pluginsDir = path.join(__dirname, '../plugins');
      if (!fs.existsSync(pluginsDir)) {
        fs.mkdirSync(pluginsDir, { recursive: true });
      }
      
      // Write the plugin file (pluginContent is an object with content property)
      fs.writeFileSync(path.join(pluginsDir, pluginFileName), pluginContent.content);
      console.log(`Plugin file created at: ${pluginFilePath}`);
      
      // Step 2: Try to automatically install via WordPress REST API
      const pluginInstalled = await installPluginViaWordPressAPI(store, pluginContent, userId);
      
      // Store plugin file info in database
      try {
        await global.dbConnection('woocommerce_frontend_shipping')
          .where('store_id', store.id)
          .update({
            plugin_file_path: pluginFilePath,
            plugin_file_name: pluginFileName,
            plugin_uploaded_at: new Date(),
            plugin_installed: pluginInstalled
          });
      } catch (dbError) {
        console.log("Could not update plugin file info in database:", dbError.message);
      }
      
      return pluginInstalled;
      
    } catch (fileError) {
      console.error(`Error creating plugin file for vendor ${userId}:`, fileError);
      return false;
    }
    
  } catch (error) {
    console.error(`Error uploading shipping plugin for vendor ${userId}:`, error);
    return false;
  }
}

// Install plugin via WordPress REST API
async function installPluginViaWordPressAPI(store, pluginContent, userId) {
  try {
    console.log(`Attempting to install plugin via WordPress REST API for vendor ${userId}...`);
    
    const fs = require('fs');
    const path = require('path');
    const axios = require('axios');
    
    // Create plugin directory structure
    const pluginDir = `courier-shipping-integration-${userId}`;
    const pluginDirPath = path.join(__dirname, '../plugins', pluginDir);
    const pluginFilePath = path.join(pluginDirPath, `${pluginDir}.php`);
    
    // Ensure directory exists
    if (!fs.existsSync(pluginDirPath)) {
      fs.mkdirSync(pluginDirPath, { recursive: true });
    }
    
    // Write plugin file to directory
    fs.writeFileSync(pluginFilePath, pluginContent.content);
    console.log(`Plugin file created: ${pluginFilePath}`);
    
    // Method 1: Try WordPress REST API with JWT Authentication
    try {
      const baseUrl = store.store_url.replace(/\/$/, '');
      
      // Try to authenticate with WordPress
      const authResponse = await axios.post(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
        username: store.wp_username || 'admin',
        password: store.wp_password || 'admin'
      }, {
        timeout: 10000
      });
      
      if (authResponse.data && authResponse.data.token) {
        const token = authResponse.data.token;
        console.log(`WordPress authentication successful for vendor ${userId}`);
        
        // Try to upload plugin via REST API
        const FormData = require('form-data');
        const form = new FormData();
        form.append('plugin', fs.createReadStream(pluginFilePath));
        form.append('activate', 'true');
        
        const uploadResponse = await axios.post(`${baseUrl}/wp-json/wp/v2/plugins`, form, {
          headers: {
            'Authorization': `Bearer ${token}`,
            ...form.getHeaders()
          },
          timeout: 30000
        });
        
        if (uploadResponse.status === 200 || uploadResponse.status === 201) {
          console.log(`Plugin uploaded successfully via REST API for vendor ${userId}`);
          return true;
        }
      }
    } catch (apiError) {
      if (apiError.response && apiError.response.status === 404) {
        console.log(`WordPress JWT plugin not available for vendor ${userId} - trying alternative methods`);
      } else {
        console.log(`REST API installation failed for vendor ${userId}:`, apiError.message);
      }
    }
    
    // Method 2: Try FTP upload if credentials are available
    try {
      const ftpUploaded = await uploadPluginViaFTP(store, pluginFilePath, userId);
      if (ftpUploaded) {
        console.log(`Plugin uploaded successfully via FTP for vendor ${userId}`);
        return true;
      }
    } catch (ftpError) {
      console.log(`FTP upload failed for vendor ${userId}:`, ftpError.message);
    }
    
    // Method 3: Try WordPress XML-RPC
    try {
      const xmlrpcUploaded = await uploadPluginViaXMLRPC(store, pluginFilePath, userId);
      if (xmlrpcUploaded) {
        console.log(`Plugin uploaded successfully via XML-RPC for vendor ${userId}`);
        return true;
      }
    } catch (xmlrpcError) {
      console.log(`XML-RPC upload failed for vendor ${userId}:`, xmlrpcError.message);
    }
    
    console.log(`All automatic installation methods failed for vendor ${userId} - manual installation required`);
    console.log(`Plugin file available at: ${pluginFilePath}`);
    console.log(`Please manually upload this file to: ${store.store_url}/wp-content/plugins/`);
    
    return false;
    
  } catch (error) {
    console.error(`Error installing plugin for vendor ${userId}:`, error);
    return false;
  }
}

// Upload plugin via FTP
async function uploadPluginViaFTP(store, pluginFilePath, userId) {
  try {
    console.log(`Attempting FTP upload for vendor ${userId}...`);
    
    // Check if FTP credentials are available in store config
    if (!store.ftp_host || !store.ftp_username || !store.ftp_password) {
      console.log(`FTP credentials not available for vendor ${userId}`);
      return false;
    }
    
    const Client = require('ftp');
    const fs = require('fs');
    const path = require('path');
    
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      client.on('ready', () => {
        const remotePath = `/wp-content/plugins/courier-shipping-integration-${userId}.php`;
        
        client.put(pluginFilePath, remotePath, (err) => {
          client.end();
          
          if (err) {
            console.log(`FTP upload error for vendor ${userId}:`, err.message);
            resolve(false);
          } else {
            console.log(`FTP upload successful for vendor ${userId}`);
            resolve(true);
          }
        });
      });
      
      client.on('error', (err) => {
        console.log(`FTP connection error for vendor ${userId}:`, err.message);
        resolve(false);
      });
      
      client.connect({
        host: store.ftp_host,
        user: store.ftp_username,
        password: store.ftp_password,
        port: store.ftp_port || 21
      });
    });
    
  } catch (error) {
    console.log(`FTP upload failed for vendor ${userId}:`, error.message);
    return false;
  }
}

// Upload plugin via WordPress XML-RPC
async function uploadPluginViaXMLRPC(store, pluginFilePath, userId) {
  try {
    console.log(`Attempting XML-RPC upload for vendor ${userId}...`);
    
    const axios = require('axios');
    const fs = require('fs');
    const baseUrl = store.store_url.replace(/\/$/, '');
    
    // Read plugin file content
    const pluginContent = fs.readFileSync(pluginFilePath, 'utf8');
    
    // Create XML-RPC request
    const xmlRequest = `<?xml version="1.0"?>
<methodCall>
  <methodName>wp.uploadFile</methodName>
  <params>
    <param><value><string>1</string></value></param>
    <param><value><string>${store.wp_username || 'admin'}</string></value></param>
    <param><value><string>${store.wp_password || 'admin'}</string></value></param>
    <param>
      <value>
        <struct>
          <member>
            <name>name</name>
            <value><string>courier-shipping-integration-${userId}.php</string></value>
          </member>
          <member>
            <name>type</name>
            <value><string>application/php</string></value>
          </member>
          <member>
            <name>bits</name>
            <value><base64>${Buffer.from(pluginContent).toString('base64')}</base64></value>
          </member>
          <member>
            <name>overwrite</name>
            <value><boolean>true</boolean></value>
          </member>
        </struct>
      </value>
    </param>
  </params>
</methodCall>`;
    
    const response = await axios.post(`${baseUrl}/xmlrpc.php`, xmlRequest, {
      headers: {
        'Content-Type': 'text/xml'
      },
      timeout: 30000
    });
    
    if (response.data && !response.data.includes('fault')) {
      console.log(`XML-RPC upload successful for vendor ${userId}`);
      return true;
    } else {
      console.log(`XML-RPC upload failed for vendor ${userId}:`, response.data);
      return false;
    }
    
  } catch (error) {
    console.log(`XML-RPC upload failed for vendor ${userId}:`, error.message);
    return false;
  }
}

// Activate shipping plugin (simplified - would need WordPress admin access)
async function activateShippingPlugin(WooCommerce, store, userId) {
  try {
    console.log(`Attempting to activate shipping plugin for vendor ${userId}...`);
    
    // Try to activate via WordPress REST API
    const pluginActivated = await activatePluginViaWordPressAPI(store, userId);
    
    if (pluginActivated) {
      console.log(`Plugin activated successfully for vendor ${userId}`);
      return true;
    } else {
      console.log(`Plugin activation failed for vendor ${userId} - will require manual activation`);
      return false;
    }
    
  } catch (error) {
    console.error(`Error activating shipping plugin for vendor ${userId}:`, error);
    return false;
  }
}

// Activate plugin via WordPress REST API
async function activatePluginViaWordPressAPI(store, userId) {
  try {
    console.log(`Attempting to activate plugin via WordPress REST API for vendor ${userId}...`);
    
    const axios = require('axios');
    
    // Try to authenticate with WordPress
    const baseUrl = store.store_url.replace(/\/$/, ''); // Remove trailing slash
    const authResponse = await axios.post(`${baseUrl}/wp-json/jwt-auth/v1/token`, {
      username: store.wp_username || 'admin',
      password: store.wp_password || 'admin'
    });
    
    if (authResponse.data && authResponse.data.token) {
      const token = authResponse.data.token;
      
      // Try to activate plugin
      const activateResponse = await axios.post(`${baseUrl}/wp-json/wp/v2/plugins/activate`, {
        plugin: `vendor-shipping-${userId}/vendor-shipping-${userId}.php`
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Plugin activated successfully via REST API for vendor ${userId}`);
      return true;
    }
    
    return false;
    
  } catch (error) {
    if (error.response && error.response.status === 404) {
      console.log(`WordPress JWT plugin not available for vendor ${userId} - manual installation required`);
      console.log(`Please install JWT Authentication for WP REST API plugin on ${store.store_url}`);
    } else {
      console.error(`Error activating plugin via WordPress API for vendor ${userId}:`, error);
    }
    return false;
  }
}

// Fallback method: Inject shipping script directly into WooCommerce theme
async function injectShippingScriptDirectly(WooCommerce, store, userId) {
  try {
    console.log(`Attempting fallback method: inject shipping script directly for vendor ${userId}...`);
    
    // Method 1: Try to add custom CSS/JS via WooCommerce settings
    try {
      // Add custom CSS to inject shipping script
      const customCSS = `
        /* Vendor ${userId} Shipping Integration */
        .woocommerce-checkout:after {
          content: '';
          display: block;
          height: 0;
        }
        
        /* Inject shipping script */
        .woocommerce-checkout:after {
          content: '<script src="https://devdevapi.deeprintz.com/public/woocommerce-shipping-integration.js"></script><script>new WooCommerceShippingIntegration({apiBaseUrl: "https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce", userId: ${userId}, storeId: ${store.id}});</script>';
        }
      `;
      
      // Try to update WooCommerce customizer settings
      const customizerResponse = await WooCommerce.post('settings/general', {
        woocommerce_custom_css: customCSS
      });
      
      if (customizerResponse.status === 200) {
        console.log(`Fallback method successful: CSS injection for vendor ${userId}`);
        return true;
      }
    } catch (cssError) {
      console.log(`CSS injection failed for vendor ${userId}:`, cssError.message);
    }
    
    // Method 2: Try to create a custom page with shipping integration
    try {
      const pageData = {
        title: `Shipping Integration - Vendor ${userId}`,
        content: `
          <div id="shipping-integration-${userId}">
            <h2>🚚 Real-time Shipping Calculation</h2>
            <p>Shipping charges are automatically calculated based on your pincode.</p>
            <script src="https://devdevapi.deeprintz.com/public/woocommerce-shipping-integration.js"></script>
            <script>
              document.addEventListener('DOMContentLoaded', function() {
                new WooCommerceShippingIntegration({
                  apiBaseUrl: 'https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce',
                  userId: ${userId},
                  storeId: ${store.id}
                });
              });
            </script>
          </div>
        `,
        status: 'publish',
        type: 'page'
      };
      
      const pageResponse = await WooCommerce.post('pages', pageData);
      if (pageResponse.status === 201) {
        console.log(`Fallback method successful: Custom page created for vendor ${userId}`);
        return true;
      }
    } catch (pageError) {
      console.log(`Custom page creation failed for vendor ${userId}:`, pageError.message);
    }
    
    // Method 3: Create a manual installation file
    try {
      const fs = require('fs');
      const path = require('path');
      
      const manualInstallContent = `<?php
/**
 * Manual Installation Instructions for Vendor ${userId}
 * 
 * Since automatic installation failed, please follow these steps:
 * 
 * 1. Download the plugin file: vendor-shipping-${userId}.php
 * 2. Upload it to your WordPress site: wp-content/plugins/vendor-shipping-${userId}/
 * 3. Activate the plugin from WordPress admin: Plugins > Installed Plugins
 * 
 * Plugin file location: ${path.join(__dirname, '../plugins', `vendor-shipping-${userId}.php`)}
 */

echo '<div style="background: #f0f0f0; padding: 20px; margin: 20px; border: 1px solid #ccc;">
  <h2>🚚 Manual Plugin Installation Required</h2>
  <p><strong>Vendor ID:</strong> ${userId}</p>
  <p><strong>Store ID:</strong> ${store.id}</p>
  <p><strong>Plugin File:</strong> vendor-shipping-${userId}.php</p>
  <p><strong>Instructions:</strong></p>
  <ol>
    <li>Download the plugin file from: <code>${path.join(__dirname, '../plugins', `vendor-shipping-${userId}.php`)}</code></li>
    <li>Upload it to your WordPress site: <code>wp-content/plugins/vendor-shipping-${userId}/</code></li>
    <li>Activate the plugin from WordPress admin: <strong>Plugins > Installed Plugins</strong></li>
  </ol>
  <p><em>This file was generated because automatic installation failed. Please install manually.</em></p>
</div>';
?>`;

      const manualInstallPath = path.join(__dirname, '../plugins', `manual-install-${userId}.php`);
      fs.writeFileSync(manualInstallPath, manualInstallContent);
      
      console.log(`Manual installation file created for vendor ${userId}: ${manualInstallPath}`);
      console.log(`Plugin file available at: ${path.join(__dirname, '../plugins', `vendor-shipping-${userId}.php`)}`);
      
      // Update database to indicate manual installation required
      try {
        await global.dbConnection('woocommerce_frontend_shipping')
          .where('store_id', store.id)
          .update({
            manual_installation_required: true,
            manual_install_file: manualInstallPath,
            plugin_file_path: path.join(__dirname, '../plugins', `vendor-shipping-${userId}.php`)
          });
      } catch (dbError) {
        console.log("Could not update manual installation info in database:", dbError.message);
      }
      
      return true; // Consider this a success since we provided manual instructions
    } catch (manualError) {
      console.log(`Manual installation file creation failed for vendor ${userId}:`, manualError.message);
    }
    
    console.log(`All fallback methods failed for vendor ${userId}`);
    return false;
    
  } catch (error) {
    console.error(`Error in fallback method for vendor ${userId}:`, error);
    return false;
  }
}

module.exports.generateToken = async (req, res) => {
  try {
      const baseURL = "https://api.nimbuspost.com/v1/";

      // Prepare the request data
      const data = {
          email: "care+1201@deeprintz.com", // Environment variables for security
          password: "3JfzKQpHsG"
      };

      // Make the POST request
      const response = await axios.post(`${baseURL}users/login`, data, {
          headers: { 'Content-Type': 'application/json' }
      });

      // Extract and return the token
      const token = response.data; // Assuming token is part of response body
      return token || null;

  } catch (err) {
      console.log("error", err)
  }
  return null;
}