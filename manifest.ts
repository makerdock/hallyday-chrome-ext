import packageJson from "./package.json";

/**
 * After changing, please reload the extension at `chrome://extensions`
 */
const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: "Meeting recorder TS",
  version: packageJson.version,
  description: packageJson.description,
  background: {
    service_worker: "src/pages/background/index.js",
    type: "module",
  },
  action: {
    default_icon: "icon-34.png",
  },
  icons: {
    "128": "icon-128.png",
  },
  permissions: ["offscreen", "tabs", "tabCapture", "sidePanel", "activeTab"],
  side_panel: {
    default_path: "src/pages/sidepanel/index.html",
  },
  content_scripts: [
    {
      matches: ["https://meet.google.com/*"],
      js: ["src/pages/content/index.js"],
      // KEY for cache invalidation
      css: ["assets/css/contentStyle<KEY>.chunk.css"],
    },
  ],
  web_accessible_resources: [
    {
      resources: ["requestPermissions.html", "requestPermissions.js"],
      matches: ["<all_urls>"],
    },
  ],
};

export default manifest;
