const dotenv = require("dotenv")
dotenv.config()
const nodemailer = require("nodemailer")

let transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE,
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_POSRT,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER, // Admin Gmail ID
    pass: process.env.EMAIL_PASS // Admin Gmail Password
  },
})



module.exports = transporter