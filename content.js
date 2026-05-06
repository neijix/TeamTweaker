// TeamTweaker — Content Script
// Reads user settings from chrome.storage and applies CSS classes to <html>.

const FEATURE_CLASSES = {
  sectioncolors: "tf-sectioncolors",
  accent:        "tf-accent",
  readability:   "tf-readability",
  bubbles:       "tf-bubbles",
  declutter:     "tf-declutter",
  smooth:        "tf-smooth",
  narrowsidebar:    "tf-narrowsidebar",
  customfont:       "tf-customfont",
  custombackground: "tf-custombackground",
  unreadhighlight:  "tf-unreadhighlight",
  activechat:       "tf-activechat",
};

const DEFAULTS = {
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
  customBackgroundTint: false,
  customBackgroundTintColor: "#0f0f14",
  customBackgroundTintOpacity: 45,
};

// Guard every storage call: if the extension context has been invalidated
// (e.g. after a reload in dev), silently skip rather than throwing.
function safeStorageGet(cb) {
  try {
    if (!chrome.runtime?.id) return;
    chrome.storage.sync.get(DEFAULTS, cb);
  } catch (e) {
    // Extension context invalidated — nothing to do.
  }
}

let _currentSettings = { ...DEFAULTS };

/** Image bytes live in chrome.storage.local (not sync). Keys must match panel/popup.js. */
const TF_BACKGROUND_IMAGE_DATA_URL = "tf_background_image_data_url";
const TF_BACKGROUND_IMAGE_NAME = "tf_background_image_name";
const TF_BACKGROUND_STYLE_ID = "tf-custom-background-style";
const TF_WALLPAPER_UNDERLAY_ID = "tf-wallpaper-underlay";

/** Single style node (may be created before <head> exists — not always in DOM yet). */
let _tfCustomBgStyleEl = null;
let _tfWallpaperUnderlayEl = null;

/** Short blob: URL for stylesheet/CSP-friendly display; revoked when wallpaper clears or replaces. */
let _tfWallpaperBlobUrl = null;

/** Escape a data URL for use inside double quotes in a dynamically injected stylesheet. */
function escapeDataUrlForCssQuotes(dataUrl) {
  return String(dataUrl).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Parse #rgb / #rrggbb for tint overlay (defaults to dark gray-blue). */
function tfHexToRgbComponents(hex) {
  const s = String(hex || "").trim();
  let m = /^#?([0-9a-f]{6})$/i.exec(s);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }
  m = /^#?([0-9a-f]{3})$/i.exec(s);
  if (m) {
    const t = m[1];
    return {
      r: parseInt(t[0] + t[0], 16),
      g: parseInt(t[1] + t[1], 16),
      b: parseInt(t[2] + t[2], 16),
    };
  }
  return { r: 15, g: 15, b: 20 };
}

/** Semi-transparent overlay color for stacked backgrounds (0–100 → alpha). */
function tfBuildTintRgba(hex, opacityPct) {
  const a = Math.min(1, Math.max(0, Number(opacityPct) / 100));
  const { r, g, b } = tfHexToRgbComponents(hex);
  return "rgba(" + r + "," + g + "," + b + "," + a + ")";
}

function revokeTfWallpaperBlob() {
  if (_tfWallpaperBlobUrl) {
    try {
      URL.revokeObjectURL(_tfWallpaperBlobUrl);
    } catch {
      /* no-op */
    }
    _tfWallpaperBlobUrl = null;
  }
}

/** Prefer blob: URLs — very long data: strings often fail in style attributes / CSP edge cases. */
function resolveWallpaperDisplayUrl(dataUrl) {
  return fetch(dataUrl)
    .then((r) => r.blob())
    .then((blob) => {
      revokeTfWallpaperBlob();
      _tfWallpaperBlobUrl = URL.createObjectURL(blob);
      return _tfWallpaperBlobUrl;
    })
    .catch(() => dataUrl);
}

function mountTfBackgroundStyleElement(el) {
  if (el.parentNode) return;
  const mount = () => {
    try {
      (document.head || document.documentElement).appendChild(el);
    } catch {
      /* invalid extension context */
    }
  };
  if (document.head) mount();
  else document.addEventListener("DOMContentLoaded", mount, { once: true });
}

/**
 * Apply wallpaper via an extension-owned <style> node (not only --tf-bg-image on <html>).
 * Some pages restrict very large inline style properties or data: URLs on inline styles;
 * a stylesheet node matches manifest CSS injection behavior more closely.
 */
/**
 * @param {object} [tint] — when set and enabled, draws a solid gradient layer above the image
 */
function syncTfBackgroundStylesheet(dataUrl, active, tint) {
  if (!active || !dataUrl) {
    if (_tfCustomBgStyleEl) _tfCustomBgStyleEl.textContent = "";
    return;
  }
  if (!_tfCustomBgStyleEl) {
    _tfCustomBgStyleEl = document.getElementById(TF_BACKGROUND_STYLE_ID);
  }
  if (!_tfCustomBgStyleEl) {
    _tfCustomBgStyleEl = document.createElement("style");
    _tfCustomBgStyleEl.id = TF_BACKGROUND_STYLE_ID;
    mountTfBackgroundStyleElement(_tfCustomBgStyleEl);
  }
  const u = escapeDataUrlForCssQuotes(dataUrl);
  const op = tint && Number(tint.opacity);
  const useTint = !!(tint && tint.enabled && !Number.isNaN(op) && op > 0);
  let bgImage;
  let bgSize;
  let bgPos;
  let bgRepeat;
  let bgAttach;
  if (useTint) {
    const rgba = tfBuildTintRgba(tint.color, tint.opacity);
    /* First layer = top: readability tint; second = wallpaper */
    bgImage = "linear-gradient(" + rgba + "," + rgba + '),url("' + u + '")';
    bgSize = "cover,cover";
    bgPos = "center,center";
    bgRepeat = "no-repeat,no-repeat";
    bgAttach = "scroll,scroll";
  } else {
    bgImage = 'url("' + u + '")';
    bgSize = "cover";
    bgPos = "center";
    bgRepeat = "no-repeat";
    bgAttach = "scroll";
  }
  /* Wallpaper only in the chat thread — not full viewport (avoids load flash / pre-join overlays). */
  _tfCustomBgStyleEl.textContent =
    'html.tf-custombackground [data-tid="message-pane-body"],' +
    'html.tf-custombackground [data-tid="message-pane-list-container"]{' +
    "background-image:" +
    bgImage +
    "!important;background-size:" +
    bgSize +
    "!important;background-position:" +
    bgPos +
    "!important;background-repeat:" +
    bgRepeat +
    "!important;background-attachment:" +
    bgAttach +
    "!important}";
}

/** One-line console check for support (content script log — pick “content.js” in DevTools if filtered). */
function debugLogWallpaperState(via) {
  try {
    const st = document.getElementById(TF_BACKGROUND_STYLE_ID);
    const txt = st && st.textContent ? st.textContent : "";
    console.info(
      "[TeamTweaker] wallpaper " + via,
      "html.tf-custombackground=" +
        document.documentElement.classList.contains(FEATURE_CLASSES.custombackground) +
        " injected-style-chars=" +
        txt.length +
        " chat-pane-body=" +
        !!document.querySelector('[data-tid="message-pane-body"]')
    );
  } catch {
    /* no-op */
  }
}

/**
 * Remove legacy full-screen #tf-wallpaper-underlay <img> from earlier extension builds.
 * Wallpaper is applied only on chat panes via syncTfBackgroundStylesheet.
 */
function syncTfWallpaperImg(_displayUrl, active) {
  try {
    if (_tfWallpaperUnderlayEl) {
      try {
        _tfWallpaperUnderlayEl.remove();
      } catch {
        /* no-op */
      }
      _tfWallpaperUnderlayEl = null;
    }
    const orphan = document.getElementById(TF_WALLPAPER_UNDERLAY_ID);
    if (orphan) orphan.remove();
  } catch {
    /* no-op */
  }
  if (!active) return;
}

function applyCustomBackgroundLayer(_settings) {
  try {
    if (!chrome.storage?.local || !chrome.storage?.sync) return;
    /*
     * Must read sync `custombackground` in the same turn as local image bytes.
     * When the user picks a file, `storage.onChanged` for **local** often fires
     * before `custombackground: true` is written to **sync** in the save callback —
     * using a stale `settings` from `safeStorageGet` made `on` false and skipped the wallpaper.
     */
    chrome.storage.sync.get(
      {
        custombackground: DEFAULTS.custombackground,
        customBackgroundTint: DEFAULTS.customBackgroundTint,
        customBackgroundTintColor: DEFAULTS.customBackgroundTintColor,
        customBackgroundTintOpacity: DEFAULTS.customBackgroundTintOpacity,
      },
      (sync) => {
      try {
        if (!chrome.runtime?.id) return;
        chrome.storage.local.get({ [TF_BACKGROUND_IMAGE_DATA_URL]: "" }, (local) => {
          try {
            if (!chrome.runtime?.id) return;
            const root = document.documentElement;
            const url = local[TF_BACKGROUND_IMAGE_DATA_URL] || "";
            const on = !!(sync.custombackground && url);

            if (!on) {
              root.classList.toggle(FEATURE_CLASSES.custombackground, false);
              root.style.removeProperty("--tf-bg-image");
              revokeTfWallpaperBlob();
              syncTfBackgroundStylesheet("", false);
              syncTfWallpaperImg("", false);
              return;
            }

            root.classList.toggle(FEATURE_CLASSES.custombackground, true);

            const tintOpts = {
              enabled: !!sync.customBackgroundTint,
              color: sync.customBackgroundTintColor || DEFAULTS.customBackgroundTintColor,
              opacity:
                sync.customBackgroundTintOpacity != null
                  ? sync.customBackgroundTintOpacity
                  : DEFAULTS.customBackgroundTintOpacity,
            };

            resolveWallpaperDisplayUrl(url).then((displayUrl) => {
              if (!chrome.runtime?.id) return;
              root.style.removeProperty("--tf-bg-image");
              syncTfBackgroundStylesheet(displayUrl, true, tintOpts);
              syncTfWallpaperImg(displayUrl, true);
              debugLogWallpaperState("blob/display url");
            }).catch(() => {
              if (!chrome.runtime?.id) return;
              root.style.removeProperty("--tf-bg-image");
              syncTfBackgroundStylesheet(url, true, tintOpts);
              syncTfWallpaperImg(url, true);
              debugLogWallpaperState("fallback data url");
            });
          } catch {
            /* extension context invalidated */
          }
        });
      } catch {
        /* extension context invalidated */
      }
    });
  } catch {
    /* no chrome.storage */
  }
}

function applySettings(settings, forceRescan) {
  _currentSettings = { ...DEFAULTS, ...settings };
  const root = document.documentElement;

  // Toggle feature classes (`custombackground` is driven only by applyCustomBackgroundLayer:
  // sync toggle + local image URL — never toggle it here or it can stick on without a stored URL.)
  for (const [key, cls] of Object.entries(FEATURE_CLASSES)) {
    if (key === "custombackground") continue;
    root.classList.toggle(cls, !!_currentSettings[key]);
  }

  // CSS custom properties for dynamic values
  root.style.setProperty("--tf-accent-color", _currentSettings.accentColor || DEFAULTS.accentColor);
  root.style.setProperty(
    "--tf-accent-hover",
    adjustBrightness(_currentSettings.accentColor || DEFAULTS.accentColor, -15)
  );
  root.style.setProperty(
    "--tf-accent-pressed",
    adjustBrightness(_currentSettings.accentColor || DEFAULTS.accentColor, -30)
  );
  root.style.setProperty("--tf-font-size", (_currentSettings.fontSize || DEFAULTS.fontSize) + "px");
  root.style.setProperty("--tf-font-family", _currentSettings.fontFamily || DEFAULTS.fontFamily);

  // Unread highlight color
  const unreadColor = _currentSettings.unreadColor;
  root.style.setProperty("--tf-unread-color", unreadColor || "inherit");
  // Unread text highlight (marker effect) — raw color or transparent if not set
  const unreadBg = _currentSettings.unreadBgColor;
  root.style.setProperty("--tf-unread-highlight", unreadBg || "transparent");

  // Active chat color
  const acColor = _currentSettings.activeChatColor;
  const acBgColor = _currentSettings.activeChatBgColor;
  root.style.setProperty("--tf-activechat-color", acColor || "inherit");
  root.style.setProperty("--tf-activechat-bg", acBgColor || "transparent");
  root.style.setProperty("--tf-activechat-accent", acBgColor || "transparent");

  // Per-section sidebar colors
  applySectionColors(_currentSettings, forceRescan);

  // Unread emoji badges
  applyAllConversationEmojis(_currentSettings);

  applyCustomBackgroundLayer(_currentSettings);
}

// ---- Conversation emoji markers (pinned / unread / active) ----
// Order in the name cell: pinned → unread → active. Rebuilt whenever storage or DOM updates.

const UNREAD_EMOJI_CLASS = "tf-unread-emoji";
const PINNED_EMOJI_CLASS = "tf-pinned-emoji";
const ACTIVE_CHAT_EMOJI_CLASS = "tf-activechat-emoji";

function clearConversationEmojiMarkers() {
  document
    .querySelectorAll(`.${UNREAD_EMOJI_CLASS},.${PINNED_EMOJI_CLASS},.${ACTIVE_CHAT_EMOJI_CLASS}`)
    .forEach((el) => el.remove());
}

function normalizeConvNameForPin(s) {
  return (s || "").trim();
}

function isPinnedConvName(convName) {
  const list = getPinnedList();
  const n = normalizeConvNameForPin(convName);
  return list.some((p) => normalizeConvNameForPin(p.name) === n);
}

function isLeafConversationRow(row) {
  if (!row || !row.matches('.fui-TreeItem[role="treeitem"]')) return false;
  if (row.hasAttribute("data-tf-section")) return false;
  if (row.querySelector(':scope > [role="group"]')) return false;
  return true;
}

function isActiveConversationRow(row) {
  if (!isLeafConversationRow(row)) return false;
  if (row.getAttribute("tabindex") === "0") return true;
  if (row.getAttribute("aria-selected") === "true") return true;
  const ac = row.getAttribute("aria-current");
  if (ac === "true" || ac === "location") return true;
  return false;
}

function insertEmojiAfterPriorMarkers(nameEl, className, emoji, priorClasses) {
  const badge = document.createElement("span");
  badge.className = className;
  badge.textContent = emoji + " ";
  badge.style.cssText = "font-style:normal;font-weight:normal;pointer-events:none;";
  const sel = priorClasses.map((c) => `.${c}`).join(", ");
  const priors = sel ? nameEl.querySelectorAll(sel) : [];
  const last = priors.length ? priors[priors.length - 1] : null;
  if (last) last.after(badge);
  else nameEl.insertBefore(badge, nameEl.firstChild);
}

function applyPinnedEmoji(settings) {
  const emoji = (settings.pinnedEmoji || "").trim();
  if (!emoji) return;

  const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
  if (!rail) return;

  for (const row of rail.querySelectorAll('.fui-TreeItem[role="treeitem"]')) {
    if (!isLeafConversationRow(row)) continue;
    const convName = findConvNameFromRow(row);
    if (!convName || !isPinnedConvName(convName)) continue;
    const nameEl = findConversationNameElement(row);
    if (!nameEl || nameEl.querySelector(`.${PINNED_EMOJI_CLASS}`)) continue;

    const badge = document.createElement("span");
    badge.className = PINNED_EMOJI_CLASS;
    badge.textContent = emoji + " ";
    badge.style.cssText = "font-style:normal;font-weight:normal;pointer-events:none;";
    nameEl.insertBefore(badge, nameEl.firstChild);
  }
}

function applyUnreadEmoji(settings) {
  const emoji = settings.unreadhighlight ? (settings.unreadEmoji || "").trim() : "";
  if (!emoji) return;

  const rows = document.querySelectorAll(
    '[data-tid="simple-collab-dnd-rail"] .fui-TreeItem:has([data-tid="unread"])'
  );

  for (const row of rows) {
    if (!isLeafConversationRow(row)) continue;
    const nameEl = findConversationNameElement(row);
    if (!nameEl || nameEl.querySelector(`.${UNREAD_EMOJI_CLASS}`)) continue;
    insertEmojiAfterPriorMarkers(nameEl, UNREAD_EMOJI_CLASS, emoji, [PINNED_EMOJI_CLASS]);
  }
}

function applyActiveChatEmoji(settings) {
  const emoji = settings.activechat ? (settings.activeChatEmoji || "").trim() : "";
  if (!emoji) return;

  const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
  if (!rail) return;

  for (const row of rail.querySelectorAll('.fui-TreeItem[role="treeitem"]')) {
    if (!isActiveConversationRow(row)) continue;
    const nameEl = findConversationNameElement(row);
    if (!nameEl || nameEl.querySelector(`.${ACTIVE_CHAT_EMOJI_CLASS}`)) continue;
    insertEmojiAfterPriorMarkers(nameEl, ACTIVE_CHAT_EMOJI_CLASS, emoji, [
      PINNED_EMOJI_CLASS,
      UNREAD_EMOJI_CLASS,
    ]);
  }
}

function applyAllConversationEmojis(settings) {
  clearConversationEmojiMarkers();
  applyPinnedEmoji(settings);
  applyUnreadEmoji(settings);
  applyActiveChatEmoji(settings);
}

function findConversationNameElement(row) {
  // The conversation name is usually inside an element with truncation styling
  // or the first text-bearing child that isn't a badge/timestamp.
  // Strategy: walk the row and find the first element whose direct text looks
  // like a name (not a time, not a count).
  const candidates = row.querySelectorAll("span, div");
  for (const el of candidates) {
    // Skip the unread badge
    if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
    // Skip elements that are just numbers (timestamps, counters)
    const text = el.textContent.trim();
    if (!text || text.length > 60) continue;
    if (/^\d{1,2}:\d{2}/.test(text)) continue;
    if (/^\d+$/.test(text)) continue;

    // Check for direct text (not just inherited from children)
    let directText = "";
    for (const node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) directText += node.textContent;
    }
    directText = directText.trim();
    if (!directText || directText.length < 2) continue;

    // Good candidate — this looks like the conversation name
    return el;
  }
  return null;
}

// ---- Section Colors Engine ----
// Match the visible section label, then apply the color to the row-like
// ancestor that actually owns the background in Teams.

const SECTION_TEXT_MAX_LENGTH = 80;
const SECTION_DEFAULT_COLOR = "#6264a7";
const SECTION_SOURCE_SELECTOR = [
  "button",
  "a",
  "[role=\"button\"]",
  "[role=\"tab\"]",
  "[role=\"treeitem\"]",
  "[role=\"listitem\"]",
  "[role=\"menuitem\"]",
  "[role=\"option\"]",
  "[role=\"row\"]",
  "[aria-label]",
  "[title]",
  "[data-tid]",
  "[aria-expanded]",
  "li",
].join(", ");
const SECTION_ROW_SELECTOR = [
  "button",
  "a",
  "[role=\"button\"]",
  "[role=\"tab\"]",
  "[role=\"treeitem\"]",
  "[role=\"listitem\"]",
  "[role=\"menuitem\"]",
  "[role=\"option\"]",
  "[role=\"row\"]",
  "[aria-expanded]",
  "li",
].join(", ");

let _tfStyleEl = null;
let _tfSectionColorInput = null;
let _sectionContextMenuInitialized = false;
let _lastSectionColorsJSON = null;
let _sectionObserver = null;
let _suppressObserver = false;
let _cachedAppBar = null;

function getStyleSheet() {
  if (!_tfStyleEl || !_tfStyleEl.parentNode) {
    _tfStyleEl = document.createElement("style");
    _tfStyleEl.id = "teamtweaker-section-colors";
    (document.head || document.documentElement).appendChild(_tfStyleEl);
  }
  return _tfStyleEl;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeSectionKey(value) {
  return normalizeText(value).toLowerCase();
}

function cleanDataTid(value) {
  const raw = normalizeText(value);
  if (!raw) return "";
  return raw.replace(/^app-bar-/, "").replace(/-button$/, "").replace(/-/g, " ");
}

function parseSectionMap(json) {
  try {
    const parsed = JSON.parse(json || "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function findSectionMapKey(map, sectionName) {
  const normalizedName = normalizeSectionKey(sectionName);
  if (!normalizedName) return "";
  return Object.keys(map).find((key) => normalizeSectionKey(key) === normalizedName) || "";
}

// Parse a section value that may be a legacy string ("#hex") or new object ({bg, text}).
function parseSectionValue(value) {
  if (typeof value === "string") {
    // Legacy format — treat string as bg color, default text to white
    return { bg: value, text: "#ffffff" };
  }
  if (value && typeof value === "object") {
    return { bg: value.bg || SECTION_DEFAULT_COLOR, text: value.text || "#ffffff" };
  }
  return { bg: SECTION_DEFAULT_COLOR, text: "#ffffff" };
}

function getSectionLookup(settings) {
  return Object.entries(parseSectionMap(settings.sectionColorsJSON))
    .map(([name, value]) => {
      const { bg, text } = parseSectionValue(value);
      return {
        name,
        normalized: normalizeSectionKey(name),
        bg,
        text,
        safeId: name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase(),
      };
    })
    .filter((entry) => entry.normalized && entry.bg);
}

function getDirectText(el) {
  let direct = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      direct += node.textContent;
    }
  }
  return normalizeText(direct);
}

function getShortTextContent(el) {
  const full = normalizeText(el.textContent || "");
  if (!full || full.length > SECTION_TEXT_MAX_LENGTH) return "";
  return full;
}

function getTextCandidates(el) {
  return [
    normalizeText(el.getAttribute("aria-label")),
    normalizeText(el.getAttribute("title")),
    cleanDataTid(el.getAttribute("data-tid")),
    getDirectText(el),
    getShortTextContent(el),
  ].filter((value, index, values) => value && values.indexOf(value) === index);
}

function matchesSectionLabel(normalizedText, normalizedSectionName) {
  if (!normalizedText || !normalizedSectionName) return false;
  if (normalizedText === normalizedSectionName) return true;

  return [
    `${normalizedSectionName}:`,
    `${normalizedSectionName} -`,
    `${normalizedSectionName} |`,
    `${normalizedSectionName} (`,
  ].some((prefix) => normalizedText.startsWith(prefix));
}

function findLookupMatch(textCandidates, lookup) {
  for (const text of textCandidates) {
    const normalizedText = normalizeSectionKey(text);
    if (!normalizedText) continue;
    for (const entry of lookup) {
      if (matchesSectionLabel(normalizedText, entry.normalized)) {
        return entry;
      }
    }
  }
  return null;
}

function collectSectionCandidateElements() {
  const root = document.body || document.documentElement;
  if (!root) return [];

  const elements = new Set();
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.parentElement) return NodeFilter.FILTER_REJECT;
      const text = normalizeText(node.textContent || "");
      if (!text || text.length > SECTION_TEXT_MAX_LENGTH) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  while (walker.nextNode()) {
    elements.add(walker.currentNode.parentElement);
  }

  root.querySelectorAll(SECTION_SOURCE_SELECTOR).forEach((el) => {
    elements.add(el);
  });

  return Array.from(elements);
}

function isReasonableSectionTarget(el, sourceRect) {
  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;
  if (rect.height < 18 || rect.height > 96) return false;
  if (rect.width < Math.max(120, sourceRect.width)) return false;

  const style = window.getComputedStyle(el);
  if (style.display === "inline" || style.visibility === "hidden") {
    return false;
  }

  return true;
}

function findSectionColorTarget(sourceEl) {
  const sourceRect = sourceEl.getBoundingClientRect();
  let bestTarget = sourceEl;
  let bestScore = -Infinity;

  for (let el = sourceEl; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    if (!isReasonableSectionTarget(el, sourceRect)) continue;

    const rect = el.getBoundingClientRect();
    let score = 0;

    if (el.hasAttribute("aria-expanded")) score += 80;
    if (el.matches("button, a, [role=\"button\"], [role=\"treeitem\"], [role=\"tab\"]")) score += 40;
    if (el.matches(SECTION_ROW_SELECTOR)) score += 20;
    if (el.hasAttribute("data-tid")) score += 10;
    if (el !== sourceEl) score += 12;
    score += Math.min(30, Math.round(rect.width / 20));
    score -= Math.abs(rect.height - 36);

    if (score > bestScore) {
      bestScore = score;
      bestTarget = el;
    }
  }

  return bestTarget;
}

function scoreSectionMatch(sourceEl, targetEl) {
  const targetRect = targetEl.getBoundingClientRect();
  let score = 0;

  if (sourceEl.hasAttribute("aria-expanded")) score += 50;
  if (targetEl.hasAttribute("aria-expanded")) score += 100;
  if (targetEl.matches("button, a, [role=\"button\"], [role=\"treeitem\"], [role=\"tab\"]")) score += 40;
  if (targetEl.matches(SECTION_ROW_SELECTOR)) score += 20;
  if (targetEl.hasAttribute("data-tid")) score += 10;
  if (targetEl !== sourceEl) score += 10;
  if (sourceEl === targetEl) score -= 10;
  score += Math.min(40, Math.round(targetRect.width / 16));

  // Strongly prefer an element that is already tagged for this section —
  // this prevents displacing a correct header just because Teams toggled
  // aria-expanded during a collapse/expand animation.
  if (targetEl.hasAttribute("data-tf-section")) score += 200;

  // Penalise elements that live inside the narrow app-bar / icon rail —
  // those are nav icons, not section content headers.
  if (_cachedAppBar && _cachedAppBar.contains(targetEl)) score -= 150;

  // Penalise leaf tree items that lack aria-expanded — those are conversation
  // rows, not section headers, and should never be the winning target.
  if (
    targetEl.matches(".fui-TreeItem[role=\"treeitem\"]")
    && !targetEl.hasAttribute("aria-expanded")
    && !targetEl.querySelector(":scope > [role=\"group\"]")
  ) score -= 500;

  return score;
}

function stripSectionColorFromElement(el) {
  el.style.removeProperty("background");
  el.style.removeProperty("background-color");
  el.style.removeProperty("background-image");
  el.removeAttribute("data-tf-section");
  el.removeAttribute("data-tf-section-name");
  // Also remove any group marker we placed on a parent
  const groupParent = el.closest("[data-tf-section-group]");
  if (groupParent) groupParent.removeAttribute("data-tf-section-group");
}

function clearAllSectionColorTargets() {
  document.querySelectorAll("[data-tf-section]").forEach(stripSectionColorFromElement);
  // Sweep any orphaned group markers left behind
  document.querySelectorAll("[data-tf-section-group]").forEach((el) => {
    el.removeAttribute("data-tf-section-group");
  });
}

// Convert a #rrggbb hex color to rgba(r,g,b,alpha)
function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const num = parseInt(h.length === 3
    ? h.split("").map((c) => c + c).join("")
    : h, 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `rgba(${r},${g},${b},${alpha})`;
}

function buildSectionStylesheet(lookup) {
  let css = "";
  for (const { bg, text, safeId } of lookup) {
    const dimColor = hexToRgba(bg, 0.12);
    // Section header: background + text color
    css += `[data-tf-section="${safeId}"] { background: ${bg} !important; background-color: ${bg} !important; background-image: none !important; border-radius: 6px; }\n`;
    css += `[data-tf-section="${safeId}"], [data-tf-section="${safeId}"] * { color: ${text} !important; fill: ${text} !important; }\n`;
    // Child items in the group get a tinted background + subtle left-edge accent
    css += `[data-tf-section-group="${safeId}"] > *:not([data-tf-section]) { background-color: ${dimColor} !important; box-shadow: inset 3px 0 0 ${dimColor} !important; border-radius: 4px; }\n`;
  }
  return css;
}

function existingTargetsStillValid(lookup) {
  // Check that every section in the lookup has at least one target still
  // connected, visible, and with the correct color applied.
  const neededIds = new Set(lookup.map((e) => e.safeId));
  const existing = document.querySelectorAll("[data-tf-section]");
  const foundIds = new Set();
  for (const el of existing) {
    if (!el.isConnected) continue;
    // Verify the element is still visible (Teams may have hidden/moved it)
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    foundIds.add(el.getAttribute("data-tf-section"));
  }
  for (const id of neededIds) {
    if (!foundIds.has(id)) return false;
  }
  return true;
}

// Find the group container that wraps both the section header and its child items.
// Strongly prefers [role="group"] containers (the native Teams tree structure).
// Falls back to a cautious heuristic that stops at known navigation roots.
// IMPORTANT: must never return the header element itself or an element that
// is already tagged as a section header — that causes the child-item tinting
// CSS to apply the full section color instead of the dimmed version.
function findSectionGroupContainer(headerEl) {
  const MAX_CLIMB = 6;
  const headerRect = headerEl.getBoundingClientRect();
  if (!headerRect.height) return null;

  // First pass — look for a [role="group"] container nearby.
  let climbed = 0;
  for (
    let el = headerEl.parentElement;
    el && el !== document.body && el !== document.documentElement && climbed < MAX_CLIMB;
    el = el.parentElement, climbed++
  ) {
    if (el.matches("[data-tid=\"app-bar\"], [role=\"main\"], main, body")) break;
    // Never return the header itself
    if (el === headerEl) continue;
    // Never return an element already tagged as a section header
    if (el.hasAttribute("data-tf-section")) continue;

    if (el.getAttribute("role") === "group") {
      const r = el.getBoundingClientRect();
      if (r.height > headerRect.height + 4) return el;
    }

    const groupChild = el.querySelector(":scope > [role=\"group\"]");
    if (groupChild) {
      const r = el.getBoundingClientRect();
      if (r.height > headerRect.height + 4) return el;
    }
  }

  // Second pass — heuristic fallback with stop-selectors
  climbed = 0;
  for (
    let el = headerEl.parentElement;
    el && el !== document.body && el !== document.documentElement && climbed < MAX_CLIMB;
    el = el.parentElement, climbed++
  ) {
    if (el.matches("[data-tid=\"app-bar\"], [role=\"main\"], main, body, [role=\"tree\"], [data-tid=\"simple-collab-dnd-rail\"]")) break;
    if (el === headerEl) continue;
    if (el.hasAttribute("data-tf-section")) continue;

    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (rect.height <= headerRect.height + 4) continue;
    if (el.children.length < 2) continue;
    return el;
  }

  return null;
}

function applySectionColors(settings, forceRescan) {
  const sheet = getStyleSheet();
  const json = settings.sectionColorsJSON || "{}";

  // Feature disabled — clear everything and bail
  if (!settings.sectioncolors) {
    _suppressObserver = true;
    clearAllSectionColorTargets();
    sheet.textContent = "";
    _lastSectionColorsJSON = null;
    _suppressObserver = false;
    return;
  }

  const lookup = getSectionLookup(settings);
  if (lookup.length === 0) {
    _suppressObserver = true;
    clearAllSectionColorTargets();
    sheet.textContent = "";
    _lastSectionColorsJSON = json;
    _suppressObserver = false;
    return;
  }

  // If the settings haven't changed, check whether existing targets are still
  // in the DOM with the right IDs. If so, skip the expensive rescan.
  if (!forceRescan && json === _lastSectionColorsJSON && existingTargetsStillValid(lookup)) {
    return;
  }

  _lastSectionColorsJSON = json;

  // Build a map of safeId -> desired {bg, text} from the lookup
  const desiredById = new Map(lookup.map((e) => [e.safeId, { bg: e.bg, text: e.text }]));

  // Cache the app-bar element once per scan for use in scoreSectionMatch
  _cachedAppBar = document.querySelector("[data-tid=\"app-bar\"]");

  // Suppress our own observer while we mutate the DOM
  _suppressObserver = true;

  // Remove stale targets (no longer in lookup, or color changed)
  document.querySelectorAll("[data-tf-section]").forEach((el) => {
    const id = el.getAttribute("data-tf-section");
    const desired = desiredById.get(id);
    if (!desired) {
      // This section is no longer in the map — strip it
      stripSectionColorFromElement(el);
    }
  });

  // Scan and resolve one best target per section
  const candidates = collectSectionCandidateElements();
  console.log("[TeamTweaker] Section colors: scanning", candidates.length, "elements for", lookup.map((entry) => entry.normalized));

  const desiredTargets = new Map();
  for (const sourceEl of candidates) {
    const match = findLookupMatch(getTextCandidates(sourceEl), lookup);
    if (!match) continue;

    const targetEl = findSectionColorTarget(sourceEl);
    if (!targetEl) continue;

    // Never color a leaf conversation row as a section header.
    // Section headers always have aria-expanded (collapsible) or a direct
    // [role="group"] child. A plain .fui-TreeItem without those is a chat row.
    if (
      targetEl.matches(".fui-TreeItem[role=\"treeitem\"]")
      && !targetEl.hasAttribute("aria-expanded")
      && !targetEl.querySelector(":scope > [role=\"group\"]")
    ) continue;

    const candidateScore = scoreSectionMatch(sourceEl, targetEl);
    const current = desiredTargets.get(match.safeId);
    if (!current || candidateScore > current.score) {
      desiredTargets.set(match.safeId, {
        el: targetEl,
        match,
        score: candidateScore,
      });
    }
  }

  document.querySelectorAll("[data-tf-section]").forEach((el) => {
    const id = el.getAttribute("data-tf-section");
    const desired = desiredTargets.get(id);
    if (!desired || desired.el !== el) {
      stripSectionColorFromElement(el);
    }
  });

  for (const { el: targetEl, match } of desiredTargets.values()) {
    const currentId = targetEl.getAttribute("data-tf-section");
    const currentColor = targetEl.style.getPropertyValue("background-color");
    if (currentId === match.safeId && currentColor === match.bg) continue;

    targetEl.setAttribute("data-tf-section", match.safeId);
    targetEl.setAttribute("data-tf-section-name", match.name);
    targetEl.style.setProperty("background", match.bg, "important");
    targetEl.style.setProperty("background-color", match.bg, "important");
    targetEl.style.setProperty("background-image", "none", "important");

    // Mark the group container so child items can be dimmed via CSS.
    // Final safety: reject containers that are tree/list roots — those wrap
    // the entire conversation list, not just this section's children.
    const groupEl = findSectionGroupContainer(targetEl);
    if (groupEl && !groupEl.hasAttribute("data-tf-section-group") &&
        !groupEl.matches("[role=\"tree\"], [role=\"list\"], [data-tid=\"simple-collab-dnd-rail\"]")) {
      groupEl.setAttribute("data-tf-section-group", match.safeId);
    }
  }

  // Update stylesheet (always rebuild — it's cheap and idempotent)
  sheet.textContent = buildSectionStylesheet(lookup);

  _suppressObserver = false;

  console.log("[TeamTweaker] Section colors applied to", desiredTargets.size, "elements");
}

function isUppercaseLike(text) {
  const lettersOnly = text.replace(/[^\p{L}]/gu, "");
  return !!lettersOnly && lettersOnly === lettersOnly.toUpperCase();
}

function scoreSectionNameCandidate(el, text) {
  let score = 0;

  if (!text) return score;
  if (el.hasAttribute("data-tf-section-name")) score += 100;
  if (el.hasAttribute("data-tf-section")) score += 50;
  if (el.hasAttribute("aria-expanded")) score += 20;
  if (el.matches(SECTION_ROW_SELECTOR)) score += 8;
  if (el.hasAttribute("data-tid")) score += 4;
  if (text.length <= 40) score += 3;
  if (text.split(" ").length <= 6) score += 2;
  if (isUppercaseLike(text)) score += 5;
  if (/\d{1,2}:\d{2}/.test(text)) score -= 6;
  if (/\d+\/\d+/.test(text)) score -= 2;
  if (text.length > 60) score -= 8;

  return score;
}

function resolveSectionNameFromTarget(target) {
  if (!(target instanceof Element)) return "";

  const map = parseSectionMap(_currentSettings.sectionColorsJSON);
  let bestCandidate = null;

  for (let el = target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
    const explicitName = el.getAttribute("data-tf-section-name");
    if (explicitName) return explicitName;

    for (const text of getTextCandidates(el)) {
      const matchedKey = findSectionMapKey(map, text);
      if (matchedKey) return matchedKey;

      const score = scoreSectionNameCandidate(el, text);
      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          text: normalizeText(text),
          score,
          isUppercase: isUppercaseLike(text),
          isExpandable: el.hasAttribute("aria-expanded"),
        };
      }
    }
  }

  if (!bestCandidate) return "";
  if (bestCandidate.isExpandable && bestCandidate.score >= 10) return bestCandidate.text;
  if (bestCandidate.isUppercase && bestCandidate.score >= 15) return bestCandidate.text;
  return "";
}

function cleanupSectionColorInput() {
  if (_tfSectionColorInput && _tfSectionColorInput.parentNode) {
    _tfSectionColorInput.parentNode.removeChild(_tfSectionColorInput);
  }
  _tfSectionColorInput = null;
}

function saveSectionColor(sectionName, color) {
  safeStorageGet((settings) => {
    const map = parseSectionMap(settings.sectionColorsJSON);
    const key = findSectionMapKey(map, sectionName) || normalizeText(sectionName);
    if (!key) return;

    const existing = parseSectionValue(map[key]);
    map[key] = { bg: color, text: existing.text };
    chrome.storage.sync.set({
      sectioncolors: true,
      sectionColorsJSON: JSON.stringify(map),
    });
  });
}

// Right-clicking a mapped section opens the native color picker directly.
function openSectionColorPicker(sectionName) {
  cleanupSectionColorInput();

  const map = parseSectionMap(_currentSettings.sectionColorsJSON);
  const key = findSectionMapKey(map, sectionName) || normalizeText(sectionName);
  const existing = parseSectionValue(map[key]);
  const input = document.createElement("input");
  input.type = "color";
  input.value = existing.bg || SECTION_DEFAULT_COLOR;
  input.style.position = "fixed";
  input.style.left = "8px";
  input.style.top = "8px";
  input.style.width = "1px";
  input.style.height = "1px";
  input.style.opacity = "0.01";
  input.style.pointerEvents = "none";
  input.style.zIndex = "2147483647";

  function teardown() {
    document.removeEventListener("focusin", focusHandler, true);
    cleanupSectionColorInput();
  }

  // Save and close when the user confirms a color in the picker.
  input.addEventListener("change", () => {
    saveSectionColor(sectionName, input.value);
    teardown();
  }, { once: true });

  // The native color dialog holds OS focus while open. When the user dismisses
  // it (cancel or close), focus returns to the page and a focusin event fires
  // on whatever Teams element regains focus. That is the only reliable signal
  // that the picker is gone without a color being confirmed.
  function focusHandler(e) {
    if (e.target === input) return;
    teardown();
  }

  document.documentElement.appendChild(input);
  _tfSectionColorInput = input;

  // Delay attaching the focusin listener so the focus shift caused by opening
  // the picker itself doesn't immediately trigger it.
  setTimeout(() => {
    document.addEventListener("focusin", focusHandler, true);
  }, 300);

  if (typeof input.showPicker === "function") {
    input.showPicker();
  } else {
    input.click();
  }
}

function handleSectionColorContextMenu(event) {
  const sectionName = resolveSectionNameFromTarget(event.target);
  if (!sectionName) return;

  event.preventDefault();
  event.stopPropagation();
  openSectionColorPicker(sectionName);
}

function initSectionColorContextMenu() {
  if (_sectionContextMenuInitialized) return;
  _sectionContextMenuInitialized = true;
  document.addEventListener("contextmenu", handleSectionColorContextMenu, true);
}

// Throttled observer — re-apply when Teams mutates the DOM
let _sectionTimer = null;
function scheduleSectionColorUpdate() {
  if (_suppressObserver) return;
  if (_sectionTimer) return;
  _sectionTimer = setTimeout(() => {
    _sectionTimer = null;
    safeStorageGet((s) => {
      if (s.sectioncolors) applySectionColors(s, false);
      if (s.pinnedEmoji || (s.unreadhighlight && s.unreadEmoji) || (s.activechat && s.activeChatEmoji)) {
        applyAllConversationEmojis(s);
      }
    });
  }, 800);
}

let _wallpaperRepairTimer = null;

/** Re-inject wallpaper stylesheet if Teams cleared `#tf-custom-background-style`. */
function scheduleWallpaperRepair() {
  if (_wallpaperRepairTimer) return;
  _wallpaperRepairTimer = setTimeout(() => {
    _wallpaperRepairTimer = null;
    const root = document.documentElement;
    if (!root.classList.contains(FEATURE_CLASSES.custombackground)) return;
    const st = document.getElementById(TF_BACKGROUND_STYLE_ID);
    const ok = st && st.textContent && st.textContent.includes("message-pane-body");
    if (!ok) {
      safeStorageGet((s) => {
        if (s.custombackground) applyCustomBackgroundLayer(s);
      });
    }
  }, 400);
}

function startObserver() {
  const target = document.body || document.documentElement;
  _sectionObserver = new MutationObserver(() => {
    scheduleSectionColorUpdate();
    scheduleWallpaperRepair();
  });
  _sectionObserver.observe(target, { childList: true, subtree: true });
}

// Also re-apply periodically for the first 30s after load, because
// Teams loads very lazily and the sidebar may not exist yet.
function scheduleRetries() {
  const delays = [1000, 2000, 4000, 8000, 15000, 25000];
  for (const ms of delays) {
    setTimeout(() => {
      safeStorageGet((s) => {
        if (s.sectioncolors) applySectionColors(s, true);
        if (s.custombackground) applyCustomBackgroundLayer(s);
      });
    }, ms);
  }
}

// Init
function initSectionColors() {
  initSectionColorContextMenu();

  if (document.body) {
    startObserver();
    scheduleRetries();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      startObserver();
      scheduleRetries();
    });
  }
}
initSectionColors();

// Simple hex brightness adjustment
function adjustBrightness(hex, amount) {
  hex = hex.replace("#", "");
  const num = parseInt(hex, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

// Load and apply on startup (may run before DOM is ready)
function applyWhenReady() {
  safeStorageGet((settings) => {
    applySettings(settings);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", applyWhenReady);
} else {
  applyWhenReady();
}

// React to live changes from the popup / side panel (sync) and background image (local)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") {
    safeStorageGet((settings) => {
      applySettings(settings, true);
    });
    return;
  }
  if (area === "local" && (changes[TF_BACKGROUND_IMAGE_DATA_URL] || changes[TF_BACKGROUND_IMAGE_NAME])) {
    safeStorageGet((settings) => {
      applyCustomBackgroundLayer(settings);
    });
  }
});

// ============================================================
//  PIN CONVERSATION — right-click context menu on chat rows
// ============================================================

let _pinMenuEl = null;

function findConvNameFromRow(row) {
  for (const el of row.querySelectorAll("span, div")) {
    if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
    const full = el.textContent.trim();
    if (!full || full.length > 60) continue;
    if (/^\d{1,2}:\d{2}/.test(full)) continue;
    if (/^\d+$/.test(full)) continue;
    const dt = getDirectText(el);
    if (dt && dt.length >= 2) {
      return dt.replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "").trim();
    }
  }
  return "";
}

function getPinnedList() {
  try {
    const raw = _currentSettings.pinnedConversationsJSON || "[]";
    return JSON.parse(raw);
  } catch { return []; }
}

function dismissPinMenu() {
  if (_pinMenuEl) {
    _pinMenuEl.remove();
    _pinMenuEl = null;
  }
}

function showPinMenu(x, y, convName) {
  dismissPinMenu();
  if (!convName) return;

  const pinned = getPinnedList();
  const isPinned = pinned.some((p) => p.name === convName);

  const menu = document.createElement("div");
  menu.id = "tf-pin-menu";
  menu.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px; z-index: 999999;
    background: #1e1e2e; border: 1px solid #3a3a50; border-radius: 8px;
    padding: 4px 0; min-width: 180px; box-shadow: 0 8px 24px rgba(0,0,0,.45);
    font-family: "Segoe UI", system-ui, sans-serif; font-size: 13px; color: #e4e4ef;
  `;

  const item = document.createElement("div");
  item.textContent = isPinned ? "\u{1F4CC} Unpin conversation" : "\u{1F4CC} Pin conversation";
  item.style.cssText = `
    padding: 8px 16px; cursor: pointer; transition: background .1s;
  `;
  item.addEventListener("mouseenter", () => { item.style.background = "#2e2e42"; });
  item.addEventListener("mouseleave", () => { item.style.background = ""; });
  item.addEventListener("click", () => {
    dismissPinMenu();
    let list = getPinnedList();
    if (isPinned) {
      list = list.filter((p) => p.name !== convName);
    } else {
      list.push({ name: convName, pinnedAt: Date.now() });
    }
    const json = JSON.stringify(list);
    _currentSettings.pinnedConversationsJSON = json;
    chrome.storage.sync.set({ pinnedConversationsJSON: json });
  });

  menu.appendChild(item);
  document.body.appendChild(menu);
  _pinMenuEl = menu;

  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) menu.style.left = (window.innerWidth - rect.width - 8) + "px";
  if (rect.bottom > window.innerHeight) menu.style.top = (window.innerHeight - rect.height - 8) + "px";
}

function handlePinContextMenu(event) {
  const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
  if (!rail) return;

  const row = event.target.closest('.fui-TreeItem[role="treeitem"]');
  if (!row || !rail.contains(row)) return;
  if (row.hasAttribute("aria-expanded")) return;
  if (row.querySelector(":scope > [role=\"group\"]")) return;

  const sectionName = resolveSectionNameFromTarget(event.target);
  if (sectionName) return;

  const convName = findConvNameFromRow(row);
  if (!convName) return;

  event.preventDefault();
  event.stopPropagation();
  showPinMenu(event.clientX, event.clientY, convName);
}

document.addEventListener("contextmenu", handlePinContextMenu, true);
document.addEventListener("click", dismissPinMenu, true);

