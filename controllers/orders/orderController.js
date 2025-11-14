const userService = require("../../service/order/orderService")
const _ = require("lodash");
const Joi = require('joi')
const nodemailer = require("nodemailer");
const axios = require('axios');

module.exports.checkreference = async (req, res) => {
    try {
        const { tenantid, referenceno } = req.body;

        var getreference = await global.dbConnection('orders')
            .select('order_reference_number').where({ tenantid }).andWhere('order_reference_number', referenceno)
        //console.log(getreference);
        if (!_.isEmpty(getreference)) {
            return res.send({
                status: false,
                message: "Reference number already exists"
            })
        } else {
            return res.send({
                status: true,
                message: " New Reference number"
            })
        }

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getreference = async (req, res) => {
    try {
        const { tenantid } = req.body;
        var nextrefno = "";
        var getreference = await global.dbConnection('orders')
            .select('order_reference_number').where({ tenantid }).orderBy('created', 'desc').limit(1);
        //console.log(getreference);

        if (!_.isEmpty(getreference)) {
            var refno = getreference[0].order_reference_number;
            nextrefno = parseInt(refno) + 1;
        } else {
            nextrefno = 1001;
        }
        console.log(nextrefno);
        if (!_.isNull(nextrefno)) {
            return res.send({
                status: true,
                data: nextrefno
            })
        } else {
            return res.send({
                status: false,
                data: ""
            })
        }
    } catch (err) {
        console.log("error", err)
    }
}

module.exports.addOrder = async (req, res) => {
    try {
        //console.log("hihi");
        const schema = Joi.object({
            cartIds: Joi.array().required(),
            tenantid: Joi.number().required(),
            orderProducts: Joi.array().items(
                Joi.object({
                    tenantproductid: Joi.number().required(),
                    quantity: Joi.number().optional(),
                    productcost: Joi.number().required(),
                    charges: Joi.number().required(),
                    taxpercent: Joi.number().required(),
                    taxamount: Joi.number().required(),
                    total: Joi.number().required()
                })
            ).required(),
            addonIds: Joi.array().required(),
            referenceno: Joi.number().required(),
            shippingmode: Joi.number().required(),
            ordernotes: Joi.string().allow('', null).optional(),
            paymenttype: Joi.number().required(),
            pincode: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.number().required()
            }),
            courierid: Joi.when('shippingmode', {
                is: 3,
                then: Joi.alternatives().try(Joi.string().allow('', null), Joi.number().allow(null)).optional(),
                otherwise: Joi.number().required()
            }),
            customername: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            contactno: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            email: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            deliveryaddress: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            state: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            city: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            status: Joi.number().required(),
            ordervalue: Joi.number().required(),
            deliverycharge: Joi.number().required(),
            totalamount: Joi.number().required(),
            custom_letter_img: Joi.string().optional()
        })
        const validationResult = schema.validate(req.body)

        const walletcheck = await userService.walletCheck(req.body)

        if (walletcheck) {
            return res.send({
                status: false,
                message: "Low money in wallet!"
            })
        }
        else if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.addOrder(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Order placed successfully",
                    orderheaderid: response[0]
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to place your order"
    })
}

module.exports.instantaddOrder = async (req, res) => {
    try {
        const schema = Joi.object({
            cartIds: Joi.array().required(),
            tenantid: Joi.number().required(),
            orderProducts: Joi.array().items(
                Joi.object({
                    tenantproductid: Joi.number().required(),
                    quantity: Joi.number().optional(),
                    productcost: Joi.number().required(),
                    charges: Joi.number().required(),
                    taxpercent: Joi.number().required(),
                    taxamount: Joi.number().required(),
                    total: Joi.number().required()
                })
            ).required(),
            addonIds: Joi.array().required(),
            referenceno: Joi.number().required(),
            shippingmode: Joi.number().required(),
            ordernotes: Joi.string().optional(),
            paymenttype: Joi.number().required(),
            pincode: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.number().required()
            }),
            courierid: Joi.when('shippingmode', {
                is: 3,
                then: Joi.alternatives().try(Joi.string().allow('', null), Joi.number().allow(null)).optional(),
                otherwise: Joi.number().required()
            }),
            customername: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            contactno: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            email: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().optional()
            }),
            deliveryaddress: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            state: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            city: Joi.when('shippingmode', {
                is: 3,
                then: Joi.string().allow('', null).optional(),
                otherwise: Joi.string().required()
            }),
            status: Joi.number().required(),
            ordervalue: Joi.number().required(),
            deliverycharge: Joi.number().required(),
            totalamount: Joi.number().required(),
            custom_letter_img: Joi.string().optional()
        })
        const validationResult = schema.validate(req.body)

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.instantaddOrder(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Order placed successfully",
                    orderheaderid: response[0]
                })
            }
        }


    } catch (err) {
        console.log(err)
    }
}

module.exports.updateOrderDetails = async (req, res) => {
    try {

        const schema = Joi.object({
            tenantid: Joi.number().required(),
            addonIds: Joi.array().required(),
            sequenceno: Joi.number().required(),
            shippingmode: Joi.number().required(),
            ordernotes: Joi.string().optional(),
            paymenttype: Joi.number().required(),
            pincode: Joi.number().required(),
            courierid: Joi.number().required(),
            customername: Joi.string().optional(),
            contactno: Joi.string().optional(),
            email: Joi.string().optional(),
            deliveryaddress: Joi.string().required(),
            state: Joi.string().required(),
            city: Joi.string().required(),
            status: Joi.number().required(),
            ordervalue: Joi.number().required(),
            deliverycharge: Joi.number().required(),
            totalamount: Joi.number().required()
        })

        const walletcheck = await userService.walletCheck(req.body)


        if (walletcheck) {
            return res.send({
                status: false,
                message: "Low money in wallet!"
            })
        }
        else if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.addOrder(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Order placed successfully",
                    orderheaderid: response[0]
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to place your order"
    })
}

module.exports.updateLiveOrderDetails = async (req, res) => {
    try {
        const schema = Joi.object({
            order_header_id: Joi.number().required(),
            customer_name: Joi.string().optional(),
            mobile: Joi.number().optional(),
            email: Joi.string().optional(),
            shipping_address: Joi.string().optional(),
            state: Joi.string().optional(),
            city: Joi.string().optional(),
        })
        const validationResult = schema.validate(req.body)

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateLiveOrderDetails(req.body);
            if ((response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                    response: response
                })
            }
        }
    } catch (err) {
        console.log("error", err)
    }
}

module.exports.ordermoveLive = async (req, res) => {
    try {
        // const schema = Joi.object({
        //     tenantid: Joi.number().required(),
        //     orderid: Joi.string().required(),
        //     orderheaderId: Joi.number().required(),
        //     customer_name: Joi.string().optional().allow(null),
        //     mobile: Joi.number().optional().allow(null),
        //     email: Joi.string().optional().allow(null),
        //     shipping_address: Joi.string().optional().allow(null),
        //     state: Joi.string().optional().allow(null),
        //     city: Joi.string().optional().allow(null),
        //     totalamount: Joi.string().required(),
        //     ordervalue: Joi.number().required(),
        //     pincode : Joi.number().optional().allow(null),
        //     status: 1
        //  }) 
        // const validationResult = schema.validate(req.body)

        const walletcheck = await userService.walletCheck(req.body)

        console.log(`wallet  -`, walletcheck);


        if (walletcheck) {
            return res.send({
                status: false,
                message: "Low money in wallet!"
            })
        } else {
            const response = await userService.ordermoveLive(req.body);
            if ((response)) {
                return res.send({
                    status: true,
                    message: `Success!`
                })
            }
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to move order live"
    })
}

module.exports.getOrdersbyCustomerId = async (req, res) => {
    try {
        const response = await userService.getOrdersbyCustomerId(req.body)
        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: "Successfully retrieved all orders by customer Id",
                orders: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve orders by customer Id",
        orders: []
    })
}

module.exports.getOrderDetails = async (req, res) => {
    try {
        const response = await userService.getOrderDetails(req.body)
        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: "Successfully retrieved all orders by customer Id",
                response: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve orders by customer Id",
        orders: []
    })
}

module.exports.deleteOrder = async (req, res) => {
    try {
        const response = await userService.deleteOrder(req.body)
        console.log("res..", response)
        if (response >= 1) {
            return res.send({
                status: true,
                message: "Success!"
            })
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed!"
    })
}

module.exports.getAllOrders = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.number().required(),
            offset: Joi.number().optional(),
            //limit: Joi.number().optional(),
            from: Joi.optional(),
            to: Joi.optional(),
            all: Joi.number()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getAllOrders(req.body)

            const orderscount = await userService.getOrdersCount(req.body)


            if (!_.isEmpty(response) && !_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Orders!",
                    response: response,
                    orderscount: orderscount
                })
            }

            if (!_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Orders!",
                    response: [],
                    orderscount: orderscount
                })
            }
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllOrdersWithPagination = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.number().required(),
            page: Joi.number().min(1).default(1),
            limit: Joi.number().min(1).max(100).default(10),
            from: Joi.optional(),
            to: Joi.optional(),
            all: Joi.number().default(0),
            searchOrderId: Joi.string().optional(),
            orderStatus: Joi.string().optional()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const { page, limit, ...filters } = validationResult.value;
            const offset = (page - 1) * limit;

            const response = await userService.getAllOrdersWithPagination({
                ...filters,
                offset,
                limit
            });

            const totalCount = await userService.getOrdersCount(filters);

            if (response !== null) {
                // Get the correct total count based on status
                let totalItems = 0;
                
                // If orderStatus filter is provided, get count for that specific status
                if (filters.orderStatus) {
                    totalItems = await userService.getOrdersCountByStatus({
                        orderStatus: filters.orderStatus,
                        from: filters.from,
                        to: filters.to,
                        all: filters.all
                    });
                } else if (totalCount) {
                    if (filters.status === 1) {
                        totalItems = totalCount.allorders || 0;
                    } else if (filters.status === 2) {
                        totalItems = totalCount.onhold || 0;
                    } else if (filters.status === 3) {
                        totalItems = totalCount.live || 0;
                    } else if (filters.status === 4) {
                        totalItems = totalCount.returned || 0;
                    } else {
                        // For other statuses, try to get from the specific status field
                        const statusField = Object.keys(totalCount).find(key => 
                            key.toLowerCase().includes('picklist') || 
                            key.toLowerCase().includes('printed') ||
                            key.toLowerCase().includes('qc') ||
                            key.toLowerCase().includes('dispatched') ||
                            key.toLowerCase().includes('delivered') ||
                            key.toLowerCase().includes('out') ||
                            key.toLowerCase().includes('label')
                        );
                        totalItems = statusField ? totalCount[statusField] || 0 : 0;
                    }
                }

                const totalPages = Math.ceil(totalItems / limit);
                const hasNextPage = page < totalPages;
                const hasPrevPage = page > 1;

                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Orders with Pagination!",
                    data: response,
                    pagination: {
                        currentPage: page,
                        totalPages: totalPages,
                        totalItems: totalItems,
                        itemsPerPage: limit,
                        hasNextPage: hasNextPage,
                        hasPrevPage: hasPrevPage,
                        nextPage: hasNextPage ? page + 1 : null,
                        prevPage: hasPrevPage ? page - 1 : null
                    },
                    orderscount: totalCount
                })
            }

                // Get the correct total count based on status for empty response
                let totalItems = 0;
                
                // If orderStatus filter is provided, get count for that specific status
                if (filters.orderStatus) {
                    totalItems = await userService.getOrdersCountByStatus({
                        orderStatus: filters.orderStatus,
                        from: filters.from,
                        to: filters.to,
                        all: filters.all
                    });
                } else if (totalCount) {
                    if (filters.status === 1) {
                        totalItems = totalCount.allorders || 0;
                    } else if (filters.status === 2) {
                        totalItems = totalCount.onhold || 0;
                    } else if (filters.status === 3) {
                        totalItems = totalCount.live || 0;
                    } else if (filters.status === 4) {
                        totalItems = totalCount.returned || 0;
                    } else {
                        // For other statuses, try to get from the specific status field
                        const statusField = Object.keys(totalCount).find(key => 
                            key.toLowerCase().includes('picklist') || 
                            key.toLowerCase().includes('printed') ||
                            key.toLowerCase().includes('qc') ||
                            key.toLowerCase().includes('dispatched') ||
                            key.toLowerCase().includes('delivered') ||
                            key.toLowerCase().includes('out') ||
                            key.toLowerCase().includes('label')
                        );
                        totalItems = statusField ? totalCount[statusField] || 0 : 0;
                    }
                }

            const totalPages = Math.ceil(totalItems / limit);
            const hasNextPage = page < totalPages;
            const hasPrevPage = page > 1;

            return res.send({
                status: true,
                message: "Successfully Retrieved All Orders with Pagination!",
                data: [],
                pagination: {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                    itemsPerPage: limit,
                    hasNextPage: hasNextPage,
                    hasPrevPage: hasPrevPage,
                    nextPage: hasNextPage ? page + 1 : null,
                    prevPage: hasPrevPage ? page - 1 : null
                },
                orderscount: totalCount
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders with Pagination",
        data: [],
        pagination: null
    })
}

module.exports.getAllOrdersByTenantId = async (req, res) => {
    try {
        const schema = Joi.object({
            tenantid: Joi.number().required(),
            status: Joi.number().required(),
            offset: Joi.number().optional(),
            limit: Joi.number().optional(),
            from: Joi.optional(),
            to: Joi.optional(),
            all: Joi.number()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getAllOrdersByTenantId(req.body)

            const orderscount = await userService.getOrdersCountByTenantId(req.body)


            if (!_.isEmpty(response) && !_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Orders!",
                    response: response,
                    orderscount: orderscount
                })
            }

            if (!_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Orders!",
                    response: [],
                    orderscount: orderscount
                })
            }
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

// 🌐 Website Orders Management Functions (Separate from Store Orders)

// Get all website orders (your existing system)
module.exports.getAllWebsiteOrders = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.number().required(),
            offset: Joi.number().optional(),
            from: Joi.optional(),
            to: Joi.optional(),
            all: Joi.number()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getAllOrders(req.body)
            const orderscount = await userService.getOrdersCount(req.body)

            if (!_.isEmpty(response) && !_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Website Orders!",
                    response: response,
                    orderscount: orderscount
                })
            }

            if (!_.isEmpty(orderscount)) {
                return res.send({
                    status: true,
                    message: "Successfully Retrieved All Website Orders!",
                    response: [],
                    orderscount: orderscount
                })
            }
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Website Orders",
        response: []
    })
}

// Get website order details
module.exports.getWebsiteOrderDetails = async (req, res) => {
    try {
        const schema = Joi.object({
            orderheaderid: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetails(req.body)
            return res.send({
                status: true,
                message: "Website order details retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Website Order Details",
        response: []
    })
}

// Update website order status
module.exports.updateWebsiteOrderStatus = async (req, res) => {
    try {
        const schema = (req.body.status == 5) ? Joi.object({
            status: Joi.number().strict().required(),
            orders: Joi.array().items(
                Joi.object({
                    orderheaderid: Joi.number().required(),
                    logdate: Joi.string().required(),
                    comments: Joi.string().optional(),
                    userid: Joi.number().required()
                })
            ),
            available: Joi.string().required(),
            occupied: Joi.string().required()
        }) :
            Joi.object({
                status: Joi.number().strict().required(),
                orders: Joi.array().items(
                    Joi.object({
                        orderheaderid: Joi.number().required(),
                        logdate: Joi.string().required(),
                        comments: Joi.string().optional(),
                        userid: Joi.number().required()
                    })
                )
            });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateOrderStatus(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: `Website Order ${response[1]} Successfully!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Website Order Status",
    })
}

// Get website order counts
module.exports.getWebsiteOrderCounts = async (req, res) => {
    try {
        const schema = Joi.object({
            tenantid: Joi.number().optional(),
            from: Joi.optional(),
            to: Joi.optional(),
            all: Joi.number().optional()
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrdersCount(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Website order counts retrieved successfully!",
                    response: response
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Website Order Counts",
        response: []
    })
}

// Original updateOrderStatus function (kept for backward compatibility)
module.exports.updateOrderStatus = async (req, res) => {
    try {
        const schema = (req.body.status == 5) ? Joi.object({
            status: Joi.number().strict().required(),
            orders: Joi.array().items(
                Joi.object({
                    orderheaderid: Joi.number().required(),
                    logdate: Joi.string().required(),
                    comments: Joi.string().optional(),
                    userid: Joi.number().required()
                })
            ),
            available: Joi.string().required(),
            occupied: Joi.string().required()
        }) :
            Joi.object({
                status: Joi.number().strict().required(),
                orders: Joi.array().items(
                    Joi.object({
                        orderheaderid: Joi.number().required(),
                        logdate: Joi.string().required(),
                        comments: Joi.string().optional(),
                        userid: Joi.number().required()
                    })
                )
            });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateOrderStatus(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: `Order ${response[1]} Successfully!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.updateOrderProductStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            status: Joi.number().strict().required(),
            orders: Joi.array().items(
                Joi.object({
                    orderheaderid: Joi.number().required(),
                    orderdetailid: Joi.number().required(),
                    logdate: Joi.string().required(),
                    comments: Joi.string().optional(),
                    userid: Joi.number().required()
                })
            ),
            available: Joi.string().optional(),
            occupied: Joi.string().optional()
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateOrderProductStatus(req.body)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.updateOrderItemStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            itemId: Joi.number().strict().required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateOrderItemStatus(req.body)

            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.getOrderLogs = async (req, res) => {
    try {
        const response = await userService.getOrderLogs(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed!",
        response: []
    })
}

module.exports.chats = async (req, res) => {
    try {
        const schema = Joi.object({
            tenantid: Joi.number().required(),
            comments: Joi.string().required(),
            orderheaderid: Joi.number().required(),
            orderdetailid: Joi.number().optional(),
            comments: Joi.string().required(),
            usertype: Joi.number().required(),
            adminid: Joi.number().optional(),
            msgid: Joi.number().optional(),
            mode: Joi.number().required()
        })

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        }

        const response = await userService.chats(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed!",
    })
}
module.exports.getChatsByOrderheaderid = async (req, res) => {
    try {
        const response = await userService.getChatsByOrderheaderid(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed!",
        response: []
    })
}
module.exports.getAllChats = async (req, res) => {
    try {
        const response = await userService.getAllChats(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed!",
        response: []
    })
}

module.exports.updateOrderShipmentDetails = async (req, res) => {
    try {
        const { order_id } = req.body;
        var errors = [];
        if (!(order_id)) {
            errors.push("order_id is required");
        }

        if (!_.isEmpty(errors)) {
            return res.send({
                status: false,
                message: _.get(errors, "[0]"),
            });
        }
        const response = await userService.updateShipmentData(req.body);


        //  const validationResult = schema.validate({ order_id: order_id });
        //  if(!_.isEmpty(validationResult.error)){
        //      return res.send({
        //          status: false,
        //          message: `${validationResult.error.details[0].message}`
        //       })
        //  }
        // const response = await userService.updateShipmentData(req.body);

        if ((response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.adminMessages = async (req, res) => {
    try {
        const response = await userService.getAdminMessages(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }
        else {
            return res.send({
                status: false,
                message: `No Messages Discovered`,
                response: []
            })
        }

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getCouriers = async (req, res) => {
    try {
        const response = await userService.getCouriers()

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }
}

module.exports.getordersbycourier = async (req, res) => {
    try {
        const { courier_id } = req.body;
        var errors = [];
        if (!(courier_id)) {
            errors.push("courier_id is required");
        }

        if (!_.isEmpty(errors)) {
            return res.send({
                status: false,
                message: _.get(errors, "[0]"),
            });
        }
        const response = await userService.getOrdersbycourier(req.body)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }

    return res.send({
        status: true,
        message: `failed!`,
        response: []
    })

}

module.exports.getOrderDetailsNew = async (req, res) => {
    try {
        const schema = Joi.object({
            orderheaderid: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsNew(req.body)
            return res.send({
                status: false,
                message: "Failed To Retrieve Orders",
                response: response
            })
            //const orderscount = await userService.getOrdersCount(req.body)
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllOrderDetailsNew = async (req, res) => {
    try {
        //     const schema = Joi.object({  
        //         orderheaderid: Joi.number().required()
        //       });

        //     const validationResult = schema.validate(req.body);

        //    if(!_.isEmpty(validationResult.error)){
        //              return res.send({
        //                 status: false,
        //                 message: `${validationResult.error.details[0].message}`
        //              })
        //    }else{
        const response = await userService.getAllOrderDetailsNew(req.body)
        return res.send({
            status: true,
            message: "Orders retrieved successfully!",
            response: response
        })
        //const orderscount = await userService.getOrdersCount(req.body)
        //}
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllLiveOrderDetails = async (req, res) => {
    try {
        //     const schema = Joi.object({  
        //         orderheaderid: Joi.number().required()
        //       });

        //     const validationResult = schema.validate(req.body);

        //    if(!_.isEmpty(validationResult.error)){
        //              return res.send({
        //                 status: false,
        //                 message: `${validationResult.error.details[0].message}`
        //              })
        //    }else{
        const response = await userService.getAllLiveOrderDetails(req.body)
        return res.send({
            status: true,
            message: "Orders retrieved successfully!",
            response: response
        })
        //const orderscount = await userService.getOrdersCount(req.body)
        //}
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllOrdersNew = async (req, res) => {
    try {
        const response = await userService.getAllOrdersNew()
        return res.send({
            status: true,
            message: "Orders retrieved successfully!",
            response: response
        })

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getOrderDetailsById = async (req, res) => {
    try {
        const { orderheaderid } = req.body
        const schema = Joi.object({
            orderheaderid: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsById(orderheaderid)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getOrderedItemDetailsById = async (req, res) => {
    try {
        const { itemId } = req.body
        const schema = Joi.object({
            itemId: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderedItemDetailsById(itemId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllPickListedOrderDetails = async (req, res) => {
    try {
        const response = await userService.getAllPickListedOrderDetails(req.body)
        return res.send({
            status: true,
            message: "Orders retrieved successfully!",
            response: response
        })

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getAllTobePrintedOrderDetails = async (req, res) => {
    try {
        const response = await userService.getAllTobePrintedOrderDetails(req.body)
        return res.send({
            status: true,
            message: "Orders retrieved successfully!",
            response: response
        })
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getOrderDetailsByOrderId = async (req, res) => {
    try {
        const { orderId } = req.body
        const schema = Joi.object({
            orderId: Joi.string().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsByOrderId(orderId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getPickedForToBePrinted = async (req, res) => {
    try {
        const { orderId } = req.body
        const schema = Joi.object({
            orderId: Joi.string().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getPickedForToBePrinted(orderId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.fetchOrdersForAllOrdersManage = async (req, res) => {
    try {
        const { orderId } = req.body
        const schema = Joi.object({
            orderId: Joi.string().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.fetchOrdersForAllOrdersManage(orderId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.updateItemStatusForManageAllorders = async (req, res) => {
    try {
        const schema = Joi.object({
            itemIds: Joi.array().items(Joi.string().required()).required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateItemStatusForManageAllorders(req.body.itemIds)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.updateDispatchStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            itemIds: Joi.array().items(Joi.string().required()).required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateDispatchStatus(req.body.itemIds)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.updateIndividualItemStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            itemId: Joi.string().required(),
            userId: Joi.number().required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateIndividualItemStatus(req.body.itemId, req.body.userId)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

// New function for store orders - similar to updateIndividualItemStatus
module.exports.updateStoreOrderItemStatus = async (req, res) => {
    try {
        const schema = Joi.object({
            orderId: Joi.required(),
            // userId: Joi.number().required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateStoreOrderItemStatus(req.body.orderId, 1)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Store order item status updated successfully!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Store Order Item Status",
    })
}

module.exports.updateDispatchStatusWithShipmentDetails = async (req, res) => {
    try {
        const schema = Joi.object({
            orderId: Joi.string().required()
        });
        const orderId = req.body.orderId;
        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateDispatchStatusWithShipmentDetails(orderId)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.getOrderDetailsByIdForPickList = async (req, res) => {
    try {
        const { orderheaderId } = req.body
        const schema = Joi.object({
            orderheaderId: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsByIdForPickList(orderheaderId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getOrderDetailsByIdForPickListPdf = async (req, res) => {
    try {
        const { orderheaderId } = req.body
        const schema = Joi.object({
            orderheaderId: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsByIdForPickListPdf(orderheaderId)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.updateIndividualItemFromScanner = async (req, res) => {
    try {
        const schema = Joi.object({
            itemId: Joi.number().required(),
            userId: Joi.number().required(),
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.updateIndividualItemFromScanner(req.body.itemId, req.body.userId)
            if (!_.isNull(response)) {
                return res.send({
                    status: true,
                    message: `Success!`,
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Update Order Status",
    })
}

module.exports.getOrderDetailsForInvoice = async (req, res) => {
    try {
        const { orderheaderid } = req.body
        const schema = Joi.object({
            orderheaderid: Joi.number().required()
        });

        const validationResult = schema.validate(req.body);

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.getOrderDetailsForInvoice(orderheaderid)
            return res.send({
                status: true,
                message: "Orders retrieved successfully!",
                response: response
            })
        }
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Orders",
        response: []
    })
}

module.exports.getOrderLable = async (req, res) => {
    try {
        const { orderid } = req.body;
        var errors = [];
        if (!(orderid)) {
            errors.push("orderid is required");
        }

        if (!_.isEmpty(errors)) {
            return res.send({
                status: false,
                message: _.get(errors, "[0]"),
            });
        }
        const response = await userService.getOrderLable(orderid)

        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: `Success!`,
                response: response
            })
        }

    } catch (err) {
        console.log("error", err)
    }

    return res.send({
        status: true,
        message: `failed!`,
        response: []
    })

}


module.exports.guestOrderEmail = async (req, res) => {
    try {
        const { shippingDetails, placementDetails, productDetails, totalValue } = req.body;

        let errors = [];

        if (!shippingDetails) {
            errors.push("Shipping details are required.");
        } else {
            const { paymentMode, pinCode, customerName, mobile, email, shippingAddress, city, state } = shippingDetails;
            if (!paymentMode) errors.push("Payment mode is required.");
            if (!pinCode) errors.push("Pin code is required.");
            if (!customerName) errors.push("Customer name is required.");
            if (!mobile) errors.push("Mobile number is required.");
            if (!email) errors.push("Email is required.");
            if (!shippingAddress) errors.push("Shipping address is required.");
            if (!city) errors.push("City is required.");
            if (!state) errors.push("State is required.");
        }

        if (!placementDetails || !Array.isArray(placementDetails) || placementDetails.length === 0) {
            errors.push("Placement details are required and must be an array.");
        } else {
            placementDetails.forEach((placement, index) => {
                const { sku, printingType, designUrl, mockupUrl, Width, Height, placement: placementName } = placement;
                if (!sku) errors.push(`Placement[${index}]: SKU is required.`);
                if (!printingType) errors.push(`Placement[${index}]: Printing type is required.`);
                if (!designUrl) errors.push(`Placement[${index}]: Design URL is required.`);
                if (!mockupUrl) errors.push(`Placement[${index}]: Mockup URL is required.`);
                if (!Width) errors.push(`Placement[${index}]: Width is required.`);
                if (!Height) errors.push(`Placement[${index}]: Height is required.`);
                if (!placementName) errors.push(`Placement[${index}]: Placement name is required.`);
            });
        }

        if (!productDetails || !Array.isArray(productDetails) || productDetails.length === 0) {
            errors.push("Product details are required and must be an array.");
        } else {
            productDetails.forEach((product, index) => {
                const { productSku, quantity, productOriginalPrice, totalProductsPrice, printAndHandling, total } = product;
                if (!productSku) errors.push(`Product[${index}]: Product SKU is required.`);
                if (!quantity) errors.push(`Product[${index}]: Quantity is required.`);
                if (!productOriginalPrice) errors.push(`Product[${index}]: Product original price is required.`);
                if (!totalProductsPrice) errors.push(`Product[${index}]: Total products price is required.`);
                if (!printAndHandling) errors.push(`Product[${index}]: Print and handling is required.`);
                if (!total) errors.push(`Product[${index}]: Total is required.`);
            });
        }
        // Validate `totalValue`
        if (!totalValue) {
            errors.push("Total value is required.");
        } else {
            const { shippingCharge, giftWrap, total, orderValue } = totalValue;
            if (!shippingCharge) errors.push("Shipping charge is required.");
            if (!giftWrap) errors.push("Gift wrap is required.");
            if (!total) errors.push("Total value is required.");
            if (!orderValue) errors.push("Order value is required.");
        }
        // If there are errors, return them
        if (errors.length > 0) {
            return res.status().send({
                status: false,
                message: "Validation failed.",
                errors: errors
            });
        }

        // Build HTML email
        const emailTemplate = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Placed Confirmation</title>
        </head>
        <body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #F4F4F4;">
            <div style="max-width: 600px; margin: auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                <div style="background-color: #4CAF50; color: white; padding: 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">🎉 Order Placed Successfully!</h1>
                    <p style="margin: 0; font-size: 16px;">Thank you for shopping with us.</p>
                </div>
                <div style="padding: 20px; color: #333;">
                    <h2 style="margin-bottom: 10px; font-size: 18px; color: #4CAF50;">Order Summary</h2>
                    <p><strong>Order ID:</strong> 4548</p>
                    <h3 style="margin-top: 20px; margin-bottom: 10px; font-size: 16px; color: #4CAF50;">Shipping Details</h3>
                    <p><strong>Customer Name:</strong> ${shippingDetails.customerName}</p>
                    <p><strong>Mobile:</strong> ${shippingDetails.mobile}</p>
                    <p><strong>Email:</strong> ${shippingDetails.email}</p>
                    <p><strong>Address:</strong> ${shippingDetails.shippingAddress}, ${shippingDetails.city}, ${shippingDetails.state}, ${shippingDetails.pinCode}</p>
                </div>
                <div style="padding: 20px; color: #333; background-color: #F9F9F9; border-top: 1px solid #ddd;">
                    <h2 style="margin-bottom: 10px; font-size: 18px; color: #4CAF50;">Placement Details</h2>
                    ${placementDetails.map((placement, index) => `
                    <div style="margin-top: 15px; padding: 15px; border: 1px solid #ddd; border-radius: 8px; background-color: #fff;">
                        <p><strong>Placement #${index + 1}:</strong></p>
                        <p><strong>SKU:</strong> ${placement.sku}</p>
                        <p><strong>Printing Type:</strong> ${placement.printingType}</p>
                        <p><strong>Dimensions:</strong> ${placement.Width} x ${placement.Height}</p>
                        <p><strong>Design URL:</strong> <a href="${placement.designUrl}" target="_blank">View Design</a></p>
                        <p><strong>Mockup:</strong> <img src="${placement.mockupUrl}" alt="Mockup" style="width: 100px; height: auto;"></p>
                    </div>
                    `).join("")}
                </div>
                <div style="padding: 20px; color: #333;">
                    <h2 style="margin-bottom: 10px; font-size: 18px; color: #4CAF50;">Payment Details</h2>
                    <p><strong>Shipping Charge:</strong> ₹${totalValue.shippingCharge}</p>
                    <p><strong>Gift Wrap:</strong> ₹${totalValue.giftWrap}</p>
                    <p><strong>Total:</strong> ₹${totalValue.total}</p>
                    <p><strong>Order Value:</strong> ₹${totalValue.orderValue}</p>
                </div>
                <div style="background-color: #F4F4F4; padding: 15px; text-align: center; font-size: 12px; color: #666;">
                    <p style="margin: 0;">Need Help? <a href="#" style="color: #4CAF50; text-decoration: none;">Contact Us</a></p>
                    <p style="margin: 0;">&copy; 2024 Your Company Name. All Rights Reserved.</p>
                </div>
            </div>
        </body>
        </html>
        `;

        // Configure email
        const transporter = nodemailer.createTransport({
            service: 'gmail', // Use your email provider
            auth: {
                user: "care@deeprintz.com", // Replace with your email
                pass: "tmfb ojib aydr kkpl"  // Replace with your password
            }
        });

        const mailOptions = {
            from: '"Deeprintz" <care@deeprintz.com>',
            to: shippingDetails.email,
            subject: 'Order Confirmation',
            html: emailTemplate
        };

        // Send email
        await transporter.sendMail(mailOptions);

        return res.send({
            status: true,
            message: "Order confirmation email sent successfully."
        });

    } catch (err) {
        console.error("Error:", err);
        return res.status().send({
            status: false,
            message: "Internal server error.",
            response: []
        });
    }
};

module.exports.getCourierPartners = async (req, res) => {
    try {
        const { postCode, paymentMode, weight, orderAmount } = req.body;

        var errors = [];
        if (!(postCode)) {
            errors.push("postCode is required");
        }
        if (!(paymentMode)) {
            errors.push("paymentMode is required");
        }
        if (!(weight)) {
            errors.push("weight is required");
        }
        if (!(orderAmount)) {
            errors.push("orderAmount is required");
        }
        if (!_.isEmpty(errors)) {
            return res.send({
                status: false,
                message: _.get(errors, "[0]"),
            });
        }
        const token = await this.generateToken()

        if (!_.isEmpty(token)) {
            const courierPartners = await this.fetchCourierPartners(token.data, postCode, paymentMode, weight, orderAmount)
            if (courierPartners) {
                return res.send({
                    status: true,
                    message: `Courier partners fetched successfully!`,
                    response: courierPartners
                })
            }
        }

    } catch (err) {
        console.log("error", err)
    }

    return res.send({
        status: true,
        message: `Failed to fetch courier partners!`,
        response: []
    })

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

module.exports.fetchCourierPartners = async (token, postCode, paymentMode, weight, orderAmount) => {
    try {
        console.log(token)
        const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
        const data = {
            origin: "641603", // Static origin
            destination: postCode,
            payment_type: payment_type,
            order_amount: payment_type === 'cod' ? orderAmount : "",
            weight: weight,
            length: "",  // Optional, add if needed
            breadth: "", // Optional, add if needed
            height: ""   // Optional, add if needed
        };

        const baseURL = "https://api.nimbuspost.com/v1/";

        const response = await axios.post(`${baseURL}courier/serviceability`, data, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        const result = response.data;
        if (result.status) {
            const courierData = result.data;
            return courierData;
        }
        return null;
    } catch (err) {
        console.log("error", err)
    }
    return null;
}


module.exports.updatedeliverystatus = async (req, res) => {
    try {

        const response = await userService.updatedeliverystatusservice(req)

        return res.status(200).send(true)


    } catch (err) {
        console.log("error", err)
        return res.status(500).send({
            status: false,
            message: "Failed To Update Order Status",
        })
    }

}

module.exports.getAllStoreOrders = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            status,
            vendor_id,
            store_url,
            start_date,
            end_date,
            order_number,
            customer_email,
            sort_by = 'date_created',
            sort_order = 'desc'
        } = req.query;

        // Build main orders query (without order items first) - Use proper aliases to prevent duplicates
        let query = global.dbConnection('woocommerce_orders as wo')
            .select(
                'wo.*',
                'ws.store_url',
                'ws.store_name',
                'au.authname as vendor_username',
                'au.email as vendor_email'
            )
            .leftJoin('woocommerce_stores as ws', 'wo.vendor_id', 'ws.user_id')
            .leftJoin('app_users as au', 'wo.vendor_id', 'au.userid')
            .groupBy('wo.id'); // Group by order ID to prevent duplicates from JOINs

        // Apply filters
        if (status) {
            query = query.where('wo.status', status);
        }

        if (vendor_id) {
            query = query.where('wo.vendor_id', vendor_id);
        }

        if (store_url) {
            query = query.where('ws.store_url', 'like', `%${store_url}%`);
        }

        if (order_number) {
            query = query.where('wo.order_number', 'like', `%${order_number}%`);
        }

        if (customer_email) {
            query = query.where('wo.customer_email', 'like', `%${customer_email}%`);
        }

        if (start_date && end_date) {
            query = query.whereBetween('wo.date_created', [start_date, end_date]);
        } else if (start_date) {
            query = query.where('wo.date_created', '>=', start_date);
        } else if (end_date) {
            query = query.where('wo.date_created', '<=', end_date);
        }

        // Get total count for pagination - Use a separate count query to avoid JOIN issues
        const totalCountQuery = global.dbConnection('woocommerce_orders as wo')
            .leftJoin('woocommerce_stores as ws', 'wo.vendor_id', 'ws.user_id')
            .leftJoin('app_users as au', 'wo.vendor_id', 'au.userid');

        // Apply the same filters to count query
        if (status) {
            totalCountQuery.where('wo.status', status);
        }
        if (vendor_id) {
            totalCountQuery.where('wo.vendor_id', vendor_id);
        }
        if (store_url) {
            totalCountQuery.where('ws.store_url', 'like', `%${store_url}%`);
        }
        if (order_number) {
            totalCountQuery.where('wo.order_number', 'like', `%${order_number}%`);
        }
        if (customer_email) {
            totalCountQuery.where('wo.customer_email', 'like', `%${customer_email}%`);
        }
        if (start_date && end_date) {
            totalCountQuery.whereBetween('wo.date_created', [start_date, end_date]);
        } else if (start_date) {
            totalCountQuery.where('wo.date_created', '>=', start_date);
        } else if (end_date) {
            totalCountQuery.where('wo.date_created', '<=', end_date);
        }

        const totalCountResult = await totalCountQuery.count('wo.id as total').first();
        const total = parseInt(totalCountResult?.total) || 0;

        // Apply sorting
        const validSortColumns = [
            'date_created', 'date_modified', 'total', 'order_number',
            'customer_name', 'status', 'vendor_id'
        ];

        const sortColumn = validSortColumns.includes(sort_by) ? sort_by : 'date_created';
        const sortDirection = sort_order.toLowerCase() === 'asc' ? 'asc' : 'desc';

        query = query.orderBy(`wo.${sortColumn}`, sortDirection);

        // Apply pagination
        const offset = (page - 1) * limit;
        query = query.offset(offset).limit(limit);

        // Execute query to get orders
        const orders = await query;

        // Debug: Log the number of orders retrieved to help identify duplicates
        console.log(`🔍 Retrieved ${orders.length} orders from database`);

        // If no orders found, return empty response
        if (orders.length === 0) {
            return res.json({
                success: true,
                data: [],
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: 0,
                    totalPages: 0,
                    hasNext: false,
                    hasPrev: false,
                    nextPage: null,
                    prevPage: null
                },
                filters: {
                    status,
                    vendor_id,
                    store_url,
                    start_date,
                    end_date,
                    order_number,
                    customer_email,
                    sort_by: sortColumn,
                    sort_order: sortDirection
                }
            });
        }

        // Get all order IDs to fetch order items in bulk
        const orderIds = orders.map(order => order.id);

        // Debug: Log order IDs to verify uniqueness
        console.log(`🔍 Order IDs: ${orderIds.join(', ')}`);
        console.log(`🔍 Unique order IDs: ${[...new Set(orderIds)].join(', ')}`);

        // Fetch order items for all orders - Use proper aliases and groupBy to prevent duplicates
        const orderItems = await global.dbConnection('woocommerce_order_items as woi')
            .leftJoin('shopify_products', function () {
                this.on(
                    global.dbConnection.raw("JSON_EXTRACT(woi.meta_data, '$.shopifyProductId')"),
                    '=',
                    'shopify_products.id'
                );
            })
            .leftJoin('products as p', function () {
                this.on(
                    global.dbConnection.raw("JSON_EXTRACT(woi.meta_data, '$.deeprintzProductId')"),
                    '=',
                    'p.productid'
                );
            })
            .whereIn('woi.order_id', orderIds)
            .groupBy('woi.id') // Group by order item ID to prevent duplicates
            .select(
                'woi.*',
                'p.productid',
                'p.productname',
                'shopify_products.designurl as ordereditemdesignurl',
                'shopify_products.height as ordereditemheight',
                'shopify_products.width as ordereditemwidth'
            );

        // Debug: Log the number of order items retrieved
        console.log(`🔍 Retrieved ${orderItems.length} order items from database`);

        // Group order items by order_id for easy access
        const orderItemsMap = orderItems.reduce((map, item) => {
            if (!map[item.order_id]) {
                map[item.order_id] = [];
            }

            // Parse meta_data for each item
            let parsedMetaData = {};
            try {
                parsedMetaData = item.meta_data ? JSON.parse(item.meta_data) : {};
            } catch (e) {
                console.error('Error parsing meta_data for order item:', item.id, e);
                parsedMetaData = {};
            }

            map[item.order_id].push({
                id: item.id,
                product_id: item.product_id,
                variation_id: item.variation_id,
                name: item.name,
                deeprintzProductId: item.deeprintzProductId,
                deeprintzProductName: item.productname,
                quantity: item.quantity,
                subtotal: item.subtotal,
                total: item.total,
                sku: item.sku,
                price: item.price,
                meta_data: parsedMetaData,
                created_at: item.created_at,
                ordereditemdesignurl: item.ordereditemdesignurl,
                ordereditemheight: item.ordereditemheight,
                ordereditemwidth: item.ordereditemwidth
            });

            return map;
        }, {});

        // Debug: Log the order items mapping to verify structure
        console.log(`🔍 Order items mapped to ${Object.keys(orderItemsMap).length} orders`);

        // Parse JSON fields and attach order items
        const parsedOrders = orders.map(order => {
            // Parse all JSON fields from the order
            let lineItems = [];
            let billingAddress = {};
            let shippingAddress = {};
            let discountCodes = [];
            let couponLines = [];
            let feeLines = [];
            let shippingLines = [];
            let taxLines = [];
            let refunds = [];
            let metaData = [];

            try {
                lineItems = order.line_items ? JSON.parse(order.line_items) : [];
                billingAddress = order.billing_address ? JSON.parse(order.billing_address) : {};
                shippingAddress = order.shipping_address ? JSON.parse(order.shipping_address) : {};
                discountCodes = order.discount_codes ? JSON.parse(order.discount_codes) : [];
                couponLines = order.coupon_lines ? JSON.parse(order.coupon_lines) : [];
                feeLines = order.fee_lines ? JSON.parse(order.fee_lines) : [];
                shippingLines = order.shipping_lines ? JSON.parse(order.shipping_lines) : [];
                taxLines = order.tax_lines ? JSON.parse(order.tax_lines) : [];
                refunds = order.refunds ? JSON.parse(order.refunds) : [];
                metaData = order.meta_data ? JSON.parse(order.meta_data) : [];
            } catch (e) {
                console.error('Error parsing JSON fields for order:', order.id, e);
            }

            // Extract shipment details from order fields
            const shipmentDetails = {
                awb_code: order.awb_code || null,
                courier_company_id: order.courier_company_id || null,
                courier_name: order.courier_name || null,
                shipment_id: order.shipment_id || null,
                shipment_order_id: order.shipment_order_id || null,
                manifest_url: order.manifest_url || null,
                invoice_url: order.invoice_url || null,
                label_url: order.label_url || null,
                shiprocket_status: order.shiprocket_status || null
            };

            return {
                ...order,
                line_items: lineItems,
                billing_address: billingAddress,
                shipping_address: shippingAddress,
                discount_codes: discountCodes,
                coupon_lines: couponLines,
                fee_lines: feeLines,
                shipping_lines: shippingLines,
                tax_lines: taxLines,
                refunds: refunds,
                meta_data: metaData,
                order_items: orderItemsMap[order.id] || [], // Attach order items
                shipment_details: shipmentDetails // Add shipment details
            };
        });

        // Debug: Final validation - check for duplicate order IDs in the final result
        const finalOrderIds = parsedOrders.map(order => order.id);
        const uniqueOrderIds = [...new Set(finalOrderIds)];
        if (finalOrderIds.length !== uniqueOrderIds.length) {
            console.warn(`⚠️ WARNING: Duplicate orders detected! Expected ${uniqueOrderIds.length} unique orders, got ${finalOrderIds.length} total`);
            console.warn(`⚠️ Duplicate order IDs: ${finalOrderIds.filter((id, index) => finalOrderIds.indexOf(id) !== index).join(', ')}`);
        } else {
            console.log(`✅ No duplicate orders detected in final result`);
        }

        // Final safeguard: Remove any duplicate orders that might still exist
        const uniqueOrders = [];
        const seenOrderIds = new Set();

        for (const order of parsedOrders) {
            if (!seenOrderIds.has(order.id)) {
                seenOrderIds.add(order.id);
                uniqueOrders.push(order);
            } else {
                console.warn(`🔄 Removing duplicate order with ID: ${order.id}`);
            }
        }

        if (uniqueOrders.length !== parsedOrders.length) {
            console.log(`🔄 Removed ${parsedOrders.length - uniqueOrders.length} duplicate orders`);
        }

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);
        const hasNext = page < totalPages;
        const hasPrev = page > 1;

        return res.json({
            success: true,
            data: uniqueOrders, // Use the deduplicated orders
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                totalPages,
                hasNext,
                hasPrev,
                nextPage: hasNext ? parseInt(page) + 1 : null,
                prevPage: hasPrev ? parseInt(page) - 1 : null
            },
            filters: {
                status,
                vendor_id,
                store_url,
                start_date,
                end_date,
                order_number,
                customer_email,
                sort_by: sortColumn,
                sort_order: sortDirection
            }
        });

    } catch (error) {
        console.error('❌ Error in getAllStoreOrders:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching store orders',
            error: error.message
        });
    }
};

module.exports.testRoute = async (req, res) => {
    try {

        const { orderId } = req.body;
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
            .select('woocommerce_orders.line_items', 'woocommerce_orders.vendor_id', 'woocommerce_order_items.quantity', 'woocommerce_order_items.sku', 'woocommerce_orders.shipping_total')
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
                const updateOrderItems = await global.dbConnection('woocommerce_order_items')
                    .update({ status: 'live' })
                    .where({ order_id: orderId });

                console.log("📦 Order items status updated to live:", updateOrderItems);
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

// Store Order Move to Live Function
module.exports.storeOrderMoveLive = async (req, res) => {
    try {
        const schema = Joi.object({
            orderId: Joi.string().required()
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            });
        }

        const response = await userService.storeOrderUpdateWallet(req.body.orderId);
        if (response) {
            return res.send(response);
        } else {
            return res.send({
                status: false,
                message: `Failed to move store order to live`
            });
        }
    } catch (err) {
        console.log("error", err);
        return res.send({
            status: false,
            message: "Failed to move store order to live"
        });
    }
}

module.exports.normalOrderMoveLive = async (req, res) => {
    try {
        const schema = Joi.object({
            orderheaderid: Joi.string().required()
        });

        const validationResult = schema.validate(req.body);
        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            });
        }

        const response = await userService.normalOrderMoveLive(req.body.orderheaderid);
        if (response) {
            return res.send(response);
        } else {
            return res.send({
                status: false,
                message: `Failed to move normal order to live`
            });
        }
    } catch (err) {
        console.log("error", err);
        return res.send({
            status: false,
            message: "Failed to move normal order to live"
        });
    }
}