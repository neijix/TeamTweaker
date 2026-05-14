// TeamTweaker — Background Service Worker
// Handles extension install and provides badge updates.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set defaults on first install — Blood Dragon theme active by default
    chrome.storage.sync.set({
      sectioncolors: true,
      sectionColorsJSON: '{}',
      sectionGradientPrimary: "#ad1457",
      accent: true,
      accentColor: "#c2185b",
      readability: false,
      fontSize: 14,
      bubbles: false,
      declutter: false,
      smooth: false,
      narrowsidebar: false,
      customfont: false,
      custombackground: false,
      customBackgroundTint: false,
      customBackgroundTintColor: "#0f0f14",
      customBackgroundTintOpacity: 45,
      fontFamily: "Segoe UI",
      unreadhighlight: true,
      unreadColor: "#047857",
      unreadBgColor: "#d1fae5",
      unreadEmoji: "",
      pinnedEmoji: "",
      activechat: true,
      activeChatEmoji: "",
      activeChatColor: "#5b21b6",
      activeChatBgColor: "#ede9fe",
      pinnedConversationsJSON: "[]",
    });
  }
});

// Open the side panel when the extension icon is clicked.
// Chrome/Edge: setPanelBehavior overrides the default_popup and opens the side panel instead.
// Opera: sidePanel API is absent, so default_popup in manifest.json kicks in and opens the popup normally.
if (chrome.sidePanel) {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
}

// Update badge to show how many features are active
function updateBadge() {
  const toggles = [
    "sectioncolors", "accent", "readability", "bubbles",
    "declutter", "smooth", "narrowsidebar", "customfont",
    "custombackground", "unreadhighlight", "activechat",
  ];

  chrome.storage.sync.get(toggles, (settings) => {
    const count = toggles.filter((k) => settings[k]).length;
    chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    chrome.action.setBadgeBackgroundColor({ color: "#6264a7" });
  });
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") updateBadge();
});

// Set badge on startup
updateBadge();
