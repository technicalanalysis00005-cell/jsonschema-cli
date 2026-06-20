/**
 * Utility functions
 */

'use strict';

const path = require('path');

function jsonPointer(path) {
  if (!path || path === '#') return '#';
  return path;
}

function joinPath(base, key) {
  // Escape JSON Pointer special chars
  const escaped = String(key).replace(/~/g, '~0').replace(/\//g, '~1');
  return `${base}/${escaped}`;
}

function formatPath(path) {
  if (!path || path === '#') return '(root)';
  return path.replace(/^#\/?/, '/').replace(/~1/g, '/').replace(/~0/g, '~');
}

/**
 * ANSI color helpers — no dependency needed
 */
const supportsColor = !process.env.NO_COLOR && process.stdout.isTTY;

const c = {
  red: s => supportsColor ? `\x1b[31m${s}\x1b[0m` : s,
  green: s => supportsColor ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: s => supportsColor ? `\x1b[33m${s}\x1b[0m` : s,
  blue: s => supportsColor ? `\x1b[34m${s}\x1b[0m` : s,
  cyan: s => supportsColor ? `\x1b[36m${s}\x1b[0m` : s,
  gray: s => supportsColor ? `\x1b[90m${s}\x1b[0m` : s,
  bold: s => supportsColor ? `\x1b[1m${s}\x1b[0m` : s,
  dim: s => supportsColor ? `\x1b[2m${s}\x1b[0m` : s,
};

function pluralize(count, singular, plural) {
  return count === 1 ? singular : (plural || singular + 's');
}

module.exports = { jsonPointer, joinPath, formatPath, c, pluralize };
