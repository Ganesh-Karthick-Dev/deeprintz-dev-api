const WooCommerceRestApi = require("@woocommerce/woocommerce-rest-api").default;

// WooCommerce API configuration
const defaultConfig = {
  version: "wc/v3",
  timeout: 30000,
};

class WooCommerceService {
  constructor() {
    this.config = defaultConfig;
  }

  // Initialize WooCommerce API client
  createClient(storeUrl, consumerKey, consumerSecret) {
    return new WooCommerceRestApi({
      url: storeUrl,
      consumerKey: consumerKey,
      consumerSecret: consumerSecret,
      version: this.config.version,
      timeout: this.config.timeout
    });
  }

  // Test connection to WooCommerce store
  async testConnection(storeUrl, consumerKey, consumerSecret) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      const response = await client.get("system_status");
      
      if (response.status === 200) {
        return {
          success: true,
          store_info: {
            name: response.data.name,
            version: response.data.version,
            url: storeUrl,
            status: "connected"
          }
        };
      } else {
        throw new Error("Failed to connect to WooCommerce store");
      }
    } catch (error) {
      console.error("WooCommerce connection test error:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get products from WooCommerce store
  async getProducts(storeUrl, consumerKey, consumerSecret, options = {}) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      const defaultOptions = {
        per_page: 100,
        status: "publish",
        ...options
      };

      const response = await client.get("products", defaultOptions);
      
      if (response.status === 200) {
        const products = response.data.map(product => this.formatProduct(product));
        
        return {
          success: true,
          products: products,
          total_products: response.headers['x-wp-total'],
          total_pages: response.headers['x-wp-totalpages'],
          current_page: response.headers['x-wp-page'] || 1
        };
      } else {
        throw new Error("Failed to fetch products from WooCommerce");
      }
    } catch (error) {
      console.error("Error fetching products:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Create product in WooCommerce store
  async createProduct(storeUrl, consumerKey, consumerSecret, productData) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      // Prepare product data for WooCommerce
      const wooProductData = this.prepareProductData(productData);
      
      const response = await client.post("products", wooProductData);
      
      if (response.status === 201) {
        return {
          success: true,
          product: this.formatProduct(response.data),
          message: "Product created successfully"
        };
      } else {
        throw new Error("Failed to create product in WooCommerce");
      }
    } catch (error) {
      console.error("Error creating product:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Update product in WooCommerce store
  async updateProduct(storeUrl, consumerKey, consumerSecret, productId, productData) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      const response = await client.put(`products/${productId}`, productData);
      
      if (response.status === 200) {
        return {
          success: true,
          product: this.formatProduct(response.data),
          message: "Product updated successfully"
        };
      } else {
        throw new Error("Failed to update product in WooCommerce");
      }
    } catch (error) {
      console.error("Error updating product:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Delete product from WooCommerce store
  async deleteProduct(storeUrl, consumerKey, consumerSecret, productId, force = true) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      const response = await client.delete(`products/${productId}`, { force });
      
      if (response.status === 200) {
        return {
          success: true,
          message: "Product deleted successfully"
        };
      } else {
        throw new Error("Failed to delete product from WooCommerce");
      }
    } catch (error) {
      console.error("Error deleting product:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get product categories
  async getCategories(storeUrl, consumerKey, consumerSecret, options = {}) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      const defaultOptions = {
        per_page: 100,
        ...options
      };

      const response = await client.get("products/categories", defaultOptions);
      
      if (response.status === 200) {
        return {
          success: true,
          categories: response.data,
          total_categories: response.headers['x-wp-total'],
          total_pages: response.headers['x-wp-totalpages']
        };
      } else {
        throw new Error("Failed to fetch categories from WooCommerce");
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get orders from WooCommerce store
  async getOrders(storeUrl, consumerKey, consumerSecret, options = {}) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      const defaultOptions = {
        per_page: 100,
        status: "processing",
        ...options
      };

      const response = await client.get("orders", defaultOptions);
      
      if (response.status === 200) {
        return {
          success: true,
          orders: response.data,
          total_orders: response.headers['x-wp-total'],
          total_pages: response.headers['x-wp-totalpages']
        };
      } else {
        throw new Error("Failed to fetch orders from WooCommerce");
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Format product data for consistent response
  formatProduct(product) {
    return {
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
      date_modified: product.date_modified,
      weight: product.weight,
      dimensions: product.dimensions,
      attributes: product.attributes,
      variations: product.variations,
      manage_stock: product.manage_stock
    };
  }

  // Prepare product data for WooCommerce API
  prepareProductData(productData) {
    return {
      name: productData.name,
      description: productData.description || "",
      short_description: productData.short_description || "",
      regular_price: productData.price ? productData.price.toString() : "",
      sale_price: productData.sale_price || "",
      categories: productData.categories || [],
      images: productData.images || [],
      stock_status: productData.stock_status || "instock",
      stock_quantity: productData.stock_quantity || 0,
      sku: productData.sku || "",
      manage_stock: productData.manage_stock || false,
      weight: productData.weight || "",
      dimensions: productData.dimensions || {},
      attributes: productData.attributes || [],
      status: productData.status || "publish",
      virtual: productData.virtual || false,
      downloadable: productData.downloadable || false,
      tax_status: productData.tax_status || "taxable",
      tax_class: productData.tax_class || ""
    };
  }

  // Bulk operations
  async bulkCreateProducts(storeUrl, consumerKey, consumerSecret, products) {
    try {
      const results = [];
      
      for (const product of products) {
        const result = await this.createProduct(storeUrl, consumerKey, consumerSecret, product);
        results.push({
          product_name: product.name,
          success: result.success,
          product_id: result.success ? result.product.id : null,
          error: result.error || null
        });
      }
      
      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;
      
      return {
        success: true,
        message: `Bulk operation completed. ${successful} successful, ${failed} failed.`,
        results: results,
        summary: {
          total: products.length,
          successful: successful,
          failed: failed
        }
      };
    } catch (error) {
      console.error("Error in bulk create products:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Get store statistics
  async getStoreStats(storeUrl, consumerKey, consumerSecret) {
    try {
      const client = this.createClient(storeUrl, consumerKey, consumerSecret);
      
      // Get various store statistics
      const [products, orders, categories] = await Promise.all([
        client.get("products", { per_page: 1 }),
        client.get("orders", { per_page: 1 }),
        client.get("products/categories", { per_page: 1 })
      ]);
      
      return {
        success: true,
        stats: {
          total_products: products.headers['x-wp-total'] || 0,
          total_orders: orders.headers['x-wp-total'] || 0,
          total_categories: categories.headers['x-wp-total'] || 0
        }
      };
    } catch (error) {
      console.error("Error getting store stats:", error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new WooCommerceService();
