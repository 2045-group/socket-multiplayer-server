// Validation
// send resultation
// controllers/authController.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/userModel");

// helper: create jwt token
const createToken = (payload) => {
  const secret = process.env.JWT_SECRET || "dev_secret";
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return jwt.sign(payload, secret, { expiresIn });
};

// helper: send token both in body and httpOnly cookie
const sendToken = (res, user) => {
  const token = createToken({ id: user._id });
  // cookie options
  const cookieOptions = {
    httpOnly: true,
    // secure true in prod (https), sameSite depending on client/server config
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  };
  res.cookie("token", token, cookieOptions);
  // Return sanitized user object
  const safeUser = {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
  return res.status(200).json({ user: safeUser, token });
};

exports.register = async (req, res, next) => {
  try {
    const { username, email, password } = req.body || {};

    if (!username || !email || !password) {
      return res
        .status(400)
        .json({ message: "username, email and password are required" });
    }

    if (username.trim().length < 3) {
      return res
        .status(400)
        .json({ message: "username must be at least 3 characters" });
    }
    if (password.length < 4) {
      return res
        .status(400)
        .json({ message: "password must be at least 4 characters" });
    }

    // check existing email or username
    const exists = await User.findOne({ $or: [{ email }, { username }] });
    if (exists) {
      return res
        .status(409)
        .json({ message: "User with this email or username already exists" });
    }

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = new User({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashed,
    });

    await user.save();

    // send token + user
    return sendToken(res, user);
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: "email and password required" });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return sendToken(res, user);
  } catch (err) {
    next(err);
  }
};

exports.me = async (req, res, next) => {
  try {
    // Try token from header 'Authorization: Bearer <token>'
    // or cookie 'token'
    let token = null;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer "))
      token = authHeader.split(" ")[1];
    if (!token && req.cookies && req.cookies.token) token = req.cookies.token;

    if (!token) return res.status(401).json({ message: "Not authenticated" });

    const secret = process.env.JWT_SECRET || "dev_secret";
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch (e) {
      return res.status(401).json({ message: "Invalid token" });
    }

    const user = await User.findById(payload.id).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    return res.status(200).json({ user });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    // clear cookie
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });
    return res.status(200).json({ message: "Logged out" });
  } catch (err) {
    next(err);
  }
};
