const jwt = require("jsonwebtoken");
const config = require("../config/auth.config"); // Adjust the path as needed
const {getDb} = require("../utils/getDb");
const fs = require('fs');

const publicKey = fs.readFileSync(config.publicKeyPath, 'utf8');
const algorithm =config.algorithm;


const verifyToken = (token, role) => {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm] });
    if (decoded.role !== role) {
      throw new Error("Invalid role");
    }
    return decoded;
  } catch (error) {
    return null;
  }
};

const authJwt = {
  verifyAdminToken: (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
      return res.status(401).send({ message: "No token provided" });
    }

    const decoded = verifyToken(token, "admin");
    if (!decoded) {
      return res.status(403).send({ message: "Unauthorized" });
    }

    req.userId = decoded.id;
    next();
  },

  verifyUserToken: (req, res, next) => {
    const token = req.cookies.userAccessToken;
    if (!token) {
      return res.status(401).send({ message: "No token provided" });
    }

    const decoded = verifyToken(token, "user");
    if (!decoded) {
      return res.status(403).send({ message: "Unauthorized" });
    }

    req.userId = decoded.id;
    next();
  },

  verifyToken: (req, res, next) => {
    const adminToken = req.cookies.accessToken;
    const userToken = req.cookies.userAccessToken;
    
    if (!adminToken && !userToken) {
      return res.status(401).send({ message: "No token provided" });
    }

    const adminDecoded = adminToken ? verifyToken(adminToken, "admin") : null;
    const userDecoded = userToken ? verifyToken(userToken, "user") : null;

    if (!adminDecoded && !userDecoded) {
      return res.status(403).send({ message: "Unauthorized" });
    }

    req.userId = adminDecoded ? adminDecoded.id : userDecoded.id;
    req.role = adminDecoded ? 'admin' : 'user';
    next();
  }
};

// Verify Access Token function
// function verifyAccessToken(token) {
//   try {
//     const decoded = jwt.verify(token, publicKey, { algorithms: [algorithm] });
//     return decoded;
//   } catch (error) {
//     return null;
//   }
// }

// const verifyToken = (req, res, next) => {
//   let token = req.cookies.accessToken;

//   if (!token) {
//     return res.status(403).send({
//       message: "No token provided!",
//     });
//   }

//   const decoded = verifyAccessToken(token);
//   if (!decoded) {
//     return res.status(401).send({
//       message: "Unauthorized!",
//     });
//   }

//   req.userId = decoded.id;
//   next();
// };




// const authJwt = {
//   verifyToken,
// };
module.exports = authJwt;
