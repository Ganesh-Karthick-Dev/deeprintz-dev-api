const { default: axios } = require("axios");
const { generateToken } = require("../../controllers/orders/orderController");


module.exports.sendReturnRequest = async (props) => {
    try {

        console.log(`order - `, props);

        const insertReturnRequest = await global.dbConnection('returns')
            .insert(props)

        return !!insertReturnRequest

    }
    catch (error) {
        console.log(`error in sendReturnRequest -`, error);
    }
}

module.exports.getAllReturns = async () => {
    try {

        const getAllReturns = await global.dbConnection('returns')
            .leftJoin('tenantproducts', 'returns.tenantproductid', 'tenantproducts.tenantproductid')
            .leftJoin('productvariants', 'tenantproducts.variantid', 'productvariants.variantid')
            .select(
                'returns.*',
                'productvariants.variantid',
                'productvariants.weight as productWeight'
            );

        const finlData = getAllReturns.map(item => {
            if (item.nimbus_response) {
                item.nimbus_response = JSON.parse(item.nimbus_response);
            }
            else {
                item.nimbus_response = {}
            }
            return item;
        });

        return finlData;

    } catch (error) {
        console.log(`Error in getAllReturns -`, error);
    }
};


module.exports.approveReturn = async (props) => {
    try {

        const { courierData, data } = props

        const getAllreturns = await global.dbConnection('returns')
            .update({
                status: 2
            })
            .where('returns.id', data?.id)

        const orderheaderid = await global.dbConnection('returns')
            .select('')
            .where('returns.id', data?.id)
            .first()

        // create shipment
        const payload = {
            order_number: data?.orderid,
            shipping_charges: data?.total_charges,
            discount: 0,
            cod_charges: 0,
            payment_type: "prepaid",
            order_amount: data?.ordervalue,
            package_weight: Number(data?.productWeight) * data?.quantity,
            package_length: 10,
            package_breadth: 10,
            package_height: 10,
            request_auto_pickup: "yes",
            consignee: {
                name: "DEEPPRINTZ INDIA PRIVATE LIMITED",
                address: "12/51, First Street, VOC Nagar, Kumar Nagar, Tirupur, Tamil Nadu, India",
                address_2: "Near Bus Stand",
                city: "Tirupur",
                state: "Tamil Nadu",
                pincode: "641603",
                phone: "9751000919"
            },
            pickup: {
                warehouse_name: data?.city,
                name: data?.customername,
                address: data?.deliveryaddress,
                address_2: "",
                city: data?.city,
                state: data?.state,
                pincode: data?.pincode,
                phone: data?.contactno
            },
            order_items: [
                {
                    name: data?.productsku,
                    qty: data?.quantity,
                    price: 200,
                    sku: data?.productsku
                }
            ],
            courier_id: courierData?.id,
            is_insurance: "0",
            tags: "returns"
        }

        const nimbusdata = await createReturnShipment(payload)
        console.log(`nimbusdata - `, nimbusdata);

        if (nimbusdata?.status) {

            // create shipment

            const changeOrderStatus = await global.dbConnection('orders')
                .update({
                    orderstatus: 'returned',
                })
                .where('orders.orderheaderid', orderheaderid?.orderheaderid)


            const insertData = await global.dbConnection('returns')
                .update({
                    nimbus_response: JSON.stringify(nimbusdata?.data)
                })
                .where('returns.id', data?.id)


            return true

        }
        else {
            return false
        }


        // return !!getAllreturns
    }
    catch (error) {
        console.log(`error in approveReturn -`, error);
    }
}

async function createReturnShipment(payload) {
    try {

        const token = await generateToken()


        const response = await axios.post(`https://api.nimbuspost.com/v1/shipments`, payload, {
            headers: {
                'Authorization': `Bearer ${token?.data}`,
                'Content-Type': 'application/json'
            }
        });

        return response


    } catch (error) {
        console.log(`error in createReturnShipment service - `, error);
    }
}

