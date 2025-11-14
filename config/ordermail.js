const nodemailer = require('nodemailer');
const { transporter } = require('../apigateway/mailconfig');



module.exports.orderMailForClient = async (customerData, invoice_url,email) => {

  try {
    
    const emailTemplate = (customerData) => {
      return `
           <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Thank You for Your Purchase</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .email-container {
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            background-color: #5e2482;
            color: #ffffff;
            padding: 20px;
            text-align: center;
            border-radius: 8px 8px 0 0;
        }
        .header h1 {
            margin: 0;
            font-size: 24px;
        }
        .content {
            padding: 20px;
            color: #333333;
        }
        .cta-button {
            display: inline-block;
            background-color: #5e2482;
            color: #ffffff !important;
            padding: 10px 20px;
            text-decoration: none;
            border-radius: 5px;
            margin-top: 20px;
        }
        .footer {
            text-align: center;
            font-size: 12px;
            color: #777777;
            margin-top: 40px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>Thank You for Your Purchase!</h1>
        </div>
        <div class="content">
            <p>Dear ${customerData?.customerDetails?.name} ,</p>
            <p>We are excited to confirm that your order has been successfully processed. Thank you for shopping with us!</p>
            <p>Your items will be shipped shortly, and you’ll receive a tracking number once your order is Dispatched.</p>
            <p>If you have any questions or concerns, feel free to contact our support team.</p>
            <a href="https://deeprintz.com/contact-us" target="_blank" class="cta-button">Contact Us</a>
        </div>
        <div class="footer">
            <p>&copy; Deeprintz . All rights reserved.</p>
        </div>
    </div>
</body>
</html>

            `
    };
    

    const mailResonse = await transporter.sendMail({
      from: 'care@deeprintz.com',
      to: email,
    //   bcc: ['guru.02work@gmail.com', 'surendranseo@gmail.com', 'arshe3956@gmail.com'],
    //   cc: ['webnoxseoleads@gmail.com'],
      subject: 'Thank you for Purchase with Deeprintz',
      html: emailTemplate(customerData),
      attachments : [{
        filename : `Invoice.pdf`,
        path : invoice_url
      }]
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

module.exports.orderMailForAdmin = async (customerData) => {

    try {

      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: "care@deeprintz.com",
          pass: "tmfb ojib aydr kkpl"
        }
      });
  
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
        bcc: ['guru.02work@gmail.com', 'surendranseo@gmail.com', 'arshe3956@gmail.com'],
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