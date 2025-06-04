
const User = require("../../model/user.model");
const jwt = require("jsonwebtoken");
const CustomError = require("../../utils/customError");
const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");
require('dotenv').config(); // Load environment variables first



const config = {
  jwtSecret: process.env.PRIVATEKEY || "your-secure-secret-key",
  jwtExpiresShort: "1d", // 1 day expiration
  jwtExpiresLong: "7d", // 7 days expiration
};

exports.login = async (req, res, next) => {
  try {
    const { identifier, password, rememberMe = false } = req.body;

    const identifierType = req.identifierType;
    const query = identifierType === "email"
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };

    const user = await User.findOne(query)
      .populate("role")
      .select("+password");


    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        errorCode: "AUTH_FAILED",
      });
    }

    // if (user.roleId !== 1 || user.role.name !== "super admin") {
    //   return res.status(403).json({
    //     success: false,
    //     message: "Access denied: Super admin privileges required",
    //     errorCode: "UNAUTHORIZED",
    //   });
    // }

    if (!user.isActive) {
      return res.status(httpsStatusCode.Forbidden).json({
        success: false,
        message: message.lblAccountDeactivate,
        errorCode: "ACCOUNT_INACTIVE",
      });

    }

    const isPasswordValid = await user.isPasswordCorrect(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        errorCode: "AUTH_FAILED",
      });
    }

    const tokenExpiration = rememberMe
      ? config.jwtExpiresLong
      : config.jwtExpiresShort;

    const tokenPayload = {
      userId: user._id,
      email: user.email,
      roleId: user.roleId,
      roleName: user.role.name,
      isSuperAdmin: true,
    };

    const token = jwt.sign(tokenPayload, config.jwtSecret, {
      expiresIn: tokenExpiration,
    });

    const responseData = {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: {
          id: user.roleId,
          name: user.role.name,
        },
        companyId: user.companyId
      },
      token: {
        accessToken: token,
        expiresIn: tokenExpiration,
      },
      capability : user.role.capability
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: responseData,
    });
  } catch (error) {
    console.error("Super Admin Login Error:", error);

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};
