

const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();
const superAdminController = require("../controller/superadmin.controller");
const { validateLoginInput, startCompanyServer, validateClientInput, getSerialNumber } = require("../../utils/commonFunction");
const { superAdminAuth, superAdminAndClientAuth } = require("../../middleware/authorization/superAdmin");
const customFieldModel = require("../../model/customField.model");
const companyModel = require("../../model/company.model");
const userModel = require("../../model/user.model");
const accessModel = require("../../model/access.model");

const { uploadImages, uploadCustomForm } = require("../../utils/multer")

const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");
const multer = require("multer");
const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;


// --------- company routes starts here -------------------

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
    const port = await getNextAvailablePort();
    const serial = await getSerialNumber("company");
    const newCompany = new companyModel({
      serialNumber: serial,
      name: name,
      subDomain: subDomain.toLowerCase().trim(),
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
});

// update company
router.post('/update-company', superAdminController.updateCompany);

router.delete('/softdelete-company', superAdminAuth, superAdminController.softDeleteCompany);

router.post('/restore-company', superAdminAuth, superAdminController.restoreCompany);

router.get('/get/company', superAdminAuth, superAdminController.getCompanyList);

router.get('/get/company/:id', superAdminAuth, superAdminController.getCompany);

router.post("/activeInactive/company", superAdminAuth, superAdminController.activeInactiveCompany);

// Helper function to find next available port
async function getNextAvailablePort() {
  const lastCompany = await companyModel.findOne().sort({ port: -1 });
  return (lastCompany?.port || BASE_PORT) + 1;
}

// --------- company routes ends here -------------------



// Super Admin Login API
router
  .route("/login")
  .post(validateLoginInput, superAdminController.login);


// --------- clients routes starts here -------------------

router.route("/create/cleint").post(validateClientInput, superAdminController.createClient);

router.post('/update/client', superAdminAuth, superAdminController.updateClient);

router.get('/get/client', superAdminAuth, superAdminController.getClientsList);

router.get('/get/client/:id', superAdminAuth, superAdminController.getIndividualClient);

router.delete('/softdelete/client', superAdminAuth, superAdminController.softDeleteClient);

router.post('/restore/client', superAdminAuth, superAdminController.restoreClient);

router.post("/activeInactive/client", superAdminAuth, superAdminController.activeInactiveClient);

router.get('/get/client/by-status/notsetuped', superAdminAuth, superAdminController.getClients);

router.get('/get/all/client', superAdminAuth, superAdminController.getAllClients);



// --------- company routes ends here -------------------



// --------- subscription routes start here -------------------

router.post("/create/subscription", superAdminAuth, superAdminController.createSubscription);

router.post('/update/subscription', superAdminAuth, superAdminController.updateSubscription);

router.get('/get/subscription/list', superAdminAuth, superAdminController.getSubscriptionPlanList);

router.get('/get/all/subscription', superAdminAuth, superAdminController.getAllSubscriptionPlan);

router.post("/activeInactive/subscription", superAdminAuth, superAdminController.activeInactiveSubscription);

router.get('/get/subscription/:id', superAdminAuth, superAdminController.getIndividualSubscriptionPlan);

router.delete('/softdelete/subscription', superAdminAuth, superAdminController.softDeleteSubscriptionPlan);

router.post('/restore/subscription', superAdminAuth, superAdminController.restoreSubscriptionPlan);



// --------- subscription routes ends here -------------------


// --------- topup routes starts here ---------

router.post("/create/topup", superAdminAuth, superAdminController.createTopup);

router.post('/update/topup', superAdminAuth, superAdminController.updateTopup);

router.get('/get/topup/list', superAdminAuth, superAdminController.getTopupList);

router.get('/get/all/topup', superAdminAuth, superAdminController.getAllTopupPlan);


router.post("/activeInactive/topup", superAdminAuth, superAdminController.activeInactiveTopup);

router.get('/get/topup/:id', superAdminAuth, superAdminController.getIndividualTopup);

router.delete('/softdelete/topup', superAdminAuth, superAdminController.softDeleteTopup);

router.post('/restore/topup', superAdminAuth, superAdminController.restoretopup);

// --------- topup routes ends here ---------


// --------- subscribed user routes starts here ---------

router.post("/create/subscribed", superAdminAuth, superAdminController.createSubscsribed);

router.post("/create/assigntopup", superAdminAuth, superAdminController.createAssignTopup);

router.get('/get/subscribed/list', superAdminAuth, superAdminController.getListSubscsribed);

router.post("/activeInactive/subscribed", superAdminAuth, superAdminController.activeInactiveTopup);

router.get('/get/subscribed/:id', superAdminAuth, superAdminController.getParticularSubscsribedUser);



// --------- subscribed user routes ends here ---------


// --------- Organization routes starts here -------------------


router.post("/create/organization", superAdminAndClientAuth, (req, res, next) => {
  uploadImages.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // MulterError: File too large
        return res.status(httpsStatusCode.BadRequest).send({
          message: 'File too large. Maximum file size allowed is 2 MB.'
        });
      } else {
        // Other errors
        console.error('Multer Error:', err.message);
        return res.status(httpsStatusCode.BadRequest).send({
          message: err.message
        });
      }
    }
    next();
  });
}, superAdminController.createOrganization);


router.post("/update/organization", superAdminAndClientAuth, (req, res, next) => {
  uploadImages.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 }
  ])(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        // MulterError: File too large
        return res.status(httpsStatusCode.BadRequest).send({
          message: 'File too large. Maximum file size allowed is 2 MB.'
        });
      } else {
        // Other errors
        console.error('Multer Error:', err.message);
        return res.status(httpsStatusCode.BadRequest).send({
          message: err.message
        });
      }
    }
    next();
  });
}, superAdminController.updateOrganization);

router.get('/get/organization/all/:userId', superAdminAndClientAuth, superAdminController.getAllOrganization);

router.post("/activeInactive/organization", superAdminAndClientAuth, superAdminController.activeInactiveOrganization);

router.get('/get/organization/:id', superAdminAndClientAuth, superAdminController.getIndividualOrganization);


// --------- Organization routes ends here -------------------


// --------- Session route starts here ------------------

router.post("/create/session", superAdminAndClientAuth, superAdminController.createSession);

router.post("/update/session", superAdminAndClientAuth, superAdminController.updateSession);

router.delete("/delete/session", superAdminAndClientAuth, superAdminController.deleteSession);

router.post("/activeInactive/session",superAdminAndClientAuth, superAdminController.activeInactiveSession);

router.get('/get/session/all/:userId/:organizationId', superAdminAndClientAuth, superAdminController.getAllSession);

router.get('/get/session/:sessionId', superAdminAndClientAuth, superAdminController.getSession);

// --------- Session route ends here --------------------

// test

// --------- Custom Form route starts here ------------------

router.post('/create/field',superAdminAndClientAuth, superAdminController.createField);

router.delete('/delete/field/:userId/:sessionId/:fieldId',superAdminAndClientAuth, superAdminController.deleteField );

router.post("/update/order/field/:userId/:sessionId", superAdminAndClientAuth, superAdminController.updateFieldOrder);

router.get('/get/field/all/:userId/:sessionId', superAdminAndClientAuth, superAdminController.getAllFields);

router.get('/get/field/bysession/:sessionId', superAdminController.getAllFieldsBySession);

router.get('/get/field/data/:id', superAdminController.getFormData);

router.post('/check/password', superAdminController.checkPasword);

router.post('/create/form', uploadCustomForm.any(), superAdminController.submitForm);

router.post('/update/form/:formId', uploadCustomForm.any(), superAdminController.updateForm);

router.post('/login/form', superAdminController.loginToEditForm );

router.get('/get/all/forms/:sessionId', superAdminController.getAllFormsBySession);







// --------- Custom Form route ends here --------------------




// --------- custom form route starts here ------------------


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


// --------- custom form route starts here ------------------


exports.router = router;
