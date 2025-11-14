const transporter = require("../config/mail")

const _ = require('lodash');
const { signupalertmail } = require("../config/signupmail");
const { welcomemailer } = require("../config/welcomemail");

module.exports.login = async (props) => {
  const { name, password, email, mobile, accountid, configid } = props;

  try {

    // signinconfig 1 -  normal login
    // signinconfig 2 - otp to mail
    // signinconfig 3 - otp to sms


    const authmethod = await global.dbConnection('app_config').select('signinconfigid').where('configid', configid)

    if (authmethod[0].signinconfigid == 1) {

      if (!_.isNull(accountid) && !_.isUndefined(accountid)) {
        //if account id is sent.
        const user = await global.dbConnection('app_users').select('userid', 'roleid', 'email', 'accountid', 'logged_in_via').where({ email });

        if (user[0]?.roleid == 2) {

          const tenantInfo = await global.dbConnection('app_users').
            join('tenants', 'tenants.user_id', 'app_users.userid').
            select('app_users.userid', 'tenants.tenantid', 'app_users.roleid', 'app_users.email', 'app_users.accountid', 'app_users.logged_in_via').
            where({ email });

          return !_.isEmpty(user) && !_.isEmpty(tenantInfo) ? tenantInfo : null
        }

        return !_.isEmpty(user) ? user : null;
      } else {

        const user = await global.dbConnection('app_users').select('userid', 'roleid', 'email', 'accountid', 'logged_in_via').where({ email: email, password: password });


        if (user[0]?.roleid == 2) {
          const tenantInfo = await global.dbConnection('app_users').
            join('tenants', 'tenants.user_id', 'app_users.userid').
            select('app_users.userid', 'tenants.tenantid', 'app_users.roleid', 'app_users.email', 'app_users.logged_in_via').
            where({ userid: user[0].userid });

          return !_.isEmpty(user) && !_.isEmpty(tenantInfo) ? tenantInfo : null

        }

        return !_.isEmpty(user) ? user : null;
      }
    }

    else if (authmethod[0].signinconfigid == 2) {
      const user = await global.dbConnection('app_users').select('userid', 'roleid').where({ authname: name, password: password, contactno: mobile, email: email });
      if (user) {
        var otp = Math.floor(Math.random() * 9000 + 1000);

        var mailOptions = {
          to: email,
          subject: "OTP for Verification",
          html: "<h3>OTP for account verification is </h3>" + "<h1 style='font-weight:bold;'>" + otp + "</h1>" + "<h3>This OTP will expires after 15 minutes.</h3>" // html body
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("error..", error)
            return null;
          }
        });

        const sendTime = new Date();
        const expiresTime = new Date(sendTime.getTime() + 15 * 60000);

        const sendOtp = await global.dbConnection('app_users').update({ otp: otp, send_at: sendTime, expires_at: expiresTime }).where('userid', user[0].userid)

        const data = { userid: user[0].userid, otp: otp }

        return (sendOtp == 1) ? data : null
      }

    }
    else if (authmethod[0].signinconfigid == 3) {
      const user = await global.dbConnection('app_users').select('userid', 'roleid', 'authname', 'authmode', 'usertype').where({ authname: name, password: password });

      return !_.isEmpty(user) ? user : null;
    } else {
      return null
    }

  } catch (err) {
    console.log(err);
  }
  return null;
};

module.exports.updateOTPVerificationStatus = async (props) => {
  try {

    const { userid } = props;

    const emailVerifiedAt = new Date();

    const updateOTPStatus = await global.dbConnection('app_users').update({ email_verified: "Yes" }).where('userid', userid)


    return (updateOTPStatus == 1) ? true : false;

  } catch (err) {
    console.log(err)
  }
  return false;
}

module.exports.getUserInfoById = async (props) => {
  const { userid } = props
  try {
    const user = await global.dbConnection('app_users')
      .select("*")
      .where('userid', userid)

    return _.isEmpty(user) ? null : user

  } catch (err) {
    console.log("error..", err)
  }
  return null
}

module.exports.getTenantInfoByUserId = async (userid) => {
  try {
    const response = await global.dbConnection('tenants')
      .select("*").where({ user_id: userid })
    return !_.isEmpty(response) ? response : null 
  } catch (err) {
    console.log("error..", err)
  }
  return null
}

module.exports.registerUser = async (props) => {
  const { name, password, mobile, email, roleId, accountId, loggedInVia } = props

  try {
    const getSignUpConfig = await global.dbConnection('app_config').select('signupconfigid')

    // signup-config 1 for deeprintz
    // signup-config 2 for ontrot
    if (getSignUpConfig[0].signupconfigid == 1) {

      if (loggedInVia == 'email') {

        const appuser = await global.dbConnection('app_users').insert({
          authname: name,
          email: email,
          contactno: mobile ? mobile : null,
          password: password,
          logged_in_via: loggedInVia,
          roleid: roleId,

        })


        const sendWelcomeMail =  await welcomemailer(email)


        if (roleId == 2) {

          const response = await global.dbConnection('ordercharges')
            .leftJoin('app_types', 'app_types.apptypeid', 'ordercharges.apptypeid')
            .where({ chargetype: 'handling' }).select("*")

          var handlingcharge = response[0].chargeamount;

          const response2 = await global.dbConnection('tenants').insert({
            tenantname: name, user_id: appuser[0], handlingcharge: handlingcharge
          })

          // signup alert

          const customerData = {
            name: name || '-',
            email: email
          }

          const sendAlertMail = await signupalertmail(customerData)
          // signup alert

          return !_.isEmpty(appuser) && !_.isEmpty(response2) ? response2 : null
        }

        return !_.isEmpty(appuser) ? appuser : null

      } else {
        const appuser = await global.dbConnection('app_users').insert({
          authname: name,
          email: email,
          contactno: mobile ? mobile : null,
          logged_in_via: loggedInVia,
          roleid: roleId,
          accountid: accountId

        })

        const sendWelcomeMail =  await welcomemailer(email)

        if (roleId == 2) {
          const response2 = await global.dbConnection('tenants').insert({
            tenantname: name, user_id: appuser[0]
          })

          // signup alert

          const customerData = {
            name: name || '-',
            email: email
          }

          const sendAlertMail = await signupalertmail(customerData)
          // signup alert

          if (!_.isEmpty(appuser) && !_.isEmpty(response2)) {
            const userdata = await global.dbConnection('app_users').
              join('tenants', 'tenants.user_id', 'app_users.userid').
              select('app_users.userid', 'app_users.email', 'app_users.accountid', 'tenants.tenantid').where({ user_id: appuser[0] })

            return !_.isEmpty(userdata) ? userdata : null;
          } else {
            return null
          }

        }

        return !_.isEmpty(appuser) ? appuser : null
      }
     

    }

    else if (getSignUpConfig[0].signupconfigid == 2) {

      const appuser = await global.dbConnection('app_users').insert({
        authname: name,
        email: email,
        contactno: mobile,
        roleid: roleId,

      })

      if (appuser) {
        var otp = Math.floor(Math.random() * 9000 + 1000);

        var mailOptions = {
          to: email,
          subject: "OTP for Verification",
          html: "<h3>OTP for account verification is </h3>" + "<h1 style='font-weight:bold;'>" + otp + "</h1>" + "<h3>This OTP will expires after 15 minutes.</h3>" // html body
        };

        transporter.sendMail(mailOptions, (error, info) => {
          if (error) {
            console.log("error..", error)
            return null;
          }
        });

        const sendTime = new Date();
        const expiresTime = new Date(sendTime.getTime() + 15 * 60000);

        const sendOtp = await global.dbConnection('app_users').update({ otp: otp, send_at: sendTime, expires_at: expiresTime }).where('userid', appuser[0])

        return (sendOtp == 1) ? appuser : null
      }

      return null
    }

  }
  catch (err) {
    console.log("error", err)
  }
}

module.exports.isLoggedInViaAccountId = async (props) => {
  const { email } = props
  try {
    const response = await global.dbConnection('app_users').select('logged_in_via', 'accountid').where({ email: email }).first()

    if (response?.logged_in_via == 'gmail' && response[0]?.accountid) {
      return true
    } else {
      return false
    }

  } catch (err) {
    console.log("error", err)
  }
  return false
}

module.exports.isUserNameAndEmailAlreadyExists = async (props) => {
  const { name, email } = props
  try {
    const response = await global.dbConnection('app_users').select('*').where({ email: email }).orWhere({ authname: name })
    // console.log("response",response)

    return !_.isEmpty(response) ? response : null
  } catch (err) {
    console.log("error", err)
  }
  return false
}

module.exports.sendOtp = async (props) => {
  const { email, userid } = props
  try {
    var otp = Math.floor(Math.random() * 9000 + 1000);

    var mailOptions = {
      to: email,
      subject: "OTP for Verification",
      html: "<h3>OTP for account verification is </h3>" + "<h1 style='font-weight:bold;'>" + otp + "</h1>" + "<h3>This OTP will expires after 15 minutes.</h3>" // html body
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log("error..", error)
        return null;
      }
    });

    const sendTime = new Date();
    const expiresTime = new Date(sendTime.getTime() + 15 * 60000);

    const sendOtp = await global.dbConnection('app_users').
      update({ otp: otp, otp_send_at: sendTime, otp_expires_at: expiresTime }).
      where('userid', userid)

    return (sendOtp == 1) ? sendOtp : null
  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.blockUser = async (props) => {
  const { userid, remarks, action } = props
  try {
    // 2 - block , 1 - unblock
    const datetime = new Date();
    if (action === 2) {
      const app_users1 = await global.dbConnection('app_users').update({ status: 2 }).where({ userid });


      if (app_users1 === 1) {
        const response = await global.dbConnection('app_tickets').insert({ userid, remarks, action, datetime });
        console.log("response..", response);

        return !_.isEmpty(response) ? 2 : null;
      }
    } else if (action === 1) {
      const app_users2 = await global.dbConnection('app_users').update({ status: 0 }).where({ userid });

      if (app_users2 === 1) {
        const Activeresponse = await global.dbConnection('app_tickets').insert({ userid, remarks, action, datetime });
        return !_.isEmpty(Activeresponse) ? 1 : null;
      } else {
        return null;
      }
    } else {
      return null;
    }


  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.UserStatus = async (props) => {
  const { accountid, email, password } = props
  try {

    if (accountid) {

      const user = await global.dbConnection('app_users').select('status').where({ accountid }).first()


      return user ? user?.status : null
    } else {

      const user = await global.dbConnection('app_users').select('status').where({ email: email});

      return !_.isEmpty(user) ? user[0].status : null
    }

  } catch (err) {
    console.log("error", err)
  }
  return null
}

module.exports.getUserMail = async (props) => {
  try {
    const { userid } = props;
    const user_info = await global.dbConnection('app_users').
      where('userid ', userid).
      select(
        'authname',
        'email'
      ).first();
    return !_.isEmpty(user_info) ? user_info : null;
  }
  catch (err) {
    console.log("error", err)
  }
  return null
}