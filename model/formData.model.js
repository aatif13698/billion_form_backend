const mongoose = require("mongoose");
const { Schema } = mongoose;

const formDataSchema = new mongoose.Schema(
  {
    serialNumber: { type: String, default : null },
    phone: { type: String, trim: true },
    firstName: { type: String, trim: true },
    otherThanFiles: {
      type: Map,
      of: Schema.Types.Mixed,
      default: new Map(),
    },
    files: [
      {
        fieldName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        originalName: { type: String },
        mimeType: { type: String },
        size: { type: Number },
      },
    ],
    password: { type: String, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", index: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: "organization", index: true },
    sessionId: { type: mongoose.Schema.Types.ObjectId, ref: "session", index: true, required: true },
  },
  { timestamps: true }
);

// Pre-save middleware to normalize phone and firstName
formDataSchema.pre("save", function (next) {
  // Trim and normalize phone and firstName
  if (this.phone) {
    this.phone = this.phone.trim();
    if (this.phone === "") this.phone = undefined; // Treat empty string as null
  }
  if (this.firstName) {
    this.firstName = this.firstName.trim();
    if (this.firstName === "") this.firstName = undefined;
  }
  next();
});

// Sparse unique compound index
formDataSchema.index(
  { phone: 1, firstName: 1, sessionId: 1 },
  {
    unique: true,
    sparse: true, // Only enforce for documents where all fields are non-null
    name: "unique_phone_firstName_sessionId",
  }
);

// Handle duplicate key errors
formDataSchema.post("save", function (error, doc, next) {
  if (error.name === "MongoServerError" && error.code === 11000) {
    next(new Error("A form with this phone, first name, and session already exists"));
  } else {
    next(error);
  }
});

const formDataModel = mongoose.model("formData", formDataSchema);
module.exports = formDataModel;