// const express = require("express");
// let router = express.Router();

// router.get('/login', async (req,res) => {
//     return   res.send({
//         message: "route for admins"
//     })
// });

const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../../model/user.model"); // Your user model
const Role = require("../../model/roles.model"); // Your role model
const router = express.Router();

// Configuration (should be in a separate config file in production)
const config = {
  jwtSecret: process.env.JWT_SECRET || "your-secure-secret-key",
  jwtExpiresShort: "1d", // 1 day expiration
  jwtExpiresLong: "7d", // 7 days expiration
};

// Middleware to validate request body
const validateLoginInput = (req, res, next) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Basic email format validation
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
      errorCode: "INVALID_EMAIL",
    });
  }

  // Validate rememberMe if provided
  if (rememberMe !== undefined && typeof rememberMe !== "boolean") {
    return res.status(400).json({
      success: false,
      message: "rememberMe must be a boolean value",
      errorCode: "VALIDATION_ERROR",
    });
  }

  next();
};

// Super Admin Login API
router
  .route("/login")
  .post(validateLoginInput, async (req, res) => {
    try {
      const { email, password, rememberMe = false } = req.body;

      // Find user with email and populate role
      const user = await User.findOne({ email: email.toLowerCase() })
        .populate("role")
        .select("+password");

      // Check if user exists
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
          errorCode: "AUTH_FAILED",
        });
      }

      // Verify super admin role (roleId: 1 as per your base roles)
      if (user.roleId !== 1 || user.role.name !== "super admin") {
        return res.status(403).json({
          success: false,
          message: "Access denied: Super admin privileges required",
          errorCode: "UNAUTHORIZED",
        });
      }

      // Check if user is active
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: "Account is deactivated",
          errorCode: "ACCOUNT_INACTIVE",
        });
      }

      // Verify password
      const isPasswordValid = await user.isPasswordCorrect(password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials",
          errorCode: "AUTH_FAILED",
        });
      }

      // Determine token expiration based on rememberMe
      const tokenExpiration = rememberMe
        ? config.jwtExpiresLong
        : config.jwtExpiresShort;

      // Generate JWT token
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

      // Prepare response data
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
        },
        token: {
          accessToken: token,
          expiresIn: tokenExpiration,
        },
      };

      // Send success response
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
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
    }
  });

exports.router = router;




// --------- Organization routes starts here -------------------


// router.post("/create/organization", superAdminAuth, superAdminController.createSubscsribed);

// router.get('/get/organization/list', superAdminAuth, superAdminController.getListSubscsribed);

// router.post("/activeInactive/organization", superAdminAuth, superAdminController.activeInactiveTopup);

// router.get('/get/organization/:id', superAdminAuth, superAdminController.getParticularSubscsribedUser);


// --------- Organization routes starts here -------------------
