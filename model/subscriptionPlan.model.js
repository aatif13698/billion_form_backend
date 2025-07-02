

require('dotenv').config();


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const subscriptionPlanSchema = new Schema(
    {
        serialNumber: { type: String, default : null },
        name: { type: String, required: true },
        country: {
            type: String,
            trim: true,
        },
        currency: { type: String, trim: true, required: true },
        subscriptionCharge: { type: Number, required: true },
        validityPeriod: {
            type: String,
            enum: ['weekly', 'monthly', 'quarterly', 'halfyearly', 'yearly', 'infinite'],
            required: true,
        },
        formLimit: { type: Number, required: true },
        organisationLimit: { type: Number, required: true },
        userLimint: { type: Number, required: true },
        isActive: { type: Boolean, default: false },

        isDemoSubscription: { type: Boolean, default: false },

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


const subscriptionPlanModel = mongoose.model("subscriptionPlan", subscriptionPlanSchema);
module.exports = subscriptionPlanModel;
