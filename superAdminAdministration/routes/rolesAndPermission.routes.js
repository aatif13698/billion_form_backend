


const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();

const rolesAndPermissionController = require("../controller/rolesAndPermission.controller")


router.post('/list/roles', rolesAndPermissionController.listRoles);




 
exports.router = router;
