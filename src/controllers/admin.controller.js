const { getDb } = require("../utils/getDb");
const config = require("../config/auth.config");
const jwt = require("jsonwebtoken");
const fs = require('fs');
const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
const algorithm =config.algorithm;


exports.getUsersForAdmin = async (req, res) => {
  try {
    const adminId = req.userId; // Assuming adminId is stored in req object by middleware
    const db = getDb();
    const User = db.user;
    const Role = db.role;
    const AdminUser = db.admin_user;

    const adminUsers = await AdminUser.findAll({
      where: { admin_id: adminId },
      include: [{
        model: User, 
        as: "user", 
        attributes: ["id", "username", "email"], 
        include: [{
          model: Role,
          as: "roles",
          through: { attributes: [] }
        }]
      }]
    });

    const users = adminUsers.map(adminUser => {
      const user = adminUser.user;
      return {
        id: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles.map(role => "ROLE_" + role.name.toUpperCase())
      };
    });

    res.status(200).send(users);
  } catch (error) {
    console.log(error);
    res.status(500).send({ message: "Error retrieving users", error: error.message });
  }
};


// Login as User
exports.loginAsUser = async (req, res) => {
    try {
        const adminId = req.userId; // Assuming adminId is stored in req object by middleware
        const userId = req.body.userId;

        const db = getDb();
        const User = db.user;
        const Role = db.role;
        const AdminUser = db.admin_user;

        const adminUser = await AdminUser.findOne({
            where: { admin_id:adminId, user_id:userId }
        });

        if (!adminUser) {
            return res.status(403).send({ message: "User not associated with this admin." });
        }

        const user = await User.findByPk(userId, {
            include: [{ model: Role, as: "roles", through: { attributes: [] } }]
        });

        if (!user) {
            return res.status(404).send({ message: "User not found" });
        }

        const role = user.roles[0]; // Assuming each user has one role for simplicity
        const accessToken = generateAccessToken(user.id, role.name);
        const refreshToken = generateRefreshToken(user.id, role.name);

        // Regular user tokens
        res.cookie('userAccessToken', accessToken, {
            httpOnly: true,
            secure: true, // Set to true if using HTTPS
            sameSite: 'None', // Prevents CSRF attacks
            maxAge: 24 * 60 * 60 * 1000, // 24 hours
            path: '/' // Ensure the path is set to root
        });

        res.cookie('userRefreshToken', refreshToken, {
            httpOnly: true,
            secure: true, // Set to true if using HTTPS
            sameSite: 'None', // Prevents CSRF attacks
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: '/' // Ensure the path is set to root
        });
        res.status(200).send({ message: "Logged in as user" });
    } catch (error) {
        res.status(500).send({ message: "Error logging in as user", error: error.message });
    }
};

function generateAccessToken(id, role) {
  return jwt.sign({ id: id, role: role }, privateKey, {
    algorithm: algorithm,
    expiresIn: "24h" // 24 hours
  });
}

function generateRefreshToken(id, role) {
  return jwt.sign({ id: id, role: role }, privateKey, {
    algorithm: algorithm,
    expiresIn: "7d" // 7 days
  });
}



