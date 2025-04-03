const mongoose = require("mongoose");

const customFieldSchema = new mongoose.Schema({
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
    fileTypes: [{ type: String }],
    maxSize: Number
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const customFieldModel = mongoose.model("customField", customFieldSchema);

module.exports = customFieldModel;