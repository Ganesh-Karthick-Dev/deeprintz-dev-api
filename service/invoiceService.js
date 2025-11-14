const _ = require("lodash");
const orderService = require("../service/order/orderService")

module.exports.generateInvoice = async(props) => {
    try {
        const knex = global.dbConnection
        const trx = await knex.transaction() 
        const { orderheaderid,tenantid,totalamount,invoiceurl } = props;
        const invoice = await knex('tenantinvoice')
                                .insert({
                                    tenantid,
                                    orderheaderid,
                                    totalamount,
                                    invoiceurl
                                });

       
        if(!_.isEmpty(invoice)){             
            return true;
        }
        return null;

    } catch (err) {
        console.log("error",err)
    }
    return null
}
module.exports.createInvoice = async (props) => {
         const {orderheaderid,tenantid,orderProducts,addonIds,totalamount,deliverycharge,type} = props
    try{
                const knex = global.dbConnection
                const trx = await knex.transaction() 
        switch(type){
            case 1:
                const productaddons = addonIds.join(',')
                // only with orderheaderid
                 const invoice = await trx('tenantinvoice')
                                                       .insert({
                                                         tenantid,
                                                         orderheaderid,
                                                         productaddons,
                                                         deliverycharge,
                                                         totalamount,
                                                       })
                 if(!_.isEmpty(invoice)){                                       
                     const orderdetails = orderProducts.map( item => {
                          return {
                              ...item,
                                 invoiceid:invoice[0]
                          }
                     })   
     
                     const invoicedetails = await trx('tenantinvoicedetails')
                                                             .insert(orderdetails)
                        if(!_.isEmpty(invoicedetails)){
                          await trx.commit()
                          return invoice
                        }else{
                          await trx.rollback()
                          return null
                        }                                     
     
                  }                                       
          
             await trx.rollback()
             return null
            case 2:
                const getOrderDetails = await orderService.getOrderDetails({orderheaderid})
                console.log("get Order Details",getOrderDetails)
                console.log("insert",{
                    tenantid: getOrderDetails.order.tenantid,
                    orderheaderid,
                    productaddons: getOrderDetails.order.addonid,
                    deliverycharge: getOrderDetails.order.deliverycharge,
                    totalamount: getOrderDetails.order.totalamount,
                })
                if(!_.isEmpty(getOrderDetails)){
                    const invoice = await trx('tenantinvoice')
                    .insert({
                       tenantid: getOrderDetails.order.tenantid,
                      orderheaderid,
                      productaddons: getOrderDetails.order.addonid,
                      deliverycharge: getOrderDetails.order.deliverycharge,
                      totalamount: getOrderDetails.order.totalamount,
                    })
                    
                    if(!_.isEmpty(invoice)){
                        const orderproducts = getOrderDetails.products.map( item =>  {
                            return {
                                quantity: item.quantity,
                                charges: item.charges,
                                productcost: item.productcost,
                                tenantproductid: item.tenantproductid,
                                total: item.total,
                                taxpercent: item.taxpercent,
                                taxamount: item.taxamount,
                                invoiceid: invoice[0]
                            }    
                        })
                        console.log(orderproducts)
                        const tenantinvoicedetails = await trx('tenantinvoicedetails').insert(orderproducts)
                        if(!_.isEmpty(tenantinvoicedetails)){
                            await trx.commit()
                            return invoice
                        }else{
                            await trx.rollback()
                            return null
                        }
                    }
                }
                await trx.rollback()
                return null
        }
            

        return null         
      }
      catch(err){
          console.log("error",err)
      }
      return null
  }

  
module.exports.getAllInvoices = async (props) => {
    const { tenantid, status, from, to, offset, limit , all} = props
    try {
        switch (status) {

            case 1:

                if(all == 0){
                const invoice0 = await global.dbConnection('tenantinvoice')
                    .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, tenantinvoice.productaddons)`))
                    .leftJoin('tenants','tenants.tenantid','tenantinvoice.tenantid')
                    .select(
                        'tenantinvoice.orderheaderid',
                        'tenantinvoice.tenantid',
                        'tenantinvoice.productaddons',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.invoiceid',
                        'tenants.tenantname',
                        'tenants.primaryemail',
                        'tenants.primarycontact',
                        'tenants.address',
                        global.dbConnection.raw('GROUP_CONCAT(productaddons.groupname) as groupname'),
                    ).groupBy('tenantinvoice.orderheaderid')

                  
             await Promise.all(invoice0.map(async item => {
           const details = await global.dbConnection('tenantinvoicedetails').
          leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'tenantinvoicedetails.tenantproductid').
          select(
                "tenantinvoicedetails.tenantproductid",
                "tenantproducts.productsku",
                "tenantinvoicedetails.quantity",
                "tenantinvoicedetails.productcost",
                "tenantinvoicedetails.charges",
                "tenantinvoicedetails.taxpercent",
                "tenantinvoicedetails.taxamount",
                "tenantinvoicedetails.total"
            ).where('tenantinvoicedetails.invoiceid', item.invoiceid)
  
             item.invoicedetails = details

            }))
           

                return !_.isEmpty(invoice0) ? invoice0 : null

               }else{
                const invoice0 = await global.dbConnection('tenantinvoice')
                    .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, tenantinvoice.productaddons)`))
                    .select(
                        'tenantinvoice.orderheaderid',
                        'tenantinvoice.tenantid',
                        'tenantinvoice.productaddons',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.invoiceid',
                        global.dbConnection.raw('GROUP_CONCAT(productaddons.groupname) as groupname'),
                    ).groupBy('tenantinvoice.orderheaderid')

                  
             await Promise.all(invoice0.map(async item => {
           const details = await global.dbConnection('tenantinvoicedetails').
          leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'tenantinvoicedetails.tenantproductid').
          select(
                "tenantinvoicedetails.tenantproductid",
                "tenantproducts.productsku",
                "tenantinvoicedetails.quantity",
                "tenantinvoicedetails.productcost",
                "tenantinvoicedetails.charges",
                "tenantinvoicedetails.taxpercent",
                "tenantinvoicedetails.taxamount",
                "tenantinvoicedetails.total"
            ).where('tenantinvoicedetails.invoiceid', item.invoiceid)
  
             item.invoicedetails = details

            }))
                   
                return !_.isEmpty(invoice0) ? invoice0 : null
                }

            case 2:
                if(all == 0){
                    const invoice1 = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid).andWhere('tenantinvoice.status', 'unpaid')
                    .offset(offset).limit(limit)

                    return !_.isEmpty(invoice1) ? invoice1 : null
                }else{
                    const invoice1 = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid)
                    .andWhere('tenantinvoice.status', 'unpaid')
                    .whereBetween(global.dbConnection.raw('DATE(tenantinvoice.startdate)'), [from, to])
                    .offset(offset).limit(limit)

                     return !_.isEmpty(invoice1) ? invoice1 : null
                }
                
            case 3:
                if(all == 0){
                    const invoice = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid)
                    .andWhere('tenantinvoice.status', 'paid')
                    .offset(offset).limit(limit)

                return !_.isEmpty(invoice) ? invoice : null
                }else{
                    const invoice = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid)
                    .andWhere('tenantinvoice.status', 'paid')
                    .whereBetween(global.dbConnection.raw('DATE(tenantinvoice.startdate)'), [from, to])
                    .offset(offset).limit(limit)

                return !_.isEmpty(invoice) ? invoice : null
                }
                       
            case 4:
                if(all == 0){
                    const invoice3 = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid)
                    .andWhere('tenantinvoice.status', 'cancelled')
                    .offset(offset).limit(limit)

                return !_.isEmpty(invoice3) ? invoice3 : null
                }else{
                    const invoice3 = await global.dbConnection('tenantinvoice')
                    .leftJoin('tenantcustomers', 'tenantcustomers.customerid', 'tenantinvoice.customerid')
                    .select(
                        'tenantinvoice.invoiceid',
                        'tenantinvoice.tenantid',
                        'tenantcustomers.firstname',
                        'tenantcustomers.lastname',
                        'tenantinvoice.startdate',
                        'tenantinvoice.enddate',
                        'tenantinvoice.sequenceid',
                        'tenantinvoice.totalamount',
                        'tenantinvoice.status',
                        'tenantinvoice.invoicestatus',
                        'tenantcustomers.address'
                    )
                    .andWhere('tenantinvoice.tenantid', tenantid)
                    .andWhere('tenantinvoice.status', 'cancelled')
                    .whereBetween(global.dbConnection.raw('DATE(tenantinvoice.startdate)'), [from, to])
                    .offset(offset).limit(limit)

                     return !_.isEmpty(invoice3) ? invoice3 : null
                }
                
        }
    } catch (err) {
        console.log("error", err)
    }
    return null
}

module.exports.getInvoiceDetailsById = async (props) => {
    const { invoiceid } = props
    try {
        const invoice0 = await global.dbConnection('tenantinvoice')
        .leftJoin('productaddons', global.dbConnection.raw(`FIND_IN_SET(productaddons.addonid, tenantinvoice.productaddons)`))
        .leftJoin('tenants','tenants.tenantid','tenantinvoice.tenantid')
        .select(
            'tenantinvoice.orderheaderid',
            'tenantinvoice.tenantid',
            'tenantinvoice.productaddons',
            'tenantinvoice.totalamount',
            'tenantinvoice.invoiceid',
            'tenants.tenantname',
            'tenants.primaryemail',
            'tenants.primarycontact',
            'tenants.address',
            global.dbConnection.raw('GROUP_CONCAT(productaddons.groupname) as groupname'),
        ).groupBy('tenantinvoice.orderheaderid').where('tenantinvoice.invoiceid',invoiceid)

      
 await Promise.all(invoice0.map(async item => {
const details = await global.dbConnection('tenantinvoicedetails').
leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'tenantinvoicedetails.tenantproductid').
select(
    "tenantinvoicedetails.tenantproductid",
    "tenantproducts.productsku",
    "tenantinvoicedetails.quantity",
    "tenantinvoicedetails.productcost",
    "tenantinvoicedetails.charges",
    "tenantinvoicedetails.taxpercent",
    "tenantinvoicedetails.taxamount",
    "tenantinvoicedetails.total"
).where('tenantinvoicedetails.invoiceid', item.invoiceid)

 item.invoicedetails = details

}))

  console.log(invoice0)
    return !_.isEmpty(invoice0) ? invoice0 : null
    } catch (err) {
        console.log("error", err)
    }
    return null
}