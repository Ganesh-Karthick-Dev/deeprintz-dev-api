const { shopifyApi } = require('@shopify/shopify-api');
const { ApiVersion } = require('@shopify/shopify-api');
// Import Node.js adapter to set up runtime
require('@shopify/shopify-api/adapters/node');
const crypto = require('crypto');
const axios = require('axios');
const SHOPIFY_CONFIG = require('../../config/shopify');

// Initialize Shopify API with proper configuration
class ModernShopifyService {
  constructor() {
    this.shopify = shopifyApi({
      apiVersion: ApiVersion.October25,
      isEmbeddedApp: false,
      useOnlineTokens: false, // Use offline tokens for long-term integration
      scopes: SHOPIFY_CONFIG.SCOPES,
      hostName: process.env.SHOPIFY_APP_URL?.replace(/https?:\/\//, '') || 'api.deeprintz.com',
      apiKey: SHOPIFY_CONFIG.CLIENT_ID,
      apiSecretKey: SHOPIFY_CONFIG.SECRET,
      isPrivateApp: false,
      logger: {
        level: 'info',
        log: (severity, message) => {
          console.log(`[${String(severity).toUpperCase()}] ${message}`);
        }
      }
    });
  }

  // OAuth Authentication
  async beginAuth(req, res, shop, redirectPath = null, userId = null) {
    try {
      const state = this.generateNonce();
      const redirectUri = redirectPath || SHOPIFY_CONFIG.OAUTH_CALLBACK_URL;
      const scopes = SHOPIFY_CONFIG.SCOPES.join(',');

      // Include userId in state for callback
      const stateWithUserId = userId ? `${state}:${userId}` : state;

      const params = new URLSearchParams({
        client_id: this.shopify.config.apiKey,
        scope: scopes,
        redirect_uri: redirectUri,
        state: stateWithUserId
      });

      const authUrl = `https://${shop}/admin/oauth/authorize?${params.toString()}`;

      return {
        success: true,
        authUrl: authUrl,
        state: stateWithUserId,
        message: 'OAuth URL generated successfully'
      };
    } catch (error) {
      console.error('Error generating OAuth URL:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateAuthCallback(req, res) {
    try {
      const { shop, code, state } = req.query;

      if (!shop || !code) {
        return {
          success: false,
          error: 'Missing required parameters: shop and code'
        };
      }

      // Validate shop domain
      if (!shop.includes('.myshopify.com')) {
        return {
          success: false,
          error: 'Invalid shop domain'
        };
      }

      // Manually exchange code for access token
      const tokenUrl = `https://${shop}/admin/oauth/access_token`;
      const tokenResponse = await axios.post(tokenUrl, {
        client_id: SHOPIFY_CONFIG.CLIENT_ID,
        client_secret: SHOPIFY_CONFIG.SECRET,
        code
      }, { headers: { 'Content-Type': 'application/json' } });

      const accessToken = tokenResponse?.data?.access_token;
      const scope = tokenResponse?.data?.scope || SHOPIFY_CONFIG.SCOPES.join(',');

      if (accessToken) {
        return {
          success: true,
          session: {
            shop,
            accessToken,
            scope,
            expires: null,
            isOnline: false
          },
          message: 'OAuth completed successfully'
        };
      }

      return {
        success: false,
        error: 'Failed to obtain access token'
      };
    } catch (error) {
      console.error('Error validating OAuth callback:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // GraphQL Client Operations
  createGraphQLClient(shop, accessToken) {
    return new this.shopify.clients.Graphql({
      session: {
        shop: shop,
        accessToken: accessToken
      },
      apiVersion: '2025-01'
    });
  }

  createRestClient(shop, accessToken) {
    return this.shopify.clients.rest({
      session: {
        shop: shop,
        accessToken: accessToken
      }
    });
  }

  // Products Operations using GraphQL
  async getProducts(shop, accessToken, options = {}) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);
      const { limit = 10, cursor = null } = options;

      const query = `
        query getProducts($first: Int!, $after: String) {
          products(first: $first, after: $after) {
            edges {
              node {
                id
                title
                description
                handle
                status
                productType
                vendor
                tags
                createdAt
                updatedAt
                images(first: 5) {
                  edges {
                    node {
                      id
                      url
                      altText
                    }
                  }
                }
                variants(first: 10) {
                  edges {
                    node {
                      id
                      title
                      price
                      sku
                      inventoryQuantity
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `;

      const variables = { first: limit };
      if (cursor) variables.after = cursor;

      const response = await client.request(query, { variables });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const products = response.data.products.edges.map(edge => this.formatProduct(edge.node));
      
      return {
        success: true,
        products: products,
        pageInfo: response.data.products.pageInfo,
        total_products: products.length
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async createProduct(shop, accessToken, productData) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);

      console.log('🚀 Starting product creation with data:', JSON.stringify(productData, null, 2));

      // Step 1: Create basic product first (only supported fields in ProductInput for 2025-01)
      const createMutation = `
        mutation productCreate($input: ProductInput!) {
          productCreate(input: $input) {
            product {
              id
              title
              handle
              status
              productType
              vendor
              tags
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      // Basic product input (only fields supported in ProductInput for 2025-01)
      const input = {
        title: productData.title,
        productType: productData.productType || 'Print-on-Demand',
        vendor: productData.vendor || 'Deeprintz',
        tags: productData.tags || ['print-on-demand', 'custom-design'],
        status: productData.status || 'ACTIVE',
        descriptionHtml: productData.description || ''
      };

      console.log('Creating product with input:', JSON.stringify(input, null, 2));

      const response = await client.request(createMutation, { variables: { input } });
      
      console.log('🔍 Product creation response:', JSON.stringify(response, null, 2));
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const result = response.data.productCreate;
      
      if (result.userErrors.length > 0) {
        throw new Error(`Product creation errors: ${JSON.stringify(result.userErrors)}`);
      }

      const productId = result.product.id;
      console.log('✅ Product created with ID:', productId);

      // Step 1.5: Publish product to make it visible to customers
      try {
        const publishMutation = `
          mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) {
              publishable {
                ... on Product {
                  id
                  title
                  publishedAt
                }
              }
              userErrors {
                field
                message
              }
            }
          }
        `;

        const publishInput = [{
          publicationId: "gid://shopify/Publication/1" // Online Store publication
        }];

        console.log('📢 Publishing product to Online Store...');
        const publishResponse = await client.request(publishMutation, { 
          variables: { 
            id: productId, 
            input: publishInput 
          } 
        });
        
        console.log('📢 Publish response:', JSON.stringify(publishResponse, null, 2));
        
        if (publishResponse.data.publishablePublish.userErrors.length > 0) {
          console.warn('⚠️ Publish warnings:', JSON.stringify(publishResponse.data.publishablePublish.userErrors));
        } else {
          console.log('✅ Product published successfully to Online Store');
        }
      } catch (publishError) {
        console.warn('⚠️ Could not publish product (this might be normal):', publishError.message);
      }

      // Step 2: Description is now included in the initial product creation

      // Step 2: Add options using REST API
      if (productData.options && productData.options.length > 0) {
        try {
          console.log('📋 Setting up size options using REST API:', JSON.stringify(productData.options, null, 2));
          
          // Update product options using REST API
          const productIdNum = productId.split('/').pop();
          const updateUrl = `https://${shop}/admin/api/2025-01/products/${productIdNum}.json`;
          
          const optionData = {
            product: {
              id: productIdNum,
              options: productData.options.map(option => ({
                name: option.name || 'Size',
                values: option.values
              }))
            }
          };

          console.log('📋 Updating product options with:', JSON.stringify(optionData, null, 2));

          const optionResponse = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Shopify-Access-Token': accessToken
            },
            body: JSON.stringify(optionData)
          });

          const optionResult = await optionResponse.json();
          console.log('✅ Product options response:', JSON.stringify(optionResult, null, 2));
          
          if (optionResult.product) {
            console.log('✅ Product options updated successfully');
          } else {
            console.warn('Options update failed:', optionResult);
          }
        } catch (optionError) {
          console.error('❌ Error adding options:', optionError.message);
          console.error('Options error details:', optionError);
        }
      }

      // Step 3: Create multiple variants for different sizes using REST API
      if (productData.variants && productData.variants.length > 0) {
        try {
          console.log('📦 Creating multiple variants for different sizes:', JSON.stringify(productData.variants, null, 2));
          
          // First, delete the default variant
          const getProductQuery = `
            query getProduct($id: ID!) {
              product(id: $id) {
                variants(first: 10) {
                  edges {
                    node {
                      id
                    }
                  }
                }
              }
            }
          `;

          const productResponse = await client.request(getProductQuery, {
            variables: { id: productId }
          });

          // Update the first variant and create additional variants
          if (productResponse.data?.product?.variants?.edges?.length > 0) {
            // Update the first (default) variant
            const firstVariantId = productResponse.data.product.variants.edges[0].node.id.split('/').pop();
            const firstVariant = productData.variants[0];
            const firstSizeName = productData.options && productData.options.length > 0 ? 
              productData.options[0].values[0] : 
              'Small';
            
            console.log(`📦 Updating first variant for size: ${firstSizeName}`);
            
            const updateUrl = `https://${shop}/admin/api/2025-01/variants/${firstVariantId}.json`;
            const updateData = {
              variant: {
                id: firstVariantId,
                price: firstVariant.price || '500.00',
                sku: firstVariant.sku || '',
                inventory_quantity: 999999,
                inventory_management: "shopify",
                inventory_policy: "continue",
                option1: firstSizeName
              }
            };

            console.log(`📦 Updating first variant with data:`, JSON.stringify(updateData, null, 2));

            const updateResponse = await fetch(updateUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': accessToken
              },
              body: JSON.stringify(updateData)
            });

            const updateResult = await updateResponse.json();
            console.log(`✅ First variant update response:`, JSON.stringify(updateResult, null, 2));
            
            if (updateResult.variant) {
              console.log(`✅ First variant (${firstSizeName}) updated successfully with price: ${firstVariant.price}`);
              
              // Get location IDs and set inventory for both Canada and India locations
              try {
                const locationsUrl = `https://${shop}/admin/api/2025-01/locations.json`;
                const locationsResponse = await fetch(locationsUrl, {
                  headers: {
                    'X-Shopify-Access-Token': accessToken
                  }
                });
                const locationsResult = await locationsResponse.json();
                console.log('📍 Available locations:', JSON.stringify(locationsResult, null, 2));
                
                if (locationsResult.locations && locationsResult.locations.length > 0) {
                  // Filter locations for Canada and India (support multiple possible fields from API)
                  const canadaLocations = locationsResult.locations.filter(loc => 
                    loc.country === 'Canada' || loc.country_code === 'CA' || loc.country_name === 'Canada'
                  );
                  const indiaLocations = locationsResult.locations.filter(loc => 
                    loc.country === 'India' || loc.country_code === 'IN' || loc.country_name === 'India'
                  );
                  
                  // Use all available locations if no specific country locations found
                  const targetLocations = canadaLocations.length > 0 || indiaLocations.length > 0 
                    ? [...canadaLocations, ...indiaLocations]
                    : locationsResult.locations;
                  
                  console.log(`📍 Target locations for inventory (Canada: ${canadaLocations.length}, India: ${indiaLocations.length}):`, 
                    targetLocations.map(loc => `${loc.name} (${loc.country_code})`));
                  
                  // Connect and set inventory for each target location
                  for (const location of targetLocations) {
                    // Ensure the inventory item is connected to the location before setting available
                    try {
                      const connectUrl = `https://${shop}/admin/api/2025-01/inventory_levels/connect.json`;
                      const connectData = {
                        location_id: location.id,
                        inventory_item_id: updateResult.variant.inventory_item_id
                      };

                      console.log(`🔗 Connecting inventory item to location ${location.name} (${location.country || location.country_code})`);
                      const connectResponse = await fetch(connectUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-Shopify-Access-Token': accessToken
                        },
                        body: JSON.stringify(connectData)
                      });
                      const connectResult = await connectResponse.json();
                      if (connectResponse.status >= 400) {
                        console.warn(`⚠️ Connect failed for location ${location.id}:`, JSON.stringify(connectResult));
                      }
                    } catch (connectError) {
                      console.warn(`⚠️ Error connecting inventory to location ${location.id}:`, connectError.message);
                    }
                    const inventoryUrl = `https://${shop}/admin/api/2025-01/inventory_levels/set.json`;
                    const inventoryData = {
                      location_id: location.id,
                      inventory_item_id: updateResult.variant.inventory_item_id,
                      available: 999999
                    };
                    
                    console.log(`📦 Setting inventory at ${location.name} (${location.country || location.country_code}):`, JSON.stringify(inventoryData, null, 2));
                    
                    const inventoryResponse = await fetch(inventoryUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Shopify-Access-Token': accessToken
                      },
                      body: JSON.stringify(inventoryData)
                    });
                    
                    const inventoryResult = await inventoryResponse.json();
                    console.log(`✅ Inventory set response at ${location.name}:`, JSON.stringify(inventoryResult, null, 2));
                  }
                } else {
                  console.warn('⚠️ No locations found');
                }
              } catch (inventoryError) {
                console.error('❌ Error setting inventory:', inventoryError.message);
              }
            } else {
              console.warn(`First variant update failed:`, updateResult);
            }

            // Now create additional variants for remaining sizes
            for (let i = 1; i < productData.variants.length; i++) {
              const variant = productData.variants[i];
              const sizeName = productData.options && productData.options.length > 0 ? 
                productData.options[0].values[i] : 
                `Size ${i + 1}`;
              
              console.log(`📦 Creating variant ${i + 1} for size: ${sizeName}`);
              
              // Create variant using REST API
              const createUrl = `https://${shop}/admin/api/2025-01/products/${productId.split('/').pop()}/variants.json`;
              const variantData = {
                variant: {
                  price: variant.price || '500.00',
                  sku: variant.sku || '',
                  inventory_quantity: 999999,
                  inventory_management: "shopify",
                  inventory_policy: "continue",
                  option1: sizeName
                }
              };

              console.log(`📦 Creating variant ${i + 1} with data:`, JSON.stringify(variantData, null, 2));

              const createResponse = await fetch(createUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-Shopify-Access-Token': accessToken
                },
                body: JSON.stringify(variantData)
              });

              const createResult = await createResponse.json();
              console.log(`✅ Variant ${i + 1} creation response:`, JSON.stringify(createResult, null, 2));
              
              if (createResult.variant) {
                console.log(`✅ Variant ${i + 1} (${sizeName}) created successfully with price: ${variant.price}`);
                
                // Get location IDs and set inventory for both Canada and India locations
                try {
                  const locationsUrl = `https://${shop}/admin/api/2025-01/locations.json`;
                  const locationsResponse = await fetch(locationsUrl, {
                    headers: {
                      'X-Shopify-Access-Token': accessToken
                    }
                  });
                  const locationsResult = await locationsResponse.json();
                  
                  if (locationsResult.locations && locationsResult.locations.length > 0) {
                    console.log(`📍 Available locations:`, JSON.stringify(locationsResult.locations, null, 2));
                    
                    // Filter locations for Canada and India (support multiple possible fields from API)
                    const canadaLocations = locationsResult.locations.filter(loc => 
                      loc.country === 'Canada' || loc.country_code === 'CA' || loc.country_name === 'Canada'
                    );
                    const indiaLocations = locationsResult.locations.filter(loc => 
                      loc.country === 'India' || loc.country_code === 'IN' || loc.country_name === 'India'
                    );
                    
                    // Use all available locations if no specific country locations found
                    const targetLocations = canadaLocations.length > 0 || indiaLocations.length > 0 
                      ? [...canadaLocations, ...indiaLocations]
                      : locationsResult.locations;
                    
                    console.log(`📍 Target locations for inventory (Canada: ${canadaLocations.length}, India: ${indiaLocations.length}):`, 
                      targetLocations.map(loc => `${loc.name} (${loc.country_code})`));
                    
                    // Connect and set inventory for each target location
                    for (const location of targetLocations) {
                      // Ensure the inventory item is connected to the location before setting available
                      try {
                        const connectUrl = `https://${shop}/admin/api/2025-01/inventory_levels/connect.json`;
                        const connectData = {
                          location_id: location.id,
                          inventory_item_id: createResult.variant.inventory_item_id
                        };

                        console.log(`🔗 Connecting inventory item to location ${location.name} (${location.country || location.country_code})`);
                        const connectResponse = await fetch(connectUrl, {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                            'X-Shopify-Access-Token': accessToken
                          },
                          body: JSON.stringify(connectData)
                        });
                        const connectResult = await connectResponse.json();
                        if (connectResponse.status >= 400) {
                          console.warn(`⚠️ Connect failed for location ${location.id}:`, JSON.stringify(connectResult));
                        }
                      } catch (connectError) {
                        console.warn(`⚠️ Error connecting inventory to location ${location.id}:`, connectError.message);
                      }
                      const inventoryUrl = `https://${shop}/admin/api/2025-01/inventory_levels/set.json`;
                      const inventoryData = {
                        location_id: location.id,
                        inventory_item_id: createResult.variant.inventory_item_id,
                        available: 999999
                      };
                      
                      console.log(`📦 Setting inventory for variant ${i + 1} at ${location.name} (${location.country || location.country_code}):`, JSON.stringify(inventoryData, null, 2));
                      
                      const inventoryResponse = await fetch(inventoryUrl, {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                          'X-Shopify-Access-Token': accessToken
                        },
                        body: JSON.stringify(inventoryData)
                      });
                      
                      const inventoryResult = await inventoryResponse.json();
                      console.log(`✅ Inventory set response for variant ${i + 1} at ${location.name}:`, JSON.stringify(inventoryResult, null, 2));
                    }
                  } else {
                    console.warn(`⚠️ No locations found for variant ${i + 1}`);
                  }
                } catch (inventoryError) {
                  console.error(`❌ Error setting inventory for variant ${i + 1}:`, inventoryError.message);
                }
              } else {
                console.warn(`Variant ${i + 1} creation failed:`, createResult);
              }
            }
          }
        } catch (variantError) {
          console.error('❌ Error creating variants:', variantError.message);
          console.error('Variant error details:', variantError);
        }
      }

      // Step 4: Add images if provided (using productCreateMedia)
      if (productData.images && productData.images.length > 0) {
        for (const image of productData.images) {
          try {
            console.log('🖼️ Attempting to add image:', image.src);
            
            const imageMutation = `
              mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
                productCreateMedia(productId: $productId, media: $media) {
                  media {
                    id
                    ... on MediaImage {
                      image {
                        url
                        altText
                      }
                    }
                  }
                  mediaUserErrors {
                    field
                    message
                  }
                }
              }
            `;

            const imageResponse = await client.request(imageMutation, {
              variables: {
                productId: productId,
                media: [{
                  originalSource: image.src,
                  alt: image.altText || productData.title,
                  mediaContentType: 'IMAGE'
                }]
              }
            });
            
            console.log('✅ Product image response:', JSON.stringify(imageResponse, null, 2));
            
            if (imageResponse.data.productCreateMedia.mediaUserErrors.length > 0) {
              console.warn('Image user errors:', imageResponse.data.productCreateMedia.mediaUserErrors);
            } else {
              console.log('✅ Product image added successfully:', image.src);
            }
          } catch (imageError) {
            console.error('❌ Error adding image:', imageError.message);
            console.error('Image error details:', imageError);
          }
        }
      }

      // Step 5: Add metafields if provided
      if (productData.metafields && productData.metafields.length > 0) {
        for (const metafield of productData.metafields) {
          try {
            console.log('🏷️ Attempting to add metafield:', JSON.stringify(metafield, null, 2));
            
            const metafieldMutation = `
              mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
                metafieldsSet(metafields: $metafields) {
                  metafields {
                    id
                    namespace
                    key
                    value
                    type
                }
                userErrors {
                  field
                  message
                }
              }
            }
          `;

            const metafieldResponse = await client.request(metafieldMutation, {
            variables: {
                metafields: [{
                  ownerId: productId,
                  namespace: metafield.namespace,
                  key: metafield.key,
                  value: metafield.value,
                  type: metafield.type
                }]
              }
            });
            
            console.log('✅ Product metafield response:', JSON.stringify(metafieldResponse, null, 2));
            
            if (metafieldResponse.data.metafieldsSet.userErrors.length > 0) {
              console.warn('Metafield user errors:', metafieldResponse.data.metafieldsSet.userErrors);
          } else {
              console.log('✅ Product metafield added successfully:', metafield.key);
            }
          } catch (metafieldError) {
            console.error('❌ Error adding metafield:', metafieldError.message);
            console.error('Metafield error details:', metafieldError);
          }
        }
      }

      // Step 6: Get final product with all details
      const getProductMutation = `
        query getProduct($id: ID!) {
          product(id: $id) {
            id
            title
            handle
            status
            productType
            vendor
            tags
            description
            images(first: 10) {
              edges {
                node {
                  id
                  url
                  altText
                }
              }
            }
            variants(first: 10) {
              edges {
                node {
                  id
                  price
                  sku
                  inventoryQuantity
                }
              }
            }
            options {
              id
              name
              values
            }
            metafields(first: 20) {
              edges {
                node {
                  id
                  namespace
                  key
                  value
                  type
                }
              }
            }
          }
        }
      `;

      const finalResponse = await client.request(getProductMutation, {
        variables: { id: productId }
      });

      return {
        success: true,
        product: this.formatProductWithDetails(finalResponse.data.product),
        message: 'Product created successfully'
      };
    } catch (error) {
      console.error('Error creating product:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateProduct(shop, accessToken, productId, productData) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);

      const mutation = `
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
              description
              status
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const input = {
        id: productId,
        title: productData.title,
        description: productData.description,
        status: productData.status
      };

      const response = await client.request(mutation, { variables: { input } });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const result = response.data.productUpdate;
      
      if (result.userErrors.length > 0) {
        throw new Error(`Product update errors: ${JSON.stringify(result.userErrors)}`);
      }

      return {
        success: true,
        product: this.formatProduct(result.product),
        message: 'Product updated successfully'
      };
    } catch (error) {
      console.error('Error updating product:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteProduct(shop, accessToken, productId) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);

      const mutation = `
        mutation productDelete($input: ProductDeleteInput!) {
          productDelete(input: $input) {
            deletedProductId
            userErrors {
              field
              message
            }
          }
        }
      `;

      const response = await client.request(mutation, { 
        variables: { 
          input: { id: productId } 
        } 
      });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const result = response.data.productDelete;
      
      if (result.userErrors.length > 0) {
        throw new Error(`Product deletion errors: ${JSON.stringify(result.userErrors)}`);
      }

      return {
        success: true,
        deletedProductId: result.deletedProductId,
        message: 'Product deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting product:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Orders Operations using GraphQL
  async getOrders(shop, accessToken, options = {}) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);
      const { limit = 10, cursor = null } = options;

      const query = `
        query getOrders($first: Int!, $after: String) {
          orders(first: $first, after: $after) {
            edges {
              node {
                id
                name
                email
                phone
                createdAt
                updatedAt
                totalPrice
                subtotalPrice
                totalTax
                currencyCode
                fulfillmentStatus
                financialStatus
                customer {
                  id
                  firstName
                  lastName
                  email
                }
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      price
                      variant {
                        id
                        title
                        sku
                      }
                    }
                  }
                }
                shippingAddress {
                  firstName
                  lastName
                  address1
                  city
                  province
                  country
                  zip
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      `;

      const variables = { first: limit };
      if (cursor) variables.after = cursor;

      const response = await client.request(query, { variables });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      const orders = response.data.orders.edges.map(edge => this.formatOrder(edge.node));
      
      return {
        success: true,
        orders: orders,
        pageInfo: response.data.orders.pageInfo,
        total_orders: orders.length
      };
    } catch (error) {
      console.error('Error fetching orders:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getOrderById(shop, accessToken, orderId) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);

      const query = `
        query getOrder($id: ID!) {
          order(id: $id) {
            id
            name
            email
            phone
            createdAt
            updatedAt
            totalPrice
            subtotalPrice
            totalTax
            currencyCode
            fulfillmentStatus
            financialStatus
            customer {
              id
              firstName
              lastName
              email
            }
            lineItems(first: 50) {
              edges {
                node {
                  id
                  title
                  quantity
                  price
                  variant {
                    id
                    title
                    sku
                  }
                }
              }
            }
            shippingAddress {
              firstName
              lastName
              address1
              city
              province
              country
              zip
            }
          }
        }
      `;

      const response = await client.request(query, { 
        variables: { id: `gid://shopify/Order/${orderId}` } 
      });
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      return {
        success: true,
        order: this.formatOrder(response.data.order)
      };
    } catch (error) {
      console.error('Error fetching order:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Store Information
  async getShopInfo(shop, accessToken) {
    try {
      const client = this.createGraphQLClient(shop, accessToken);

      const query = `
        query getShop {
          shop {
            id
            name
            email
            myshopifyDomain
            primaryDomain { url host }
            currencyCode
            ianaTimezone
            plan {
              displayName
            }
            billingAddress {
              address1
              city
              province
              country
              zip
            }
          }
        }
      `;

      const response = await client.request(query);
      
      if (response.errors) {
        throw new Error(`GraphQL errors: ${JSON.stringify(response.errors)}`);
      }

      return {
        success: true,
        shop_info: response.data.shop
      };
    } catch (error) {
      console.error('Error fetching shop info:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Test Connection
  async testConnection(shop, accessToken) {
    try {
      const result = await this.getShopInfo(shop, accessToken);
      
      if (result.success) {
        return {
          success: true,
          shop_info: result.shop_info,
          status: 'connected'
        };
      } else {
        return {
          success: false,
          error: result.error
        };
      }
    } catch (error) {
      console.error('Connection test error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Webhook Validation
  validateWebhookSignature(rawBody, signature, secret) {
    try {
      const crypto = require('crypto');
      const hash = crypto
        .createHmac('sha256', secret)
        .update(rawBody, 'utf8')
        .digest('base64');

      return crypto.timingSafeEqual(
        Buffer.from(hash, 'base64'),
        Buffer.from(signature, 'base64')
      );
    } catch (error) {
      console.error('Error validating webhook signature:', error);
      return false;
    }
  }

  // Helper Methods
  generateNonce() {
    return crypto.randomBytes(16).toString('hex');
  }

  formatProduct(product) {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      status: product.status,
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      images: product.images?.edges?.map(edge => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText
      })) || [],
      variants: product.variants?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        sku: edge.node.sku,
        inventoryQuantity: edge.node.inventoryQuantity
      })) || []
    };
  }

  formatProductWithDetails(product) {
    return {
      id: product.id,
      title: product.title,
      description: product.description,
      handle: product.handle,
      status: product.status,
      productType: product.productType,
      vendor: product.vendor,
      tags: product.tags,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      images: product.images?.edges?.map(edge => ({
        id: edge.node.id,
        url: edge.node.url,
        altText: edge.node.altText
      })) || [],
      variants: product.variants?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        price: edge.node.price,
        sku: edge.node.sku,
        inventoryQuantity: edge.node.inventoryQuantity
      })) || [],
      options: product.options?.map(option => ({
        id: option.id,
        name: option.name,
        values: option.values
      })) || [],
      metafields: product.metafields?.edges?.map(edge => ({
        id: edge.node.id,
        namespace: edge.node.namespace,
        key: edge.node.key,
        value: edge.node.value,
        type: edge.node.type
      })) || []
    };
  }

  formatOrder(order) {
    return {
      id: order.id,
      name: order.name,
      email: order.email,
      phone: order.phone,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      totalPrice: order.totalPrice,
      subtotalPrice: order.subtotalPrice,
      totalTax: order.totalTax,
      currencyCode: order.currencyCode,
      fulfillmentStatus: order.fulfillmentStatus,
      financialStatus: order.financialStatus,
      customer: order.customer ? {
        id: order.customer.id,
        firstName: order.customer.firstName,
        lastName: order.customer.lastName,
        email: order.customer.email
      } : null,
      lineItems: order.lineItems?.edges?.map(edge => ({
        id: edge.node.id,
        title: edge.node.title,
        quantity: edge.node.quantity,
        price: edge.node.price,
        variant: edge.node.variant ? {
          id: edge.node.variant.id,
          title: edge.node.variant.title,
          sku: edge.node.variant.sku
        } : null
      })) || [],
      shippingAddress: order.shippingAddress
    };
  }
}

module.exports.getShopifyProductById = async (productId) => {
  try {
    let shopifyProducts = await global.dbConnection('shopify_products')
      .select(
        'shopify_products.id as shopifyProductId',
        'shopify_products.productid as deeprintzProductId',
        'shopify_products.productcost as shopifyProductCost',
        'shopify_products.productname',
        'shopify_products.productdesc',
        'shopify_products.variants',
        'shopify_products.position',
        'shopify_products.width',
        'shopify_products.height',
        'shopify_products.designurl'
      )
      .where('shopify_products.id', productId)
      .first(); // since productId is unique

    if (!shopifyProducts) return false;

    // Parse variants if stored as JSON string
    if (shopifyProducts.variants) {
      try {
        shopifyProducts.variants = JSON.parse(shopifyProducts.variants);
      } catch (e) {
        console.error("Error parsing variants JSON:", e);
        shopifyProducts.variants = [];
      }
    }

    return shopifyProducts;

  } catch (error) {
    console.log(`error in getShopifyProducts service - `, error);
    return false;
  }
};

module.exports = new ModernShopifyService();
