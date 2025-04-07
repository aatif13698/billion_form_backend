

require('dotenv').config(); 


const IS_DEV = process.env.NODE_ENV === 'development';
const BASE_DOMAIN = IS_DEV ? 'localhost' : 'millionsform.com';
const BASE_PORT = process.env.PORT || 3000;


const mongoose = require("mongoose");
const { Schema } = mongoose;
const ObjectId = Schema.ObjectId;

const accessSchema = new Schema(
  {
    companyId:  { type: ObjectId, ref: "Company", default : null, index: true },
    users: [
        {
          type: ObjectId,
          ref: "User",
          index: true
        }
      ]
  },
  { timestamps: true }
);


const accessModel = mongoose.model("access", accessSchema);
module.exports = accessModel;
