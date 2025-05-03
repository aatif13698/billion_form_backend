

require('dotenv').config();


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const subscribedUserSchema = new Schema(
    {
        serialNumber: { type: String, default: null },
        userId: { type: ObjectId, ref: "User", index: true },
        subscription: [
            {

                subscriptionId: { type: ObjectId, ref: 'subscriptionPlan', required: true },
                startDate: { type: Date, default: Date.now },
                endDate: { type: Date }, // For subscription expiration
                status: { type: String, enum: ['active', 'inactive'], default: 'active' },
                createdBy: { type: ObjectId, ref: "User", index: true },
                isPlanExpired : {type: Boolean, default: false}
            }
        ],
        topup: [
            {
                topupId: { type: ObjectId, ref: 'topup', required: true },
                startDate: { type: Date, default: Date.now },
                endDate: { type: Date }, // For subscription expiration
                status: { type: String, enum: ['active', 'inactive'], default: 'active' },
                createdBy: { type: ObjectId, ref: "User", index: true },
                isPlanExpired : {type: Boolean, default: false}
            },
        ],


        // total limitation
        totalFormLimit: { type: Number, required: true },
        totalOrgLimit: { type: Number, required: true },
        totalUserLimint: { type: Number, required: true },

        

    },
    { timestamps: true }
);


const subscribedUserModel = mongoose.model("subscribedUser", subscribedUserSchema);
module.exports = subscribedUserModel;
