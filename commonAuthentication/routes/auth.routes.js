

const express = require("express");
require('dotenv').config(); // Load environment variables first


const router = express.Router();

const superAdminController = require("../controller/auth.controller");
const { validateLoginInput, startCompanyServer, validateClientInput, getSerialNumber, restrictOtherCompany } = require("../../utils/commonFunction");

const { superAdminAuth, superAdminAndClientAuth } = require("../../middleware/authorization/superAdmin");
const customFieldModel = require("../../model/customField.model");
const companyModel = require("../../model/company.model");
const userModel = require("../../model/user.model");
const CustomError = require("../../utils/customError");
const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");

const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;





// common Login API
router
  .route("/login")
  .post(validateLoginInput, restrictOtherCompany, superAdminController.login);

router.get("/get/profile/:id", superAdminAndClientAuth, superAdminController.getProfile);

router.put("/update/profile", superAdminAndClientAuth, superAdminController.updateProfile);




exports.router = router;
