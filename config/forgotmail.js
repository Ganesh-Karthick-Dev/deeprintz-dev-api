const nodemailer = require('nodemailer');
const { transporter } = require('../apigateway/mailconfig');



module.exports.forgotmailer = async (customerData, otp) => {

    try {
        

        const emailTemplate = (customerData) => {
            return `
           <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP for Verification</title>
    <style>
        /* General Styles */
        body {
            background: linear-gradient(to bottom right, #4C51BF, #6B46C1);
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 50px 0;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            position: relative;
        }

        .top-decorative {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            border-top-left-radius: 15px;
            border-top-right-radius: 15px;
        }

        .bottom-decorative {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(to left, #4C51BF, #6B46C1);
            border-bottom-left-radius: 15px;
            border-bottom-right-radius: 15px;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 36px;
            color: #4C51BF;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 18px;
            color: #4A5568;
        }

        .otp-box {
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            padding: 15px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            text-align: center;
            display: inline-block;
        }

        .instructions {
            text-align: center;
            color: #4A5568;
            font-size: 16px;
        }

        .footer {
            border-top: 1px solid #E2E8F0;
            padding-top: 15px;
            text-align: center;
            font-size: 14px;
            color: #A0AEC0;
        }

        .footer a {
            color: #4C51BF;
            text-decoration: none;
        }

        /* Centering the OTP Box with Tables */
        .otp-table {
            width: 100%;
            text-align: center;
        }

        .otp-table-inner {
            max-width: 300px;
            width: 100%;
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            border-radius: 10px;
            margin: 0 auto;
        }

        .otp-box-inner {
            font-size: 40px;
            color: #fff;
            padding: 15px 30px;
            text-align: center;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Decorative Elements -->
        <div class="top-decorative"></div>

        <!-- Header Section -->
        <div class="header">
            <h1>Verify Your Account</h1>
            <p>Use the One-Time Password (OTP) below to verify your identity. This OTP expires in 10 minutes.</p>
        </div>

        <!-- OTP Section (using tables to center the OTP box) -->
        <table role="presentation" class="otp-table" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    <table role="presentation" class="otp-table-inner" cellspacing="0" cellpadding="0">
                        <tr>
                            <td class="otp-box-inner">
                                ${customerData.otp}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Instructions Section -->
        <div class="instructions">
            <p>If you did not request this OTP, please ignore this email. The OTP is confidential and should not be shared with anyone.</p>
        </div>

        <!-- Footer Section -->
        <div class="footer">
            <p>For assistance, contact our <a href="mailto:care@deeprintz.com">support team</a>.</p>
        </div>

        <!-- Decorative Footer Elements -->
        <div class="bottom-decorative"></div>
    </div>
</body>
</html>

            `;
        };


        const mailResonse = await transporter.sendMail({
            from: 'care@deeprintz.com',
            to: customerData?.email,
            // bcc: ['guru.02work@gmail.com', 'surendranseo@gmail.com','arshe3956@gmail.com'],
            // cc: ['webnoxseoleads@gmail.com'],
            subject: 'Deeprintz Developer - Password Forgot Mail',
            html: emailTemplate(customerData),
        });


        if (mailResonse?.response?.includes('250 2.0.0 OK')) {
            return true
        } else {
            return false
        }

    } catch (error) {
        console.log(`error in forgotmailer mailer - `, error)
    }

}



module.exports.clientForgotMail = async (email, otp) => {

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: "care@deeprintz.com",
                pass: "tmfb ojib aydr kkpl"
            }
        });

        const emailTemplate = (otp) => {
            return `
           <!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTP for Verification</title>
    <style>
        /* General Styles */
        body {
            background: linear-gradient(to bottom right, #4C51BF, #6B46C1);
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 50px 0;
        }

        .container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #fff;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            position: relative;
        }

        .top-decorative {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            border-top-left-radius: 15px;
            border-top-right-radius: 15px;
        }

        .bottom-decorative {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            height: 5px;
            background: linear-gradient(to left, #4C51BF, #6B46C1);
            border-bottom-left-radius: 15px;
            border-bottom-right-radius: 15px;
        }

        .header {
            text-align: center;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 36px;
            color: #4C51BF;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .header p {
            font-size: 18px;
            color: #4A5568;
        }

        .otp-box {
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            color: #fff;
            font-size: 40px;
            font-weight: bold;
            padding: 15px 30px;
            border-radius: 10px;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
            margin: 20px 0;
            text-align: center;
            display: inline-block;
        }

        .instructions {
            text-align: center;
            color: #4A5568;
            font-size: 16px;
        }

        .footer {
            border-top: 1px solid #E2E8F0;
            padding-top: 15px;
            text-align: center;
            font-size: 14px;
            color: #A0AEC0;
        }

        .footer a {
            color: #4C51BF;
            text-decoration: none;
        }

        /* Centering the OTP Box with Tables */
        .otp-table {
            width: 100%;
            text-align: center;
        }

        .otp-table-inner {
            max-width: 300px;
            width: 100%;
            background: linear-gradient(to right, #4C51BF, #6B46C1);
            border-radius: 10px;
            margin: 0 auto;
        }

        .otp-box-inner {
            font-size: 40px;
            color: #fff;
            padding: 15px 30px;
            text-align: center;
            border-radius: 10px;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Decorative Elements -->
        <div class="top-decorative"></div>

        <!-- Header Section -->
        <div class="header">
            <h1>Verify Your Account</h1>
            <p>Use the One-Time Password (OTP) below to verify your identity. This OTP expires in 10 minutes.</p>
        </div>

        <!-- OTP Section (using tables to center the OTP box) -->
        <table role="presentation" class="otp-table" cellspacing="0" cellpadding="0">
            <tr>
                <td align="center">
                    <table role="presentation" class="otp-table-inner" cellspacing="0" cellpadding="0">
                        <tr>
                            <td class="otp-box-inner">
                                ${otp}
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Instructions Section -->
        <div class="instructions">
            <p>If you did not request this OTP, please ignore this email. The OTP is confidential and should not be shared with anyone.</p>
        </div>

        <!-- Footer Section -->
        <div class="footer">
            <p>For assistance, contact our <a href="mailto:care@deeprintz.com">support team</a>.</p>
        </div>

        <!-- Decorative Footer Elements -->
        <div class="bottom-decorative"></div>
    </div>
</body>
</html>

            `;
        };


        const mailResonse = await transporter.sendMail({
            from: 'care@deeprintz.com',
            to: email,
            // bcc: ['guru.02work@gmail.com', 'surendranseo@gmail.com','arshe3956@gmail.com'],
            // cc: ['webnoxseoleads@gmail.com'],
            subject: 'Deeprintz - Password Forgot Mail',
            html: emailTemplate(otp),
        });


        if (mailResonse?.response?.includes('250 2.0.0 OK')) {
            return true
        } else {
            return false
        }

    } catch (error) {
        console.log(`error in forgotmailer mailer - `, error)
    }

}
