const path = require('path');
const thisDir = path.resolve(__dirname);
module.exports = function override(config, env) {
  config.resolve.modules.push(`${thisDir}/src`);
  config.resolve.modules.push(`${thisDir}`);

  // Dev only: bust the Cloudflare 4h edge cache on bom.kckern.net by giving
  // every JS asset a content-derived URL. Two layers needed:
  //   1. Main bundle is `<script src="/static/js/bundle.js">` injected by
  //      HtmlWebpackPlugin — set `hash: true` so the tag gets `?<webpack-hash>`.
  //   2. Code-split chunks (e.g. `src_views_Map_Map_js.chunk.js`) are loaded
  //      by webpack's runtime, which constructs URLs from `output.chunkFilename`.
  //      Inject `[contenthash:8]` into that template so each chunk's URL
  //      changes when its content changes.
  // index.html is served as DYNAMIC by Cloudflare, so visitors always get the
  // latest hashes.
  if (env === 'development') {
    config.plugins.forEach((p) => {
      if (p && p.constructor && p.constructor.name === 'HtmlWebpackPlugin') {
        p.userOptions = p.userOptions || {};
        p.userOptions.hash = true;
        if (p.options) p.options.hash = true;
      }
    });
    if (config.output) {
      config.output.chunkFilename = 'static/js/[name].[contenthash:8].chunk.js';
    }
  }

  return config;
};