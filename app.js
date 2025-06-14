// app.js
require('dotenv').config(); // Load environment variables first
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const errorHandler = require('./middleware/errorHandler/errorHandler');
const { identifyCompany } = require("./utils/commonFunction");
const morgan = require("morgan");
const { Server } = require('socket.io');
const http = require('http');


// Custom modules
const connectDb = require('./connection/connectionDb');

// Initialize Express app
// const { app, server, io } = require("./socket/socket.js") ;




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
const superAdminRoleAndPermissionRouter = require("./superAdminAdministration/routes/rolesAndPermission.routes");
const adminRouter = require("./adminAdministration/routes/admin.routes");
const scheduleZipCleanup = require('./utils/cron');
const DownloadJob = require('./model/downloadJob.model');

const app = express();


// Middleware setup
app.use(cors({
    // origin: process.env.NODE_ENV === 'development' ? '*' : 'https://*.aestree.in',
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true, // If you need to support cookies/auth
}));



const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        path: '/api/socket.io',
        // origin: process.env.NODE_ENV === 'development' ? '*' : 'https://aestree.in',
        origin: '*',
        methods: ['GET', 'POST']
        // credentials: true,
    },
})


io.on("connection", (socket) => {
    console.log("connecting socket");

    socket.on('joinDownload', ({ userId, jobId }) => {
        socket.join(`user:${userId}`);
        if (jobId) {
            socket.join(`job:${jobId}`);
        }
        console.log(`Client ${socket.id} joined user:${userId}, job:${jobId}`);
    });
    // Handle disconnect event
    socket.on("disconnect", () => {
        console.log("Client disconnected");
    });


});



// // WebSocket connection
// io.on('connection', (socket) => {
//   console.log('Client connected:', socket.id);

//   // Authenticate client with userId and jobId
//   socket.on('joinDownload', ({ userId, jobId }) => {
//     socket.join(`user:${userId}`);
//     if (jobId) {
//       socket.join(`job:${jobId}`);
//     }
//     console.log(`Client ${socket.id} joined user:${userId}, job:${jobId}`);
//   });

//   socket.on('disconnect', () => {
//     console.log('Client disconnected:', socket.id);
//   });
// });

// app.use((req, res, next) => {
//   console.log("Unknown route", req.url);
//   next();
// });

app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files
app.use("/client/request", superAdminAdministrationhRouter.router);

app.use(identifyCompany)
app.use(errorHandler);
app.use(morgan('dev'));

app.use("/", welcomeRouter.router);

// for production test
// Routes for different roles
app.use("/auth", authRouter.router);
app.use("/superadmin/administration", superAdminAdministrationhRouter.router);
app.use("/superadmin/roles", superAdminRoleAndPermissionRouter.router);
app.use("/admin", adminRouter.router);


// for local
app.use("/api/", welcomeRouter.router);
app.use("/api/auth", authRouter.router);
app.use("/api/superadmin/administration", superAdminAdministrationhRouter.router);
app.use("/api/superadmin/roles", superAdminRoleAndPermissionRouter.router);
app.use("/api/admin", adminRouter.router);



// // Function to emit progress updates
async function emitProgressUpdate(jobId) {
  try {
    const job = await DownloadJob.findOne({ jobId }).lean();
    if (job) {
      io.to(`job:${jobId}`).emit('downloadProgress', {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        fieldName: job.fieldName,
        errorMessage: job.errorMessage,
      });
    }
  } catch (err) {
    console.error('Failed to emit progress:', err.message);
  }
}



// // Function to emit progress updates
async function emitProgresLive(data) {
  try {
    // const job = await DownloadJob.findOne({ jobId }).lean();
    if (data) {
        // console.log("data 111",data);
         
      io.to(`job:${data.jobId}`).emit('downloadProgressLive', {
        jobId: data.jobId,
        status: data.status,
        progress: data.progress,
        fieldName: data.fieldName,
        errorMessage: data.errorMessage,
      });
    }
  } catch (err) {
    console.error('Failed to emit live progress:', err.message);
  }
}


app.set('emitProgressUpdate', emitProgressUpdate);
app.set('emitProgresLive', emitProgresLive);

// Start server function
const startServer = async () => {
    // let server; // Declare server variable in outer scope
    try {
        // Connect to database
        await connectDb(DATABASE_URL);
        console.log('Database connected successfully');
        // await commonFunction.insertRole();
        // await commonFunction.insertSingleRole();
        // await commonFunction.insertSerialNumber()
        // await commonFunction.createSuperAdmin();
        // await commonFunction.createAccess();
        // await commonFunction.generateASerialNumber();
        // scheduleZipCleanup(); //  Start your cron after DB connection
        // await commonFunction.updateRoleInDatbaseInstance()

        // Start Express server
        server.listen(PORT, () => {
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