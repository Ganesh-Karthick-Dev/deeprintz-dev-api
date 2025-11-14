const userService = require("../service/invoiceService")
const _ = require("lodash");
const Joi = require('joi')

module.exports.generateInvoice = async (req,res) => {
  try {
    const schema = Joi.object({
      orderheaderid:Joi.number().required(),
      tenantid: Joi.number().required(),
      totalamount: Joi.number().required(),
      invoiceurl: Joi.string().uri().required()
    })

    const validationResult = schema.validate(req.body)
         
        if(!_.isEmpty(validationResult.error)){
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
              })
        }else{
            const response = await userService.generateInvoice(req.body)
           // console.log(response)
            if(response != null ){
                return res.send({
                    status: true,
                    message: "Success!"
                })
            }
        } 
    
  } catch (err) {
    console.log("error",err)
  }
  return res.send({
    status: false,
    message: "Failed!"
})
}

module.exports.createInvoice =  async (req,res) => {
    try{
      const schema = (req.body.type == 1) ?
         Joi.object({
            tenantid: Joi.number().required(),
            orderProducts: Joi.array().items(
                Joi.object({
                    tenantproductid: Joi.number().required(),
                    quantity: Joi.number().optional(),
                    productcost: Joi.number().required(),
                    charges: Joi.number().required(),
                    taxpercent: Joi.number().required(),
                    taxamount: Joi.number().required(),
                    total: Joi.number().required()
                })
              ).required(),
              orderheaderid : Joi.number().required(),
              addonIds: Joi.array().required(),
              totalamount: Joi.number().required(),
              deliverycharge : Joi.number().required(),
              type: Joi.number().strict().required() 
         })  :  Joi.object({
            orderheaderid : Joi.number().required(),
            type: Joi.number().strict().required() 
       }) 
         const validationResult = schema.validate(req.body)
         
        if(!_.isEmpty(validationResult.error)){
            return res.send({
                status: false,
                message: `${validationResult.error.details[0].message}`
              })
        }else{
            const response = await userService.createInvoice(req.body)
            if(!_.isEmpty(response)){
                return res.send({
                    status: true,
                    message: "Success!",
                    response: response
                })
            }
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

module.exports.getAllInvoices = async (req,res) => {
 
    try{
      const response = await userService.getAllInvoices(req.body)
  
      if(!_.isEmpty(response) ){
         return res.send({
           status: true,
           message: "Success!",
           response: response
         })
      }

    }catch(err){
      console.log("error",err)
    }
     return res.send({
       status: false,
       message: "No data found!",
       response: []
     })
  }

  module.exports.getInvoiceDetailsById = async (req,res) => {
    try{
       const response = await userService.getInvoiceDetailsById(req.body)
  
       if(!_.isEmpty(response)){
          return res.send({
            status: true,
            message: "Success!",
            response: response
          })
       }
  
    }catch(err){
      console.log("error",err)
    }
    return res.send({
      status: false,
      message: "No Data Found!",
      response: []
    })
  }
  