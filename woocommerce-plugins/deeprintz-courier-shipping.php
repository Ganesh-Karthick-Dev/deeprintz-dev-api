<?php
/**
 * Plugin Name: Courier Shipping Integration
 * Description: Automatic shipping calculation with courier partners for vendor 2004
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
                        const shippingDisplayHTML = `
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
                        `;
                        
                        const targetElement = $('.woocommerce-shipping-methods').length ? 
                                             $('.woocommerce-shipping-methods')[0] : 
                                             $('.woocommerce-checkout-review-order-table')[0];
                        
                        if (targetElement) {
                            $(targetElement).before(shippingDisplayHTML);
                        }
                    }
                    
                    addLoadingIndicator() {
                        const loadingHTML = `
                            <div id="shipping-loading" class="shipping-loading" style="display: none;">
                                <div class="loading-spinner"></div>
                                <span>Calculating shipping charges...</span>
                            </div>
                        `;
                        
                        $('#custom-shipping-display').append(loadingHTML);
                    }
                    
                    async handlePincodeChange(pincode) {
                        if (!pincode || pincode.length < 6) {
                            this.hideCustomShippingDisplay();
                            return;
                        }
                        
                        console.log(`📝 Pincode changed to: ${pincode}`);
                        await this.calculateShippingForPincode(pincode);
                    }
                    
                    async handlePincodeInput(pincode) {
                        if (!pincode || pincode.length < 6) {
                            return;
                        }
                        
                        console.log(`🔄 Auto-calculating shipping for pincode: ${pincode}`);
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
                            
                            console.log(`🚚 Calculating shipping for pincode: ${pincode}`);
                            
                            const cartData = this.getCartData();
                            console.log('📦 Cart data:', cartData);
                            
                            const cacheKey = `${pincode}_${cartData.weight}_${cartData.total}`;
                            if (this.shippingCache.has(cacheKey)) {
                                console.log('💾 Using cached shipping data');
                                const cachedData = this.shippingCache.get(cacheKey);
                                this.displayShippingOptions(cachedData.shipping_options);
                                return;
                            }
                            
                            const response = await fetch(`${this.config.apiBaseUrl}/shipping/calculate`, {
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
                            
                            optionsHTML += `
                                <div class="shipping-option ${isRecommended ? 'recommended' : ''}" data-courier-id="${option.courier_id}">
                                    <div class="shipping-option-header">
                                        <input type="radio" name="custom_shipping_method" 
                                               id="custom_shipping_${option.courier_id}" 
                                               value="${option.courier_id}" 
                                               data-cost="${totalCost}"
                                               ${isRecommended ? 'checked' : ''}>
                                        <label for="custom_shipping_${option.courier_id}">
                                            <span class="courier-name">${option.courier_name}</span>
                                            <span class="shipping-cost">₹${totalCost.toFixed(2)}</span>
                                        </label>
                                    </div>
                                    <div class="shipping-option-details">
                                        <span class="delivery-time">${option.estimated_delivery || '3-5 days'}</span>
                                        <span class="shipping-breakdown">
                                            Shipping: ₹${option.shipping_cost.toFixed(2)}
                                            ${option.cod_charge ? ` + COD: ₹${option.cod_charge.toFixed(2)}` : ''}
                                        </span>
                                    </div>
                                </div>
                            `;
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
                        const cacheKey = `${pincode}_${cartData.weight}_${cartData.total}`;
                        
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
                            const methodHTML = `
                                <li class="custom-shipping-method">
                                    <input type="radio" name="shipping_method[0]" 
                                           id="shipping_method_0_custom" 
                                           value="custom_${option.courier_id}" 
                                           class="shipping_method" 
                                           checked>
                                    <label for="shipping_method_0_custom">
                                        ${option.courier_name} - ₹${totalCost.toFixed(2)}
                                    </label>
                                </li>
                            `;
                            
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
                            shippingCostElement.text(`₹${totalCost.toFixed(2)}`);
                        }
                        
                        this.updateTotalAmount(totalCost);
                    }
                    
                    updateTotalAmount(shippingCost) {
                        const subtotalElement = $('.woocommerce-checkout-review-order-table .cart-subtotal .amount');
                        if (subtotalElement.length) {
                            const subtotalText = subtotalElement.text();
                            const subtotal = parseFloat(subtotalText.replace(/[^\d.]/g, '')) || 0;
                            const total = subtotal + shippingCost;
                            
                            const totalElement = $('.woocommerce-checkout-review-order-table .order-total .amount');
                            if (totalElement.length) {
                                totalElement.text(`₹${total.toFixed(2)}`);
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
                                total = parseFloat(totalText.replace(/[^\d.]/g, '')) || 0;
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
                        $('#shipping-error').html(`<div class="error-message">${message}</div>`).show();
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
