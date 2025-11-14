const _ = require("lodash");
const moment = require('moment')
const momentNew = require('moment-timezone');
const { orderMailForClient } = require("../../config/ordermail");
const { processInvoice } = require("../../utils/invoiceHelper");
const cartService = require('../order/orderService')

module.exports.addOrder = async (props) => {
    const {
        cartIds,
        tenantid,
        orderProducts,
        addonIds,
        referenceno,
        shippingmode,
        ordernotes,
        paymenttype,
        pincode,
        courierid,
        customername,
        contactno,
        email,
        deliveryaddress,
        state,
        city,
        status,
        ordervalue,
        totalamount,
        deliverycharge,
        custom_letter_img
    } = props;

    try {
        const knex = global.dbConnection
        const trx = await knex.transaction();

        const orderstatus = status == 1 ? "onhold" : "live"
        // order sequence num creation
        const value = await knex('orders').select('orderheaderid').where({ tenantid }).orderBy('orderheaderid', 'desc').first()

        const year = moment().year();
        const orderid = `${tenantid}_${referenceno}`

        var order_reference_number = referenceno;

        // remove from cart 
        const remove = await trx('carts').del().whereIn('cartid', cartIds)

        //addon array
        const productaddons = addonIds.join(',')

        // Set delivery charge to 0 for self-pickup (shippingmode = 3)
        const finalDeliveryCharge = shippingmode === 3 ? 0 : deliverycharge

        //order
        const order = await trx('orders').insert({
            tenantid,
            orderid,
            order_reference_number,
            totalamount,
            deliverycharge: finalDeliveryCharge,
            productaddons,
            ordervalue,
            orderstatus,
            ordernotes,
            paymenttype,
            custom_letter_img,
            shippingmode
        })


        // Detect from wallet
        if (status == 2) {
            const response = await global.dbConnection('tenants')
                .select('wallet').where({ tenantid })

            const walletamount = response[0].wallet

            const balance = walletamount - (_.toNumber(totalamount))

            console.log("balance", balance)

            const updateBalance = await trx('tenants')
                .update({ wallet: balance })
                .where({ tenantid })
            console.log("updateBalance", updateBalance)
            const paymentlog = await trx('paymentlogs').insert({
                tenantid: tenantid,
                orderid: orderid,
                amount_debited: totalamount,
                balance: balance
            });

            const orderDetails = await (async () => {
                const customerDetails = {
                    name: customername,
                    address: deliveryaddress,
                    email: email,
                    number: contactno,
                    pincode: pincode
                };

                const total = totalamount;

                // Resolve all product promises
                const products = await Promise.all(orderProducts?.map(async (item) => {
                    const tenantProductData = await global.dbConnection('tenantproducts')
                        .select()
                        .where('tenantproductid', item?.tenantproductid)
                        .first();

                    const totalPrice = parseFloat(item.productcost) * item?.quantity;
                    const taxAmount = totalPrice * (Math.round(Number(item?.taxpercent)) / 100)
                    const totalPriceWithTax = (totalPrice + taxAmount) + Number(parseFloat(item.charges).toFixed(2));
                    const finalTotal = parseFloat(totalPriceWithTax).toFixed(2)

                    return {
                        sku: tenantProductData?.productsku,
                        code: `611300`,
                        quantity: item?.quantity,
                        productPrice: item?.productcost,
                        cgst: (Number(Math.round(item?.productcost * item?.quantity)) * 2.5) / 100,
                        sgst: (Number(Math.round(item?.productcost * item?.quantity)) * 2.5) / 100,
                        handling: item?.charges,
                        total: finalTotal
                    };
                }));

                return { customerDetails, total, products };
            })();

            const intermediateEmail = await global.dbConnection('tenants')
                .leftJoin('app_users', 'app_users.userid', 'tenants.user_id')
                .select('app_users.email')
                .where('tenants.tenantid', tenantid)
                .first()


            // send invoice
            const sendInvoice = await processInvoice(orderDetails, finalDeliveryCharge)

            const insertUserInvoice = await global.dbConnection('tenantinvoice')
                .insert({
                    orderheaderid: order[0],
                    tenantid: tenantid,
                    totalamount: totalamount,
                    invoiceurl: sendInvoice,
                    status: 'paid',
                    invoicestatus: 'Active'
                })

            // console.log(`insertUserInvoice - `,insertUserInvoice);


            const sendMail = await orderMailForClient(orderDetails, sendInvoice, intermediateEmail?.email)
            // send invoice


            console.log("paymentlog", paymentlog)
        }

        if (!_.isEmpty(order)) {

            const details = orderProducts.map(item => {
                return {
                    ...item,
                    itemstatus: orderstatus,
                    orderheaderid: order[0]
                }
            });

            const orderdetails = await trx('orderdetails').insert(details)

            if (!_.isEmpty(orderdetails)) {
                // Skip delivery entry for self-pickup (shippingmode = 3)
                if (shippingmode !== 3) {
                    const deliveries = await trx('deliveries').insert({
                        orderheaderid: order[0],
                        pincode,
                        courierid,
                        customername,
                        contactno,
                        email,
                        deliveryaddress,
                        state,
                        city,
                        shippingmode
                    })


                    if (_.isEmpty(deliveries)) {
                        await trx.rollback()
                        return null
                    }
                }
                await trx.commit()

                // Use a fresh connection after commit
                const knex = global.dbConnection
                const odprods = await knex('orderdetails')
                    .select(
                        "orderdetailid",
                        "tenantproductid",
                        "quantity",
                        "productcost",
                        "charges",
                        "taxpercent",
                        "taxamount",
                        "total"
                    ).where({ orderheaderid: order[0] })
                console.log("orderdetails...", odprods)

                const stock = await this.reduceStock(odprods)

                // If status is live
                if (status == 2) {
                    const ofs = await Promise.all(stock.map(async (item) => {
                        if (item.stock == false) {
                            const updateOrderStatus = await knex('orders')
                                .update({ orderstatus: "Out-Of-Stock" })
                                .where({ orderheaderid: order[0] })

                            const updateOrderDetailStatus = await knex('orderdetails')
                                .update({ itemstatus: "Out-Of-Stock" })
                                .where({
                                    orderdetailid: item.orderdetailid
                                })

                            return updateOrderStatus
                        }
                    }))
                    console.log("ofs...", ofs)
                }
                if (!_.isNull(order)) {
                    const addOrderItems = await this.addOrderItems(order[0], odprods, orderProducts, orderstatus)
                    if (!_.isNull(addOrderItems)) {
                        return order
                    }
                }
            }
        }

        await trx.rollback()
        return null

    }
    catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.addOrderItems = async (orderId, orderdetail, orderProducts, orderstatus) => {
    try {
        const knex = global.dbConnection
        const trx = await knex.transaction();

        // Create a map of tenantproductid to orderdetailid
        const orderDetailMap = orderdetail.reduce((map, detail) => {
            map[detail.tenantproductid] = detail.orderdetailid;
            return map;
        }, {});

        for (const product of orderProducts) {
            const quantity = parseInt(product.quantity, 10);
            const orderdetailid = orderDetailMap[product.tenantproductid];

            for (let i = 0; i < quantity; i++) {
                const uniqueItemId = `ORD${orderId}PRD${product.tenantproductid}PIC${i + 1}`;
                const add = await trx('ordered_items').insert({
                    orderheaderid: orderId,
                    orderdetailid: orderdetailid,
                    uniqueitemid: uniqueItemId,
                    productid: product.tenantproductid,
                    status: orderstatus,
                });

                if (!add) {
                    throw new Error('Failed to add ordered item');
                }
            }
        }

        await trx.commit();
        return true;
    } catch (err) {
        console.log(err);
        await trx.rollback();
        return null;
    }
}

module.exports.instantaddOrder = async (props) => {
    const {
        cartIds,
        tenantid,
        orderProducts,
        addonIds,
        referenceno,
        shippingmode,
        ordernotes,
        paymenttype,
        pincode,
        courierid,
        customername,
        contactno,
        email,
        deliveryaddress,
        state,
        city,
        status,
        ordervalue,
        totalamount,
        deliverycharge,
        custom_letter_img
    } = props;

    try {
        const knex = global.dbConnection
        const trx = await knex.transaction();

        const orderstatus = status == 1 ? "onhold" : "live"
        // order sequence num creation
        const value = await knex('orders').select('orderheaderid').where({ tenantid }).orderBy('orderheaderid', 'desc').first()
        const seqnum = !_.isEmpty(value) ? value.orderheaderid + 1 : 1
        const year = moment().year();
        const orderid = `${tenantid}_${referenceno}`

        var order_reference_number = referenceno;

        // remove from cart 
        const remove = await trx('carts').del().whereIn('cartid', cartIds)

        //addon array
        const productaddons = addonIds.join(',')

        // Set delivery charge to 0 for self-pickup (shippingmode = 3)
        const finalDeliveryCharge = shippingmode === 3 ? 0 : deliverycharge

        //order
        const order = await trx('orders').insert({
            tenantid,
            orderid,
            order_reference_number,
            totalamount,
            deliverycharge: finalDeliveryCharge,
            productaddons,
            ordervalue,
            orderstatus,
            ordernotes,
            paymenttype,
            custom_letter_img
        })
        // Detect from wallet
        if (status == 2) {
            const response = await global.dbConnection('tenants')
                .select('wallet').where({ tenantid })

            const walletamount = response[0].wallet

            const balance = walletamount - (_.toNumber(totalamount))

            console.log("balance", balance)

            const updateBalance = await trx('tenants')
                .update({ wallet: balance })
                .where({ tenantid })
            console.log("updateBalance", updateBalance)
            const paymentlog = await trx('paymentlogs').insert({
                tenantid: tenantid,
                orderid: orderid,
                amount_debited: totalamount,
                balance: balance
            });
            console.log("paymentlog", paymentlog)
        }

        if (!_.isEmpty(order)) {

            const details = orderProducts.map(item => {
                return {
                    ...item,
                    itemstatus: orderstatus,
                    orderheaderid: order[0]
                }
            });

            const orderdetails = await trx('orderdetails').insert(details)

            if (!_.isEmpty(orderdetails)) {
                // Skip delivery entry for self-pickup (shippingmode = 3)
                if (shippingmode !== 3) {
                    const deliveries = await trx('deliveries').insert({
                        orderheaderid: order[0],
                        pincode,
                        courierid,
                        customername,
                        contactno,
                        email,
                        deliveryaddress,
                        state,
                        city,
                        shippingmode
                    })
                    if (_.isEmpty(deliveries)) {
                        await trx.rollback()
                        return null
                    }
                }
                await trx.commit()

                // Use a fresh connection after commit
                const knex = global.dbConnection
                const odprods = await knex('orderdetails')
                    .select(
                        "orderdetailid",
                        "tenantproductid",
                        "quantity",
                        "productcost",
                        "charges",
                        "taxpercent",
                        "taxamount",
                        "total"
                    ).where({ orderheaderid: order[0] })
                console.log("orderdetails...", odprods)

                const stock = await this.reduceStock(odprods)

                // If status is live
                if (status == 2) {
                    const ofs = await Promise.all(stock.map(async (item) => {
                        if (item.stock == false) {
                            const updateOrderStatus = await knex('orders')
                                .update({ orderstatus: "Out-Of-Stock" })
                                .where({ orderheaderid: order[0] })

                            const updateOrderDetailStatus = await knex('orderdetails')
                                .update({ itemstatus: "Out-Of-Stock" })
                                .where({
                                    orderdetailid: item.orderdetailid
                                })

                            return updateOrderStatus
                        }
                    }))
                    console.log("ofs...", ofs)
                }
                if (!_.isNull(order)) {
                    const addOrderItems = await this.addOrderItems(order[0], odprods, orderProducts, orderstatus)
                    if (!_.isNull(addOrderItems)) {
                        return order
                    }
                }
            }
        }

        await trx.rollback()
        return null

    }
    catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.updateLiveOrderDetails = async (props) => {
    try {
        const { order_header_id, customer_name, mobile, email, shipping_address, state, city } = props;
        const updates = {};

        if (!_.isEmpty(customer_name)) {
            updates.customername = email;
        }

        if (!_.isEmpty(email)) {
            updates.email = customer_name;
        }

        if (!_.isEmpty(mobile)) {
            updates.contactno = mobile;
        }

        if (!_.isEmpty(shipping_address)) {
            updates.deliveryaddress = shipping_address;
        }

        if (!_.isEmpty(state)) {
            updates.state = state;
        }

        if (!_.isEmpty(city)) {
            updates.city = city;
        }
        const response = await global.dbConnection('deliveries')
            .update(updates)
            .where({ orderheaderid: order_header_id });

        return response > 0 ? response : 0;

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.ordermoveLive = async (props) => {
    try {
        const {
            tenantid, orderid, orderheaderId, customer_name, mobile,
            email, shipping_address, state, city, totalamount,
            ordervalue, pincode
        } = props;

        const orderdetails = await global.dbConnection('orders')
            .select('shippingmode')
            .where({ orderid: orderid })
            .first();

        const response = await global.dbConnection('tenants')
            .select('wallet')
            .where({ tenantid });

        const walletamount = response[0].wallet;
        const balance = walletamount - (_.toNumber(totalamount));
        console.log("balance", balance);

        const updateBalance = await global.dbConnection('tenants')
            .update({ wallet: balance })
            .where({ tenantid });
        console.log("updateBalance", updateBalance);

        const paymentlog = await global.dbConnection('paymentlogs')
            .insert({
                tenantid: tenantid,
                orderid: orderid,
                amount_debited: totalamount,
                balance: balance
            });
        console.log("paymentlog", paymentlog);

        const orderupdate = await global.dbConnection('orders')
            .update({
                'ordervalue': ordervalue,
                'orderstatus': 'live'
            })
            .where({ orderheaderid: orderheaderId });

        const orderdetailsUpdate = await global.dbConnection('orderdetails')
            .update({
                'total': totalamount,
                'itemstatus': 'live'
            })
            .where({ orderheaderid: orderheaderId });

        const orderItemsUpdate = await global.dbConnection('ordered_items')
            .update({
                'status': 'live'
            })
            .where({ orderheaderid: orderheaderId });

        // Always get order products
        const orderProducts = await cartService?.getOrderDetailsById(orderheaderId);

        // Delivery update only if not shippingmode 3
        let deliveryCharge = 0;
        if (orderdetails?.shippingmode !== 3) {
            await global.dbConnection('deliveries')
                .update({
                    'customername': customer_name,
                    'email': email,
                    'contactno': mobile,
                    'deliveryaddress': shipping_address,
                    'state': state,
                    'city': city
                })
                .where({ orderheaderid: orderheaderId });

            deliveryCharge = orderProducts[0]?.deliverycharge || 0;
        }

        const orderDetails = {
            customerDetails: {
                name: customer_name,
                address: shipping_address,
                email: email,
                number: mobile,
                pincode: pincode
            },
            products: orderProducts?.map((val) => {
                return {
                    sku: val?.productsku,
                    code: '611300',
                    quantity: val?.quantity,
                    productPrice: val?.productcost,
                    cgst: (Number(Math.round(val?.productcost * val?.quantity)) * 2.5) / 100,
                    sgst: (Number(Math.round(val?.productcost * val?.quantity)) * 2.5) / 100,
                    handling: val?.charges,
                    total: Number(Math.round(val?.total))
                };
            }),
            total: totalamount,
        };

        const intermediateEmail = await global.dbConnection('tenants')
            .leftJoin('app_users', 'app_users.userid', 'tenants.user_id')
            .select('app_users.email')
            .where('tenants.tenantid', tenantid)
            .first();

        // send invoice
        const sendInvoice = await processInvoice(orderDetails, deliveryCharge);

        const insertUserInvoice = await global.dbConnection('tenantinvoice')
            .insert({
                orderheaderid: orderheaderId,
                tenantid: tenantid,
                totalamount: totalamount,
                invoiceurl: sendInvoice,
                status: 'paid',
                invoicestatus: 'Active'
            });

        const sendMail = await orderMailForClient(orderDetails, sendInvoice, intermediateEmail?.email);

        return 1;
    } catch (err) {
        console.log("error", err);
    }
    return null;
}

// Store Order Move to Live Service Function
module.exports.storeOrderMoveLive = async (orderId, userId) => {
    try {

        // Get store order details
        const storeOrder = await global.dbConnection('woocommerce_orders')
            .leftJoin('woocommerce_order_items', 'woocommerce_order_items.order_id', 'woocommerce_orders.id')
            .leftJoin('shopify_products', 'woocommerce_order_items.order_id', 'woocommerce_orders.id')
            .select('*')
            .where({ id: orderId })
            .first();

        if (!storeOrder) {
            console.log("Store order not found:", orderId);
            return {
                success: false,
                message: 'Store order not found',
                data: { orderId }
            };
        }

        // Get vendor/tenant details
        const tenantResponse = await global.dbConnection('tenants')
            .select('wallet', 'tenantid')
            .where({ user_id: userId })
            .first();

        if (!tenantResponse) {
            console.log("Tenant not found for vendor_id:", userId);
            return {
                success: false,
                message: 'Tenant not found for this vendor',
                data: { orderId, vendorId: userId }
            };
        }

        const walletamount = tenantResponse.wallet;
        const totalAmount = _.toNumber(storeOrder.total);
        const balance = walletamount - totalAmount;

        console.log("Store order balance check:", {
            orderId,
            vendorId: userId,
            currentWallet: walletamount,
            totalAmount: totalAmount,
            balance
        });

        // Check if balance is sufficient
        if (balance < 0) {
            console.log("Insufficient balance for store order:", orderId);
            console.log("Insufficient balance for store order:", {
                orderId,
                vendorId: userId,
                currentWallet: walletamount,
                totalAmount: totalAmount,
                balance,
                shortfall: Math.abs(balance)
            });

            return {
                success: false,
                message: 'Insufficient wallet balance for store order',
                insufficientBalance: true,
                validationDetails: {
                    currentWallet: walletamount,
                    requiredAmount: totalAmount,
                    shortfall: Math.abs(balance),
                    canProceed: false
                },
                data: {
                    orderId,
                    vendorId: userId,
                    currentWallet: walletamount,
                    totalAmount: totalAmount,
                    balance
                }
            };
        }

        // Update wallet balance
        const updateBalance = await global.dbConnection('tenants')
            .update({ wallet: balance })
            .where({ tenantid: tenantResponse.tenantid });

        console.log("Store order wallet updated:", updateBalance);

        // Create payment log
        const paymentlog = await global.dbConnection('paymentlogs')
            .insert({
                tenantid: tenantResponse.tenantid,
                orderid: orderId,
                amount_debited: totalAmount,
                balance: balance
            });

        console.log("Store order payment log created:", paymentlog);

        // Update store order status to 'live'
        const orderUpdate = await global.dbConnection('woocommerce_orders')
            .update({
                'total': totalAmount,
                'status': 'live'
            })
            .where({ id: orderId });

        console.log("Store order updated to live:", orderUpdate);

        // Update store order items status to 'live'
        const orderItemsUpdate = await global.dbConnection('woocommerce_order_items')
            .update({
                'status': 'live'
            })
            .where({ order_id: orderId });

        console.log("Store order items updated to live:", orderItemsUpdate);

        // Get order products for invoice generation
        const orderProducts = await global.dbConnection('woocommerce_order_items')
            .leftJoin('products as p', function () {
                this.on(
                    global.dbConnection.raw("JSON_EXTRACT(woocommerce_order_items.meta_data, '$.deeprintzProductId')"),
                    '=',
                    'p.productid'
                );
            })
            .where('woocommerce_order_items.order_id', orderId)
            .select(
                'woocommerce_order_items.*',
                'p.productid',
                'p.productname'
            );

        // Prepare order details for invoice
        const orderDetails = {
            customerDetails: {
                name: storeOrder.customer_name || 'N/A',
                address: storeOrder.shipping_address || 'N/A',
                email: storeOrder.customer_email || 'N/A',
                number: storeOrder.customer_phone || 'N/A',
                pincode: storeOrder.shipping_postcode || 'N/A'
            },
            products: orderProducts?.map((val) => {
                const metaData = val.meta_data ? JSON.parse(val.meta_data) : {};
                return {
                    sku: val.sku || metaData.deeprintzProductId,
                    code: '611300',
                    quantity: val.quantity,
                    productPrice: val.price,
                    cgst: (Number(Math.round(val.price * val.quantity)) * 2.5) / 100,
                    sgst: (Number(Math.round(val.price * val.quantity)) * 2.5) / 100,
                    handling: 0, // Store orders might not have handling charges
                    total: Number(Math.round(val.total))
                };
            }),
            total: totalAmount,
        };

        // Get tenant email for invoice
        const intermediateEmail = await global.dbConnection('tenants')
            .leftJoin('app_users', 'app_users.userid', 'tenants.user_id')
            .select('app_users.email')
            .where('tenants.tenantid', tenantResponse.tenantid)
            .first();

        // Generate and send invoice
        const sendInvoice = await processInvoice(orderDetails, 0); // No delivery charge for store orders

        const insertUserInvoice = await global.dbConnection('tenantinvoice')
            .insert({
                orderheaderid: orderId,
                tenantid: tenantResponse.tenantid,
                totalamount: totalAmount,
                invoiceurl: sendInvoice,
                status: 'paid',
                invoicestatus: 'Active'
            });

        // Send email to client
        const sendMail = await orderMailForClient(orderDetails, sendInvoice, intermediateEmail?.email);

        console.log("Store order moved to live successfully:", orderId);
        return {
            success: true,
            message: 'Store order moved to live successfully',
            insufficientBalance: false,
            validationDetails: {
                currentWallet: walletamount,
                requiredAmount: totalAmount,
                remainingBalance: balance,
                canProceed: true
            },
            data: {
                orderId,
                vendorId: userId,
                totalAmount: totalAmount,
                finalBalance: balance,
                orderStatus: 'live',
                invoiceGenerated: !!sendInvoice,
                emailSent: !!sendMail
            }
        };
    } catch (err) {
        console.log("error in storeOrderMoveLive:", err);
        return {
            success: false,
            message: 'Internal server error in storeOrderMoveLive',
            error: err.message,
            data: { orderId, vendorId: userId }
        };
    }
}

module.exports.getOrdersbyCustomerId = async (props) => {
    const { customerId } = props
    try {
        const response = await global.dbConnection('orders').join('orderdetails', 'orders.orderid', 'orderdetails.orderid').
            select('*').where('orders.customerid', customerId)

        return !_.isEmpty(response) ? response : null
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getOrderDetails = async (props) => {

    const { orderheaderid, orderid } = props

    try {
        console.log((orderheaderid ? orderheaderid : 0),
            (orderid ? orderid : 0))

        const order = await global.dbConnection('orders')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .select(
                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'orders.shippingmode as ordershippingmode',
                'tenantinvoice.invoiceurl as clientinvoice'
            )
            .orWhere('orders.orderheaderid', orderheaderid ? orderheaderid : null)
            .orWhere('orders.orderid', orderid ? orderid : null)
            .groupBy('orders.orderheaderid')

        const products = await global.dbConnection('orderdetails')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('productvariants', 'productvariants.variantid', 'tenantproducts.variantid')
            .select(
                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',
                'productvariants.weight',
            )
            .where('orderdetails.orderheaderid', order[0].orderheaderid).groupBy('tenantproducts.tenantproductid')

        await Promise.all(products.map(async product => {
            const specs = await global.dbConnection('tenantproductspecs').
                leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
                .select(
                    'tenantproductspecs.specid',
                    'tenantproductspecs.placementid',
                    'app_types.typename',
                    'tenantproductspecs.width',
                    'tenantproductspecs.height',
                    'tenantproductspecs.design_name',
                    'tenantproductspecs.imageurl',
                    'tenantproductspecs.designurl',
                    'tenantproductspecs.hpsvalue'
                ).where('tenantproductspecs.tenantproductid', product.tenantproductid)

            product.specs = specs

        }))
        console.log("orderheaderid", order[0].orderheaderid)
        const deliverydetails = await global.dbConnection('deliveries')
            //.leftJoin('partnerinfo','partnerinfo.partnerid','deliveries.courierid')
            //.leftJoin('orders','orders.orderheaderid','deliveries.orderheaderid')
            .select(
                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                //'partnerinfo.companyname',
                //'orders.deliverycharge'
            ).where('deliveries.orderheaderid', order[0].orderheaderid)
            .groupBy('deliveries.orderheaderid')


        const result = { order: order[0], products, deliverydetails }
        return !_.isEmpty(result) ? result : null
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getOrdersCount = async (props) => {
    const { tenantid, from, to, status, all, orderStatus } = props
    try {
        switch (all) {
            case 0:
                const Allorders1 = await global.dbConnection('orders')
                    .count('* as count')



                const onhold1 = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'onhold')
                    .count('* as count')

                const live1 = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'live')
                    .count('* as count')

                const returned1 = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'returned')
                    .count('* as count')


                const orderscount1 = {
                    allorders: Allorders1[0].count,
                    onhold: onhold1[0].count,
                    live: live1[0].count,
                    returned: returned1[0].count,
                }

                return !_.isEmpty(orderscount1) ? orderscount1 : null

            default:

                const Allorders = await global.dbConnection('orders')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')



                const onhold = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'onhold')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const live = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'live')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const returned = await global.dbConnection('orders')
                    .andWhere('orderstatus', 'returned')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const orderscount = {
                    allorders: Allorders[0].count,
                    onhold: onhold[0].count,
                    live: live[0].count,
                    returned: returned[0].count,
                }
                return !_.isEmpty(orderscount) ? orderscount : null
        }

    } catch (err) {
        console.log("error", err)
    }
    return null
}
module.exports.getOrdersCountByTenantId = async (props) => {
    const { tenantid, from, to, status, all } = props
    try {
        switch (all) {
            case 0:
                const Allorders1 = await global.dbConnection('orders')
                    .where('tenantid', tenantid)
                    .count('* as count')



                const onhold1 = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid).andWhere('orderstatus', 'onhold')
                    .count('* as count')

                const live1 = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid)
                    .andWhere('orderstatus', 'live')
                    .count('* as count')

                const returned1 = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid)
                    .andWhere('orderstatus', 'returned')
                    .count('* as count')


                const orderscount1 = {
                    allorders: Allorders1[0].count,
                    onhold: onhold1[0].count,
                    live: live1[0].count,
                    returned: returned1[0].count,
                }

                return !_.isEmpty(orderscount1) ? orderscount1 : null

            default:

                const Allorders = await global.dbConnection('orders')
                    .where('tenantid', tenantid)
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')



                const onhold = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid).andWhere('orderstatus', 'onhold')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const live = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid)
                    .andWhere('orderstatus', 'live')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const returned = await global.dbConnection('orders')
                    .andWhere('tenantid', tenantid)
                    .andWhere('orderstatus', 'returned')
                    .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                    .count('* as count')

                const orderscount = {
                    allorders: Allorders[0].count,
                    onhold: onhold[0].count,
                    live: live[0].count,
                    returned: returned[0].count,
                }
                return !_.isEmpty(orderscount) ? orderscount : null
        }

    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getAllOrders = async (props) => {
    const { status, offset, limit, from, to, all } = props

    try {
        switch (status) {
            case 1:

                if (all == 0) {
                    const orderdetail1 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        ).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                        .orderByRaw(`CASE WHEN orders.orderstatus = 'live' THEN 0 ELSE 1 END, orders.orderdate ASC`);

                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }
                else {
                    const orderdetail1 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }

            case 2:
                if (all == 0) {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'onhold').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                } else {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'onhold')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                }
            case 3:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'live').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'live')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 4:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'returned').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'returned')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 5:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Picklist Generated').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Picklist Generated')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }

            case 6:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Printed').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Printed')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }


            case 7:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'QC').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'QC')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }


            case 8:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Dispatched').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Dispatched')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 9:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Delivered').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Delivered')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 10:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Out-Of-Stock').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail3)
                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Out-Of-Stock')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 11:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'To be Printed').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail3)
                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'To be Printed')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 12:
                if (all == 0) {
                    const orderdetail4 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Label generated').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail4)
                    return !_.isEmpty(orderdetail4) ? orderdetail4 : null
                } else {
                    const orderdetail4 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Label generated')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail4) ? orderdetail4 : null
                }

            default:
                return null
        }
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getOrdersCountByStatus = async (props) => {
    const { orderStatus, from, to, all } = props
    try {
        if (all == 0) {
            const count = await global.dbConnection('orders')
                .where('orderstatus', orderStatus)
                .count('* as count');
            return count[0].count;
        } else {
            const count = await global.dbConnection('orders')
                .where('orderstatus', orderStatus)
                .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                .count('* as count');
            return count[0].count;
        }
    } catch (err) {
        console.log("error", err)
    }
    return 0;
}

module.exports.getAllOrdersWithPagination = async (props) => {
    const { status, offset, limit, from, to, all, searchOrderId, orderStatus } = props

    // Helper function to add search filter to query
    const addSearchFilter = (query) => {
        if (searchOrderId) {
            query = query.where('orders.orderid', 'like', `%${searchOrderId}%`);
        }
        if (orderStatus) {
            query = query.where('orders.orderstatus', orderStatus);
        }
        return query;
    };

    try {
        switch (status) {
            case 1:
                if (all == 0) {
                    let query = global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        ).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                        .orderByRaw(`CASE WHEN orders.orderstatus = 'live' THEN 0 ELSE 1 END, orders.orderdate ASC`);

                    const orderdetail1 = await addSearchFilter(query);
                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }
                else {
                    let query = global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit);

                    const orderdetail1 = await addSearchFilter(query);
                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }

            case 2:
                if (all == 0) {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'onhold').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                } else {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'onhold')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                }
            case 3:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'live').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'live')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 4:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'returned').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'returned')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 5:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Picklist Generated').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Picklist Generated')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }

            case 6:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Printed').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Printed')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }


            case 7:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'QC').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'QC')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }


            case 8:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Dispatched').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Dispatched')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 9:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Delivered').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Delivered')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 10:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Out-Of-Stock').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail3)
                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Out-Of-Stock')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 11:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'To be Printed').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail3)
                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'To be Printed')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 12:
                if (all == 0) {
                    const orderdetail4 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Label generated').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)
                    console.log("orderdetails..", orderdetail4)
                    return !_.isEmpty(orderdetail4) ? orderdetail4 : null
                } else {
                    const orderdetail4 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
                        .select(
                            'orders.tenantid',
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                            'tenants.brandname'
                        )
                        .andWhere('orders.orderstatus', 'Label generated')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to]).groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail4) ? orderdetail4 : null
                }

            default:
                return null
        }
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getAllOrdersByTenantId = async (props) => {
    const { tenantid, status, offset, limit, from, to, all } = props

    try {
        switch (status) {
            case 1:

                if (all == 0) {
                    const orderdetail1 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'orders.awb_code',
                            'deliveries.customername',
                            'deliveries.shippingmode',
                            'orders.shippingmode as ordershippingmode',
                            'orders.courier_name',
                            'tenantinvoice.invoiceurl'
                        )
                        .where('orders.tenantid', tenantid)
                        .groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit).orderBy('orders.created', 'desc')

                    console.log(`epic result - `, orderdetail1);


                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }
                else {
                    const orderdetail1 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).groupBy('orders.orderheaderid')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail1) ? orderdetail1 : null
                }

            case 2:
                if (all == 0) {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'onhold').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                } else {
                    const orderdetail2 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'onhold').groupBy('orders.orderheaderid')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail2) ? orderdetail2 : null
                }
            case 3:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'live').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'live').groupBy('orders.orderheaderid')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }
            case 4:
                if (all == 0) {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'returned').groupBy('orders.orderheaderid')
                        .offset(offset).limit(limit)

                    const returnsData = await global.dbConnection('returns')
                        .select()
                        .where('returns.tenantid', tenantid)

                    const finalData = {
                        orderedDetails: orderdetail3,
                        returnData: returnsData
                    }

                    return !_.isEmpty(finalData) ? finalData : null
                } else {
                    const orderdetail3 = await global.dbConnection('orders')
                        .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
                        .select(
                            'orders.orderheaderid',
                            'orders.orderid',
                            'orders.orderdate',
                            'orders.orderstatus',
                            'orders.paymenttype',
                            'deliveries.shippingmode',
                        )
                        .andWhere('orders.tenantid', tenantid).andWhere('orders.orderstatus', 'returned').groupBy('orders.orderheaderid')
                        .whereBetween(global.dbConnection.raw('DATE(orders.orderdate)'), [from, to])
                        .offset(offset).limit(limit)

                    return !_.isEmpty(orderdetail3) ? orderdetail3 : null
                }

            default:
                return null
        }
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.deleteOrder = async (props) => {
    const { orderheaderid } = props
    try {
        const knex = global.dbConnection
        const trx = await knex.transaction()

        const response = await trx('orders').del().where({ orderheaderid })
        console.log(response)
        if (response >= 1) {
            const response2 = await trx('orderdetails').del().where({ orderheaderid })
            console.log(response2)
            if (response2 >= 1) {
                await trx.commit()
                return response2
            }
        }

        await trx.rollback();
        return null
    } catch (error) {
        console.log("error", error)
    }
}

module.exports.getQuantity = async (props) => {
    const { tenantproductid } = props
    try {
        const quantity = await global.dbConnection('tenantproducts')
            .leftJoin('productvariants', 'productvariants.variantid', 'tenantproducts.variantid')
            .select('productvariants.quantity')
            .where({ tenantproductid })
        return !_.isEmpty(quantity) ? quantity[0].quantity : null
    }
    catch (error) {
        console.log("error", error)
    }
    return null
}

module.exports.reduceStock = async (orderProducts) => {

    try {

        const knex = global.dbConnection
        const trx = await knex.transaction()

        const result = await Promise.all(orderProducts.map(async (item) => {
            const quantity = await knex('tenantproducts')
                .leftJoin('productvariants', 'productvariants.variantid', 'tenantproducts.variantid')
                .select(
                    'productvariants.quantity',
                    'tenantproducts.variantid'
                )
                .where({ tenantproductid: item.tenantproductid })

            // Check if quantity data exists
            if (!quantity || quantity.length === 0 || !quantity[0]) {
                console.log(`No quantity data found for tenantproductid: ${item.tenantproductid}`)
                return { orderdetailid: item.orderdetailid, stock: false }
            }

            // Check if quantity field exists and is not null
            if (!quantity[0].quantity || quantity[0].quantity === null) {
                console.log(`No quantity value found for tenantproductid: ${item.tenantproductid}`)
                return { orderdetailid: item.orderdetailid, stock: false }
            }

            const balance = quantity[0].quantity - item.quantity

            console.log("balance", balance)

            const updatestock = await knex('productvariants')
                .update({ quantity: balance })
                .where({ variantid: quantity[0].variantid })

            const updatestockLog = await knex('stocklogs')
                .where({ variantid: quantity[0].variantid })
                .orderBy('created', 'asc') // Assuming 'created_at' determines the oldest row
                .limit(1) // Select only the oldest row
                .decrement('quantity', item.quantity); // Decrease quantity

            return balance <= 0 ?
                { orderdetailid: item.orderdetailid, stock: false }
                : { orderdetailid: item.orderdetailid, stock: true }
        }))



        return !_.isEmpty(result) ? result : null

    }
    catch (error) {
        console.log("error", error)
    }
    return null
}

module.exports.walletCheck = async (props) => {
    const { tenantid, totalamount, status } = props
    try {
        if (status == 1) {
            return false
        } else {
            const response = await global.dbConnection('tenants')
                .select('wallet').where({ tenantid })
            const balance = response[0].wallet

            console.log("balance", balance >= _.toNumber(totalamount))

            return (balance >= _.toNumber(totalamount)) ? false : true
        }
    } catch (error) {
        console.log("error", error)
    }
    return false;
}

module.exports.referencecheck = async (props) => {
    const { referenceno } = props;


}

module.exports.addOrderLog = async (props1, props2, props3) => {
    const { userid, orderheaderid, comments, logdate, orderdetailid } = props1
    const { orderstatus } = props2
    const { itemstatus } = props3
    try {

        const response = await global.dbConnection('orderslog')
            .insert(
                {
                    userid,
                    orderheaderid,
                    comments,
                    logdate,
                    orderstatus,
                    orderdetailid: orderdetailid ? orderdetailid : 0,
                    itemstatus: itemstatus ? itemstatus : orderstatus
                })

        console.log("add order log", response)
        return !_.isEmpty(response) ? true : false
    } catch (err) {
        console.log("error", err)
    }
}

module.exports.updateOrderStatus = async (props) => {
    const { orders, status, available, occupied } = props
    try {
        switch (status) {
            case 5:
                // [{
                //     orderheaderid,
                //     logdate,
                //     status,
                //     comments,
                //     logdate,
                //     userid
                // }]
                // picklist
                const response = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'Picklist Generated', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })

                    const response2 = await global.dbConnection('orderdetails').update({ itemstatus: 'Picklist Generated' })
                        .where({ orderheaderid: item.orderheaderid })

                    const response3 = await global.dbConnection('ordered_items').update({ status: 'Picklist Generated' })
                        .where({ orderheaderid: item.orderheaderid })

                    if (response && response2 > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Picklist Generated" }, { itemstatus: "Picklist Generated" })
                        return { response, orderlog }

                    }
                    return []
                }))
                const updateRack = await global.dbConnection('rack').update({ available, occupied }).where({ id: 1 })
                console.log("updateRack.", updateRack)
                const result = [response, 'Picklist Generated']

                return !_.isEmpty(result[0][0]) ? result : null

            case 6:
                // printing
                const response1 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'Printed', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })
                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Printed" })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result1 = [response1, 'Printed']

                return !_.isEmpty(result1[0][0]) ? result1 : null
            case 7:
                // qualitycheck
                const response2 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'QC', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })
                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "QC" })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result2 = [response2, 'QC']
                return !_.isEmpty(result2[0][0]) ? result2 : null

            case 8:
                // dispatch
                const response3 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'Dispatched', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })
                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Dispatched" })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result3 = [response3, 'Dispatched']
                return !_.isEmpty(result3[0][0]) ? result3 : null
            case 9:
                // delivered
                const response4 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'Delivered', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })
                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Delivered" })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result4 = [response4, 'Delivered']
                return !_.isEmpty(result4[0][0]) ? result4 : null

            case 10:
                // to be printed
                const response5 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orders')
                        .update({ orderstatus: 'To be Printed', picklist: item.logdate })
                        .where({ orderheaderid: item.orderheaderid })
                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "To be Printed" })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result5 = [response5, 'To be Printed']
                return !_.isEmpty(result5[0][0]) ? result5 : null
        }

    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getOrderLogs = async (props) => {
    const { orderheaderid } = props
    try {
        const response = await global.dbConnection('orderslog')
            .leftJoin('app_users', 'app_users.userid', 'orderslog.userid')
            .leftJoin('orders', 'orders.orderheaderid', 'orderslog.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'orderslog.orderdetailid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orderslog.orderheaderid')
            .leftJoin('partnerinfo', 'partnerinfo.partnerid', 'deliveries.courierid')
            .select(
                'orderslog.logid',
                'orderslog.userid',
                'app_users.authname',
                'orderslog.orderheaderid',
                'orderslog.orderdetailid',
                'tenantproducts.productsku',
                'orderslog.comments',
                'orderslog.logdate',
                'orderslog.orderstatus',
                'orders.totalamount',
                'orders.ordervalue',
                'deliveries.customername',
                'deliveries.courierid',
                'partnerinfo.companyname',
                'deliveries.pincode',
                'deliveries.contactno',
                'deliveries.email',
                'deliveries.deliveryaddress',
                'deliveries.state',
                'deliveries.city',
                'deliveries.shippingmode',
            ).where('orderslog.orderheaderid', orderheaderid)
        // .groupBy('orderheaderid')


        const groupedResponse = response.reduce((acc, item) => {
            const productsku = item.productsku;
            if (productsku) {
                if (!acc[productsku]) {
                    acc[productsku] = [];
                }
                acc[productsku].push(item);
            }
            return acc;
        }, {});

        return !_.isEmpty(groupedResponse) ? groupedResponse : null
    } catch (error) {
        console.log("error", error)
    }
    return null
}

module.exports.updateOrderProductStatus = async (props) => {
    const { orders, status, available, occupied } = props
    try {

        const knex = global.dbConnection
        const trx = await knex.transaction()

        switch (status) {
            // products :[
            //   available:
            //   occupied:
            //   available:
            //]
            case 3:
                //
                const liveResponse = await Promise.all(orders.map(async (item) => {

                    const liveResponse = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'live', picklist: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (liveResponse > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "live" }, { itemstatus: 'live' })
                        return { liveResponse, orderlog }

                    }
                    return []
                }))



                const liveResult = [liveResponse, 'live']
                return !_.isEmpty(liveResult[0][0]) ? liveResult : null
            case 4:
                //Out-Of-Stock
                const outOfStockResponse = await Promise.all(orders.map(async (item) => {

                    const outOfStockResponse = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Out-of-Stock', picklist: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (outOfStockResponse > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Out-of-Stock" }, { itemstatus: 'Out-of-Stock' })
                        return { outOfStockResponse, orderlog }

                    }
                    return []
                }))

                const outOfStockResult = [outOfStockResponse, 'Out-of-Stock']
                console.log("response..", outOfStockResult)
                return !_.isEmpty(outOfStockResult[0][0]) ? outOfStockResponse : null

            case 5:
                //picklist
                const response = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Picklist Generated', picklist: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const orderlog = await this.addOrderLog(item, { orderstatus: "Picklist Generated" }, { itemstatus: 'Picklist Generated' })
                        return { response, orderlog }

                    }
                    return []
                }))

                const result = [response, 'Picklist Generated']

                return !_.isEmpty(result[0][0]) ? result : null

            case 6:
                // printing

                const response1 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Printed', printing: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {

                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const allPrinted = _.every(status, { itemstatus: 'Printed' });

                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allPrinted ? 'Printed' : 'To be Printed' })
                            .where({ orderheaderid: item.orderheaderid })

                        const orderlog = await this.addOrderLog(item, { orderstatus: allPrinted ? 'Printed' : 'To be Printed' }, { itemstatus: 'Printed' })
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))

                const result1 = [response1, 'Printed']

                return !_.isEmpty(result1[0][0]) ? result1 : null

            case 7: // qualitycheck
                const response2 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'QC', qualitycheck: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const orderstatus = await global.dbConnection('orders').select('orderstatus').where({ orderheaderid: item.orderheaderid })

                        const allQC = _.every(status, { itemstatus: 'QC' });
                        console.log("orderstatus..", orderstatus)
                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allQC ? 'QC' : orderstatus[0].orderstatus }).where({ orderheaderid: item.orderheaderid })

                        console.log("updateOrder..", updateOrder, item.orderheaderid)

                        const orderlog = await this.addOrderLog(item, { orderstatus: allQC ? 'QC' : orderstatus[0].orderstatus }, { itemstatus: 'QC' })
                        //   console.log("orderstatus..", allQC ? 'QC' : orderstatus[0].orderstatus)
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))
                const result2 = [response2, 'QC']
                return !_.isEmpty(result2[0][0]) ? result2 : null

            case 8:
                // dispatch
                const response3 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Dispatched', dispatch: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const orderstatus = await global.dbConnection('orders').select('orderstatus').where({ orderheaderid: item.orderheaderid })
                        const allDispatched = _.every(status, { itemstatus: 'Dispatched' });

                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allDispatched ? 'Dispatched' : orderstatus[0].orderstatus })
                            .where({ orderheaderid: item.orderheaderid })

                        const orderlog = await this.addOrderLog(item,
                            { orderstatus: allDispatched ? 'Dispatched' : orderstatus[0].orderstatus },
                            { itemstatus: 'Dispatched' }
                        )
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))

                const result3 = [response3, 'Dispatched']
                return !_.isEmpty(result3[0][0]) ? result3 : null


            case 9:
                // delivered
                const response4 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Delivered', delivered: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const orderstatus = await global.dbConnection('orders').select('orderstatus').where({ orderheaderid: item.orderheaderid })
                        const allDelivered = _.every(status, { itemstatus: 'Delivered' });

                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allDelivered ? 'Delivered' : orderstatus[0].orderstatus })
                            .where({ orderheaderid: item.orderheaderid })

                        const orderlog = await this.addOrderLog(item,
                            { orderstatus: allDelivered ? 'Delivered' : orderstatus[0].orderstatus },
                            { itemstatus: 'Delivered' }
                        )
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))

                const result4 = [response4, 'Delivered']
                return !_.isEmpty(result4[0][0]) ? result4 : null
            case 10:
                // To be Printed
                const response5 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'To be Printed', tobeprinted: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const orderstatus = await global.dbConnection('orders').select('orderstatus').where({ orderheaderid: item.orderheaderid })
                        const allDelivered = _.every(status, { itemstatus: 'To be Printed' });

                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allDelivered ? 'To be Printed' : orderstatus[0].orderstatus })
                            .where({ orderheaderid: item.orderheaderid })

                        const orderlog = await this.addOrderLog(item,
                            { orderstatus: allDelivered ? 'To be Printed' : orderstatus[0].orderstatus },
                            { itemstatus: 'To be Printed' }
                        )
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))

                const result5 = [response5, 'To be Printed']
                return !_.isEmpty(result5[0][0]) ? result5 : null
            case 11:
                // Label generation
                const response6 = await Promise.all(orders.map(async (item) => {

                    const response = await global.dbConnection('orderdetails')
                        .update({ itemstatus: 'Label generated', labelgenerated: item.logdate })
                        .where({ orderdetailid: item.orderdetailid })

                    if (response > 0) {
                        const status = await global.dbConnection('orderdetails').select('itemstatus').where({ orderheaderid: item.orderheaderid })
                        const orderstatus = await global.dbConnection('orders').select('orderstatus').where({ orderheaderid: item.orderheaderid })
                        const allDelivered = _.every(status, { itemstatus: 'Label generated' });

                        const updateOrder = await global.dbConnection('orders')
                            .update({ orderstatus: allDelivered ? 'Label generated' : orderstatus[0].orderstatus })
                            .where({ orderheaderid: item.orderheaderid })

                        const orderlog = await this.addOrderLog(item,
                            { orderstatus: allDelivered ? 'Label generated' : orderstatus[0].orderstatus },
                            { itemstatus: 'Label generated' }
                        )
                        return {
                            response,
                            orderlog
                        }
                    }
                    return []
                }))

                const result6 = [response6, 'Label generated']
                return !_.isEmpty(result6[0][0]) ? result6 : null
        }
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.chats = async (props) => {
    const { tenantid, orderheaderid, orderdetailid, comments, usertype, adminid, msgid, mode } = props
    try {
        switch (mode) {
            // 1 - send msg
            // 2 - reply to msg
            case 1:
                const response = await global.dbConnection('chats')
                    .insert(
                        {
                            orderheaderid,
                            orderdetailid,
                            comments,
                            usertype,
                            adminid,
                            tenantid
                        }
                    )
                return !_.isEmpty(response) ? response : null
            case 2:
                const response1 = await global.dbConnection('chats')
                    .insert(
                        {
                            orderheaderid,
                            orderdetailid,
                            comments,
                            usertype,
                            adminid,
                            tenantid,
                            msgid
                        }
                    )
                return !_.isEmpty(response1) ? response1 : null
        }
    } catch (error) {
        console.log("error", error)
    }
    return null
}

module.exports.getChatsByOrderheaderid = async (props) => {
    const { orderheaderid } = props
    try {

        const messages = await global.dbConnection("chats")
            .leftJoin('orders', 'orders.orderheaderid', 'chats.orderheaderid')
            .select(
                'chats.chatid',
                'chats.orderheaderid',
                'chats.orderdetailid',
                'chats.comments',
                'chats.usertype',
                'chats.msgid',
                'chats.created',
                'orders.orderid'
            )
            .where('chats.orderheaderid', orderheaderid)
            .orderBy('chats.created', 'asc');

        const questions = [];
        const replies = {};
        if (!_.isEmpty(messages)) {
            //console.log("jii")
            messages.forEach(message => {
                if (message.msgid === null) {
                    // This is a question
                    questions.push({
                        ...message,
                        replies: []
                    });
                } else {
                    // This is a reply
                    if (!replies.hasOwnProperty(message.msgid)) {
                        replies[message.msgid] = [];
                    }
                    replies[message.msgid].push(message);
                }
            });
        }


        // Attach replies to corresponding questions
        if (!_.isEmpty(questions)) {
            questions.forEach(question => {
                if (replies.hasOwnProperty(question.chatid)) {
                    question.replies = replies[question.chatid];
                }
            });
        }


        //console.log(questions);

        // const response = await global.dbConnection("chats")
        // .leftJoin('orders','orders.orderheaderid','chats.orderheaderid')
        // .leftJoin('chats as replies', function() {
        //     this.on('replies.msgid', '=', 'chats.chatid')
        // })
        // .select(
        //     'chats.chatid',
        //     'chats.orderheaderid',
        //     'chats.orderdetailid',
        //     'chats.comments',
        //     'chats.usertype',
        //     'chats.msgid',
        //     'chats.created as message_created',
        //     'orders.orderid'
        //     )
        // .select('orderid')        
        // .where('chats.orderheaderid',orderheaderid);


        // const msgIds = response.map(message => message.chatid);

        // const replies = await global.dbConnection("chats")
        //     .select(
        //         'chats.msgid',
        //         'chats.chatid',
        //         'chats.comments',
        //         'chats.usertype',
        //         'chats.created'
        //     )
        //     .whereIn('chats.msgid', msgIds);         

        //     const messagesWithReplies = response.map(message => {
        //         const messageReplies = replies.filter(reply => reply.msgid === message.chatid);
        //         return {
        //             ...message,
        //             replies: messageReplies
        //         };
        //     });

        //     const replyChatIds = replies.map(reply => reply.chatid);

        //     // Filter messagesWithReplies to remove messages with chatids present in replies
        //     const filteredMessages = messagesWithReplies.filter(message => !replyChatIds.includes(message.chatid));

        //console.log(response);
        return !_.isEmpty(questions) ? questions : null

    } catch (error) {
        console.log("error", error)
    }
    return null
}
module.exports.getAllChats = async (props) => {
    const { tenantid } = props
    try {

        const response = await global.dbConnection("chats")
            .leftJoin('orders', 'orders.orderheaderid', 'chats.orderheaderid')
            .select(
                'chatid',
                'chats.orderheaderid',
                'orderdetailid',
                'comments',
                'usertype',
                'msgid',
                'chats.created',
                'orders.orderid'
            )
            .select('orderid')
            .groupBy('chats.orderheaderid')
            .where('chats.tenantid', tenantid)

        return !_.isEmpty(response) ? response : null

    } catch (error) {
        console.log("error", error)
    }
    return null
}

module.exports.updateShipmentData = async (props) => {
    try {
        const { shipment_order_id, shipment_id, shiprocket_status, awb_code, courier_company_id, courier_name, manifest_url, invoice_url, label_url, order_id } = props;
        const updates = {};

        if (!_.isEmpty(shipment_order_id)) {
            updates.shipment_order_id = shipment_order_id;
        }

        if (!_.isEmpty(shipment_id)) {
            updates.shipment_id = shipment_id;
        }

        if (!_.isEmpty(shiprocket_status)) {
            updates.shiprocket_status = shiprocket_status;
        }

        if (!_.isEmpty(awb_code)) {
            updates.awb_code = awb_code;
        }

        if (!_.isEmpty(courier_company_id)) {
            updates.courier_company_id = courier_company_id;
        }

        if (!_.isEmpty(courier_name)) {
            updates.courier_name = courier_name;
        }

        if (!_.isEmpty(manifest_url)) {
            updates.manifest_url = manifest_url;
        }

        if (!_.isEmpty(invoice_url)) {
            updates.invoice_url = invoice_url;
        }

        if (!_.isEmpty(label_url)) {
            updates.label_url = label_url;
        }

        //console.log(updates);

        const response = await global.dbConnection('orders')
            .update(updates)
            .where({ orderid: order_id });

        //console.log(response)

        return response > 0 ? response : 0;

        // return !_.isEmpty(response) ? response : []

    } catch (err) {
        console.log("error", err);
        return [];
    }
}

module.exports.getAdminMessages = async (props) => {
    try {
        const { adminid } = props;

        const response = await global.dbConnection("chats")
            .leftJoin('orders', 'orders.orderheaderid', 'chats.orderheaderid')
            .select(
                'chatid',
                'chats.orderheaderid',
                'orderdetailid',
                'comments',
                'usertype',
                'msgid',
                'chats.tenantid',
                'chats.created',
                'orders.orderid'
            )
            .groupBy('chats.orderheaderid')
            .where('chats.adminid', adminid)

        return !_.isEmpty(response) ? response : null

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getCouriers = async (props) => {
    try {
        const response = await global.dbConnection("orders")
            .select('courier_company_id', 'courier_name')
            .groupBy('courier_company_id').whereNotNull('courier_company_id');

        return !_.isEmpty(response) ? response : null

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getOrdersbycourier = async (props) => {
    try {
        const { courier_id } = props;

        const orderdetail4 = await global.dbConnection('orders')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .select(
                'orders.orderheaderid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                'deliveries.shippingmode',
            )
            .andWhere('orders.orderstatus', 'Label generated')
            .andWhere('orders.courier_company_id', courier_id)
            .groupBy('orders.orderheaderid')
        console.log("orderdetails..", orderdetail4)

        return !_.isEmpty(orderdetail4) ? orderdetail4 : null

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getOrderDetailsNew = async (props) => {
    const { orderheaderid } = props;

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .select(
                'ordered_items.uniqueitemid',
                'ordered_items.status as itemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename',
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode'
            )
            .where('ordered_items.orderheaderid', orderheaderid)
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getAllOrderDetailsNew = async (props) => {

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .select(
                'ordered_items.uniqueitemid',
                'ordered_items.status as itemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename',
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode'
            )
            //.where('orders.orderheaderid', orderheaderid)
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

// module.exports.getAllLiveOrderDetails = async () => {

//     try {
//         const orderdetail = await global.dbConnection('ordered_items')
//             .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
//             .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
//             .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
//             .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
//             .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
//             .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
//             .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'tenantproducts.tenantproductid')
//             .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
//             .select(
//                 'ordered_items.id',
//                 'ordered_items.uniqueitemid',
//                 'ordered_items.status as itemStatus',
//                 'ordered_items.picklist as itemPicklist',
//                 'ordered_items.tobeprinted as itemTobeprinted',
//                 'ordered_items.printing as itemPrinting',
//                 'ordered_items.qualitycheck as itemQualitycheck',
//                 'ordered_items.labelgenerated as itemLabelgenerated',
//                 'ordered_items.manifested as itemManifested',
//                 'ordered_items.confirmmanifested as confirmManifested',
//                 'ordered_items.dispatch as itemDispatch',
//                 'ordered_items.delivery as itemDelivery',
//                 'orders.orderdate',

//                 'tenantproducts.productsku',

//                 'tenantproductspecs.specid',
//                 'tenantproductspecs.placementid',
//                 'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
//                 'tenantproductspecs.width',
//                 'tenantproductspecs.height',
//                 'tenantproductspecs.design_name',
//                 'tenantproductspecs.imageurl',
//                 'tenantproductspecs.designurl'
//             )
//             .where('ordered_itemsstatus')
//             .groupBy('ordered_items.id'); // Group by unique identifier of ordered_items

//         return orderdetail;
//     } catch (err) {
//         console.error("Error fetching order details:", err);
//         throw err; // Propagate the error up to the caller for better error handling
//     }
// };

module.exports.getAllOrdersNew = async (props) => {

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            //.where('orders.orderheaderid', orderheaderid)
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getAllLiveOrderDetailsOld = async (props) => {

    try {

        // const result = await global.dbConnection("orders").where("orderstatus" , "live")
        // await Promise.all(result.map(async(res) => {
        //     var orderdetails = await global.dbConnection("orderdetails").where("orderheaderid" , res.orderheaderid)
        //     await Promise.all(orderdetails.map(async(details) => {
        //         var ordered_items = await global.dbConnection("ordered_items").where("orderdetailid" , details.orderdetailid)
        //                             .select('ordered_items.id as itemId',
        //                                     'ordered_items.uniqueitemid',
        //                                     'ordered_items.status as itemStatus',
        //                                     'ordered_items.picklist as itemPicklist',
        //                                     'ordered_items.tobeprinted as itemTobeprinted',
        //                                     'ordered_items.printing as itemPrinting',
        //                                     'ordered_items.qualitycheck as itemQualitycheck',
        //                                     'ordered_items.labelgenerated as itemLabelgenerated',
        //                                     'ordered_items.manifested as itemManifested',
        //                                     'ordered_items.confirmmanifested as confirmManifested',
        //                                     'ordered_items.dispatch as itemDispatch',
        //                                     'ordered_items.delivery as itemDelivery')


        //         var tenantproducts = await global.dbConnection("tenantproducts")
        //                             .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
        //                             .where("tenantproductid" , details.productid)
        //                             .select('tenantproducts.plain','tenantproducts.productsku')
        //         var tenantproductspecs = await global.dbConnection("tenantproductspecs").where("tenantproductid" , details.tenantproductid)
        //                                  .select('tenantproductspecs.width',
        //                                         'tenantproductspecs.height',
        //                                         'tenantproductspecs.design_name',
        //                                         'tenantproductspecs.imageurl',
        //                                         'tenantproductspecs.designurl',)
        //         details.items = ordered_items
        //         details.tenantproducts = tenantproducts
        //         details.tenantproductspecs = tenantproductspecs
        //     }))

        //     var productaddons = await global.dbConnection("productaddons")
        //                     .select('productaddons.*' , 
        //                         global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
        //                         global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'))
        //                     .join('orders', function() {
        //                         this.on(global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`), '>', 0);
        //                     })
        //                     .where("orders.orderheaderid", res.orderheaderid);
        //     var tenantinvoice = await global.dbConnection("tenantinvoice").where("orderheaderid" , res.orderheaderid).select('tenantinvoice.invoiceurl as clientinvoice')
        //     var deliveries = await global.dbConnection("deliveries").where("orderheaderid" , res.orderheaderid)
        //                      .select('deliveries.customername',
        //                             'deliveries.email',
        //                             'deliveries.contactno',
        //                             'deliveries.deliveryaddress',
        //                             'deliveries.shippingmode',
        //                             'deliveries.state',
        //                             'deliveries.city',
        //                             'deliveries.courierid',
        //                             'deliveries.pincode')
        //     var tenants = await global.dbConnection("tenants").where("tenantid" , res.tenantid).select('tenants.brandname')
        //     res.details = orderdetails
        //     res.productaddons=productaddons
        //     res.tenantinvoice = tenantinvoice
        //     res.deliveries = deliveries
        //     res.tenantbrandname = tenants[0].brandname           
        // }))
        // return result




        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'ordered_items.productid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as itemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('ordered_items.status', "live")
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getAllLiveOrderDetails = async () => {
    try {
        const itemsdata = []
        // Fetch ordered items along with necessary order and order details
        const orderedItems = await global.dbConnection("ordered_items")
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .whereNot('ordered_items.status', "Onhold")
            .where('ordered_items.status', "Live")
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.orderdetailid',
                'ordered_items.status as mainItemStatus',
                'orderdetails.tenantproductid',
                'orders.orderid',
                'orders.orderheaderid',
                'orders.orderdate'
            );


        await Promise.all(orderedItems.map(async (item) => {
            const tenantProduct = await global.dbConnection("tenantproducts")
                .where("tenantproductid", item.tenantproductid)
                .select("productsku", "plain")
                .first();
            if (tenantProduct) {
                if (tenantProduct.plain === "yes") {
                    // Handle plain t-shirt case
                    itemsdata.push({
                        orderId: item.orderid,
                        orderdetailid: item.orderdetailid,
                        orderheaderid: item.orderheaderid,
                        orderdate: item.orderdate,
                        uniqueitemid: item.uniqueitemid,
                        mainItemStatus: item.mainItemStatus,
                        width: null, // No dimensions for plain t-shirt
                        height: null,
                        design_name: null, // No design for plain t-shirt
                        imageurl: null,
                        designurl: null,
                        productsku: tenantProduct.productsku,
                        placement: "plain" // No specific placement
                    });
                } else {
                    const tenantProductSpecs = await global.dbConnection("tenantproductspecs")
                        .where("tenantproductid", item.tenantproductid)
                        .select('width', 'height', 'design_name', 'imageurl', 'designurl', 'placementid', 'hpsvalue');

                    await Promise.all(tenantProductSpecs.map(async (spec) => {
                        const placementType = await global.dbConnection("app_types")
                            .where("apptypeid", spec.placementid)
                            .select("typename")
                            .first();

                        itemsdata.push({
                            orderId: item.orderid,
                            orderdetailid: item.orderdetailid,
                            orderheaderid: item.orderheaderid,
                            orderdate: item.orderdate,
                            uniqueitemid: item.uniqueitemid,
                            mainItemStatus: item.mainItemStatus,
                            width: spec.width,
                            height: spec.height,
                            design_name: spec.design_name,
                            imageurl: spec.imageurl,
                            designurl: spec.designurl,
                            hpsvalue: spec.hpsvalue,
                            productsku: tenantProduct.productsku,
                            placement: placementType ? placementType.typename : null
                        });
                    }));
                }
            } else {
                console.warn(`No tenant product found for tenantproductid: ${item.tenantproductid}`);
            }
        }));

        return itemsdata;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderDetailsById = async (orderheaderid) => {

    try {

        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'orders.shippingmode as ordershippingmode',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('orders.orderheaderid', orderheaderid)
            // .groupBy('ordered_items.uniqueitemid')
            .groupBy(['ordered_items.uniqueitemid', 'tenantproductspecs.specid'])



        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderedItemDetailsById = async (itemId) => {

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('ordered_items.id', itemId)
            .first();
        //.groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.updateOrderItemStatus = async (formData) => {
    try {
        console.log("formData.itemId", formData.itemId)
        const knex = global.dbConnection;
        var item = await knex('ordered_items')
            .where('id', formData.itemId).first();

        if (item.status == "Live") {
            var updateStatus = await knex('ordered_items')
                .update({ status: "Picklist Generated" })
                .where('id', formData.itemId);
        }

        if (item.status == "Picklist Generated") {
            var updateStatus = await knex('ordered_items')
                .update({ status: "To Printed" })
                .where('id', formData.itemId);
        }


        if (updateStatus != 0) {
            return true;
        } else {
            return null;
        }
    } catch (err) {
        console.log("error", err);
        return null;
    }
};

module.exports.getAllPickListedOrderDetails = async (props) => {

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('ordered_items.status', "Picklist Generated")
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched


        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getAllTobePrintedOrderDetails = async (props) => {

    try {
        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('ordered_items.status', "To Printed")
            .groupBy('ordered_items.uniqueitemid');  // Grouping by unique identifier of ordered_items to ensure all rows are fetched

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderDetailsByOrderId = async (orderId) => {
    try {
        const orderdetail = await global.dbConnection('orders').select('orderheaderid', 'orderdate', 'orderid', 'shippingmode as ordershippingmode').where('orderid', orderId).first();
        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderDetailsByOrderHeaderId = async (orderheaderId) => {
    try {
        const orderdetail = await global.dbConnection('orders').select('orderheaderid', 'orderdate', 'orderid').where('orderheaderId', orderheaderId).first();
        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getPickedForToBePrinted = async (orderId) => {

    try {
        const order = await this.getOrderDetailsByOrderId(orderId);
        const orderHeaderId = order.orderheaderid;

        const orderdetail = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
            .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'ordered_items.productid')
            .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .select(
                'ordered_items.id as itemId',
                'ordered_items.uniqueitemid',
                'ordered_items.status as mainItemStatus',
                'ordered_items.picklist as itemPicklist',
                'ordered_items.tobeprinted as itemTobeprinted',
                'ordered_items.printing as itemPrinting',
                'ordered_items.qualitycheck as itemQualitycheck',
                'ordered_items.labelgenerated as itemLabelgenerated',
                'ordered_items.manifested as itemManifested',
                'ordered_items.confirmmanifested as confirmManifested',
                'ordered_items.dispatch as itemDispatch',
                'ordered_items.delivery as itemDelivery',

                'orders.orderheaderid',
                'orders.tenantid',
                'orders.orderid',
                'orders.orderdate',
                'orders.orderstatus',
                'orders.paymenttype',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
                'orders.ordervalue',
                'orders.totalamount',
                'orders.deliverycharge',
                'orders.ordernotes',
                'orders.custom_letter_img',
                'orders.shipment_order_id',
                'orders.shipment_id',
                'orders.shiprocket_status',
                'orders.awb_code',
                'orders.courier_company_id',
                'orders.courier_name',
                'orders.manifest_url',
                'orders.invoice_url',
                'orders.label_url',
                'tenantinvoice.invoiceurl as clientinvoice',

                'orderdetails.orderdetailid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.tenantproductid',
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
                global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
                'orderdetails.total',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orderdetails.itemstatus',
                'tenantproducts.plain',
                'tenantproducts.productsku',

                'tenantproductspecs.specid',
                'tenantproductspecs.placementid',
                'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
                'tenantproductspecs.width',
                'tenantproductspecs.height',
                'tenantproductspecs.design_name',
                'tenantproductspecs.imageurl',
                'tenantproductspecs.designurl',

                'deliveries.customername',
                'deliveries.email',
                'deliveries.contactno',
                'deliveries.deliveryaddress',
                'deliveries.shippingmode',
                'deliveries.state',
                'deliveries.city',
                'deliveries.courierid',
                'deliveries.pincode',
                'tenants.brandname'
            )
            .where('ordered_items.status', "Picklist Generated")
            .andWhere('ordered_items.orderheaderid', orderHeaderId)
            .groupBy('ordered_items.uniqueitemid');

        return orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.fetchOrdersForAllOrdersManageOld = async (orderId) => {

    try {
        const order = await this.getOrderDetailsByOrderId(orderId);
        const orderHeaderId = order.orderheaderid;


        const result = await global.dbConnection("orders").where("orderid", orderId)
        await Promise.all(result.map(async (res) => {
            var orderdetails = await global.dbConnection("orderdetails").where("orderheaderid", orderHeaderId)
            await Promise.all(orderdetails.map(async (details) => {
                var ordered_items = await global.dbConnection("ordered_items").where("orderdetailid", details.orderdetailid)
                    .select('ordered_items.id as itemId',
                        'ordered_items.uniqueitemid',
                        'ordered_items.status as mainItemStatus',
                        'ordered_items.picklist as itemPicklist',
                        'ordered_items.tobeprinted as itemTobeprinted',
                        'ordered_items.printing as itemPrinting',
                        'ordered_items.qualitycheck as itemQualitycheck',
                        'ordered_items.labelgenerated as itemLabelgenerated',
                        'ordered_items.manifested as itemManifested',
                        'ordered_items.confirmmanifested as confirmManifested',
                        'ordered_items.dispatch as itemDispatch',
                        'ordered_items.delivery as itemDelivery')
                    .where('ordered_items.orderheaderid', orderHeaderId)
                    .whereNot('ordered_items.status', "Onhold")
                    .whereNot('ordered_items.status', "Live")


                var tenantproducts = await global.dbConnection("tenantproducts")
                    .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
                    .where("tenantproductid", details.productid)
                    .select('tenantproducts.plain', 'tenantproducts.productsku')
                var tenantproductspecs = await global.dbConnection("tenantproductspecs").where("tenantproductid", details.tenantproductid)
                    .select('tenantproductspecs.width',
                        'tenantproductspecs.height',
                        'tenantproductspecs.design_name',
                        'tenantproductspecs.imageurl',
                        'tenantproductspecs.designurl',
                        'tenantproductspecs.placementid',
                        'tenantproductspecs.tenantproductid'
                    )
                await Promise.all(tenantproductspecs.map(async (tenantspec) => {
                    var placementType = await global.dbConnection("app_types").where("app_types.apptypeid", tenantspec.placementid).select("typename").first()
                    var sku = await global.dbConnection("tenantproducts").where("tenantproducts.tenantproductid", tenantspec.tenantproductid).select("productsku").first()
                    tenantspec.placement = placementType.typename
                    tenantspec.sku = sku.productsku
                }))

                details.items = ordered_items
                details.tenantproducts = tenantproducts
                details.tenantproductspecs = tenantproductspecs
            }))

            var productaddons = await global.dbConnection("productaddons")
                .select('productaddons.*',
                    global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
                    global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'))
                .join('orders', function () {
                    this.on(global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`), '>', 0);
                })
                .where("orders.orderheaderid", res.orderheaderid);
            var tenantinvoice = await global.dbConnection("tenantinvoice").where("orderheaderid", res.orderheaderid).select('tenantinvoice.invoiceurl as clientinvoice')
            var deliveries = await global.dbConnection("deliveries").where("orderheaderid", res.orderheaderid)
                .select('deliveries.customername',
                    'deliveries.email',
                    'deliveries.contactno',
                    'deliveries.deliveryaddress',
                    'deliveries.shippingmode',
                    'deliveries.state',
                    'deliveries.city',
                    'deliveries.courierid',
                    'deliveries.pincode')
            var tenants = await global.dbConnection("tenants").where("tenantid", res.tenantid).select('tenants.brandname')
            res.details = orderdetails
            res.productaddons = productaddons
            res.tenantinvoice = tenantinvoice
            res.deliveries = deliveries
            res.tenantbrandname = tenants[0].brandname
        }))
        return result[0]





        // const orderdetail = await global.dbConnection('ordered_items')
        //     .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
        //     .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
        //     .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, orders.productaddons)`))
        //     .leftJoin('tenantinvoice', 'tenantinvoice.orderheaderid', 'orders.orderheaderid')
        //     .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
        //     .leftJoin('app_types as ap', global.dbConnection.raw(`FIND_IN_SET(ap.apptypeid, tenantproducts.printingtypeid)`))
        //     .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'tenantproducts.tenantproductid')
        //     .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
        //     .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
        //     .select(
        //         'ordered_items.id as itemId',
        //         'ordered_items.uniqueitemid',
        //         'ordered_items.status as mainItemStatus',
        //         'ordered_items.picklist as itemPicklist',
        //         'ordered_items.tobeprinted as itemTobeprinted',
        //         'ordered_items.printing as itemPrinting',
        //         'ordered_items.qualitycheck as itemQualitycheck',
        //         'ordered_items.labelgenerated as itemLabelgenerated',
        //         'ordered_items.manifested as itemManifested',
        //         'ordered_items.confirmmanifested as confirmManifested',
        //         'ordered_items.dispatch as itemDispatch',
        //         'ordered_items.delivery as itemDelivery',

        //         'orders.orderheaderid',
        //         'orders.tenantid',
        //         'orders.orderid',
        //         'orders.orderdate',
        //         'orders.orderstatus',
        //         'orders.paymenttype',
        //         global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.groupname) as groupname'),
        //         global.dbConnection.raw('GROUP_CONCAT(DISTINCT productaddons.addonid) as addonid'),
        //         'orders.ordervalue',
        //         'orders.totalamount',
        //         'orders.deliverycharge',
        //         'orders.ordernotes',
        //         'orders.custom_letter_img',
        //         'orders.shipment_order_id',
        //         'orders.shipment_id',
        //         'orders.shiprocket_status',
        //         'orders.awb_code',
        //         'orders.courier_company_id',
        //         'orders.courier_name',
        //         'orders.manifest_url',
        //         'orders.invoice_url',
        //         'orders.label_url',
        //         'tenantinvoice.invoiceurl as clientinvoice',

        //         'orderdetails.orderdetailid',
        //         'orderdetails.quantity',
        //         'orderdetails.charges',
        //         'orderdetails.productcost',
        //         'orderdetails.tenantproductid',
        //         global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.typename) as printingtype'),
        //         global.dbConnection.raw('GROUP_CONCAT(DISTINCT ap.apptypeid) as printingtypeid'),
        //         'orderdetails.total',
        //         'orderdetails.taxpercent',
        //         'orderdetails.taxamount',
        //         'orderdetails.itemstatus',
        //         'tenantproducts.plain',
        //         'tenantproducts.productsku',

        //         'tenantproductspecs.specid',
        //         'tenantproductspecs.placementid',
        //         'ap.typename as printingtypename', // Alias added to avoid conflict with typename from tenantproductspecs
        //         'tenantproductspecs.width',
        //         'tenantproductspecs.height',
        //         'tenantproductspecs.design_name',
        //         'tenantproductspecs.imageurl',
        //         'tenantproductspecs.designurl',

        //         'deliveries.customername',
        //         'deliveries.email',
        //         'deliveries.contactno',
        //         'deliveries.deliveryaddress',
        //         'deliveries.shippingmode',
        //         'deliveries.state',
        //         'deliveries.city',
        //         'deliveries.courierid',
        //         'deliveries.pincode',
        //         'tenants.brandname'
        //     )
        // .where('ordered_items.orderheaderid', orderHeaderId)
        // .whereNot('ordered_items.status', "Onhold")
        // .whereNot('ordered_items.status', "Live")
        // .groupBy('ordered_items.uniqueitemid');  

        //eturn orderdetail;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.fetchOrdersForAllOrdersManage = async (orderId) => {
    try {
        const order = await this.getOrderDetailsByOrderId(orderId);
        console.log("order", order)
        const orderHeaderId = order.orderheaderid;

        const orderDetails = await global.dbConnection("orderdetails").where("orderheaderid", orderHeaderId);

        let itemsdata = [];

        await Promise.all(orderDetails.map(async (details) => {
            const orderedItems = await global.dbConnection("ordered_items")
                .where("orderdetailid", details.orderdetailid)
                .where('ordered_items.orderheaderid', orderHeaderId)
                .whereNot('ordered_items.status', "Onhold")
                .whereNot('ordered_items.status', "Live")
                .select('ordered_items.id as itemId',
                    'ordered_items.uniqueitemid',
                    'ordered_items.status as mainItemStatus');

            const tenantProduct = await global.dbConnection("tenantproducts")
                .where("tenantproductid", details.tenantproductid)
                .select("productsku", "plain")
                .first();

            if (tenantProduct.plain === "yes") {
                // Handle plain t-shirt case
                orderedItems.forEach(item => {
                    itemsdata.push({
                        orderId: order.orderid,
                        orderheaderid: orderHeaderId,
                        orderdate: order.orderdate,
                        uniqueitemid: item.uniqueitemid,
                        mainItemStatus: item.mainItemStatus,
                        ordershippingmode: order.ordershippingmode,
                        width: null, // No dimensions for plain t-shirt
                        height: null,
                        design_name: null, // No design for plain t-shirt
                        imageurl: null,
                        designurl: null,
                        productsku: tenantProduct.productsku,
                        placement: "plain" // No specific placement
                    });
                });
            } else {
                // For non-plain t-shirts with specs
                const tenantProductSpecs = await global.dbConnection("tenantproductspecs")
                    .where("tenantproductid", details.tenantproductid)
                    .select('tenantproductspecs.width',
                        'tenantproductspecs.height',
                        'tenantproductspecs.design_name',
                        'tenantproductspecs.imageurl',
                        'tenantproductspecs.designurl',
                        'tenantproductspecs.placementid',
                        'tenantproductspecs.tenantproductid');

                await Promise.all(tenantProductSpecs.map(async (spec) => {
                    const placementType = await global.dbConnection("app_types")
                        .where("app_types.apptypeid", spec.placementid)
                        .select("typename")
                        .first();

                    orderedItems.forEach(item => {
                        itemsdata.push({
                            orderId: order.orderid,
                            orderheaderid: orderHeaderId,
                            orderdate: order.orderdate,
                            uniqueitemid: item.uniqueitemid,
                            mainItemStatus: item.mainItemStatus,
                            ordershippingmode: order.ordershippingmode,
                            width: spec.width,
                            height: spec.height,
                            design_name: spec.design_name,
                            imageurl: spec.imageurl,
                            designurl: spec.designurl,
                            productsku: tenantProduct.productsku,
                            placement: placementType.typename
                        });
                    });
                }));
            }
        }));

        return itemsdata;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.updateItemStatusForManageAllorders = async (itemIds) => {
    try {
        let orderheaderid;

        for (const itemId of itemIds) {
            const orderdetail = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).first()
            if (orderdetail) {
                const orderstatus = orderdetail.status
                orderheaderid = orderdetail.orderheaderid;
                if (orderstatus == "Picklist Generated") {
                    const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                        status: "To Printed"
                    })
                }

                if (orderstatus == "To Printed") {
                    const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                        status: "Printed"
                    })
                }

                if (orderstatus == "Printed") {
                    const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                        status: "QC"
                    })
                }

                // if (orderstatus == "QC") {
                //     const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                //         status: "Dispatched"
                //     })
                // }
            }

        }

        const allItems = await global.dbConnection('ordered_items').where('orderheaderid', orderheaderid);
        const statuses = allItems.map(item => item.status);
        const uniqueStatuses = [...new Set(statuses)];
        if (uniqueStatuses.length === 1) {
            const updateMainOrderStatus = await global.dbConnection('orders')
                .where('orderheaderid', orderheaderid)
                .update({ orderstatus: uniqueStatuses[0] });
            console.log(`Order Header ID: ${orderheaderid} has all items with status: ${uniqueStatuses[0]} and updated main order status.`);
        } else {
            console.log(`Order Header ID: ${orderheaderid} has items with varying statuses.`);
        }
    } catch (err) {
        console.log("error", err);
    }
}

module.exports.updateDispatchStatus = async (itemIds) => {
    try {
        for (const itemId of itemIds) {
            const orderdetail = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).first()
            if (orderdetail) {
                const orderstatus = orderdetail.status
                if (orderstatus == "QC") {
                    const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                        status: "Dispatched"
                    })
                } else {
                    return null
                }
            }
        }
    } catch (err) {
        console.log("error", err);
    }
    return null
}

module.exports.updateIndividualItemStatus = async (itemId, userId) => {
    try {
        let orderheaderid;
        const orderdetail = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).first()
        if (orderdetail) {
            const orderstatus = orderdetail.status
            orderheaderid = orderdetail.orderheaderid;
            if (orderstatus == "Picklist Generated") {
                const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                    status: "To Printed"
                })
            }

            if (orderstatus == "To Printed") {
                const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                    status: "Printed"
                })
            }

            if (orderstatus == "Printed") {
                const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
                    status: "QC"
                })
            }

            // if (orderstatus == "QC") {
            //     const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
            //         status: "Dispatched"
            //     })
            // }
        }

        const allItems = await global.dbConnection('ordered_items').where('orderheaderid', orderheaderid);
        const statuses = allItems.map(item => item.status);
        const uniqueStatuses = [...new Set(statuses)];
        if (uniqueStatuses.length === 1) {
            const updateMainOrderStatus = await global.dbConnection('orders')
                .where('orderheaderid', orderheaderid)
                .update({ orderstatus: uniqueStatuses[0] });
            const addLog = await this.addOrderLogNew(orderheaderid, uniqueStatuses[0], userId);
            if (!_.isNull(addLog)) {
                // console.log(`Order Header ID: ${orderheaderid} has all items with status: ${uniqueStatuses[0]} and updated main order status.`);
                return true
            }
        } else {
            return true
        }
    } catch (err) {
        console.log("error", err);
        return null
    }
    return null
}


module.exports.addOrderLogNew = async (orderheaderid, orderstatus, userId) => {
    try {
        const orderDetails = await global.dbConnection('orders')
            .leftJoin('orderdetails', 'orderdetails.orderheaderid', 'orders.orderheaderid')
            .where('orders.orderheaderid', orderheaderid).select('orders.tenantid', 'orderdetails.orderdetailid').first()
        const logdate = momentNew().tz('Asia/Kolkata').format('YYYY-MM-DD hh:mm A');
        //console.log("rderDetails.userid", orderDetails.tenantid)
        const response = await global.dbConnection('orderslog')
            .insert(
                {
                    userid: userId,
                    orderheaderid: orderheaderid,
                    comments: orderstatus,
                    logdate: logdate,
                    orderstatus: orderstatus,
                    orderdetailid: orderDetails.orderdetailid ? orderDetails.orderdetailid : 0,
                    itemstatus: orderstatus
                })
        // console.log("add order log", response)
        return !_.isEmpty(response) ? true : null
    } catch (err) {
        console.log("error", err)
    }
}

module.exports.updateDispatchStatusWithShipmentDetails = async (orderId) => {
    try {
        const updateMainOrderStatus = await global.dbConnection('orders')
            .where('orderid', orderId)
            .update({ orderstatus: "Dispatched" });
        if (updateMainOrderStatus == 1) {
            const userId = 1
            const orderheaderid = await global.dbConnection('orders').pluck('orderheaderid').where('orderid', orderId)
            const addLog = await this.addOrderLogNew(orderheaderid[0], "Dispatched", userId);
            if (addLog == true) {
                const updateOrderedItems = await global.dbConnection('ordered_items')
                    .where('orderheaderid', orderheaderid[0])
                    .update({ status: "Dispatched" });
                return true
            }
        }
    } catch (err) {
        console.log("error", err);
        return null
    }
    return null
}

module.exports.getOrderDetailsByIdForPickList = async (orderheaderId) => {
    try {
        const order = await this.getOrderDetailsByOrderHeaderId(orderheaderId);
        const orderHeaderId = order.orderheaderid;

        const orderDetails = await global.dbConnection("orderdetails").where("orderheaderid", orderHeaderId);

        let itemsdata = [];

        await Promise.all(orderDetails.map(async (details) => {
            const orderedItems = await global.dbConnection("ordered_items")
                .where("orderdetailid", details.orderdetailid)
                .where('ordered_items.orderheaderid', orderHeaderId)
                .whereNot('ordered_items.status', "Onhold")
                .where('ordered_items.status', "Live")
                .select('ordered_items.id as itemId',
                    'ordered_items.uniqueitemid',
                    'ordered_items.status as mainItemStatus');

            const tenantProduct = await global.dbConnection("tenantproducts")
                .where("tenantproductid", details.tenantproductid)
                .select("productsku", "plain")
                .first();
            console.log("orderedItems", orderedItems)
            if (tenantProduct.plain === "yes") {
                // Handle plain t-shirt case
                orderedItems.forEach(item => {
                    itemsdata.push({
                        orderId: order.orderid,
                        orderheaderid: orderHeaderId,
                        orderdetailid: details.orderdetailid,
                        orderdate: order.orderdate,
                        uniqueitemid: item.uniqueitemid,
                        mainItemStatus: item.mainItemStatus,
                        width: null, // No dimensions for plain t-shirt
                        height: null,
                        design_name: null, // No design for plain t-shirt
                        imageurl: null,
                        designurl: null,
                        productsku: tenantProduct.productsku,
                        placement: "plain" // No specific placement
                    });
                });
            } else {
                // For non-plain t-shirts with specs
                const tenantProductSpecs = await global.dbConnection("tenantproductspecs")
                    .where("tenantproductid", details.tenantproductid)
                    .select('tenantproductspecs.width',
                        'tenantproductspecs.height',
                        'tenantproductspecs.design_name',
                        'tenantproductspecs.imageurl',
                        'tenantproductspecs.designurl',
                        'tenantproductspecs.placementid',
                        'tenantproductspecs.tenantproductid');

                await Promise.all(tenantProductSpecs.map(async (spec) => {
                    const placementType = await global.dbConnection("app_types")
                        .where("app_types.apptypeid", spec.placementid)
                        .select("typename")
                        .first();

                    orderedItems.forEach(item => {
                        itemsdata.push({
                            orderId: order.orderid,
                            orderheaderid: orderHeaderId,
                            orderdetailid: details.orderdetailid,
                            orderdate: order.orderdate,
                            uniqueitemid: item.uniqueitemid,
                            mainItemStatus: item.mainItemStatus,
                            width: spec.width,
                            height: spec.height,
                            design_name: spec.design_name,
                            imageurl: spec.imageurl,
                            designurl: spec.designurl,
                            productsku: tenantProduct.productsku,
                            placement: placementType.typename
                        });
                    });
                }));
            }
        }));

        return itemsdata;
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.updateIndividualItemFromScanner = async (itemId, userId) => {
    try {
        let orderheaderid;
        const orderdetail = await global.dbConnection('ordered_items').where('id', itemId).first()
        if (orderdetail) {
            const orderstatus = orderdetail.status
            orderheaderid = orderdetail.orderheaderid;
            if (orderstatus == "Picklist Generated") {
                const updateStatus = await global.dbConnection('ordered_items').where('id', itemId).update({
                    status: "To Printed"
                })
            }

            if (orderstatus == "To Printed") {
                const updateStatus = await global.dbConnection('ordered_items').where('id', itemId).update({
                    status: "Printed"
                })
            }

            if (orderstatus == "Printed") {
                const updateStatus = await global.dbConnection('ordered_items').where('id', itemId).update({
                    status: "QC"
                })
            }

            // if (orderstatus == "QC") {
            //     const updateStatus = await global.dbConnection('ordered_items').where('uniqueitemid', itemId).update({
            //         status: "Dispatched"
            //     })
            // }
        }

        const allItems = await global.dbConnection('ordered_items').where('orderheaderid', orderheaderid);
        const statuses = allItems.map(item => item.status);
        const uniqueStatuses = [...new Set(statuses)];
        if (uniqueStatuses.length === 1) {
            const updateMainOrderStatus = await global.dbConnection('orders')
                .where('orderheaderid', orderheaderid)
                .update({ orderstatus: uniqueStatuses[0] });
            const addLog = await this.addOrderLogNew(orderheaderid, uniqueStatuses[0], userId);
            if (!_.isNull(addLog)) {
                // console.log(`Order Header ID: ${orderheaderid} has all items with status: ${uniqueStatuses[0]} and updated main order status.`);
                return true
            }
        } else {
            return true
        }
    } catch (err) {
        console.log("error", err);
        return null
    }
    return null
}

module.exports.getOrderDetailsByIdForPickListPdf = async (orderheaderid) => {
    try {
        const allItems = await global.dbConnection('ordered_items')
            .leftJoin('orders', 'orders.orderheaderid', 'ordered_items.orderheaderid')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .leftJoin('orderdetails', 'orderdetails.orderdetailid', 'ordered_items.orderdetailid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'tenantproducts.tenantproductid')
            .leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
            .select(
                'orders.orderid',
                'orders.orderheaderid',
                'tenants.companylogo',
                'tenants.brandsticker',
                'ordered_items.uniqueitemid',
                'ordered_items.id as itemId',
                'orderdetails.orderdetailid',
                'orderdetails.tenantproductid',
                'tenantproducts.productsku',
                'tenantproducts.plain',
                'tenantproductspecs.placementid',
                'app_types.typename'
            )
            .where('ordered_items.orderheaderid', orderheaderid);

        const resultMap = {};
        const tenantproductCounts = {};

        // Calculate total count of unique `uniqueitemid` for each `tenantproductid`
        allItems.forEach(item => {
            if (!tenantproductCounts[item.tenantproductid]) {
                tenantproductCounts[item.tenantproductid] = new Set();
            }
            tenantproductCounts[item.tenantproductid].add(item.uniqueitemid);
        });

        // Initialize count trackers for each `tenantproductid`
        const picsCountMap = {};
        for (const tenantproductid in tenantproductCounts) {
            picsCountMap[tenantproductid] = Array.from(tenantproductCounts[tenantproductid]);
        }

        // Assign sequential counts and total counts
        const finalResult = [];
        allItems.forEach(item => {
            if (!resultMap[item.uniqueitemid]) {
                const countArray = picsCountMap[item.tenantproductid];
                const total = countArray.length;

                let picsCount;
                if (total === 1) {
                    picsCount = 'S';
                } else {
                    const count = countArray.indexOf(item.uniqueitemid) + 1;
                    picsCount = `P-${count}/${total}`;
                }

                resultMap[item.uniqueitemid] = {
                    orderheaderid: item.orderheaderid,
                    orderid: item.orderid,
                    itemId: item.itemId,
                    uniqueitemid: item.uniqueitemid,
                    orderdetailid: item.orderdetailid,
                    tenantproductid: item.tenantproductid,
                    productsku: item.productsku,
                    plain: item.plain,
                    placementid: item.placementid,
                    typenames: item.typename ? [item.typename] : [],
                    picsCount: picsCount,
                    printType: item.plain == "no" ? "DTG" : "plain", // Correct conditional assignment
                    brandsticker: item.brandsticker, // Include brandsticker
                    companylogo: item.companylogo // Include brandsticker
                };

                finalResult.push(resultMap[item.uniqueitemid]);
            } else {
                if (item.typename) {
                    resultMap[item.uniqueitemid].typenames.push(item.typename);
                }
            }
        });

        return finalResult
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderDetailsForInvoice = async (orderheaderid) => {
    try {

        const allItems = await global.dbConnection('orders')
            .leftJoin('tenants', 'tenants.tenantid', 'orders.tenantid')
            .leftJoin('orderdetails', 'orderdetails.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('tenantproductspecs', 'tenantproductspecs.tenantproductid', 'tenantproducts.tenantproductid')
            .leftJoin('app_types', 'app_types.apptypeid', 'tenantproductspecs.placementid')
            .leftJoin('deliveries', 'deliveries.orderheaderid', 'orders.orderheaderid')
            .select(
                'orders.orderid',
                'orders.orderheaderid',
                'orders.ordervalue',
                'orders.deliverycharge',
                'orders.orderdate',
                'orders.totalamount as totalOrderAmount',
                'orders.order_reference_number as order_reference_number',
                'tenants.tenantid',
                'tenants.tenantname',
                'tenants.companylogo',
                'tenants.brandsticker',
                'orderdetails.orderdetailid',
                'orderdetails.tenantproductid',
                'orderdetails.quantity',
                'orderdetails.charges',
                'orderdetails.productcost',
                'orderdetails.total as totalproductamount',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'tenantproducts.productsku',
                'tenantproducts.plain',
                'tenantproductspecs.placementid',
                'app_types.typename',
                'deliveries.state',
                'deliveries.customername',
                'deliveries.email as customerEmail',
                'deliveries.contactno as customerContactNo',
                'deliveries.deliveryaddress as customerDeliveryAddress',
            )
            .where('orders.orderheaderid', orderheaderid);

        if (!allItems || allItems.length === 0) {
            return null;
        }

        // Extract order details from the first item
        const orderDetails = {
            orderdate: allItems[0].orderdate,
            orderid: allItems[0].orderid,
            orderheaderid: allItems[0].orderheaderid,
            companylogo: allItems[0].companylogo,
            brandsticker: allItems[0].brandsticker,
            orderdetailid: allItems[0].orderdetailid,
            tenantid: allItems[0].tenantid,
            order_reference_number: allItems[0].order_reference_number,
            tenantname: allItems[0].tenantname,
            totalOrderAmount: allItems[0].totalOrderAmount,
            deliveryState: allItems[0].state,
            deliveryCustomerName: allItems[0].customername,
            deliveryEmail: allItems[0].CustomerEmail,
            deliveryCustomerEmail: allItems[0].customername,
            deliveryCustomerName: allItems[0].customerEmail,
            deliveryCustomerContactNo: allItems[0].customerContactNo,
            customerDeliveryAddress: allItems[0].customerDeliveryAddress,
        };

        // Group product details
        const products = allItems.map(item => ({
            tenantproductid: item.tenantproductid,
            productsku: item.productsku,
            quantity: item.quantity,
            productcost: item.productcost,
            taxpercent: item.taxpercent,
            charges: item.charges,
            plain: item.plain,
            placementid: item.placementid,
            typename: item.typename
        }));
        return {
            orderDetails,
            products
        }
    } catch (err) {
        console.log("error", err);
    }
    return null;
};

module.exports.getOrderLable = async (orderId) => {
    try {
        const orders = await global.dbConnection('orders').select('label_url').where('orderid', orderId).first()
        return orders
    } catch (err) {
        console.log("error", err);
    }
    return null;
};



module.exports.updatedeliverystatusservice = async (props) => {
    try {

        console.log(`response - `, props);

        const orders = await global.dbConnection('orders')
            .update({
                live_status: props?.status,
                webhooK_response: props
            })
            .where({ awb_code: props?.awb_number })

        return true


    } catch (error) {
        console.log(`error in updatedeliverystatusservice - `, error);
    }
}

// This function has been moved to controllers/woocommerce/index.js
// The getAllStoreOrders function is now properly implemented in the woocommerce controller

// New function for store orders - updates woocommerce_orders table status
module.exports.updateStoreOrderItemStatus = async (orderId, userId) => {
    try {
        // Get the current order from woocommerce_orders table
        const order = await global.dbConnection('woocommerce_orders')
            .where('id', orderId)
            .first();

        if (!order) {
            console.log("Order not found:", orderId);
            return null;
        }

        const currentStatus = order.status || 'pending';
        let newStatus = currentStatus;

        // Update status based on current status progression
        if (currentStatus === 'on-hold') {
            newStatus = 'Live';
        } else if (currentStatus === 'Live') {
            newStatus = 'Picklist Generated';
        } else if (currentStatus === 'Picklist Generated') {
            newStatus = 'To Printed';
        } else if (currentStatus === 'To Printed') {
            newStatus = 'Printed';
        } else if (currentStatus === 'Printed') {
            newStatus = 'QC';
        } else if (currentStatus === 'QC') {
            newStatus = 'Dispatched';
        }

        // Update the main order status in woocommerce_orders table
        if (newStatus !== currentStatus) {
            const updateMainOrderStatus = await global.dbConnection('woocommerce_orders')
                .where('id', orderId)
                .update({ status: newStatus });

            const addLog = await this.addStoreOrderLog(orderId, newStatus, userId);
            if (!_.isNull(addLog)) {
                console.log(`Order ${orderId} status updated from ${currentStatus} to ${newStatus}`);
                return true;
            }
        } else {
            console.log(`Order ${orderId} already at status: ${currentStatus}`);
            return true;
        }
    } catch (err) {
        console.log("error", err);
        return null;
    }
    return null;
};


// Helper function for store order logging
module.exports.addStoreOrderLog = async (orderId, orderStatus, userId) => {
    try {
        // Format date for MySQL datetime column (YYYY-MM-DD HH:MM:SS)
        const now = new Date();
        const logDate = now.getFullYear() + '-' +
            String(now.getMonth() + 1).padStart(2, '0') + '-' +
            String(now.getDate()).padStart(2, '0') + ' ' +
            String(now.getHours()).padStart(2, '0') + ':' +
            String(now.getMinutes()).padStart(2, '0') + ':' +
            String(now.getSeconds()).padStart(2, '0');

        console.log(`logDate - `, logDate);
        const response = await global.dbConnection('woocommerce_order_logs')
            .insert({
                user_id: userId,
                order_id: orderId,
                comments: orderStatus,
                log_date: logDate,
                order_status: orderStatus,
                item_status: orderStatus
            })

        return !_.isEmpty(response) ? true : null
    } catch (err) {
        console.log("error", err)
        return null
    }
}

module.exports.storeOrderUpdateWallet = async (orderId) => {
    try {


        if (!orderId) {
            return {
                success: false,
                message: 'orderId is required'
            };
        }

        // Map short codes to full variant size names
        const sizeMap = {
            S: "Small",
            M: "Medium",
            L: "Large",
            XL: "XL",
            XXL: "XXL"
        };


        const order = await global.dbConnection('woocommerce_orders')
            .leftJoin('woocommerce_order_items', 'woocommerce_orders.id', 'woocommerce_order_items.order_id')
            .select('woocommerce_orders.line_items', 'woocommerce_orders.vendor_id', 'woocommerce_order_items.quantity', 'woocommerce_order_items.sku', 'shipping_total')
            .where('woocommerce_orders.id', orderId)
            .first();

        console.log('📦 Order found:', order);

        if (!order) {
            console.log('❌ Order not found in database');
            return {
                success: false,
                message: 'Order not found',
                data: { orderId }
            };
        }

        if (!order.vendor_id || order.vendor_id <= 0) {
            console.log('❌ Invalid vendor_id:', order.vendor_id);
            return {
                success: false,
                message: 'Invalid or missing vendor_id',
                data: { orderId, vendorId: order.vendor_id }
            };
        }

        if (!order.line_items) {
            console.log('❌ No line_items found in order');
            return {
                success: false,
                message: 'No line items found in order',
                data: { orderId, vendorId: order.vendor_id }
            };
        }

        if (order && order.vendor_id !== null && order.vendor_id !== undefined && order.vendor_id > 0 && order.line_items) {
            // Parse line_items JSON
            const lineItems = JSON.parse(order.line_items);
            console.log('📋 Line items:', lineItems);

            let totalCost = 0;

            // Loop through line items
            // Loop through line items
            for (const item of lineItems) {
                console.log('🔍 Processing item:', {
                    productName: item.deeprintzProductName,
                    quantity: item.shopifyOrderProductQuantity,
                    orderPrice: item.shopifyOrderProductPrice,
                    variants: item.shopifyVariants,
                    dbSku: order.sku // <-- sku directly from DB
                });

                if (!order.sku || !item.shopifyVariants) {
                    console.log('⚠️ Skipping item - missing sku or variants');
                    continue;
                }

                // Extract size from DB SKU (e.g. DP-11-1756979182217-L-1756979190843 → L)
                // Extract size code from SKU
                const skuParts = order.sku.split("-");
                const sizeCode = skuParts.length >= 4 ? skuParts[3] : null;
                console.log("📏 Extracted size code from SKU:", sizeCode);

                // Convert size code → actual variant size
                const selectedSize = sizeMap[sizeCode] || sizeCode;
                console.log("📐 Mapped size:", selectedSize);

                // Find matching variant price
                const variant = item.shopifyVariants.find(v => v.size === selectedSize);


                if (variant) {
                    const price = parseFloat(variant.price);
                    const qty = parseInt(item.shopifyOrderProductQuantity, 10) || 1;
                    const printCost = await global.dbConnection('shopify_products')
                        .select('printingcharge', 'othercost')
                        .where('id', item.shopifyProductId)
                        .first();
                    const itemTotal = (price + printCost.printingcharge + printCost.othercost) * qty;
                    totalCost += itemTotal;

                    console.log(`💵 Item calculation: (${price} + ${printCost.printingcharge} + ${printCost.othercost}) × ${qty} = ${itemTotal}`);
                } else {
                    console.log('❌ No matching variant found for size:', selectedSize);
                }
            }

            // Add shipping total to the final cost (only once)
            if (order.shipping_total) {
                totalCost += parseFloat(order.shipping_total);
                console.log(`🚚 Added shipping cost: ${order.shipping_total}`);
            }

            console.log(`💰 Final total cost: ${totalCost}`);

            // Deduct from wallet
            // const updated = await global.dbConnection('tenants')
            //     .where('userid', order.vendor_id)
            //     .decrement('wallet', totalCost);

            const response = await global.dbConnection('tenants')
                .select('wallet', 'tenantid').where({ user_id: order.vendor_id })

            // Check if tenant record exists
            if (!response || response.length === 0) {
                console.log(`❌ No tenant record found for vendor_id: ${order.vendor_id}`);
                return {
                    success: false,
                    message: 'No tenant record found for this vendor',
                    data: { orderId, vendorId: order.vendor_id }
                };
            }

            const walletamount = response[0].wallet
            const balance = walletamount - (_.toNumber(totalCost))

            console.log("💰 Current wallet amount:", walletamount)
            console.log("💸 Total cost to deduct:", totalCost)
            console.log("💳 Balance after deduction:", balance)

            // Check if balance is sufficient
            if (balance < 0) {
                console.log("❌ Insufficient balance! Updating order status to 'Onhold'")
                console.log("Insufficient balance for store order:", {
                    orderId,
                    vendorId: order.vendor_id,
                    currentWallet: walletamount,
                    totalCost,
                    balance,
                    shortfall: Math.abs(balance)
                });

                // Update order status to 'onhold'
                const updateOrderStatus = await global.dbConnection('woocommerce_orders')
                    .update({ status: 'Onhold' })
                    .where({ id: orderId })

                console.log("📋 Order status updated:", updateOrderStatus)

                return {
                    success: false,
                    message: 'Insufficient wallet balance. Order status updated to Onhold.',
                    insufficientBalance: true,
                    validationDetails: {
                        currentWallet: walletamount,
                        requiredAmount: totalCost,
                        shortfall: Math.abs(balance),
                        canProceed: false
                    },
                    data: {
                        orderId,
                        vendorId: order.vendor_id,
                        currentWallet: walletamount,
                        totalCost,
                        balance,
                        orderStatus: 'Onhold'
                    }
                };
            }

            // Proceed with wallet deduction if balance is sufficient
            const updateBalance = await global.dbConnection('tenants')
                .update({ wallet: balance })
                .where({ tenantid: response[0].tenantid })

            console.log("✅ Wallet updated:", updateBalance)

            const paymentlog = await global.dbConnection('paymentlogs').insert({
                tenantid: response[0].tenantid,
                orderid: orderId,
                amount_debited: totalCost,
                balance: balance
            });

            console.log("📝 Payment log created:", paymentlog)

            // Check if order was on hold and update status to live
            const currentOrder = await global.dbConnection('woocommerce_orders')
                .select('status')
                .where({ id: orderId })
                .first();

            if (currentOrder && currentOrder.status === 'Onhold') {
                console.log("🔄 Order was on hold, updating status to 'live'");

                // Update order status to 'live'
                const updateOrderStatus = await global.dbConnection('woocommerce_orders')
                    .update({ status: 'live' })
                    .where({ id: orderId });

                console.log("📋 Order status updated to live:", updateOrderStatus);

                // Update order items status to 'live'
                //   const updateOrderItems = await global.dbConnection('woocommerce_order_items')
                //     .update({ status: 'live' })
                //     .where({ order_id: orderId });

                //   console.log("📦 Order items status updated to live:", updateOrderItems);
            }

            console.log(`✅ Deducted ${totalCost} from wallet for vendor ID: ${order.vendor_id}`);

            return {
                success: true,
                message: 'Wallet updated successfully',
                insufficientBalance: false,
                validationDetails: {
                    currentWallet: walletamount,
                    requiredAmount: totalCost,
                    remainingBalance: balance,
                    canProceed: true
                },
                data: {
                    orderId,
                    vendorId: order.vendor_id,
                    totalCost,
                    lineItemsCount: lineItems.length,
                    finalBalance: balance,
                    orderStatus: currentOrder?.status === 'Onhold' ? 'live' : currentOrder?.status,
                    statusChanged: currentOrder?.status === 'Onhold'
                }
            };
        } else {
            console.log('❌ Order not found or missing required data');
            return {
                success: false,
                message: 'Order not found or missing required data',
                data: { orderId }
            };
        }
    } catch (error) {
        console.error('❌ Error in updateWallet:', error);
        return {
            success: false,
            message: 'Internal server error',
            error: error.message
        };
    }
}

module.exports.normalOrderMoveLive = async (orderheaderid) => {
    try {
        const order = await global.dbConnection('orders')
            .select('*')
            .where({ orderheaderid })
            .first();

        if (order) {
            // Update order status
            const orderUpdate = await global.dbConnection('orders')
                .update({ orderstatus: 'live' })
                .where({ orderheaderid });

            console.log("Store order updated to live:", orderUpdate);

            // Update ordered_items status
            const orderedItemsUpdate = await global.dbConnection('ordered_items')
                .update({ status: 'live' })
                .where({ orderheaderid });

            // Update orderdetails item status
            const orderDetailsUpdate = await global.dbConnection('orderdetails')
                .update({ itemstatus: 'live' })
                .where({ orderheaderid });

            return {
                success: true,
                message: 'Order and items moved to live successfully',
                data: {
                    orderUpdate,
                    orderedItemsUpdate,
                    orderDetailsUpdate
                }
            };
        } else {
            return {
                success: false,
                message: `No order found with orderheaderid: ${orderheaderid}`
            };
        }
    } catch (err) {
        console.error("error", err);
        return {
            success: false,
            message: 'Internal server error in normalOrderMoveLive',
            error: err.message
        };
    }
};


