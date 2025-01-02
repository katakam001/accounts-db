const jwt = require("jsonwebtoken");
const config = require("../config/auth.config"); // Adjust the path as needed
const {getDb} = require("../utils/getDb");
const fs = require('fs');

const publicKey = fs.readFileSync(config.publicKeyPath, 'utf8');

// Verify Access Token function
function verifyAccessToken(token) {
  try {
    const decoded = jwt.verify(token, publicKey, { algorithms: ['RS256'] });
    return decoded;
  } catch (error) {
    return null;
  }
}

const verifyToken = (req, res, next) => {
  let token = req.cookies.accessToken;

  if (!token) {
    return res.status(403).send({
      message: "No token provided!",
    });
  }

  const decoded = verifyAccessToken(token);
  if (!decoded) {
    return res.status(401).send({
      message: "Unauthorized!",
    });
  }

  req.userId = decoded.id;
  next();
};


isAdmin = async (req, res, next) => {
  try {
    const db = getDb();
    const User = db.user;
    const user = await User.findByPk(req.userId);
    const roles = await user.getRoles();

    for (let i = 0; i < roles.length; i++) {
      if (roles[i].name === "admin") {
        return next();
      }
    }

    return res.status(403).send({
      message: "Require Admin Role!",
    });
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate User role!",
    });
  }
};

isModerator = async (req, res, next) => {
  try {
    const db = getDb();
    const User = db.user;
    const user = await User.findByPk(req.userId);
    const roles = await user.getRoles();

    for (let i = 0; i < roles.length; i++) {
      if (roles[i].name === "moderator") {
        return next();
      }
    }

    return res.status(403).send({
      message: "Require Moderator Role!",
    });
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate Moderator role!",
    });
  }
};

isModeratorOrAdmin = async (req, res, next) => {
  try {
    const db = getDb();
    const User = db.user;
    const user = await User.findByPk(req.userId);
    const roles = await user.getRoles();

    for (let i = 0; i < roles.length; i++) {
      if (roles[i].name === "moderator") {
        return next();
      }

      if (roles[i].name === "admin") {
        return next();
      }
    }

    return res.status(403).send({
      message: "Require Moderator or Admin Role!",
    });
  } catch (error) {
    return res.status(500).send({
      message: "Unable to validate Moderator or Admin role!",
    });
  }
};

const authJwt = {
  verifyToken,
  isAdmin,
  isModerator,
  isModeratorOrAdmin,
};
module.exports = authJwt;
