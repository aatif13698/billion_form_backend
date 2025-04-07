
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
    console.log("1111");
    
    let filters = {
      // deletedAt: null,
      companyId: null,
      roleId: 2,
    };
    const [clients] = await Promise.all([
      User.find(filters)
    ]);

    console.log("2222", clients);


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




// get clients list with pagination

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
      User.find(filters).skip(skip).limit(limit).sort({ _id: -1 }).populate('companyId'),
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


// get individual client
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

// soft delete client
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


exports.activeInactive = async (req, res, next) => {
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

// get company with pagination
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
