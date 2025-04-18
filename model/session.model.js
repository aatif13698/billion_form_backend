

require('dotenv').config();


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const sessionSchema = new Schema(
    {
        serialNumber: { type: String, default: null },
        clientId: { type: ObjectId, ref: "user", index: true },
        createdBy: { type: ObjectId, ref: "user", index: true },
        organizationId: { type: ObjectId, ref: "organization", index: true },

        name: { type: String, required: true },
        for: { type: String, required: true },
        link: { type: String, required: true },
        isActive: { type: Boolean, default: false },
        closeDate: { type: Date, default: null, index: true },
        formReceived: { type: Number, default: 0 },

        deletedAt: { type: Date, default: null, index: true },
    },
    { timestamps: true }
);


const sessionModel = mongoose.model("session", sessionSchema);
module.exports = sessionModel;
