const { getDb } = require("../utils/getDb");
const config = require("../config/auth.config");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { google } = require('googleapis');
const fs = require('fs');

const privateKey = fs.readFileSync(config.privateKeyPath, 'utf8');
const publicKey = fs.readFileSync(config.publicKeyPath, 'utf8');



const CLIENT_ID = "CLIENT_ID_PLACEHOLDER";
const CLIENT_SECRET = "CLIENT_SECRET_PLACEHOLDER";
const REDIRECT_URI = "REDIRECT_URI_PLACEHOLDER";
const REFRESH_TOKEN = "REFRESH_TOKEN_PLACEHOLDER";

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oAuth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

exports.signup = async (req, res) => {

  // Save User to Database
  try {
    const db = getDb();
    const User = db.user;
    const Role = db.role;
    const Op = db.Sequelize.Op;
    const user = await User.create({
      firstname: req.body.firstname,
      middlename: req.body.middlename,
      lastname: req.body.lastname,
      username: req.body.username,
      password: bcrypt.hashSync(req.body.password, 8),
      email: req.body.email
    });

    if (req.body.roles) {
      const roles = await Role.findAll({
        where: {
          name: {
            [Op.or]: req.body.roles,
          },
        },
      });

      const result = user.setRoles(roles);
      if (result) res.status(201).send({ message: "User registered successfully!" });
    } else {
      // user has role = 1
      const result = user.setRoles([1]);
      if (result) res.status(201).send({ message: "User registered successfully!" });
    }
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

exports.signin = async (req, res) => {
  try {
    const db = getDb();
    const User = db.user;
    const user = await User.findOne({
      where: {
        username: req.body.username,
      },
    });

    if (!user) {
      return res.status(404).send({ message: "User Not found." });
    }

    const passwordIsValid = bcrypt.compareSync(
      req.body.password,
      user.password
    );

    if (!passwordIsValid) {
      user.loginAttempts += 1;
      if (user.loginAttempts >= 3) {
        user.status = false; // Set status to false (locked)
        await user.save();
        return res.status(403).send({ message: "Account is locked due to multiple failed login attempts." });
      }
      await user.save();
      return res.status(401).send({
        message: "Invalid Password!",
      });
    }

    const accessToken = generateAccessToken({ id: user.id });
    const refreshToken = generateRefreshToken({ id: user.id });

    let authorities = [];
    const roles = await user.getRoles();
    for (let i = 0; i < roles.length; i++) {
      authorities.push("ROLE_" + roles[i].name.toUpperCase());
    }
    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.status = true; // Set status to true (unlocked)
    user.last_login = new Date();
    await user.save();
    // Set HTTP-only and secure cookies
    res.cookie('accessToken', accessToken, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'Strict', // Prevents CSRF attacks
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/' // Ensure the path is set to root
    });

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'Strict', // Prevents CSRF attacks
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/' // Ensure the path is set to root
    });

    return res.status(200).send({
      id: user.id,
      username: user.username,
      email: user.email,
      roles: authorities
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: error.message });
  }
};

// Refresh Token Endpoint
exports.refreshtoken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).send({ message: 'Refresh Token not provided' });
    }

    jwt.verify(refreshToken, privateKey, { algorithms: ['RS256'] }, (err, user) => {
      if (err) {
        return res.status(403).send({ message: 'Invalid Refresh Token' });
      }

      const newAccessToken = generateAccessToken({ id: user.id });

      res.cookie('accessToken', newAccessToken, {
        httpOnly: true,
        secure: false, // Set to true if using HTTPS
        sameSite: 'Strict', // Prevents CSRF attacks
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        path: '/' // Ensure the path is set to root
      });

      return res.status(200).send({ accessToken: newAccessToken });
    });
  } catch (error) {
    console.log(error);
    return res.status(500).send({ message: error.message });
  }
};


exports.signout = async (req, res) => {
  try {
    // Clear HTTP-only and secure cookies
    res.clearCookie('accessToken', {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'Strict',
      path: '/' // Ensure the path is set to root
    });

    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: false, // Set to true if using HTTPS
      sameSite: 'Strict',
      path: '/' // Ensure the path is set to root
    });

    // Clear session
    req.session = null;

    return res.status(200).send({
      message: "You've been signed out!"
    });
  } catch (err) {
    this.next(err);
  }
};


// Request Password Reset
exports.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const db = getDb();
    const User = db.user;
    const user = await User.findOne({
      where: {
        email: email,
      },
    });

    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    const token = jwt.sign({ email }, config.secret, { expiresIn: '1h' });
    const resetLink = `http://localhost:4200/password-reset/confirm?token=${token}`;


    const accessToken = await oAuth2Client.getAccessToken();
    console.log(accessToken);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        type: 'OAuth2',
        user: 'katakamdevelopertraining@gmail.com',
        clientId: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        refreshToken: REFRESH_TOKEN,
        accessToken: accessToken.token,
      },
    });
    const mailOptions = {
      from: 'katakamdevelopertraining@gmail.com',
      to: email,
      subject: 'Password Reset',
      text: `Click the link to reset your password: ${resetLink}`
    };
    const result = await transporter.sendMail(mailOptions);
    console.log('Email sent:', result);
    res.json({ message: 'Password reset link is sent to your mail' });
  } catch (error) {
    res.status(500).send({ message: error.message });
  }
};

// Confirm Password Reset
exports.confirmPasswordReset = async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const db = getDb();
    const User = db.user;
    const decoded = jwt.verify(token, config.secret);
    const user = await User.findOne({
      where: {
        email: decoded.email,
      },
    });

    if (!user) {
      return res.status(404).send({ message: "User not found." });
    }

    const hashedPassword = bcrypt.hashSync(newPassword, 8);
    user.password = hashedPassword;
    await user.save();

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    res.status(400).send({ message: 'Invalid or expired token' });
  }
};

// Generate Access Token
function generateAccessToken(user) {
  return jwt.sign({ id: user.id }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '24h', // 24 hours
  });
}

// Generate Refresh Token
function generateRefreshToken(user) {
  return jwt.sign({ id: user.id }, privateKey, {
    algorithm: 'RS256',
    expiresIn: '7d', // 7 days
  });
}
