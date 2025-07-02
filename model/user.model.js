const bcrypt = require("bcrypt");
const mongoose = require("mongoose");


const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const userSchema = new Schema(
  {
    role: { type: ObjectId, ref: "role", index: true }, // Index for role-based queries
    roleId: { type: Number },
    serialNumber: { type: String, default: null },
    firstName: { type: String, required: true },
    lastName: { type: String },
    middleName: { type: String },
    email: {
      type: String, unique: true, lowecase: true,
      trim: true, sparse: true, index: true
    },
    phone: { type: String, unique: true, sparse: true, trim: true, index: true },
    password: { type: String, required: true },
    tc: { type: Boolean, required: true },
    isUserVerified: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    
    isClient: { type: Boolean, defaut: false},

    // fields for profile
    gender: {
      type: String,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
      default: 'Prefer not to say',
      trim: true,
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator: function (v) {
          return v && v instanceof Date && !isNaN(v);
        },
        message: 'Invalid Date of Birth.',
      },
    },

    optionalEmail: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      validate: {
        validator: function (v) {
          return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(v);
        },
        message: 'Invalid email format.',
      },
    },

    emergencyPhone: {
      type: String,
      trim: true,
      validate: {
        validator: function (v) {
          return /^\+?[1-9]\d{1,14}$/.test(v);
        },
        message: 'Invalid phone number format.',
      },
    },

    city: {
      type: String,
      trim: true,
    },

    state: {
      type: String,
      trim: true,
    },

    country: {
      type: String,
      trim: true,
    },

    ZipCode: {
      type: String,
      trim: true,
    },

    address: {
      type: String,
      trim: true,
    },

    profileImage: { type: String, default: null },
    profileCreated: { type: Boolean, default: false },
    companyId: { type: ObjectId, ref: "Company", default: null, index: true },

    verificationOtp: { type: String },
    otpGeneratedAt: { type: Date },
    OTP: { type: String },


    organization: [
      {
        type: ObjectId,
        ref: "organization",
        index: true
      }
    ],

    meetingLink: { type: String, default: null },

    // handling client creation
    createdBy: { type: ObjectId, ref: "user", index: true }, // Index for admin/user relationships
    isCreatedBySuperAdmin: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true }, // Index for soft-delete functionality
  },
  { timestamps: true }
);

// Instance method for password verification
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Creating the model
const userModel = mongoose.model("User", userSchema);
module.exports = userModel;
