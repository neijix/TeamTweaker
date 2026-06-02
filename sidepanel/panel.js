// TeamTweaker — Unified Side Panel (Unread + Settings)

// ============================================================
//  TAB SWITCHING
// ============================================================

function initTabs() {
  const btns = document.querySelectorAll(".tab-btn");
  const views = document.querySelectorAll(".tab-view");

  for (const btn of btns) {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tab;
      for (const b of btns) b.classList.toggle("active", b === btn);
      for (const v of views) v.classList.toggle("active", v.id === "view-" + target);
      if (target === "unread") {
        startAutoRefresh();
      } else {
        stopAutoRefresh();
      }
    });
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  _autoRefreshTimer = setInterval(silentRefreshUnread, AUTO_REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (_autoRefreshTimer) {
    clearInterval(_autoRefreshTimer);
    _autoRefreshTimer = null;
  }
}

async function silentRefreshUnread() {
  if (!_teamsTabId) return;
  try {
    const conversations = await scrapeUnreadFromTab(_teamsTabId);
    // If the user is still viewing a conversation that Teams already marked read,
    // keep it in the list until they navigate to a different conversation.
    let merged = conversations;
    if (_currentlyViewing) {
      const stillPresent = conversations.some((c) => c.name === _currentlyViewing.name);
      if (!stillPresent) {
        merged = [{ ..._currentlyViewing.conv, _viewing: true }, ...conversations];
      }
    }
    const json = JSON.stringify(merged);
    if (json === _lastConversationsJSON) return;
    _lastConversationsJSON = json;
    renderConversations(merged);
  } catch {
    // ignore silently — Teams tab may be loading
  }
}

// ============================================================
//  UNREAD — scrapes Teams tab for unread conversations
// ============================================================

const TEAMS_URLS = [
  "https://teams.microsoft.com/*",
  "https://teams.live.com/*",
];

let _teamsTabId = null;
let _sectionColors = {};
let _pinnedConversations = [];
let _lastConversationsJSON = null;
let _autoRefreshTimer = null;
let _currentlyViewing = null; // { name, conv } — kept in list until user navigates elsewhere
const AUTO_REFRESH_INTERVAL_MS = 5000;

function showStatus(html) {
  const el = document.getElementById("unreadContent");
  el.innerHTML = `<div class="status">${html}</div>`;
}

async function findTeamsTab() {
  const tabs = await chrome.tabs.query({ url: TEAMS_URLS });
  if (!tabs || tabs.length === 0) return null;
  if (tabs.length === 1) return tabs[0];
  // Prefer a tab in the current window (the one the side panel is attached to)
  try {
    const currentWindow = await chrome.windows.getCurrent();
    const sameWindow = tabs.find((t) => t.windowId === currentWindow.id);
    if (sameWindow) return sameWindow;
  } catch {
    /* fall through */
  }
  return tabs[0];
}

/** Section headers = tree rows with aria-expanded or a direct [role="group"] child (same as unread leaf filter, inverted). */
async function scrapeSectionHeadersFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function getDirectText(el) {
        let t = "";
        for (const n of el.childNodes) {
          if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
        }
        return t.trim();
      }

      function findNameInRow(row) {
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

      const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
      if (!rail) return [];

      const names = [];
      const seen = new Set();
      const rows = rail.querySelectorAll('.fui-TreeItem[role="treeitem"]');
      for (const row of rows) {
        const isSectionHeader = row.hasAttribute("aria-expanded") ||
          !!row.querySelector(":scope > [role=\"group\"]");
        if (!isSectionHeader) continue;

        const tagged = row.getAttribute("data-tf-section-name");
        if (tagged) {
          if (!seen.has(tagged)) {
            seen.add(tagged);
            names.push(tagged);
          }
          continue;
        }
        const name = findNameInRow(row);
        if (name && !seen.has(name)) {
          seen.add(name);
          names.push(name);
        }
      }
      return names;
    },
  });
  return results[0]?.result || [];
}

// ---- Section color gradient (HSL lightness sweep from a primary hex) ----

function hexToRgb(hex) {
  const h = String(hex || "#6264a7").replace("#", "").slice(0, 6);
  if (h.length < 6) return { r: 98, g: 100, b: 167 };
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return { h: h * 360, s, l };
}

function hslToRgb(h, s, l) {
  h = (((h % 360) + 360) % 360) / 360;
  let r;
  let g;
  let b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return {
    r: Math.round(Math.min(255, Math.max(0, r * 255))),
    g: Math.round(Math.min(255, Math.max(0, g * 255))),
    b: Math.round(Math.min(255, Math.max(0, b * 255))),
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function gradientBgForIndex(primaryHex, index, total) {
  const { r, g, b } = hexToRgb(primaryHex);
  const { h, s, l } = rgbToHsl(r, g, b);
  const t = total <= 1 ? 0 : index / (total - 1);
  const Ldark = Math.max(0.14, l - 0.32);
  const Llight = Math.min(0.92, l + 0.12);
  const L = Ldark + (Llight - Ldark) * t;
  const S = Math.max(0.12, Math.min(1, s * (1 - 0.12 * t)));
  const { r: rr, g: gg, b: bb } = hslToRgb(h, S, L);
  return rgbToHex(rr, gg, bb);
}

function contrastTextForBg(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rel = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return rel > 0.55 ? "#1a1a24" : "#ffffff";
}

/** Monospace stack for Matrix preset; keep identical in popup and `<option value>` in HTML. */
const TERMINAL_FONT_STACK =
  'Consolas, "Cascadia Mono", "Cascadia Code", "Courier New", monospace';

/** Linux-style dev / distro monospace stack; keep identical in popup and `<option value>` in HTML. */
const LINUX_FONT_STACK =
  '"JetBrains Mono", "Fira Code", "Ubuntu Mono", "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", ui-monospace, monospace';

function ensureFontFamilyOption(fontStack, label) {
  const sel = document.getElementById("fontFamily");
  if (!sel) return;
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === fontStack) return;
  }
  const o = document.createElement("option");
  o.value = fontStack;
  o.textContent = label;
  sel.appendChild(o);
}

/** Named palettes: section gradient anchor + accent + unread/active highlights (keep in sync with popup/popup.js). */
const COLORIZATION_PRESETS = [
  {
    id: "teams",
    label: "Teams",
    primary: "#6264a7",
    accent: "#6264a7",
    unread: "#b45309",
    unreadBg: "#fff7ed",
    activeChat: "#0f766e",
    activeChatBg: "#ccfbf1",
  },
  {
    id: "bloodDragon",
    label: "Blood Dragon",
    primary: "#ad1457",
    accent: "#c2185b",
    unread: "#047857",
    unreadBg: "#d1fae5",
    activeChat: "#5b21b6",
    activeChatBg: "#ede9fe",
  },
  {
    id: "tokyoNeon",
    label: "Tokyo Neon",
    primary: "#7c3aed",
    accent: "#ff0fa3",
    unread: "#0ea5e9",
    unreadBg: "#cffafe",
    activeChat: "#c084fc",
    activeChatBg: "#fae8ff",
  },
  {
    id: "wesanderson",
    label: "Wes Anderson",
    primary: "#c9ada7",
    accent: "#e07a5f",
    unread: "#588157",
    unreadBg: "#e9f5e9",
    activeChat: "#457b9d",
    activeChatBg: "#e0ecf4",
  },
  {
    id: "dune",
    label: "Dune",
    primary: "#9a3412",
    accent: "#c2410c",
    unread: "#0f766e",
    unreadBg: "#ccfbf1",
    activeChat: "#a16207",
    activeChatBg: "#fef9c3",
  },
  {
    id: "bladerunner",
    label: "Blade Runner",
    primary: "#1d4ed8",
    accent: "#f97316",
    unread: "#e879f9",
    unreadBg: "#fae8ff",
    activeChat: "#22d3ee",
    activeChatBg: "#cffafe",
  },
  {
    id: "starwars",
    label: "Star Wars",
    primary: "#172554",
    accent: "#facc15",
    unread: "#22c55e",
    unreadBg: "#dcfce7",
    activeChat: "#ef4444",
    activeChatBg: "#fee2e2",
  },
  {
    id: "matrix",
    label: "Matrix",
    primary: "#006b2e",
    accent: "#00ff41",
    unread: "#00ff41",
    unreadBg: "#031505",
    activeChat: "#fbbf24",
    activeChatBg: "#1a1404",
    sectionText: "#39ff14",
    terminalFont: TERMINAL_FONT_STACK,
  },
];

function renderSectionPresetButtons() {
  const wrap = document.getElementById("sectionColorPresets");
  if (!wrap) return;
  wrap.innerHTML = "";
  for (const p of COLORIZATION_PRESETS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "section-preset-btn";
    b.dataset.preset = p.id;
    b.textContent = p.label;
    b.title = p.terminalFont
      ? `Apply ${p.label} — colors, monospace terminal font, custom accent`
      : `Apply ${p.label} — sidebar gradient, custom accent, unread/active colors`;
    b.style.setProperty("--preset", p.primary);
    wrap.appendChild(b);
  }
}

function applyColorizationPreset(preset) {
  const gradPrimary = document.getElementById("sectionGradientPrimary");
  if (gradPrimary) gradPrimary.value = preset.primary;

  const accentPicker = document.getElementById("accentColor");
  if (accentPicker) accentPicker.value = preset.accent;
  document.documentElement.style.setProperty("--accent", preset.accent);
  updateColorDots(preset.accent);

  const unreadColor = document.getElementById("unreadColor");
  const unreadBg = document.getElementById("unreadBgColor");
  const activeChatColor = document.getElementById("activeChatColor");
  const activeChatBg = document.getElementById("activeChatBgColor");
  if (unreadColor) {
    unreadColor.value = preset.unread;
    unreadColor.classList.remove("cleared");
  }
  if (unreadBg) {
    if (preset.unreadBg) {
      unreadBg.value = preset.unreadBg;
      unreadBg.classList.remove("cleared");
    } else {
      unreadBg.classList.add("cleared");
    }
  }
  if (activeChatColor) {
    activeChatColor.value = preset.activeChat;
    activeChatColor.classList.remove("cleared");
  }
  if (activeChatBg) {
    activeChatBg.value = preset.activeChatBg;
    activeChatBg.classList.remove("cleared");
  }

  updateClearedState("unreadColor", preset.unread);
  updateClearedState("unreadBgColor", preset.unreadBg || "");
  updateClearedState("activeChatColor", preset.activeChat);
  updateClearedState("activeChatBgColor", preset.activeChatBg);

  const sectionToggle = document.getElementById("sectioncolors");
  const accentToggle = document.getElementById("accent");
  if (sectionToggle) sectionToggle.checked = true;
  if (accentToggle) accentToggle.checked = true;

  if (preset.terminalFont) {
    ensureFontFamilyOption(preset.terminalFont, "Terminal / Matrix");
    const cf = document.getElementById("customfont");
    if (cf) cf.checked = true;
    const sel = document.getElementById("fontFamily");
    if (sel) sel.value = preset.terminalFont;
  }

  updateSubOptions();

  const map = { ...getSectionMap() };
  const keys = Object.keys(map);
  const syncPatch = {
    sectioncolors: true,
    accent: true,
    accentColor: preset.accent,
    unreadColor: preset.unread,
    unreadBgColor: preset.unreadBg || "",
    activeChatColor: preset.activeChat,
    activeChatBgColor: preset.activeChatBg,
  };
  if (preset.terminalFont) {
    syncPatch.customfont = true;
    syncPatch.fontFamily = preset.terminalFont;
  }

  if (keys.length > 0) {
    const n = keys.length;
    const primary = preset.primary;
    for (let i = 0; i < n; i++) {
      const bg = gradientBgForIndex(primary, i, n);
      const text = preset.sectionText != null ? preset.sectionText : contrastTextForBg(bg);
      map[keys[i]] = { bg, text };
    }
    syncPatch.sectionColorsJSON = JSON.stringify(map);
  }

  chrome.storage.sync.set(syncPatch, () => {
    if (syncPatch.sectionColorsJSON) {
      const json = syncPatch.sectionColorsJSON;
      const container = document.getElementById("sectionList");
      if (container) container.dataset.json = json;
      renderSectionList(json);
    } else {
      window.alert("Theme saved (accent & highlight colors). Use “Detect sections from Teams” or add names, then pick the theme again to paint the sidebar.");
    }
  });
}

function applySectionColorGradientFromUI() {
  const primaryEl = document.getElementById("sectionGradientPrimary");
  const primary = primaryEl ? primaryEl.value : "#6264a7";
  const map = getSectionMap();
  const keys = Object.keys(map);
  if (keys.length === 0) {
    window.alert("Add at least one section before applying a gradient.");
    return;
  }
  const n = keys.length;
  for (let i = 0; i < n; i++) {
    const bg = gradientBgForIndex(primary, i, n);
    map[keys[i]] = { bg, text: contrastTextForBg(bg) };
  }
  saveSectionMap(map);
}

function loadSectionColors() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ sectionColorsJSON: "{}" }, (s) => {
      try {
        const map = JSON.parse(s.sectionColorsJSON || "{}");
        const out = {};
        for (const [name, val] of Object.entries(map)) {
          if (typeof val === "string") {
            out[name.toLowerCase()] = { bg: val, text: "#ffffff" };
          } else if (val && typeof val === "object") {
            out[name.toLowerCase()] = { bg: val.bg || "#6264a7", text: val.text || "#ffffff" };
          }
        }
        resolve(out);
      } catch {
        resolve({});
      }
    });
  });
}

async function scrapeUnreadFromTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      function getDirectText(el) {
        let t = "";
        for (const n of el.childNodes) {
          if (n.nodeType === Node.TEXT_NODE) t += n.textContent;
        }
        return t.trim();
      }

      function findNameInRow(row) {
        for (const el of row.querySelectorAll("span, div")) {
          if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
          const full = el.textContent.trim();
          if (!full || full.length > 60) continue;
          if (/^\d{1,2}:\d{2}/.test(full)) continue;
          if (/^\d+$/.test(full)) continue;
          const dt = getDirectText(el);
          if (dt && dt.length >= 2) {
            return {
              el,
              name: dt.replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "").trim(),
            };
          }
        }
        return null;
      }

      function findSectionName(row) {
        const group = row.closest("[role=\"group\"]");
        if (!group) return "";
        const sectionItem = group.closest(".fui-TreeItem[role=\"treeitem\"]");
        if (!sectionItem) return "";
        const tagged = sectionItem.getAttribute("data-tf-section-name");
        if (tagged) return tagged;
        const result = findNameInRow(sectionItem);
        return result ? result.name : "";
      }

      const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
      if (!rail) return [];

      const allRows = rail.querySelectorAll('.fui-TreeItem[role="treeitem"]');
      const conversations = [];

      for (const row of allRows) {
        if (row.hasAttribute("aria-expanded")) continue;
        if (row.querySelector(":scope > [role=\"group\"]")) continue;
        if (!row.querySelector('[data-tid="unread"]')) continue;

        const found = findNameInRow(row);
        if (!found) continue;

        const candidates = row.querySelectorAll("span, div");
        const textParts = [];
        let pastName = false;
        for (const el of candidates) {
          if (el === found.el) { pastName = true; continue; }
          if (!pastName) continue;
          if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
          const dt = getDirectText(el);
          if (!dt || dt.length < 2) continue;
          if (/^\d{1,2}:\d{2}/.test(dt)) continue;
          if (/^\d+$/.test(dt)) continue;
          textParts.push(dt);
        }

        let time = "";
        for (const el of candidates) {
          if (el.closest('[data-tid="unread"]')) continue;
          const t = el.textContent.trim();
          if (/^\d{1,2}:\d{2}\s*(AM|PM)?$/i.test(t) || /^(Yesterday|Hier|today|aujourd)/i.test(t)) {
            time = t;
            break;
          }
        }

        let preview = "";
        const seen = new Set([found.name.toLowerCase()]);
        for (const part of textParts) {
          const lower = part.toLowerCase();
          if (seen.has(lower) || lower === time.toLowerCase()) continue;
          seen.add(lower);
          preview += (preview ? " " : "") + part;
          if (preview.length > 100) break;
        }

        let sender = "";
        const colonIdx = preview.indexOf(":");
        if (colonIdx > 0 && colonIdx < 30) {
          sender = preview.substring(0, colonIdx).trim();
          preview = preview.substring(colonIdx + 1).trim();
        }

        let unreadCount = "";
        const badge = row.querySelector('[data-tid="unread"]');
        if (badge) {
          const bt = badge.textContent.trim();
          if (/^\d+$/.test(bt)) unreadCount = bt;
        }

        const section = findSectionName(row);
        conversations.push({ name: found.name, time, preview, sender, unreadCount, section });
      }
      return conversations;
    },
  });
  return results[0]?.result || [];
}

async function clickConversationInTab(tabId, targetName) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (nameToFind) => {
      const normalized = nameToFind.toLowerCase().trim();

      function matchRow(row) {
        if (row.hasAttribute("aria-expanded")) return false;
        if (row.querySelector(":scope > [role=\"group\"]")) return false;
        for (const el of row.querySelectorAll("span, div")) {
          if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
          let dt = "";
          for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE) dt += n.textContent;
          }
          dt = dt.trim()
            .replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "")
            .trim().toLowerCase();
          if (dt === normalized) return true;
        }
        return false;
      }

      function tryClick(rail) {
        const rows = rail.querySelectorAll('.fui-TreeItem[role="treeitem"]');
        for (const row of rows) {
          if (!matchRow(row)) continue;
          // Scroll into view first so Teams doesn't virtualize it away
          row.scrollIntoView({ block: "nearest" });
          // Click the row itself; fall back to first interactive child
          const target = row.querySelector("a, button, [role=\"button\"]") || row;
          target.click();
          return true;
        }
        return false;
      }

      const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
      if (rail && tryClick(rail)) return true;

      // Fallback: search whole document in case Teams restructured the rail
      const allRows = document.querySelectorAll('.fui-TreeItem[role="treeitem"]');
      for (const row of allRows) {
        if (!matchRow(row)) continue;
        row.scrollIntoView({ block: "nearest" });
        const target = row.querySelector("a, button, [role=\"button\"]") || row;
        target.click();
        return true;
      }
      return false;
    },
    args: [targetName],
  });
  return results[0]?.result || false;
}

async function highlightUnreadMessages(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      const CLS = "tf-unread-flash";
      document.querySelectorAll("." + CLS).forEach((el) => el.classList.remove(CLS));

      let style = document.getElementById("tf-unread-flash-style");
      if (!style) {
        style = document.createElement("style");
        style.id = "tf-unread-flash-style";
        style.textContent = `
          @keyframes tf-flash { 0% { background-color: rgba(98,100,167,0.35); } 100% { background-color: transparent; } }
          .tf-unread-flash { animation: tf-flash 2s ease-out; }
        `;
        document.head.appendChild(style);
      }

      setTimeout(() => {
        const divider = document.querySelector('[data-tid="new-messages-divider"], [data-tid="unread-divider"]');
        if (divider) {
          divider.scrollIntoView({ behavior: "smooth", block: "center" });
          divider.classList.add(CLS);
          return;
        }
        const chatArea = document.querySelector('[data-tid="message-pane-list-container"], [role="main"] [role="list"]');
        if (chatArea) {
          chatArea.scrollTop = chatArea.scrollHeight;
        }
      }, 600);
    },
  });
}

// ---- Pinned Conversations ----

function loadPinnedConversations() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ pinnedConversationsJSON: "[]" }, (s) => {
      try {
        resolve(JSON.parse(s.pinnedConversationsJSON || "[]"));
      } catch {
        resolve([]);
      }
    });
  });
}

function savePinnedConversations(list) {
  _pinnedConversations = list;
  chrome.storage.sync.set({ pinnedConversationsJSON: JSON.stringify(list) });
  renderPinnedSection();
}

function isConversationPinned(name) {
  return _pinnedConversations.some((p) => p.name === name);
}

function togglePin(name) {
  if (isConversationPinned(name)) {
    savePinnedConversations(_pinnedConversations.filter((p) => p.name !== name));
  } else {
    savePinnedConversations([..._pinnedConversations, { name, pinnedAt: Date.now() }]);
  }
  refreshPinButtons();
}

function refreshPinButtons() {
  for (const btn of document.querySelectorAll(".conv-pin-btn")) {
    const name = btn.dataset.convName;
    if (!name) continue;
    btn.classList.toggle("pinned", isConversationPinned(name));
    btn.title = isConversationPinned(name) ? "Unpin" : "Pin";
  }
}

function createPinButton(convName) {
  const btn = document.createElement("button");
  btn.className = "conv-pin-btn" + (isConversationPinned(convName) ? " pinned" : "");
  btn.dataset.convName = convName;
  btn.title = isConversationPinned(convName) ? "Unpin" : "Pin";
  btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/></svg>';
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    togglePin(convName);
  });
  return btn;
}

function renderPinnedSection() {
  const section = document.getElementById("pinnedSection");
  const list = document.getElementById("pinnedList");
  if (!section || !list) return;

  const sorted = [..._pinnedConversations].sort((a, b) => a.pinnedAt - b.pinnedAt);

  if (sorted.length === 0) {
    section.style.display = "none";
    return;
  }

  chrome.storage.sync.get({ pinnedEmoji: "" }, (s) => {
    const sorted2 = [..._pinnedConversations].sort((a, b) => a.pinnedAt - b.pinnedAt);
    if (sorted2.length === 0) {
      section.style.display = "none";
      return;
    }

    const pinEmoji = String(s.pinnedEmoji || "").trim();
    section.style.display = "";
    list.innerHTML = "";

    for (const pinned of sorted2) {
      const li = document.createElement("li");
      li.className = "conversation-item";
      li.title = pinned.name;

      const left = document.createElement("div");
      left.className = "conv-left";

      const topRow = document.createElement("div");
      topRow.className = "conv-top-row";

      const nameSpan = document.createElement("span");
      nameSpan.className = "conv-name";
      if (pinEmoji) {
        const em = document.createElement("span");
        em.className = "conv-pin-emoji";
        em.textContent = pinEmoji + "\u00A0";
        nameSpan.appendChild(em);
      }
      nameSpan.appendChild(document.createTextNode(pinned.name));
      topRow.appendChild(nameSpan);

      left.appendChild(topRow);
      li.appendChild(left);

      li.appendChild(createPinButton(pinned.name));

      li.addEventListener("click", () => navigateToConversation({ name: pinned.name }, li));
      list.appendChild(li);
    }
  });
}

// ---- Unread Rendering ----

function renderConversations(conversations) {
  const content = document.getElementById("unreadContent");

  if (!conversations || conversations.length === 0) {
    content.innerHTML = `
      <div class="status">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <p class="empty-title">All caught up!</p>
        <p class="empty-desc">No unread conversations found.</p>
      </div>`;
    updateTabBadge(0);
    return;
  }

  const countEl = document.getElementById("unreadCount");
  if (countEl) countEl.textContent = `${conversations.length} unread`;
  updateTabBadge(conversations.length);

  const groups = new Map();
  for (const conv of conversations) {
    const key = conv.section || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(conv);
  }

  const container = document.createElement("div");
  container.className = "conversation-groups";

  for (const [sectionName, convs] of groups) {
    const groupEl = document.createElement("div");
    groupEl.className = "conv-group";

    if (sectionName) {
      const header = document.createElement("div");
      header.className = "conv-group-header";
      header.textContent = sectionName;

      const colors = _sectionColors[sectionName.toLowerCase()];
      if (colors) {
        header.style.backgroundColor = colors.bg;
        header.style.color = colors.text;
        groupEl.style.borderColor = colors.bg;
      }

      groupEl.appendChild(header);
    }

    const list = document.createElement("ul");
    list.className = "conversation-list";

    for (const conv of convs) {
      list.appendChild(buildConversationItem(conv));
    }

    groupEl.appendChild(list);
    container.appendChild(groupEl);
  }

  content.innerHTML = "";
  content.appendChild(container);
}

function buildConversationItem(conv) {
  const li = document.createElement("li");
  li.className = "conversation-item";
  if (conv._viewing) li.classList.add("viewing");
  li.title = conv.name;

  const left = document.createElement("div");
  left.className = "conv-left";

  const topRow = document.createElement("div");
  topRow.className = "conv-top-row";

  const nameSpan = document.createElement("span");
  nameSpan.className = "conv-name";
  nameSpan.textContent = conv.name;
  topRow.appendChild(nameSpan);

  if (conv.unreadCount) {
    const badge = document.createElement("span");
    badge.className = "conv-badge";
    badge.textContent = conv.unreadCount;
    topRow.appendChild(badge);
  }

  left.appendChild(topRow);

  if (conv.preview || conv.sender) {
    const previewRow = document.createElement("div");
    previewRow.className = "conv-preview";
    if (conv.sender) {
      const senderSpan = document.createElement("span");
      senderSpan.className = "conv-sender";
      senderSpan.textContent = conv.sender + ": ";
      previewRow.appendChild(senderSpan);
    }
    previewRow.appendChild(document.createTextNode(conv.preview || ""));
    left.appendChild(previewRow);
  }

  li.appendChild(left);

  if (conv.time) {
    const timeSpan = document.createElement("span");
    timeSpan.className = "conv-time";
    timeSpan.textContent = conv.time;
    li.appendChild(timeSpan);
  }

  li.appendChild(createPinButton(conv.name));

  li.addEventListener("click", () => navigateToConversation(conv, li));
  return li;
}

function updateTabBadge(count) {
  const badge = document.getElementById("tabBadge");
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count;
    badge.classList.add("visible");
  } else {
    badge.classList.remove("visible");
  }
}

async function navigateToConversation(conv, li) {
  if (!_teamsTabId) return;
  // Switching to a different conversation clears the previous "viewing" hold
  if (_currentlyViewing && _currentlyViewing.name !== conv.name) {
    _currentlyViewing = null;
  }
  _currentlyViewing = { name: conv.name, conv };
  li.classList.add("navigating");
  try {
    const tab = await chrome.tabs.get(_teamsTabId);
    await chrome.windows.update(tab.windowId, { focused: true });
    await chrome.tabs.update(_teamsTabId, { active: true });
    // Wait for the tab to become active and interactive before injecting the click
    await new Promise((resolve) => setTimeout(resolve, 150));
    const clicked = await clickConversationInTab(_teamsTabId, conv.name);
    // If the first attempt missed (e.g. tab was still loading), retry once
    if (!clicked) {
      await new Promise((resolve) => setTimeout(resolve, 400));
      await clickConversationInTab(_teamsTabId, conv.name);
    }
    await highlightUnreadMessages(_teamsTabId);
    // Do NOT refresh immediately — the conversation stays in the list until the
    // user navigates to a different conversation (which clears _currentlyViewing).
  } catch {
    // Teams tab may have closed
  } finally {
    setTimeout(() => li.classList.remove("navigating"), 400);
  }
}

async function loadUnread() {
  showStatus('<div class="spinner"></div><p>Looking for Teams…</p>');

  const tab = await findTeamsTab();
  if (!tab) {
    showStatus(`
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p class="empty-title">No Teams tab found</p>
      <p class="empty-desc">Open <a href="https://teams.microsoft.com" target="_blank">teams.microsoft.com</a> (Teams work or school / Enterprise) first, then click refresh.</p>
    `);
    return;
  }

  _teamsTabId = tab.id;
  _sectionColors = await loadSectionColors();
  _pinnedConversations = await loadPinnedConversations();

  try {
    const conversations = await scrapeUnreadFromTab(tab.id);
    _lastConversationsJSON = JSON.stringify(conversations);
    renderConversations(conversations);
    renderPinnedSection();
  } catch (err) {
    showStatus(`
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p class="empty-title">Could not reach Teams</p>
      <p class="empty-desc">${err.message || "Reload the Teams tab and try again."}</p>
    `);
  }
}

// ============================================================
//  SETTINGS — popup configuration (toggles, colors, etc.)
// ============================================================

/** Background image bytes — chrome.storage.local only (keep keys in sync with content.js). */
const TF_BACKGROUND_IMAGE_DATA_URL = "tf_background_image_data_url";
const TF_BACKGROUND_IMAGE_NAME = "tf_background_image_name";
const TF_BACKGROUND_MAX_FILE_BYTES = 4 * 1024 * 1024;

const DEFAULTS = {
  sectioncolors: false,
  sectionColorsJSON: "{}",
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

const _pendingWrites = {};
let _writeTimer = null;
const WRITE_INTERVAL_MS = 600;

function throttledStorageSet(obj) {
  Object.assign(_pendingWrites, obj);
  if (_writeTimer) return;
  _writeTimer = setTimeout(() => {
    _writeTimer = null;
    const batch = Object.assign({}, _pendingWrites);
    for (const k of Object.keys(batch)) delete _pendingWrites[k];
    chrome.storage.sync.set(batch);
  }, WRITE_INTERVAL_MS);
}

const TOGGLES = [
  "sectioncolors", "accent", "readability", "bubbles",
  "declutter", "smooth", "narrowsidebar", "unreadhighlight",
  "activechat", "customfont", "custombackground",
];

const SUB_OPTIONS = {
  sectioncolors: "sectionColorsGroup",
  readability: "fontSizeGroup",
  accent: "accentColorGroup",
  customfont: "fontFamilyGroup",
  custombackground: "customBackgroundGroup",
};

function refreshBackgroundImageMeta() {
  const meta = document.getElementById("backgroundImageMeta");
  if (!meta) return;
  chrome.storage.local.get(
    { [TF_BACKGROUND_IMAGE_DATA_URL]: "", [TF_BACKGROUND_IMAGE_NAME]: "" },
    (lo) => {
      const data = lo[TF_BACKGROUND_IMAGE_DATA_URL];
      const name = lo[TF_BACKGROUND_IMAGE_NAME];
      if (!data) meta.textContent = "No image saved yet.";
      else meta.textContent = name ? `Saved locally: ${name}` : "Saved locally (this device only).";
    }
  );
}

function initSettings() {
  renderSectionPresetButtons();

  chrome.storage.sync.get(DEFAULTS, (settings) => {
    for (const key of TOGGLES) {
      const el = document.getElementById(key);
      if (el) el.checked = !!settings[key];
    }

    document.getElementById("fontSize").value = settings.fontSize;
    document.getElementById("fontSizeValue").textContent = settings.fontSize + "px";
    document.getElementById("accentColor").value = settings.accentColor;
    const gradPrimary = document.getElementById("sectionGradientPrimary");
    if (gradPrimary) gradPrimary.value = settings.accentColor;
    ensureFontFamilyOption(TERMINAL_FONT_STACK, "Terminal / Matrix");
    ensureFontFamilyOption(LINUX_FONT_STACK, "Linux terminal");
    document.getElementById("fontFamily").value = settings.fontFamily;
    document.getElementById("unreadColor").value = settings.unreadColor || "#6264a7";
    document.getElementById("unreadBgColor").value = settings.unreadBgColor || "#6264a7";
    document.getElementById("activeChatColor").value = settings.activeChatColor || "#6264a7";
    document.getElementById("activeChatBgColor").value = settings.activeChatBgColor || "#6264a7";
    initAllEmojiPickers(settings);

    updateClearedState("unreadColor", settings.unreadColor);
    updateClearedState("unreadBgColor", settings.unreadBgColor);
    updateClearedState("activeChatColor", settings.activeChatColor);
    updateClearedState("activeChatBgColor", settings.activeChatBgColor);

    renderSectionList(settings.sectionColorsJSON);
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    updateColorDots(settings.accentColor);
    updateSubOptions();
    refreshBackgroundImageMeta();
    const tintChk = document.getElementById("customBackgroundTint");
    if (tintChk) tintChk.checked = !!settings.customBackgroundTint;
    const tintColor = document.getElementById("customBackgroundTintColor");
    if (tintColor) tintColor.value = settings.customBackgroundTintColor || DEFAULTS.customBackgroundTintColor;
    const tintOp = document.getElementById("customBackgroundTintOpacity");
    const tintOpVal = document.getElementById("customBackgroundTintOpacityValue");
    if (tintOp) {
      const v =
        settings.customBackgroundTintOpacity != null
          ? settings.customBackgroundTintOpacity
          : DEFAULTS.customBackgroundTintOpacity;
      tintOp.value = String(v);
      if (tintOpVal) tintOpVal.textContent = v + "%";
    }
    updateBackgroundTintControls();
  });

  for (const key of TOGGLES) {
    const el = document.getElementById(key);
    if (!el) continue;
    el.addEventListener("change", () => {
      chrome.storage.sync.set({ [key]: el.checked });
      updateSubOptions();
    });
  }

  const fontSizeSlider = document.getElementById("fontSize");
  fontSizeSlider.addEventListener("input", () => {
    document.getElementById("fontSizeValue").textContent = fontSizeSlider.value + "px";
    throttledStorageSet({ fontSize: parseInt(fontSizeSlider.value, 10) });
  });

  const accentPicker = document.getElementById("accentColor");
  accentPicker.addEventListener("input", () => {
    const color = accentPicker.value;
    throttledStorageSet({ accentColor: color });
    document.documentElement.style.setProperty("--accent", color);
    updateColorDots(color);
  });

  document.getElementById("colorPresets").addEventListener("click", (e) => {
    const dot = e.target.closest(".color-dot");
    if (!dot) return;
    const color = dot.dataset.color;
    accentPicker.value = color;
    chrome.storage.sync.set({ accentColor: color });
    document.documentElement.style.setProperty("--accent", color);
    updateColorDots(color);
  });

  document.getElementById("addSectionBtn").addEventListener("click", () => {
    const nameInput = document.getElementById("newSectionName");
    const bgColorInput = document.getElementById("newSectionColor");
    const textColorInput = document.getElementById("newSectionTextColor");
    const name = nameInput.value.trim();
    if (!name) return;
    const map = getSectionMap();
    map[name] = { bg: bgColorInput.value, text: textColorInput.value };
    saveSectionMap(map);
    nameInput.value = "";
  });

  const detectSectionsBtn = document.getElementById("detectSectionsBtn");
  if (detectSectionsBtn) {
    detectSectionsBtn.addEventListener("click", async () => {
      detectSectionsBtn.disabled = true;
      try {
        const tab = await findTeamsTab();
        if (!tab) {
          window.alert(
            "No Teams tab found. Open teams.microsoft.com (Teams work or school) first, then try again."
          );
          return;
        }
        const names = await scrapeSectionHeadersFromTab(tab.id);
        if (!names.length) {
          window.alert("No section headers were found in the Teams sidebar. Expand your chat list and try again.");
          return;
        }
        const map = getSectionMap();
        const bgColorInput = document.getElementById("newSectionColor");
        const textColorInput = document.getElementById("newSectionTextColor");
        const defaultBg = bgColorInput ? bgColorInput.value : "#6264a7";
        const defaultText = textColorInput ? textColorInput.value : "#ffffff";

        function sectionEntryToObject(val) {
          if (typeof val === "string") return { bg: val, text: "#ffffff" };
          if (val && typeof val === "object") {
            return { bg: val.bg || "#6264a7", text: val.text || "#ffffff" };
          }
          return { bg: "#6264a7", text: "#ffffff" };
        }

        const oldKeys = Object.keys(map);
        const newMap = {};
        const seen = new Set();
        let added = 0;
        for (const name of names) {
          seen.add(name);
          if (map[name]) {
            newMap[name] = sectionEntryToObject(map[name]);
          } else {
            newMap[name] = { bg: defaultBg, text: defaultText };
            added++;
          }
        }
        for (const [k, v] of Object.entries(map)) {
          if (!seen.has(k)) newMap[k] = sectionEntryToObject(v);
        }

        const newKeys = Object.keys(newMap);
        const sameKeysSameOrder = oldKeys.length === newKeys.length &&
          oldKeys.every((k, i) => k === newKeys[i]);

        saveSectionMap(newMap);
        if (added > 0) {
          window.alert(`Added ${added} section(s). Order matches the Teams sidebar (top to bottom). Enable “Section Colors” if it is off.`);
        } else if (!sameKeysSameOrder) {
          window.alert("Section order updated to match the Teams sidebar (top to bottom).");
        } else {
          window.alert("All detected sections are already in your list in the same order.");
        }
      } catch (err) {
        window.alert(err.message || "Could not read the Teams sidebar. Reload the Teams tab and try again.");
      } finally {
        detectSectionsBtn.disabled = false;
      }
    });
  }

  const applySectionGradientBtn = document.getElementById("applySectionGradientBtn");
  if (applySectionGradientBtn) {
    applySectionGradientBtn.addEventListener("click", () => {
      applySectionColorGradientFromUI();
    });
  }

  const sectionColorPresets = document.getElementById("sectionColorPresets");
  if (sectionColorPresets) {
    sectionColorPresets.addEventListener("click", (e) => {
      const btn = e.target.closest(".section-preset-btn");
      if (!btn) return;
      const preset = COLORIZATION_PRESETS.find((p) => p.id === btn.dataset.preset);
      if (preset) applyColorizationPreset(preset);
    });
  }

  document.getElementById("newSectionName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      document.getElementById("addSectionBtn").click();
    }
  });

  const fontSelect = document.getElementById("fontFamily");
  fontSelect.addEventListener("change", () => {
    chrome.storage.sync.set({ fontFamily: fontSelect.value });
  });

  const unreadColorPicker = document.getElementById("unreadColor");
  unreadColorPicker.addEventListener("click", (e) => e.stopPropagation());
  unreadColorPicker.addEventListener("input", () => {
    unreadColorPicker.classList.remove("cleared");
    throttledStorageSet({ unreadColor: unreadColorPicker.value });
  });

  const unreadBgColorPicker = document.getElementById("unreadBgColor");
  unreadBgColorPicker.addEventListener("click", (e) => e.stopPropagation());
  unreadBgColorPicker.addEventListener("input", () => {
    unreadBgColorPicker.classList.remove("cleared");
    throttledStorageSet({ unreadBgColor: unreadBgColorPicker.value });
  });

  const activeChatColorPicker = document.getElementById("activeChatColor");
  activeChatColorPicker.addEventListener("click", (e) => e.stopPropagation());
  activeChatColorPicker.addEventListener("input", () => {
    activeChatColorPicker.classList.remove("cleared");
    throttledStorageSet({ activeChatColor: activeChatColorPicker.value });
  });

  const activeChatBgColorPicker = document.getElementById("activeChatBgColor");
  activeChatBgColorPicker.addEventListener("click", (e) => e.stopPropagation());
  activeChatBgColorPicker.addEventListener("input", () => {
    activeChatBgColorPicker.classList.remove("cleared");
    throttledStorageSet({ activeChatBgColor: activeChatBgColorPicker.value });
  });

  for (const btn of document.querySelectorAll(".color-clear-btn")) {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      const targetId = btn.dataset.target;
      if (!targetId) return;
      const picker = document.getElementById(targetId);
      if (picker) picker.classList.add("cleared");
      chrome.storage.sync.set({ [targetId]: "" });
    });
  }

  const backgroundImageFile = document.getElementById("backgroundImageFile");
  if (backgroundImageFile) {
    backgroundImageFile.addEventListener("change", () => {
      const file = backgroundImageFile.files && backgroundImageFile.files[0];
      if (!file) return;
      if (file.size > TF_BACKGROUND_MAX_FILE_BYTES) {
        window.alert("That image is too large. Maximum size is 4 MB.");
        backgroundImageFile.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
          window.alert("Could not read that file as an image.");
          backgroundImageFile.value = "";
          return;
        }
        const payload = {
          [TF_BACKGROUND_IMAGE_DATA_URL]: dataUrl,
          [TF_BACKGROUND_IMAGE_NAME]: file.name,
        };
        const saveImageToLocal = () => {
          chrome.storage.local.set(payload, () => {
            if (chrome.runtime.lastError) {
              window.alert(
                "Could not save the image. It may be too large for browser storage (" +
                  chrome.runtime.lastError.message +
                  "). Try a smaller or more compressed PNG."
              );
              backgroundImageFile.value = "";
              return;
            }
            backgroundImageFile.value = "";
            refreshBackgroundImageMeta();
          });
        };
        const bgToggle = document.getElementById("custombackground");
        /* Enable sync toggle before local bytes so content script sees custombackground:true when local fires. */
        if (bgToggle && !bgToggle.checked) {
          chrome.storage.sync.set({ custombackground: true }, () => {
            bgToggle.checked = true;
            updateSubOptions();
            saveImageToLocal();
          });
        } else {
          saveImageToLocal();
        }
      };
      reader.onerror = () => {
        window.alert("Failed to read the file.");
        backgroundImageFile.value = "";
      };
      reader.readAsDataURL(file);
    });
  }

  const clearBackgroundImageBtn = document.getElementById("clearBackgroundImageBtn");
  if (clearBackgroundImageBtn) {
    clearBackgroundImageBtn.addEventListener("click", () => {
      chrome.storage.local.remove([TF_BACKGROUND_IMAGE_DATA_URL, TF_BACKGROUND_IMAGE_NAME], () => {
        refreshBackgroundImageMeta();
      });
    });
  }

  const customBackgroundTint = document.getElementById("customBackgroundTint");
  if (customBackgroundTint) {
    customBackgroundTint.addEventListener("change", () => {
      chrome.storage.sync.set({ customBackgroundTint: customBackgroundTint.checked });
      updateBackgroundTintControls();
    });
  }
  const customBackgroundTintColorEl = document.getElementById("customBackgroundTintColor");
  if (customBackgroundTintColorEl) {
    customBackgroundTintColorEl.addEventListener("click", (e) => e.stopPropagation());
    customBackgroundTintColorEl.addEventListener("input", () => {
      throttledStorageSet({ customBackgroundTintColor: customBackgroundTintColorEl.value });
    });
  }
  const customBackgroundTintOpacityEl = document.getElementById("customBackgroundTintOpacity");
  const customBackgroundTintOpacityValueEl = document.getElementById("customBackgroundTintOpacityValue");
  if (customBackgroundTintOpacityEl && customBackgroundTintOpacityValueEl) {
    customBackgroundTintOpacityEl.addEventListener("input", () => {
      const v = parseInt(customBackgroundTintOpacityEl.value, 10);
      customBackgroundTintOpacityValueEl.textContent = v + "%";
      throttledStorageSet({ customBackgroundTintOpacity: v });
    });
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    chrome.storage.sync.set(DEFAULTS, () => {
      chrome.storage.local.remove([TF_BACKGROUND_IMAGE_DATA_URL, TF_BACKGROUND_IMAGE_NAME], () => {
        window.location.reload();
      });
    });
  });

  document.getElementById("exportConfigBtn").addEventListener("click", exportConfig);

  document.getElementById("importConfigFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) importConfig(file);
    e.target.value = "";
  });
}

function updateBackgroundTintControls() {
  const main = document.getElementById("custombackground");
  const tintCb = document.getElementById("customBackgroundTint");
  const tintCtrls = document.getElementById("customBackgroundTintGroup");
  if (!tintCb || !tintCtrls) return;
  const show = !!(main && main.checked && tintCb.checked);
  tintCtrls.classList.toggle("visible", show);
}

function updateSubOptions() {
  for (const [toggleId, groupId] of Object.entries(SUB_OPTIONS)) {
    const toggle = document.getElementById(toggleId);
    const group = document.getElementById(groupId);
    if (toggle && group) {
      group.classList.toggle("visible", toggle.checked);
    }
  }
  const unreadToggle = document.getElementById("unreadhighlight");
  const unreadInline = document.getElementById("unreadInlineOptions");
  if (unreadToggle && unreadInline) {
    unreadInline.classList.toggle("visible", unreadToggle.checked);
  }
  const activeChatToggle = document.getElementById("activechat");
  const activeChatInline = document.getElementById("activeChatInlineOptions");
  if (activeChatToggle && activeChatInline) {
    activeChatInline.classList.toggle("visible", activeChatToggle.checked);
  }
  updateBackgroundTintControls();
}

// ---- Section Colors helpers ----

function parseSectionValue(value) {
  if (typeof value === "string") return { bg: value, text: "#ffffff" };
  if (value && typeof value === "object") return { bg: value.bg || "#6264a7", text: value.text || "#ffffff" };
  return { bg: "#6264a7", text: "#ffffff" };
}

function getSectionMap() {
  try {
    const raw = document.getElementById("sectionList").dataset.json || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSectionMap(map) {
  const json = JSON.stringify(map);
  document.getElementById("sectionList").dataset.json = json;
  chrome.storage.sync.set({ sectionColorsJSON: json });
  renderSectionList(json);
}

function renderSectionList(json) {
  const container = document.getElementById("sectionList");
  let map;
  try {
    map = JSON.parse(json || "{}");
  } catch {
    map = {};
  }
  container.dataset.json = JSON.stringify(map);
  container.innerHTML = "";

  for (const [name, rawValue] of Object.entries(map)) {
    const { bg, text } = parseSectionValue(rawValue);
    const row = document.createElement("div");
    row.className = "section-entry";

    const label = document.createElement("span");
    label.className = "section-entry-name";
    label.textContent = name;

    const bgSwatch = document.createElement("input");
    bgSwatch.type = "color";
    bgSwatch.value = bg;
    bgSwatch.title = "Background color";
    bgSwatch.addEventListener("input", () => {
      const m = getSectionMap();
      const existing = parseSectionValue(m[name]);
      m[name] = { bg: bgSwatch.value, text: existing.text };
      const j = JSON.stringify(m);
      document.getElementById("sectionList").dataset.json = j;
      throttledStorageSet({ sectionColorsJSON: j });
    });
    bgSwatch.addEventListener("change", () => {
      const m = getSectionMap();
      const existing = parseSectionValue(m[name]);
      m[name] = { bg: bgSwatch.value, text: existing.text };
      saveSectionMap(m);
    });

    const textSwatch = document.createElement("input");
    textSwatch.type = "color";
    textSwatch.value = text;
    textSwatch.title = "Text color";
    textSwatch.addEventListener("input", () => {
      const m = getSectionMap();
      const existing = parseSectionValue(m[name]);
      m[name] = { bg: existing.bg, text: textSwatch.value };
      const j = JSON.stringify(m);
      document.getElementById("sectionList").dataset.json = j;
      throttledStorageSet({ sectionColorsJSON: j });
    });
    textSwatch.addEventListener("change", () => {
      const m = getSectionMap();
      const existing = parseSectionValue(m[name]);
      m[name] = { bg: existing.bg, text: textSwatch.value };
      saveSectionMap(m);
    });

    const removeBtn = document.createElement("button");
    removeBtn.className = "section-remove-btn";
    removeBtn.textContent = "\u00d7";
    removeBtn.title = "Remove";
    removeBtn.addEventListener("click", () => {
      const m = getSectionMap();
      delete m[name];
      saveSectionMap(m);
    });

    row.appendChild(label);
    row.appendChild(bgSwatch);
    row.appendChild(textSwatch);
    row.appendChild(removeBtn);
    container.appendChild(row);
  }
}

function updateColorDots(activeColor) {
  const dots = document.querySelectorAll(".color-dot");
  const normalizedActive = activeColor.toLowerCase();
  for (const dot of dots) {
    dot.classList.toggle("active", dot.dataset.color.toLowerCase() === normalizedActive);
  }
}

// ---- Emoji Picker (unread + pinned + active chat; keep EMOJI_OPTIONS identical in popup/popup.js) ----

const EMOJI_OPTIONS = [
  "\u{1F525}", "\u2B50", "\u2757", "\u{1F4AC}", "\u{1F4E9}", "\u{1F514}", "\u{1F4A1}", "\u{1F680}",
  "\u{1F440}", "\u{1F4A5}", "\u{1F4CC}", "\u{1F3AF}", "\u26A1", "\u{1F195}", "\u{1F4E3}", "\u2764\uFE0F",
  "\u2705", "\u23F0", "\u{1F534}", "\u{1F7E2}", "\u{1F7E1}", "\u{1F535}", "\u{1F7E3}", "\u26A0\uFE0F",
  "\u{1F4DA}", "\u2615", "\u{1F4DE}", "\u{1F4C5}", "\u{1F510}", "\u{1F511}", "\u{1F3C6}", "\u{1F451}",
  "\u{1F381}", "\u{1F389}", "\u{1F44D}", "\u{1F44E}", "\u{1F44B}", "\u{1F914}", "\u{1F60E}", "\u{1F47B}",
  "\u{1F480}", "\u{1F308}", "\u2614", "\u2744\uFE0F", "\u{1F319}", "\u2600\uFE0F", "\u2708\uFE0F", "\u{1F697}",
  "\u{1F3E0}", "\u{1F4BC}", "\u{1F4C8}", "\u{1F4B0}", "\u{1F6E1}\uFE0F", "\u{1F527}", "\u{1F516}", "\u270F\uFE0F",
  "\u{1F49A}", "\u{1F494}", "\u{1F49B}", "\u{1F49C}", "\u{1F338}", "\u{1F339}", "\u{1F33B}", "\u{1F341}",
  "\u{1F4AF}", "\u{1F64C}", "\u{1F64F}", "\u{1F483}", "\u{1F984}", "\u{1F43C}", "\u{1F436}", "\u{1F431}",
];

let _emojiPickerGlobalCloseBound = false;

function ensureGlobalEmojiPickerCloseOnce() {
  if (_emojiPickerGlobalCloseBound) return;
  _emojiPickerGlobalCloseBound = true;
  document.addEventListener("click", () => {
    for (const d of document.querySelectorAll(".emoji-picker-dropdown.open")) {
      d.classList.remove("open");
    }
  });
}

function updateEmojiPickerButton(btn, emoji) {
  if (!btn) return;
  const v = emoji ? String(emoji) : "";
  btn.textContent = v || "\u2014";
  btn.classList.toggle("has-emoji", !!v);
}

function syncEmojiDropdownActive(dropdown, emoji) {
  if (!dropdown) return;
  const v = emoji ? String(emoji) : "";
  for (const opt of dropdown.querySelectorAll(".emoji-option:not(.emoji-option-clear)")) {
    opt.classList.toggle("active", opt.textContent === v);
  }
}

function selectEmojiForKey(storageKey, emoji, btn, dropdown, onAfterSave) {
  updateEmojiPickerButton(btn, emoji);
  dropdown.classList.remove("open");
  syncEmojiDropdownActive(dropdown, emoji);
  const patch = { [storageKey]: emoji };
  chrome.storage.sync.set(patch, () => {
    if (typeof onAfterSave === "function") onAfterSave();
  });
}

function buildEmojiPickerOnce(btnId, dropdownId, storageKey, onAfterSave) {
  const btn = document.getElementById(btnId);
  const dropdown = document.getElementById(dropdownId);
  if (!btn || !dropdown || btn.dataset.tfEmojiWired === "1") return;

  btn.dataset.tfEmojiWired = "1";
  ensureGlobalEmojiPickerCloseOnce();

  const wrapper = btn.closest(".emoji-picker-wrapper");
  if (wrapper) wrapper.addEventListener("click", (e) => e.stopPropagation());

  const clearBtn = document.createElement("button");
  clearBtn.type = "button";
  clearBtn.className = "emoji-option emoji-option-clear";
  clearBtn.textContent = "\u2715";
  clearBtn.title = "Remove emoji";
  clearBtn.addEventListener("click", () => selectEmojiForKey(storageKey, "", btn, dropdown, onAfterSave));
  dropdown.appendChild(clearBtn);

  for (const emoji of EMOJI_OPTIONS) {
    const opt = document.createElement("button");
    opt.type = "button";
    opt.className = "emoji-option";
    opt.textContent = emoji;
    opt.addEventListener("click", () => selectEmojiForKey(storageKey, emoji, btn, dropdown, onAfterSave));
    dropdown.appendChild(opt);
  }

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const willOpen = !dropdown.classList.contains("open");
    for (const d of document.querySelectorAll(".emoji-picker-dropdown.open")) {
      if (d !== dropdown) d.classList.remove("open");
    }
    dropdown.classList.toggle("open", willOpen);
  });

  dropdown.addEventListener("click", (e) => e.stopPropagation());
}

function initAllEmojiPickers(settings) {
  buildEmojiPickerOnce("emojiPickerBtn", "emojiPickerDropdown", "unreadEmoji", null);
  buildEmojiPickerOnce("pinnedEmojiPickerBtn", "pinnedEmojiPickerDropdown", "pinnedEmoji", () => renderPinnedSection());
  buildEmojiPickerOnce("activeChatEmojiPickerBtn", "activeChatEmojiPickerDropdown", "activeChatEmoji", null);

  updateEmojiPickerButton(document.getElementById("emojiPickerBtn"), settings.unreadEmoji);
  syncEmojiDropdownActive(document.getElementById("emojiPickerDropdown"), settings.unreadEmoji);
  updateEmojiPickerButton(document.getElementById("pinnedEmojiPickerBtn"), settings.pinnedEmoji);
  syncEmojiDropdownActive(document.getElementById("pinnedEmojiPickerDropdown"), settings.pinnedEmoji);
  updateEmojiPickerButton(document.getElementById("activeChatEmojiPickerBtn"), settings.activeChatEmoji);
  syncEmojiDropdownActive(document.getElementById("activeChatEmojiPickerDropdown"), settings.activeChatEmoji);
}

function updateClearedState(pickerId, value) {
  const el = document.getElementById(pickerId);
  if (!el) return;
  el.classList.toggle("cleared", !value);
}

// ============================================================
//  SYNC FOLDER (File System Access API + IndexedDB handle store)
// ============================================================

const HANDLE_DB_NAME = "teamtweaker-handles";
const HANDLE_DB_KEY = "syncFolder";

let _syncFolderHandle = null;
let _syncFolderWriteTimer = null;

function openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore("handles");
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveSyncFolderHandle(handle) {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").put(handle, HANDLE_DB_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function loadSyncFolderHandle() {
  try {
    const db = await openHandleDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("handles", "readonly");
      const req = tx.objectStore("handles").get(HANDLE_DB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

async function deleteSyncFolderHandle() {
  const db = await openHandleDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("handles", "readwrite");
    tx.objectStore("handles").delete(HANDLE_DB_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

async function getSyncFolderPermission() {
  if (!_syncFolderHandle) return "unavailable";
  try {
    return await _syncFolderHandle.queryPermission({ mode: "readwrite" });
  } catch {
    return "unavailable";
  }
}

async function requestSyncFolderPermission() {
  if (!_syncFolderHandle) return false;
  try {
    return (await _syncFolderHandle.requestPermission({ mode: "readwrite" })) === "granted";
  } catch {
    return false;
  }
}

async function readConfigFromSyncFolder() {
  if (!_syncFolderHandle) return null;
  try {
    const fh = await _syncFolderHandle.getFileHandle("teamtweaker-config.json");
    const file = await fh.getFile();
    const config = JSON.parse(await file.text());
    if (!config._teamtweaker || !config.sync) return null;
    return config;
  } catch {
    return null;
  }
}

async function writeConfigToSyncFolder() {
  if (!_syncFolderHandle) return;
  if (await getSyncFolderPermission() !== "granted") return;
  return new Promise((resolve) => {
    chrome.storage.sync.get(null, (syncData) => {
      chrome.storage.local.get([TF_BACKGROUND_IMAGE_DATA_URL, TF_BACKGROUND_IMAGE_NAME], async (localData) => {
        const config = {
          _teamtweaker: true,
          _version: 1,
          _exportedAt: new Date().toISOString(),
          sync: syncData,
        };
        if (localData[TF_BACKGROUND_IMAGE_DATA_URL]) {
          config.local = {
            [TF_BACKGROUND_IMAGE_DATA_URL]: localData[TF_BACKGROUND_IMAGE_DATA_URL],
            [TF_BACKGROUND_IMAGE_NAME]: localData[TF_BACKGROUND_IMAGE_NAME] || "",
          };
        }
        try {
          const fh = await _syncFolderHandle.getFileHandle("teamtweaker-config.json", { create: true });
          const writable = await fh.createWritable();
          await writable.write(JSON.stringify(config, null, 2));
          await writable.close();
        } catch (e) {
          console.warn("[TeamTweaker] writeConfigToSyncFolder failed", e);
        }
        resolve();
      });
    });
  });
}

function scheduleSyncFolderWrite() {
  if (_syncFolderWriteTimer) clearTimeout(_syncFolderWriteTimer);
  _syncFolderWriteTimer = setTimeout(async () => {
    _syncFolderWriteTimer = null;
    await writeConfigToSyncFolder();
  }, 1500);
}

async function applyConfigFromSyncFolder() {
  const config = await readConfigFromSyncFolder();
  if (!config) return false;
  return new Promise((resolve) => {
    chrome.storage.sync.set(config.sync, () => {
      if (config.local && config.local[TF_BACKGROUND_IMAGE_DATA_URL]) {
        chrome.storage.local.set({
          [TF_BACKGROUND_IMAGE_DATA_URL]: config.local[TF_BACKGROUND_IMAGE_DATA_URL],
          [TF_BACKGROUND_IMAGE_NAME]: config.local[TF_BACKGROUND_IMAGE_NAME] || "",
        }, () => resolve(true));
      } else {
        resolve(true);
      }
    });
  });
}

async function updateSyncFolderUI() {
  const dot = document.getElementById("syncFolderDot");
  const name = document.getElementById("syncFolderName");
  const reconnectBtn = document.getElementById("reconnectSyncFolderBtn");
  const clearBtn = document.getElementById("clearSyncFolderBtn");
  const setBtn = document.getElementById("setSyncFolderBtn");
  if (!dot || !name) return;

  if (!_syncFolderHandle) {
    dot.className = "sync-folder-dot sync-folder-dot--off";
    dot.title = "Not configured";
    name.textContent = "No folder configured";
    reconnectBtn.style.display = "none";
    clearBtn.style.display = "none";
    setBtn.textContent = "Set folder…";
    return;
  }

  name.textContent = _syncFolderHandle.name;
  clearBtn.style.display = "";
  setBtn.textContent = "Change…";
  const perm = await getSyncFolderPermission();
  if (perm === "granted") {
    dot.className = "sync-folder-dot sync-folder-dot--on";
    dot.title = "Connected — settings auto-save here";
    reconnectBtn.style.display = "none";
  } else if (perm === "prompt") {
    dot.className = "sync-folder-dot sync-folder-dot--warn";
    dot.title = "Permission needed — click Reconnect";
    reconnectBtn.style.display = "";
  } else {
    dot.className = "sync-folder-dot sync-folder-dot--off";
    dot.title = "Permission unavailable";
    reconnectBtn.style.display = "";
  }
}

async function tryAutoLoadFromSyncFolder() {
  if (!_syncFolderHandle) return;
  if (await getSyncFolderPermission() !== "granted") return;

  // Use chrome.storage.session to prevent reload loops (persists across location.reload)
  const session = await new Promise((res) => {
    if (chrome.storage.session) {
      chrome.storage.session.get("tf_sync_loaded_at", res);
    } else {
      res({});
    }
  });
  if (session.tf_sync_loaded_at && Date.now() - session.tf_sync_loaded_at < 10000) return;

  const config = await readConfigFromSyncFolder();
  if (!config) return;

  const setLoadedFlag = () => new Promise((res) => {
    if (chrome.storage.session) {
      chrome.storage.session.set({ tf_sync_loaded_at: Date.now() }, res);
    } else {
      res();
    }
  });

  await setLoadedFlag();
  await applyConfigFromSyncFolder();
  window.location.reload();
}

async function initSyncFolder() {
  _syncFolderHandle = await loadSyncFolderHandle();
  await updateSyncFolderUI();
  await tryAutoLoadFromSyncFolder();

  // Auto-save to folder whenever sync storage changes
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync") scheduleSyncFolderWrite();
  });

  document.getElementById("setSyncFolderBtn").addEventListener("click", async () => {
    if (!window.showDirectoryPicker) {
      alert("TeamTweaker: your browser does not support the File System Access API.");
      return;
    }
    try {
      const handle = await window.showDirectoryPicker({ mode: "readwrite" });
      _syncFolderHandle = handle;
      await saveSyncFolderHandle(handle);
      await updateSyncFolderUI();
      const config = await readConfigFromSyncFolder();
      if (config) {
        if (confirm("A TeamTweaker config file was found in this folder. Load it now?")) {
          await applyConfigFromSyncFolder();
          window.location.reload();
        }
      } else {
        // No file yet — write current settings there immediately
        await writeConfigToSyncFolder();
      }
    } catch (e) {
      if (e.name !== "AbortError") console.error("[TeamTweaker] setSyncFolder", e);
    }
  });

  document.getElementById("reconnectSyncFolderBtn").addEventListener("click", async () => {
    const granted = await requestSyncFolderPermission();
    if (granted) {
      await applyConfigFromSyncFolder();
      window.location.reload();
    }
    await updateSyncFolderUI();
  });

  document.getElementById("clearSyncFolderBtn").addEventListener("click", async () => {
    if (!confirm("Stop syncing to this folder? Your settings will not be deleted.")) return;
    await deleteSyncFolderHandle();
    _syncFolderHandle = null;
    await updateSyncFolderUI();
  });
}

// ============================================================
//  EXPORT / IMPORT CONFIG
// ============================================================

function exportConfig() {
  chrome.storage.sync.get(null, (syncData) => {
    chrome.storage.local.get([TF_BACKGROUND_IMAGE_DATA_URL, TF_BACKGROUND_IMAGE_NAME], (localData) => {
      const config = {
        _teamtweaker: true,
        _version: 1,
        _exportedAt: new Date().toISOString(),
        sync: syncData,
      };
      if (localData[TF_BACKGROUND_IMAGE_DATA_URL]) {
        config.local = {
          [TF_BACKGROUND_IMAGE_DATA_URL]: localData[TF_BACKGROUND_IMAGE_DATA_URL],
          [TF_BACKGROUND_IMAGE_NAME]: localData[TF_BACKGROUND_IMAGE_NAME] || "",
        };
      }
      const json = JSON.stringify(config, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const date = new Date().toISOString().slice(0, 10);
      const a = document.createElement("a");
      a.href = url;
      a.download = "teamtweaker-config-" + date + ".json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  });
}

function importConfig(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    let config;
    try {
      config = JSON.parse(e.target.result);
    } catch {
      alert("TeamTweaker: invalid JSON file.");
      return;
    }
    if (!config._teamtweaker || !config.sync) {
      alert("TeamTweaker: this file does not look like a TeamTweaker config backup.");
      return;
    }
    chrome.storage.sync.set(config.sync, () => {
      if (config.local && config.local[TF_BACKGROUND_IMAGE_DATA_URL]) {
        chrome.storage.local.set({
          [TF_BACKGROUND_IMAGE_DATA_URL]: config.local[TF_BACKGROUND_IMAGE_DATA_URL],
          [TF_BACKGROUND_IMAGE_NAME]: config.local[TF_BACKGROUND_IMAGE_NAME] || "",
        }, () => {
          window.location.reload();
        });
      } else {
        window.location.reload();
      }
    });
  };
  reader.readAsText(file);
}

// ============================================================
//  INIT
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {
  initTabs();
  initSettings();
  initSyncFolder();
  _pinnedConversations = await loadPinnedConversations();
  renderPinnedSection();
  loadUnread().then(() => startAutoRefresh());
  document.getElementById("refreshBtn").addEventListener("click", () => loadUnread().then(() => startAutoRefresh()));

  const closeSidePanelBtn = document.getElementById("closeSidePanelBtn");
  if (closeSidePanelBtn) {
    closeSidePanelBtn.addEventListener("click", async () => {
      try {
        if (chrome.sidePanel && typeof chrome.sidePanel.close === "function") {
          const w = await chrome.windows.getCurrent();
          await chrome.sidePanel.close({ windowId: w.id });
          return;
        }
      } catch (e) {
        console.warn("TeamTweaker: chrome.sidePanel.close", e);
      }
      try {
        window.close();
      } catch {
        /* no-op */
      }
    });
  }
});
