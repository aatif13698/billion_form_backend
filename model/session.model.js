

require('dotenv').config();
const bcrypt = require("bcrypt");


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
        isPasswordRequired: { type: Boolean, default: false },
        password: { type: String, default: null },
        closeDate: { type: Date, default: null, index: true },
        formReceived: { type: Number, default: 0 },

        lastFormId : { type: String, default: null },

        deletedAt: { type: Date, default: null, index: true },
    },
    { timestamps: true }
);


// Instance method for password verification
sessionSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

const sessionModel = mongoose.model("session", sessionSchema);
module.exports = sessionModel;
