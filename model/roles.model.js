const mongoose = require("mongoose");

const roleSchema = new mongoose.Schema({
    id : {type : Number},
    name : {type : String},
    capability: {
        type: [
            {
                name: { type: String, required: true }, // Capability name
                access: { type: Boolean, default: false },
                menu: {
                    type: [
                        {
                            name: { type: String, required: true },
                            displayName: { type: String, default: null },
                            access: { type: Boolean, default: false },
                            subMenus: {
                                create: {
                                    id: { type: Number, require: true },
                                    access: { type: Boolean, default: false },
                                    api: { type: String, default: null },
                                },
                                view: {
                                    id: { type: Number, require: true },
                                    access: { type: Boolean, default: false },
                                    api: { type: String, default: null },
                                },
                                update: {
                                    id: { type: Number, require: true },
                                    access: { type: Boolean, default: false },
                                    api: { type: String, default: null },
                                },
                                softDelete: {
                                    id: { type: Number, require: true },
                                    access: { type: Boolean, default: false },
                                    api: { type: String, default: null },
                                },
                            }
                        }
                    ],
                    default: []
                },
            },
        ],
        default: [], // Default to an empty array
    },
    isActive :{type : Number, default : 1}

},{timestamps:true});

const roleModel = mongoose.model("role", roleSchema);

module.exports = roleModel;