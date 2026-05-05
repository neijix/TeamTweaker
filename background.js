// TeamTweaker — Background Service Worker
// Handles extension install and provides badge updates.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Set defaults on first install
    chrome.storage.sync.set({
      sectioncolors: false,
      sectionColorsJSON: '{}',
      accent: false,
      accentColor: "#6264a7",
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
      unreadhighlight: false,
      unreadColor: "#6264a7",
      unreadBgColor: "",
      unreadEmoji: "",
      pinnedEmoji: "",
      activechat: false,
      activeChatEmoji: "",
      activeChatColor: "#6264a7",
      activeChatBgColor: "#6264a7",
      pinnedConversationsJSON: "[]",
    });
  }
});

// Open the side panel when the extension icon is clicked
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

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
