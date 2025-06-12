

const jwt = require("jsonwebtoken");
const dotnev = require("dotenv");
dotnev.config();
const PRIVATEKEY = process.env.PRIVATEKEY;
const statusCode = require('../../utils/https-status-code');
const message = require("../../utils/message");
const UserModel = require("../../model/user.model");


exports.authorizeEntity = (module, entityName, subMenuAction = 'create') => async (req, res, next) => {
    try {
        const { capability, user } = await commonCheckOfEntity(req.headers, module, entityName);
        const menu = capability?.menu?.find((item) => item.name === entityName);
        if (!menu?.access || !menu?.subMenus?.[subMenuAction]?.access) {
            return res.status(statusCode.Forbidden).send({ message: message.lblUnauthorize });
        }
        req.user = user;
        next();
    } catch (error) {
        console.error(`Authorization Error for ${entityName}:`, error.message);
        return res.status(statusCode.Unauthorized).send({ message: error.message });
    }
};

const commonCheckOfEntity = async (header, module, entityName) => {
    const { authorization } = header;

    if (!authorization || !authorization.startsWith("Bearer")) {
        throw new Error(message.lblNoToken || "No token provided");
    }
    try {
        const token = authorization.split(" ")[1];
        const { userId, email } = jwt.verify(token, PRIVATEKEY);
        if (!userId) {
            throw new Error(message.lblUnauthorizeUser || "Unauthorized user");
        }
        const user = await UserModel.findOne({ email }).populate("role").lean();
        if (!user) {
            throw new Error(message.lblUserNotFound || "User not found");
        }
        const capability = user?.role?.capability?.find((item) => item.name === module);
        if (!capability || !capability.access) {
            throw new Error(message.lblUnauthorize || `Unauthorized access for ${module}`);
        }
        return { capability, user };
    } catch (error) {
        throw new Error(error.message || `Invalid token or verification failed for ${entityName}`);
    }
};