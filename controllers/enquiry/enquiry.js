const Joi = require('joi');
const enquiryService = require('../../service/enquiry/enquiry.js')
const nodemailer = require("nodemailer");




module.exports.sendEnquiryMailController = async (req, res) => {

  try {

    const validaeSchema = Joi.object({
      name: Joi.string().required(),
      email: Joi.string().email().required(),
      number: Joi.string().required(),
      message: Joi.string().optional()
    })

    const { error, value } = validaeSchema?.validate(req.body)

    if (error) {
      return res.send({
        status: false,
        message: error?.details
      })
    }

    const serviceresponse = await enquiryService?.sendEnquiryMailService(req.body);

    if (!serviceresponse) {
      res.send({
        status: false,
        message: 'Failed to send Email'
      })
    }
    else {
      res.send({
        status: true,
        message: 'email sent successfully'
      })
    }

  } catch (error) {
    console.log(`error in sendEnquiryMailController - `, error);
    res.send({
      status: false,
      message: 'server error in sendEnquiryMailController'
    })
  }

}


module.exports.getAllEnquires = async (req, res) => {
  try {

    const response = await enquiryService.getAllEnquiry()

    if (response) {
      return res.send({
        status: true,
        message: 'All Enquires Retrived Successfullt',
        response
      })
    }
    else {
      return res.send({
        status: false,
        message: 'Failed to Retrived All Enquires'
      })
    }

  } catch (error) {
    console.log(`error in getAllEnquires - `, error);
  }
}


module.exports.webhook = async (req, res) => {

  try {

    console.log(` json.Headers - `, JSON.stringify(req.headers));
    console.log(` json.string - `, JSON.stringify(req.body));

    res.send({
      message: 'hi'
    })


  } catch (error) {
    console.log(`error in sendEnquiryMailController - `, error);
    res.send({
      status: false,
      message: 'server error in sendEnquiryMailController'
    })
  }

}

// module.exports.sendEnquiryMailController = async (req, res) => {

//     try {

//         const validaeSchema = Joi.object({
//             name: Joi.string().required(),
//             email: Joi.string().email().required(),
//             number: Joi.string().pattern(/^[0-9]{10}$/).required(),
//             message: Joi.string().optional()
//         })

//         const { error, value } = validaeSchema?.validate(req.body)

//         if (error) {
//             return res.send({
//                 status: false,
//                 message: error?.details
//             })
//         }

//         const serviceresponse = await this.sendEnquiryMailService(value);

//         if (!serviceresponse) {
//             res.send({
//                 status: false,
//                 message: 'Failed to send Email'
//             })
//         }
//         else {
//             res.send({
//                 status: true,
//                 message: 'email sent successfully'
//             })
//         }

//     } catch (error) {
//         console.log(`error in sendEnquiryMailController - `, error);
//         res.send({
//             status: false,
//             message: 'server error in sendEnquiryMailController'
//         })
//     }
// }

module.exports.sendEnquiryMailv1 = async (customerData) => {
  try {
    // Email template
    const emailTemplate = (customerData) => `
            <!DOCTYPE html>
            <html lang="en">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body {
                  font-family: Arial, sans-serif;
                  background-color: #f4f4f4;
                  margin: 0;
                  padding: 0;
                }
                .container {
                  width: 100%;
                  max-width: 600px;
                  margin: 20px auto;
                  background-color: #ffffff;
                  padding: 20px;
                  border-radius: 10px;
                  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                }
                .header {
                  text-align: center;
                  padding-bottom: 20px;
                  border-bottom: 2px solid #e2e2e2;
                }
                .header h1 {
                  color: #4f2c7b;
                  margin: 0;
                  font-weight: bold;
                }
                .content {
                  margin-top: 20px;
                }
                .content p {
                  font-size: 16px;
                  line-height: 1.5;
                  margin: 10px 0;
                }
                .content .info {
                  padding: 10px;
                  background-color: #f9f9f9;
                  border-radius: 5px;
                }
                .footer {
                  margin-top: 20px;
                  text-align: center;
                  font-size: 12px;
                  color: #999999;
                }
                .footer p {
                  margin: 0;
                }
                .footer a {
                  color: #1a73e8;
                  text-decoration: none;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>New Enquiry</h1>
                </div>
                <div class="content">
                  <p><strong>Dear Team,</strong></p>
                  <p>You have received a new enquiry. Below are the details:</p>
                  <div class="info">
                    <p><strong>Name:</strong> ${customerData?.name || 'N/A'}</p>
                    <p><strong>Email:</strong> ${customerData?.email || 'N/A'}</p>
                    <p><strong>Phone:</strong> ${customerData?.number || 'N/A'}</p>
                    <p><strong>Customer Requirement:</strong> ${customerData?.message || 'N/A'}</p>
                  </div>
                </div>
                <div class="footer">
                  <p>© copyright 2024 | Deeprintz</p>
                </div>
              </div>
            </body>
            </html>`;

    const transporter = nodemailer.createTransport({
      service: 'gmail', // Use your email provider
      auth: {
        user: "care@deeprintz.com", // Replace with your email
        pass: "tmfb ojib aydr kkpl"  // Replace with your password
      }
    })

    const mailOptions = {
      from: '"Deeprintz" <care@deeprintz.com>',
      to: "mayavanmaya12@gmail.com",
      subject: 'Order Confirmation',
      html: emailTemplate
    }

    // Send email
    const response = await transporter.sendMail(mailOptions);

    console.log('Email sent:', response);
    return true;

  } catch (error) {
    console.error('Error sending enquiry email:', error);
    return false;
  }
};



module.exports.alertEnquiry = async (req, res) => {

  try {


    const response = await enquiryService.alertEnquiryService()

if(response){
  return res.send({
    status : true,
    message : 'Alert Email Sent Successfully'
  })
}
else {
  return res.send({
    status : false,
    message : 'Failed to send Alert Email !'
  })
}


  } catch (error) {
    console.log(`error in sendEnquiryMailController - `, error);
    res.send({
      status: false,
      message: 'server error in sendEnquiryMailController'
    })
  }

}