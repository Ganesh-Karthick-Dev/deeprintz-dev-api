const _ = require("lodash");
const moment = require('moment')

module.exports.downloadsalesReport = async (props) => {
    try {
        const { from_date, to_date, client_id } = props;

        const fromDate = new Date(`${from_date}T00:00:00Z`);
        const toDate = new Date(`${to_date}T23:59:59.999Z`);   
        
        let query = global.dbConnection('orders')
            .leftJoin("tenants", "tenants.tenantid", "orders.tenantid")
            .leftJoin('orderdetails', 'orderdetails.orderheaderid', 'orders.orderheaderid')
            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
            .leftJoin('products', 'products.productid', 'tenantproducts.productid')
            .select(
                'orders.orderid', 
                'orders.orderstatus',
                'orders.orderdate',
                'tenants.user_id as tenantUserId',
                'tenants.tenantname',
                'tenants.companyname',
                'tenantproducts.productsku',
                'products.productname',
                'orderdetails.quantity',
                'orderdetails.productcost',
                'orderdetails.charges',
                'orderdetails.total as totalproductamount',
                'orderdetails.taxpercent',
                'orderdetails.taxamount',
                'orders.awb_code',
                'orders.invoice_url',
                'orders.label_url',
                'orders.totalamount',
                'orders.ordervalue',
                'orders.deliverycharge'
            )
            .whereBetween('orders.orderdate', [fromDate, toDate]);
        
        if (client_id) {
            query = query.where('orders.tenantid', client_id);
        }

        const response = await query;
        
        return !_.isEmpty(response) ? response : null;
        
    } catch (err) {
        console.log("error", err);
    }
}

module.exports.salesChartData = async(props) => {
    try {
        
        var chartdata = [];
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        for (let month = 1; month <= 12; month++) {
            var data = {};
            const response = await global.dbConnection('orders')
                                    .select(
                                        global.dbConnection.raw('MONTH(orderdate) as month'), 
                                        global.dbConnection.raw('COUNT(*) as total'), 
                                        global.dbConnection.raw('SUM(totalamount) as totalamount') 
                                    )
                                    .whereRaw('MONTH(orderdate) = ?', [month]);
                                    

            //console.log(response);
           
            data['month'] = monthNames[month - 1];
            data['orders'] = response[0].total;   
            if(response[0].totalamount != null){
                data['total'] = response[0].totalamount;
            }else{
                data['total'] = 0;
            }
                    
            chartdata.push(data);                    
        }
        return chartdata;
        
    } catch (err) {
        console.log("error" , err);
    }
}

module.exports.ordersChartData = async(req,res) =>{
    try {

        const response = await global.dbConnection('orders')
                            .leftJoin('orderdetails', 'orderdetails.orderheaderid', 'orders.orderheaderid')
                            .leftJoin('tenantproducts', 'tenantproducts.tenantproductid', 'orderdetails.tenantproductid')
                            .leftJoin('products', 'products.productid', 'tenantproducts.productid')
                            .whereNotNull('products.productid')
                            .select(
                                'products.productid',
                                'products.productname',
                                global.dbConnection.raw('COUNT(orders.orderid) as totalOrders'),
                                global.dbConnection.raw('SUM(orders.totalamount) as totalamount')
                            )
                            .groupBy('products.productid', 'products.productname');

        return response;                                
        
    } catch (err) {
        console.log("error" , err);
    }
}
