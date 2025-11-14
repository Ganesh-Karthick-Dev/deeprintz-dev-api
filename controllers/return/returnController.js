const returnService = require('../../service/return/returnService');
const { validateReturnRequest } = require('../../utils/joivalidator');
const moment = require('moment')


module.exports.sendReturnRequest = async (req, res) => {
    try {
        const { error } = validateReturnRequest(req.body.data);
        if (error) {
            return res.status(400).json({ status: false, message: error.details[0].message });
        }


        const response = await returnService.sendReturnRequest(req.body);

        if (response) {
            return res.json({ status: true, message: 'Return Request Submitted Successfully' });
        } else {
            return res.json({ status: false, message: 'Failed to Send Return Request' });
        }
    } catch (error) {
        console.error('Error in sendReturnRequest:', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};


module.exports.getAllReturns = async (req, res) => {
    try {


        const response = await returnService.getAllReturns();

        if (response) {
            return res.json({ status: true, message: 'success', response });
        } else {
            return res.json({ status: false, message: 'Failed to get all Return ' });
        }
    } catch (error) {
        console.error('Error in getAllReturns controller :', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }
};

module.exports.approveReturn = async (req, res) => {

    try {

        const response = await returnService.approveReturn(req.body);

        if (response) {
            return res.json({ status: true, message: 'Return Approved Successfully' });
        } else {
            return res.json({ status: false, message: 'Failed to Approve' });
        }

    } catch (error) {
        console.error('Error in getAllReturns controller :', error);
        res.status(500).json({ status: false, message: 'Internal Server Error' });
    }

};