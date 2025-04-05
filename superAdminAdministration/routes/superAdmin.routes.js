

const express = require("express");
require('dotenv').config(); // Load environment variables first
const crypto = require("crypto");
const bcrypt = require("bcrypt")


const router = express.Router();

const superAdminController = require("../controller/superadmin.controller");
const { validateLoginInput, startCompanyServer, validateClientInput, getSerialNumber } = require("../../utils/commonFunction");

const { superAdminAuth } = require("../../middleware/authorization/superAdmin");
const customFieldModel = require("../../model/customField.model");
const companyModel = require("../../model/company.model");
const userModel = require("../../model/user.model");
const CustomError = require("../../utils/customError");
const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");

const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;


// handling base company of application
router.post('/create-company', async (req, res, next) => {
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
    const port = IS_DEV ? await getNextAvailablePort() : null;

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
    await user.save()

    // Email configuration
    const loginUrl = IS_DEV
      ? `http://localhost:${port}/login`
      : `http://${subDomain}.${BASE_DOMAIN}/login`;


    return res.status(httpsStatusCode.Created).json({ message: 'Company created successfully', url: loginUrl });
  } catch (error) {
    return res.status(httpsStatusCode.InternalServerError).json({ error: error.message });
  }
});

// update company
router.post('/update-company', async (req, res, next) => {
  try {
    const { companyId, name, subDomain, adminPassword } = req.body;

    console.log("req.body", req.body);


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
    company.subDomain = subDomain.toLowerCase();

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
    return res.status(httpsStatusCode.INTERNAL_SERVER_ERROR).json({
      error: 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

router.delete('/softdelete-company',superAdminAuth, superAdminController.softDeleteCompany);

router.post('/restore-company',superAdminAuth, superAdminController.restoreCompany);

// get company with pagination and filter
router.get('/get/company', superAdminAuth, superAdminController.getCompanyList);

// get company
router.get('/get/company/:id', superAdminAuth, superAdminController.getCompany);

// active inactive company
router.post("/activeInactive/company", superAdminAuth, superAdminController.activeInactiveCompany);

// Helper function to find next available port
async function getNextAvailablePort() {
  const lastCompany = await companyModel.findOne().sort({ port: -1 });
  return (lastCompany?.port || BASE_PORT) + 1;
}


// Super Admin Login API
router
  .route("/login")
  .post(validateLoginInput, superAdminController.login);


// create client
router.route("/create/cleint").post(validateClientInput, superAdminController.createClient);

// get clients
router.get('/get/client', superAdminAuth, superAdminController.getClientsList);

// active inactive client
router.post("/activeInactive/client", superAdminAuth, superAdminController.activeInactive);

// get client
router.get('/get/client/notsetuped', superAdminAuth, superAdminController.getClients)


// Create a new custom field
router.post('/custom-fields', superAdminAuth, async (req, res) => {
  try {
    const {
      name,
      label,
      type,
      options,
      isRequired,
      placeholder,
      validation,
      gridConfig
    } = req.body;

    // Basic validation
    if (!name || !label || !type) {
      return res.status(400).send({ error: 'Name, label, and type are required' });
    }

    // Check for duplicate field name (optional, depending on your requirements)
    const existingField = await customFieldModel.findOne({ name });
    if (existingField) {
      return res.status(400).send({ error: 'A field with this name already exists' });
    }

    // Validate gridConfig
    if (gridConfig) {
      if (gridConfig.span < 1 || gridConfig.span > 12) {
        return res.status(400).send({ error: 'Grid span must be between 1 and 12' });
      }
      if (typeof gridConfig.order !== 'number') {
        return res.status(400).send({ error: 'Grid order must be a number' });
      }
    }

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
    const customField = new customFieldModel({
      name,
      label,
      type,
      options: options || [],
      isRequired: isRequired || false,
      placeholder,
      validation: validation || {},
      gridConfig: gridConfig || { span: 12, order: 0 },
      createdBy: req.user._id
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
});

// get custom field
router.get('/custom-fields', superAdminAuth, async (req, res) => {
  try {
    const fields = await customFieldModel.find().populate('createdBy', 'username'); // Optional: populate createdBy
    res.status(200).send({ data: fields });
  } catch (error) {
    console.error('Error fetching custom fields:', error);
    res.status(500).send({ error: 'Internal server error', details: error.message });
  }
});



exports.router = router;
