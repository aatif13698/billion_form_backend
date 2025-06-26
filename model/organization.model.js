

require('dotenv').config();


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const organizationSchema = new Schema(
    {
        // userId: { type: ObjectId, ref: "User", index: true },
        companyId: { type: ObjectId, ref: "Company", default: null, index: true },
        createdBy: { type: ObjectId, ref: "User", index: true },
        assignedUser: [
            {
                type: ObjectId,
                ref: "User",
                index: true
            }
        ],
        serialNumber: { type: String, default: null },
        name: { type: String, required: true },
        captionText: { type: String, default: null },
        address: { type: String, default: null },
        email: {
            type: String, lowecase: true,
            trim: true, sparse: true, index: true
        },
        phone: { type: String, sparse: true, trim: true, index: true },
        logo: { type: String, default: null },
        banner: { type: String, default: null },
        isActive: { type: Boolean, default: false },
        deletedAt: { type: Date, default: null, index: true }, // Index for soft-delete functionality

    },
    { timestamps: true }
);


const organizationModel = mongoose.model("organization", organizationSchema);
module.exports = organizationModel;
