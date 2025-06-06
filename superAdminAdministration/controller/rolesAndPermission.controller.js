

const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");

const Roles = require("../../model/roles.model");
const { defaultSuperAdminStaffPersmissionsList } = require("../../utils/constants");

exports.listRoles = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10 } = req.query;
    const limit = parseInt(perPage, 10);
    const skip = (parseInt(page, 10) - 1) * limit;

    let filters = {
      id: { $nin: [1, 2] },
      ...(keyword && {
        name: { $regex: keyword.trim(), $options: "i" }, 
      }),
    };

    const [roles, total] = await Promise.all([
      Roles.find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ _id: -1 })
        .select('id name isActive deletedAt _id')
        .lean(),
      Roles.countDocuments(filters),
    ]);

    return res.status(200).json({
      success: true,
      message: 'Roles retrieved successfully', // Replace with message.lblRoleFoundSuccess if defined
      data: {
        data: roles,
        total: total,
      },
    });
  } catch (error) {
    console.error("Error retrieving roles:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



exports.createRole = async (req, res) => {

  try {
    const superAdmin = req.user;
    const { name } = req.body;
    if (!name) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRequiredFieldMissing,
      });
    }
    const role = await Roles.findOne({ name: name });
    if (role) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblBusinessUnitRoleAlreadyExists,
      });
    }
    const allRole = await Roles.find();
    let maxRoleId = 0;
    for (let index = 0; index < allRole.length; index++) {
      const element = allRole[index];
      if (element.id > maxRoleId) {
        maxRoleId = element.id
      }
    }
    const newRole = await Roles.create(
      [
        {
          name, createdBy: superAdmin?._id, id: maxRoleId + 1, capability: defaultSuperAdminStaffPersmissionsList
        },
      ],
    );
    return res.status(httpsStatusCode.OK).send({
      message: message.lblRoleCreatedSuccess,
      data: { roleId: newRole[0]._id, roleName: newRole[0].name, capability: newRole[0].capability },
    });
  } catch (error) {
    return res.status(httpsStatusCode.InternalServerError).send({
      message: message.lblInternalServerError,
      error: error.message,
    });
  }
};


exports.updateRole = async (req, res) => {
  try {
    const { name, roleId } = req.body;
    if (!name) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRequiredFieldMissing,
      });
    }
    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(statusCode.NotFound).send({
        message: message.lblRoleNotFound,
      });
    }
    const existingRole = await Roles.findOne({
      $and: [
        { _id: { $ne: roleId } },
        {
          $or: [
            { name: name },
          ],
        },
      ],
    });
    if (existingRole) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRoleAlreadyExists,
      });
    }
    role.name = name;
    await role.save();
    return res.status(httpsStatusCode.OK).send({
      message: message.lblRoleUpdatedSuccess,
      data: { roleId: role._id, name: role.name },
    });
  } catch (error) {
    return res.status(httpsStatusCode.InternalServerError).send({
      message: message.lblInternalServerError,
      error: error.message,
    });
  }
};


exports.getParticularRoleAndPermission = async (req, res) => {
    try {
        const { roleId } = req.params; 
        if (!roleId) {
            return res.status(400).send({
                message: message.lblRoleIdIsRequired,
            });
        }
        const role = await Roles.findById(roleId);
        if (!role) {
            return res.status(404).send({
                message: message.lblRoleNotFound
            });
        }
        return res.status(200).send({
            message: message.lblRoleFoundSuccess,
            data: role,
        });
    } catch (error) {
        return res.status(500).send({
            message: message.lblInternalServerError,
            error: error.message,
        });
    }
};


exports.updatePermission = async (req, res) => {
    try {
        const { roleId, name, capability, } = req.body;
        if (!roleId ) {
            return res.status(httpsStatusCode.BadRequest).send({
                message: message.lblRoleIdIsRequired,
            });
        }
        const role = await Roles.findById(roleId);
        if (!role) {
            return res.status(httpsStatusCode.NotFound).send({
                message: message.lblRoleNotFound,
            });
        }
        const existingRole = await Roles.findOne({
            $and: [
                { _id: { $ne: roleId } },
                {
                    $or: [
                        { name: name },
                    ],
                },
            ],
        });
        if (existingRole) {
            return res.status(httpsStatusCode.BadRequest).send({
                message: message.lblRoleAlreadyExists,
            });
        }
        if (name) {
            role.name = name;
        }
        if (capability) {
            role.capability = capability;
        }
        await role.save();
        return res.status(httpsStatusCode.OK).send({
            message: message.lblPermissionAssignedSuccess,
            data: { roleId: role._id, name: role.name },
        });
    } catch (error) {
        return res.status(httpsStatusCode.InternalServerError).send({
            message: message.lblInternalServerError,
            error: error.message,
        });
    }
};


exports.activeInactiveRole = async (req, res, next) => {
  try {
    const { status, roleId, keyword, page, perPage } = req.body;

    console.log("req.body",req.body);
    
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!roleId) {
      return res.status(400).send({
        message: message.lblRoleIdIsRequired,
      });
    }
    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRoleNotFound,
      });
    }
    Object.assign(role, {
      isActive: status === "1" ? 1 : 0,
    });
    await role.save();
    this.listRoles(req, res)
  } catch (error) {
    console.error("roles active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



exports.softDeleteRole = async (req, res, next) => {
  try {
    const { roleId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!roleId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRoleIdIsRequired,
      });
    }
    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblRoleNotFound,
      });
    }
    Object.assign(role, {
      deletedAt: new Date(),
    });
    await role.save();
    this.listRoles(req, res)
  } catch (error) {
    console.error("Role soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


exports.restoreRole = async (req, res, next) => {
  try {
    const { roleId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!roleId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblRoleIdIsRequired,
      });
    }
    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblRoleNotFound,
      });
    }
    Object.assign(role, {
      deletedAt: null,
    });
    await role.save();
    this.listRoles(req, res)
  } catch (error) {
    console.error("Role restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};