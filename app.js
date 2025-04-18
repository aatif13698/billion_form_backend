// app.js
require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler/errorHandler');
const { identifyCompany } = require("./utils/commonFunction");
const morgan = require("morgan")


// Custom modules
const connectDb = require('./connection/connectionDb');

// Initialize Express app
const app = express();

// Constants
const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;

// Environment config
const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;

// impoprt common functions
const commonFunction = require("./utils/commonFunction");

// import routes 
const welcomeRouter = require("./routes/welcome");
const authRouter = require("./commonAuthentication/routes/auth.routes");
const superAdminAdministrationhRouter = require("./superAdminAdministration/routes/superAdmin.routes");
const adminRouter = require("./adminAdministration/routes/admin.routes");

// Middleware setup
app.use(cors({
    // origin: process.env.NODE_ENV === 'development' ? '*' : 'https://*.aestree.in',
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // If you need to support cookies/auth
}));


app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use(identifyCompany)
app.use(errorHandler);
app.use(morgan('dev'));

app.use("/", welcomeRouter.router);

// for production
// Routes for different roles
app.use("/auth", authRouter.router);
app.use("/superadmin/administration", superAdminAdministrationhRouter.router);
app.use("/admin", adminRouter.router);


// for local
app.use("/api/auth", authRouter.router);
app.use("/api/superadmin/administration", superAdminAdministrationhRouter.router);
app.use("/api/admin", adminRouter.router);

// Start server function
const startServer = async () => {
    let server; // Declare server variable in outer scope
    try {
        // Connect to database
        await connectDb(DATABASE_URL);
        console.log('Database connected successfully');
        await commonFunction.insertRole();
        // await commonFunction.insertSerialNumber()
        await commonFunction.createSuperAdmin();
        await commonFunction.createAccess()
        // await commonFunction.generateASerialNumber();
        // Start Express server
        server = app.listen(PORT, () => {
            console.log(`Server started successfully on port ${PORT}`);
        });

        // Handle server startup errors
        server.on('error', (error) => {
            console.error('Server startup error:', error);
            process.exit(1);
        });

    } catch (error) {
        console.error('Failed to start server:', error.message);
        process.exit(1);
    }

    // Graceful shutdown
    process.on('SIGTERM', async () => {
        console.log('SIGTERM signal received: closing server');
        if (server) {
            server.close(async () => {
                try {
                    await mongoose.connection.close(false);
                    console.log('MongoDB connection closed');
                    process.exit(0);
                } catch (err) {
                    console.error('Error closing MongoDB connection:', err);
                    process.exit(1);
                }
            });
        }
    });

    // Handle uncaught exceptions and promise rejections
    process.on('uncaughtException', (err) => {
        console.error('Uncaught Exception:', err);
        if (server) {
            server.close(() => process.exit(1));
        } else {
            process.exit(1);
        }
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        if (server) {
            server.close(() => process.exit(1));
        } else {
            process.exit(1);
        }
    });
};

// Execute server startup
startServer();