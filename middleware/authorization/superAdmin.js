// middleware/authorization/superAdmin.js
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv"); // Fixed typo: "dotnev" -> "dotenv"
dotenv.config();

const userModel = require("../../model/user.model");
const PRIVATEKEY = process.env.PRIVATEKEY; // Ensure this matches the key used to sign the token
const statusCode = require('../../utils/https-status-code');
const message = require("../../utils/message");

// Super Admin Authentication Middleware
exports.superAdminAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  console.log("Authorization Header:", authorization);

  // Check if Authorization header exists and starts with "Bearer"
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "No token provided",
    });
  }

  // Extract token
  const token = authorization.split(" ")[1];
  if (!token || token === "undefined") {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "Token is missing or invalid",
    });
  }

  try {
    // Verify token with PRIVATEKEY
    const decoded = jwt.verify(token, PRIVATEKEY);
    // console.log("Decoded Token:", decoded);

    const { userId } = decoded;
    if (!userId) {
      return res.status(statusCode.Unauthorized).json({
        message: message.lblUnauthorizeUser || "Invalid token payload",
      });
    }

    // Fetch user from database
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(statusCode.NotFound).json({
        message: message.lblUserNotFound || "User not found",
      });
    }

    // Check if user is a super admin (roleId <= 1)
    if (user.roleId > 1) {
      return res.status(statusCode.Forbidden).json({
        message: message.lblUnauthorizeUser || "Access denied: Super Admin privileges required",
      });
    }

    // Attach user to request and proceed
    req.user = user;
    next();
  } catch (error) {
    console.error("Token Verification Error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Invalid token signature",
        details: error.message,
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Token has expired",
        details: error.message,
      });
    }
    return res.status(statusCode.InternalServerError).json({
      message: "Authentication error",
      details: error.message,
    });
  }
};



// super admin and clinet authentication middleware
exports.superAdminAndClientAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  console.log("Authorization Header:", authorization);

  // Check if Authorization header exists and starts with "Bearer"
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "No token provided",
    });
  }

  // Extract token
  const token = authorization.split(" ")[1];
  if (!token || token === "undefined") {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "Token is missing or invalid",
    });
  }

  try {
    // Verify token with PRIVATEKEY
    const decoded = jwt.verify(token, PRIVATEKEY);
    // console.log("Decoded Token:", decoded);

    const { userId } = decoded;
    if (!userId) {
      return res.status(statusCode.Unauthorized).json({
        message: message.lblUnauthorizeUser || "Invalid token payload",
      });
    }

    // Fetch user from database
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(statusCode.NotFound).json({
        message: message.lblUserNotFound || "User not found",
      });
    }

    // Check if user is a super admin (roleId <= 1)
    if (user.roleId > 3) {
      return res.status(statusCode.Forbidden).json({
        message: message.lblUnauthorizeUser || "Access denied",
      });
    }

    // Attach user to request and proceed
    req.user = user;
    next();
  } catch (error) {
    console.error("Token Verification Error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Invalid token signature",
        details: error.message,
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Token has expired",
        details: error.message,
      });
    }
    return res.status(statusCode.InternalServerError).json({
      message: "Authentication error",
      details: error.message,
    });
  }
};


// common authentication middleware
exports.commonAuth = async (req, res, next) => {
  const { authorization } = req.headers;

  console.log("Authorization Header:", authorization);

  // Check if Authorization header exists and starts with "Bearer"
  if (!authorization || !authorization.startsWith("Bearer ")) {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "No token provided",
    });
  }

  // Extract token
  const token = authorization.split(" ")[1];
  if (!token || token === "undefined") {
    return res.status(statusCode.Unauthorized).json({
      message: message.lblNoToken || "Token is missing or invalid",
    });
  }

  try {
    // Verify token with PRIVATEKEY
    const decoded = jwt.verify(token, PRIVATEKEY);
    // console.log("Decoded Token:", decoded);

    const { userId } = decoded;
    if (!userId) {
      return res.status(statusCode.Unauthorized).json({
        message: message.lblUnauthorizeUser || "Invalid token payload",
      });
    }

    // Fetch user from database
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(statusCode.NotFound).json({
        message: message.lblUserNotFound || "User not found",
      });
    }

    // if (user.roleId > 3) {
    //   return res.status(statusCode.Forbidden).json({
    //     message: message.lblUnauthorizeUser || "Access denied",
    //   });
    // }

    // Attach user to request and proceed
    req.user = user;
    next();
  } catch (error) {
    console.error("Token Verification Error:", error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Invalid token signature",
        details: error.message,
      });
    } else if (error.name === "TokenExpiredError") {
      return res.status(statusCode.Unauthorized).json({
        message: "Token has expired",
        details: error.message,
      });
    }
    return res.status(statusCode.InternalServerError).json({
      message: "Authentication error",
      details: error.message,
    });
  }
};