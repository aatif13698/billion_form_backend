

const express = require("express");
require('dotenv').config(); // Load environment variables first
const bcrypt = require("bcrypt")
const router = express.Router();
const superAdminController = require("../controller/superadmin.controller");
const { validateLoginInput, startCompanyServer, validateClientInput, getSerialNumber } = require("../../utils/commonFunction");
const { superAdminAuth, superAdminAndClientAuth } = require("../../middleware/authorization/superAdmin");
const entityAuth = require("../../middleware/authorization/entityAuth")

const customFieldModel = require("../../model/customField.model");
const companyModel = require("../../model/company.model");
const userModel = require("../../model/user.model");
const accessModel = require("../../model/access.model");

const { uploadImages, uploadCustomForm, uploadCustomFormWithS3, uploadImagesWithS3 } = require("../../utils/multer")

const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");
const multer = require("multer");
const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'billionforms.com';
const BASE_PORT = process.env.PORT || 3000;


// --------- company routes starts here -------------------

router.post('/create-company', entityAuth?.authorizeEntity("Administration", "Companies", "create"), async (req, res, next) => {
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
router.post('/update-company', entityAuth?.authorizeEntity("Administration", "Companies", "update"), superAdminController.updateCompany);

router.delete('/softdelete-company', entityAuth?.authorizeEntity("Administration", "Companies", "softDelete"), superAdminController.softDeleteCompany);

router.post('/restore-company', entityAuth?.authorizeEntity("Administration", "Companies", "update"), superAdminController.restoreCompany);

router.get('/get/company', entityAuth?.authorizeEntity("Administration", "Companies", "view"), superAdminController.getCompanyList);

router.get('/get/company/:id', entityAuth?.authorizeEntity("Administration", "Companies", "view"), superAdminController.getCompany);

router.post("/activeInactive/company", entityAuth?.authorizeEntity("Administration", "Companies", "update"), superAdminController.activeInactiveCompany);

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

router.post("/create/cleint", entityAuth?.authorizeEntity("Administration", "Clients", "create"), superAdminController.createClient);

router.post('/update/client', entityAuth?.authorizeEntity("Administration", "Clients", "update"), superAdminController.updateClient);

router.get('/get/client', entityAuth?.authorizeEntity("Administration", "Clients", "view"), superAdminController.getClientsList);

router.get('/get/client/:id', entityAuth?.authorizeEntity("Administration", "Clients", "view"), superAdminController.getIndividualClient);

router.delete('/softdelete/client', entityAuth?.authorizeEntity("Administration", "Clients", "softDelete"), superAdminController.softDeleteClient);

router.post('/restore/client', entityAuth?.authorizeEntity("Administration", "Clients", "update"), superAdminController.restoreClient);

router.post("/activeInactive/client", entityAuth?.authorizeEntity("Administration", "Clients", "update"), superAdminController.activeInactiveClient);

router.get('/get/client/by-status/notsetuped', entityAuth?.authorizeEntity("Administration", "Clients", "view"), superAdminController.getClients);

router.get('/get/all/client', entityAuth?.authorizeEntity("Administration", "Clients", "view"), superAdminController.getAllClients);


// --------- super admin staffs routes starts here -------------------

router.post("/create/superadmin/staff", entityAuth?.authorizeEntity("Administration", "Staff", "create"), superAdminController.createStaff);

router.post('/update/superadmin/staff', entityAuth?.authorizeEntity("Administration", "Staff", "update"), superAdminController.updateStaff);

router.get('/get/all/superadmin/staff', entityAuth?.authorizeEntity("Administration", "Staff", "view"), superAdminController.getStaffList);

router.get('/get/staff/:id', entityAuth?.authorizeEntity("Administration", "Staff", "view"), superAdminController.getIndividualStaff);

router.post("/activeInactive/superadmin/staff", entityAuth?.authorizeEntity("Administration", "Staff", "update"), superAdminController.activeInactiveStaff);

router.delete('/softdelete/superadmin/staff', entityAuth?.authorizeEntity("Administration", "Staff", "softDelete"), superAdminController.softDeleteStaff);

router.post('/restore/superadmin/staff', entityAuth?.authorizeEntity("Administration", "Staff", "update"), superAdminController.restoreStaff);






// --------- users routes starts here -------------------

router.post("/create/user", entityAuth?.authorizeEntity("Administration", "User", "create"), superAdminController.createUser);

router.post('/update/user', entityAuth?.authorizeEntity("Administration", "User", "update"), superAdminController.updateUser);

router.post("/activeInactive/user", entityAuth?.authorizeEntity("Administration", "User", "update"), superAdminController.activeInactiveUser);

router.get('/get/user', entityAuth?.authorizeEntity("Administration", "User", "view"), superAdminController.getUserList);

router.get('/get/all/user/:companyId', entityAuth?.authorizeEntity("Administration", "User", "create"), superAdminController.getAllUser);

router.post('/assign/user', entityAuth?.authorizeEntity("Administration", "User", "create"), superAdminController.assignUser);

router.delete('/softdelete/user', entityAuth?.authorizeEntity("Administration", "User", "softDelete"), superAdminController.softDeleteUser);

router.post('/restore/user', entityAuth?.authorizeEntity("Administration", "User", "update"), superAdminController.restoreUser);




// --------- company routes ends here -------------------



// --------- subscription routes start here -------------------

router.post("/create/subscription", entityAuth?.authorizeEntity("Administration", "Subscription", "create"), superAdminController.createSubscription);

router.post('/update/subscription', entityAuth?.authorizeEntity("Administration", "Subscription", "update"), superAdminController.updateSubscription);

router.get('/get/subscription/list', entityAuth?.authorizeEntity("Administration", "Subscription", "view"), superAdminController.getSubscriptionPlanList);

router.get('/get/all/subscription', entityAuth?.authorizeEntity("Administration", "Subscription", "view"), superAdminController.getAllSubscriptionPlan);

router.post("/activeInactive/subscription", entityAuth?.authorizeEntity("Administration", "Subscription", "update"), superAdminController.activeInactiveSubscription);

router.get('/get/subscription/:id', entityAuth?.authorizeEntity("Administration", "Subscription", "view"), superAdminController.getIndividualSubscriptionPlan);

router.delete('/softdelete/subscription', entityAuth?.authorizeEntity("Administration", "Subscription", "softDelete"), superAdminController.softDeleteSubscriptionPlan);

router.post('/restore/subscription', entityAuth?.authorizeEntity("Administration", "Subscription", "update"), superAdminController.restoreSubscriptionPlan);



// --------- subscription routes ends here ------------------- 


// --------- topup routes starts here ---------

router.post("/create/topup", entityAuth?.authorizeEntity("Administration", "Topup", "create"), superAdminController.createTopup);

router.post('/update/topup', entityAuth?.authorizeEntity("Administration", "Topup", "update"), superAdminController.updateTopup);

router.get('/get/topup/list', entityAuth?.authorizeEntity("Administration", "Topup", "view"), superAdminController.getTopupList);

router.get('/get/all/topup', entityAuth?.authorizeEntity("Administration", "Topup", "view"), superAdminController.getAllTopupPlan);


router.post("/activeInactive/topup", entityAuth?.authorizeEntity("Administration", "Topup", "update"), superAdminController.activeInactiveTopup);

router.get('/get/topup/:id', entityAuth?.authorizeEntity("Administration", "Topup", "view"), superAdminController.getIndividualTopup);

router.delete('/softdelete/topup', entityAuth?.authorizeEntity("Administration", "Topup", "softDelete"), superAdminController.softDeleteTopup);

router.post('/restore/topup', entityAuth?.authorizeEntity("Administration", "Topup", "update"), superAdminController.restoretopup);

// --------- topup routes ends here ---------


// --------- subscribed user routes starts here ---------

router.post("/create/subscribed", entityAuth?.authorizeEntity("Administration", "Subscribed", "create"), superAdminController.createSubscsribed);

router.post("/create/assigntopup", entityAuth?.authorizeEntity("Administration", "Topup", "create"), superAdminController.createAssignTopup);

router.get('/get/subscribed/list', entityAuth?.authorizeEntity("Administration", "Subscribed", "view"), superAdminController.getListSubscsribed);

router.post("/activeInactive/subscribed", entityAuth?.authorizeEntity("Administration", "Subscribed", "update"), superAdminController.activeInactiveTopup);

router.get('/get/subscribed/:id', entityAuth?.authorizeEntity("Administration", "Subscribed", "view"), superAdminController.getParticularSubscsribedUser);



// --------- subscribed user routes ends here ---------


// --------- Organization routes starts here -------------------

// create organization old
// router.post("/create/organization", superAdminAndClientAuth, (req, res, next) => {
//   uploadImages.fields([
//     { name: 'logo', maxCount: 1 },
//     { name: 'banner', maxCount: 1 }
//   ])(req, res, (err) => {
//     if (err) {
//       if (err instanceof multer.MulterError) {
//         // MulterError: File too large
//         return res.status(httpsStatusCode.BadRequest).send({
//           message: 'File too large. Maximum file size allowed is 2 MB.'
//         });
//       } else {
//         // Other errors
//         console.error('Multer Error:', err.message);
//         return res.status(httpsStatusCode.BadRequest).send({
//           message: err.message
//         });
//       }
//     }
//     next();
//   });
// }, superAdminController.createOrganization);

// create organization new
router.post("/create/organization", entityAuth?.authorizeEntity("Administration", "Organization", "create"), (req, res, next) => {
  uploadImagesWithS3.fields([
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

// update organization old
// router.post("/update/organization", superAdminAndClientAuth, (req, res, next) => {
//   uploadImages.fields([
//     { name: 'logo', maxCount: 1 },
//     { name: 'banner', maxCount: 1 }
//   ])(req, res, (err) => {
//     if (err) {
//       if (err instanceof multer.MulterError) {
//         // MulterError: File too large
//         return res.status(httpsStatusCode.BadRequest).send({
//           message: 'File too large. Maximum file size allowed is 2 MB.'
//         });
//       } else {
//         // Other errors
//         console.error('Multer Error:', err.message);
//         return res.status(httpsStatusCode.BadRequest).send({
//           message: err.message
//         });
//       }
//     }
//     next();
//   });
// }, superAdminController.updateOrganization);

// update organization new

router.post("/update/organization", entityAuth?.authorizeEntity("Administration", "Organization", "update"), (req, res, next) => {
  uploadImagesWithS3.fields([
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

router.get('/get/organization/all/:userId', entityAuth?.authorizeEntity("Administration", "Organization", "view"), superAdminController.getAllOrganization);

router.post("/activeInactive/organization", entityAuth?.authorizeEntity("Administration", "Organization", "update"), superAdminController.activeInactiveOrganization);

router.get('/get/organization/:id', entityAuth?.authorizeEntity("Administration", "Organization", "update"), superAdminController.getIndividualOrganization);


// --------- Organization routes ends here -------------------


// --------- Session route starts here ------------------

router.post("/create/session", superAdminAndClientAuth, superAdminController.createSession);

router.post("/update/session", superAdminAndClientAuth, superAdminController.updateSession);

router.delete("/delete/session", superAdminAndClientAuth, superAdminController.deleteSession);

router.post("/activeInactive/session", superAdminAndClientAuth, superAdminController.activeInactiveSession);

router.get('/get/session/all/:userId/:organizationId', superAdminAndClientAuth, superAdminController.getAllSession);

router.get('/get/session/:sessionId', superAdminAndClientAuth, superAdminController.getSession);

// --------- Session route ends here --------------------

// test

// --------- Custom Form route starts here ------------------

router.post('/create/field', superAdminAndClientAuth, superAdminController.createField);

router.delete('/delete/field/:userId/:sessionId/:fieldId', superAdminAndClientAuth, superAdminController.deleteField);

router.post("/update/order/field/:userId/:sessionId", superAdminAndClientAuth, superAdminController.updateFieldOrder);

router.get('/get/field/all/:userId/:sessionId', superAdminAndClientAuth, superAdminController.getAllFields);

router.get('/get/field/bysession/:sessionId', superAdminController.getAllFieldsBySession);

router.get('/get/field/data/:id', superAdminController.getFormData);

router.post('/check/password', superAdminController.checkPasword);

// old
// router.post('/create/form', uploadCustomForm.any(), superAdminController.submitForm);

// new
router.post('/create/form', uploadCustomFormWithS3.any(), superAdminController.submitForm);

router.post('/bulk-create-forms', uploadCustomFormWithS3.any(), superAdminController.bulkCreateForms);

router.post('/update/form/:formId', uploadCustomFormWithS3.any(), superAdminController.updateForm);

router.post('/delete/form', superAdminAuth, superAdminController.deleteForm);

router.post('/login/form', superAdminController.loginToEditForm);

router.get('/get/all/forms/:sessionId', superAdminController.getAllFormsBySession);


router.get('/download', superAdminAndClientAuth, superAdminController.downloadSessionFiles);

router.get('/download-by-field', superAdminAndClientAuth, superAdminController.downloadFilesByField);

router.get('/download/status', superAdminAndClientAuth, superAdminController.getDownloadStatus);






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
