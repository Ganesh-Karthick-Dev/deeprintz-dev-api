const nodemailer = require('nodemailer')


module.exports.transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "care@deeprintz.com",
    pass: "cspl pbgb xfzs cdrx",
  },
});
