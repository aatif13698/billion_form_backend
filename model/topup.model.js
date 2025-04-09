

require('dotenv').config();


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const topupSchema = new Schema(
    {
        serialNumber: { type: String, default : null },
        name: { type: String, required: true },
        subscriptionCharge: { type: Number, required: true },
        validityPeriod: {
            type: String,
            enum: ['monthly', 'quarterly', 'halfyearly', 'yearly', 'infinite'],
            required: true,
        },
        formLimit: { type: Number, required: true },
        organisationLimit: { type: Number, required: true },
        userLimint: { type: Number, required: true },
        isActive: { type: Boolean, default: false },
        activatedOn: { type: Date, default: null, index: true },
        deActivatedOn: { type: Date, default: null, index: true },
        createdBy: { type: ObjectId, ref: "User", index: true },
        subscribers: [
            {
                type: ObjectId,
                ref: "User",
                index: true
            }
        ],
        deletedAt: { type: Date, default: null, index: true }, // Index for soft-delete functionality
    },
    { timestamps: true }
);


const topupModel = mongoose.model("topup", topupSchema);
module.exports = topupModel;
