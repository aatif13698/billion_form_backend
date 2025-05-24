const { Server } = require("socket.io");
const express = require("express");
const http = require("http");
require('dotenv').config(); // Load environment variables first



const app = express();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        path: '/api/socket.io',
        origin: process.env.NODE_ENV === 'development' ? '*' : 'https://aestree.in',
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

module.exports = { app, server, io };