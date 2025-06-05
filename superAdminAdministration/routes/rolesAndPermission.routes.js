


const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();

const rolesAndPermissionController = require("../controller/rolesAndPermission.controller");
const { superAdminAuth } = require("../../middleware/authorization/superAdmin");


router.get('/list/roles', superAdminAuth, rolesAndPermissionController.listRoles);


 
exports.router = router;
