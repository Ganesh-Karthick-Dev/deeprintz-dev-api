const userService = require("../service/orderChargeService")
const _ = require("lodash")

//Printing charge:
module.exports.getOrderChargesbyname = async (req,res) => {
    try{
        const response = await userService.getOrderChargesbyname(req.body) 
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved  all order charges by name",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive order charges by name"
    })
}
module.exports.getOrderChargesbytype = async (req,res) => {
    try{
        const response = await userService.getOrderChargesbytype(req.body) 
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved  all order charges by type",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retreive order charges by type"
    })
}

module.exports.addOrderCharge = async (req,res) => {
    try{
        const isOrderChargeExist = await userService.isOrderChargeExist(req.body)

        if(isOrderChargeExist){
            return res.send({
                status: false,
                message: "order charge already exists"
            })
        }else{
        const response = await userService.addOrderCharge(req.body)
        if(response){
            return res.send({
                status: true,
                message: "Order charges added successfully",
            })
        }
    }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add order charge"
    })
}

module.exports.getOrderChargebyId = async (req,res) => {
    try{
        const response = await userService.getOrderChargebyId(req.body)
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all order charges by id",
                response: response[0]
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve order charge"
    })
}

module.exports.updateOrdercharges = async (req,res) => {
    try{
        const isUpdateOrderChargeExist = await userService.isUpdateOrderChargeExist(req.body)

        if(isUpdateOrderChargeExist){
            return res.send({
                status: false,
                message: "order charge already exists"
            })
        }
        else{
        const response = await userService.updateOrdercharges(req.body)
        
        if(response == 1){
            return res.send({
                status: true,
                message: "order charges updated successfully!",
                response: response
            })
        }
    }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update order charge"
    })
}
