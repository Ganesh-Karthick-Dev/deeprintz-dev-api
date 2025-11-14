const { default: axios } = require("axios");
const { generateToken } = require("./orders/orderController");



module.exports.createReturnOrder = async( postCode, paymentMode, weight, orderAmount) => {
    
    try{

        const token = await generateToken()

        console.log(`for return order token - `,token)
        const payment_type = paymentMode === 'cod' ? 'cod' : 'prepaid';
        const data = {
            origin: "641603", // Static origin
            destination: postCode,
            payment_type: payment_type,
            order_amount: payment_type === 'cod' ? orderAmount : "",
            weight: weight,
            length: "",  // Optional, add if needed
            breadth: "", // Optional, add if needed
            height: ""   // Optional, add if needed
        };

        const baseURL = "https://api.nimbuspost.com/v1/";

        const response = await axios.post(`${baseURL}courier/serviceability`, data, {
            headers: {
                'Authorization': `Bearer ${token?.data}`,
                'Content-Type': 'application/json'
            }
        });

        console.log(`courier response - `,response);
        

        const result = response.data;
        if (result.status) {
            const courierData = result.data;
            return courierData;
        }
        return null;
    }catch (err) {
        console.log("error",err)
    }
    return null;
}

console.log(this.createReturnOrder())