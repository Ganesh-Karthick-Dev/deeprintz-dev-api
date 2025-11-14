#!/usr/bin/env node

/**
 * Shopify Postman Collection Test Script
 *
 * This script validates that your Shopify integration is ready for Postman testing.
 * Run this before importing the Postman collection to ensure everything is configured correctly.
 */

const https = require('https');
const http = require('http');

class ShopifyPostmanTest {
    constructor() {
        this.baseUrl = 'https://devapi.deeprintz.com';
        this.testResults = [];
        this.errors = [];
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            reset: '\x1b[0m'
        };
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    async makeRequest(url, options = {}) {
        return new Promise((resolve, reject) => {
            const protocol = url.startsWith('https:') ? https : http;

            const requestOptions = {
                method: options.method || 'GET',
                headers: options.headers || {},
                timeout: 10000
            };

            const req = protocol.request(url, requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: jsonData
                        });
                    } catch (e) {
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: data
                        });
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            if (options.body) {
                req.write(JSON.stringify(options.body));
            }

            req.end();
        });
    }

    async testEndpoint(name, url, options = {}) {
        this.log(`Testing: ${name}`, 'info');

        try {
            const response = await this.makeRequest(url, options);

            if (response.statusCode >= 200 && response.statusCode < 300) {
                this.log(`✅ ${name}: SUCCESS (${response.statusCode})`, 'success');
                this.testResults.push({ name, status: 'PASS', code: response.statusCode });
                return response;
            } else {
                this.log(`❌ ${name}: FAILED (${response.statusCode})`, 'error');
                this.testResults.push({ name, status: 'FAIL', code: response.statusCode, response: response.data });
                return response;
            }
        } catch (error) {
            this.log(`❌ ${name}: ERROR - ${error.message}`, 'error');
            this.testResults.push({ name, status: 'ERROR', error: error.message });
            return null;
        }
    }

    async runBasicConnectivityTests() {
        this.log('🚀 Starting Shopify Postman Collection Readiness Test', 'info');
        this.log('='.repeat(60), 'info');

        // Test 1: Base API connectivity
        await this.testEndpoint(
            'Base API Connectivity',
            `${this.baseUrl}/api/deeprintz/dev/shopify/getConnectionStatus?userId=123`
        );

        // Test 2: Invalid endpoint (should return 404)
        await this.testEndpoint(
            'Invalid Endpoint Handling',
            `${this.baseUrl}/api/nonexistent/endpoint`
        );

        // Test 3: CORS headers check
        const corsResponse = await this.testEndpoint(
            'CORS Headers',
            `${this.baseUrl}/api/deeprintz/dev/shopify/getConnectionStatus?userId=123`
        );

        if (corsResponse) {
            const hasCorsHeaders = corsResponse.headers['access-control-allow-origin'] ||
                                  corsResponse.headers['access-control-allow-headers'];
            if (hasCorsHeaders) {
                this.log('✅ CORS headers detected', 'success');
            } else {
                this.log('⚠️  No CORS headers detected (may cause issues in browser)', 'warning');
            }
        }
    }

    async runAuthenticationTests() {
        this.log('\n🔐 Testing Authentication Endpoints', 'info');
        this.log('-'.repeat(40), 'info');

        // Test OAuth installation endpoint structure
        await this.testEndpoint(
            'OAuth Installation Structure',
            `${this.baseUrl}/api/deeprintz/dev/shopify/install?shop=test-shop.myshopify.com&userid=123`,
            { method: 'GET' }
        );

        // Test with invalid shop domain
        await this.testEndpoint(
            'Invalid Shop Domain Handling',
            `${this.baseUrl}/api/deeprintz/dev/shopify/install?shop=invalid-domain.com&userid=123`,
            { method: 'GET' }
        );
    }

    async runProductTests() {
        this.log('\n📦 Testing Product Management Endpoints', 'info');
        this.log('-'.repeat(40), 'info');

        // Test getProducts with invalid user
        await this.testEndpoint(
            'Get Products (Invalid User)',
            `${this.baseUrl}/api/deeprintz/dev/shopify/getProducts?userId=999999`
        );

        // Test createProduct validation
        await this.testEndpoint(
            'Create Product Validation',
            `${this.baseUrl}/api/deeprintz/dev/shopify/createProduct`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: { userId: '123' } // Missing productId
            }
        );
    }

    async runShippingTests() {
        this.log('\n🚚 Testing Shipping Endpoints', 'info');
        this.log('-'.repeat(40), 'info');

        // Test shipping calculation validation
        await this.testEndpoint(
            'Shipping Calculation Validation',
            `${this.baseUrl}/api/deeprintz/dev/shopify/calculateShipping`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: {
                    userId: '123',
                    postCode: '110001',
                    weight: '0.5',
                    orderAmount: '29.99'
                }
            }
        );
    }

    async runWebhookTests() {
        this.log('\n🔗 Testing Webhook Endpoints', 'info');
        this.log('-'.repeat(40), 'info');

        // Test order webhook endpoint
        await this.testEndpoint(
            'Order Webhook Endpoint',
            `${this.baseUrl}/api/deeprintz/dev/shopify/handleOrderWebhook`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Topic': 'orders/create',
                    'X-Shopify-Shop-Domain': 'test-shop.myshopify.com'
                },
                body: { id: 1234567890, name: '#TEST' }
            }
        );
    }

    generateReport() {
        this.log('\n📊 TEST RESULTS SUMMARY', 'info');
        this.log('='.repeat(60), 'info');

        const passed = this.testResults.filter(r => r.status === 'PASS').length;
        const failed = this.testResults.filter(r => r.status === 'FAIL').length;
        const errors = this.testResults.filter(r => r.status === 'ERROR').length;
        const total = this.testResults.length;

        this.log(`Total Tests: ${total}`, 'info');
        this.log(`Passed: ${passed}`, 'success');
        this.log(`Failed: ${failed}`, failed > 0 ? 'error' : 'info');
        this.log(`Errors: ${errors}`, errors > 0 ? 'error' : 'info');

        if (failed > 0 || errors > 0) {
            this.log('\n❌ FAILED TESTS:', 'error');
            this.testResults
                .filter(r => r.status !== 'PASS')
                .forEach(result => {
                    this.log(`  - ${result.name}: ${result.status}`, 'error');
                    if (result.error) {
                        this.log(`    Error: ${result.error}`, 'error');
                    }
                    if (result.code) {
                        this.log(`    Status Code: ${result.code}`, 'error');
                    }
                });
        }

        this.log('\n📋 RECOMMENDATIONS:', 'info');

        if (passed === total) {
            this.log('✅ All basic connectivity tests passed!', 'success');
            this.log('🌟 Your Shopify integration appears ready for Postman testing.', 'success');
        } else {
            this.log('⚠️  Some tests failed. Check the issues above before proceeding.', 'warning');
            this.log('🔧 Common fixes:', 'info');
            this.log('   - Verify server is running and accessible', 'info');
            this.log('   - Check API endpoints match your configuration', 'info');
            this.log('   - Ensure CORS is properly configured', 'info');
            this.log('   - Check server logs for detailed error information', 'info');
        }

        this.log('\n🚀 NEXT STEPS:', 'info');
        this.log('1. Import Shopify_Postman_Collection.json into Postman', 'info');
        this.log('2. Set up environment variables in Postman', 'info');
        this.log('3. Run OAuth installation to get access token', 'info');
        this.log('4. Test product creation and management', 'info');
        this.log('5. Test shipping calculations', 'info');

        this.log('\n📖 For detailed instructions, see: SHOPIFY_POSTMAN_COLLECTION_README.md', 'info');
    }

    async runAllTests() {
        try {
            await this.runBasicConnectivityTests();
            await this.runAuthenticationTests();
            await this.runProductTests();
            await this.runShippingTests();
            await this.runWebhookTests();

            this.generateReport();
        } catch (error) {
            this.log(`💥 Test suite failed: ${error.message}`, 'error');
        }
    }
}

// Run the tests
if (require.main === module) {
    const tester = new ShopifyPostmanTest();
    tester.runAllTests().catch(console.error);
}

module.exports = ShopifyPostmanTest;

