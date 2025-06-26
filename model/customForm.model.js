const mongoose = require("mongoose");

const customFormSchema = new mongoose.Schema({
  name: { type: String, required: true },
  label: { type: String, required: true },
  type: {
    type: String,
    enum: [
      'text', 'number', 'email', 'date', 'select', 'checkbox',
      'textarea', 'multiselect', 'datepicker', 'timepicker', 'color', 'hyperlink', 'file'
    ],
    required: true
  },
  options: [{ type: String }],
  isRequired: { type: Boolean, default: false },
  placeholder: { type: String },
  validation: {
    regex: String,
    min: Number,
    max: Number,
    maxLength: Number,
    minLength: Number,
    fileTypes: [{ type: String }],
    maxSize: Number
  },
  aspectRation: {
    xAxis: Number,
    yAxis: Number
  },
  gridConfig: {
    span: Number,
    order: Number
  },
  isDeleteAble: { type: Boolean, default: true },
  // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: "Company", default: null, index: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'session' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'user' },
  // createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

const customFormModel = mongoose.model("customForm", customFormSchema);

module.exports = customFormModel;