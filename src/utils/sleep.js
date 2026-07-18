// src/utils/sleep.js
module.exports = function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
