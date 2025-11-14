#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Serve static files like vercel dev does (from src directories)
app.use(express.static(path.join(__dirname, "src/views")));
app.use(express.static(path.join(__dirname, "src/public")));

// Simple login route
app.get("/", (req, res) => {
  res.redirect("/login");
});

app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "src/views/login.html"));
});

app.listen(3001, () => {
  console.log('Test server at http://localhost:3001');
  console.log('Visit http://localhost:3001/login to test CSS');
});
