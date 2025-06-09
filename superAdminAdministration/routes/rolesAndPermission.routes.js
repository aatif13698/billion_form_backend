


const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();

const rolesAndPermissionController = require("../controller/rolesAndPermission.controller");
const { superAdminAuth } = require("../../middleware/authorization/superAdmin");


router.get('/list/roles', superAdminAuth, rolesAndPermissionController.listRoles);

router.get('/get/actioveRoles', superAdminAuth, rolesAndPermissionController.getActiveRoles);

router.post('/create/role', superAdminAuth, rolesAndPermissionController.createRole);

router.post('/update/role', superAdminAuth, rolesAndPermissionController.updateRole);

router.get('/permission/:roleId', superAdminAuth, rolesAndPermissionController.getParticularRoleAndPermission);

router.post('/update/permissions', superAdminAuth, rolesAndPermissionController.updatePermission);

router.post('/activeinactive/role', superAdminAuth, rolesAndPermissionController.activeInactiveRole);

router.delete('/softdelete/role', superAdminAuth, rolesAndPermissionController.softDeleteRole);

router.post('/restore/role', superAdminAuth, rolesAndPermissionController.restoreRole);


 
exports.router = router;
