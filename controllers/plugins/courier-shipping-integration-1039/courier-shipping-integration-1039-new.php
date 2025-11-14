<?php
/**
 * Plugin Name: Courier Shipping Integration
 * Description: Automatic shipping calculation with courier partners for vendor 1039
 * Version: 1.0.0
 * Author: Your Company
 */

// Prevent direct access
if (!defined('ABSPATH')) {
    exit;
}

class CourierShippingIntegration {
    private $apiBaseUrl = 'https://devdevapi.deeprintz.com/api/woocommerce';
    private $userId = '1039';
    private $storeId = '23';
    
    public function __construct() {
        add_action('wp_enqueue_scripts', array($this, 'enqueue_scripts'));
        add_action('wp_footer', array($this, 'add_inline_script'));
    }
    
    public function enqueue_scripts() {
        if (is_checkout()) {
            wp_enqueue_script('jquery');
        }
    }
    
    public function add_inline_script() {
        if (is_checkout()) {
            ?>
            <script>
            jQuery(document).ready(function($) {
                console.log('🚀 Courier Shipping Plugin Loading...');
                
                // Wait for WooCommerce to be ready
                $(document.body).on('updated_checkout', function() {
                    console.log('🔄 WooCommerce checkout updated');
                    initShippingIntegration();
                });
                
                // Also initialize immediately
                setTimeout(initShippingIntegration, 1000);
                
                function initShippingIntegration() {
                    console.log('🚀 Initializing Courier Shipping Integration...');
                    
                    // Test API connection
                    testApiConnection();
                    
                    // Remove default shipping methods
                    removeDefaultShipping();
                    
                    // Setup pincode watcher
                    setupPincodeWatcher();
                    
                    // Force remove any existing shipping methods periodically
                    setInterval(() => {
                        if ($('.woocommerce-shipping-methods li:not(.custom-shipping-method)').length > 0) {
                            console.log('🔄 Removing lingering default shipping methods...');
                            $('.woocommerce-shipping-methods li:not(.custom-shipping-method)').remove();
                        }
                    }, 2000);
                    
                    console.log('✅ Courier Shipping Integration initialized');
                }
                
                async function testApiConnection() {
                    console.log('🔍 Testing API connection...');
                    try {
                        const response = await fetch('https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/shipping/calculate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                postCode: '110001',
                                weight: 500,
                                orderAmount: 1000,
                                paymentMode: 'prepaid',
                                items: [{ name: 'Test Item', weight: 500 }],
                                userId: '1039',
                                storeId: '23'
                            })
                        });
                        
                        console.log('🔍 API Test Response Status:', response.status);
                        const result = await response.json();
                        console.log('🔍 API Test Response:', result);
                        
                        if (response.ok) {
                            console.log('✅ API connection test successful');
                        } else {
                            console.log('❌ API connection test failed');
                        }
                    } catch (error) {
                        console.error('❌ API connection test error:', error);
                    }
                }
                
                function removeDefaultShipping() {
                    console.log('🗑️ Removing default shipping methods...');
                    
                    // Remove all existing shipping methods
                    $('.woocommerce-shipping-methods').html(`
                        <li class="woocommerce-shipping-method">
                            <p style="padding: 10px; background: #f0f8ff; border: 1px solid #007cba; border-radius: 4px; margin: 0;">
                                📍 Enter your pincode above to see shipping options
                            </p>
                        </li>
                    `);
                    
                    // Update shipping cost display
                    $('.woocommerce-checkout-review-order-table .shipping .amount').text('Enter pincode');
                    
                    // Also update the shipping method name
                    $('.woocommerce-checkout-review-order-table .shipping th').text('Shipping');
                    
                    // Remove any existing shipping method selections
                    $('input[name="shipping_method[0]"]').prop('checked', false);
                    
                    // Hide any default WooCommerce shipping methods
                    $('.woocommerce-shipping-methods li:not(.custom-shipping-method)').hide();
                    
                    console.log('✅ Default shipping methods removed');
                }
                
                function setupPincodeWatcher() {
                    console.log('👀 Setting up pincode watcher...');
                    
                    // Multiple selectors for pincode field
                    const pincodeSelectors = [
                        'input[name="billing_postcode"]',
                        'input[name="shipping_postcode"]',
                        '#billing_postcode',
                        '#shipping_postcode',
                        'input[placeholder*="pincode"]',
                        'input[placeholder*="Pincode"]',
                        'input[placeholder*="postcode"]',
                        'input[placeholder*="Postcode"]',
                        'input[placeholder*="zip"]',
                        'input[placeholder*="Zip"]',
                        'input[placeholder*="ZIP"]'
                    ];
                    
                    // Watch for pincode changes on all possible selectors
                    pincodeSelectors.forEach(selector => {
                        $(document.body).on('change', selector, function() {
                            const pincode = $(this).val();
                            console.log('📝 Pincode changed to:', pincode, 'from selector:', selector);
                            
                            if (pincode && pincode.length >= 6) {
                                calculateShipping(pincode);
                            } else {
                                removeDefaultShipping();
                            }
                        });
                        
                        // Also watch for input events
                        $(document.body).on('input', selector, debounce(function() {
                            const pincode = $(this).val();
                            if (pincode && pincode.length >= 6) {
                                console.log('🔄 Auto-calculating shipping for pincode:', pincode, 'from selector:', selector);
                                calculateShipping(pincode);
                            }
                        }, 1000));
                    });
                    
                    // Also check if pincode is already filled when page loads
                    setTimeout(() => {
                        pincodeSelectors.forEach(selector => {
                            const existingPincode = $(selector).val();
                            if (existingPincode && existingPincode.length >= 6) {
                                console.log('📍 Found existing pincode:', existingPincode, 'from selector:', selector);
                                calculateShipping(existingPincode);
                            }
                        });
                    }, 2000);
                    
                    console.log('✅ Pincode watcher setup complete');
                }
                
                async function calculateShipping(pincode) {
                    console.log('🚚 Calculating shipping for pincode:', pincode);
                    
                    try {
                        // Show loading
                        $('.woocommerce-shipping-methods').html(`
                            <li class="woocommerce-shipping-method">
                                <p style="padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 4px; margin: 0;">
                                    ⏳ Calculating shipping charges...
                                </p>
                            </li>
                        `);
                        
                        // Get cart data
                        const cartData = getCartData();
                        console.log('📦 Cart data:', cartData);
                        
                        // Validate cart data
                        if (!cartData.total || cartData.total <= 0) {
                            console.error('❌ Invalid cart total:', cartData.total);
                            showShippingError('Invalid cart total. Please refresh the page.');
                            return;
                        }
                        
                        // Prepare API request data
                        const requestData = {
                            postCode: pincode,
                            weight: cartData.weight,
                            orderAmount: cartData.total,
                            paymentMode: 'prepaid',
                            items: cartData.items,
                            userId: '1039',
                            storeId: '23'
                        };
                        
                        console.log('📤 Sending API request:', requestData);
                        
                        // Call API
                        const response = await fetch('https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/shipping/calculate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify(requestData)
                        });
                        
                        console.log('📡 API Response status:', response.status);
                        console.log('📡 API Response headers:', response.headers);
                        
                        if (!response.ok) {
                            throw new Error(`HTTP error! status: ${response.status}`);
                        }
                        
                        const result = await response.json();
                        console.log('📡 API Response data:', result);
                        console.log('📡 API Response structure analysis:');
                        console.log('  - result:', typeof result, result);
                        console.log('  - result.success:', result?.success);
                        console.log('  - result.data:', result?.data);
                        console.log('  - result.data.shipping_options:', result?.data?.shipping_options);
                        console.log('  - shipping_options length:', result?.data?.shipping_options?.length);
                        
                        // Check different possible response structures
                        if (result && result.success) {
                            let shippingOptions = null;
                            
                            // Try different possible structures
                            if (result.data && result.data.shipping_options) {
                                shippingOptions = result.data.shipping_options;
                                console.log('✅ Found shipping_options in result.data.shipping_options');
                            } else if (result.shipping_options) {
                                shippingOptions = result.shipping_options;
                                console.log('✅ Found shipping_options in result.shipping_options');
                            } else if (result.data && Array.isArray(result.data)) {
                                shippingOptions = result.data;
                                console.log('✅ Found shipping_options in result.data (array)');
                            } else if (Array.isArray(result)) {
                                shippingOptions = result;
                                console.log('✅ Found shipping_options in result (direct array)');
                            }
                            
                            if (shippingOptions && shippingOptions.length > 0) {
                                console.log('✅ Shipping options found:', shippingOptions.length, 'options');
                                console.log('📋 First shipping option:', shippingOptions[0]);
                                displayShippingOptions(shippingOptions);
                                updateOrderTotals(shippingOptions[0]);
                            } else {
                                console.log('⚠️ No shipping options found in response');
                                console.log('📋 Full response structure:', JSON.stringify(result, null, 2));
                                showNoShippingAvailable();
                            }
                        } else {
                            console.log('❌ API returned success: false or no success field');
                            console.log('📋 Full response:', JSON.stringify(result, null, 2));
                            showNoShippingAvailable();
                        }
                        
                    } catch (error) {
                        console.error('❌ Shipping calculation error:', error);
                        console.error('❌ Error details:', {
                            message: error.message,
                            stack: error.stack
                        });
                        showShippingError('Failed to calculate shipping. Please try again.');
                    }
                }
                
                function displayShippingOptions(shippingOptions) {
                    console.log('📋 Displaying shipping options:', shippingOptions);
                    
                    let optionsHTML = '';
                    
                    // Show only first 5 options to avoid overwhelming the user
                    const displayOptions = shippingOptions.slice(0, 5);
                    
                    displayOptions.forEach((option, index) => {
                        const totalCost = option.shipping_cost + (option.cod_charge || 0);
                        const isRecommended = index === 0;
                        const costDisplay = totalCost > 0 ? `₹${totalCost.toFixed(2)}` : 'FREE';
                        const costColor = totalCost > 0 ? '#007cba' : '#28a745';
                        
                        optionsHTML += `
                            <li class="woocommerce-shipping-method custom-shipping-method">
                                <input type="radio" name="shipping_method[0]" 
                                       id="shipping_method_0_custom_${option.courier_id}" 
                                       value="custom_${option.courier_id}" 
                                       class="shipping_method" 
                                       ${isRecommended ? 'checked' : ''}>
                                <label for="shipping_method_0_custom_${option.courier_id}" style="display: block; padding: 8px; border: 1px solid #ddd; border-radius: 4px; margin: 5px 0; cursor: pointer;">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div>
                                            <strong>${option.courier_name}</strong>
                                            ${isRecommended ? ' <span style="background: #28a745; color: white; padding: 2px 6px; border-radius: 3px; font-size: 10px;">RECOMMENDED</span>' : ''}
                                            <br>
                                            <small style="color: #666;">${option.estimated_delivery || '3-5 days'}</small>
                                        </div>
                                        <span style="font-weight: bold; color: ${costColor}; font-size: 16px;">${costDisplay}</span>
                                    </div>
                                </label>
                            </li>
                        `;
                    });
                    
                    // Add a note if there are more options
                    if (shippingOptions.length > 5) {
                        optionsHTML += `
                            <li class="woocommerce-shipping-method">
                                <p style="padding: 8px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; margin: 5px 0; text-align: center; color: #6c757d;">
                                    + ${shippingOptions.length - 5} more shipping options available
                                </p>
                            </li>
                        `;
                    }
                    
                    // Clear existing shipping methods and add new ones
                    $('.woocommerce-shipping-methods').html(optionsHTML);
                    
                    // Also update the shipping method in the order review
                    const firstOption = shippingOptions[0];
                    const firstCost = firstOption.shipping_cost + (firstOption.cod_charge || 0);
                    const firstCostDisplay = firstCost > 0 ? `₹${firstCost.toFixed(2)}` : 'FREE';
                    
                    // Force update the order review shipping section multiple times
                    const updateOrderReview = () => {
                        $('.woocommerce-checkout-review-order-table .shipping th').text(firstOption.courier_name);
                        $('.woocommerce-checkout-review-order-table .shipping .amount').text(firstCostDisplay);
                        
                        // Update the total
                        const subtotalText = $('.woocommerce-checkout-review-order-table .cart-subtotal .amount').text();
                        const subtotal = parseFloat(subtotalText.replace(/[^\d.]/g, '')) || 0;
                        const total = subtotal + firstCost;
                        $('.woocommerce-checkout-review-order-table .order-total .amount').text(`₹${total.toFixed(2)}`);
                        
                        console.log('🔄 Order review updated:', firstOption.courier_name, firstCostDisplay);
                    };
                    
                    // Update immediately
                    updateOrderReview();
                    
                    // Update again after short delays to ensure it sticks
                    setTimeout(updateOrderReview, 100);
                    setTimeout(updateOrderReview, 500);
                    setTimeout(updateOrderReview, 1000);
                    
                    // Bind change events
                    $('input[name="shipping_method[0]"]').on('change', function() {
                        const selectedOption = shippingOptions.find(opt => 
                            opt.courier_id === $(this).val().replace('custom_', '')
                        );
                        if (selectedOption) {
                            updateOrderTotals(selectedOption);
                        }
                    });
                    
                    // Force WooCommerce to recognize the change
                    $(document.body).trigger('update_checkout');
                    
                    // Additional force refresh after a short delay
                    setTimeout(() => {
                        // Ensure the shipping options are visible
                        $('.woocommerce-shipping-methods').show();
                        $('.woocommerce-shipping-methods .custom-shipping-method').show();
                        
                        // Force update the order totals again
                        const firstOption = shippingOptions[0];
                        const firstCost = firstOption.shipping_cost + (firstOption.cod_charge || 0);
                        const firstCostDisplay = firstCost > 0 ? `₹${firstCost.toFixed(2)}` : 'FREE';
                        
                        $('.woocommerce-checkout-review-order-table .shipping th').text(firstOption.courier_name);
                        $('.woocommerce-checkout-review-order-table .shipping .amount').text(firstCostDisplay);
                        
                        console.log('🔄 Forced refresh of shipping display');
                    }, 500);
                    
                    console.log('✅ Shipping options displayed and order totals updated');
                }
                
                function updateOrderTotals(option) {
                    const totalCost = option.shipping_cost + (option.cod_charge || 0);
                    console.log('💰 Updating order totals with shipping cost:', totalCost);
                    
                    // Update shipping method name and cost
                    $('.woocommerce-checkout-review-order-table .shipping th').text(`${option.courier_name}`);
                    const costDisplay = totalCost > 0 ? `₹${totalCost.toFixed(2)}` : 'FREE';
                    $('.woocommerce-checkout-review-order-table .shipping .amount').text(costDisplay);
                    
                    // Update total
                    const subtotalText = $('.woocommerce-checkout-review-order-table .cart-subtotal .amount').text();
                    const subtotal = parseFloat(subtotalText.replace(/[^\d.]/g, '')) || 0;
                    const total = subtotal + totalCost;
                    
                    $('.woocommerce-checkout-review-order-table .order-total .amount').text(`₹${total.toFixed(2)}`);
                    
                    // Trigger WooCommerce checkout update
                    $(document.body).trigger('update_checkout');
                    
                    console.log('✅ Order totals updated');
                }
                
                function showNoShippingAvailable() {
                    $('.woocommerce-shipping-methods').html(`
                        <li class="woocommerce-shipping-method">
                            <p style="padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 0; color: #721c24;">
                                ❌ No shipping options available for this pincode
                            </p>
                        </li>
                    `);
                }
                
                function showShippingError(customMessage = null) {
                    const message = customMessage || 'Error calculating shipping. Please try again.';
                    $('.woocommerce-shipping-methods').html(`
                        <li class="woocommerce-shipping-method">
                            <p style="padding: 10px; background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; margin: 0; color: #721c24;">
                                ❌ ${message}
                            </p>
                        </li>
                    `);
                }
                
                function getCartData() {
                    let weight = 500; // Default weight
                    let total = 0;
                    let items = [];
                    
                    console.log('🔍 Extracting cart data...');
                    
                    // Try multiple selectors for cart total
                    const cartTotalSelectors = [
                        '.woocommerce-checkout-review-order-table .cart-subtotal .amount',
                        '.cart-subtotal .amount',
                        '.order-total .amount',
                        '.woocommerce-Price-amount'
                    ];
                    
                    for (const selector of cartTotalSelectors) {
                        const element = $(selector).first();
                        if (element.length) {
                            const totalText = element.text();
                            const extractedTotal = parseFloat(totalText.replace(/[^\d.]/g, '')) || 0;
                            if (extractedTotal > 0) {
                                total = extractedTotal;
                                console.log('💰 Found cart total:', total, 'from selector:', selector);
                                break;
                            }
                        }
                    }
                    
                    // If still no total found, try to get from WooCommerce object
                    if (total === 0 && typeof wc_checkout_params !== 'undefined') {
                        console.log('🔍 Trying to get total from WooCommerce object...');
                        // This is a fallback - you might need to adjust based on your WooCommerce version
                    }
                    
                    // Get cart items with better selectors
                    const itemSelectors = [
                        '.woocommerce-checkout-review-order-table .cart_item',
                        '.cart_item',
                        '.woocommerce-cart-item'
                    ];
                    
                    for (const selector of itemSelectors) {
                        const itemsFound = $(selector);
                        if (itemsFound.length > 0) {
                            itemsFound.each(function() {
                                const itemName = $(this).find('.product-name, .product_title, .cart-item-name').text().trim();
                                const itemQuantity = $(this).find('.product-quantity, .quantity').text().trim();
                                const itemPrice = $(this).find('.product-total .amount, .product-price .amount').text().trim();
                                
                                if (itemName) {
                                    items.push({
                                        name: itemName,
                                        quantity: itemQuantity || '1',
                                        price: itemPrice || '0',
                                        weight: 500 // Default weight per item
                                    });
                                }
                            });
                            break;
                        }
                    }
                    
                    // If no items found, create a default item
                    if (items.length === 0 && total > 0) {
                        items.push({
                            name: 'Order Items',
                            quantity: '1',
                            price: total.toString(),
                            weight: 500
                        });
                    }
                    
                    console.log('📦 Extracted cart data:', { weight, total, items });
                    
                    return { weight, total, items };
                }
                
                function debounce(func, wait) {
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
                
                // Manual test function - call from browser console
                window.testShippingAPI = async function(pincode = '110001') {
                    console.log('🧪 Manual API test with pincode:', pincode);
                    try {
                        const response = await fetch('https://devdevapi.deeprintz.com/api/deeprintz/live/woocommerce/shipping/calculate', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Accept': 'application/json'
                            },
                            body: JSON.stringify({
                                postCode: pincode,
                                weight: 500,
                                orderAmount: 1000,
                                paymentMode: 'prepaid',
                                items: [{ name: 'Test Item', weight: 500 }],
                                userId: '1039',
                                storeId: '23'
                            })
                        });
                        
                        const result = await response.json();
                        console.log('🧪 Manual test result:', result);
                        console.log('🧪 Response structure:', JSON.stringify(result, null, 2));
                        
                        return result;
                    } catch (error) {
                        console.error('🧪 Manual test error:', error);
                        return null;
                    }
                };
                
                // Manual function to force display shipping options
                window.forceDisplayShipping = function(pincode = '110001') {
                    console.log('🔧 Force displaying shipping options for pincode:', pincode);
                    calculateShipping(pincode);
                };
                
                // Manual function to force remove default shipping
                window.forceRemoveDefaultShipping = function() {
                    console.log('🔧 Force removing default shipping methods...');
                    removeDefaultShipping();
                };
                
                // Make functions available globally for debugging
                window.courierShippingDebug = {
                    calculateShipping,
                    displayShippingOptions,
                    getCartData,
                    testShippingAPI,
                    forceDisplayShipping,
                    forceRemoveDefaultShipping
                };
            });
            </script>
            <?php
        }
    }
}

// Initialize the plugin
new CourierShippingIntegration();
