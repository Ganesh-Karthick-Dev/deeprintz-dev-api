const userService = require("../../service/order/cartService")
const _ = require("lodash");
const Joi = require('joi')

module.exports.addtocart = async (req, res) => {
    try {
        const response = await userService.addtocart(req.body)
            if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Product added in cart successfully",
                    response: response
                })
            }
    
    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to add products in cart",
        response: []
    })
}

module.exports.removefromcart = async(req,res) => {
    try{
      const schema = Joi.object({
        cartid : Joi.number().required()
      })

      const validationResult = schema.validate(req.body)

      if(!_.isEmpty(validationResult.error)){
        return res.send({
            status: false,
            message: `${validationResult.error.details[0].message}`
         })
      }else{
      const response = await userService.removefromcart(req.body);

      if(response == 1){
        return res.send({
            status: true,
            message: "removed from cart"
        })
      }
    }
    }catch(err){
      console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to remove"
    })
}

module.exports.getcartitemsbytenantid = async(req,res) => {
    try{
        const response = await userService.getcartitemsbytenantid(req.body)

        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Cart items retrieved successfully",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed to retrieve cart items",
        response: []
    })
}

module.exports.getProductByCartid = async(req,res) => {
    try{
        const response = await userService.getProductByCartid(req.body)

        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Sucess!",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed!",
        response: []
    })
}

module.exports.addAndRemoveWishlist = async(req,res) => {
    try{
        const { userId, productId, status } = req.body;

        let errors = [];

        if (!userId) {
            errors.push("userId are required.");
        } 
        if (!productId) {
            errors.push("productId are required.");
        }
        if (!status) {
            errors.push("status are required.");
        }

        if (errors.length > 0) {
            return res.status().send({
                status: false,
                message: "Validation failed.",
                errors: errors
            });
        }
        
        if(status == "0"){
            var add = await userService.addWishlist(userId, productId);
        }

        if(status == "1"){
            var add = await userService.removeWishlist(userId, productId);
        }

        if(add) {
            return res.send({
                status: add.status,
                message: add.message
            })
        }

    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed!"
        //response: []
    })
}

module.exports.getWishlist = async(req,res) => {
    try{
        const { userId, productId, status } = req.body;

        let errors = [];

        if (!userId) {
            errors.push("userId are required.");
        } 

        if (errors.length > 0) {
            return res.status().send({
                status: false,
                message: "Validation failed.",
                errors: errors
            });
        }

        const response = await userService.getWishlist(userId)

        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Wishlist retrieved successfully",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed to retrieve wishlist",
        response: []
    })
}