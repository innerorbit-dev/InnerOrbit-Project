/**
 * Last Updated: 2026-03-17
 * Purpose: Post-build cleanup for Web/Firebase deployments. Standardizes script types in index.html
 * to 'module' to support modern ESM output common in Expo 54+ builds.
 */
const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '../dist/index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // 1. Path Fixes
  // NOTE: We used to change / to ./ for Electron, but this breaks Firebase Hosting subroutes.
  // For Web, absolute paths (starting with /) are required for SPAs with clean URLs.
  // html = html.replace(/href="\//g, 'href="./');
  // html = html.replace(/src="\//g, 'src="./');

  // 2. Add type="module" to entry script tags
  // Required because Metro Web in Expo 54+ often outputs ESM (using import.meta)
  html = html.replace(/<script src/g, '<script type="module" src');

  fs.writeFileSync(indexPath, html);
  console.log('✅ Fixed paths and script types in dist/index.html');
} else {
  console.error('❌ Could not find dist/index.html to fix paths.');
  process.exit(1);
}
