const puppeteer = require('puppeteer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');

// DigitalOcean Spaces configuration
const spacesConfig = {
  endpoint: "https://blr1.digitaloceanspaces.com",
  region: 'blr1',
  credentials: {
    accessKeyId: 'DO003XAZMT4RA4DVPE32',
    secretAccessKey: 'g1AVAJd4794f/T6R3U091YY8tA9QCt2HLrMRBdKJum8'
  },
  bucketName: 'deeprintz'
};


async function generatePDF(htmlContent) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  await page.setContent(htmlContent, {
    waitUntil: 'networkidle0'
  });

  const pdfBuffer = await page.pdf({
    format: 'A4',
    printBackground: true,
    margin: {
      top: '20mm',
      right: '20mm',
      bottom: '20mm',
      left: '20mm'
    }
  });

  await browser.close();
  return pdfBuffer;
}

async function uploadToSpaces(fileBuffer, fileName) {
  const s3Client = new S3Client({
    region: spacesConfig.region,
    endpoint: spacesConfig.endpoint,
    credentials: spacesConfig.credentials
  });

  const params = {
    Bucket: spacesConfig.bucketName,
    Key: `invoices/${fileName}`,
    Body: fileBuffer,
    ACL: 'public-read',
    ContentType: 'application/pdf'
  };

  await s3Client.send(new PutObjectCommand(params));

  return `https://${spacesConfig.bucketName}.${spacesConfig.region}.digitaloceanspaces.com/invoices/${fileName}`;
}

function convertNumberToWords(amount) {
  const words = [
      "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
      "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  
  function convert(n) {
      if (n < 20) return words[n];
      if (n < 100) return tens[Math.floor(n / 10)] + " " + words[n % 10];
      if (n < 1000) return words[Math.floor(n / 100)] + " Hundred " + convert(n % 100);
      if (n < 100000) return convert(Math.floor(n / 1000)) + " Thousand " + convert(n % 1000);
      if (n < 10000000) return convert(Math.floor(n / 100000)) + " Lakh " + convert(n % 100000);
      return convert(Math.floor(n / 10000000)) + " Crore " + convert(n % 10000000);
  }

  return amount > 0 ? convert(Math.floor(amount)) + " Rupees Only" : "Zero Rupees";
}


// Main function
module.exports.processInvoice = async (orderDetails,deliverycharge) => {


  try {


    const invoiceHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tax Invoice</title>
    <style>
        body {
            font-family: 'Arial', sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f4;
            color: #333;
        }
        .container {
            width: 90%;
            max-width: 1000px;
            margin: 20px auto;
            background-color: #ffffff;
            padding: 20px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 20px;
        }
        h2 {
            font-size: 22px;
            color: #007bff;
            margin-bottom: 5px;
        }
        .company-info {
            text-align: right;
            font-size: 13px;
            color: #555;
        }
        .invoice-details {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
        }
        .invoice-details div {
            width: 48%;
        }
        .table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 12px;  /* Reduced font size */
            word-wrap: break-word;
        }
        .table th, .table td {
            padding: 8px 10px;  /* Reduced padding */
            border: 1px solid #ddd;
            text-align: center;
            word-wrap: break-word;
        }
        .table th {
            background-color: #f2f2f2;
            font-weight: bold;
        }
        .table td {
            background-color: #fff;
        }
        .table tr:nth-child(even) td {
            background-color: #f9f9f9;
        }
        .table td {
            max-width: 100px;  /* Reduced max width */
            text-overflow: ellipsis;
            overflow: hidden;
        }
        .total-section {
            text-align: right;
            margin-top: 15px;
            font-size: 14px;
        }
        .terms {
            margin-top: 25px;
            font-size: 13px;
            color: #555;
        }
        .terms h4 {
            margin-top: 0;
            color: #007bff;
        }
        .terms p {
            margin: 5px 0;
        }
        .note {
            margin-top: 10px;
            font-size: 13px;
            color: #555;
        }
        @media (max-width: 768px) {
            .invoice-details {
                flex-direction: column;
                align-items: flex-start;
            }
            .invoice-details div {
                width: 100%;
                margin-bottom: 15px;
            }
            .table th, .table td {
                padding: 6px 8px;  /* Even smaller padding for mobile */
            }
            .total-section {
                font-size: 12px;
            }
            .table td {
                max-width: none;
            }
        }

        /* Ensuring page break for tables */
        @media print {
            table {
                page-break-inside: auto;
            }
            tr {
                page-break-inside: avoid;
                page-break-after: auto;
            }
        }
    </style>
</head>
<body>

    <div class="container">
        <div class="header">
            <h2>TAX INVOICE</h2>
        </div>

        <img src="https://deeprintz.blr1.digitaloceanspaces.com/assets/logo.png" alt="deeprintz-logo" />

        <div class="company-info">
            <strong>DEEPPRINTZ INDIA PRIVATE LIMITED</strong><br>
            Company ID: U1410ITN2024PTC167380<br>
            12/51, First Street, VOC Nagar, Kumar Nagar, Tirupur, Tamil Nadu, India - 641603<br>
            GSTIN: 33AAKCD6287D1ZLc<br>
            <a href="mailto:care@deepprintz.com">care@deepprintz.com</a><br>
        </div>

        <div class="invoice-details">
            <div>
                <p><strong>Invoice Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Due Date:</strong> ${new Date().toLocaleDateString()}</p>
                <p><strong>Terms:</strong> Due on Receipt</p>
            </div>
            <div>
                <p><strong>Place of Supply:</strong> ${orderDetails?.customerDetails?.address}</p>
            </div>
        </div>

        <div>
            <table class="table">
                <tr>
                    <th colspan="2">Bill To</th>
                    <th colspan="2">Ship To</th>
                </tr>
                <tr>
                    <td colspan="2">
                        <strong>Ajna Clothings</strong><br>
                        22BA, Eswaramoorthy Gounder Layout,<br>
                        Samundipuram East, Gandhi nagar (PO),<br>
                        Tirupur- 641603, Tamil Nadu, India<br>
                        GSTIN: 33ANPPC5503L1Z1
                    </td>
                    <td colspan="2">
                        ${orderDetails?.customerDetails?.name}<br>
                        ${orderDetails?.customerDetails?.email}<br>
                        ${orderDetails?.customerDetails?.number}<br>
                        ${orderDetails?.customerDetails?.address}
                    </td>
                </tr>
            </table>
        </div>

        <table class="table">
            <tr>
                <th>#</th>
                <th>Item & Description</th>
                <th>HSN/SAC</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>CGST (2.5%)</th>
                <th>SGST (2.5%)</th>
                <th>Handling & Printing</th>
                <th>Amount</th>
            </tr>
            ${orderDetails?.products?.map(
      (item, index) => `
                    <tr>
                        <td>${index + 1}</td>
                        <td>${item.sku}</td>
                        <td>611300</td>
                        <td>${item.quantity}</td>
                        <td>${item.productPrice}</td>
                        <td>${item.cgst}</td>
                        <td>${item.sgst}</td>
                        <td>${item.handling}</td>
                        <td>${item.total}</td>
                    </tr>
            `
        ).join("")}
        </table>

        <div class="total-section">
            <h3><strong>Shipping Charge:</strong> ₹${deliverycharge}</h3>
            <h3><strong>Grand Total:</strong> ₹${orderDetails?.total}</h3>
            <p><strong>Total in Words:</strong> ${convertNumberToWords(orderDetails?.total)}</p>
        </div>

        <div class="terms">
            <h4>Notes</h4>
            <p>Type: Current Account</p>
            <p><strong>Account Name:</strong> DEEPPRINTZ INDIA PVT LTD</p>
            <p><strong>A/C No:</strong> 615405070224</p>
            <p><strong>IFSC Code:</strong> ICIC0006154</p>
            <p>Thanks for doing business with us.</p>

            <h4>Terms & Conditions</h4>
            <p>If there is any issue with the goods, it should be claimed within 7 days of the invoice date.</p>
            <p>No returns accepted.</p>
            <p>For any queries, mail us at <a href="mailto:care@deepprintz.com">care@deepprintz.com</a></p>
        </div>

        <div class="note">
            <p><strong>Important:</strong> This is a computer-generated document and does not require a signature.</p>
        </div>

    </div>

</body>
</html>

`;
 
    // Generate PDF
    const pdfBuffer = await generatePDF(invoiceHTML);

    // Upload to Spaces
    const fileName = `invoice-${Date.now()}.pdf`;
    const pdfUrl = await uploadToSpaces(pdfBuffer, fileName);

    console.log('Invoice URL:', pdfUrl);
    return pdfUrl;
  } catch (error) {
    console.error('Error processing invoice:', error);
    throw error;
  }
}
