require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();

app.use(express.json());

app.use(
  cors({
    origin: process.env.ALLOWED_ORIGIN,
  }),
);

app.post("/check-password", (req, res) => {
  const { password } = req.body;

  if (!password) {
    return res.status(400).json({
      allowed: false,
      message: "Password is required",
    });
  }

  if (password === process.env.WOD_PASSWORD) {
    return res.json({
      allowed: true,
      message: "Password accepted",
    });
  }

  return res.status(401).json({
    allowed: false,
    message: "Incorrect password",
  });
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`WOD auth server running on port ${port}`);
});
