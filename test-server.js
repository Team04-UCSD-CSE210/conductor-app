import express from "express";

const app = express();

app.get("/", (req, res) => {
  res.send('<h1>Conductor App - Test Server</h1><p>Server is working!</p>');
});

app.get("/health", (req, res) => {
  res.json({ status: "healthy", timestamp: new Date().toISOString() });
});

app.get("/auth/google/callback", (req, res) => {
  res.send('<h1>OAuth Callback</h1><p>This would handle Google OAuth</p>');
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Test server running at http://localhost:${PORT}`);
});
