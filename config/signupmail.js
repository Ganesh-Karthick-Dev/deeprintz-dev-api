const { transporter } = require("../apigateway/mailconfig");



module.exports.signupalertmail = async (customerData) => {

  try {
    

    const emailTemplate = (customerData) => {
      return `
             <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New User Signup Alert</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f5f5f5;
        }
        .email-container {
            max-width: 600px;
            margin: 30px auto;
            background-color: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            overflow: hidden;
        }
        .header {
            background-color: #4f2c7b;
            color: #ffffff;
            padding: 20px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
        }
        .content {
            padding: 30px;
            color: #333333;
        }
        .content p {
            font-size: 16px;
            line-height: 1.6;
        }
        .content .user-info {
            background-color: #f9f9f9;
            border-left: 4px solid #4f2c7b;
            padding: 10px;
            margin: 20px 0;
        }
        .footer {
            background-color: #f1f1f1;
            color: #777777;
            padding: 15px;
            text-align: center;
            font-size: 14px;
        }
        .footer a {
            color: #4CAF50;
            text-decoration: none;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>New User Signup Alert</h1>
        </div>
        <div class="content">
            <p>Dear Admin,</p>
            <p>A new user has signed up , Here are their details:</p>
            <div class="user-info">
                <p><strong>Name : </strong>${customerData?.name}</p>
                <p><strong>Email : </strong>${customerData?.email}</p>
            </div>
            
        </div>
        <div class="footer">
            <p>&copy; 2025 Deeprintz. All rights reserved.</p>
        </div>
    </div>
</body>
</html>

            `
    };
    

    const mailResonse = await transporter.sendMail({
      from: 'care@deeprintz.com',
      to: 'care@deeprintz.com',
      bcc: ['leadsseowebnox@gmail.com','ganeshkarthik18697@gmail.com'],
    //   cc: ['webnoxseoleads@gmail.com'],
      subject: 'New User Registered',
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

