const userService = require("../../service/authService");
const _ = require('lodash')
const jwt = require('jsonwebtoken');
const authService = require('../../service/auth/forgotService')





module.exports.register = async(req,res) => {
   try{
     
   const isUserNameAndEmailAlreadyExists = await userService.isUserNameAndEmailAlreadyExists(req.body);

     if(isUserNameAndEmailAlreadyExists){
       return res.send({
        status: false,
        message: "Username / Email Already Exists!"
       })
     }
     else {
      const response =  await userService.registerUser(req.body);
      if(!_.isEmpty(response)){
      return res.send({
        status: true,
        message: "User registered Successfully!",
        response: response
      })
       }
     }
   }
   catch(err){
    console.log("error",err);   
   }
   return res.send({
    status: false,
    message: "failed to register user!"
   })
}


// module.exports.login = async (req, res) => {
//   try {
//     const {accountid} = req.body
//     const isLoggedInViaAccountId = await userService.isLoggedInViaAccountId(req.body)
//     const UserStatus = await userService.UserStatus(req.body)

//     console.log("User status",UserStatus)
  
 
//   if(isLoggedInViaAccountId && _.isNull(accountid)){
//       return res.send({ status: false, message: "you are logged in via gmail !"})
//    }else if(UserStatus == 2){
//        return res.send({status: false , message: "User is blocked"})
//    }else if(UserStatus == 1){
//        return res.send({status: false , message: "User is InActive"})
//    }
//    else {
//       const response = await userService.login(req.body);
//       if (!_.isEmpty(response)) {
//         return res.json({
//           status: true,
//           message: "Logged in Successfully",
//           response: response
//         });
//       }

//     }
    
   
//   } catch (err) {
//     console.log(err);
//   }
//   return res.json({ status: false, message: "Invalid credentials!" });
// };


const SECRET_KEY = "Deeprintz@123"; // Replace with a strong secret key

module.exports.login = async (req, res) => {
  try {
    const { accountid } = req.body;
    const isLoggedInViaAccountId = await userService.isLoggedInViaAccountId(req.body);

    // console.log(` isLoggedInViaAccountId - `,isLoggedInViaAccountId);
  
    const UserStatus = await userService.UserStatus(req.body);

    // console.log("User status", UserStatus);

    if (isLoggedInViaAccountId && _.isNull(accountid)) {
      return res.send({ status: false, message: "You are logged in via Gmail!" });
    } else if (UserStatus == 2) {
      return res.send({ status: false, message: "User is blocked" });
    } else if (UserStatus == 1) {
      return res.send({ status: false, message: "User is Inactive" });
    } else {
      const response = await userService.login(req.body);
      if (!_.isEmpty(response)) {
        // Generate JWT Token
        const token = jwt.sign(
          { userId: response.id, email: response.email }, // Payload (You can customize it)
          SECRET_KEY, // Secret Key
          { expiresIn: "1h" } // Token Expiry Time
        );

        return res.json({
          status: true,
          message: "Logged in Successfully",
          token: token, // Returning the token
          response: response
        });
      }
    }
  } catch (err) {
    console.log(err);
  }
  return res.json({ status: false, message: "Invalid credentials!" });
};


module.exports.verifylogin = async (req, res) => {

  try {
    const { otp } = req.body
    const user = await userService.getUserInfoById(req.body)

    if (_.isEmpty(user)) {
      return res.send({ status: false, message: `Account Not Found! Please register to continue!` })
    } else if (!_.isEmpty(user) && user[0].status == 'inactive') {
      return res.send({ status: false, message: `Account deactivated! Please contact admin!` })
    // }else if(req.body.authmode == 0){
    //   if(otp){
    //     return res.send({
    //       status: true,
    //       message: "otp verified successfully",
    //       response: user
    //     })
    //   }
    }else if (!_.isEmpty(user) && user[0].expires_at < Date.now()) {
      return res.send({ status: false, message: `OTP Expired! Please send another login request!` })
    } else if (!_.isEmpty(user) && user[0].otp != otp) {
      return res.send({ status: false, message: `Incorrect OTP!` })
    }
    else {
      const response = await userService.updateOTPVerificationStatus(req.body);

      if (response == 1) {

        // if (user[0].usertype == 'tenant') {

          // const tenantInfo = await userService.getTenantInfoByUserId(req.body.userid)

          return res.send({ status: true, message: `OTP verified Successfully`})
        // } else {
        //   return res.send({ status: true, message: `OTP verified Successfully`, response: user[0] })
        // }
      }
    }
  }
  catch (err) {
    console.log(err)
  }
  return res.json({ status: false, message: `Failed to verify OTP! Try again later!` });
}

module.exports.sendOtp = async (req,res) => {
  try{
       const response = await userService.sendOtp(req.body)

       if(!_.isEmpty(response)){
          return res.send({
            status: true,
            message: "Otp send to mail successfully!"
          })
       }
  }catch(err){
     console.log("error",err)
  }
  return res.send({
    status: false,
    message: "failed to send otp"
  })
}
module.exports.blockUser = async (req,res) => {
  try{
       const response = await userService.blockUser(req.body)
       console.log("controller",response)
       if(response == 1 || response == 2){
         const result = response == 2 ? "blocked" :"unblocked"
         const user_info = await tenantService.getUserMail(req.body)
          return res.send({
            status: true,
            message: `User ${result} successfully`,
            response:  result,
            user_info: user_info,
          })
       }
  }catch(err){
     console.log("error",err)
  }
  return res.send({
    status: false,
    message: "Failed"
  })
}


module.exports.forgotController = async (req,res)=> {
  try {

    const response = await authService.forgotService(req.body)
    
    return res.send(response)
    
  } catch (error) {
    console.log(`error in forgotController - `,error);
  }
}