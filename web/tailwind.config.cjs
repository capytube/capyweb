// Reuses the React app's theme (../tailwind.config.js) and scans Rust sources for class names.
const base = require('../tailwind.config.js');
module.exports = { ...base, content: ['./index.html', './src/**/*.rs'] };
