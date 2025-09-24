// register
// login
// get user
// delete user
// routes/auth.js
const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/auth.controller");

// Body parser must be enabled in app (express.json())
// cookie-parser should be used in app for cookies

// POST /api/auth/register
router.post("/register", authCtrl.register);

// POST /api/auth/login
router.post("/login", authCtrl.login);

// GET /api/auth/me
router.get("/me", authCtrl.me);

// POST /api/auth/logout
router.post("/logout", authCtrl.logout);

module.exports = router;
