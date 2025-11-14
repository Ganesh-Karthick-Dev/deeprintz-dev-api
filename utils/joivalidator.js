const Joi = require('joi');

const validateCreateUser = (data) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        role: Joi.number().required()
    });

    const { error, value } = schema.validate(data);

    return { error, value };
};

const validateEditUser = (data) => {
    const schema = Joi.object({
        name: Joi.string().required(),
        email: Joi.string().email().required(),
        password: Joi.string().required(),
        apiuserid: Joi.number().required()
    });

    const { error, value } = schema.validate(data);

    return { error, value };
};

const toggleuserstatus = (data) => {

    const schema = Joi.object({
        apiuserid: Joi.number().required(),
        status: Joi.number().required().valid(0, 1).messages({
            'any.only': 'Status must be either 0 or 1'
        })
    });

    const { error, value } = schema.validate(data);

    return { error, value };
};

const validateReturnRequest = (data) => {
    const schema = Joi.object({
        orderid: Joi.string().required(),
        orderdate: Joi.string().max(255).required(),
        orderheaderid: Joi.number().required(),
        ordervalue: Joi.string().max(255).optional(),
        totalamount: Joi.string().max(255).optional(),
        deliverycharge: Joi.string().max(255).optional(),
        awb_code: Joi.string().max(255).allow(null).optional(),
        courier_company_id: Joi.number().allow(null).optional(),
        quantity: Joi.number().integer().required(),
        tenantproductid: Joi.number().integer().required(),
        taxamount: Joi.string().max(255).optional(),
        productsku: Joi.string().max(255).optional(),
        customername: Joi.string().max(255).optional(),
        email: Joi.string().email().max(255).optional(),
        contactno: Joi.string().max(255).optional(),
        deliveryaddress: Joi.string().max(255).optional(),
        state: Joi.string().max(255).optional(),
        city: Joi.string().max(255).optional(),
        courierid: Joi.number().integer().optional(),
        pincode: Joi.number().integer().optional(),
        videourl: Joi.string().max(255).optional(),
        returncategory: Joi.string().required(),
        returnreason: Joi.string().required(),
        tenantid: Joi.number().required(),
        orderdate: Joi.string().required(),
        created_at : Joi.string().required()
    });

    const { error, value } = schema.validate(data);

    return { error, value };
};

module.exports = { validateCreateUser, validateEditUser, toggleuserstatus, validateReturnRequest };
