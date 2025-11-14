const userService = require("../service/productDesignsService")
const _ = require("lodash");

module.exports.addDesign =  async (req,res) => {
    try{
        const response = await userService.addDesign(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Designs added successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add designs"
    })
}
module.exports.updateDesign =  async (req,res) => {
    try{
        const response = await userService.updateDesign(req.body)
        if((response == 1)){
            return res.send({
                status: true,
                message: "Design updated successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update designs"
    })
}
module.exports.getDesignsBytenantId =  async (req,res) => {
    try{
        const response = await userService.getDesignsBytenantId(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Sucessfully retrieved designs by customer id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add designs",
        response: []
    })
}
module.exports.getDesignsByName =  async (req,res) => {
    try{
        const response = await userService.getDesignsByName(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Sucessfully retrieved designs by Name",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed retrieve designs by name",
        response: []
    })
}
module.exports.deleteDesign =  async (req,res) => {
    try{
        const response = await userService.deleteDesign(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Design deleted successfully"
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to delete design"
    })
}