var nodemailer = require('nodemailer');

var Config = require('../config');
console.log(Config.EMAIL_CONFIG);
var transporter = nodemailer.createTransport(Config.EMAIL_CONFIG);


exports.sendEmail = function(title,content){
	var mailOptions = {
					from: 'therocketminer@gmail.com',
					to: 'cedric@therocketminer.com',
					subject: title,
					text: content
				};


				transporter.sendMail(mailOptions, function (error, info) {
					if (error) {
						console.log(error);
					} else {
						console.log('Email sent: ' + info.response);
					}
				});
}

