const express = require("express");
const httpsStatusCode = require("../utils/https-status-code");
const message = require("../utils/message");
const userModel = require("../model/user.model");
let router = express.Router();

router.get('/welcome', async (req,res) => {

    const users = await userModel.find({});
    return   res.send({
        message: "Welcome to Billionforms",
        data : users
    })
});


router.get('/getCompanyName', async (req, res, next) => {

    try {

        const company = req.company;

        console.log("company",company);

        return res.status(httpsStatusCode.OK).send({
            message : "OK",
            data : {
                name : company?.name,
            }
        })
        
    } catch (error) {
        
    }

})

exports.router = router;


