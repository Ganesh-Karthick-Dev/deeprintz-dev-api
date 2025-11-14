const userService = require("../service/productAddonService")
const _ = require("lodash");

module.exports.createAddon =  async (req,res) => {
    try{
        const isAddonExists = await userService.isAddonExists(req.body)

        if(isAddonExists){
            return res.send({
                status: false,
                message: "Addon already exists"
            })
        }else{
        const response = await userService.createAddon(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Addon created successfully"
            })
        }
      }

    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to create addon"
    })
}

module.exports.updateAddon =  async (req,res) => {
    try{
        const isUpdateAddonExists = await userService.isUpdateAddonExists(req.body)

        if(isUpdateAddonExists){
            return res.send({
                status: false,
                message: "Addon already exists"
            })
        }else{
        const response = await userService.updateAddon(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Addon updated successfully"
            })
        }
      }

    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update addon"
    })
}
module.exports.deleteAddon =  async (req,res) => {
    try{
        const response = await userService.deleteAddon(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Addon deleted successfully"
            })
        }
    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to delete addon"
    })
}
module.exports.activateAddon =  async (req,res) => {
    try{
        const response = await userService.activateAddon(req.body)
        if(response == 1){
            return res.send({
                status: true,
                message: "Addon status updated successfully"
            })
        }
    }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update the status of addon"
    })
}

module.exports.getAllAddons =  async (req,res) => {
    try{
        const response = await userService.getAllAddons(req.body)
        if(!_.isEmpty(response)){
            var data = response.data;
            var count = response.count;
            return res.send({
                status: true,
                message: "Successfully retrieved all addons",
                response: data,
                count:count
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive addons",
        response: [],
        count: 0
    })
}
module.exports.getAddonById =  async (req,res) => {
    try{
        const response = await userService.getAddonById(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved addon by id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive addon by id",
        response: []
    })
}