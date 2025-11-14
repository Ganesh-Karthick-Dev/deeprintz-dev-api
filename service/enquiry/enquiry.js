const { enquirymailer } = require("../../config/enquirymail");
const { notifyEnquiryMailer } = require("../../config/notifyEnquiry");



module.exports.sendEnquiryMailService = async (props) => {
    try {

        console.log(`epic request data - `,props);
        

        const sendMail = await enquirymailer(props)

        const insertEnquiryTable = await global.dbConnection('enquiry')
            .insert(props)


        return sendMail

    } catch (error) {
        console.log(`error in sendEnquiryMailService -`, error);
    }
}


module.exports.getAllEnquiry = async () => {
    try {
        

        // const sendMail = await enquirymailer(props)

        const insertEnquiryTable = await global.dbConnection('enquiry')
            .select()


        return insertEnquiryTable

    } catch (error) {
        console.log(`error in getAllEnquiry -`, error);
    }
}


module.exports.alertEnquiryService = async () => {
    try {
        

        const sendAlertmail = await notifyEnquiryMailer()


        return sendAlertmail

    } catch (error) {
        console.log(`error in getAllEnquiry -`, error);
    }
}