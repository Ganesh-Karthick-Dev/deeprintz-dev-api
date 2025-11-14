const _  = require("lodash");

module.exports.addPaymentDetails = async(props) => {
     const { tenant_id,type,cf_payment_id,order_amount,payment_amount,transactiondate,order_id,payment_status } = props
    
    try{
        switch(type){

        case 1:   
        // const cf_payment_id = payment_details[0].cf_payment_id 
        // const order_amount = payment_details[0].order_amount
        // const payment_amount = payment_details[0].payment_amount
        //const payment_group = payment_details[0].payment_group
        const paymentstatus = payment_status

       
        const knex = global.dbConnection
        const trx = await knex.transaction() 

        const wallet = await trx('tenants').select('wallet').where({tenantid : tenant_id}) 
        const balance = payment_status=="SUCCESS" ? 
                              _.toNumber(wallet[0].wallet) + _.toNumber(payment_amount) 
                                     : _.toNumber(wallet[0].wallet)
                                     
        console.log("balance",balance)

        const response = await trx('payments')
                                         .insert({
                                            tenantid: tenant_id,
                                            orderid: order_id,
                                            cf_payment_id,
                                            order_amount,
                                            payamount: payment_amount,
                                            paymentmode: "razorpay",
                                            paymenttype: 1,
                                            paymentstatus,
                                            approved: 1,
                                            //payment_json: payment_details,
                                            balance: balance
                                          })      
          
        const AddToWallet = await trx('tenants').update({wallet:balance}).where({tenantid : tenant_id})

        if(AddToWallet >= 1){
            await trx.commit();
            const result = [balance]
            return result
        }

        await trx.rollback();
        return null

        case 2:
         
         const refno = cf_payment_id
         const response1 = await global.dbConnection('payments')
           .insert({
           tenantid: tenant_id,
           payamount: payment_amount,
           paymenttype: 2,
           paymentstatus:"PENDING",
           approved: 0,
           transactiondate,
           refno
           })
           console.log("response...",response1)
          
          return !_.isEmpty(response1) ? response1 : null 
      }

    }catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.updatePaymentStatus = async(props) => {
     const {paymentid,action} = props
    
    try{
     switch(action){
        case 1:

            const response1 = await global.dbConnection('payments').update({approved : 1, paymentstatus: "SUCCESS"})
            .where({paymentid})

            const pay = await global.dbConnection('payments')
                                      .leftJoin('tenants','tenants.tenantid','payments.tenantid')
                                      .select('payments.payamount','payments.tenantid','tenants.wallet').where({paymentid})
      
            const payamount = pay[0].payamount
            const tenantid = pay[0].tenantid
            const MoneyInWallet = pay[0].wallet

            const balance = _.toNumber(MoneyInWallet) + _.toNumber(payamount) 
            

            const response3 = await global.dbConnection('tenants').update({wallet: balance}).where({tenantid})
           
            return response1 >= 1 ? response1 : null
        case 2:
            const response2 = await global.dbConnection('payments').update({approved : 0, paymentstatus: "FAILED"})
            .where({paymentid})

            return response2 >= 1 ? response2 : null

     }
     
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getAllPayments = async() => {  
    try{
    const response = await global.dbConnection('payments')
         .leftJoin('tenants','payments.tenantid','tenants.tenantid')
         .select(           
        'payments.tenantid',
        'payamount',
        'paymentstatus',
        'payments.approved',
        'transactiondate',
        'refno',
        'paymentid',
        'tenants.tenantname'
        ).where({paymenttype: 2})

      return !_.isEmpty(response) ? response : null  
    }catch(err){
        console.log("error",err)
    }
    return null
}
module.exports.getPaymentHistory = async(props) => {
      const {tenantid} = props  
    try{
        var paymenthistory = {};
    const credit = await global.dbConnection('payments')
         .leftJoin('tenants','payments.tenantid','tenants.tenantid')
         .select(           
            'payments.tenantid',
            'payments.payamount',
            'payments.paymentstatus',
            'payments.transactiondate',
            'payments.approved',
            'payments.refno',
            'payments.paymentid',
            'tenants.tenantname',
            'payments.balance',
            'tenants.wallet',
            'payments.paymenttype',
            'payments.created as created_at'
        ).where('payments.tenantid',tenantid)

    const debit = await global.dbConnection('paymentlogs')
            .leftJoin('tenants','paymentlogs.tenantid','tenants.tenantid')
            .select(           
                'paymentlogs.tenantid',
                'paymentlogs.orderid',
                'paymentlogs.amount_debited',
                'paymentlogs.balance',
                'paymentlogs.created_at'
            ).where('paymentlogs.tenantid',tenantid)

    paymenthistory.credit = credit;
    paymenthistory.debit = debit;

    const mergedArray = [...paymenthistory.credit, ...paymenthistory.debit].sort((a, b) => {
        return new Date(b.created_at) - new Date(a.created_at);
    });
    
    //console.log(mergedArray);

    const paymenthistoryJSON = JSON.stringify(paymenthistory);

      return !_.isEmpty(mergedArray) ? mergedArray : null  
    }catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getUserDetailsByUserId = async(userId) => {  
    try{
    const response = await global.dbConnection('app_users')
                    .select(           
                    'app_users.email',
                    'app_users.contactno'
                    )
                    .where('userid', userId)
                    .first();

      return !_.isEmpty(response) ? response : null  
    }catch(err){
        console.log("error",err)
    }
    return null
}

module.exports.getAllTransactionHistory = async () => {
    try {
        // Credits: all payments
        const credit = await global.dbConnection('payments')
            .leftJoin('tenants', 'payments.tenantid', 'tenants.tenantid')
            .select(
                'payments.tenantid',
                'payments.payamount',
                'payments.paymentstatus',
                'payments.transactiondate',
                'payments.approved',
                'payments.refno',
                'payments.paymentid',
                'tenants.tenantname',
                'payments.balance',
                'tenants.wallet',
                'payments.paymenttype',
                'payments.created as created_at'
            );
        // Debits: all paymentlogs
        const debit = await global.dbConnection('paymentlogs')
            .leftJoin('tenants', 'paymentlogs.tenantid', 'tenants.tenantid')
            .select(
                'paymentlogs.tenantid',
                'paymentlogs.orderid',
                'paymentlogs.amount_debited',
                'paymentlogs.balance',
                'paymentlogs.created_at',
                'tenants.tenantname'
            );
        // Merge and sort
        const mergedArray = [...credit, ...debit].sort((a, b) => {
            return new Date(b.created_at) - new Date(a.created_at);
        });
        return !_.isEmpty(mergedArray) ? mergedArray : null;
    } catch (err) {
        console.log("error", err);
    }
    return null;
}

module.exports.adminAddMoneyToWallet = async (props) => {
    const { tenant_id, amount } = props;
    
    try {
        const knex = global.dbConnection;
        const trx = await knex.transaction();
        
        // Get current wallet balance
        const wallet = await trx('tenants').select('wallet').where({ tenantid: tenant_id });
        if (_.isEmpty(wallet)) {
            await trx.rollback();
            return { success: false, message: "Tenant not found" };
        }
        
        const currentBalance = _.toNumber(wallet[0].wallet);
        const newBalance = currentBalance + _.toNumber(amount);
        
        // Insert payment record (type 3 for admin direct addition)
        const paymentResponse = await trx('payments').insert({
            tenantid: tenant_id,
            payamount: amount,
            paymenttype: 3, // New type for admin direct addition
            paymentstatus: "SUCCESS",
            approved: 1,
            paymentmode: "admin_direct",
            balance: newBalance,
            refno: `ADMIN_${Date.now()}`,
            transactiondate: new Date(),
            //admin_id: admin_id,
            //reason: reason || "Admin direct wallet addition"
        });
        
        // Update tenant wallet
        const updateWallet = await trx('tenants').update({ wallet: newBalance }).where({ tenantid: tenant_id });
        
        if (updateWallet >= 1) {
            await trx.commit();
            return {
                success: true,
                message: "Money added successfully to wallet",
                data: {
                    tenant_id,
                    amount_added: amount,
                    previous_balance: currentBalance,
                    new_balance: newBalance,
                    payment_id: paymentResponse[0]
                }
            };
        }
        
        await trx.rollback();
        return { success: false, message: "Failed to update wallet" };
        
    } catch (err) {
        console.log("error", err);
        return { success: false, message: "Internal server error", error: err.message };
    }
}

module.exports.detectPaymentFlow = async (props) => {
    const { tenant_id } = props;
    
    try {
        const payments = await global.dbConnection('payments')
            .leftJoin('tenants', 'payments.tenantid', 'tenants.tenantid')
            .select(
                'payments.paymentid',
                'payments.tenantid',
                'payments.orderid',
                'payments.payamount',
                'payments.paymentstatus',
                'payments.paymenttype',
                'payments.approved',
                'payments.paymentmode',
                'payments.refno',
                'payments.transactiondate',
                'payments.balance',
                'payments.created as created_at',
                'tenants.tenantname',
                'tenants.wallet as current_wallet'
            )
            .where('payments.tenantid', tenant_id)
            .orderBy('payments.created', 'desc');
        
        if (_.isEmpty(payments)) {
            return { success: false, message: "No payments found for this tenant", data: [] };
        }
        
        // Analyze payment flow
        const flowAnalysis = payments.map(payment => {
            let flowType = "";
            let status = "";
            
            switch (payment.paymenttype) {
                case 1:
                    flowType = "Razorpay Payment";
                    status = payment.paymentstatus === "SUCCESS" ? "Completed" : "Failed";
                    break;
                case 2:
                    flowType = "Manual Payment Request";
                    status = payment.approved === 1 ? "Approved" : payment.approved === 0 ? "Rejected" : "Pending";
                    break;
                case 3:
                    flowType = "Admin Direct Addition";
                    status = "Completed";
                    break;
                case 4:
                    flowType = "Admin Direct Subtraction";
                    status = "Completed";
                    break;
                default:
                    flowType = "Unknown";
                    status = "Unknown";
            }
            
            return {
                ...payment,
                flow_type: flowType,
                flow_status: status,
                is_processed: payment.paymenttype === 1 ? payment.paymentstatus === "SUCCESS" : payment.approved === 1
            };
        });
        
        return {
            success: true,
            message: "Payment flow detected successfully",
            data: flowAnalysis,
            summary: {
                total_payments: payments.length,
                successful_payments: payments.filter(p => p.paymenttype === 1 ? p.paymentstatus === "SUCCESS" : p.approved === 1).length,
                pending_payments: payments.filter(p => p.paymenttype === 2 && p.approved === null).length,
                failed_payments: payments.filter(p => p.paymenttype === 1 ? p.paymentstatus === "FAILED" : p.approved === 0).length
            }
        };
        
    } catch (err) {
        console.log("error", err);
        return { success: false, message: "Internal server error", error: err.message };
    }
}

module.exports.adminSubtractMoneyFromWallet = async (props) => {
    const { tenant_id, amount } = props;
    
    try {
        const knex = global.dbConnection;
        const trx = await knex.transaction();
        
        // Get current wallet balance
        const wallet = await trx('tenants').select('wallet').where({ tenantid: tenant_id });
        if (_.isEmpty(wallet)) {
            await trx.rollback();
            return { success: false, message: "Tenant not found" };
        }
        
        const currentBalance = _.toNumber(wallet[0].wallet);
        const newBalance = currentBalance - _.toNumber(amount);
        
        // Check if balance would go negative
        if (newBalance < 0) {
            await trx.rollback();
            return { 
                success: false, 
                message: "Insufficient wallet balance", 
                data: {
                    current_balance: currentBalance,
                    requested_amount: amount,
                    would_result_in: newBalance
                }
            };
        }
        
        // Insert payment record (type 4 for admin direct subtraction)
        const paymentResponse = await trx('payments').insert({
            tenantid: tenant_id,
            payamount: -amount, // Negative amount for subtraction
            paymenttype: 4, // New type for admin direct subtraction
            paymentstatus: "SUCCESS",
            approved: 1,
            paymentmode: "admin_direct",
            balance: newBalance,
            refno: `ADMIN_SUB_${Date.now()}`,
            transactiondate: new Date()
        });
        
        // Update tenant wallet
        const updateWallet = await trx('tenants').update({ wallet: newBalance }).where({ tenantid: tenant_id });
        
        if (updateWallet >= 1) {
            await trx.commit();
            return {
                success: true,
                message: "Money subtracted successfully from wallet",
                data: {
                    tenant_id,
                    amount_subtracted: amount,
                    previous_balance: currentBalance,
                    new_balance: newBalance,
                    payment_id: paymentResponse[0]
                }
            };
        }
        
        await trx.rollback();
        return { success: false, message: "Failed to update wallet" };
        
    } catch (err) {
        console.log("error", err);
        return { success: false, message: "Internal server error", error: err.message };
    }
}

module.exports.getWalletBalance = async (props) => {
    const { tenant_id } = props;
    
    try {
        const wallet = await global.dbConnection('tenants')
            .select('wallet', 'tenantname')
            .where({ tenantid: tenant_id })
            .first();
        
        if (_.isEmpty(wallet)) {
            return { success: false, message: "Tenant not found" };
        }
        
        return {
            success: true,
            message: "Wallet balance retrieved successfully",
            data: {
                tenant_id,
                tenant_name: wallet.tenantname,
                wallet_balance: _.toNumber(wallet.wallet) || 0
            }
        };
        
    } catch (err) {
        console.log("error", err);
        return { success: false, message: "Internal server error", error: err.message };
    }
}