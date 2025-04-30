
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
        .select('serialNumber firstName  isActive lastName email phone companyId _id')
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

// new

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

    // Handle uploaded files
    let logoPath = null;
    let bannerPath = null;

    if (req.files) {
      if (req.files.logo) {
        logoPath = `/images/${req.files.logo[0].filename}`;
      }
      if (req.files.banner) {
        bannerPath = `/images/${req.files.banner[0].filename}`;
      }
    }

    // Generate serial number
    const serial = await getSerialNumber("organization");

    // Create new organization
    const newOrganization = await organizationModel.create({
      userId: user._id,
      serialNumber: serial,
      name,
      captionText,
      address,
      email: email.toLowerCase(),
      phone,
      logo: logoPath,
      banner: bannerPath,
      isActive: true
    });

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

// update organization
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
    let logoPath = null;
    let bannerPath = null;
    if (req.files) {
      if (req.files.logo) {
        logoPath = `/images/${req.files.logo[0].filename}`;
      }
      if (req.files.banner) {
        bannerPath = `/images/${req.files.banner[0].filename}`;
      }
    }
    let dataOject = {
      name,
      captionText,
      address,
      email: email.toLowerCase(),
      phone,
    }
    if (logoPath) {
      dataOject.logo = logoPath
    }
    if (bannerPath) {
      dataOject.banner = bannerPath
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

    const { userId } = req.params;
    const [organizarions] = await Promise.all([
      organizationModel.find({ userId: userId }).sort({ _id: 1 }).lean(),
    ]);
    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblOrganizationFoundSuccessfully,
      data: {
        data: organizarions,
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

    console.log("req.body",req.body);
    
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
      password : hash ? hash : null,
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
    if(!sessionId){
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblSessionIdrequired,
        errorCode: "SESSION_ID_MISSING",
      });
    }
    if (!organizationId || !name || !forWhom || !isActive || !closeDate) {
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
    if(!session){
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
    if(hash){
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
    if(!sessionId){
      return res.status(httpsStatusCode.BadRequest).send({
        success: false,
        message: message.lblSessionIdrequired,
        errorCode: "SESSION_ID_MISSING",
      });
    }
    const session = await sessionModel.findById(sessionId);
    if(!session){
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: message.lblSessionNotFound,
        errorCode: "SESSION_NOT_FOUND",
      });
    }
    await sessionModel.findByIdAndUpdate({_id: sessionId},{
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

// active inactive session
exports.activeInactiveSession = async (req, res, next) => {
  try {
    const { status, sessionId,  } = req.body;
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
        session:session,
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

    if(!session){
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

    
    return  res.status(httpsStatusCode.OK).send({
      success: true,
      message: 'Continued successfully',
    });
  } catch (error) {
    console.error('Error checking form password:', error);
    res.status(500).send({ error: 'Internal server error', details: error.message });
  }
};


// submit form
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
    const otherThanFiles = {};
    const files = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (key !== "userId" && key !== "organizationId" && key !== "sessionId" && key !== "phone" && key !== "firstName") {
        otherThanFiles[key] = value;
      }
    }

    // console.log("req.body",req.body);

    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        files.push({
          fieldName: file.fieldname,
          fileUrl: `/public/customForm/${file.filename}`, // Correct path
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        });
      });
    } else {
      console.log("No files uploaded"); // Debug log
    }

    const serialNumber = await getSerialNumber("form");
    const password = `${firstName.substring(0, 2).toUpperCase()}${phone.substring(0, 3)}`;
    console.log("password",password);
    
    const formData = new formDataModel({
      serialNumber : serialNumber,
      password : password,
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

// update form
exports.updateForm = async (req, res, next) => {
  const session = await mongoose.startSession();
  try {
    const { formId } = req.params;
    const { userId, organizationId, sessionId, phone, firstName } = req.body;
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
    const formData = await formDataModel.findById(formId).session(session);
    if (!formData) {
      return res.status(httpsStatusCode.NotFound).json({
        success: false,
        message: message?.lblFormNotFound,
        errorCode: "NOT_FOUND",
      });
    }
    const otherThanFiles = {};
    const files = [];
    for (const [key, value] of Object.entries(req.body)) {
      if (key !== "userId" && key !== "organizationId" && key !== "sessionId") {
        otherThanFiles[key] = value;
      }
    }
    if (req.files && req.files.length > 0) {
      req.files.forEach((file) => {
        files.push({
          fieldName: file.fieldname,
          fileUrl: `/public/customForm/${file.filename}`, // Correct path
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        });
      });
    } else {
      console.log("No files uploaded"); // Debug log
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



// ---------- Custom form controller ends here -------------
