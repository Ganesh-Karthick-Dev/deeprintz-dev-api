const { clientForgotMail } = require("../../config/forgotmail");

module.exports.forgotService = async (props) => {
  try {
    const { status, email , otp , password} = props;

    // status = 1 = verify email
    // status = 2 = verify passcode
    // status = 3 = update password

    if (status == 1) {
      const checkMail = await global
        .dbConnection("app_users")
        .select("email")
        .where("app_users.email", email)
        .first();

      const otp = Math.floor(100000 + Math.random() * 900000);

      if (checkMail) {
        await global.dbConnection("app_users")
        .update({otp:otp})
        .where('app_users.email',checkMail?.email)

        await clientForgotMail(checkMail?.email,otp)
      }

      return checkMail
        ? { status: true, message: "OTP Sent Successfully" }
        : { status: false, message: "Email Not Found" };
    }
    else if(status == 2){

        const verifyOtp = await global.dbConnection("app_users")
        .select('otp')
        .where('app_users.email',email)
        .first()

        if(verifyOtp?.otp == otp){
            await global.dbConnection("app_users")
            .update('app_users.otpstatus',1)
            .where('app_users.email',email)
        }

        return verifyOtp?.otp == otp ? { status: true, message: "OTP Verified" } : { status: false, message: "invalid OTP !" }

    }
    else if(status == 3){

        const updatePassword = await global.dbConnection("app_users")
        .update('app_users.password',password)
        .where('app_users.email',email)
        .andWhere('app_users.otpstatus',1)        


        return updatePassword == 1 ? { status: true, message: "Password Changed Successfully" } : { status: false, message: "Failed to Change Password" }

    }
     
  } catch (error) {
    console.log(`error in forgotService - `, error);
  }
};
