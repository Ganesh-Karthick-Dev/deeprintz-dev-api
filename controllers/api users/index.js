const { validateCreateUser, validateEditUser, toggleuserstatus } = require("../../utils/joivalidator");
const apiuserservice = require('../../service/api user/index')



module.exports.createapiuser = async (req, res) => {
    try {
        const { error, value } = validateCreateUser(req.body);

        if (error) {
            return res.send({
                status: false,
                message: "Validation error",
                details: error.details[0]?.message,
            });
        }

        const response = await apiuserservice.createapiuser(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API User created successfully",
                response
            })
        }
        else {
            return res.send({
                status: false,
                message: "Failed to create API User",
            })
        }

    } catch (error) {
        console.log(`Error in createapiuser controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.editapiuser = async (req, res) => {
    try {
        const { error, value } = validateEditUser(req.body);

        if (error) {
            return res.send({
                status: false,
                message: "Validation error",
                details: error.details[0]?.message,
            });
        }

        const response = await apiuserservice.editapiuser(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API User Edited successfully",
            })
        }
        else {
            return res.send({
                status: false,
                message: "Failed to Edited API User",
            })
        }

    } catch (error) {
        console.log(`Error in createapiuser controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.deleteapiuser = async (req, res) => {
    try {

        if (!req.body.apiuserid) {
            return res.send({
                status: false,
                message: "Validation error",
                details: 'api userid required to Delete',
            });
        }

        const response = await apiuserservice.deleteapiuser(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API User Deleted successfully",
            })
        }
        else {
            return res.send({
                status: false,
                message: "Failed to Deleted API User",
            })
        }

    } catch (error) {
        console.log(`Error in deleteapiuser controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.getapiuserbyid = async (req, res) => {
    try {

        if (!req.body.apiuserid) {
            return res.send({
                status: false,
                message: "Validation error",
                details: 'api userid required',
            });
        }

        const response = await apiuserservice.getapiuserbyid(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API User Retrived successfully",
                response
            })
        }
        else {
            return res.send({
                status: false,
                message: "No User Found !",
            })
        }

    } catch (error) {
        console.log(`Error in getapiuserbyid controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.getallapiusers = async (req, res) => {
    try {


        const response = await apiuserservice.getallapiusers(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API Users Retrived successfully",
                response
            })
        }
        else {
            return res.send({
                status: false,
                message: "No Users Found !",
            })
        }

    } catch (error) {
        console.log(`Error in getallapiusers controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

// module.exports.renewapiusertoken = async (req, res) => {
//     try {

//         if (!req.body.apiuserid) {
//             return res.send({
//                 status: false,
//                 message: "Validation error",
//                 details: 'api userid required',
//             });
//         }

//         const response = await apiuserservice.renewapiusertoken(req.body)

//         if(response){
//             return res.send({
//                 status: true,
//                 message: "API User Token Renewed successfully"
//             })
//         }
//         else{
//             return res.send({
//                 status: false,
//                 message: "Failed to Renew API User Token !",
//             })
//         }

//     } catch (error) {
//         console.log(`Error in getapiuserbyid controller: `, error);
//         res.send({ message: "Internal server error" });
//     }
// };

module.exports.toggleapiuserstatus = async (req, res) => {
    try {

        const { error, value } = toggleuserstatus(req.body);

        if (error) {
            return res.send({
                status: false,
                message: "Validation error",
                details: error.details[0]?.message,
            });
        }


        const response = await apiuserservice.toggleapiuserstatus(req.body)

        if (response) {
            return res.send({
                status: true,
                message: "API Users status toggled successfully"
            })
        }
        else {
            return res.send({
                status: false,
                message: "Unable to toggle API Users status !",
            })
        }

    } catch (error) {
        console.log(`Error in getallapiusers controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.loginApiUser = async (req, res) => {
    try {


        if (!req.body.username) {
            return res.send({
                status: false,
                message: "Username Required to Login"
            });
        }
        else if (!req.body.password) {
            return res.send({
                status: false,
                message: "Password Required to Login"
            });
        }


        const response = await apiuserservice.loginAPIuser(req.body)

        return res.send(response)


    } catch (error) {
        console.log(`Error in getallapiusers controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.createToken = async (req, res) => {
    try {


        if (!req.body.apiuserid) {
            return res.send({
                status: false,
                message: "apiuserid Required to Generate token"
            });
        }


        const response = await apiuserservice.createToken(req.body)

        if (response) {
            return res.send({
                status: true,
                message: 'Token Generated Successfully'
            })
        }
        else {
            return res.send({
                status: false,
                message: 'Failed to Generate Token'
            })
        }


    } catch (error) {
        console.log(`Error in createToken controller: `, error);
        res.send({ message: "Internal server error" });
    }
};

module.exports.forgotPasscode = async (req,res) => {
    try {

        const serviceResponse = await apiuserservice.forgotPasscode(req.body)

        res.send(serviceResponse)
        
    } catch (error) {
        console.log(`error in forgotPasscode - `,error);   
    }
}