const userService = require("../service/subCategoryService")
const _ = require("lodash");

module.exports.addSubCategory =  async (req,res) => {
    try{
        const isSubCategoryNameExists = await userService.isSubCategoryNameExists(req.body)

        if(isSubCategoryNameExists){
            return res.send({
                status: false,
                message: "Subcategory Name Already Exists!"
            })
        }
        const response = await userService.addSubCategory({
            ...req.body,
            // image: req.file.path
        })
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Subcategory added successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add Subcategory"
    })
}

module.exports.getSubCategoriesByCatId =  async (req,res) => {
    try{
        const response = await userService.getSubCategoriesByCatId(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all Subcategories",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive Subcategories"
    })
}

module.exports.getSubcategoryBySlug =  async (req,res) => {
    try{
        const response = await userService.getSubcategoryBySlug(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved subcategory by slug",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive subcategories by slug"
    })
}

module.exports.getSubCategoriesById =  async (req,res) => {
    try{
        const response = await userService.getSubCategoriesById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all Subcategories",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive Subcategories by Id",
        response: []
    })
}

module.exports.updateSubCategory = async(req,res) => {
    try{
        const isEditSubCategoryNameExists = await userService.isEditSubCategoryNameExists(req.body)
    
        if(isEditSubCategoryNameExists){
            return res.send({
                status: false,
                message: "Subcategory Name Already Exists!"
            })
        }else{
        const response = await userService.updateSubCategory({
            ...req.body,
            // image: req.file.path
        })
        if(response == 1){
            return res.send({
                status: true,
                message: "Subcategory updated successfully!",
                response: response
            })
        }
     }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update subcategory"
    })
}

module.exports.getallSubCategories = async(req,res) => {
    try{
        const response = await userService.getAllSubCategories(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all subcategories",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive subcategories"
    })
}