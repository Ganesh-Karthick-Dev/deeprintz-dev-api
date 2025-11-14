const userService = require("../service/paymentService")
const _ = require("lodash");
const Joi = require('joi')
const Razorpay = require("razorpay");


// test
// const razorpayInstance = new Razorpay({
//   key_id: "rzp_test_5EHOw3AM95nGU0",
//   key_secret: "HnlDr0IIsybCeDBdxIZCTAAj",
// });
// test

// live
const razorpayInstance = new Razorpay({
    key_id: "rzp_live_isnJ14M3b6xDCK",
    key_secret: "U3OjIzIxzQJYTALESZ6mUfLC",
  });
  // live


module.exports.addPaymentDetails = async (req, res) => {
    try {
        const response = await userService.addPaymentDetails(req.body)
            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Payment Completed Successfully!",
                    wallet: response[0]
                })
            }
    
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}
module.exports.updatePaymentStatus = async (req, res) => {
    try {
        const response = await userService.updatePaymentStatus(req.body)
            if (response >= 1) {
                return res.send({
                    status: true,
                    message: "Sucess!"
                })
            }
    
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}
module.exports.getAllPayments = async (req, res) => {
    try {
        const response = await userService.getAllPayments(req.body)
            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Sucess!",
                    response
                })
            }
    
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}
module.exports.getPaymentHistory = async (req, res) => {
    try {
        const response = await userService.getPaymentHistory(req.body)
            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Sucess!",
                    response
                })
            }
    
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed!",
        response: []
    })
}

module.exports.createRazorpayIntent = async (req, res) => {
    try {
        const { userId, amount } = req.body;

        let errors = [];

        if (!userId) {
            errors.push("userId are required.");
        } 
        if (!amount) {
            errors.push("amount are required.");
        }
        if (errors.length > 0) {
            return res.status().send({
                status: false,
                message: "Validation failed.",
                errors: errors
            });
        }
        const receipt = `receipt_${Date.now()}`;
        const currency = "INR"
        const order = await razorpayInstance.orders.create({
            amount: amount * 100, // Amount in paise
            currency,
            receipt,
            
        });

        return res.send({
            status: true,
            message: "success!",
            order: order
        })

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}

module.exports.getAllTransactionHistory = async (req, res) => {
    try {
        const response = await userService.getAllTransactionHistory();
        if (!_.isEmpty(response)) {
            return res.send({
                status: true,
                message: "Success!",
                response
            });
        }
    } catch (err) {
        console.log("error", err);
    }
    return res.send({
        status: false,
        message: "Failed!",
        response: []
    });
}

module.exports.adminAddMoneyToWallet = async (req, res) => {
    try {
        const { tenant_id, amount, admin_id, reason } = req.body;
        
        // Validation
        let errors = [];
        if (!tenant_id) {
            errors.push("tenant_id is required");
        }
        if (!amount || amount <= 0) {
            errors.push("amount is required and must be greater than 0");
        }
        if (!admin_id) {
            errors.push("admin_id is required");
        }
        
        if (errors.length > 0) {
            return res.status(400).send({
                status: false,
                message: "Validation failed",
                errors: errors
            });
        }
        
        const response = await userService.adminAddMoneyToWallet({
            tenant_id,
            amount,
            admin_id,
            reason
        });
        
        if (response.success) {
            return res.send({
                status: true,
                message: response.message,
                data: response.data
            });
        } else {
            return res.status(400).send({
                status: false,
                message: response.message,
                error: response.error
            });
        }
        
    } catch (err) {
        console.log("error", err);
        return res.status(500).send({
            status: false,
            message: "Internal server error",
            error: err.message
        });
    }
}

module.exports.detectPaymentFlow = async (req, res) => {
    try {
        const { tenant_id } = req.body;
        
        // tenant_id is required
        if (!tenant_id) {
            return res.status(400).send({
                status: false,
                message: "tenant_id is required"
            });
        }
        
        const response = await userService.detectPaymentFlow({
            tenant_id
        });
        
        if (response.success) {
            return res.send({
                status: true,
                message: response.message,
                data: response.data,
                summary: response.summary
            });
        } else {
            return res.status(400).send({
                status: false,
                message: response.message,
                data: response.data || []
            });
        }
        
    } catch (err) {
        console.log("error", err);
        return res.status(500).send({
            status: false,
            message: "Internal server error",
            error: err.message
        });
    }
}

module.exports.adminSubtractMoneyFromWallet = async (req, res) => {
    try {
        const { tenant_id, amount } = req.body;
        
        // Validation
        let errors = [];
        if (!tenant_id) {
            errors.push("tenant_id is required");
        }
        if (!amount || amount <= 0) {
            errors.push("amount is required and must be greater than 0");
        }
        
        if (errors.length > 0) {
            return res.status(400).send({
                status: false,
                message: "Validation failed",
                errors: errors
            });
        }
        
        const response = await userService.adminSubtractMoneyFromWallet({
            tenant_id,
            amount
        });
        
        if (response.success) {
            return res.send({
                status: true,
                message: response.message,
                data: response.data
            });
        } else {
            return res.status(400).send({
                status: false,
                message: response.message,
                data: response.data
            });
        }
        
    } catch (err) {
        console.log("error", err);
        return res.status(500).send({
            status: false,
            message: "Internal server error",
            error: err.message
        });
    }
}

module.exports.getWalletBalance = async (req, res) => {
    try {
        const { tenant_id } = req.body;
        
        // tenant_id is required
        if (!tenant_id) {
            return res.status(400).send({
                status: false,
                message: "tenant_id is required"
            });
        }
        
        const response = await userService.getWalletBalance({
            tenant_id
        });
        
        if (response.success) {
            return res.send({
                status: true,
                message: response.message,
                data: response.data
            });
        } else {
            return res.status(400).send({
                status: false,
                message: response.message
            });
        }
        
    } catch (err) {
        console.log("error", err);
        return res.status(500).send({
            status: false,
            message: "Internal server error",
            error: err.message
        });
    }
}