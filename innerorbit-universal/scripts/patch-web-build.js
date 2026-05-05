/**
 * Last Updated: 2026-03-17
 * Purpose: Prepares the production web build for Electron compatibility by converting absolute paths
 * to relative ones and injecting necessary environment shims (process, __dirname, path).
 */
const fs = require('fs');
const path = require('path');

const distPath = path.join(__dirname, '../dist/index.html');

if (fs.existsSync(distPath)) {
  let html = fs.readFileSync(distPath, 'utf8');

  // Replace absolute paths with relative paths
  html = html.replace(/"\/_expo\//g, '"./_expo/');
  html = html.replace(/"\/assets\//g, '"./assets/');
  html = html.replace(/"\/favicon.ico"/g, '"./favicon.ico"');

  // Basic fix for Expo Router history mode on File Protocol
  // We strictly redirect to hash router or ensure base is current
  // But mostly, just fixing asset loading is enough for it to start.

  // Inject Shims for __dirname, process, path, and require (Fixes ReferenceError in Electron)
  const shim = `
  <script>
    window.__dirname = '/';
    window.__filename = '/index.html';
    window.process = { env: { NODE_ENV: 'production' }, platform: 'browser' };
    window.global = window;
    
    // Basic path polyfill
    window.path = {
      join: function(...args) {
        return args.join('/').replace(/\\/+/g, '/');
      },
      resolve: function(...args) {
        return '/' + args.join('/').replace(/\\/+/g, '/');
      },
      dirname: function(p) {
        return p.split('/').slice(0, -1).join('/') || '/';
      },
      basename: function(p) {
        return p.split('/').pop();
      },
      sep: '/'
    };
    
    // Polyfill require for path module
    window.require = window.require || function(moduleName) {
      if (moduleName === 'path') {
        return window.path;
      }
      return {};
    };
  </script>
  `;

  // Insert shim before the first script tag
  if (html.includes('<script')) {
    html = html.replace('<script', shim + '<script');
  } else {
    // Fallback: append to head
    html = html.replace('</head>', shim + '</head>');
  }

  fs.writeFileSync(distPath, html);
  console.log('✅ Patched index.html for Electron (Relative Paths)');
} else {
  console.error('❌ dist/index.html not found!');
  process.exit(1);
}
