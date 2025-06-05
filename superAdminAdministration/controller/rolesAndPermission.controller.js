

const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");

const Roles = require("../../model/roles.model")

exports.listRoles = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10 } = req.query;
    const limit = parseInt(perPage, 10);
    const skip = (parseInt(page, 10) - 1) * limit;

    let filters = {
      id: { $nin: [1, 2] }, // Use $nin for excluding multiple numeric values
      isActive: 1, // Only include active roles
      ...(keyword && {
        name: { $regex: keyword.trim(), $options: "i" }, // Search by name field
      }),
    };

    const [roles, total] = await Promise.all([
      Roles.find(filters)
        .skip(skip)
        .limit(limit)
        .sort({ _id: -1 })
        .select('id name isActive')
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