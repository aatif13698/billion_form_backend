const Roles = require("../model/roles.model");
const User = require("../model/user.model");
const bcrypt = require("bcrypt");
require('dotenv').config();
const express = require('express');
const crypto = require('crypto')

const data = require("../utils/constants");
const companyModel = require("../model/company.model");
const httpsStatusCode = require("./https-status-code");
const SerialNumber = require("../model/serialNumber.model");
const accessModel = require("../model/access.model");
const userModel = require("../model/user.model");
const { log } = require("console");
const serialNumberModel = require("../model/serialNumber.model");
const CryptoJS = require("crypto-js")



const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;


async function insertRole() {
  Roles.countDocuments({})
    .exec()
    .then((count) => {
      if (count === 0) {
        // Insert predefined roles into the Role collection
        return Roles.insertMany(data.roles);
      } else {
        console.log("Roles already exist in the database.");
      }
    })
    .catch((err) => {
      console.error("Error:", err);
    })
    .finally(() => { });
}


async function insertSingleRole() {
  try {
    const roleName = "superAdminStaff";
    const roleId = 4;
    const existingRole = await Roles.findOne({name: roleName, id: roleId});
    if(existingRole){
      console.log(`${roleName} role already exists.`);
      return 
    }

    const newRole = await Roles.create({
      id: roleId,
      name: roleName
    });
    console.log(`${roleName} created successfully.`);
  } catch (error) {
    console.log("error while inserting single role", error);
  }
}

async function insertSerialNumber() {
  SerialNumber.countDocuments({})
    .exec()
    .then((count) => {
      if (count === 0) {
        // Insert predefined roles into the Role collection
        return SerialNumber.insertMany(data.serialNumber);
      } else {
        console.log("Serial Number already exist in the database.");
      }
    })
    .catch((err) => {
      console.error("Error in inserting serial number:", err);
    })
}

async function createSuperAdmin() {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const phone = process.env.SUPER_ADMIN_PHONE;

    const isSuperAdminExists = await User.findOne({
      $or: [{ phone: phone }, { email: email }],
    });

    if (isSuperAdminExists) {
      console.log("Super admin credentials already exists");
      return;
    }

    const role = await Roles.findOne({ id: 1 });

    const hash = bcrypt.hashSync(password, 10);

    await User.create({
      role: role._id,
      roleId: 1,
      firstName: "Super",
      lastName: "Admin",
      email: email,
      phone: phone,
      password: hash,
      isActive: true,
      isUserVerified: true,
      tc: true,
    });


    // Handling default company creation for super admin

    const companyName = process.env.SUPER_ADMIN_COMPANY_NAME;
    const subdomain = process.env.SUPER_ADMIN_SUB_DOMAIN_NAME;
    const adminEmail = process.env.SUPER_ADMIN_EMAIL;

    // Check if subdomain already exists
    const existing = await companyModel.findOne({ subDomain: subdomain });
    if (existing) {
      console.log({ message: 'Subdomain already taken' });
      // return res.status(httpsStatusCode.BadRequest).json({ error: 'Subdomain already taken' });
    }

    const password2 = crypto.randomBytes(8).toString('hex');

    // In dev, assign next available port
    const port = IS_DEV ? await getNextAvailablePort() : null;

    const newCompany = new companyModel({
      name: companyName,
      subDomain: subdomain.toLowerCase(),
      port,
      adminEmail,
      adminPassword: password2
    });

    await newCompany.save();

    // Email configuration
    const loginUrl = IS_DEV
      ? `http://localhost:${port}/login`
      : `http://${subdomain}.${BASE_DOMAIN}/login`;

    // In dev, start a new server instance for this company
    // if (IS_DEV) {
    //   startCompanyServer(port);
    // }

    console.log({ message: 'Company created successfully', url: loginUrl });


    console.log("super admin create successfully");
  } catch (error) {
    console.log("error in inserting super admin", error);
  }
}

// create access of super admin
async function createAccess() {
  try {
    const email = process.env.SUPER_ADMIN_EMAIL;
    const password = process.env.SUPER_ADMIN_PASSWORD;
    const phone = process.env.SUPER_ADMIN_PHONE;
    const user = await User.findOne({
      $or: [{ phone: phone }, { email: email }],
    });
    if (!user) {
      console.log("User credential not found", user);
      return;
    }

    // Handling default company creation for super admin
    const subdomain = process.env.SUPER_ADMIN_SUB_DOMAIN_NAME;

    // Check if subdomain already exists
    const company = await companyModel.findOne({ subDomain: subdomain });
    if (!company) {
      console.log({ message: 'company not found' });
      return;
    }

    const access = await accessModel.findOne({
      companyId: company._id
    });

    if (access) {
      console.log({ message: 'Access already exists' });
      return;
    }

    await accessModel.create({
      companyId: company._id,
      users: [user._id]
    });

    console.log("access created successfully!");


  } catch (error) {
    console.log("error in inserting super admin", error);
  }
}

const validateLoginInput = (req, res, next) => {
  const { identifier, password, rememberMe } = req.body;

  // Check if required fields are present
  if (!identifier || !password) {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "Identifier and password are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Define validation patterns
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const phoneRegex = /^\d{10}$/; // 10-digit phone number

  // Check if identifier is valid email or phone
  const isValidEmail = emailRegex.test(identifier);
  const isValidPhone = phoneRegex.test(identifier);

  // If identifier is neither a valid email nor a valid phone number
  if (!isValidEmail && !isValidPhone) {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "Identifier must be a valid email or 10-digit phone number",
      errorCode: "INVALID_IDENTIFIER",
    });
  }

  // Validate rememberMe if provided
  if (rememberMe !== undefined && typeof rememberMe !== "boolean") {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "rememberMe must be a boolean value",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Attach the type of identifier to the request object for later use
  req.identifierType = isValidEmail ? "email" : "phone";

  next();
};

const validateClientInput = (req, res, next) => {
  const { firstName, lastName, email, phone, password } = req.body;

  // Check if required fields are present
  if (!firstName || !lastName || !email || !phone || !password) {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "First Name, Last Name, Email, Phone and password are required",
      errorCode: "VALIDATION_ERROR",
    });
  }

  // Define validation patterns
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const phoneRegex = /^\d{10}$/; // 10-digit phone number

  // Check if identifier is valid email or phone
  const isValidEmail = emailRegex.test(email);
  const isValidPhone = phoneRegex.test(phone);

  // If identifier is neither a valid email nor a valid phone number
  if (!isValidEmail) {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "Email must be a valid email",
      errorCode: "INVALID_EMAIL",
    });
  }

  if (!isValidPhone) {
    return res.status(httpsStatusCode.BadRequest).json({
      success: false,
      message: "Phone must be a valid 10-digit phone number",
      errorCode: "INVALID_PHONE",
    });

  }
  next();
};

// const identifyCompany = async (req, res, next) => {
//   const host = req.headers.host;
//   const origin = req.headers.origin;
//   if (IS_DEV) {
//     // const port = parseInt(host.split(':')[1] || BASE_PORT);  
//     const port = parseInt(origin?.match(/\d{4}$/)[0] || BASE_PORT);
//     const company = await companyModel.findOne({ port });
//     req.company = company;
//   } else {

//     const domainParts = origin?.split('.');

//     // Check if it's at least a 3-part domain like sub.domain.tld
//     if (domainParts?.length >= 3) {
//       const subdomain = domainParts[0];
//       console.log("subdomain:", subdomain);
//       const aaa = extractPath(subdomain);
//       console.log("aaa:", aaa);

//       const company = await companyModel.findOne({ subDomain: aaa });
//       req.company = company;
//     } else {
//       console.log("No subdomain detected");
//       req.company = null;
//     }

//   }
//   // if (!req.company) {
//   //   return res.status(404).json({ error: 'Company not found' });
//   // }
//   next();
// };

// new
const identifyCompany = async (req, res, next) => {
  try {
    const host = req.headers.host;
    const origin = req.headers.origin;

    if (IS_DEV) {
      // Default to BASE_PORT if origin is missing or doesn't match the expected pattern
      let port = BASE_PORT;
      if (origin) {
        const match = origin.match(/\d{4}$/);
        if (match) {
          port = parseInt(match[0], 10);
        } else {
          console.warn(`Origin ${origin} does not contain a four-digit port`);
        }
      } else {
        console.warn('Origin header is missing in development mode');
      }

      const company = await companyModel.findOne({ port });
      if (!company) {
        console.warn(`No company found for port: ${port}`);
        return res.status(404).json({ error: 'Company not found' });
      }
      req.company = company;
    } else {
      if (!origin) {
        console.warn('Origin header is missing in production mode');
        return res.status(400).json({ error: 'Origin header required' });
      }

      const domainParts = origin.split('.');
      if (domainParts.length >= 3) {
        const subdomain = domainParts[0];
        console.log('subdomain:', subdomain);
        const aaa = extractPath(subdomain); // Ensure extractPath handles invalid input
        console.log('aaa:', aaa);

        const company = await companyModel.findOne({ subDomain: aaa });
        if (!company) {
          console.warn(`No company found for subdomain: ${aaa}`);
          return res.status(404).json({ error: 'Company not found' });
        }
        req.company = company;
      } else {
        console.log('No subdomain detected');
        return res.status(400).json({ error: 'Subdomain required' });
      }
    }

    next();
  } catch (error) {
    console.error('Error in identifyCompany:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// testing comment

function extractPath(url) {
  const match = url.match(/^https:\/\/(.+)$/);
  return match ? match[1] : null;
}


const restrictOtherCompany = async (req, res, next) => {
  const host = req.headers.host;
  const origin = req.headers.origin;
  if (IS_DEV) {
    // const port = parseInt(host.split(':')[1] || BASE_PORT);  
    const port = parseInt(origin?.match(/\d{4}$/)[0] || BASE_PORT);
    const company = await companyModel.findOne({ port });
    const access = await accessModel.findOne({ companyId: company?._id }).populate("users");
    if (!access) {
      return res.status(httpsStatusCode.NotFound).send({
        success: false,
        message: "Access not found",
        errorCode: "UNAUTHORIZED",
      })

    }

    console.log("access",access);
    
    const { identifier } = req.body;
    const identifierType = req.identifierType;
    const query = identifierType === "email"
      ? { email: identifier.toLowerCase() }
      : { phone: identifier };
    const user = await User.findOne(query)
      .populate("role")
      .select("_id email phone");

      console.log("user",user);
      

    const findUserAccess = access.users.filter((item) => {
      return item?._id?.toString() === user._id.toString();
    });
    if (findUserAccess.length == 0) {
      return res.status(403).json({ message: "User does not have access to this company" });
    }
    req.company = company;
  } else {
    const domainParts = origin?.split('.');

    if (domainParts?.length >= 3) {
      const subdomain = domainParts[0];
      console.log("subdomain:", subdomain);
      const aaa = extractPath(subdomain);
      console.log("aaa:", aaa);

      const company = await companyModel.findOne({ subDomain: aaa });
      const access = await accessModel.findOne({ companyId: company?._id }).populate("users");
      if (!access) {
        return res.status(httpsStatusCode.NotFound).send({
          success: false,
          message: "Access not found",
          errorCode: "UNAUTHORIZED",
        })
      }

      const { identifier } = req.body;
      const identifierType = req.identifierType;
      const query = identifierType === "email"
        ? { email: identifier.toLowerCase() }
        : { phone: identifier };
      const user = await User.findOne(query)
        .populate("role")
        .select("_id email phone");
        console.log("user",user);
        
      const findUserAccess = access.users.filter((item) => {
        return item?._id?.toString() === user?._id.toString();
      });
      if (findUserAccess?.length == 0) {
        return res.status(403).json({ message: "User does not have access to this company" });
      }
      req.company = company;
    } else {

      console.log("No subdomain detected");
      req.company = null;

      return res.status(403).json({ message: "No subdomain detected" });
      
    }

    // const subdomain = host.split('.')[0];
    // const company = await companyModel.findOne({ subdomain });
    // const access = await accessModel.findOne({ companyId: company?._id }).populate("users");
    // if (!access) {
    //   return res.status(httpsStatusCode.NotFound).send({
    //     success: false,
    //     message: "Access not found",
    //     errorCode: "UNAUTHORIZED",
    //   })

    // }
    // const { identifier } = req.body;
    // const identifierType = req.identifierType;
    // const query = identifierType === "email"
    //   ? { email: identifier.toLowerCase() }
    //   : { phone: identifier };
    // const user = await User.findOne(query)
    //   .populate("role")
    //   .select("_id email phone");
    // const findUserAccess = access.users.filter((item) => {
    //   return item?._id?.toString() === user._id.toString();
    // });
    // if (findUserAccess.length == 0) {
    //   return res.status(403).json({ message: "User does not have access to this company" });
    // }
    // req.company = company;
  }

  // if (!req.company) {
  //   return res.status(404).json({ error: 'Company not found' });
  // }
  next();
};

function startCompanyServer(port) {
  const companyApp = express();
  companyApp.use(express.json());
  companyApp.use(identifyCompany);


  companyApp.listen(port, () => {
    console.log(`Company server running on port ${port}`);
  });
}


// Helper function to find next available port
async function getNextAvailablePort() {
  const lastCompany = await companyModel.findOne().sort({ port: -1 });
  const prevPort = parseInt(lastCompany?.port || BASE_PORT)
  return prevPort + 1;
}


// async function getNextAvailablePort() {
//   const lastCompany = await companyModel.findOne().sort({ port: -1 });
//   return (lastCompany?.port || BASE_PORT) + 1;
// }



// get serial number
const getSerialNumber = async (collection) => {
  try {
    const result = await SerialNumber.findOneAndUpdate({ collectionName: collection }, { $inc: { nextNum: 1 } })
    if (result) {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const serialNumber = `AES-BF-${currentYear}-${result.prefix + result.nextNum}`
      return serialNumber
    }
    else {
      return null
    }
  } catch (error) {
    return null
  }
}


const getFileSerialNumber = async (collection) => {
  try {
    const result = await SerialNumber.findOneAndUpdate({ collectionName: collection }, { $inc: { nextNum: 1 } })
    if (result) {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      const serialNumber = result.nextNum;
      return serialNumber
    }
    else {
      return null
    }
  } catch (error) {
    return null
  }
}


// generate serial number

const generateASerialNumber = async function () {
  try {
    const dataObject = {
      collectionName: "fileSerialNumber",
      prefix: "FSN",
    }
    const isAlreadyExists = await serialNumberModel.findOne({ collectionName: dataObject?.collectionName });
    if (isAlreadyExists) {
      console.log("Serial number already exists");
      return
    }
    const created = await serialNumberModel.create(dataObject);
    console.log("serial number created successfully!");
  } catch (error) {
    console.log("error in inserting serial number", error);
  }
}


const calculateEndDate = function (validityPeriod) {
  const startDate = new Date();
  switch (validityPeriod) {
    case 'monthly':
      return new Date(startDate.setMonth(startDate.getMonth() + 1));
    case 'quarterly':
      return new Date(startDate.setMonth(startDate.getMonth() + 3));
    case 'halfyearly':
      return new Date(startDate.setMonth(startDate.getMonth() + 6));
    case 'yearly':
      return new Date(startDate.setFullYear(startDate.getFullYear() + 1));
    case 'infinite':
      return null; // No end date for infinite plans
    default:
      return null;
  }
}



// Secret key for encryption (store this securely in .env in production)
const SECRET_KEY = process.env.ENCRYPTION_KEY || "my-secret-key";

const encryptId = (id) => {
  const encrypted = CryptoJS.AES.encrypt(id.toString(), SECRET_KEY).toString();
  // URL-safe encoding
  return encodeURIComponent(encrypted);
};



// function getRelativeFilePath(url) {
//   const baseUrl = "https://billionforms-files.blr1.digitaloceanspaces.com/";
//   return url.replace(baseUrl, '');
// }


const getRelativeFilePath = (fileUrl) => {
  if (!fileUrl || typeof fileUrl !== 'string') return null;
  try {
    const url = new URL(fileUrl);
    // Remove the leading '/' and return the path
    return url.pathname.replace(/^\//, '');
  } catch (error) {
    console.error('Error parsing file URL:', error.message);
    return null;
  }
};



async function updateRoleInDatbaseInstance() {
    try {
        const capability = data.defaultSuperAdminStaffPersmissionsList;
        const existing = await Roles.findOne({ id: 4 });
        if (existing) {
            existing.capability = capability;
            existing.name = "staff";
            await existing.save();
            console.log("Role Updatedn successfully...");
        } else {
            console.log("role not found");
        }
    } catch (error) {
        console.log("error while creating the petient", error);
    }
}


 const getSerialNumberValue = (serialNumber) => {
      if (typeof serialNumber !== 'string') return 0;
      const match = serialNumber.match(/^AES-BF-25-FM(\d+)$/);
      return match ? parseInt(match[1], 10) : 0;
    };


// Export the functions
module.exports = {
  insertRole,
  createSuperAdmin,
  validateLoginInput,
  startCompanyServer,
  identifyCompany,
  getNextAvailablePort,
  validateClientInput,
  insertSerialNumber,
  getSerialNumber,
  generateASerialNumber,
  getFileSerialNumber,
  restrictOtherCompany,
  createAccess,
  calculateEndDate,
  encryptId,
  insertSingleRole,
  getRelativeFilePath,
  updateRoleInDatbaseInstance,
  getSerialNumberValue
};