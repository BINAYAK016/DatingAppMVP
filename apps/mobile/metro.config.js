const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
// Keep Expo's platform resolver and serializer. Only teach the web asset
// pipeline about the complete, locally bundled WOFF2 icon font.
if (!config.resolver.assetExts.includes("woff2")) {
  config.resolver.assetExts.push("woff2");
}
module.exports = config;
