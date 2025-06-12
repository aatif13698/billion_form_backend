


const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();

const rolesAndPermissionController = require("../controller/rolesAndPermission.controller");
const { superAdminAuth } = require("../../middleware/authorization/superAdmin");

const entityAuth = require("../../middleware/authorization/entityAuth")


router.get('/list/roles', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "view"), rolesAndPermissionController.listRoles);

router.get('/get/actioveRoles', superAdminAuth, rolesAndPermissionController.getActiveRoles);

router.post('/create/role', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "create"), rolesAndPermissionController.createRole);

router.post('/update/role', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "update"), rolesAndPermissionController.updateRole);

router.get('/permission/:roleId', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "view"), rolesAndPermissionController.getParticularRoleAndPermission);

router.post('/update/permissions', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "update"), rolesAndPermissionController.updatePermission);

router.post('/activeinactive/role', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "update"), rolesAndPermissionController.activeInactiveRole);

router.delete('/softdelete/role', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "softDelete"), rolesAndPermissionController.softDeleteRole);

router.post('/restore/role', entityAuth?.authorizeEntity("Administration", "Roles & Permissions", "update"), rolesAndPermissionController.restoreRole);


 
exports.router = router;
