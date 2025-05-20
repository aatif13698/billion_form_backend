
const cron = require('node-cron');
const AWS = require('aws-sdk');
require('dotenv').config(); // Load environment variables first

const DownloadJob = require('../model/downloadJob.model');


// DigitalOcean Spaces setup
const spacesEndpoint = new AWS.Endpoint(process.env.DO_SPACES_ENDPOINT);
const s3 = new AWS.S3({
  endpoint: spacesEndpoint,
  accessKeyId: process.env.DO_SPACES_KEY,
  secretAccessKey: process.env.DO_SPACES_SECRET,
});



const scheduleZipCleanup = () => {
  cron.schedule('* * * * * *', async () => {
    console.log("Running cron to clean expired ZIPs...");
    try {
      const now = new Date();
      const expiredJobs = await DownloadJob.find({
        status: 'completed',
        expiresAt: { $lte: now },
        zipKey: { $exists: true, $ne: null },
      }).lean();

      for (const job of expiredJobs) {
        try {
          await s3.deleteObject({
            Bucket: process.env.DO_SPACES_BUCKET,
            Key: job.zipKey,
          }).promise();
          console.log('Cron: Deleted ZIP file', { jobId: job.jobId, zipKey: job.zipKey });
        } catch (err) {
          console.error('Cron: Failed to delete ZIP file', {
            jobId: job.jobId,
            zipKey: job.zipKey,
            err: err.message
          });
        }
      }
    } catch (err) {
      console.error('Cron: Failed to process expired jobs', { err: err.message });
    }
  });
};

module.exports = scheduleZipCleanup;