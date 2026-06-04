// TeamTweaker — Unread Page Logic
// Uses chrome.scripting.executeScript to scrape unread conversations
// directly from the Teams tab DOM — no content script listener needed.

const TEAMS_URLS = [
  "https://teams.microsoft.com/*",
  "https://teams.live.com/*",
];

let _teamsTabId = null;
let _sectionColors = {};

function showStatus(html) {
  const content = document.getElementById("content");
  content.innerHTML = `<div class="status">${html}</div>`;
}

function findTeamsTab() {
  return new Promise((resolve) => {
    chrome.tabs.query({ url: TEAMS_URLS }, (tabs) => {
      resolve(tabs && tabs.length > 0 ? tabs[0] : null);
    });
  });
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
      const rail = document.querySelector('[data-tid="simple-collab-dnd-rail"]');
      if (!rail) return false;

      const rows = rail.querySelectorAll('.fui-TreeItem[role="treeitem"]');
      for (const row of rows) {
        if (row.hasAttribute("aria-expanded")) continue;
        if (row.querySelector(":scope > [role=\"group\"]")) continue;

        for (const el of row.querySelectorAll("span, div")) {
          if (el.matches('[data-tid="unread"]') || el.closest('[data-tid="unread"]')) continue;
          let dt = "";
          for (const n of el.childNodes) {
            if (n.nodeType === Node.TEXT_NODE) dt += n.textContent;
          }
          dt = dt.trim()
            .replace(/^\s*[\p{Emoji_Presentation}\p{Extended_Pictographic}]\s*/u, "")
            .trim().toLowerCase();
          if (dt === normalized) {
            const target = row.querySelector("a, button, [role=\"button\"]") || el;
            target.click();
            return true;
          }
        }
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

// ---- Rendering ----

function renderConversations(conversations) {
  const content = document.getElementById("content");

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
    return;
  }

  const countEl = document.getElementById("unreadCount");
  if (countEl) countEl.textContent = `${conversations.length} unread`;

  // Group by section
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

  li.addEventListener("click", () => navigateToConversation(conv.name, li));
  return li;
}

async function navigateToConversation(name, li) {
  if (!_teamsTabId) return;
  li.classList.add("navigating");
  try {
    chrome.tabs.update(_teamsTabId, { active: true });
    await clickConversationInTab(_teamsTabId, name);
    await highlightUnreadMessages(_teamsTabId);
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

  try {
    const conversations = await scrapeUnreadFromTab(tab.id);
    renderConversations(conversations);
  } catch (err) {
    const msg = err.message || "";
    const isAccessDenied = /cannot access|permissions|access to the page|not allowed/i.test(msg);
    const hint = isAccessDenied
      ? "Extension access to Teams is blocked. In Vivaldi/Brave: open the extension Details page and set Site Access to <strong>Allow on all websites</strong>, then reload the Teams tab."
      : (msg || "Reload the Teams tab and try again.");
    showStatus(`
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--fg2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <p class="empty-title">Could not reach Teams</p>
      <p class="empty-desc">${hint}</p>
    `);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadUnread();
  document.getElementById("refreshBtn").addEventListener("click", () => loadUnread());
});
