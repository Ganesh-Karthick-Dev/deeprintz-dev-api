const bcrypt = require('bcryptjs');
const { jwtEncrypt, jwtDecrypt } = require('jose');
const crypto = require('crypto');
const { encryptData, decryptData } = require('./encryptDecrypt');
const moment = require('moment');
const { forgotmailer } = require('../../config/forgotmail');


module.exports.createapiuser = async (props) => {
    try {

        const { name, email, password, role } = props;

        if (role == 1) {
            const encryptedToken = encryptData(JSON.stringify(props));

            const currentUTCDate = moment.utc().toISOString();
            const tokenExpiryUTC = moment.utc().add(1, 'minutes').toISOString();

            const insertApiUser = await global.dbConnection('apiusers')
                .insert({
                    name,
                    email,
                    password,
                    token: encryptedToken,
                    tokenexpirydate: tokenExpiryUTC,
                    tokencreated: currentUTCDate,
                    status: 1
                });

            return !!insertApiUser;
        }
        else {

            const insertApiUser = await global.dbConnection('apiusers')
                .insert({
                    name,
                    email,
                    password,
                    token: '',
                    tokenexpirydate: '',
                    tokencreated: '',
                    status: 1
                });

            return insertApiUser
        }

    } catch (error) {
        console.log(`error in createapiuser service - `, error);
        return false;
    }
};

module.exports.editapiuser = async (props) => {
    try {

        const { apiuserid, name, email, password } = props

        const editApiUser = await global.dbConnection('apiusers')
            .update({
                name,
                email,
                password,
            })
            .where('apiuserid', apiuserid)

        return !!editApiUser

    } catch (error) {
        console.log(`error in editapiuser service - `, error);
    }
}

module.exports.deleteapiuser = async (props) => {
    try {

        const { apiuserid } = props

        const deleteApiUser = await global.dbConnection('apiusers')
            .delete()
            .where('apiuserid', apiuserid)

        return !!deleteApiUser

    } catch (error) {
        console.log(`error in deleteapiuser service - `, error);
    }
}

module.exports.getapiuserbyid = async (props) => {
    try {

        const { apiuserid } = props

        const getAPIuserById = await global.dbConnection('apiusers')
            .select()
            .where('apiuserid', apiuserid)
            .first()

        return getAPIuserById || false

    } catch (error) {
        console.log(`error in getAPIuserById service - `, error);
    }
}

module.exports.getallapiusers = async (props) => {
    try {
        const { apiuserid } = props;

        const getallapiusers = await global.dbConnection('apiusers')
            .select();

        const currentUTCDate = moment.utc().toDate();

        const finalData = getallapiusers?.map((data) => {

            const tokenExpiryDate = moment(data?.tokenexpirydate).toDate();

            const tokenStatus = currentUTCDate > tokenExpiryDate ? false : true;

            return {
                ...data,
                tokenStatus
            };
        });

        return finalData || false;

    } catch (error) {
        console.log(`error in getallapiusers service - `, error);
        return false;
    }
};

// module.exports.renewapiusertoken = async (props) => {
//     try {

//         const { apiuserid } = props

//         const currentUTCDate = moment.utc().toISOString();
//         const tokenExpiryUTC = moment.utc().add(1, 'day').toISOString();

//         const renewapiusertoken = await global.dbConnection('apiusers')
//             .update({
//                 tokenexpirydate: tokenExpiryUTC,
//                 tokencreated: currentUTCDate
//             })
//             .where('apiuserid', apiuserid)

//         return !!renewapiusertoken

//     } catch (error) {
//         console.log(`error in renewapiusertoken service - `, error);
//     }
// }

module.exports.toggleapiuserstatus = async (props) => {
    try {

        const { apiuserid, status } = props

        const toggleapiuserstatus = await global.dbConnection('apiusers')
            .update({
                status: status
            })
            .where('apiuserid', apiuserid)

        return !!toggleapiuserstatus

    } catch (error) {
        console.log(`error in toggleapiuserstatus service - `, error);
    }
}

module.exports.loginAPIuser = async (props) => {
    try {

        const { username, password } = props

        const loginuser = await global.dbConnection('apiusers')
            .select()
            .where('email', username)
            .andWhere('password', password)
            .first()

        if (loginuser) {
            if (loginuser?.status == 0) {
                return {
                    satus: false,
                    message: 'User De-Activated , contact Admin'
                }
            }
            else {
                return {
                    status: true,
                    message: 'log in Successfull',
                    response: loginuser
                }
            }
        }
        else {
            return {
                status: false,
                message: 'No User Found !'
            }
        }

    } catch (error) {
        console.log(`error in toggleapiuserstatus service - `, error);
    }
}

module.exports.createToken = async (props) => {
    try {

        const { apiuserid } = props

        const encryptedToken = encryptData(JSON.stringify(props));

        const currentUTCDate = moment.utc().toISOString();
        const tokenExpiryUTC = moment.utc().add(1, 'minutes').toISOString();

        const createAPIUserToken = await global.dbConnection('apiusers')
            .update({
                token: encryptedToken,
                tokenexpirydate: tokenExpiryUTC,
                tokencreated: currentUTCDate,
            })
            .where('apiuserid', apiuserid)

        return !!createAPIUserToken


    } catch (error) {
        console.log(`error in createToken service - `, error);
    }
}

module.exports.forgotPasscode = async (props) => {
    try {

        const { step, email, otp , password } = props

        const user = await global.dbConnection('apiusers')
        .select()
        .where('email', email)
        .first()


        const apiuserid = user?.apiuserid


        if (step == 1) { // check for valid email , then send email

            const checkUser = await global.dbConnection('apiusers')
                .select()
                .where('email', email)
                .first()

            if (!checkUser) {
                return {
                    status: false,
                    message: 'Email not found',
                }
            }

            const otp = Math.floor(Math.random() * 900000) + 100000

            const insertotp = await global.dbConnection('apiusers')
                .update({
                    otp: otp,
                    otpexpiry: moment.utc().add(1, 'minutes').toISOString()
                })
                .where('apiuserid', apiuserid)

            const sendEmail = insertotp == 1 && forgotmailer(checkUser, otp)


            return sendEmail ? { status: true, message: 'Forgot mail Sent Successfully , Check Your Inbox' } : { status: false, message: 'Email Not sent' }

        }
        else if (step == 2) {

            const validateotp = await global.dbConnection('apiusers')
                .select()
                .where('apiuserid', apiuserid)
                .first()

            const isvalid = validateotp?.otp == otp

            const isOtpExpired = moment.utc().diff(moment.utc(validateotp?.otpexpiry), 'minutes') > 1 ? false : true;


            if (!isvalid) {
                return {
                    status: false,
                    message: 'Invalid OTP',
                }
            }
            else if (!isOtpExpired) {
                return {
                    status: false,
                    message: 'OTP Expired!'
                }
            }
            else {

                const updateOtpstatus = await global.dbConnection('apiusers')
                    .update({
                        isotpverified: 1
                    })
                    .where('apiuserid', apiuserid)

                return {
                    status: true,
                    message: 'OTP Verified'
                }
            }

        }
        else if (step == 3) {

            const checkotpverified = await global.dbConnection('apiusers')
                .select()
                .where('apiuserid', apiuserid)
                .first()

            if (checkotpverified?.isotpverified == 0) {
                return {
                    status: false,
                    message: 'OTP not verified , unable to change password'
                }
            }
            else {
                const updatepassword = await global.dbConnection('apiusers')
                    .update({
                        password: password
                    })
                    .where('apiuserid', apiuserid)

                return updatepassword ? { status: true, message: 'Password changed successfully' } : { status: false, message: 'Failed to change password' }
            }

        }


    } catch (error) {
        console.log(`error in forgotPasscode - `, error);
    }
}


