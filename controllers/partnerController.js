const userService = require("../service/partnerService")
const _ = require("lodash");

module.exports.addPartnerInfo = async (req,res) => {

    try{
        const isPartnerNameExist = await userService.isPartnerNameExist(req.body)

        if(isPartnerNameExist){
            return res.send({
                status: false,
                msessage: "Partner Name Already Exists"
            })
        }
        else{
        const response = await userService.addPartnerInfo(req.body);
        if(!_.isEmpty(response)){
            return res.send({
               status: true,
               message: "partner info added successfully",
               response: response
            })
        }
      }
    }catch(err){
        console.log("error",err)
        
    }
    return res.send({
        status: false,
        message: "failed to add partnerinfo"
    })
}

module.exports.addPartnerLocations = async(req,res) => {
    try{
        const response = await userService.addPartnerLocations(req.body);
        
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Partner location added successfully",
                response: response
            })
        }
    }catch(err){
      console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to add partner locations"
    })
}
module.exports.updatePartnerinfo = async(req,res) => {
    try{
        const isUpdatePartnerNameExist = await userService.isUpdatePartnerNameExist(req.body)

        if(isUpdatePartnerNameExist){
            return res.send({
                status: false,
                message: "partner name already  exists"
            })
        }else{
        const response = await userService.updatePartnerInfo(req.body);
        if(response == 1){
            return res.send({
                status: true,
                message: "Partner info updated successfully",
                response: response
            })
        }
     }
    }catch(err){
      console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update partner info"
    })
}
module.exports.updatePartnerLocations = async(req,res) => {
    try{
        const response = await userService.updatePartnerLocations(req.body);
        if(response == 1){
            return res.send({
                status: true,
                message: "Partner location updated successfully",
                response: response
            })
        }
    }catch(err){
      console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to update partner location"
    })
}
module.exports.getPartnerlocationsbyId = async(req,res) => {
    try{
        const response = await userService.getPartnerlocationsbyId(req.body);
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved partner locations by id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed retrieve partner locations by id"
    })
}
module.exports.getPartnersById = async(req,res) => {
    try{
        const response = await userService.getPartnersById(req.body);
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved partners by Id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed retrieve partners by Id"
    })
}
module.exports.getPartnersByPostcode = async(req,res) => {
    try{
        const response = await userService.getPartnersByPostcode(req.body);
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved partners by Id",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed retrieve partners by Id"
    })
}
module.exports.getAllPartners = async(req,res) => {
    try{
        const response = await userService.getAllPartners();
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Partners information retrieved successfully",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve partners information"
    })
}
module.exports.getAllPartnerLocations = async(req,res) => {
    try{
        const response = await userService.getAllPartnerLocations();
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Partners information retrieved successfully",
                response: response
            })
        }
    }catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve partners information"
    })
}