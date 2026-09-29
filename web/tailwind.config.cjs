// Reuses the React app's theme (../tailwind.config.js) and scans Rust sources for class names.
const base = require('../tailwind.config.js');
const colors = { ...base.theme.extend.colors, leafGreen: 'var(--leaf-green)', alertRed: 'var(--alert-red)' };
module.exports = {
  ...base,
  content: ['./index.html', './src/**/*.rs'],
  theme: { ...base.theme, extend: { ...base.theme.extend, colors } },
};
