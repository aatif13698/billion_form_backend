

const httpsStatusCode = require("../../utils/https-status-code");
const message = require("../../utils/message");



exports.listRoles = async (req, res, next) => {
  try {

    return res.status(httpsStatusCode.OK).json({
      success: true,
      message: message.lblClientFoundSuccessfully,
      data: {
        user: clients,
      },
    });
  } catch (error) {
    console.error("Client getting error:", error);
    return res.status(httpsStatusCode.InternalServerError).json({
      success: false,
      message: "Internal server error",
      errorCode: "SERVER_ERROR",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};