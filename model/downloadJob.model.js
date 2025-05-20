const mongoose  = require("mongoose");




const downloadJobSchema = new mongoose.Schema({
  jobId: { type: String, required: true, unique: true },
  sessionId: { type: mongoose.Schema.Types.ObjectId, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, required: true },
  fieldName: { type: String }, // For field-specific downloads
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
  progress: { type: Number, default: 0 }, // 0 to 100
  zipUrl: { type: String },
  zipKey: { type: String },
  expiresAt: { type: Date },
}, { timestamps: true });
downloadJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const DownloadJob = mongoose.model('DownloadJob', downloadJobSchema);


module.exports = DownloadJob;
