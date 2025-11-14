const nodemailer = require("nodemailer");

module.exports =  nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    service: 'Gmail',

    auth: {
        user: 'kavinkrishna.rajen.official@gmail.com',
        pass: 'mwwufbgncuegxnem',
    }

});


