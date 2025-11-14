const userService = require("../service/productAttributesService")
const _ = require("lodash")

module.exports.addProductAttributes = async (req,res) => {
    try{
        const response = await userService.addProductAttributes(req.body)
        
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "product Attributes added Successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add product Attributes"
    })
}

module.exports.updateProductAttributes = async (req,res) => {
    try{
        const response = await userService.updateProductAttributes({
            ...req.body
        })
        if(response == 1){
            return res.send({
                status: true,
                message: "Product Attribute updated successfully!",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update product attributes"
    })
}
module.exports.getProductAttributesbyTag =  async (req,res) => {
    try{
        const response = await userService.getProductAttributesbyTag(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive"
    })
}
module.exports.getProductAttributesbyId  =  async (req,res) => {
    try{
        const response = await userService.getProductAttributesbyId (req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all colors",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive colors"
    })
}