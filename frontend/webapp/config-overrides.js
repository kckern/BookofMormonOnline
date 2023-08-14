const path = require('path');
const thisDir = path.resolve(__dirname);
module.exports = function override(config, env) {
  config.resolve.modules.push(`${thisDir}/src`);
  config.resolve.modules.push(`${thisDir}`);
  return config;
};