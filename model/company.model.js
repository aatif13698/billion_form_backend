

require('dotenv').config(); 


const IS_DEV = process.env.NODE_ENV === 'development';


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const companySchema = new Schema(
  {
    userId: { type: ObjectId, ref: "user", index: true }, // Index for role-based queries
    serialNumber: { type: String, default : null },
    name: { type: String, required: true },
    subDomain: { type: String },
    port: { type: Number },
    adminEmail: {
      type: String, unique: true, lowecase: true,
      trim: true, sparse: true, index: true
    }, 
    adminPassword: { type: String, required: true },
    isActive: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null, index: true }, 
  },
  { timestamps: true }
);


// Creating the model
const companyModel = mongoose.model("Company", companySchema);
module.exports = companyModel;
