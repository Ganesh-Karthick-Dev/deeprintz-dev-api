const authController = require("../controllers/auth/authController")
const categoryController = require("../controllers/categoryController")
const subCategoryController = require("../controllers/subCategoryController")
const productController = require("../controllers/productsController")
const cartController = require("../controllers/orders/cartController")
const orderController = require("../controllers/orders/orderController")
const orderchargesController = require("../controllers/orderChargesController")
const partnerController = require("../controllers/partnerController")
const productAttributesController = require("../controllers/productAttributesController")
const productDesignsController = require("../controllers/productDesignsController")
const tenantController = require("../controllers/tenantController")
const appController = require("../controllers/appController")
const employeeController = require("../controllers/employeeController")
const productAddonController = require("../controllers/productAddonController")
const stockController = require("../controllers/stockController")
const paymentController = require("../controllers/paymentController")
const invoiceController = require("../controllers/invoiceController")
const reportsController = require("../controllers/reportsController")
const enquiryController = require('../controllers/enquiry/enquiry.js')
const APIUserController = require('../controllers/api users/index.js')
const returnsController = require('../controllers/return/returnController.js')
const woocommerceController = require('../controllers/woocommerce/index.js')
const woocommerceWebhookController = require('../controllers/woocommerce/webhooks.js')
const modernShopifyRoutes = require('./shopify/modernRoutes.js')
const deleteTestOrderControllers = require('../service/deleteTestOrder.js')
const crypto = require('crypto');





const express = require("express");
const router = express.Router();
const upload = require("../config/upload")

// Auth

router.post("/login", authController.login);
router.post("/verifylogin", authController.verifylogin);

router.post("/forgot", authController.forgotController);

router.post("/register", authController.register)

router.post("/blockUser", authController.blockUser)

//verify email
router.post("/sendotp", authController.sendOtp)


// Category
router.post("/addCategory",
  //upload.single("image"),
  categoryController.addCategory)
router.post("/updateCategory",
  //upload.single("image"), 
  categoryController.updateCategory)
router.get("/getAllCategories", categoryController.getAllCategories)
router.post("/getCategoryBySlug", categoryController.getCategoryBySlug)
router.post("/getCategoryById", categoryController.getCategoryById)

//subCategory
router.post("/addSubCategory",
  //  upload.single("image"), 
  subCategoryController.addSubCategory)
router.post("/updateSubCategory",
  //  upload.single("image"), 
  subCategoryController.updateSubCategory)
router.post("/getSubCategoriesByCatId", subCategoryController.getSubCategoriesByCatId)
router.post("/getSubCategoriesById", subCategoryController.getSubCategoriesById)
router.post("/getSubcategoryBySlug", subCategoryController.getSubcategoryBySlug)
router.get("/getallSubCategories", subCategoryController.getallSubCategories)


//order charges
router.post("/getOrderChargesbyname", orderchargesController.getOrderChargesbyname)
router.post("/getOrderChargesbytype", orderchargesController.getOrderChargesbytype)
router.post("/getOrderChargebyId", orderchargesController.getOrderChargebyId)
router.post("/addOrderCharge", orderchargesController.addOrderCharge)
router.post("/updateOrdercharges", orderchargesController.updateOrdercharges)

//product addons
router.post("/createAddon", productAddonController.createAddon)
router.post("/getAddonById", productAddonController.getAddonById)
router.get("/getAllAddons", productAddonController.getAllAddons)
router.post("/updateAddon", productAddonController.updateAddon)
router.post("/deleteAddon", productAddonController.deleteAddon)
router.post("/activateAddon", productAddonController.activateAddon)

//product
router.post("/addProduct", productController.addProduct)
router.post("/updateProduct", productController.updateProduct)
router.post("/updateProductStock", productController.updateProductStock)
router.post("/deleteproduct", productController.deleteProduct)

router.post("/getproductsbycatId", productController.getproductsbycatId)
router.post("/getproductsbycatsubcatId", productController.getproductsbycatsubcatId)
router.post("/getproductsbycolor", productController.getproductsbycolor)
router.post("/getproductsbysize", productController.getproductsbysize)
router.post("/getproductsbyname", productController.getproductsbyname)

router.post("/getproducts", productController.getproducts)
router.get("/getAllProducts", productController.getAllProducts)
router.post("/getProductsById", productController.getProductsById)
router.post("/getProductsBySlug", productController.getproductsbyslug)
router.post("/getAllSkuBySearch", productController.getAllSkuBySearch)

router.post("/getImagesbycolor", productController.getImagesbycolor)
router.post("/getProductBySku", productController.getProductBySku)
//Customized Product
router.post("/createCusProduct", productController.createCustomizedProduct)
router.post("/getCusProductsByTenantId", productController.getCusProductsByTenantId)

// Cart
router.post("/addtocart", cartController.addtocart)

router.post("/removefromcart", cartController.removefromcart)
router.post("/getcartitemsbytenantid", cartController.getcartitemsbytenantid)
router.post("/getProductByCartid", cartController.getProductByCartid)

router.post('/addAndRemoveWishlist', cartController.addAndRemoveWishlist)
router.post('/getWishlist', cartController.getWishlist)

//order
router.post("/addOrder", orderController.addOrder);
router.post("/instantaddOrder", orderController.instantaddOrder);
router.post("/getOrdersbyCustomerId", orderController.getOrdersbyCustomerId);
router.post("/getOrderDetails", orderController.getOrderDetails);
router.post("/getAllOrders", orderController.getAllOrders);
router.post("/getAllOrdersWithPagination", orderController.getAllOrdersWithPagination);

// 🌐 Website Orders Management Routes (Your existing system)
router.post("/website-orders/getAllWebsiteOrders", orderController.getAllWebsiteOrders);
router.post("/website-orders/getWebsiteOrderDetails", orderController.getWebsiteOrderDetails);
router.post("/website-orders/updateWebsiteOrderStatus", orderController.updateWebsiteOrderStatus);
router.post("/website-orders/getWebsiteOrderCounts", orderController.getWebsiteOrderCounts);

router.post("/getOrderDetailsNew", orderController.getOrderDetailsNew);
router.post("/getAllOrderDetailsNew", orderController.getAllOrderDetailsNew);
router.get("/getAllLiveOrderDetails", orderController.getAllLiveOrderDetails);
router.get("/getAllOrdersNew", orderController.getAllOrdersNew);
router.post("/getOrderDetailsById", orderController.getOrderDetailsById);
router.get("/getAllPickListedOrderDetails", orderController.getAllPickListedOrderDetails);
router.post("/getOrderedItemDetailsById", orderController.getOrderedItemDetailsById);
router.get("/getAllTobePrintedOrderDetails", orderController.getAllTobePrintedOrderDetails);
router.post("/getPickedForToBePrinted", orderController.getPickedForToBePrinted);



router.post("/deleteTestOrders", deleteTestOrderControllers.deleteTestOrders);



router.post("/getAllOrdersByTenantId", orderController.getAllOrdersByTenantId);
router.post("/deleteOrder", orderController.deleteOrder);
router.post("/updateOrderStatus", orderController.updateOrderStatus);

router.post("/updatedeliverystatus", orderController.updatedeliverystatus);

router.post("/updateOrderProductStatus", orderController.updateOrderProductStatus);
router.post("/updateOrderItemStatus", orderController.updateOrderItemStatus);
router.post("/getOrderLogs", orderController.getOrderLogs);
router.post("/updateOrderDetails", orderController.updateOrderDetails);
router.post("/updateLiveOrderDetails", orderController.updateLiveOrderDetails);
router.post("/ordermoveLive", orderController.ordermoveLive);
router.post("/fetchOrdersForAllOrdersManage", orderController.fetchOrdersForAllOrdersManage);
router.post("/updateItemStatusForManageAllorders", orderController.updateItemStatusForManageAllorders);
router.post("/getOrderDetailsByOrderId", orderController.getOrderDetailsByOrderId);
router.post("/updateDispatchStatus", orderController.updateDispatchStatus);
router.post("/updateIndividualItemStatus", orderController.updateIndividualItemStatus);
router.post("/updateStoreOrderItemStatus", orderController.updateStoreOrderItemStatus);
router.post("/updateDispatchStatusWithShipmentDetails", orderController.updateDispatchStatusWithShipmentDetails);
router.post("/updateIndividualItemFromScanner", orderController.updateIndividualItemFromScanner);

router.post("/getOrderDetailsByIdForPickList", orderController.getOrderDetailsByIdForPickList);
router.post("/getOrderDetailsByIdForPickListPdf", orderController.getOrderDetailsByIdForPickListPdf);

router.post("/getOrderLable", orderController.getOrderLable);

router.post("/updateOrderShipmentDetails", orderController.updateOrderShipmentDetails);
router.post("/checkreference", orderController.checkreference);
router.post("/getreference", orderController.getreference);

router.get("/getCouriers", orderController.getCouriers)
router.post("/getordersbycourier", orderController.getordersbycourier);

router.post("/getOrderDetailsForInvoice", orderController.getOrderDetailsForInvoice)

//chats
router.post("/sendMessage", orderController.chats);
router.post("/getChatsByOrderheaderid", orderController.getChatsByOrderheaderid);
router.post("/getAllChats", orderController.getAllChats);

router.post("/adminMessages", orderController.adminMessages);
router.post("/guestOrderEmail", orderController.guestOrderEmail);
router.post("/getCourierPartners", orderController.getCourierPartners);

router.post("/getAllStoreOrders", orderController.getAllStoreOrders);
router.post("/testRoute", orderController.testRoute);
router.post("/storeOrderMoveLive", orderController.storeOrderMoveLive);
router.post("/normalOrderMoveLive", orderController.normalOrderMoveLive);

//productAttributes
router.post("/addProductAttributes", productAttributesController.addProductAttributes)
router.post("/updateProductAttributes", productAttributesController.updateProductAttributes)
router.post("/getProductAttributesbyTag", productAttributesController.getProductAttributesbyTag)
router.post("/getProductAttributesbyId", productAttributesController.getProductAttributesbyId)

//Partners
router.post('/addPartnerinfo', partnerController.addPartnerInfo);
router.post('/updatePartnerinfo', partnerController.updatePartnerinfo);
router.post('/addPartnerlocations', partnerController.addPartnerLocations);
router.post('/updatePartnerlocations', partnerController.updatePartnerLocations);
router.post('/getPartnerlocationsbyId', partnerController.getPartnerlocationsbyId);
router.post('/getPartnersById', partnerController.getPartnersById);
router.get('/getAllPartners', partnerController.getAllPartners);
router.get('/getAllPartnerLocations', partnerController.getAllPartnerLocations);
router.post('/getPartnersByPostcode', partnerController.getPartnersByPostcode);


//designs
router.post("/addDesign", productDesignsController.addDesign)
router.post("/updateDesign", productDesignsController.updateDesign)
router.post("/deleteDesign", productDesignsController.deleteDesign)
router.post("/getDesignsByTenantid", productDesignsController.getDesignsBytenantId)
router.post("/getDesignsByName", productDesignsController.getDesignsByName)

//tenant
router.post("/updateTenantProfileDetails", tenantController.updateProfileDetails)
router.post("/getTenantProfileDetailsById", tenantController.getTenantProfileDetailsById)
// router.post("/updateTenantProfileDetails", tenantController.getTenantProfileDetailsById)
router.post("/addTenantBankDetails", tenantController.addBankDetails)
router.get('/getAllTenants', tenantController.getAllTenants)
router.post('/getTenantsByStatus', tenantController.getTenantsByStatus)
router.post('/updateFolderId', tenantController.updateFolderId)
 



//countries
router.get("/getAllCountries", appController.getAllCountries)

//Employee
router.get("/getAllModules", employeeController.getAllModules)
router.get("/getAllRoles", employeeController.getAllRoles)
router.post("/getRoleById", employeeController.getRoleById)
router.get("/getAllEmployees", employeeController.getAllEmployees)
router.post("/getEmployeeById", employeeController.getEmployeeById)
router.post("/addRoles", employeeController.addRoles)
router.post("/updateRoles", employeeController.updateRole)
router.post("/deleteRole", employeeController.deleteRole)
router.post("/activateRole", employeeController.activateRole)
router.post("/addEmployee", employeeController.addEmployee)
router.post("/updateEmployee", employeeController.updateEmployee)

//stock
router.post("/addStock", stockController.addStock)
router.post("/getStockLogs", stockController.getStockLogs)
router.get("/getAllStockLogs", stockController.getAllStockLogs)
router.post("/getVariantQuantity", stockController.getVariantQuantity)
router.get("/getAvalaibleRacks", stockController.getAvalaibleRacks)
router.post("/stockBulkUpload", stockController.stockBulkUpload)
router.post("/getVariantIdBySku", productController.getVariantIdBySku)



//payment
router.post("/addPaymentDetails", paymentController.addPaymentDetails)
router.get("/getAllPayments", paymentController.getAllPayments)
router.post("/getPaymentHistory", paymentController.getPaymentHistory)
router.post("/updatePaymentStatus", paymentController.updatePaymentStatus)
router.get("/getAllTransactionHistoryforadmin", paymentController.getAllTransactionHistory)

//invoice
router.post("/generateInvoice", invoiceController.generateInvoice)
router.post("/createInvoice", invoiceController.createInvoice)
router.post('/getAllInvoices', invoiceController.getAllInvoices)
router.post('/getInvoiceDetailsById', invoiceController.getInvoiceDetailsById)


//reports
router.post("/salesReport", reportsController.salesReport)
router.get("/salesChart", reportsController.salesChart)
router.get("/ordersChart", reportsController.ordersChart)

// enquiry email
router.post('/sendEnquiryMail', enquiryController.sendEnquiryMailController)
router.get('/getAllEnquiry', enquiryController.getAllEnquires)
router.post('/webhook', enquiryController.webhook)
// enquiry email
router.post('/sendEnquiryMailv1', enquiryController.sendEnquiryMailv1)
router.post('/createRazorpayIntent', paymentController.createRazorpayIntent)
router.get('/alertEnquiryCall', enquiryController.alertEnquiry)


// API User
router.post('/createAPIuser', APIUserController.createapiuser)
router.post('/editAPIuser', APIUserController.editapiuser)
router.post('/deleteAPIuser', APIUserController.deleteapiuser)
router.post('/getAPIuserbyid', APIUserController.getapiuserbyid)
router.get('/getAllAPIusers',APIUserController.getallapiusers)
// router.post('/renewAPIusertoken',APIUserController.renewapiusertoken)
router.post('/toggleAPIuserstatus', APIUserController.toggleapiuserstatus)
router.post('/loginAPIuser',APIUserController.loginApiUser)
router.post('/generateToken',APIUserController.createToken)
router.post('/forgotPassCode',APIUserController.forgotPasscode)
// API User


// make order return
router.post('/sendReturnRequest',returnsController.sendReturnRequest)
router.get('/getAllReturnOrders',returnsController.getAllReturns)
router.post('/approveReturn',returnsController.approveReturn)
// make order return



// 🛒 WooCommerce Integration Routes
router.post('/woocommerce/connect', woocommerceController.wooConnect);
router.post('/woocommerce/test-connection', woocommerceController.testWooCommerceConnection);
router.get('/woocommerce/connection-status', woocommerceController.getConnectionStatus);
router.post('/woocommerce/update-wordpress-credentials', woocommerceController.updateWordPressCredentials);
router.get('/woocommerce/disconnect', woocommerceController.disconnectWooCommerce);
router.post('/woocommerce/list-products', woocommerceController.listProductsForVendors);
router.post('/woocommerce/create-product', woocommerceController.createProductInWooCommerce);
router.post('/woocommerce/update-product', woocommerceController.updateProductInWooCommerce);
router.post('/woocommerce/delete-product', woocommerceController.deleteProductFromWooCommerce);
router.post('/woocommerce/vendor-stores', woocommerceController.getVendorStores);
router.post('/woocommerce/push-products', woocommerceController.pushProductsToWooCommerce);

// 🛒 WooCommerce Order Management Routes
router.get('/woocommerce/orders/vendor/:vendor_id', woocommerceController.getVendorOrders);
router.get('/woocommerce/orders/vendor/:vendor_id/order/:order_id', woocommerceController.getOrderById);
router.put('/woocommerce/orders/vendor/:vendor_id/order/:order_id/status', woocommerceController.updateOrderStatus);
router.get('/woocommerce/orders/vendor/:vendor_id/statistics', woocommerceController.getOrderStatistics);
router.post('/woocommerce/orders/sync', woocommerceController.syncOrdersFromWooCommerce);

// 🏪 Store Orders Management Routes (Separate from Website Orders)
// router.post('/store-orders/getAllStoreOrders', woocommerceController.getAllStoreOrders);
router.post('/store-orders/getStoreOrderDetails', woocommerceController.getStoreOrderDetails);
router.post('/store-orders/updateStoreOrderStatus', woocommerceController.updateStoreOrderStatus);
router.post('/store-orders/getStoreOrderCounts', woocommerceController.getStoreOrderCounts);
router.post('/updateStoreOrderDispatchStatus', woocommerceController.updateStoreOrderDispatchStatus);
router.post('/store-orders/convertToWebsiteOrder', woocommerceController.convertToWebsiteOrder);

// 🛒 WooCommerce Webhook Routes (for real-time order notifications)
router.post('/woocommerce/webhooks/orders', woocommerceWebhookController.handleOrderWebhook);
router.post('/woocommerce/webhooks/products', woocommerceWebhookController.handleProductWebhook);
router.post('/woocommerce/webhooks/customers', woocommerceWebhookController.handleCustomerWebhook);

// 🧪 WooCommerce Webhook Testing Route (for debugging signature verification)
router.post('/woocommerce/webhooks/test-signature', woocommerceWebhookController.testSignatureVerification);

router.post('/testStoreAPI', woocommerceWebhookController.testStoreAPI);

// 🛒 WooCommerce Debug Route (to test if routes are working)
router.get('/woocommerce/test', (req, res) => {
  res.json({ 
    success: true, 
    message: 'WooCommerce routes are working!',
    timestamp: new Date().toISOString(),
    path: req.path,
    baseUrl: req.baseUrl,
    originalUrl: req.originalUrl
  });
});

// 🚚 WooCommerce Shipping Integration Routes
router.post('/woocommerce/shipping/calculate', woocommerceController.calculateWooCommerceShipping);
router.get('/woocommerce/shipping/zones', woocommerceController.getWooCommerceShippingZones);
router.post('/woocommerce/shipping/setup', woocommerceController.setupWooCommerceShipping);
router.get('/woocommerce/shipping/rates/:postcode', woocommerceController.getShippingRatesForPostcode);
router.post('/woocommerce/shipping/webhook', woocommerceController.handleShippingWebhook);
router.get('/woocommerce/shipping/status', woocommerceController.getVendorShippingStatus);

// 🎣 WooCommerce Webhook Management Routes
router.post('/woocommerce/webhooks/setup', woocommerceController.setupWooCommerceWebhooks);
router.get('/woocommerce/webhooks/list', woocommerceController.listWooCommerceWebhooks);
router.delete('/woocommerce/webhooks/:webhook_id', woocommerceController.deleteWooCommerceWebhook);

// 🛒 WooCommerce Integration Routes

// 🚀 Modern Shopify Integration Routes (GraphQL + Latest Library)
router.use('/shopify', modernShopifyRoutes);

// 🚚 Shopify Shipping Integration Routes
const shopifyShippingRoutes = require('./shopify/shippingRoutes');
router.use('/shopify', shopifyShippingRoutes);

module.exports = router