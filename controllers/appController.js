const userService = require("../service/appService")
const _ = require("lodash");

module.exports.getAllCountries =  async (req,res) => {
    try{
        const response = await userService.getAllCountries()
        if(!_.isEmpty(response)){
            return res.send({
                status: true,
                message: "Successfully retrieved all countries",
                response: response
            })
        }
      }
    catch(err){
        console.log("error",err)
    }
    return res.send({
        status: false,
        message: "failed to retrieve countries",
        response: []
    })
}