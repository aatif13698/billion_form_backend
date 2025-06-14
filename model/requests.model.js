const mongoose = require('mongoose');

const { Schema } = mongoose;

const requestsSchema = new Schema(
  {
    name: { 
      type: String, 
      required: [true, 'Name is required'], 
      trim: true 
    },
    email: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      index: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please enter a valid email address']
    },
    phone: { 
      type: String, 
      sparse: true, 
      trim: true, 
      index: true,
      match: [/^\d{10}$/, 'Phone number must be 10 digits']
    },
    message: { 
      type: String, 
      required: [true, 'Message is required'], 
      trim: true 
    },
    deletedAt: { 
      type: Date, 
      default: null, 
      index: true 
    },
  },
  { 
    timestamps: true 
  }
);

// Creating the model
const UserRequest = mongoose.model('Requests', requestsSchema);
module.exports = UserRequest;