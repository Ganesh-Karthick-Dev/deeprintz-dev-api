const reportService = require("../service/reportService")
const _ = require("lodash");
const Joi = require('joi')

module.exports.salesReport = async (req,res) => {
    try {
        const schema = Joi.object({
            from_date: Joi.date().required(),
            to_date: Joi.date().required(),
            client_id: Joi.optional(),
         })

         const validationResult = schema.validate(req.body);
         if(!_.isEmpty(validationResult.error)){
             return res.send({
                 status: false,
                 message: `${validationResult.error.details[0].message}`
              })
         }

         const response = await reportService.downloadsalesReport(req.body);

         if(!_.isNull(response)){
            return res.send({
                status: true,
                message: `Success!`,
                data: response
            })
         }else{
            return res.send({
                status: false,
                message: `failed!`,
                data: []
            })
         }
        
    } catch (err) {
        console.log("error" , err);
    }
    return res.send({
        status: false,
        message: "failed!"
    })

}

module.exports.salesChart = async(req,res) => {
    try {
        const response = await reportService.salesChartData(req.body);      
        
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: `Success!`,
                data: response
            })
        }
    } catch (err) {
        console.log("error" , err);
    }
    return res.send({
        status: false,
        message: "failed!"
    })
}

module.exports.ordersChart = async(req,res) =>{
    try {
        const response = await reportService.ordersChartData(req.body); 
        
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: `Success!`,
                data: response
            })
        }
        
    } catch (err) {
        console.log("error" , err);
    }
    return res.send({
        status: false,
        message: "failed!"
    })
    
}