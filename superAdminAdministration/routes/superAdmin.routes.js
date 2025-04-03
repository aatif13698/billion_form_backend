

const express = require("express");
require('dotenv').config(); // Load environment variables first
const crypto = require("crypto")


const router = express.Router();

const superAdminController = require("../controller/superadmin.controller");
const { validateLoginInput, startCompanyServer, validateClientInput } = require("../../utils/commonFunction");

const { superAdminAuth } = require("../../middleware/authorization/superAdmin");
const customFieldModel = require("../../model/customField.model");
const companyModel = require("../../model/company.model");

const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;





// handling base company of application
router.post('/create-company', async (req, res) => {
  try {
    const { name, subDomain, adminEmail, adminPassword } = req.body;

    console.log("req.body", req.body);

    // Check if subdomain already exists
    const existing = await companyModel.findOne({ subDomain: subDomain });

    console.log("existing", existing);

    if (existing) {
      return res.status(400).json({ error: 'Subdomain already taken' });
    }

    const password = crypto.randomBytes(8).toString('hex');

    // In dev, assign next available port
    const port = IS_DEV ? await getNextAvailablePort() : null;

    const newCompany = new companyModel({
      name: name,
      subDomain: subDomain.toLowerCase(),
      port,
      adminEmail,
      adminPassword: adminPassword
    });

    await newCompany.save();

    // Email configuration
    const loginUrl = IS_DEV
      ? `http://localhost:${port}/login`
      : `http://${subDomain}.${BASE_DOMAIN}/login`;


    // In dev, start a new server instance for this company
    if (IS_DEV) {
      // startCompanyServer(port);
    }

    res.status(201).json({ message: 'Company created successfully', url: loginUrl });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});







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
router
  .route("/create/cleint")
  .post(validateClientInput, superAdminController.createClient);


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
