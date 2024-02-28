import packageJson from "./package.json";

/**
 * After changing, please reload the extension at `chrome://extensions`
 */
const manifest: chrome.runtime.ManifestV3 = {
  manifest_version: 3,
  name: "Hallyday AI",
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
  permissions: [
    "offscreen",
    "tabs",
    "tabCapture",
    "sidePanel",
    "storage",
    "notifications",
  ],
  side_panel: {
    default_path: "src/pages/sidepanel/index.html",
  },
  content_scripts: [
    {
      matches: ["https://meet.google.com/*"],
      js: ["src/pages/content/index.js"],
      // KEY for cache invalidation
      css: [],
    },
  ],
  web_accessible_resources: [
    {
      resources: [
        "assets/js/*.js",
        "requestPermissions.html",
        "requestPermissions.js",
        "supabase.js",
      ],
      matches: ["<all_urls>"],
    },
  ],
  host_permissions: ["*://*.hallyday-dashboard.vercel.app/*"],
  key: "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAl0hCdpZNg8mf4igR8/GUIASlpGxHgIqFL2kjd6UHVsQstWqjGdAbosiq01Aw300NvDGI4Y+RDGlV7PcZ3jRBVT+dqmIQotkoniC4mgLd3BgafdU6xFLIuUvnREHQrB68tKWH3sLTqsnMD2eZt6gauils9YwuIMsLa8BIizFcnj6ImGgWqY2wkRHT7R0RqVoYtkOghdCpcM4Ixm4FrbaOOaUK/OAH+c1dweP7Tn8H9qrN/WmfG5+ObV7KB8pGvO88Jb5VJGfq064D2O75AOdnetdeUg1NPQjITanAKxDCca6HaAbnhfvRMa57w/T1LIP7AOyqXBXZvXbFmGVWLuHu7wIDAQAB",
};

export default manifest;
