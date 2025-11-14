const nodemailer = require('nodemailer');
const moment = require('moment');
const { transporter } = require('../apigateway/mailconfig');



module.exports.notifyEnquiryMailer = async () => {

  try {
    

    const currentISTTime = moment().tz('Asia/Kolkata').format('YYYY-MM-DD HH:mm:ss');


    const emailTemplate = () => {
      return `
            <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Enquiry Notification</title>
        <style>
          body { font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 0; }
          .container { width: 100%; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; border-radius: 8px; }
          .header { text-align: center; padding-bottom: 20px; }
          .content { font-size: 16px; color: #333333; }
          .footer { font-size: 12px; color: #999999; text-align: center; margin-top: 20px; }
          .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>Enquiry Notification</h2>
          </div>
          <div class="content">
            <p>Hello Admin,</p>
            <p>Someone has clicked the "Enquiry" button on your website.</p>
            <p>Time of action: <strong>${currentISTTime}</strong></p>
            
          </div>
          <div class="footer">
            <p>This is an automated email. Please do not reply.</p>
          </div>
        </div>
      </body>
      </html>

            `
    };
    

    const mailResonse = await transporter.sendMail({
      from: 'care@deeprintz.com',
      to: 'leadsseowebnox@gmail.com',
    //   bcc: ['leadsseowebnox@gmail.com','ganeshkarthik18697@gmail.com'],
    //   cc: ['webnoxseoleads@gmail.com'],
      subject: 'Enquiry Call Button Clicked',
      html: emailTemplate(),
    });


    if (mailResonse?.response?.includes('250 2.0.0 OK')) {
      return true
    } else {
      return false
    }

  } catch (error) {
    console.log(`error in enquiry mailer - `, error)
  }

}


this.notifyEnquiryMailer()
