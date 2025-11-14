const { transporter } = require("../apigateway/mailconfig");



module.exports.welcomemailer = async (email) => {

  try {
    

    const emailTemplate = () => {
      return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Deeprintz!</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
        }
        .container {
            max-width: 600px;
            margin: 40px auto;
            background: #ffffff;
            padding: 30px;
            border-radius: 12px;
            box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
            text-align: center;
            border-top: 5px solid #4f2c7b;
        }
        h1 {
            color: #4f2c7b;
            font-size: 28px;
            margin-bottom: 10px;
        }
        p {
            color: #444;
            font-size: 16px;
            line-height: 1.8;
            margin-bottom: 20px;
        }
        .view-button {
        display: inline-block;
        background-color: #4f2c7b;
        color: #ffffff !important; /* Ensure white text */
        padding: 10px 16px;
        font-size: 14px;
        font-weight: bold;
        text-decoration: none;
        border-radius: 5px;
        transition: background 0.3s ease-in-out;
    }
    .view-button:hover {
        background-color: #3a1f5c;
    }
    .button {
        display: inline-block;
        background-color: #4f2c7b;
        color: #ffffff !important; /* Ensure white text */
        padding: 14px 28px;
        text-decoration: none;
        font-size: 18px;
        font-weight: bold;
        border-radius: 8px;
        transition: background 0.3s ease-in-out;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        margin-top: 15px;
    }
    .button:hover {
        background-color: #3a1f5c;
    }
        
        /* Table layout for product cards */
        .product-table {
            width: 100%;
            border-spacing: 15px; /* Space between product cards */
        }
        .product-card {
            background: #ffffff;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
            text-align: center;
            padding: 15px;
            display: inline-block;
            width: 45%; /* Two cards per row */
            vertical-align: top;
            margin: 10px; /* Space between cards */
        }
        .product-card img {
            width: 100%;
            max-width: 200px;
            height: auto;
            border-radius: 6px;
        }
        .product-card h3 {
            font-size: 16px;
            color: #4f2c7b;
            margin: 10px 0;
        }
        .product-card p {
            font-size: 14px;
            color: #666;
            margin-bottom: 12px;
        }
        .footer {
            margin-top: 30px;
            font-size: 14px;
            color: #777;
            border-top: 1px solid #ddd;
            padding-top: 15px;
        }
        .help {
            color: #3B82F6;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to Deeprintz!</h1>
        <p>We're delighted to have you as part of the Deeprintz family. Get ready to explore an exclusive range of premium print-on-demand products tailored just for you.</p>
        
        <table class="product-table">
            <tr>
                <td class="product-card">
                    <img src="https://deeprintz.blr1.digitaloceanspaces.com/core_images/Mens-Polo/Front/Mens%20Polo%20Front%20Maroon.jpg" alt="Mens Classic Polo">
                    <h3>Mens Classic Polo</h3>
                    <p>A men’s polo t-shirt is a classic wardrobe staple that combines style and comfort.</p>
                    <a href="https://deeprintz.com/product/Classic-Mens-Polo" class="view-button">View</a>
                </td>
                <td class="product-card">
                    <img src="https://deeprintz.blr1.digitaloceanspaces.com/core_images/Unisex-Over-Size-T-Shirt/Front/Unisex%20Over%20Size%20T-Shirt-Front-Mustard%20Yellow.jpg" alt="Unisex Over Size T-Shirt">
                    <h3>Unisex Over Size T-Shirt</h3>
                    <p>An oversized T-shirt offers comfort with a modern, relaxed fit for effortless style.</p>
                    <a href="https://deeprintz.com/product/Unisex-Over-Size-T-Shirt" class="view-button">View</a>
                </td>
            </tr>
            <tr>
                <td class="product-card" colspan="2">
                    <img src="https://deeprintz.blr1.digitaloceanspaces.com/core_images/Kids-Round-Neck-Half-Sleeve/front/Kids%20Round%20Neck%20Half%20Sleeve-Front-Aqua%20Blue.jpg" alt="Kids Round Neck Half Sleeve">
                    <h3>Kids Round Neck Half Sleeve</h3>
                    <p>Our Kids Round Neck Half Sleeve T-shirt offers ultimate comfort and durability.</p>
                    <a href="https://deeprintz.com/product/Kids-Round-Neck-Half-Sleeve" class="view-button">View</a>
                </td>
            </tr>
        </table>
        
        <a href="https://www.deeprintz.com" class="button">Explore</a>
        <p class="footer"><a href="https://deeprintz.com/contact-us" class="help">Need help?</a> Our support team is always here for you. Happy printing!</p>
    </div>
</body>
</html>


            `
    };


    const mailResonse = await transporter.sendMail({
      from: 'care@deeprintz.com',
      to: email,
    //   bcc: ['leadsseowebnox@gmail.com'],
    //   cc: ['webnoxseoleads@gmail.com'],
      subject: '🎉 Welcome to Deeprintz – Your Creative Journey Begins!',
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

