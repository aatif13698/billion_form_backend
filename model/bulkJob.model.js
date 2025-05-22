const  mongoose  = require("mongoose");

const bulkJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 },
  totalForms: { type: Number, required: true },
  processedForms: { type: Number, default: 0 },
  errorMessage: { type: String },
  createdAt: { type: Date, default: Date.now },
});
const BulkJob = mongoose.model('BulkJob', bulkJobSchema);

module.exports = BulkJob;
