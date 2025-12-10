#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

// Create public directory
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  fs.rmSync(publicDir, { recursive: true });
}
fs.mkdirSync(publicDir, { recursive: true });

// Copy src/public contents to public
const srcPublicDir = path.join(rootDir, 'src', 'public');
if (fs.existsSync(srcPublicDir)) {
  fs.cpSync(srcPublicDir, publicDir, { recursive: true });
}

// Copy src/views to public
const srcViewsDir = path.join(rootDir, 'src', 'views');
if (fs.existsSync(srcViewsDir)) {
  fs.cpSync(srcViewsDir, publicDir, { recursive: true });
}

// Copy src/assets to public/assets
const srcAssetsDir = path.join(rootDir, 'src', 'assets');
if (fs.existsSync(srcAssetsDir)) {
  const publicAssetsDir = path.join(publicDir, 'assets');
  fs.mkdirSync(publicAssetsDir, { recursive: true });
  fs.cpSync(srcAssetsDir, publicAssetsDir, { recursive: true });
}

console.log('✅ Build completed - static files copied to public directory');
