const _ = require("lodash")
//Printing charge:

module.exports.getOrderChargesbyname = async (props) => {
       const {name} = props;

    try{
          const response = await global.dbConnection('ordercharges')
          .leftJoin('app_types','app_types.apptypeid','ordercharges.apptypeid')
          .where({chargetype: name}).select("*")
  
          return !_.isEmpty(response) ? response : null;
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }
module.exports.getOrderChargesbytype = async (props) => {
       const {type} = props;

    try{
        switch(type){
            //1 - printing , 2 - shipping
            case 1:
                const response = await global.dbConnection('ordercharges')
                .leftJoin('app_types','app_types.apptypeid','ordercharges.apptypeid')
                .where('ordercharges.chargetype', 'printing')
                .select(
                  "ordercharges.apptypeid",
                  "app_types.typename as chargename",
                  "ordercharges.orderchargeid", 
                  "ordercharges.chargetype",
                  "ordercharges.chargeunit",
                  "ordercharges.chargevalue",
                  "ordercharges.chargeamount",
                  "ordercharges.slug",
                )
        
                return !_.isEmpty(response) ? response : null;
            case 2:
                const response2 = await global.dbConnection('ordercharges')
                .where('ordercharges.chargetype', 'shipping')
                .select(
                  "ordercharges.orderchargeid", 
                  "ordercharges.chargename",
                  "ordercharges.chargetype",
                  "ordercharges.chargeunit",
                  "ordercharges.chargevalue",
                  "ordercharges.chargeamount",
                  "ordercharges.slug",
                )
        
                return !_.isEmpty(response2) ? response2 : null;
        }

      }
      catch(err){
          console.log("error",err)
      }
      return null
  }

module.exports.addOrderCharge = async (props) => {
    const {chargename,chargetype,chargeunit,chargevalue,chargeamount,apptypeid,minimumcharge,garment,gst} = props;
 
    try{ 
        // chargetype : 1 - printing charge , 2 - shipping charge , 3 - handling charge
        
        // charge type - printing , charge unit -sqinch , charge amount - 1 rs , charge value - 1 , apptypeid - 89
        
        const slug = `${chargetype}-${chargeamount}.RS / ${chargevalue}-${chargeunit}`

        switch(chargetype){
            case 1:
                const response = await global.dbConnection('ordercharges').insert({chargetype: "printing" ,chargeunit,chargevalue,chargeamount,apptypeid,minimumcharge,garment,chargegst: gst ,slug})
           
                return !_.isEmpty(response) ? response : null;
            case 2:
                const response2 = await global.dbConnection('ordercharges').insert({chargename,chargetype: "shipping" ,chargeunit,chargevalue,chargeamount,slug})
           
                return !_.isEmpty(response2) ? response2 : null;
            case 3:
                const response3 = await global.dbConnection('ordercharges').insert({chargetype: "handling" ,chargeunit,chargeamount})
           
                return !_.isEmpty(response3) ? response3 : null;
        }
       

    }
    catch(err){
        console.log("error",err)
    
    }
    return null
}

module.exports.getOrderChargebyId = async (props) => {
    const {id} = props;
    try{
        const response = await global.dbConnection('ordercharges')
        .leftJoin('app_types','app_types.apptypeid','ordercharges.apptypeid')
        .where('ordercharges.orderchargeid', id)
        .select(
          "ordercharges.apptypeid",
          "app_types.typename",
          "ordercharges.orderchargeid", 
          "ordercharges.chargename",
          "ordercharges.chargetype",
          "ordercharges.chargeunit",
          "ordercharges.chargevalue",
          "ordercharges.chargeamount",
          "ordercharges.slug",
          "ordercharges.minimumcharge",
          "ordercharges.chargegst",
          "ordercharges.garment"
        )
                           
        return !_.isEmpty(response) ? response : null;
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.isOrderChargeExist = async (props) => {
    const {chargename,chargetype,id} = props;
    try{
        const response = await global.dbConnection('ordercharges').where({ chargename }).andWhere({chargetype})
                                .select('*');
        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}
module.exports.isUpdateOrderChargeExist = async (props) => {
    const {chargename,chargetype,id} = props;
    try{
        
        const response = await global.dbConnection('ordercharges').whereNot({orderchargeid:id})
                                .andWhere({ chargename })
                                .andWhere({chargetype})
                                .select('*');
            console.log("response..",response)                    
        return !_.isEmpty(response) ? true : false;
    }
    catch(err){
        console.log("error",err)
    }
    return false
}

module.exports.updateOrdercharges = async (props) => {
    
    const {id,chargename,chargetype,chargeunit,chargevalue,chargeamount,apptypeid,minimumcharge,garment,gst} = props;

    try{

        switch(chargetype){
            case 1:
                var chargetypestring = "printing";
                const response = await global.dbConnection('ordercharges').update({chargetype: chargetypestring ,chargeunit,chargevalue,chargeamount,apptypeid,minimumcharge,garment,chargegst: gst})
                                                                          .where('orderchargeid',id)
           
                return (response == 1) ? response : null
            case 2:
                var chargetypestring = "shipping";
                const response2 = await global.dbConnection('ordercharges').update({chargename,chargetype: chargetypestring ,chargeunit,chargevalue,chargeamount})
                                                                           .where('orderchargeid',id)
                return (response2 == 1) ? response2 : null
            case 3:
                var chargetypestring = "handling";
                const response3 = await global.dbConnection('ordercharges').update({chargetype: chargetypestring , chargeunit , chargeamount})
                                                                           .where('orderchargeid',id)

                const handlingcharge = await global.dbConnection('tenants').update({handlingcharge:chargeamount})                                                          

                
                return (response3 == 1) ? response3 : null
        }

        // const response = await global.dbConnection('ordercharges')
        //                                 .update({chargename,chargeunit,chargevalue,chargetype,chargeamount,apptypeid})
        //                                 .where('orderchargeid',id)
 
        // return (response == 1) ? response : null
     }catch(err){
         console.log("error",err)
     }
     return null

}