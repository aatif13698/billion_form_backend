// app.js
require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler/errorHandler');
const { identifyCompany } = require("./utils/commonFunction");


// Custom modules
const connectDb = require('./connection/connectionDb');

// Initialize Express app
const app = express();

// Constants
const PORT = process.env.PORT || 8080;
const DATABASE_URL = process.env.DATABASE_URL;

// Middleware setup
app.use(cors({
    origin: process.env.NODE_ENV === 'development' ? '*' : 'https://billionforms.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // If you need to support cookies/auth
}));
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files


// Environment config
const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


// import routes 
const welcomeRouter = require("./routes/welcome");
const superAdminRouter = require("./superAdminAdministration/routes/superAdmin.routes");
const adminRouter = require("./adminAdministration/routes/admin.routes");

// impoprt common functions
const commonFunction = require("./utils/commonFunction");




app.use(identifyCompany)
app.use(errorHandler);


// Routes for different roles
app.use("/api", welcomeRouter.router);
app.use("/api/superadmin/auth", superAdminRouter.router);
app.use("/api/admin", adminRouter.router);



// Error handling middleware (must be last middleware)



// Start server function
const startServer = async () => {
    let server; // Declare server variable in outer scope
    try {
        // Connect to database
        await connectDb(DATABASE_URL);
        console.log('Database connected successfully');

        await commonFunction.insertRole();
        await commonFunction.createSuperAdmin();

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