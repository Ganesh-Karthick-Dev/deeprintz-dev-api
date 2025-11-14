const userService = require("../service/productsService")
const _ = require("lodash");
const Joi = require('joi')

module.exports.addProduct = async (req, res) => {
    try {
        
        const isProductNameAlreadyExists = await userService.isProductNameAlreadyExists(req.body);
        if (isProductNameAlreadyExists) {
            return res.send({
                status: false,
                message: "Product Name Already Exists"
            })
        }
        else{
        const response = await userService.addProduct(req.body)
        if(!_.isEmpty(response)){
           return res.send({
                      status: true,
                      message: "Product added successfully",
                      response: response
                         })
             }
         }

    } catch (err) {
        console.log("error", err)
    }
    return res.send({
        status: false,
        message: "failed to add products"
    })
}
module.exports.updateProduct = async (req, res) => {
    try {
     
     const isUpdateProductNameExists = await userService.isUpdateProductNameExists(req.body)

     if(isUpdateProductNameExists){
         return res.send({
            status: false,
            message: "Product Name Already Exists"
         })
     }else{
     const response = await userService.updateProduct(req.body)
     //console.log(response);

            if (response == 1) {
                return res.send({
                    status: true,
                    message: "Product updated successfully"
                })
            }
        }
    } catch (err) {
        console.log("error", err)
        return res.send({
            status: false,
            message: `${err}`
        })
    }
    return res.send({
        status: false,
        message: "failed to update products"
    })
}
module.exports.updateProductStock = async (req, res) => {
    try {
    
    const response = await userService.updateProductStock(req.body)
    
    if (!_.isEmpty(response)) {
                return res.send({
                    status: true,
                    message: "Product updated successfully"
                })
            }
        
    } catch (err) {
        console.log("error", err)
        return res.send({
            status: false,
            message: `${err}`
        })
    }
    return res.send({
        status: false,
        message: "failed to update products"
    })
}

module.exports.deleteProduct = async (req,res) =>{
    try{
        const response = await userService.deleteProduct(req.body);

    if(response == 1){
            return res.send({
                status: true,
                message: "product deleted successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to delete product"
    })
} 
module.exports.getAllProducts = async (req,res) =>{
    try{
        const response = await userService.getAllProducts(req.body);

        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully Retrieved All Products",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed To Retrieve Products",
        response: []
    })
} 

module.exports.getproductsbycatId = async(req,res) => {
    try{
       const response = await userService.getproductsbycatId(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by category Id",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by category Id",
        response: []
    })
}
module.exports.getCusProductsByTenantId = async(req,res) => {
    try{
       const response = await userService.getCusProductsByTenantId(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by tenant ID",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by tenant Id",
        response: []
    })
}
module.exports.getproductsbyslug = async(req,res) => {
    try{
       const response = await userService.getproductsbyslug(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by slug",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by slug",
        response: []
    })
}
module.exports.getproductsbycatsubcatId = async(req,res) => {
    try{
       const response = await userService.getproductsbycatsubcatId(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by category and subcategory id",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by category and subcategory",
        response: []
    })
}
module.exports.getproductsbycolor = async(req,res) => {
    try{
        console.log("request..",req.body)
       const response = await userService.getproductsbycolor(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by color",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by color",
    })
}
module.exports.getproductsbysize = async(req,res) => {
    try{
        console.log("request..",req.body)
       const response = await userService.getproductsbysize(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by size",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by size",
    })
}
module.exports.getproductsbyname = async(req,res) => {
    try{
       const response = await userService.getproductsbyname(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products by name",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve products by name",
    })
}
module.exports.getproducts = async(req,res) => {
    try{
       const response = await userService.getproducts(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "No products found",
        response: []
    })
}
module.exports.getProductsById = async(req,res) => {
    try{
       const response = await userService.getProductsById(req.body)

       if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "successfully retrieved products",
                response: response
            })
       }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "No products found",
        response: []
    })
}

// customized products

module.exports.createCustomizedProduct = async(req,res) => {
    try{
        //console.log("req.body" , req.body)
        const plain = req.body.plain

        const schema = plain == "no" ? Joi.object({
            tenantid:  Joi.number().required(),
            quantity : Joi.number().required(),
            productid: Joi.number().required(),
            printingtypeid: Joi.array().required(),
            variantid: Joi.number().required(),
            colorid: Joi.number().required(),
            productcost: Joi.number().required(),
            //othercost: Joi.number().required(),
            plain : Joi.string().required(),
            specs: Joi.array().items(
            Joi.object({  
            design_name: Joi.string().optional(),
            placementid: Joi.number().required(),
            width: Joi.number().optional(),
            height: Joi.number().optional(),
            imageurl: Joi.string().required(),
            designurl: Joi.string().required(),
            hpsvalue : Joi.number().required()
           }).required()
        ).required()     
        }) : Joi.object({
            tenantid:  Joi.number().required(),
            productid: Joi.number().required(),
            printingtypeid: Joi.array().required(),
            variantid: Joi.number().required(),
            colorid: Joi.number().required(),
            productcost: Joi.number().required(),
            //othercost: Joi.number().required(),
            plain : Joi.string().required(),
            specs: Joi.array().empty(),
            quantity : Joi.number().required()
        }).required()   

        const validationResult = schema.validate(req.body)

        if(!_.isEmpty(validationResult.error)){
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
            })
        }
        
        const response = await userService.createCustomizedProduct(req.body);

        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Product created Successfully",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "Failed to create customized product",
        response: []
    })
}



module.exports.getAllSkuBySearch = async(req,res) => {
    try{
        
        const response = await userService.getAllSkuBySearch(req.body);

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

module.exports.getImagesbycolor = async(req,res) => {
    try{
        const response = await userService.getImagesbycolor(req.body);

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

module.exports.getProductBySku = async (req, res) => {
    try {
     
     const product = await userService.getProductBySku(req.body.sku)
     if(product){
         return res.send({
            status: true,
            message: "Product Name Fetched!",
            productName :product
         })
     }else{
        return res.send({
            status: false,
            message: "Failed to fetch"
        })
        }
    } catch (err) {
        return res.send({
            status: false,
            message: `${err}`
        })
    }
    return res.send({
        status: false,
        message: "failed to update products"
    })
}


module.exports.getVariantIdBySku = async(req,res) => {
    try{
        const response = await userService.getVariantIdBySku(req.body);
        if(!_.isNull(response)){
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