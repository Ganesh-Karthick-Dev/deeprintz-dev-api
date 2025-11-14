const _ = require("lodash");
const moment = require("moment")

module.exports.addStock = async (props) => {
    const { variantid, quantity, comments, userid, logdate, styleCode, locationCode } = props;
    try {
        const knex = global.dbConnection
        const trx = await knex.transaction();
        const stockQuantity = await trx('productvariants').select('quantity').where({ variantid })
        console.log(stockQuantity);
        if (!_.isNull(stockQuantity[0].quantity)) {
            var existingQuantity = parseInt(stockQuantity[0].quantity, 10);
        } else {
            var existingQuantity = 0;
        }
        console.log(existingQuantity);
        var totalQuantity = quantity - (-existingQuantity);
        console.log(totalQuantity)
        const stockupdate = await trx('productvariants').update({ quantity: totalQuantity }).where({ variantid })
        console.log("stockupdate", stockupdate)
        if (stockupdate >= 1) {
            const response = await trx('stocklogs').
                insert({
                    userid,
                    variantid,
                    logdate,
                    comments,
                    quantity,
                    locationCode,
                    styleCode,
                    totalQuantity
                })
            console.log("insert", response)
            if (!_.isEmpty(response)) {
                await trx.commit()
                return response
            }
        }
        await trx.rollback()
        return null
    }
    catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getStockLogs = async (props) => {
    const {variantid} = props;

    try{
        const knex = global.dbConnection
        const trx = await knex.transaction()

       const response = await trx('stocklogs')
                                 .leftJoin('app_users','app_users.userid','stocklogs.userid')
                                 .select(
                                    'logid',
                                    'app_users.userid',
                                    'logdate',
                                    'quantity',
                                    'totalQuantity',
                                    'comments',
                                    'app_users.authname'
                                 )
                                 .where({variantid})
      
       return !_.isEmpty(response) ? response : null
    }
    catch(err){
        console.log("error",err)
    }
    return null
}


module.exports.getAllStockLogs = async () => {
    try{
       const response = await global.dbConnection('stocklogs')
                                 .leftJoin('app_users','app_users.userid','stocklogs.userid')
                                 .leftJoin('productvariants','productvariants.variantid','stocklogs.variantid')
                                 .leftJoin('products','products.productid','stocklogs.variantid')
                                 .select(
                                    'stocklogs.logid',
                                    'app_users.userid',
                                    'stocklogs.logdate',
                                    'stocklogs.quantity',
                                    'stocklogs.totalQuantity',
                                    'stocklogs.comments',
                                    'stocklogs.styleCode',
                                    'stocklogs.locationCode',
                                    'app_users.authname',
                                    'stocklogs.variantid',
                                    'productvariants.variantid',
                                    'products.productname',
                                    'productvariants.variantsku',
                                    'productvariants.quantity as variantquantity',
                                 ).orderBy('logid','desc')
                                       
       return !_.isEmpty(response) ? response : null
    }
    catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getVariantQuantity = async (props) => {
     const {productid,colorid,sizeid} = props
    try{
    
       const response = await global.dbConnection('productvariants')
                                 .select(
                                    'quantity'
                                 ).andWhere({productid}).andWhere({varianttype1:colorid}).andWhere({varianttype2:sizeid})
                                       
       return !_.isEmpty(response) ? response : null
    }
    catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAvalaibleRacks = async () => {
    try{
    
       const response = await global.dbConnection('rack')
                                 .select(
                                    'id',
                                    'available',
                                    'occupied'
                                 )

           const availableArray = response[0].available.split(",").map(Number);   
           const occupiedArray = !_.isEmpty(response[0].occupiedArray) ? response[0].occupiedArray.split(",").map(Number) : [];   
          
          console.log("valuesArray..",availableArray)

          const result = {
              ...response[0],
              available: availableArray,
              occupied: occupiedArray
          }
       return !_.isEmpty(result) ? result : null
    }
    catch(err){
        console.log("error",err)
    }
    return null
}


module.exports.bulkAddStock = async (stockList) => {
    try {
        const knex = global.dbConnection;
        await knex.transaction(async (trx) => {
            for (const stock of stockList) {
                const { variantid, locationCode, styleCode, quantity, comments } = stock;
                const stockQuantity = await trx('productvariants')
                    .select('quantity')
                    .where({ variantid })
                    .first();
                const existingQuantity = stockQuantity ? parseInt(stockQuantity.quantity, 10) || 0 : 0;
                console.log("existingQuantity", existingQuantity);
                const totalQuantity = existingQuantity + Number(quantity);
                console.log("totalQuantity", totalQuantity);
                const stockUpdate = await trx('productvariants')
                    .update({ quantity: totalQuantity })
                    .where({ variantid });
                if (stockUpdate) {
                    const existingStockLog = await trx('stocklogs')
                        .where({ variantid, locationCode })
                        .first();
                    if (existingStockLog) {
                        await trx('stocklogs')
                            .where({ variantid, locationCode })
                            .update({
                                quantity: existingStockLog.quantity + Number(quantity),
                                totalQuantity,
                                logdate: new Date(),
                                comments,
                            });
                    } else {
                        await trx('stocklogs').insert({
                            userid: 2,
                            variantid,
                            logdate: new Date(),
                            comments,
                            locationCode,
                            styleCode,
                            quantity,
                            totalQuantity,
                        });
                    }
                }
            }
        });
        return true;
    } catch (err) {
        console.error("Error in bulkAddStock:", err);
        return null;
    }
};