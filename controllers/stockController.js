const userService = require("../service/stockService")
const _ = require("lodash");
const Joi = require("joi")

module.exports.addStock = async (req, res) => {
    try {

        const schema = Joi.object({
            userid: Joi.number().required(),
            variantid: Joi.number().required(),
            locationCode: Joi.string().required(),
            styleCode: Joi.string().required(),
            quantity: Joi.number().required(),
            comments: Joi.string().required(),
            logdate: Joi.string().required()
        })

        const validationResult = schema.validate(req.body)

        if (!_.isEmpty(validationResult.error)) {
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        } else {
            const response = await userService.addStock(req.body)

            console.log("response", response)

            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Success!",
                })
            }
        }


    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to add stock"
    })
}


module.exports.getStockLogs = async (req, res) => {
    try {
    
        const response = await userService.getStockLogs(req.body)

         if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Success!",
                response: response
            })
         }     

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "No Data Found!",
        response: []
    })
}
module.exports.getAllStockLogs = async (req, res) => {
    try {
    
        const response = await userService.getAllStockLogs(req.body)

         if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Success!",
                response: response
            })
         }     

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "No Data Found!",
        response: []
    })
}
module.exports.getVariantQuantity = async (req, res) => {
    try {
    
        const response = await userService.getVariantQuantity(req.body)

         if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Success!",
                response: response
            })
         }     

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "No Data Found!",
        response: []
    })
}
module.exports.getAvalaibleRacks = async (req, res) => {
    try {
    
        const response = await userService.getAvalaibleRacks(req.body)

         if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Success!",
                response: response
            })
         }     

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "No Data Found!",
        response: []
    })
}

module.exports.stockBulkUpload = async (req, res) => {
    try {
        const schema = Joi.array().items(
            Joi.object({
                variantid: Joi.number().required(),
                locationCode: Joi.string().required(),
                styleCode: Joi.string().required(),
                quantity: Joi.number().required(),
                comments: Joi.string().required()
            })
        );
        const validationResult = schema.validate(req.body);
        if (validationResult.error) {
            return res.status(400).send({
                status: false,
                message: validationResult.error.details[0].message
            });
        }
        const bulkData = req.body.map(item => ({
            variantid: item.variantid,
            locationCode: item.locationCode,
            styleCode: item.styleCode,
            quantity: item.quantity,
            comments: item.comments
        }));
        const response = await userService.bulkAddStock(bulkData);
        // if (response && response.length > 0) {
        //     return res.send({
        //         status: true,
        //         message: "Success!",
        //         insertedCount: response.length
        //     });
        // }
        return res.send({
            status: true,
            message: "Success!"
        });
    } catch (err) {
        console.error("Error", err);
        return res.status(500).send({
            status: false,
            message: "Failed to add stock"
        });
    }
    return res.status(500).send({
        status: false,
        message: "Failed to add stock"
    });
};


