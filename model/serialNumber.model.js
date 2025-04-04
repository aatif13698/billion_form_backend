const mongoose = require("mongoose");

const serialNumebrSchema = mongoose.Schema({
    collectionName: { type: String },
    prefix: { type: String },
    nextNum: { type: Number, default: 10001 }
})


const serialNumberModel = mongoose.model("serialNumber", serialNumebrSchema);
module.exports = serialNumberModel;

