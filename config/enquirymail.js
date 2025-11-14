const { transporter } = require("../apigateway/mailconfig");



module.exports.enquirymailer = async (customerData) => {

  try {
    

    const emailTemplate = (customerData) => {
      return `
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
                  font-weight : bold
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
                    <p><strong>Name:</strong> ${customerData?.name}</p>
                    <p><strong>Email:</strong> ${customerData?.email}</p>
                    <p><strong>Phone:</strong> ${customerData?.number}</p>
                    <p><strong>Customer Requirement:</strong> ${customerData?.message}</p>
                  </div>
                </div>
                <div class="footer">
                  <p>© copyright 2024 | Deeprintz</p>
                </div>
              </div>
            </body>
            </html>
            `
    };


    const mailResonse = await transporter.sendMail({
      from: 'care@deeprintz.com',
      to: 'care@deeprintz.com',
      bcc: ['leadsseowebnox@gmail.com'],
      cc: ['webnoxseoleads@gmail.com'],
      subject: 'New Enquiry',
      html: emailTemplate(customerData),
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

