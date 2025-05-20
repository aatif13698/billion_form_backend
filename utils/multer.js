/* eslint-disable consistent-return */
const multer = require('multer');
const fs = require('fs');
const path = require("path");
const { v4: uuidv4 } = require("uuid");


// create public folder
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public')
}

// create profile folder
if (!fs.existsSync('./public/profile')) {
    fs.mkdirSync('./public/profile')
}

// create icons folder
if (!fs.existsSync('./public/icon')) {
    fs.mkdirSync('./public/icon')
}

// create images folder
if (!fs.existsSync('./public/images')) {
    fs.mkdirSync('./public/images')
}

if (!fs.existsSync('./public/customForm')) {
    fs.mkdirSync('./public/customForm')
}


// image filter
const imageFilter = (req, file, cb) => {
    if (!file.originalname.match(/\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|webp)$/)) {
        req.fileValidationError = 'Only images are allowed!';
        return cb(new Error('Only images are allowed!'), false);
    }
    cb(null, true);
};

const imageFilters = (req, file, cb) => {
    const fileTypes = /jpeg|jpg|png|pdf|webp/;
    const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = fileTypes.test(file.mimetype);
    if (extname && mimetype) return cb(null, true);
    cb(new Error("Only images and PDFs are allowed"));
};

// video filter
const imageAndVideoFilter = (req, file, cb) => {
    if (!file.originalname.match(
        /\.(jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|mp4|MP4|m4a|M4A|m4b|M4B|f4v|F4V|mov|MOV)$/)) {
        req.fileValidationError = 'Only images and video are allowed!';
        return cb(new Error('Only images and video are allowed!'), false);
    }
    cb(null, true);
};



// upload profile image
const profileStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/profile');
    },
    filename: async (req, file, cb) => {
        cb(null, `${Date.now()}_${file.originalname.toLowerCase().replaceAll(' ', '')}`);
    },
});

const uploadProfile = multer({
    storage: profileStorage,
    limits: {
        fileSize: 1024 * 1024,
        files: 1
    },
    fileFilter: imageFilter
});

// logo and banner upload

// Multer storage configuration
const imagesStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        // const uploadPath = path.join(__dirname, './public/images');
        cb(null, './public/images');
    },
    filename: (req, file, cb) => {
        const uniqueName = `${uuidv4()}${path.extname(file.originalname).toLowerCase()}`;
        cb(null, uniqueName);
    }
});

// Multer upload configuration
const uploadImages = multer({
    storage: imagesStorage,
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 2 // Max 2 files (logo and banner)
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed'), false);
    }
});

// upload images to s3

const uploadImagesWithS3 = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 2 * 1024 * 1024, // 2MB limit
        files: 2, // Max 2 files (logo and banner)
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpg|JPG|jpeg|JPEG|png|PNG|gif|GIF|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase().replace('.', ''));
        const mimetype = allowedTypes.test(file.mimetype.split('/')[1].toLowerCase());

        if (extname && mimetype) {
            return cb(null, true);
        }
        cb(new Error('Only image files (jpg, jpeg, png, gif, webp) are allowed'), false);
    },
});



// form submit
const customFormDetailStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "./public/customForm"); // Ensure this folder exists
    },
    filename: (req, file, cb) => {
        console.log("Uploading file:", file); // Debug log
        cb(null, `${Date.now()}_${file.originalname.toLowerCase().replaceAll(" ", "")}`);
    },
});

const uploadCustomForm = multer({
    storage: customFormDetailStorage, // Use 'storage' key
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: imageFilters,
});


// upload custom form with S3 
const uploadCustomFormWithS3 = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'text/csv'];
        if (!allowedTypes.includes(file.mimetype)) {
            return cb(new Error('Invalid file type. Only JPEG, PNG, PDF, CSV allowed.'));
        }
        cb(null, true);
    },
});


exports.uploadProfile = uploadProfile;
exports.uploadImages = uploadImages;
exports.uploadCustomForm = uploadCustomForm;
exports.uploadCustomFormWithS3 = uploadCustomFormWithS3;
exports.uploadImagesWithS3 = uploadImagesWithS3;