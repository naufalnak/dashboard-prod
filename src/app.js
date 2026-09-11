require("dotenv").config();

const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const ipAllowlist = require("./lib/ipAllowlist");
const errorHandler = require("./middlewares/errorHandler");

const app = express();

app.set("trust proxy", 1);

app.use(ipAllowlist);
app.use(morgan("tiny"));
app.use(cors());
app.use(express.json());

// API
app.use("/api", require("./routes"));

// Frontend React (hanya kalau web/dist ada)
const webDist = path.join(__dirname, "..", "web", "dist");

if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));

  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(webDist, "index.html"));
  });
}

// Error handler paling terakhir
app.use(errorHandler);

module.exports = app;