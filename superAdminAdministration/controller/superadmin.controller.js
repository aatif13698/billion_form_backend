
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
      path : 'subscription.subscriptionId',
      select : '-subscribers'
    }).populate({
      path : "userId",
      select : "firstName lastName email phone _id"
    })
    .populate({
      path : 'topup.topupId',
      select : '-subscribers'
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



// update Organization
exports.updateOrganization = async (req, res, next) => {
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

// list organization
exports.getOrganizationList = async (req, res, next) => {
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

// get all organization
exports.getAllOrganization = async (req, res, next) => {
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


