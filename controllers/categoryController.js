const userService = require("../service/categoryService")
const _ = require("lodash");

module.exports.addCategory =  async (req,res) => {
    try{
        const isCategoryNameExists = await userService.isCategoryNameExists(req.body)

        if(isCategoryNameExists){
            return res.send({
                status: false,
                message: "Category Name Already exists"
            })
        }else{
          
        const response = await userService.addCategory({
            ...req.body,
            // image: req.file.path
        })
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "category added successfully"
            })
        }
      }

    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add category"
    })
}
module.exports.getAllCategories =  async (req,res) => {
    try{
        const response = await userService.getAllCategories(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all categories",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive categories"
    })
}
module.exports.getCategoryBySlug =  async (req,res) => {
    try{
        const response = await userService.getCategoryBySlug(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved category by slug",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive categories by slug"
    })
}

module.exports.updateCategory = async(req,res) => {
    try{
        const isEditCategoryNameExists = await userService.isEditCategoryNameExists(req.body)
        
        if(isEditCategoryNameExists){
            return res.send({
                status: false,
                message: "Category Name Already exists"
            })
        }else{

        const response = await userService.updateCategory({
            ...req.body,
            // image: req.file.path
        })
        if(response == 1){
            return res.send({
                status: true,
                message: "Category updated successfully!",
                response: response
            })
        }
     }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update category"
    })
}

module.exports.getCategoryById = async(req,res) => {
    try{
        const response = await userService.getCategoryById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully fetched category",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to fetch category"
    })
}