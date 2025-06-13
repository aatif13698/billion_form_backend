
const User = require("../../model/user.model");
const Role = require("../../model/roles.model");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const CustomError = require("../../utils/customError");
const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");
require('dotenv').config(); // Load environment variables first

const Roles = require("../../model/roles.model");
const { getSerialNumber } = require("../../utils/commonFunction");
const companyModel = require("../../model/company.model");
const userModel = require("../../model/user.model");
const subscriptionPlanModel = require("../../model/subscriptionPlan.model");
const topupModel = require("../../model/topup.model");

const commonFunction = require("../../utils/commonFunction");
const subscribedUserModel = require("../../model/subscribedUser.model");
const organizationModel = require("../../model/organization.model");
const multer = require("multer");
const sessionModel = require("../../model/session.model");
const customFormModel = require("../../model/customForm.model");
const { default: mongoose } = require("mongoose");
const formDataModel = require("../../model/formData.model");
const accessModel = require("../../model/access.model");
const AWS = require('aws-sdk');

const archiver = require('archiver');
const { v4: uuidv4 } = require('uuid');
const DownloadJob = require("../../model/downloadJob.model");
const { PassThrough, pipeline, Transform } = require('stream');
const BulkJob = require("../../model/bulkJob.model");
const { mailSender } = require("../../email/emailSend");
const { log } = require("console");




// DigitalOcean Spaces setup
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
  s3ForcePathStyle: true,
  maxRetries: 5,
  retryDelayOptions: { base: 500 },
  httpOptions: { timeout: 60000 },
});


// code to convert private to public
// s3.putObjectAcl({
//   Bucket: 'billionforms-files',
//   Key: '6826d702e17871353e5345eb/68281c03b51fad15219f91e0/1747472015712_heart.png',
//   ACL: 'public-read',
// }).promise().then(() => console.log('Updated ACL to public-read'));


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;



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

    console.log("query", query);



    const user = await User.findOne(query)
      .populate("role")
      .select("+password");

    console.log("user", user);


    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
        errorCode: "AUTH_FAILED",
      });
    }

    if (user.roleId !== 1 || user.role.name !== "super admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied: Super admin privileges required",
        errorCode: "UNAUTHORIZED",
      });
    }

    if (!user.isActive) {
      // return res.status(403).json({
      //   success: false,
      //   message: "Account is deactivated",
      //   errorCode: "ACCOUNT_INACTIVE",
      // });

      throw CustomError(httpsStatusCode.Forbidden, message.lblAccountDeactivate)
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
      },
      token: {
        accessToken: token,
        expiresIn: tokenExpiration,
      },
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


// ------------- client controller starts here --------------


exports.createClient = async (req, res, next) => {
  try {

    const { firstName, lastName, email, phone, password } = req.body;
    // Check if user already exists (using $or for email OR phone)
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    })
      .populate("role")
      .select("+password");

    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblClientAlreadyExists || "Client already exists",
        errorCode: "CLIENT_EXISTS",
      });
    }

    // Hash the password
    const saltRounds = 10; // Configurable via environment variable if needed
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const role = await Roles.findOne({ id: 2 });

    const serial = await getSerialNumber("client");

    // Create new user
    const newUser = new User({
      serialNumber: serial,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      tc: true,
      roleId: 2,
      role: role?._id,
      createdBy: req.user?._id,
      isCreatedBySuperAdmin: true,
      isUserVerified: true
    });

    const savedUser = await newUser.save();

    // Remove sensitive data from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.verificationOtp;
    delete userResponse.OTP;

    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblClientCreatedSuccess,
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Client creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// update client
exports.updateClient = async (req, res, next) => {
  try {
    const { clientId, firstName, lastName, email, phone, password } = req.body;
    // Check if user already exists (using $or for email OR phone)
    const existingUser = await User.findOne({
      _id: { $ne: clientId },
      $or: [{ email: email.toLowerCase() }, { phone }],
    }).populate("role").select("+password");
    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblClientAlreadyExists || "Client already exists",
        errorCode: "CLIENT_EXISTS",
      });
    }
    const currentUser = await User.findById(clientId)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      currentUser.password = hashedPassword;
    }
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.email = email;
    currentUser.phone = phone;
    await currentUser.save()
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientUpdatedSuccess,
      data: {
        user: currentUser,
      },
    });
  } catch (error) {
    console.error("Client update error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get client
exports.getClients = async (req, res, next) => {
  try {

    let filters = {
      // deletedAt: null,
      companyId: null,
      roleId: 2,
    };
    const [clients] = await Promise.all([
      User.find(filters)
    ]);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientFoundSuccessfully,
      data: {
        user: clients,
      },
    });
  } catch (error) {
    console.error("Client getting error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// get all clients
exports.getAllClients = async (req, res, next) => {
  try {
    let filters = {
      deletedAt: null,
      isActive: true,
      roleId: 2,
    };
    const [clients] = await Promise.all([
      User.find(filters).select('firstName lastName serialNumber email phone _id')
    ]);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientFoundSuccessfully,
      data: {
        user: clients,
      },
    });
  } catch (error) {
    console.error("Client getting error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getClientsList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, } = req.query;
    const limit = perPage
    const skip = (page - 1) * limit;

    let filters = {
      // deletedAt: null,
      roleId: 2,
      ...(keyword && {
        $or: [
          { firstName: { $regex: keyword.trim(), $options: "i" } },
          { lastName: { $regex: keyword.trim(), $options: "i" } },
          { email: { $regex: keyword.trim(), $options: "i" } },
          { phone: { $regex: keyword.trim(), $options: "i" } },
          { serialNumber: { $regex: keyword.trim(), $options: "i" } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: keyword.trim(),
                options: "i",
              },
            },
          },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      User.find(filters).skip(skip).limit(limit).sort({ _id: -1 })
        .populate({
          path: 'companyId',
          select: 'name',
        })
        .select('serialNumber firstName  isActive lastName deletedAt email phone companyId _id')
        .lean(),
      User.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientFoundSuccessfully,
      data: {
        data: clients,
        total: total
      },
    });
  } catch (error) {
    console.error("Client creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getIndividualClient = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [user] = await Promise.all([
      userModel.findById(id).lean()
    ]);
    if (!user) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblClientNotFound,
      });

    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientFoundSuccessfully,
      data: {
        data: user,
      },
    });
  } catch (error) {
    console.error("company fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.softDeleteClient = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblClientNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: new Date(),
    });
    await client.save();
    this.getClientsList(req, res)
  } catch (error) {
    console.error("Client soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.restoreClient = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblClientNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: null,
    });
    await client.save();
    this.getClientsList(req, res)
  } catch (error) {
    console.error("Client restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.activeInactiveClient = async (req, res, next) => {
  try {
    const { status, clientId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!clientId) {
      return res.status(400).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientNotFound,
      });
    }
    Object.assign(client, {
      isActive: status === "1",
    });
    await client.save();
    this.getClientsList(req, res)
  } catch (error) {
    console.error("Client active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ------------- client controller ends here --------------


// ------------- super admin staff controller starts here ----------

// create staff
exports.createStaff = async (req, res, next) => {
  try {
    const company = req.company;
    if (!company) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblCompanyNotFound || "Company not found",
        errorCode: "COMPANY_NOT_FOUND",
      });
    }
    const access = await accessModel.findOne({ companyId: company._id });
    if (!access) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: "Access not found",
        errorCode: "ACCESS_NOT_FOUND",
      });
    }
    const { firstName, lastName, email, phone, password, roleId } = req.body;


    // Check if user already exists (using $or for email OR phone)
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    })
      .populate("role")
      .select("+password");
    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblStaffAlreadyExists || "Staff already exists",
        errorCode: "STAFF_EXISTS",
      });
    }
    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblRoleNotFound || "Roll Not Found",
        errorCode: "ROLL_NOT_FOUND",
      });
    }
    // Hash the password
    const saltRounds = 10; // Configurable via environment variable if needed
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // const role = await Roles.findOne({ id: 4 });
    const serial = await getSerialNumber("superAdminStaff");
    // Create new user
    const newUser = new User({
      serialNumber: serial,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      tc: true,
      roleId: role.id,
      role: roleId,
      createdBy: req.user?._id,
      isCreatedBySuperAdmin: true,
      isUserVerified: true,
      companyId: company._id
    });
    const savedUser = await newUser.save();
    access.users = [...access.users, savedUser._id];
    await access.save()
    // Remove sensitive data from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.verificationOtp;
    delete userResponse.OTP;


    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: email,
      subject: "Welcome To Billion Forms",
      template: "welcome",
      context: {
        password: password,
        email: email,
        name: firstName,
        emailSignature: process.env.EMAIL_SIGNATURE,
        appName: process.env.APP_NAME
      },
    };

    await mailSender(mailOptions);

    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblStaffCreatedSuccess,
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("Staff creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// update staff 
exports.updateStaff = async (req, res, next) => {
  try {
    const { clientId, firstName, lastName, email, phone, password, roleId } = req.body;
    const existingUser = await User.findOne({
      _id: { $ne: clientId },
      $or: [{ email: email.toLowerCase() }, { phone }],
    }).populate("role").select("+password");
    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblStaffAlreadyExists || "Staff already exists",
        errorCode: "STAFF_EXISTS",
      });
    }
    if (!roleId) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: message.lblRoleIdIsRequired || "Role Id is required",
        errorCode: "ROLE_ID_REQUIRED",
      });
    }

    const role = await Roles.findById(roleId);
    if (!role) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblRoleNotFound || "Roll Not Found",
        errorCode: "ROLL_NOT_FOUND",
      });
    }
    const currentUser = await User.findById(clientId);
    if (!currentUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblStaffNotFound || "Staff Not Found",
        errorCode: "STAFF_NOT_FOUND",
      });
    }
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      currentUser.password = hashedPassword;
    }
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.email = email;
    currentUser.phone = phone;
    currentUser.roleId = role.id;
    currentUser.role = roleId;

    await currentUser.save()
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblStaffUpdatedSuccess,
      data: {
        user: currentUser,
      },
    });
  } catch (error) {
    console.error("Staff update error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// staff list
exports.getStaffList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, companyId } = req.query;

    console.log("req.query", req.query);

    const limit = perPage
    const skip = (page - 1) * limit;

    let filters = {
      roleId: { $nin: [1, 2, 3] },
      companyId: companyId,
      ...(keyword && {
        $or: [
          { firstName: { $regex: keyword.trim(), $options: "i" } },
          { lastName: { $regex: keyword.trim(), $options: "i" } },
          { email: { $regex: keyword.trim(), $options: "i" } },
          { phone: { $regex: keyword.trim(), $options: "i" } },
          { serialNumber: { $regex: keyword.trim(), $options: "i" } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: keyword.trim(),
                options: "i",
              },
            },
          },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      User.find(filters).skip(skip).limit(limit).sort({ _id: -1 })
        .populate({
          path: 'companyId',
          select: 'name',
        })
        .populate({
          path: 'organization',
          select: 'name'
        })
        .populate({
          path: "role",
          select: "name id"
        })
        .select('serialNumber firstName deletedAt isActive lastName email phone role companyId _id')
        .lean(),
      User.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblStaffFoundSuccessfully,
      data: {
        data: clients,
        total: total
      },
    });
  } catch (error) {
    console.error("Staff creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get particular staff
exports.getIndividualStaff = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [user] = await Promise.all([
      userModel.findById(id)
        .populate({
          path: "role",
          select: "name id _id"
        })
        .lean()
    ]);
    if (!user) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblStaffNotFound,
      });
    };

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblStaffFoundSuccessfully,
      data: {
        data: user,
      },
    });
  } catch (error) {
    console.error("Staff fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive staff
exports.activeInactiveStaff = async (req, res, next) => {
  try {
    const { status, clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    if (!clientId) {
      return res.status(400).send({
        message: message.lblStaffIdrequired,
      });
    }
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblStaffNotFound,
      });
    }
    Object.assign(client, {
      isActive: status === "1",
    });
    await client.save();
    this.getStaffList(req, res)
  } catch (error) {
    console.error("Staff active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.softDeleteStaff = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblStaffNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: new Date(),
    });
    await client.save();
    this.getStaffList(req, res)
  } catch (error) {
    console.error("staff soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.restoreStaff = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblStaffIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblStaffNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: null,
    });
    await client.save();
    this.getStaffList(req, res)
  } catch (error) {
    console.error("Staff restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ------------- super admin staff controller ends here ----------



// ------------ user controller starts here ---------------

// create user
exports.createUser = async (req, res, next) => {
  try {
    const company = req.company;
    if (!company) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblCompanyNotFound || "Company not found",
        errorCode: "COMPANY_NOT_FOUND",
      });
    }

    // console.log("company",company);


    const access = await accessModel.findOne({ companyId: company._id });
    if (!access) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: "Access not found",
        errorCode: "ACCESS_NOT_FOUND",
      });
    }
    const { firstName, lastName, email, phone, password } = req.body;
    // Check if user already exists (using $or for email OR phone)
    const existingUser = await User.findOne({
      $or: [{ email: email.toLowerCase() }, { phone }],
    })
      .populate("role")
      .select("+password");

    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblUserAlreadyExists || "User already exists",
        errorCode: "USER_EXISTS",
      });
    }
    // Hash the password
    const saltRounds = 10; // Configurable via environment variable if needed
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    const role = await Roles.findOne({ id: 3 });
    const serial = await getSerialNumber("user");
    // Create new user
    const newUser = new User({
      serialNumber: serial,
      firstName,
      lastName,
      email: email.toLowerCase(),
      phone,
      password: hashedPassword,
      tc: true,
      roleId: 3,
      role: role?._id,
      createdBy: req.user?._id,
      isCreatedBySuperAdmin: true,
      isUserVerified: true,
      companyId: company._id
    });
    const savedUser = await newUser.save();
    access.users = [...access.users, savedUser._id];

    await access.save()
    // Remove sensitive data from response
    const userResponse = savedUser.toObject();
    delete userResponse.password;
    delete userResponse.verificationOtp;
    delete userResponse.OTP;
    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblSubscribedUserCreatedSuccess,
      data: {
        user: userResponse,
      },
    });
  } catch (error) {
    console.error("User creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// update user
exports.updateUser = async (req, res, next) => {
  try {
    const { clientId, firstName, lastName, email, phone, password } = req.body;
    const existingUser = await User.findOne({
      _id: { $ne: clientId },
      $or: [{ email: email.toLowerCase() }, { phone }],
    }).populate("role").select("+password");
    if (existingUser) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblUserAlreadyExists || "User already exists",
        errorCode: "USER_EXISTS",
      });
    }
    const currentUser = await User.findById(clientId)
    if (password) {
      const hashedPassword = await bcrypt.hash(password, 10);
      currentUser.password = hashedPassword;
    }
    currentUser.firstName = firstName;
    currentUser.lastName = lastName;
    currentUser.email = email;
    currentUser.phone = phone;
    await currentUser.save()
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblUserUpdatedSuccess,
      data: {
        user: currentUser,
      },
    });
  } catch (error) {
    console.error("User update error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active incactive user
exports.activeInactiveUser = async (req, res, next) => {
  try {
    const { status, clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    if (!clientId) {
      return res.status(400).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await User.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientNotFound,
      });
    }
    Object.assign(client, {
      isActive: status === "1",
    });
    await client.save();
    this.getUserList(req, res)
  } catch (error) {
    console.error("User active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get user list
exports.getUserList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, companyId } = req.query;

    console.log("req.query",req.query);
    
    const limit = perPage
    const skip = (page - 1) * limit;

    let filters = {
      roleId: 3,
      companyId: companyId,
      ...(keyword && {
        $or: [
          { firstName: { $regex: keyword.trim(), $options: "i" } },
          { lastName: { $regex: keyword.trim(), $options: "i" } },
          { email: { $regex: keyword.trim(), $options: "i" } },
          { phone: { $regex: keyword.trim(), $options: "i" } },
          { serialNumber: { $regex: keyword.trim(), $options: "i" } },
          {
            $expr: {
              $regexMatch: {
                input: { $concat: ["$firstName", " ", "$lastName"] },
                regex: keyword.trim(),
                options: "i",
              },
            },
          },
        ],
      }),
    };

    const [clients, total] = await Promise.all([
      User.find(filters).skip(skip).limit(limit).sort({ _id: -1 })
        .populate({
          path: 'companyId',
          select: 'name',
        })
        .populate({
          path: 'organization',
          select: 'name'
        })
        .select('serialNumber firstName  isActive lastName email phone companyId _id deletedAt')
        .lean(),
      User.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblUserFoundSuccessfully,
      data: {
        data: clients,
        total: total
      },
    });
  } catch (error) {
    console.error("User creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get all user
exports.getAllUser = async (req, res, next) => {
  try {
    const { companyId } = req.params;

    let filters = {
      deletedAt: null,
      isActive: true,
      roleId: 3,
      companyId: companyId
    };
    const [users] = await Promise.all([
      User.find(filters).select('firstName lastName serialNumber email phone _id')
    ]);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblUserFoundSuccessfully,
      data: {
        user: users,
      },
    });
  } catch (error) {
    console.error("Users getting error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// assign user
exports.assignUser = async (req, res, next) => {
  try {
    // Extract and validate input
    const { email, organizationId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing email.',
        errorCode: 'INVALID_EMAIL',
      });
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing organization ID.',
        errorCode: 'INVALID_ORGANIZATION_ID',
      });
    }

    // Find user by email
    const existingUser = await User.findOne({ email: email.toLowerCase() })
      .populate('role')
      .select('+password'); // Include password if needed for other logic

    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
        errorCode: 'USER_NOT_FOUND',
      });
    }

    // Find organization by ID
    const existingOrganization = await organizationModel.findById(organizationId);

    if (!existingOrganization) {
      return res.status(404).json({
        success: false,
        message: 'Organization not found.',
        errorCode: 'ORGANIZATION_NOT_FOUND',
      });
    }

    // Check for duplicate assignment
    if (existingOrganization.assignedUser.includes(existingUser._id)) {
      return res.status(409).json({
        success: false,
        message: 'User is already assigned to this organization.',
        errorCode: 'USER_ALREADY_ASSIGNED',
      });
    }

    // Perform updates atomically using a transaction
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        // Update organization
        existingOrganization.assignedUser.push(existingUser._id);
        await existingOrganization.save({ session });

        // Update user
        existingUser.organization.push(existingOrganization._id);
        await existingUser.save({ session });
      });

      // Sanitize response
      const userResponse = existingUser.toObject();
      delete userResponse.password;
      delete userResponse.verificationOtp;
      delete userResponse.OTP;

      // Return success response
      return res.status(200).json({
        success: true,
        message: 'User assigned to organization successfully.',
        data: {
          user: userResponse,
        },
      });
    } catch (error) {
      throw error; // Let the outer catch handle the error
    } finally {
      session.endSession();
    }
  } catch (error) {
    console.error('Error assigning user to organization:', {
      error: error.message,
      stack: error.stack,
      email: req.body.email,
      organizationId: req.body.organizationId,
    });

    return res.status(500).json({
      success: false,
      message: 'Internal server error.',
      errorCode: 'SERVER_ERROR',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

exports.softDeleteUser = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    console.log("companyId",companyId);
    
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblClientIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblStaffNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: new Date(),
    });
    await client.save();
    this.getUserList(req, res)
  } catch (error) {
    console.error("user soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.restoreUser = async (req, res, next) => {
  try {
    const { clientId, keyword, page, perPage, companyId } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    req.query.companyId = companyId;
    console.log("companyId",companyId);
    
    if (!clientId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblStaffIdrequired,
      });
    }
    const client = await userModel.findById(clientId);
    if (!client) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblStaffNotFound,
      });
    }
    Object.assign(client, {
      deletedAt: null,
    });
    await client.save();
    this.getUserList(req, res)
  } catch (error) {
    console.error("user restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// ------------ user controller ends here ---------------



// ------------- company controller starts here --------------

// create company
exports.createCompany = async (req, res, next) => {
  try {
    const { name, subDomain, adminEmail, adminPassword } = req.body;
    const existing = await companyModel.findOne({
      $or: [{ adminEmail: adminEmail.toLowerCase() }, { subDomain: subDomain }],
    });
    if (existing) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }
    const user = await userModel.findOne({ email: adminEmail });

    if (!user) {
      return res.status(httpsStatusCode.NotFound).json({ error: message.lblClientNotFound });
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);
    // In dev, assign next available port
    const port = IS_DEV ? await commonFunction.getNextAvailablePort() : null;
    const serial = await getSerialNumber("company");
    const newCompany = new companyModel({
      serialNumber: serial,
      name: name,
      subDomain: subDomain.toLowerCase(),
      port,
      adminEmail,
      adminPassword: hashedPassword
    });
    const company = await newCompany.save();
    user.companyId = company._id;
    await user.save();
    await accessModel.create({
      companyId: company._id,
      users: [user._id]
    });
    // Email configuration
    const loginUrl = IS_DEV
      ? `http://localhost:${port}/login`
      : `http://${subDomain}.${BASE_DOMAIN}/login`;
    return res.status(httpsStatusCode.Created).json({ message: 'Company created successfully', url: loginUrl });
  } catch (error) {
    return res.status(httpsStatusCode.InternalServerError).json({ error: error.message });
  }
};

// update company
exports.updateCompany = async (req, res, next) => {
  try {
    const { companyId, name, subDomain, adminPassword } = req.body;
    // Validate required fields
    if (!companyId || !name || !subDomain) {
      return res.status(httpsStatusCode.BadRequest).json({ error: 'Missing required fields' });
    }
    // Find the company
    const company = await companyModel.findById(companyId);
    if (!company) {
      return res.status(httpsStatusCode.NotFound).json({ error: 'Company not found' });
    }
    // Check for subdomain conflict (excluding current company)
    const existingSubdomain = await companyModel.findOne({
      _id: { $ne: companyId },
      subDomain: subDomain.toLowerCase(),
    });
    if (existingSubdomain) {
      return res.status(httpsStatusCode.BadRequest).json({ error: 'Subdomain already taken' });
    }
    // Update allowed fields
    if (adminPassword) {
      const hashedPassword = await bcrypt.hash(adminPassword, 10);
      company.adminPassword = hashedPassword;
    }
    company.name = name;
    company.subDomain = subDomain.toLowerCase().trim();
    await company.save();
    // Update login URL for redirection
    const loginUrl = IS_DEV
      ? `http://localhost:${company.port}/login`
      : `http://${company.subDomain}.${BASE_DOMAIN}/login`;

    return res.status(httpsStatusCode.OK).json({
      message: 'Company updated successfully',
      url: loginUrl,
    });

  } catch (error) {
    console.error("Error updating company:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      error: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// get company list
exports.getCompanyList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, } = req.query;
    const limit = perPage
    const skip = (page - 1) * limit;
    let filters = {
      // deletedAt: null,
      adminEmail: { $ne: process.env.SUPER_ADMIN_EMAIL },
      ...(keyword && {
        $or: [
          { name: { $regex: keyword.trim(), $options: "i" } },
          { adminEmail: { $regex: keyword.trim(), $options: "i" } },
          { subDomain: { $regex: keyword.trim(), $options: "i" } },
          { serialNumber: { $regex: keyword.trim(), $options: "i" } },
        ],
      }),
    };
    const [companies, total] = await Promise.all([
      companyModel.find(filters).skip(skip).limit(limit).sort({ _id: -1 }),
      companyModel.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblCompanyFoundSuccessfully,
      data: {
        data: companies,
        total: total
      },
    });
  } catch (error) {
    console.error("company fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get company
exports.getCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [company] = await Promise.all([
      companyModel.findById(id).lean()
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblCompanyFoundSuccessfully,
      data: {
        data: company,
      },
    });
  } catch (error) {
    console.error("company fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive company
exports.activeInactiveCompany = async (req, res, next) => {
  try {
    const { status, companyId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!companyId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblCompanyIdrequired,
      });
    }
    const company = await companyModel.findById(companyId);
    if (!company) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblCompanyNotFound,
      });
    }
    Object.assign(company, {
      isActive: status === "1",
    });
    await company.save();
    this.getCompanyList(req, res)
  } catch (error) {
    console.error("Client active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// soft delete company
exports.softDeleteCompany = async (req, res, next) => {
  try {
    const { companyId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!companyId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblCompanyIdrequired,
      });
    }
    const company = await companyModel.findById(companyId);
    if (!company) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblCompanyNotFound,
      });
    }
    Object.assign(company, {
      deletedAt: new Date(),
    });
    await company.save();
    this.getCompanyList(req, res)
  } catch (error) {
    console.error("Company soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// restore company
exports.restoreCompany = async (req, res, next) => {
  try {
    const { companyId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!companyId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblCompanyIdrequired,
      });
    }
    const company = await companyModel.findById(companyId);
    if (!company) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblCompanyNotFound,
      });
    }
    Object.assign(company, {
      deletedAt: null,
    });
    await company.save();
    this.getCompanyList(req, res)
  } catch (error) {
    console.error("Company restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ------------- company controller ends here --------------






// ---------- subscription controller starts here --------------

// create subscription
exports.createSubscription = async (req, res, next) => {
  try {

    const { name, country, currency, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint, } = req.body;
    if (!name || !country || !currency || !subscriptionCharge || !validityPeriod || !formLimit || !organisationLimit || !userLimint) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const existingPlan = await subscriptionPlanModel.findOne({
      $or: [{ name: name }],
    })
    if (existingPlan) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblSubscriptionPlanAlreadyExists || "Subscription plan already exists",
        errorCode: "SUBSCRIPTION_EXISTS",
      });
    }

    const serial = await getSerialNumber("SubscriptionPlan");
    const newSubscriptionPlan = await subscriptionPlanModel.create({
      serialNumber: serial,
      activatedOn: new Date(),
      name, country, currency, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint,
    })

    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblSubscriptionPlanCreatedSuccess,
      data: {
        subscription: newSubscriptionPlan,
      },
    });
  } catch (error) {
    console.error("Subscription plan creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// update subscription
exports.updateSubscription = async (req, res, next) => {
  try {

    const { subscriptionPlanId, name, country, currency, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint, } = req.body;
    if (!name || !country || !currency || !subscriptionCharge || !validityPeriod || !formLimit || !organisationLimit || !userLimint) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const currentSubscriptionPlan = await subscriptionPlanModel.findById(subscriptionPlanId);
    if (!currentSubscriptionPlan) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSubscriptionPlanNotFound,
        errorCode: "SUBSCRIPTION_NOT_FOUND",
      });
    }
    const existingPlan = await subscriptionPlanModel.findOne({
      name: name,
      _id: { $ne: subscriptionPlanId },
    });
    if (existingPlan) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblSubscriptionPlanAlreadyExists || "Subscription plan already exists",
        errorCode: "SUBSCRIPTION_EXISTS",
      });
    }
    Object.assign(currentSubscriptionPlan, {
      name, country, currency, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint,
    });
    await currentSubscriptionPlan.save()
    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblSubscriptionPlanUpdatedSuccess,
      data: {
        subscription: currentSubscriptionPlan,
      },
    });
  } catch (error) {
    console.error("Subscription plan creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// list subscription plan
exports.getSubscriptionPlanList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, } = req.query;
    const limit = perPage
    const skip = (page - 1) * limit;
    const keywordRegex = { $regex: keyword.trim(), $options: "i" };

    let filters = {
      ...(keyword && {
        $or: [
          { serialNumber: keywordRegex },
          { name: keywordRegex },
          { country: keywordRegex },
          { currency: keywordRegex },
          { validityPeriod: keywordRegex },
          ...(isNaN(Number(keyword)) ? [] : [
            { subscriptionCharge: Number(keyword) },
            { formLimit: Number(keyword) },
            { organisationLimit: Number(keyword) },
            { userLimint: Number(keyword) }, // assuming your schema still uses `userLimint` (typo?)
          ])
        ]
      }),
    };

    const [subscriptionPlans, total] = await Promise.all([
      subscriptionPlanModel.find(filters).skip(skip).limit(limit).sort({ _id: -1 }),
      subscriptionPlanModel.countDocuments(filters),
    ]);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSubscriptionPlanFoundSuccessfully,
      data: {
        data: subscriptionPlans,
        total: total
      },
    });
  } catch (error) {
    console.error("Subscription fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get all subscription
exports.getAllSubscriptionPlan = async (req, res, next) => {
  try {

    let filters = {
      isActive: true,
      deletedAt: null,
    };

    const [subscriptionPlans] = await Promise.all([
      subscriptionPlanModel.find(filters).sort({ _id: 1 }).select('serialNumber name subscriptionCharge _id'),
    ]);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSubscriptionPlanFoundSuccessfully,
      data: {
        data: subscriptionPlans,
      },
    });
  } catch (error) {
    console.error("Subscription fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive subscription plan
exports.activeInactiveSubscription = async (req, res, next) => {
  try {
    const { status, subscriptionPlanId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!subscriptionPlanId) {
      return res.status(400).send({
        message: message.lblSubscriptionPlanIdrequired,
      });
    }
    const subscriptionPlan = await subscriptionPlanModel.findById(subscriptionPlanId);
    if (!subscriptionPlan) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblSubscriptionPlanNotFound,
      });
    }
    Object.assign(subscriptionPlan, {
      isActive: status === "1",
    });
    await subscriptionPlan.save();
    this.getSubscriptionPlanList(req, res)
  } catch (error) {
    console.error("active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get individual subscription plan
exports.getIndividualSubscriptionPlan = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [subscription] = await Promise.all([
      subscriptionPlanModel.findById(id).lean()
    ]);
    if (!subscription) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSubscriptionPlanNotFound,
      });

    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSubscriptionPlanFoundSuccessfully,
      data: {
        data: subscription,
      },
    });
  } catch (error) {
    console.error("subscription plan fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// soft delete subscription plan
exports.softDeleteSubscriptionPlan = async (req, res, next) => {
  try {
    const { subscriptionPlanId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!subscriptionPlanId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblSubscriptionPlanIdrequired,
      });
    }
    const subscription = await subscriptionPlanModel.findById(subscriptionPlanId);
    if (!subscription) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblSubscriptionPlanNotFound,
      });
    }
    Object.assign(subscription, {
      deletedAt: new Date(),
    });
    await subscription.save();
    this.getSubscriptionPlanList(req, res)
  } catch (error) {
    console.error("subscription plan soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// restore subscription plan
exports.restoreSubscriptionPlan = async (req, res, next) => {
  try {
    const { subscriptionPlanId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!subscriptionPlanId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblSubscriptionPlanIdrequired,
      });
    }
    const subscription = await subscriptionPlanModel.findById(subscriptionPlanId);
    if (!subscription) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblSubscriptionPlanNotFound,
      });
    }
    Object.assign(subscription, {
      deletedAt: null,
    });
    await subscription.save();
    this.getSubscriptionPlanList(req, res)
  } catch (error) {
    console.error("subscription plan restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ---------- subscription controller ends here --------------




// ---------- topup controller starts here --------------

exports.createTopup = async (req, res, next) => {
  try {
    const { name, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint, } = req.body;
    if (!name || !subscriptionCharge || !validityPeriod || !formLimit || !organisationLimit || !userLimint) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const existing = await topupModel.findOne({
      $or: [{ name: name }],
    })
    if (existing) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblTopupAlreadyExists || "Topup plan already exists",
        errorCode: "TOPUP_EXISTS",
      });
    }
    const serial = await getSerialNumber("topup");
    const newTopup = await topupModel.create({
      serialNumber: serial,
      activatedOn: new Date(),
      name, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint,
    })

    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblTopupCreatedSuccess,
      data: {
        subscription: newTopup,
      },
    });
  } catch (error) {
    console.error("Topup creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// update topup
exports.updateTopup = async (req, res, next) => {
  try {
    const { topupId, name, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint, } = req.body;
    if (!name || !subscriptionCharge || !validityPeriod || !formLimit || !organisationLimit || !userLimint) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const currentTopup = await topupModel.findById(topupId);
    if (!currentTopup) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblTopupNotFound,
        errorCode: "TOPUP_NOT_FOUND",
      });
    }
    const existin = await topupModel.findOne({
      name: name,
      _id: { $ne: topupId },
    });
    if (existin) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: message.lblTopupAlreadyExists,
        errorCode: "TOPUP_EXISTS",
      });
    }
    Object.assign(currentTopup, {
      name, subscriptionCharge, validityPeriod, formLimit, organisationLimit, userLimint,
    });
    await currentTopup.save()
    // Return success response
    return res.status(httpsStatusCode.Created).json({
      success: true,
      message: message.lblTopupUpdatedSuccess,
      data: {
        subscription: currentTopup,
      },
    });
  } catch (error) {
    console.error("Topup creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// list topup
exports.getTopupList = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, } = req.query;
    const limit = perPage
    const skip = (page - 1) * limit;
    const keywordRegex = { $regex: keyword.trim(), $options: "i" };
    let filters = {
      ...(keyword && {
        $or: [
          { serialNumber: keywordRegex },
          { name: keywordRegex },
          { validityPeriod: keywordRegex },
          ...(isNaN(Number(keyword)) ? [] : [
            { subscriptionCharge: Number(keyword) },
            { formLimit: Number(keyword) },
            { organisationLimit: Number(keyword) },
            { userLimint: Number(keyword) }, // assuming your schema still uses `userLimint` (typo?)
          ])
        ]
      }),
    };
    const [topups, total] = await Promise.all([
      topupModel.find(filters).skip(skip).limit(limit).sort({ _id: -1 }),
      topupModel.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblTopupFoundSuccessfully,
      data: {
        data: topups,
        total: total
      },
    });
  } catch (error) {
    console.error("Topup fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get all topup
exports.getAllTopupPlan = async (req, res, next) => {
  try {
    let filters = {
      isActive: true,
      deletedAt: null,
    };
    const [topupPlans] = await Promise.all([
      topupModel.find(filters).sort({ _id: 1 }).select('serialNumber name subscriptionCharge _id'),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblTopupFoundSuccessfully,
      data: {
        data: topupPlans,
      },
    });
  } catch (error) {
    console.error("Topup fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive topup
exports.activeInactiveTopup = async (req, res, next) => {
  try {
    const { status, topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(400).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupNotFound,
      });
    }
    Object.assign(topup, {
      isActive: status === "1",
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get individual topup
exports.getIndividualTopup = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [topup] = await Promise.all([
      topupModel.findById(id).lean()
    ]);
    if (!topup) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblTopupNotFound,
      });

    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblTopupFoundSuccessfully,
      data: {
        data: topup,
      },
    });
  } catch (error) {
    console.error("topup fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// soft delete topup
exports.softDeleteTopup = async (req, res, next) => {
  try {
    const { topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblTopupNotFound,
      });
    }
    Object.assign(topup, {
      deletedAt: new Date(),
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("topup soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// restore topup
exports.restoretopup = async (req, res, next) => {
  try {
    const { topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblSubscriptionPlanNotFound,
      });
    }
    Object.assign(topup, {
      deletedAt: null,
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("topup restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// ---------- topup controller ends here --------------




// ---------- subscribed controller starts here ----------

// create subscribed
exports.createSubscsribed = async (req, res, next) => {
  try {
    const { userId, subscriptionId } = req.body;
    if (!userId || !subscriptionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const existing = await subscriptionPlanModel.findById(subscriptionId)
    if (!existing) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSubscriptionPlanNotFound,
        errorCode: "SUBSCRIPTION_NOT_FOUND",
      });
    }
    if (!existing.isActive) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: "Subscription plan has been deactivated.",
        errorCode: "SUBSCRIPTION_DEACTIVATED",
      });
    }

    // const existingPlan = await subscribedUserModel.findOne({ userId: userId });
    let subscribedUser = await subscribedUserModel.findOne({ userId });
    if (subscribedUser) {
      subscribedUser.subscription.push({
        subscriptionId,
        startDate: new Date(),
        endDate: commonFunction.calculateEndDate(existing.validityPeriod),
        createdBy: req.user._id,
        status: 'active',
        isPlanExpired: false,
      });

      // Update limits based on the new subscription plan (override with latest plan's limits)
      subscribedUser.totalFormLimit += existing.formLimit;
      subscribedUser.totalOrgLimit += existing.organisationLimit;
      subscribedUser.totalUserLimint += existing.userLimint;

      await subscribedUser.save();
      return res.status(httpsStatusCode.OK).json({
        success: true,
        message: 'Subscription added successfully',
        data: { subscription: subscribedUser },
      });
    }

    const serial = await getSerialNumber('subscribedUser');
    const newSubscription = await subscribedUserModel.create({
      serialNumber: serial,
      userId,
      subscription: [
        {
          subscriptionId,
          startDate: new Date(),
          endDate: commonFunction.calculateEndDate(existing.validityPeriod),
          createdBy: req.user._id,
          status: 'active',
          isPlanExpired: false,
        },
      ],
      totalFormLimit: existing.formLimit,
      totalOrgLimit: existing.organisationLimit,
      totalUserLimint: existing.userLimint,
    });

    // Add user to subscription plan's subscribers
    existing.subscribers.push(userId);
    await existing.save();

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: 'Subscribed successfully',
      data: { subscription: newSubscription },
    });
  } catch (error) {
    console.error("Topup creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// assign topup
exports.createAssignTopup = async (req, res, next) => {
  try {
    const { userId, topupId } = req.body;
    if (!userId || !topupId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const existing = await topupModel.findById(topupId)
    if (!existing) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblTopupNotFound,
        errorCode: "TOPUP_NOT_FOUND",
      });
    }
    if (!existing.isActive) {
      return res.status(httpsStatusCode.Conflict).json({
        success: false,
        message: "Topup plan has been deactivated.",
        errorCode: "TOPUP_DEACTIVATED",
      });
    }

    let subscribedUser = await subscribedUserModel.findOne({ userId });
    if (subscribedUser) {
      subscribedUser.topup.push({
        topupId,
        startDate: new Date(),
        endDate: commonFunction.calculateEndDate(existing.validityPeriod),
        createdBy: req.user._id,
        status: 'active',
        isPlanExpired: false,
      });

      subscribedUser.totalFormLimit += existing.formLimit;
      subscribedUser.totalOrgLimit += existing.organisationLimit;
      subscribedUser.totalUserLimint += existing.userLimint;

      await subscribedUser.save();
      return res.status(httpsStatusCode.OK).json({
        success: true,
        message: 'Topup plan added successfully',
        data: { topup: subscribedUser },
      });
    }

    const serial = await getSerialNumber('subscribedUser');
    const newSubscription = await subscribedUserModel.create({
      serialNumber: serial,
      userId,
      topup: [
        {
          topupId,
          startDate: new Date(),
          endDate: commonFunction.calculateEndDate(existing.validityPeriod),
          createdBy: req.user._id,
          status: 'active',
          isPlanExpired: false,
        },
      ],
      totalFormLimit: existing.formLimit,
      totalOrgLimit: existing.organisationLimit,
      totalUserLimint: existing.userLimint,
    });

    // Add user to subscription plan's subscribers
    existing.subscribers.push(userId);
    await existing.save();
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: 'Topup plan Subscribed successfully',
      data: { topup: newSubscription },
    });
  } catch (error) {
    console.error("Topup creation error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get list subscribed user
exports.getListSubscsribed = async (req, res, next) => {
  try {
    const { keyword = '', page = 1, perPage = 10, } = req.query;
    const limit = perPage
    const skip = (page - 1) * limit;
    const keywordRegex = { $regex: keyword.trim(), $options: "i" };
    let filters = {
      ...(keyword && {
        $or: [
          { serialNumber: keywordRegex },
        ]
      }),
    };
    const [subscribedUsers, total] = await Promise.all([
      subscribedUserModel.find(filters).skip(skip).limit(limit).sort({ _id: -1 }).populate({
        path: "userId",
        select: 'firstName lastName email phone _id'
      }),
      subscribedUserModel.countDocuments(filters),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSubscribedUserFoundSuccessfully,
      data: {
        data: subscribedUsers,
        total: total
      },
    });
  } catch (error) {
    console.error("Topup fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


exports.getParticularSubscsribedUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    let subscribedUser = await subscribedUserModel.findById(id).populate({
      path: 'subscription.subscriptionId',
      select: '-subscribers'
    }).populate({
      path: "userId",
      select: "firstName lastName email phone _id"
    })
      .populate({
        path: 'topup.topupId',
        select: '-subscribers'
      })
    if (!subscribedUser) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: "Subscribed user not found",
        errorCode: "SUBSCRIBED_USER_NOT_FOUND",
      });
    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSubscribedUserFoundSuccessfully,
      data: subscribedUser,
    });
  } catch (error) {
    console.error("fetching error:", error);
    // Generic server error
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};




// ---------- subscribed controller ends here ----------





// ---------- Organization controller starts here ----------

// exports.createOrganization = async (req, res, next) => {
//   try {
//     const user = req.user;
//     const { name, captionText, address, email, phone } = req.body;
//     if (!name || !captionText || !address || !email || !phone ) {
//       return res.status(httpsStatusCode.BadRequest).send({
//         success: false,
//         message: message.lblRequiredFieldMissing,
//         errorCode: "FIELD_MISSIING",
//       });
//     }

//     const existingOrganization = await organizationModel.find({
//       userId : user?._id,
//       name : name
//     });

//     if(existingOrganization){
//       return res.status(httpsStatusCode.Conflict).send({
//         success: false,
//         message: message.lblOrganizationAlreadyExists,
//         errorCode: "ORGANIZATION_ALREADY_EXISTS",
//       })
//     }

//     const serial = await getSerialNumber("organization");

//     await organizationModel.create({
//       serialNumber : serial,
//       name, captionText, address, email, phone
//     });


//     // Return success response
//     return res.status(httpsStatusCode.Created).json({
//       success: true,
//       message: message.lblOrganizationCreatedSuccess,
//       data: {
//         subscription: newTopup,
//       },
//     });
//   } catch (error) {
//     console.error("Organization creation error:", error);
//     // Generic server error
//     return res.status(httpsStatusCode.InternalServerError).json({
//       success: false,
//       message: "Internal server error",
//       errorCode: "SERVER_ERROR",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

// create organization old
// exports.createOrganization = async (req, res) => {
//   try {
//     const user = req.user;
//     const { name, captionText, address, email, phone } = req.body;

//     // Validate required fields
//     if (!name || !captionText || !address || !email || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'All required fields must be provided',
//         errorCode: 'FIELD_MISSING'
//       });
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid email format',
//         errorCode: 'INVALID_EMAIL'
//       });
//     }

//     // Validate phone format (basic validation, adjust as needed)
//     const phoneRegex = /^\+?[\d\s-]{10,}$/;
//     if (!phoneRegex.test(phone)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid phone number format',
//         errorCode: 'INVALID_PHONE'
//       });
//     }

//     // Check for existing organization
//     const existingOrganization = await organizationModel.findOne({
//       userId: user?._id,
//       name,
//       deletedAt: null
//     });

//     if (existingOrganization) {
//       return res.status(409).json({
//         success: false,
//         message: 'Organization with this name already exists',
//         errorCode: 'ORGANIZATION_ALREADY_EXISTS'
//       });
//     }


//     let subscribed;
//     if (user.roleId !== 1) {
//       subscribed = await subscribedUserModel.findOne({ userId: user._id });
//       if (!subscribed) {
//         return res.status(httpsStatusCode.NotFound).send({
//           success: false,
//           message: message.lblSubscribedUserNotFound,
//           errorCode: "SUBSCRIBED_NOT_FOUND",
//         });
//       }
//       if (subscribed.totalOrgLimit == 0) {
//         return res.status(httpsStatusCode.Conflict).send({
//           success: false,
//           message: "Organization Limit Exceded.",
//           errorCode: "ORGANIZATION_LIMIT_EXCEDED",
//         });
//       }
//     }

//     // Handle uploaded files
//     let logoPath = null;
//     let bannerPath = null;

//     if (req.files) {
//       if (req.files.logo) {
//         logoPath = `/images/${req.files.logo[0].filename}`;
//       }
//       if (req.files.banner) {
//         bannerPath = `/images/${req.files.banner[0].filename}`;
//       }
//     }

//     // Generate serial number
//     const serial = await getSerialNumber("organization");

//     // Create new organization
//     const newOrganization = await organizationModel.create({
//       userId: user._id,
//       serialNumber: serial,
//       name,
//       captionText,
//       address,
//       email: email.toLowerCase(),
//       phone,
//       logo: logoPath,
//       banner: bannerPath,
//       isActive: true
//     });

//     if (user.roleId !== 1) {
//       subscribed.totalOrgLimit = subscribed.totalOrgLimit - 1;
//       subscribed.save();
//     }

//     // Return success response
//     return res.status(201).json({
//       success: true,
//       message: 'Organization created successfully',
//       data: {
//         organization: {
//           id: newOrganization._id,
//           serialNumber: newOrganization.serialNumber,
//           name: newOrganization.name,
//           email: newOrganization.email
//         }
//       }
//     });

//   } catch (error) {
//     console.error('Organization creation error:', error);

//     // Handle specific multer errors
//     if (error instanceof multer.MulterError) {
//       return res.status(400).json({
//         success: false,
//         message: error.message === 'File too large'
//           ? 'File size exceeds 2MB limit'
//           : 'File upload error',
//         errorCode: 'FILE_UPLOAD_ERROR'
//       });
//     }

//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Validation error',
//         errorCode: 'VALIDATION_ERROR',
//         errors: Object.values(error.errors).map(err => err.message)
//       });
//     }

//     // Generic server error
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       errorCode: 'SERVER_ERROR',
//       error: IS_DEV ? error.message : undefined
//     });
//   }
// };


// create organization new
exports.createOrganization = async (req, res) => {
  try {
    const user = req.user;
    const { name, captionText, address, email, phone } = req.body;

    // Validate required fields
    if (!name || !captionText || !address || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        errorCode: 'FIELD_MISSING'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errorCode: 'INVALID_EMAIL'
      });
    }

    // Validate phone format (basic validation, adjust as needed)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
        errorCode: 'INVALID_PHONE'
      });
    }

    // Check for existing organization
    const existingOrganization = await organizationModel.findOne({
      userId: user?._id,
      name,
      deletedAt: null
    });

    if (existingOrganization) {
      return res.status(409).json({
        success: false,
        message: 'Organization with this name already exists',
        errorCode: 'ORGANIZATION_ALREADY_EXISTS'
      });
    }


    let subscribed;
    if (user.roleId !== 1) {
      subscribed = await subscribedUserModel.findOne({ userId: user._id });
      if (!subscribed) {
        return res.status(httpsStatusCode.NotFound).send({
          success: false,
          message: message.lblSubscribedUserNotFound,
          errorCode: "SUBSCRIBED_NOT_FOUND",
        });
      }
      if (subscribed.totalOrgLimit == 0) {
        return res.status(httpsStatusCode.Conflict).send({
          success: false,
          message: "Organization Limit Exceded.",
          errorCode: "ORGANIZATION_LIMIT_EXCEDED",
        });
      }
    }

    // Handle uploaded files
    let logoUrl = null;
    let bannerUrl = null;

    const serial = await getSerialNumber("organization");


    if (req.files) {
      const uploadFile = async (file, fileType) => {
        const key = `organization-images/${serial}/${fileType}_${file.originalname.toLowerCase().replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const params = {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        };

        try {
          const uploadResult = await s3.upload(params).promise();
          return uploadResult.Location;
        } catch (uploadError) {
          throw uploadError;
        }
      };

      if (req.files.logo && req.files.logo[0]) {
        logoUrl = await uploadFile(req.files.logo[0], 'logo');
      }
      if (req.files.banner && req.files.banner[0]) {
        bannerUrl = await uploadFile(req.files.banner[0], 'banner');
      }
    }

    // Generate serial number

    // Create new organization
    const newOrganization = await organizationModel.create({
      userId: user._id,
      serialNumber: serial,
      name,
      captionText,
      address,
      email: email.toLowerCase(),
      phone,
      logo: logoUrl,
      banner: bannerUrl,
      isActive: true
    });

    if (user.roleId !== 1) {
      subscribed.totalOrgLimit = subscribed.totalOrgLimit - 1;
      subscribed.save();
    }

    // Return success response
    return res.status(201).json({
      success: true,
      message: 'Organization created successfully',
      data: {
        organization: {
          id: newOrganization._id,
          serialNumber: newOrganization.serialNumber,
          name: newOrganization.name,
          email: newOrganization.email
        }
      }
    });

  } catch (error) {
    console.error('Organization creation error:', error);

    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message === 'File too large'
          ? 'File size exceeds 2MB limit'
          : 'File upload error',
        errorCode: 'FILE_UPLOAD_ERROR'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errorCode: 'VALIDATION_ERROR',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }

    // Generic server error
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      errorCode: 'SERVER_ERROR',
      error: IS_DEV ? error.message : undefined
    });
  }
};



// update organization old
// exports.updateOrganization = async (req, res) => {
//   try {
//     const user = req.user;
//     const { organizationId, name, captionText, address, email, phone } = req.body;
//     // Validate required fields
//     if (!name || !captionText || !address || !email || !phone) {
//       return res.status(400).json({
//         success: false,
//         message: 'All required fields must be provided',
//         errorCode: 'FIELD_MISSING'
//       });
//     }
//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid email format',
//         errorCode: 'INVALID_EMAIL'
//       });
//     }
//     // Validate phone format (basic validation, adjust as needed)
//     const phoneRegex = /^\+?[\d\s-]{10,}$/;
//     if (!phoneRegex.test(phone)) {
//       return res.status(400).json({
//         success: false,
//         message: 'Invalid phone number format',
//         errorCode: 'INVALID_PHONE'
//       });
//     }
//     // Check for existing organization
//     // const existingOrganization = await organizationModel.findOne({
//     //   userId: user?._id,
//     //   name,
//     //   deletedAt: null
//     // });

//     // if (existingOrganization) {
//     //   return res.status(409).json({
//     //     success: false,
//     //     message: 'Organization with this name already exists',
//     //     errorCode: 'ORGANIZATION_ALREADY_EXISTS'
//     //   });
//     // }

//     const existingData = await organizationModel.findById(organizationId)
//     // Handle uploaded files
//     let logoPath = null;
//     let bannerPath = null;
//     if (req.files) {
//       if (req.files.logo) {
//         logoPath = `/images/${req.files.logo[0].filename}`;
//       }
//       if (req.files.banner) {
//         bannerPath = `/images/${req.files.banner[0].filename}`;
//       }
//     }
//     let dataOject = {
//       name,
//       captionText,
//       address,
//       email: email.toLowerCase(),
//       phone,
//     }
//     if (logoPath) {
//       dataOject.logo = logoPath
//     }
//     if (bannerPath) {
//       dataOject.banner = bannerPath
//     }
//     Object.assign(existingData, {
//       ...dataOject
//     });
//     await existingData.save()
//     return res.status(201).json({
//       success: true,
//       message: message.lblOrganizationUpdatedSuccess,
//       data: {
//         organization: {
//           id: existingData._id,
//           serialNumber: existingData.serialNumber,
//           name: existingData.name,
//           email: existingData.email
//         }
//       }
//     });
//   } catch (error) {
//     console.error('Organization updation error:', error);
//     // Handle specific multer errors
//     if (error instanceof multer.MulterError) {
//       return res.status(400).json({
//         success: false,
//         message: error.message === 'File too large'
//           ? 'File size exceeds 2MB limit'
//           : 'File upload error',
//         errorCode: 'FILE_UPLOAD_ERROR'
//       });
//     }

//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       return res.status(400).json({
//         success: false,
//         message: 'Validation error',
//         errorCode: 'VALIDATION_ERROR',
//         errors: Object.values(error.errors).map(err => err.message)
//       });
//     }
//     // Generic server error
//     return res.status(500).json({
//       success: false,
//       message: 'Internal server error',
//       errorCode: 'SERVER_ERROR',
//       error: IS_DEV ? error.message : undefined
//     });
//   }
// };

// update organization new
exports.updateOrganization = async (req, res) => {
  try {
    const user = req.user;
    const { organizationId, name, captionText, address, email, phone } = req.body;
    // Validate required fields
    if (!name || !captionText || !address || !email || !phone) {
      return res.status(400).json({
        success: false,
        message: 'All required fields must be provided',
        errorCode: 'FIELD_MISSING'
      });
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format',
        errorCode: 'INVALID_EMAIL'
      });
    }
    // Validate phone format (basic validation, adjust as needed)
    const phoneRegex = /^\+?[\d\s-]{10,}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number format',
        errorCode: 'INVALID_PHONE'
      });
    }
    // Check for existing organization
    // const existingOrganization = await organizationModel.findOne({
    //   userId: user?._id,
    //   name,
    //   deletedAt: null
    // });

    // if (existingOrganization) {
    //   return res.status(409).json({
    //     success: false,
    //     message: 'Organization with this name already exists',
    //     errorCode: 'ORGANIZATION_ALREADY_EXISTS'
    //   });
    // }

    const existingData = await organizationModel.findById(organizationId)
    // Handle uploaded files
    let logoUrl = null;
    let bannerUrl = null;
    if (req.files) {
      const uploadFile = async (file, fileType) => {
        const key = `organization-images/${existingData.serialNumber}/${fileType}_${file.originalname.toLowerCase().replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const params = {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        };

        try {
          const uploadResult = await s3.upload(params).promise();
          return uploadResult.Location;
        } catch (uploadError) {
          throw uploadError;
        }
      };

      if (req.files.logo && req.files.logo[0]) {
        logoUrl = await uploadFile(req.files.logo[0], 'logo');
      }
      if (req.files.banner && req.files.banner[0]) {
        bannerUrl = await uploadFile(req.files.banner[0], 'banner');
      }
    }
    let dataOject = {
      name,
      captionText,
      address,
      email: email.toLowerCase(),
      phone,
    }
    if (logoUrl) {
      dataOject.logo = logoUrl
    }
    if (bannerUrl) {
      dataOject.banner = bannerUrl
    }
    Object.assign(existingData, {
      ...dataOject
    });
    await existingData.save()
    return res.status(201).json({
      success: true,
      message: message.lblOrganizationUpdatedSuccess,
      data: {
        organization: {
          id: existingData._id,
          serialNumber: existingData.serialNumber,
          name: existingData.name,
          email: existingData.email
        }
      }
    });
  } catch (error) {
    console.error('Organization updation error:', error);
    // Handle specific multer errors
    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message === 'File too large'
          ? 'File size exceeds 2MB limit'
          : 'File upload error',
        errorCode: 'FILE_UPLOAD_ERROR'
      });
    }

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errorCode: 'VALIDATION_ERROR',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    // Generic server error
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      errorCode: 'SERVER_ERROR',
      error: IS_DEV ? error.message : undefined
    });
  }
};



// get all organization
exports.getAllOrganization = async (req, res, next) => {
  try {

    const user = req.user;
    const { userId } = req.params;

    console.log("user", user);

    let listOrganization = []

    if (user.roleId < 3) {
      const [organizarions] = await Promise.all([
        organizationModel.find({ userId: userId }).sort({ _id: 1 }).lean(),
      ]);
      listOrganization = organizarions;
    } else if (user.roleId == 3) {
      const [organizarions] = await Promise.all([
        organizationModel.find({ assignedUser: { $in: user._id }, deletedAt: null }).sort({ _id: 1 }).lean(),
      ]);
      listOrganization = organizarions;
    }




    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblOrganizationFoundSuccessfully,
      data: {
        data: listOrganization,
      },
    });
  } catch (error) {
    console.error("Organization fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive organization
exports.activeInactiveOrganization = async (req, res, next) => {
  try {
    const { status, topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(400).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupNotFound,
      });
    }
    Object.assign(topup, {
      isActive: status === "1",
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get individual organization
exports.getIndividualOrganization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [organization] = await Promise.all([
      organizationModel.findById(id).lean()
    ]);
    if (!organization) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblOrganizationNotFound,
      });

    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblOrganizationFoundSuccessfully,
      data: {
        data: organization,
      },
    });
  } catch (error) {
    console.error("Organization fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// soft delete topup
exports.softDeleteOrganization = async (req, res, next) => {
  try {
    const { topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblTopupNotFound,
      });
    }
    Object.assign(topup, {
      deletedAt: new Date(),
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("topup soft delete error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// restore organization
exports.restoreOrganizarion = async (req, res, next) => {
  try {
    const { topupId, keyword, page, perPage } = req.body;
    req.query.keyword = keyword;
    req.query.page = page;
    req.query.perPage = perPage;
    if (!topupId) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblTopupIdrequired,
      });
    }
    const topup = await topupModel.findById(topupId);
    if (!topup) {
      return res.status(httpsStatusCode.NotFound).send({
        message: message.lblSubscriptionPlanNotFound,
      });
    }
    Object.assign(topup, {
      deletedAt: null,
    });
    await topup.save();
    this.getTopupList(req, res)
  } catch (error) {
    console.error("topup restore error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};








// ---------- Organization controller ends here ----------




// ---------- session controller starts here -------------


// create session
exports.createSession = async (req, res, next) => {
  try {
    const user = req.user;
    const company = req.company;
    // console.log("company", company);

    const { organizationId, name, forWhom, isActive, closeDate, isPasswordRequired, password } = req.body;

    console.log("req.body", req.body);

    if (!organizationId || !name || !forWhom || !isActive || !closeDate) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const org = await organizationModel.findById(organizationId);
    if (!org) {
      return res.status(httpsStatusCode.Conflict).send({
        success: false,
        message: message.lblOrganizationNotFound,
        errorCode: "ORGANIZATION_NOT_FOUND",
      });
    }
    const serial = await getSerialNumber("session");

    let hash = ""

    if (isPasswordRequired && password) {
      hash = bcrypt.hashSync(password, 10);
    }

    // Create the session without the link initially
    const newSession = await sessionModel.create({
      serialNumber: serial,
      clientId: user?._id,
      createdBy: user?._id,
      organizationId: organizationId,
      name: name,
      for: forWhom,
      link: "123", // Temporary empty link
      isActive: isActive,
      isPasswordRequired: isPasswordRequired ? true : false,
      password: hash ? hash : null,
      closeDate: closeDate,
    });


    // Update the session with the dynamic link using the session's _id
    const sessionId = newSession._id;
    const encryptedId = commonFunction.encryptId(sessionId);

    const dynamicLink = `https://${company?.subDomain}.aestree.in/form/${encryptedId}`;
    newSession.link = dynamicLink;
    await newSession.save();

    const fieldArray = [
      {
        name: "firstName",
        label: "First Name",
        type: "text",
        isRequired: true,
        placeholder: "Enter First Name.",
        gridConfig: {
          span: 12,
          order: 1
        },
        isDeleteAble: false,
        userId: user?._id,
        sessionId: sessionId,
        createdBy: user?._id,
      },
      {
        name: "phone",
        label: "Phone",
        type: "number",
        isRequired: true,
        placeholder: "Enter Phone Number.",
        validation: {
          regex: "^\\(?([0-9]{3})\\)?[-. ]?([0-9]{3})[-. ]?([0-9]{4})$"
        },
        gridConfig: {
          span: 12,
          order: 2
        },
        isDeleteAble: false,
        userId: user?._id,
        sessionId: sessionId,
        createdBy: user?._id,
      },
    ]

    await customFormModel.insertMany(fieldArray)

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSessionCreatedSuccess,
      data: { session: newSession },
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


exports.updateSession = async (req, res, next) => {
  try {
    const user = req.user;
    const company = req.company;
    const { organizationId, name, forWhom, isActive, closeDate, isPasswordRequired, password, sessionId } = req.body;
    if (!sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblSessionIdrequired,
        errorCode: "SESSION_ID_MISSING",
      });
    }
    if (!organizationId || !name || !forWhom || !closeDate) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    let hash = ""
    if (isPasswordRequired && password) {
      hash = bcrypt.hashSync(password, 10);
    }
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }
    session.for = forWhom;
    session.name = name;
    session.closeDate = closeDate;
    session.isActive = isActive;
    session.isPasswordRequired = isPasswordRequired;
    if (hash) {
      session.password = hash;
    }
    await session.save();
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSessionUpdatedSuccess,
      data: { session: session },
    });
  } catch (error) {
    console.error("Session creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// delete session
exports.deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.body;
    if (!sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblSessionIdrequired,
        errorCode: "SESSION_ID_MISSING",
      });
    }
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }
    await sessionModel.findByIdAndUpdate({ _id: sessionId }, {
      deletedAt: new Date()
    });
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSessionSoftDeletedSuccess,
      data: { session: session },
    });
  } catch (error) {
    console.error("Session deleting error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// get all session
exports.getAllSession = async (req, res, next) => {
  try {
    const { userId, organizationId } = req.params;
    console.log("req.params", req.params);

    const [sessions] = await Promise.all([
      sessionModel.find({ clientId: userId, organizationId: organizationId }).sort({ _id: 1 }).lean(),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSessionFoundSuccessfully,
      data: {
        data: sessions,
      },
    });
  } catch (error) {
    console.error("Sessions fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get session
exports.getSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(httpsStatusCode.Conflict).send({
        success: false,
        message: message.lblSessionIdrequired,
        errorCode: "SESSION_ID_REQUIRED",
      });
    }
    const session = await sessionModel.findById(sessionId).populate("organizationId");
    if (!session) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });

    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblSessionFoundSuccessfully,
      data: {
        data: session,
      },
    });
  } catch (error) {
    console.error("Sessions fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// active inactive session
exports.activeInactiveSession = async (req, res, next) => {
  try {
    const { status, sessionId, } = req.body;
    if (!sessionId) {
      return res.status(400).send({
        message: message.lblSessionIdrequired,
      });
    }
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(httpsStatusCode.BadRequest).send({
        message: message.lblSessionNotFound,
      });
    }
    Object.assign(session, {
      isActive: status === "1",
    });
    await session.save();
    req.params.userId = session.clientId;
    req.params.organizationId = session.organizationId;
    this.getAllSession(req, res)
  } catch (error) {
    console.error("session active inactive error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



// ---------- session controller ends here -------------



// ---------- Custom form controller starts here -------------


exports.createField = async (req, res, next) => {
  try {
    const {
      name,
      label,
      type,
      options,
      isRequired,
      placeholder,
      validation,
      aspectRation,
      gridConfig,

      userId,
      sessionId
    } = req.body;


    console.log("req.body", req.body);



    // Basic validation
    if (!name || !label || !type) {
      return res.status(400).send({ error: 'Name, label, and type are required' });
    }

    if (!userId || !sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    // Check for duplicate field name (optional, depending on your requirements)
    const existingField = await customFormModel.findOne({ name, userId, sessionId });
    if (existingField) {
      return res.status(400).send({ error: 'A field with this name already exists' });
    }
    // Validate gridConfig
    let finalGridConfig = { span: 12, order: 1 }; // Default

    if (gridConfig) {
      if (gridConfig.span < 1 || gridConfig.span > 12) {
        return res.status(400).send({ error: 'Grid span must be between 1 and 12' });
      }
      if (typeof gridConfig.order !== 'number') {
        return res.status(400).send({ error: 'Grid order must be a number' });
      }
    }
    const maxOrderField = await customFormModel.findOne(
      { userId, sessionId },
      { "gridConfig.order": 1 }
    )
      .sort({ "gridConfig.order": -1 })
      .lean();
    finalGridConfig.order = maxOrderField ? maxOrderField.gridConfig.order + 1 : 1;
    // Validate options for select/multiselect
    if (['select', 'multiselect'].includes(type) && (!options || !Array.isArray(options) || options.length === 0)) {
      return res.status(400).send({ error: 'Options are required for select and multiselect types' });
    }
    // Validate file type specific fields
    if (type === 'file') {
      if (validation && validation.fileTypes && !Array.isArray(validation.fileTypes)) {
        return res.status(400).send({ error: 'fileTypes must be an array' });
      }
      if (validation && validation.maxSize && (typeof validation.maxSize !== 'number' || validation.maxSize <= 0)) {
        return res.status(400).send({ error: 'maxSize must be a positive number' });
      }
    }
    // Create new custom field
    const customField = new customFormModel({
      name,
      label,
      type,
      options: options || [],
      isRequired: isRequired || false,
      placeholder,
      validation: validation || {},
      aspectRation: aspectRation,
      gridConfig: finalGridConfig,
      createdBy: req.user._id,
      userId: userId,
      sessionId: sessionId
    });
    // Save to database
    const savedField = await customField.save();
    res.status(201).send({
      message: 'Custom field created successfully',
      data: savedField
    });
  } catch (error) {
    console.error('Error creating custom field:', error);
    res.status(500).send({ error: 'Internal server error', details: error.message });
  }
};

// delete field
exports.deleteField = async (req, res, next) => {
  try {
    const { userId, sessionId, fieldId } = req.params;
    if (!userId || !sessionId || !fieldId) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSING",
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !mongoose.Types.ObjectId.isValid(fieldId)
    ) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid ID format",
        errorCode: "INVALID_ID",
      });
    }

    const field = await customFormModel.findOne({
      _id: fieldId,
      sessionId: sessionId,
      userId: userId,
    });

    if (!field) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: "Field not found",
        errorCode: "NOT_FOUND",
      });
    }

    await customFormModel.deleteOne({ _id: fieldId });

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: "Field deleted successfully",
    });
  } catch (error) {
    console.error("Field deletion error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: message.lblInternalServerError,
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.updateFieldOrder = async (req, res, next) => {
  try {
    const { userId, sessionId } = req.params;
    const { fields } = req.body;

    if (!userId || !sessionId || !fields || !Array.isArray(fields) || fields.length === 0) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: message?.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSING",
      });
    }

    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(sessionId) ||
      !fields.every((f) => mongoose.Types.ObjectId.isValid(f.fieldId))
    ) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid ID format",
        errorCode: "INVALID_ID",
      });
    }

    if (
      !fields.every((f) => typeof f.order === "number" && f.order >= 1 && Number.isInteger(f.order))
    ) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid fields data",
        errorCode: "INVALID_FIELDS",
      });
    }

    const orders = fields.map((f) => f.order);
    if (new Set(orders).size !== orders.length) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: ERROR_MESSAGES.DUPLICATE_ORDERS,
        errorCode: ERROR_CODES.DUPLICATE_ORDERS,
      });
    }

    const fieldIds = fields.map((f) => f.fieldId);
    const existingFields = await customFormModel.find({
      _id: { $in: fieldIds },
      userId,
      sessionId,
      // createdBy: userId,
    });

    if (existingFields.length !== fields.length) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Some fields do not belong to this user or session",
        errorCode: "NOT_FOUND",
      });
    }

    const updatePromises = fields.map(({ fieldId, order }) =>
      customFormModel.updateOne(
        { _id: fieldId, userId, sessionId },
        { $set: { "gridConfig.order": order } }
      )
    );
    await Promise.all(updatePromises);

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: "Field order updated successfully",
    });
  } catch (error) {
    console.error("Error updating field order:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: message.lblInternalServerError,
      errorCode: SERVER_ERROR,
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

exports.getAllFields = async (req, res, next) => {
  try {
    const { userId, sessionId } = req.params;
    if (!userId || !sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const [fields] = await Promise.all([
      customFormModel.find({ userId: userId, sessionId: sessionId }).sort({ _id: 1 }).lean(),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFieldFoundSuccessfully,
      data: {
        data: fields,
      },
    });
  } catch (error) {
    console.error("Field fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


exports.getAllFieldsBySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }

    const session = await sessionModel.findById(sessionId)
    const [fields] = await Promise.all([
      customFormModel.find({ sessionId: sessionId }).populate({
        path: "sessionId",
        populate: {
          path: "organizationId"
        }
      })
        .sort({ _id: 1 }).lean(),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFieldFoundSuccessfully,
      data: {
        session: session,
        data: fields,
      },
    });
  } catch (error) {
    console.error("Field fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// get form data
exports.getFormData = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const formData = await formDataModel.findById(id)
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFormFoundSuccessfully,
      data: {
        data: formData,
      },
    });
  } catch (error) {
    console.error("Field data fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// check password
exports.checkPasword = async (req, res, next) => {
  try {
    const {
      sessionId,
      password
    } = req.body;

    if (!sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }

    const session = await sessionModel.findById(sessionId);

    if (!session) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }


    const isPasswordValid = await session.isPasswordCorrect(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Password incorrect",
        errorCode: "AUTH_FAILED",
      });
    }


    return res.status(httpsStatusCode.OK).send({
      success: true,
      message: 'Continued successfully',
    });
  } catch (error) {
    console.error('Error checking form password:', error);
    res.status(500).send({ error: 'Internal server error', details: error.message });
  }
};


// submit form old
// exports.submitForm = async (req, res, next) => {
//   try {
//     const { userId, organizationId, sessionId, phone, firstName } = req.body;
//     if (!userId || !organizationId || !sessionId) {
//       return res.status(httpsStatusCode.BadRequest).send({
//         success: false,
//         message: message.lblRequiredFieldMissing,
//         errorCode: "FIELD_MISSIING",
//       });
//     }

//     const formSession = await sessionModel.findById(sessionId);
//     if (!formSession) {
//       return res.status(httpsStatusCode.NotFound).send({
//         success: false,
//         message: message.lblSessionNotFound,
//         errorCode: "SESSION_NOT_FOUND",
//       });
//     }

//     const user = await userModel.findById(userId);
//     let subscribed;
//     if (user.roleId !== 1) {
//       subscribed = await subscribedUserModel.findOne({ userId: userId });
//       if (!subscribed) {
//         return res.status(httpsStatusCode.NotFound).send({
//           success: false,
//           message: message.lblSubscribedUserNotFound,
//           errorCode: "SUBSCRIBED_NOT_FOUND",
//         });
//       }
//       if (subscribed.totalFormLimit == 0) {
//         return res.status(httpsStatusCode.Conflict).send({
//           success: false,
//           message: "Form Limit Exceded.",
//           errorCode: "FORM_LIMIT_EXCEDED",
//         });
//       }
//     }

//     const otherThanFiles = {};
//     const files = [];
//     for (const [key, value] of Object.entries(req.body)) {
//       if (key !== "userId" && key !== "organizationId" && key !== "sessionId" && key !== "phone" && key !== "firstName") {
//         otherThanFiles[key] = value;
//       }
//     }

//     if (req.files && req.files.length > 0) {
//       req.files.forEach((file) => {
//         files.push({
//           fieldName: file.fieldname,
//           fileUrl: `/customForm/${file.filename}`, // Correct path
//           originalName: file.originalname,
//           mimeType: file.mimetype,
//           size: file.size,
//         });
//       });
//     } else {
//       console.log("No files uploaded"); // Debug log
//     }

//     const serialNumber = await getSerialNumber("form");
//     const password = `${firstName.substring(0, 2).toUpperCase()}${phone.substring(0, 3)}`;

//     const formData = new formDataModel({
//       serialNumber: serialNumber,
//       password: password,
//       phone,
//       firstName,
//       sessionId,
//       userId,
//       organizationId,
//       otherThanFiles: new Map(Object.entries(otherThanFiles || {})),
//       files,
//     });
//     const session = await mongoose.startSession();
//     try {
//       await session.withTransaction(async () => {
//         await formData.save({ session });
//       });
//       await session.endSession();
//     } catch (error) {
//       await session.endSession();
//       if (error.message.includes("A form with this phone, first name, and session")) {
//         return res.status(httpsStatusCode.Conflict).json({
//           success: false,
//           message: "A form with this phone, first name, and session already exists",
//           errorCode: "DUPLICATE_FORM",
//         });
//       }
//       throw error;
//     }

//     formSession.formReceived = formSession.formReceived + 1;
//     formSession.save();

//     if (user.roleId !== 1) {
//       subscribed.totalFormLimit = subscribed.totalFormLimit - 1;
//       subscribed.save();
//     }



//     return res.status(httpsStatusCode.OK).json({
//       success: true,
//       message: message.lblFormCreatedSuccess,
//       data: {
//         data: formData,
//       },
//     });
//   } catch (error) {
//     console.error("Form creation error:", error);
//     return res.status(httpsStatusCode.InternalServerError).json({
//       success: false,
//       message: "Internal server error",
//       errorCode: "SERVER_ERROR",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };



// submit form new
exports.submitForm = async (req, res, next) => {
  try {
    const { userId, organizationId, sessionId, phone, firstName } = req.body;
    if (!userId || !organizationId || !sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const organization = await organizationModel.findById(organizationId);
    if (!organization) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblOrganizationNotFound,
        errorCode: "ORGANIZATION_NOT_FOUND",
      });
    }
    const formSession = await sessionModel.findById(sessionId);
    if (!formSession) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }
    const user = await userModel.findById(userId);
    let subscribed;
    if (user.roleId !== 1) {
      subscribed = await subscribedUserModel.findOne({ userId: userId });
      if (!subscribed) {
        return res.status(httpsStatusCode.NotFound).send({
          success: false,
          message: message.lblSubscribedUserNotFound,
          errorCode: "SUBSCRIBED_NOT_FOUND",
        });
      }
      if (subscribed.totalFormLimit == 0) {
        return res.status(httpsStatusCode.Conflict).send({
          success: false,
          message: "Form Limit Exceded.",
          errorCode: "FORM_LIMIT_EXCEDED",
        });
      }
    }
    const otherThanFiles = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (key !== "userId" && key !== "organizationId" && key !== "sessionId" && key !== "phone" && key !== "firstName") {
        otherThanFiles[key] = value;
      }
    }
    const files = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileSerialNumber = await commonFunction.getFileSerialNumber("fileSerialNumber")
        const key = `form-dynamic-file/${organization.serialNumber}/${formSession.serialNumber}/${file.fieldname}/${fileSerialNumber}_${file.originalname.toLowerCase().replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const params = {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        };
        try {
          const uploadResult = await s3.upload(params).promise();
          files.push({
            fieldName: file.fieldname,
            fileUrl: uploadResult.Location,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            key,
          });
        } catch (uploadError) {
          console.log("No files uploaded", uploadError);
          throw uploadError;
        }
      }
    } else {
      console.log("No files uploaded");
    }

    const serialNumber = await getSerialNumber("form");
    const password = `${firstName.substring(0, 2).toUpperCase()}${phone.substring(0, 3)}`;

    const formData = new formDataModel({
      serialNumber: serialNumber,
      password: password,
      phone,
      firstName,
      sessionId,
      userId,
      organizationId,
      otherThanFiles: new Map(Object.entries(otherThanFiles || {})),
      files,
    });
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await formData.save({ session });
      });
      await session.endSession();
    } catch (error) {
      await session.endSession();
      if (error.message.includes("A form with this phone, first name, and session")) {
        return res.status(httpsStatusCode.Conflict).json({
          success: false,
          message: "A form with this phone, first name, and session already exists",
          errorCode: "DUPLICATE_FORM",
        });
      }
      throw error;
    }

    formSession.formReceived = formSession.formReceived + 1;
    formSession.save();

    if (user.roleId !== 1) {
      subscribed.totalFormLimit = subscribed.totalFormLimit - 1;
      subscribed.save();
    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFormCreatedSuccess,
      data: {
        data: formData,
      },
    });
  } catch (error) {
    console.error("Form creation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Bulk create forms for testing
exports.bulkCreateForms = async (req, res) => {
  try {
    const { userId, organizationId, sessionId, firstName, basePhone, count, batchSize } = req.body;
    const countNum = parseInt(count, 10) || 2000;
    const batchSizeNum = parseInt(batchSize, 10) || 100;
    if (!userId || !organizationId || !sessionId || !firstName || !basePhone || !req.files || req.files.length !== 1) {
      // logger.warn('Missing required fields for bulk form creation', { userId });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'userId, organizationId, sessionId, firstName, basePhone, fieldName, and one file are required',
        errorCode: 'FIELD_MISSING',
      });
    }
    if (countNum < 1 || countNum > 5000) {
      // logger.warn('Invalid count for bulk form creation', { count: countNum, userId });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'Count must be between 1 and 5000',
        errorCode: 'INVALID_COUNT',
      });
    }
    if (batchSizeNum < 1 || batchSizeNum > 500) {
      // logger.warn('Invalid batch size for bulk form creation', { batchSize: batchSizeNum, userId });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'Batch size must be between 1 and 500',
        errorCode: 'INVALID_BATCH_SIZE',
      });
    }

    // Validate inputs
    const organization = await organizationModel.findById(organizationId);
    if (!organization) {
      // logger.warn('Organization not found', { organizationId });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: message.lblOrganizationNotFound,
        errorCode: 'ORGANIZATION_NOT_FOUND',
      });
    }
    const formSession = await sessionModel.findById(sessionId);
    if (!formSession) {
      // logger.warn('Session not found', { sessionId });
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: 'SESSION_NOT_FOUND',
      });
    }
    const user = await userModel.findById(userId);
    let subscribed;
    if (user.roleId !== 1) {
      subscribed = await subscribedUserModel.findOne({ userId });
      if (!subscribed) {
        logger.warn('Subscribed user not found', { userId });
        return res.status(httpsStatusCode.NotFound).json({
          success: false,
          message: message.lblSubscribedUserNotFound,
          errorCode: 'SUBSCRIBED_NOT_FOUND',
        });
      }
      if (subscribed.totalFormLimit < countNum) {
        logger.warn('Form limit exceeded', { userId, totalFormLimit: subscribed.totalFormLimit, count: countNum });
        return res.status(httpsStatusCode.Conflict).json({
          success: false,
          message: 'Form limit exceeded',
          errorCode: 'FORM_LIMIT_EXCEDED',
        });
      }
    }

    // Create bulk job
    const jobId = uuidv4();
    await BulkJob.create({
      jobId,
      userId,
      sessionId,
      status: 'pending',
      progress: 0,
      totalForms: countNum,
      processedForms: 0,
    });
    // logger.info('Bulk form creation job initiated', { jobId, sessionId, count: countNum });

    // Process forms asynchronously
    setImmediate(async () => {
      try {
        await BulkJob.updateOne({ jobId }, { status: 'processing' });
        // logger.info('Started bulk form creation', { jobId, sessionId });

        const file = req.files[0];
        const basePhoneNum = parseInt(basePhone, 10);
        if (isNaN(basePhoneNum)) {
          throw new Error('basePhone must be a valid number');
        }

        let processedForms = 0;
        const batchCount = Math.ceil(countNum / batchSizeNum);
        let failedForms = 0;

        for (let batchIndex = 0; batchIndex < batchCount; batchIndex++) {
          const batchStart = batchIndex * batchSizeNum;
          const batchEnd = Math.min(batchStart + batchSizeNum, countNum);
          const batchForms = [];

          // logger.info('Processing batch', { jobId, batchIndex, batchStart, batchEnd });

          // Prepare forms for batch
          for (let i = batchStart; i < batchEnd; i++) {
            const phone = (basePhoneNum + i).toString().padStart(10, '0');
            const fileSerialNumber = await commonFunction.getFileSerialNumber('fileSerialNumber');
            const key = `form-dynamic-file/${organization.serialNumber}/${formSession.serialNumber}/${file.fieldname}/${fileSerialNumber}_${file.originalname.toLowerCase().replace(/[^a-zA-Z0-9.-]/g, '')}`;

            const params = {
              Bucket: process.env.DO_SPACES_BUCKET,
              Key: key,
              Body: file.buffer,
              ContentType: file.mimetype,
              ACL: 'public-read',
            };

            let fileData;
            try {
              const uploadResult = await s3.upload(params).promise();
              fileData = {
                fieldName: file.fieldname,
                fileUrl: uploadResult.Location,
                originalName: file.originalname,
                mimeType: file.mimetype,
                size: file.size,
                key,
              };
            } catch (uploadError) {
              // logger.error('File upload failed in batch', { jobId, batchIndex, i, error: uploadError.message });
              failedForms++;
              continue;
            }

            const serialNumber = await commonFunction.getSerialNumber('form');
            const password = `${firstName.substring(0, 2).toUpperCase()}${phone.substring(0, 3)}`;

            const otherThanFiles = {
              ["First Name"]: firstName,
              ["Phone"]: phone
            };

            batchForms.push({
              serialNumber,
              password,
              phone,
              firstName,
              sessionId,
              userId,
              organizationId,
              otherThanFiles: otherThanFiles,
              files: [fileData],
            });
          }

          // Save batch with transaction
          const session = await mongoose.startSession();
          try {
            await session.withTransaction(async () => {
              await formDataModel.insertMany(batchForms, { session });
              formSession.formReceived += batchForms.length;
              await formSession.save({ session });
              if (user.roleId !== 1) {
                subscribed.totalFormLimit -= batchForms.length;
                await subscribed.save({ session });
              }
            });
            processedForms += batchForms.length;
            const progress = Math.round((processedForms / countNum) * 100);
            await BulkJob.updateOne({ jobId }, { progress, processedForms });
            // logger.info('Batch processed', { jobId, batchIndex, batchForms: batchForms.length, progress });
          } catch (error) {
            // logger.error('Batch transaction failed', { jobId, batchIndex, error: error.message });
            failedForms += batchForms.length;
            await session.endSession();
            continue;
          } finally {
            await session.endSession();
          }

          // Delay to avoid rate limiting
          if (batchIndex < batchCount - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        const status = failedForms === 0 ? 'completed' : failedForms === countNum ? 'failed' : 'completed';
        const errorMessage = failedForms > 0 ? `Failed to process ${failedForms} forms` : undefined;
        await BulkJob.updateOne({ jobId }, {
          status,
          progress: 100,
          processedForms,
          errorMessage,
        });
        // logger.info('Bulk form creation completed', { jobId, processedForms, failedForms });
      } catch (error) {
        // logger.error('Bulk form creation failed', { jobId, error: error.message });
        await BulkJob.updateOne({ jobId }, {
          status: 'failed',
          errorMessage: error.message || 'Failed to process bulk forms',
        });
      }
    });

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: 'Bulk form creation job initiated',
      data: { jobId },
    });
  } catch (error) {
    console.log('Bulk form creation initiation error', { error: error.message });
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: 'Internal server error',
      errorCode: 'SERVER_ERROR',
    });
  }
};



// update form old
// exports.updateForm = async (req, res, next) => {
//   const session = await mongoose.startSession();
//   try {
//     const { formId } = req.params;
//     const { userId, organizationId, sessionId, phone, firstName } = req.body;
//     if (!mongoose.Types.ObjectId.isValid(formId)) {
//       return res.status(httpsStatusCode.BadRequest).json({
//         success: false,
//         message: "Invalid ID format",
//         errorCode: "INVALID_ID",
//       });
//     }
//     if (!userId || !organizationId || !sessionId) {
//       return res.status(httpsStatusCode.BadRequest).send({
//         success: false,
//         message: message.lblRequiredFieldMissing,
//         errorCode: "FIELD_MISSIING",
//       });
//     }
//     if (
//       !mongoose.Types.ObjectId.isValid(userId) ||
//       !mongoose.Types.ObjectId.isValid(organizationId) ||
//       !mongoose.Types.ObjectId.isValid(sessionId)
//     ) {
//       return res.status(httpsStatusCode.BadRequest).json({
//         success: false,
//         message: "Invalid ID format",
//         errorCode: "INVALID_ID",
//       });
//     }
//     const formData = await formDataModel.findById(formId).session(session);
//     if (!formData) {
//       return res.status(httpsStatusCode.NotFound).json({
//         success: false,
//         message: message?.lblFormNotFound,
//         errorCode: "NOT_FOUND",
//       });
//     }
//     const otherThanFiles = {};
//     const files = [];

//     for (const [key, value] of Object.entries(req.body)) {
//       if (key !== "userId" && key !== "organizationId" && key !== "sessionId" && key !== "phone" && key !== "firstName") {
//         if (typeof value === "string" && !value.startsWith("/customForm/")) {
//           otherThanFiles[key] = value;
//         }
//       }
//     }
//     if (req.files && req.files.length > 0) {
//       req.files.forEach((file) => {
//         files.push({
//           fieldName: file.fieldname,
//           fileUrl: `/customForm/${file.filename}`, // Correct path
//           originalName: file.originalname,
//           mimeType: file.mimetype,
//           size: file.size,
//         });
//       });
//     } else {
//       console.log("No files uploaded"); // Debug log
//     }

//     formData.phone = phone !== undefined ? phone : formData.phone;
//     formData.firstName = firstName !== undefined ? firstName : formData.firstName;
//     formData.sessionId = sessionId;
//     formData.userId = userId;
//     formData.organizationId = organizationId;
//     formData.otherThanFiles = new Map(Object.entries(otherThanFiles || {}));
//     if (files.length > 0) {
//       formData.files = files; // Replace files array
//     }
//     await session.withTransaction(async () => {
//       await formData.save({ session });
//     });
//     await session.endSession();
//     return res.status(httpsStatusCode.OK).json({
//       success: true,
//       message: message.lblFormUpdatedSuccess,
//       data: {
//         data: formData,
//       },
//     });
//   } catch (error) {
//     console.error("Form updation error:", error);
//     return res.status(httpsStatusCode.InternalServerError).json({
//       success: false,
//       message: "Internal server error",
//       errorCode: "SERVER_ERROR",
//       error: process.env.NODE_ENV === "development" ? error.message : undefined,
//     });
//   }
// };

// update form new
exports.updateForm = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { formId } = req.params;
    const { userId, organizationId, sessionId, phone, firstName } = req.body;
    console.log("req.body", req.body);

    if (!mongoose.Types.ObjectId.isValid(formId)) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid ID format",
        errorCode: "INVALID_ID",
      });
    }
    if (!userId || !organizationId || !sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    if (
      !mongoose.Types.ObjectId.isValid(userId) ||
      !mongoose.Types.ObjectId.isValid(organizationId) ||
      !mongoose.Types.ObjectId.isValid(sessionId)
    ) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid ID format",
        errorCode: "INVALID_ID",
      });
    }

    const organization = await organizationModel.findById(organizationId);
    if (!organization) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblOrganizationNotFound,
        errorCode: "ORGANIZATION_NOT_FOUND",
      });
    }

    const formSession = await sessionModel.findById(sessionId);
    if (!formSession) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }


    const formData = await formDataModel.findById(formId).session(session);
    if (!formData) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message?.lblFormNotFound,
        errorCode: "NOT_FOUND",
      });
    }
    const otherThanFiles = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (key !== "userId" && key !== "organizationId" && key !== "sessionId" && key !== "phone" && key !== "firstName") {
        if (typeof value === "string" && !value.startsWith("https://billionforms-files") && !value.startsWith("https://blr1.digitaloceanspaces.com/billionforms-files")) {
          otherThanFiles[key] = value;
        }
      }
    }

    const files = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const fileSerialNumber = await commonFunction.getFileSerialNumber("fileSerialNumber")
        const key = `form-dynamic-file/${organization.serialNumber}/${formSession.serialNumber}/${file.fieldname}/${fileSerialNumber}_${file.originalname.toLowerCase().replace(/[^a-zA-Z0-9.-]/g, '')}`;
        const params = {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        };
        try {
          const uploadResult = await s3.upload(params).promise();
          files.push({
            fieldName: file.fieldname,
            fileUrl: uploadResult.Location,
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            key,
          });
        } catch (uploadError) {
          console.log("No files uploaded", uploadError);
          throw uploadError;
        }
      }
    } else {
      console.log("No files uploaded");
    }

    formData.phone = phone !== undefined ? phone : formData.phone;
    formData.firstName = firstName !== undefined ? firstName : formData.firstName;
    formData.sessionId = sessionId;
    formData.userId = userId;
    formData.organizationId = organizationId;
    formData.otherThanFiles = new Map(Object.entries(otherThanFiles || {}));
    if (files.length > 0) {
      formData.files = files; // Replace files array
    }
    await session.withTransaction(async () => {
      await formData.save({ session });
    });
    await session.endSession();
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFormUpdatedSuccess,
      data: {
        data: formData,
      },
    });
  } catch (error) {
    console.error("Form updation error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// delete form
exports.deleteForm = async (req, res, next) => {
  try {
    const { formId } = req.body;

    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(formId)) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: "Invalid ID format",
        errorCode: "INVALID_ID",
      });
    }

    // Delete the form using findOneAndDelete
    const formData = await formDataModel.findOneAndDelete({ _id: formId });
    if (!formData) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message?.lblFormNotFound || "Form not found",
        errorCode: "NOT_FOUND",
      });
    }

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message?.lblFormDeletedSuccess || "Form deleted successfully",
    });
  } catch (error) {
    console.error("Form deletion error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};


// login to eidt form
exports.loginToEditForm = async (req, res, next) => {
  try {
    const {
      serialNumber,
      password
    } = req.body;

    if (!serialNumber) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: "Form ID is missing.",
        errorCode: "ID_MISSIING",
      });
    }
    const form = await formDataModel.findOne({ serialNumber: serialNumber });
    if (!form) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblFormNotFound,
        errorCode: "FORM_NOT_FOUND",
      });
    }
    if (password !== form.password) {
      return res.status(401).json({
        success: false,
        message: "Password incorrect",
        errorCode: "AUTH_FAILED",
      });
    }
    return res.status(httpsStatusCode.OK).send({
      success: true,
      message: 'Continued successfully',
      data: form
    });
  } catch (error) {
    console.error('Error checking form password:', error);
    res.status(500).send({ error: 'Internal server error', details: error.message });
  }
};

// get all forms by session
exports.getAllFormsBySession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) {
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblRequiredFieldMissing,
        errorCode: "FIELD_MISSIING",
      });
    }
    const forms = await formDataModel.find({ sessionId: sessionId });
    if (!forms) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblFormNotFound,
        errorCode: "FORMS_NOT_FOUND",
      });
    }
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblFormFoundSuccessfully,
      data: {
        data: forms,
      },
    });
  } catch (error) {
    console.error("Field fetching error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};



// ---------- Custom form controller ends here ------------



// ---------- custom form file download controller starts here -------------


// Download all files for a session
exports.downloadSessionFiles = async (req, res) => {
  try {
    const { sessionId } = req.query;
    const user = req.user;
    if (!sessionId) {
      logger.warn('Missing sessionId', { userId: user._id });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'sessionId is required',
        errorCode: 'FIELD_MISSING',
      });
    }

    const session = await sessionModel.findById(sessionId);
    if (!session) {
      // logger.warn('Session not found', { sessionId });
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: 'SESSION_NOT_FOUND',
      });
    }

    const jobId = uuidv4();
    await DownloadJob.create({
      jobId,
      sessionId,
      userId: user._id,
      status: 'pending',
      progress: 0,
      zipKey,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    // logger.info('Download job initiated', { jobId, sessionId });

    setImmediate(async () => {
      try {
        await DownloadJob.updateOne({ jobId }, { status: 'processing' });
        // logger.info('Started ZIP generation', { jobId, sessionId });

        const forms = await formDataModel.find({ sessionId }).lean();
        const totalFiles = forms.reduce((sum, form) => sum + form.files.length, 0);
        if (totalFiles === 0) {
          await DownloadJob.updateOne({ jobId }, {
            status: 'failed',
            errorMessage: 'No files found for the session',
          });
          // logger.warn('No files found for session', { jobId, sessionId });
          return;
        }

        const zipKey = `temp/zips/${jobId}.zip`;
        const archive = archiver('zip', { zlib: { level: 9 } });
        const uploadParams = {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: zipKey,
          Body: archive,
          ContentType: 'application/zip',
          ACL: 'private',
        };
        const upload = s3.upload(uploadParams);

        let processedFiles = 0;
        archive.on('progress', ({ entries }) => {
          processedFiles = entries.processed;
          const progress = Math.round((processedFiles / totalFiles) * 100);
          DownloadJob.updateOne({ jobId }, { progress }).catch((err) => {

          }
            // logger.error('Failed to update progress', { jobId, err })
          );
        });

        const batchSize = 100;
        for (let i = 0; i < forms.length; i += batchSize) {
          const batch = forms.slice(i, i + batchSize);
          for (const form of batch) {
            for (const file of form.files) {
              if (!file.key || typeof file.key !== 'string' || file.key.trim() === '') {
                // logger.warn('Skipping file with invalid key', {
                //   jobId,
                //   formId: form._id,
                //   fieldName: file.fieldName,
                //   originalName: file.originalName,
                // });
                continue;
              }
              try {
                const fileStream = s3.getObject({
                  Bucket: process.env.DO_SPACES_BUCKET,
                  Key: file.key,
                }).createReadStream();
                archive.append(fileStream, {
                  name: `${form.serialNumber}_${file.originalName.replace(/[^a-zA-Z0-9.-]/g, '')}`,
                });
              } catch (err) {
                // logger.error('Failed to stream file', { jobId, key: file.key, err: err.message });
                continue;
              }
            }
          }
        }

        archive.on('error', (err) => {
          // logger.error('Archiver error', { jobId, err: err.message });
          throw err;
        });

        archive.finalize();
        await upload.promise();
        // logger.info('ZIP uploaded to Spaces', { jobId, zipKey });

        const zipUrl = await s3.getSignedUrlPromise('getObject', {
          Bucket: process.env.DO_SPACES_BUCKET,
          Key: zipKey,
          Expires: 7 * 24 * 3600,
        });

        await DownloadJob.updateOne(
          { jobId },
          {
            status: 'completed',
            progress: 100,
            zipUrl,
            expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
          }
        );
        // logger.info('Download job completed', { jobId, sessionId });
      } catch (error) {
        // logger.error('ZIP generation failed', { jobId, error: error.message });
        await DownloadJob.updateOne({ jobId }, {
          status: 'failed',
          errorMessage: error.message || 'Failed to generate ZIP',
        });
      }
    });

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: 'Download job initiated',
      data: { jobId },
    });
  } catch (error) {
    // logger.error('Download initiation error', { error: error.message });
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: 'Internal server error',
      errorCode: 'SERVER_ERROR',
    });
  }
};

// Download files by fieldName for a session old
// exports.downloadFilesByField = async (req, res) => {
//   try {
//     const { sessionId, fieldName } = req.query;
//     const user = req.user;

//     if (!sessionId || !fieldName) {
//       logger.warn('Missing sessionId or fieldName', { userId: user._id });
//       return res.status(httpsStatusCode.BadRequest).json({
//         success: false,
//         message: 'sessionId and fieldName are required',
//         errorCode: 'FIELD_MISSING',
//       });
//     }

//     // Validate session
//     const session = await sessionModel.findById(sessionId);
//     if (!session) {
//       return res.status(httpsStatusCode.NotFound).json({
//         success: false,
//         message: message.lblSessionNotFound,
//         errorCode: 'SESSION_NOT_FOUND',
//       });
//     }

//     // Create download job
//     const jobId = uuidv4();
//     await DownloadJob.create({
//       jobId,
//       sessionId,
//       userId: user._id,
//       fieldName,
//       status: 'pending',
//       progress: 0,
//       expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
//       // expiresAt: new Date(Date.now() + 2 * 60 * 1000)
//     });
//     // console.log('Download job initiated', { jobId, sessionId, fieldName });

//     // Process download asynchronously
//     setImmediate(async () => {
//       try {
//         await DownloadJob.updateOne({ jobId }, { status: 'processing' });
//         // console.log('Started ZIP generation', { jobId, sessionId, fieldName });

//         // Fetch forms with matching files (case-insensitive)
//         const newForms = await formDataModel
//           .find({
//             sessionId,
//             'files.fieldName': { $regex: `^${fieldName}$`, $options: 'i' },
//           })
//           .lean();


//         const forms = newForms.map((item) => {
//           const files = item.files;
//           const newFiles = files.map((f) => {
//             return {
//               ...f,
//               key: commonFunction.getRelativeFilePath(f?.fileUrl)
//             }
//           });
//           // console.log("newFiles", newFiles);
//           return {
//             ...item,
//             files: [...newFiles]
//           }
//         });

//         // console.log("newForms", newForms);
//         // console.log("forms", forms);

//         const newFiles = forms
//           .flatMap((form) => form.files)
//           .filter((file) => file.fieldName.toLowerCase() === fieldName.toLowerCase());

//         const files = newFiles.map((item) => {
//           return { ...item, key: commonFunction.getRelativeFilePath(item?.fileUrl) }
//         });

//         // console.log("files", files);
//         const totalFiles = files.length;

//         if (totalFiles === 0) {
//           await DownloadJob.updateOne({ jobId }, {
//             status: 'failed',
//             errorMessage: 'No files found for the specified field',
//           });
//           // console.log('No files found for field', { jobId, sessionId, fieldName });
//           return;
//         }

//         // Create ZIP archive
//         const zipKey = `temp/zips/${jobId}_${fieldName}.zip`;
//         const archive = archiver('zip', { zlib: { level: 9 } });
//         const passThrough = new PassThrough();

//         const uploadParams = {
//           Bucket: process.env.DO_SPACES_BUCKET,
//           Key: zipKey,
//           Body: passThrough,
//           ContentType: 'application/zip',
//           ACL: 'private',
//         };
//         const upload = s3.upload(uploadParams);
//         archive.pipe(passThrough);
//         // Track progress
//         let processedFiles = 0;
//         archive.on('progress', async ({ entries }) => {
//           processedFiles = entries.processed;
//           const progress = Math.round((processedFiles / totalFiles) * 100);
//           await DownloadJob.updateOne({ jobId }, { progress }).catch((err) => {
//             // console.log('Failed to update progress', { jobId, err })

//           }
//           );
//         });

//         // Add files to ZIP in batches
//         const batchSize = 100;
//         for (let i = 0; i < files.length; i += batchSize) {
//           const batch = files.slice(i, i + batchSize);
//           // console.log("batch", batch);

//           for (const file of batch) {
//             if (!file.key || typeof file.key !== 'string' || file.key.trim() === '') {
//               console.log('Skipping file with invalid key', {
//                 jobId,
//                 formId: file._id,
//                 fieldName: file.fieldName,
//                 originalName: file.originalName,
//               });
//               continue;
//             }
//             try {
//               const form = forms.find((f) =>
//                 f.files.some((f) => f.key === file.key)
//               );
//               const fileStream = s3.getObject({
//                 Bucket: process.env.DO_SPACES_BUCKET,
//                 Key: file.key,
//               }).createReadStream();
//               // old
//               // archive.append(fileStream, {
//               //   name: `${form.serialNumber}_${file.originalName.replace(/[^a-zA-Z0-9.-]/g, '')}`,
//               // });

//               // new


//               const name = file.fileUrl.substring(file.fileUrl.lastIndexOf('/') + 1);
//               archive.append(fileStream, {
//                 name: `${name}`,
//               });


//             } catch (err) {
//               console.log('Failed to stream file', { jobId, key: file.key, err: err.message });
//               continue;
//             }
//           }
//         }

//         // Handle archiver errors
//         archive.on('error', (err) => {
//           console.log('Archiver error', { jobId, err: err.message });
//           throw err;
//         });

//         // Finalize ZIP
//         archive.finalize();
//         await upload.promise();
//         console.log('ZIP uploaded to Spaces', { jobId, zipKey, fieldName });

//         // Generate signed URL (7-day expiry)
//         const zipUrl = await s3.getSignedUrlPromise('getObject', {
//           Bucket: process.env.DO_SPACES_BUCKET,
//           Key: zipKey,
//           Expires: 7 * 24 * 3600,
//         });

//         // Update job status
//         await DownloadJob.updateOne(
//           { jobId },
//           {
//             status: 'completed',
//             progress: 100,
//             zipUrl,
//             expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
//           }
//         );
//         // console.log('Download job completed', { jobId, sessionId, fieldName });
//       } catch (error) {
//         console.log("error", error);

//         // console.log('ZIP generation failed', { jobId, error: error.message });
//         await DownloadJob.updateOne({ jobId }, {
//           status: 'failed',
//           errorMessage: error.message || 'Failed to generate ZIP',
//         });
//       }
//     });

//     return res.status(httpsStatusCode.OK).json({
//       success: true,
//       message: 'Download job initiated',
//       data: { jobId },
//     });
//   } catch (error) {
//     console.log('Download initiation error', { error: error.message });
//     return res.status(httpsStatusCode.InternalServerError).json({
//       success: false,
//       message: 'Internal server error',
//       errorCode: 'SERVER_ERROR',
//     });
//   }
// };

// Download files by fieldName for a session new
// exports.downloadFilesByField = async (req, res) => {
//   try {
//     const { sessionId, fieldName, uniqueId } = req.query;
//     const user = req.user;

//     console.log("uniqueId", uniqueId);

//     if (!sessionId || !fieldName) {
//       // logger.warn('Missing sessionId or fieldName', { userId: user._id });
//       return res.status(httpsStatusCode.BadRequest).json({
//         success: false,
//         message: 'sessionId and fieldName are required',
//         errorCode: 'FIELD_MISSING',
//       });
//     }

//     // Validate session
//     const session = await sessionModel.findById(sessionId);
//     if (!session) {
//       // logger.warn('Session not found', { sessionId });
//       return res.status(httpsStatusCode.NotFound).json({
//         success: false,
//         message: message.lblSessionNotFound,
//         errorCode: 'SESSION_NOT_FOUND',
//       });
//     }

//     // Fetch forms with matching files (case-insensitive)
//     const forms = await formDataModel
//       .find({
//         sessionId,
//         'files.fieldName': { $regex: `^${fieldName}$`, $options: 'i' },
//       })
//       .lean();


//     // const forms = newForms.map((item) => {
//     //   const files = item.files;
//     //   const newFiles = files.map((f) => {
//     //     return {
//     //       ...f,
//     //       key: commonFunction.getRelativeFilePath(f?.fileUrl)
//     //     }
//     //   });
//     //   // console.log("newFiles", newFiles);
//     //   return {
//     //     ...item,
//     //     files: [...newFiles]
//     //   }
//     // });

//     // // console.log("forms",forms);


//     // const newFiles = forms
//     //   .flatMap((form) => form.files)
//     //   .filter((file) => file.fieldName.toLowerCase() === fieldName.toLowerCase());

//     // const files = newFiles.map((item) => {
//     //   return { ...item, key: commonFunction.getRelativeFilePath(item?.fileUrl) }
//     // });
//     // const totalFiles = files.length;

//     // console.log("totalFiles",totalFiles);

//     // Extract files and add relative key
//     const files = forms
//       .flatMap((form) => form.files)
//       .filter((file) => file.fieldName.toLowerCase() === fieldName.toLowerCase())
//       .map((file) => ({
//         ...file,
//         key: commonFunction.getRelativeFilePath(file?.fileUrl) || file.key, // Fallback to file.key if function fails
//       }))
//       .filter((file) => file.key && typeof file.key === 'string' && file.key.trim() !== '');

//     const totalFiles = files.length;

//     console.log("totalFiles", totalFiles);
//     console.log("files",files);



//     if (totalFiles === 0) {
//       // logger.warn('No files found for field', { sessionId, fieldName });
//       return res.status(httpsStatusCode.NotFound).json({
//         success: false,
//         message: 'No files found for the specified field',
//         errorCode: 'NO_FILES_FOUND',
//       });
//     }

//     // Create download job for progress tracking
//     const jobId = uniqueId;
//     await DownloadJob.create({
//       jobId,
//       sessionId,
//       userId: user._id,
//       fieldName,
//       status: 'pending',
//       progress: 0,
//       expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
//     });
//     console.log('Download job initiated', { jobId, sessionId, fieldName, totalFiles });

//     req.app.get('emitProgressUpdate')(jobId);

//     // Set response headers for streaming
//     const zipFileName = `${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.zip`;
//     res.set({
//       'Content-Type': 'application/zip',
//       'Content-Disposition': `attachment; filename="${zipFileName}"`,
//       'Transfer-Encoding': 'chunked',
//       'X-Job-Id': jobId, // For frontend to poll progress
//       'Access-Control-Expose-Headers': 'X-Job-Id',
//     });



//     // console.log("response", res);


//     // Create ZIP archive
//     const archive = archiver('zip', {
//       zlib: { level: 9 },
//       highWaterMark: 128 * 1024, // 128KB buffer for backpressure
//     });

//     // Backpressure transform stream
//     const backpressureTransform = new Transform({
//       highWaterMark: 512 * 1024,
//       transform(chunk, encoding, callback) {
//         const bufferSize = this.writableLength;
//         if (bufferSize > 1024 * 1024) { // 1MB threshold
//           console.log('Backpressure detected', { jobId, bufferSize });
//           setTimeout(() => callback(null, chunk), 100); // Longer pause
//         } else {
//           callback(null, chunk);
//         }
//       },
//     });

//     // Track progress old
//     let processedFiles = 0;

//     archive.on('progress', ({ entries }) => {
//       processedFiles = entries.processed;
//       console.log("processedFiles", entries.processed);

//       const progress = Math.round((processedFiles / totalFiles) * 100);
//       req.app.get('emitProgresLive')({ jobId: jobId, userId: user._id.toString(), status: "processing", progress: progress, fieldName: fieldName, errorMessage: "None" });
//       if (progress == 100) {
//         DownloadJob.updateOne({ jobId }, { progress, status: "completed" })
//           .catch((err) => console.log('Failed to update progress', { jobId, err: err.message }));
//         req.app.get('emitProgressUpdate')(jobId);
//       }

//     });



//     // console.log("processedFiles",processedFiles);


//     // Handle stream errors
//     archive.on('error', (err) => {
//       console.error('Archiver error', { jobId, err: err.message });
//       DownloadJob.updateOne({ jobId }, {
//         status: 'failed',
//         errorMessage: err.message || 'Failed to generate ZIP',
//       }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
//       req.app.get('emitProgressUpdate')(jobId);
//       if (!res.headersSent) {
//         res.status(httpsStatusCode.InternalServerError).json({
//           success: false,
//           message: 'Failed to generate ZIP',
//           errorCode: 'ZIP_GENERATION_FAILED',
//         });
//       } else {
//         res.destroy();
//       }
//     });

//     // Handle client disconnection
//     req.on('close', () => {
//       console.log('Client disconnected during download', { jobId });
//       archive.abort();
//       DownloadJob.updateOne({ jobId }, {
//         status: 'failed',
//         errorMessage: 'Download cancelled by client',
//       }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
//       req.app.get('emitProgressUpdate')(jobId);
//     });

//     // Start streaming
//     await DownloadJob.updateOne({ jobId }, { status: 'processing' });
//     req.app.get('emitProgressUpdate')(jobId);
//     // logger.info('Started ZIP streaming', { jobId, sessionId, fieldName });

//     // Pipe archive through backpressure transform
//     pipeline(archive, backpressureTransform, res, (err) => {
//       if (err) {
//         console.error('Pipeline error', { jobId, err: err.message });
//         DownloadJob.updateOne({ jobId }, {
//           status: 'failed',
//           errorMessage: err.message || 'Streaming failed',
//         }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
//         req.app.get('emitProgressUpdate')(jobId);
//       }
//     });

//     const batchSize = 5; // Increased for better throughput
//     for (let i = 0; i < files.length; i += batchSize) {
//       const batch = files.slice(i, i + batchSize);
//       console.log('batch', batch);

//       await Promise.all(
//         batch.map(async (file) => {
//           if (!file.key || typeof file.key !== 'string' || file.key.trim() === '') {
//             console.log('Skipping file with invalid key', {
//               jobId,
//               formId: file._id,
//               fieldName: file.fieldName,
//               originalName: file.originalName,
//             });
//             return;
//           }

//           for (let attempt = 1; attempt <= 5; attempt++) {
//             try {
//               const fileStream = s3.getObject({
//                 Bucket: process.env.DO_SPACES_BUCKET,
//                 Key: file.fileUrl,
//               }).createReadStream();

//               fileStream.on('error', (err) => {
//                 console.log("err", err);

//                 console.error('File stream error', { jobId, key: file.key, attempt, err: err.message });
//               });

//               const name = file.fileUrl.substring(file.fileUrl.lastIndexOf('/') + 1);
//               archive.append(fileStream, { name });
//               break; // Success, exit retry loop
//             } catch (err) {
//               console.error('Failed to stream file', { jobId, key: file.key, attempt, err: err.message });
//               if (attempt === 3) {
//                 console.error('Max retries reached for file', { jobId, key: file.key });
//               }
//               await new Promise((resolve) => setTimeout(resolve, 500 * attempt)); // Exponential backoff
//             }
//           }
//         })
//       );

//       // Dynamic backpressure delay
//       if (i + batchSize < files.length) {
//         await new Promise((resolve) => {
//           const checkBackpressure = () => {
//             if (backpressureTransform.writableLength < 1024 * 1024) {
//               resolve();
//             } else {
//               setTimeout(checkBackpressure, 50);
//             }
//           };
//           checkBackpressure();
//         });
//       }
//     }

//     // Finalize ZIP
//     archive.finalize()
//       .then(() => {
//         console.log('ZIP streaming completed', { jobId, fieldName, processedFiles });
//         DownloadJob.updateOne({ jobId }, {
//           status: 'completed',
//           progress: 100,
//         }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
//         req.app.get('emitProgressUpdate')(jobId);
//       })
//       .catch((err) => {
//         console.error('ZIP finalization failed', { jobId, err: err.message });
//         DownloadJob.updateOne({ jobId }, {
//           status: 'failed',
//           errorMessage: err.message || 'Failed to finalize ZIP',
//         }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
//         req.app.get('emitProgressUpdate')(jobId);
//       });

//     // Monitor memory usage periodically
//     const memoryInterval = setInterval(() => {
//       const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
//       // console.log('Memory usage during streaming', { jobId, memoryMB: memoryUsage.toFixed(2) });
//       if (memoryUsage > 1000) {
//         console.warn('High memory usage detected', { jobId, memoryMB: memoryUsage.toFixed(2) });
//       }
//     }, 5000);

//     archive.on('end', () => clearInterval(memoryInterval));
//     archive.on('error', () => clearInterval(memoryInterval));
//     req.on('close', () => clearInterval(memoryInterval));

//     //  return res.status(httpsStatusCode.OK).json({
//     //     success: true,
//     //     message: 'success',
//     //     errorCode: 'SUCCESS',
//     //   });

//   } catch (error) {
//     console.log('Download initiation error', { error: error.message });
//     if (!res.headersSent) {
//       return res.status(httpsStatusCode.InternalServerError).json({
//         success: false,
//         message: 'Internal server error',
//         errorCode: 'SERVER_ERROR',
//       });
//     }
//   }
// };


// new 2
exports.downloadFilesByField = async (req, res) => {
  try {
    const { sessionId, fieldName, uniqueId } = req.query;
    const user = req.user;

    console.log("uniqueId", uniqueId);

    if (!sessionId || !fieldName) {
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'sessionId and fieldName are required',
        errorCode: 'FIELD_MISSING',
      });
    }

    // Validate session
    const session = await sessionModel.findById(sessionId);
    if (!session) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: 'SESSION_NOT_FOUND',
      });
    }

    // Fetch forms with matching files (case-insensitive)
    const forms = await formDataModel
      .find({
        sessionId,
        'files.fieldName': { $regex: `^${fieldName}$`, $options: 'i' },
      })
      .lean();



    // Extract files and ensure correct key
    const files = forms
      .flatMap((form) => form.files)
      .filter((file) => file.fieldName.toLowerCase() === fieldName.toLowerCase())
      .map((file) => ({
        ...file,
        key: file.key.startsWith('billionforms-files/')
          ? file.key.replace(/^billionforms-files\//, '')
          : file.key, // Remove incorrect bucket prefix if present
      }))
      .filter((file) => file.key && typeof file.key === 'string' && file.key.trim() !== '');

    const totalFiles = files.length;

    console.log("totalFiles", totalFiles);
    console.log("files", files);

    if (totalFiles === 0) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: 'No files found for the specified field',
        errorCode: 'NO_FILES_FOUND',
      });
    }

    // Create download job for progress tracking
    const jobId = uniqueId;
    await DownloadJob.create({
      jobId,
      sessionId,
      userId: user._id,
      fieldName,
      status: 'pending',
      progress: 0,
      expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
    });
    console.log('Download job initiated', { jobId, sessionId, fieldName, totalFiles });

    req.app.get('emitProgressUpdate')(jobId);

    // Set response headers for streaming
    const zipFileName = `${fieldName.replace(/[^a-zA-Z0-9]/g, '_')}_${Date.now()}.zip`;
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipFileName}"`,
      'Transfer-Encoding': 'chunked',
      'X-Job-Id': jobId,
      'Access-Control-Expose-Headers': 'X-Job-Id',
    });

    // Create ZIP archive
    const archive = archiver('zip', {
      zlib: { level: 9 },
      highWaterMark: 128 * 1024,
    });

    // Backpressure transform stream
    const backpressureTransform = new Transform({
      highWaterMark: 512 * 1024,
      transform(chunk, encoding, callback) {
        const bufferSize = this.writableLength;
        if (bufferSize > 1024 * 1024) {
          console.log('Backpressure detected', { jobId, bufferSize });
          setTimeout(() => callback(null, chunk), 100);
        } else {
          callback(null, chunk);
        }
      },
    });

    // Track progress
    let processedFiles = 0;

    archive.on('progress', ({ entries }) => {
      processedFiles = entries.processed;
      console.log("processedFiles", entries.processed);

      const progress = Math.round((processedFiles / totalFiles) * 100);
      req.app.get('emitProgresLive')({
        jobId,
        userId: user._id.toString(),
        status: "processing",
        progress,
        fieldName,
        errorMessage: "None",
      });
      if (progress === 100) {
        DownloadJob.updateOne({ jobId }, { progress, status: "completed" })
          .catch((err) => console.log('Failed to update progress', { jobId, err: err.message }));
        req.app.get('emitProgressUpdate')(jobId);
      }
    });

    // Handle stream errors
    archive.on('error', (err) => {
      console.error('Archiver error', { jobId, err: err.message });
      DownloadJob.updateOne({ jobId }, {
        status: 'failed',
        errorMessage: err.message || 'Failed to generate ZIP',
      }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
      req.app.get('emitProgressUpdate')(jobId);
      if (!res.headersSent) {
        res.status(httpsStatusCode.InternalServerError).json({
          success: false,
          message: 'Failed to generate ZIP',
          errorCode: 'ZIP_GENERATION_FAILED',
        });
      } else {
        res.destroy();
      }
    });

    // Handle client disconnection
    req.on('close', () => {
      console.log('Client disconnected during download', { jobId });
      archive.abort();
      DownloadJob.updateOne({ jobId }, {
        status: 'failed',
        errorMessage: 'Download cancelled by client',
      }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
      req.app.get('emitProgressUpdate')(jobId);
    });

    // Start streaming
    await DownloadJob.updateOne({ jobId }, { status: 'processing' });
    req.app.get('emitProgressUpdate')(jobId);

    // Pipe archive through backpressure transform
    pipeline(archive, backpressureTransform, res, (err) => {
      if (err) {
        console.error('Pipeline error', { jobId, err: err.message });
        DownloadJob.updateOne({ jobId }, {
          status: 'failed',
          errorMessage: err.message || 'Streaming failed',
        }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
        req.app.get('emitProgressUpdate')(jobId);
      }
    });

    const batchSize = 5;
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      // console.log('batch', batch);

      await Promise.all(
        batch.map(async (file) => {
          if (!file.key || typeof file.key !== 'string' || file.key.trim() === '') {
            console.log('Skipping file with invalid key', {
              jobId,
              formId: file._id,
              fieldName: file.fieldName,
              originalName: file.originalName,
            });
            return;
          }

          for (let attempt = 1; attempt <= 5; attempt++) {
            try {
              // console.log('Fetching file from S3', { jobId, key: file.key, attempt });
              const fileStream = s3.getObject({
                Bucket: process.env.DO_SPACES_BUCKET,
                Key: file.key, // Use file.key instead of file.fileUrl
              }).createReadStream();

              fileStream.on('error', (err) => {
                console.error('File stream error', { jobId, key: file.key, attempt, err: err.message });
              });

              // const name = file.originalName || file.key.substring(file.key.lastIndexOf('/') + 1);
              const name = file.key.substring(file.key.lastIndexOf('/') + 1);

              archive.append(fileStream, { name });
              break; // Success, exit retry loop
            } catch (err) {
              console.error('Failed to stream file', { jobId, key: file.key, attempt, err: err.message });
              if (attempt === 5) {
                console.error('Max retries reached for file', { jobId, key: file.key });
              }
              await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
            }
          }
        })
      );

      // Dynamic backpressure delay
      if (i + batchSize < files.length) {
        await new Promise((resolve) => {
          const checkBackpressure = () => {
            if (backpressureTransform.writableLength < 1024 * 1024) {
              resolve();
            } else {
              setTimeout(checkBackpressure, 50);
            }
          };
          checkBackpressure();
        });
      }
    }

    // Finalize ZIP
    archive.finalize()
      .then(() => {
        console.log('ZIP streaming completed', { jobId, fieldName, processedFiles });
        DownloadJob.updateOne({ jobId }, {
          status: 'completed',
          progress: 100,
        }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
        req.app.get('emitProgressUpdate')(jobId);
      })
      .catch((err) => {
        console.error('ZIP finalization failed', { jobId, err: err.message });
        DownloadJob.updateOne({ jobId }, {
          status: 'failed',
          errorMessage: err.message || 'Failed to finalize ZIP',
        }).catch((err) => console.error('Failed to update job status', { jobId, err: err.message }));
        req.app.get('emitProgressUpdate')(jobId);
      });

    // Monitor memory usage
    const memoryInterval = setInterval(() => {
      const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;
      console.log('Memory usage during streaming', { jobId, memoryMB: memoryUsage.toFixed(2) });
      if (memoryUsage > 1000) {
        console.warn('High memory usage detected', { jobId, memoryMB: memoryUsage.toFixed(2) });
      }
    }, 5000);

    archive.on('end', () => clearInterval(memoryInterval));
    archive.on('error', () => clearInterval(memoryInterval));
    req.on('close', () => clearInterval(memoryInterval));

  } catch (error) {
    console.error('Download initiation error', { error: error.message });
    if (!res.headersSent) {
      return res.status(httpsStatusCode.InternalServerError).json({
        success: false,
        message: 'Internal server error',
        errorCode: 'SERVER_ERROR',
      });
    }
  }
};
// Check job status
exports.getDownloadStatus = async (req, res) => {
  try {
    const { jobId } = req.query;
    const user = req.user;
    if (!jobId) {
      // logger.warn('Missing jobId', { userId: user._id });
      return res.status(httpsStatusCode.BadRequest).json({
        success: false,
        message: 'jobId is required',
        errorCode: 'FIELD_MISSING',
      });
    }

    const job = await DownloadJob.findOne({ jobId, userId: user._id });
    if (!job) {
      // logger.warn('Download job not found', { jobId, userId: user._id });
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: 'Download job not found',
        errorCode: 'JOB_NOT_FOUND',
      });
    }

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: 'Download job status',
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        zipUrl: job.status === 'completed' ? job.zipUrl : null,
        fieldName: job.fieldName,
        errorMessage: job.errorMessage,
      },
    });
  } catch (error) {
    // logger.error('Status check error', { error: error.message });
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: 'Internal server error',
      errorCode: 'SERVER_ERROR',
    });
  }
};


// ---------- custom form file download controller starts here -------------

