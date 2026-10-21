const path = require("node:path");
const { pathToFileURL } = require("node:url");
function assetUrl(value, directory) {
  const url = new URL(value);
  if (
    url.protocol !== "app:" ||
    url.host !== "terminal" ||
    url.username ||
    url.password
  )
    throw new Error("Unknown terminal origin");
  const name = decodeURIComponent(url.pathname);
  if (
    name.includes("\\") ||
    name.includes("\0") ||
    name.split("/").includes("..")
  )
    throw new Error("Invalid terminal asset path");
  const root = path.resolve(directory);
  const file = path.resolve(root, "." + name);
  if (!file.startsWith(root + path.sep))
    throw new Error("Asset outside terminal bundle");
  return pathToFileURL(file).href;
}
module.exports = { assetUrl };
