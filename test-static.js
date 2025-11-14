#!/usr/bin/env node
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Test static file serving like Vercel production
app.use(express.static(path.join(__dirname, "public")));

// Test route
app.get('/test', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <link rel="stylesheet" href="/global.css" />
      <link rel="stylesheet" href="/landing-page.css" />
    </head>
    <body>
      <h1>CSS Test</h1>
      <p>If this is styled, CSS is working!</p>
    </body>
    </html>
  `);
});

app.listen(3000, () => {
  console.log('Test server running at http://localhost:3000');
  console.log('Visit http://localhost:3000/test to check CSS');
  console.log('Direct CSS: http://localhost:3000/global.css');
});
