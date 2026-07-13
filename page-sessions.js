(function installAtlasPageSessions(global) {
  const STORAGE_KEY = "atlasSidebarPageSessions";
  const VERSION = 1;
  const DEFAULT_HOME_URL = "https://chatgpt.com/";
  const MAX_HISTORY = 50;
  const MAX_RECENTS = 30;
  const MAX_SAVED = 50;

  function normalizeUrl(value, fallback = "") {
    const candidates = [value, fallback].filter(Boolean);
    for (const candidate of candidates) {
      try {
        const url = new URL(String(candidate));
        if (!["http:", "https:"].includes(url.protocol)) continue;
        url.username = "";
        url.password = "";
        return url.href;
      } catch {
        // Try the fallback candidate.
      }
    }
    return DEFAULT_HOME_URL;
  }

  function normalizeTitle(value, url) {
    const title = String(value || "").trim().replace(/\s+/g, " ").slice(0, 240);
    if (title) return title;
    try {
      return new URL(url).hostname || url;
    } catch {
      return url;
    }
  }

  function formatDisplayUrl(value) {
    const url = new URL(normalizeUrl(value));
    const suffix = `${url.pathname}${url.search}${url.hash}`;
    return suffix === "/" ? url.host : `${url.host}${suffix}`;
  }

  function normalizeCustomTitle(value) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
  }

  function normalizeTime(value, fallback) {
    const time = Number(value);
    return Number.isFinite(time) && time > 0 ? Math.floor(time) : fallback;
  }

  function normalizeHistoryEntry(value, options = {}) {
    const url = normalizeUrl(value?.url, options.fallbackUrl);
    return {
      url,
      title: normalizeTitle(value?.title, url),
      customTitle: normalizeCustomTitle(value?.customTitle),
      visitedAt: normalizeTime(value?.visitedAt, options.now || Date.now())
    };
  }

  function normalizeSavedEntry(value, options = {}) {
    const entry = normalizeHistoryEntry(value, options);
    return {
      id: String(value?.id || `saved-${options.index || 0}`).slice(0, 120),
      url: entry.url,
      title: entry.title,
      customTitle: entry.customTitle,
      savedAt: normalizeTime(value?.savedAt, entry.visitedAt),
      updatedAt: normalizeTime(value?.updatedAt, entry.visitedAt)
    };
  }

  function uniqueByUrl(entries, limit) {
    const seen = new Set();
    const result = [];
    for (const entry of entries) {
      if (seen.has(entry.url)) continue;
      seen.add(entry.url);
      result.push(entry);
      if (result.length >= limit) break;
    }
    return result;
  }

  function createDefault(homeUrl = DEFAULT_HOME_URL, now = Date.now()) {
    const entry = normalizeHistoryEntry(
      { url: homeUrl, title: "ChatGPT", visitedAt: now },
      { now }
    );
    return {
      version: VERSION,
      history: [entry],
      historyIndex: 0,
      savedPages: [],
      recentPages: []
    };
  }

  function normalizeState(value, options = {}) {
    const now = options.now || Date.now();
    const homeUrl = normalizeUrl(options.homeUrl, DEFAULT_HOME_URL);
    const source = value && typeof value === "object" ? value : {};
    let history = (Array.isArray(source.history) ? source.history : [])
      .slice(-MAX_HISTORY)
      .map((entry) => normalizeHistoryEntry(entry, { fallbackUrl: homeUrl, now }));
    if (!history.length) {
      history = [normalizeHistoryEntry(
        {
          url: normalizeUrl(options.legacyUrl, homeUrl),
          title: "",
          visitedAt: now
        },
        { fallbackUrl: homeUrl, now }
      )];
    }
    const requestedIndex = Number(source.historyIndex);
    const historyIndex = Number.isInteger(requestedIndex)
      ? Math.max(0, Math.min(requestedIndex, history.length - 1))
      : history.length - 1;
    const savedPages = uniqueByUrl(
      (Array.isArray(source.savedPages) ? source.savedPages : [])
        .map((entry, index) => normalizeSavedEntry(entry, { index, now }))
        .sort((left, right) => right.updatedAt - left.updatedAt),
      MAX_SAVED
    );
    const recentPages = uniqueByUrl(
      (Array.isArray(source.recentPages) ? source.recentPages : [])
        .map((entry) => normalizeHistoryEntry(entry, { now }))
        .sort((left, right) => right.visitedAt - left.visitedAt),
      MAX_RECENTS
    );
    return {
      version: VERSION,
      history,
      historyIndex,
      savedPages,
      recentPages
    };
  }

  function currentPage(value) {
    const state = normalizeState(value);
    return state.history[state.historyIndex];
  }

  function recordNavigation(value, page, options = {}) {
    const now = options.now || Date.now();
    const state = normalizeState(value, { now });
    const next = normalizeHistoryEntry(page, {
      fallbackUrl: currentPage(state).url,
      now
    });
    const history = state.history.slice();
    const current = history[state.historyIndex];
    if (current.url === next.url) {
      history[state.historyIndex] = {
        ...current,
        ...next,
        title: page?.title ? next.title : current.title,
        customTitle: page?.customTitle === undefined
          ? current.customTitle
          : next.customTitle
      };
      return { ...state, history };
    }
    if (options.replaceCurrent) {
      history[state.historyIndex] = next;
      return { ...state, history };
    }
    const appended = [...history.slice(0, state.historyIndex + 1), next].slice(-MAX_HISTORY);
    return {
      ...state,
      history: appended,
      historyIndex: appended.length - 1
    };
  }

  function activateHistory(value, index) {
    const state = normalizeState(value);
    const nextIndex = Number(index);
    if (!Number.isInteger(nextIndex) || nextIndex < 0 || nextIndex >= state.history.length) {
      return state;
    }
    return { ...state, historyIndex: nextIndex };
  }

  function recordRecent(value, page, options = {}) {
    const now = options.now || Date.now();
    const state = normalizeState(value, { now });
    const entry = normalizeHistoryEntry(page, {
      fallbackUrl: currentPage(state).url,
      now
    });
    return {
      ...state,
      recentPages: uniqueByUrl(
        [entry, ...state.recentPages.filter((item) => item.url !== entry.url)],
        MAX_RECENTS
      )
    };
  }

  function saveCurrent(value, options = {}) {
    const now = options.now || Date.now();
    const state = normalizeState(value, { now });
    const current = currentPage(state);
    const existing = state.savedPages.find((entry) => entry.url === current.url);
    const saved = {
      id: existing?.id || (options.idFactory || (() => crypto.randomUUID()))(),
      url: current.url,
      title: current.title,
      customTitle: current.customTitle,
      savedAt: existing?.savedAt || now,
      updatedAt: now
    };
    return {
      ...state,
      savedPages: uniqueByUrl(
        [saved, ...state.savedPages.filter((entry) => entry.url !== saved.url)],
        MAX_SAVED
      )
    };
  }

  function removeSaved(value, id) {
    const state = normalizeState(value);
    return {
      ...state,
      savedPages: state.savedPages.filter((entry) => entry.id !== id)
    };
  }

  function removeSavedMany(value, ids) {
    const state = normalizeState(value);
    const selected = new Set(Array.from(ids || [], (id) => String(id)));
    if (!selected.size) return state;
    return {
      ...state,
      savedPages: state.savedPages.filter((entry) => !selected.has(entry.id))
    };
  }

  function renameSaved(value, id, customTitle, options = {}) {
    const now = options.now || Date.now();
    const state = normalizeState(value, { now });
    const target = state.savedPages.find((entry) => entry.id === id);
    if (!target) return state;
    const normalizedTitle = normalizeCustomTitle(customTitle);
    return {
      ...state,
      history: state.history.map((entry) =>
        entry.url === target.url ? { ...entry, customTitle: normalizedTitle } : entry
      ),
      savedPages: state.savedPages.map((entry) =>
        entry.id === id
          ? { ...entry, customTitle: normalizedTitle, updatedAt: now }
          : entry
      ),
      recentPages: state.recentPages.map((entry) =>
        entry.url === target.url ? { ...entry, customTitle: normalizedTitle } : entry
      )
    };
  }

  function renameCurrent(value, customTitle, options = {}) {
    const now = options.now || Date.now();
    const state = normalizeState(value, { now });
    const history = state.history.slice();
    const current = history[state.historyIndex];
    const normalizedTitle = normalizeCustomTitle(customTitle);
    history[state.historyIndex] = {
      ...current,
      customTitle: normalizedTitle
    };
    const savedPages = state.savedPages.map((entry) =>
      entry.url === current.url
        ? { ...entry, customTitle: normalizedTitle, updatedAt: now }
        : entry
    );
    const recentPages = state.recentPages.map((entry) =>
      entry.url === current.url
        ? { ...entry, customTitle: normalizedTitle }
        : entry
    );
    return { ...state, history, savedPages, recentPages };
  }

  function removeRecent(value, url) {
    const state = normalizeState(value);
    const normalizedUrl = normalizeUrl(url);
    return {
      ...state,
      recentPages: state.recentPages.filter((entry) => entry.url !== normalizedUrl)
    };
  }

  function removeRecentMany(value, urls) {
    const state = normalizeState(value);
    const selected = new Set(
      Array.from(urls || [], (url) => normalizeUrl(url)).filter(Boolean)
    );
    if (!selected.size) return state;
    return {
      ...state,
      recentPages: state.recentPages.filter((entry) => !selected.has(entry.url))
    };
  }

  function clearRecent(value) {
    return { ...normalizeState(value), recentPages: [] };
  }

  function searchPages(entries, query) {
    const normalizedQuery = String(query || "").trim().toLocaleLowerCase();
    if (!normalizedQuery) return Array.isArray(entries) ? entries.slice() : [];
    return (Array.isArray(entries) ? entries : []).filter((entry) => {
      let hostname = "";
      try {
        hostname = new URL(entry.url).hostname;
      } catch {
        // Invalid stored URLs are already removed by normalizeState.
      }
      return [entry.customTitle, entry.title, hostname, entry.url]
        .filter(Boolean)
        .join("\n")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    });
  }

  function visiblePageList(value, view, options = {}) {
    const state = normalizeState(value);
    const source = view === "recent" ? state.recentPages : state.savedPages;
    const filtered = searchPages(source, options.query);
    const limit = Number.isInteger(options.recentLimit) && options.recentLimit > 0
      ? options.recentLimit
      : 10;
    const shouldLimit = view === "recent" && !String(options.query || "").trim() && !options.showAll;
    const items = shouldLimit ? filtered.slice(0, limit) : filtered;
    return {
      items,
      total: source.length,
      filteredTotal: filtered.length,
      truncated: items.length < filtered.length
    };
  }

  function selectionRangeKeys(entries, startIndex, endIndex, view) {
    const source = Array.isArray(entries) ? entries : [];
    if (!source.length) return [];
    const start = Math.max(0, Math.min(Number(startIndex) || 0, source.length - 1));
    const end = Math.max(0, Math.min(Number(endIndex) || 0, source.length - 1));
    return source
      .slice(Math.min(start, end), Math.max(start, end) + 1)
      .map((entry) => view === "saved" ? entry.id : entry.url)
      .filter(Boolean);
  }

  function validateFrameNavigation(data, options = {}) {
    if (
      data?.source !== "atlas-frame-navigation" ||
      data?.type !== "ATLAS_FRAME_NAVIGATION" ||
      typeof data.documentId !== "string" ||
      !data.documentId ||
      typeof data.url !== "string"
    ) {
      return null;
    }
    if (data.kind !== "ready" && data.documentId !== options.activeDocumentId) {
      return null;
    }
    let url;
    try {
      url = new URL(data.url);
    } catch {
      return null;
    }
    if (!["http:", "https:"].includes(url.protocol) || url.origin !== options.eventOrigin) {
      return null;
    }
    if (url.username || url.password) return null;
    return {
      documentId: data.documentId,
      activateDocument: data.kind === "ready",
      url: url.href,
      title: normalizeTitle(data.title, url.href)
    };
  }

  function validateFrameSelection(data, options = {}) {
    if (
      data?.source !== "atlas-sidebar-selection" ||
      data?.type !== "ATLAS_SIDEBAR_SELECTION_REQUEST" ||
      typeof data.requestId !== "string" ||
      !data.requestId ||
      data.documentId !== options.activeDocumentId ||
      typeof data.selectionText !== "string" ||
      !data.selectionText.trim() ||
      typeof data.url !== "string"
    ) return null;
    let url;
    let currentUrl;
    try {
      url = new URL(data.url);
      currentUrl = new URL(options.currentUrl);
    } catch {
      return null;
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.origin !== options.eventOrigin ||
      url.origin !== currentUrl.origin ||
      url.username ||
      url.password
    ) return null;
    return {
      requestId: data.requestId,
      documentId: data.documentId,
      selectionText: data.selectionText,
      url: url.href,
      title: normalizeTitle(data.title, url.href)
    };
  }

  async function load(storageArea = global.chrome?.storage?.local, options = {}) {
    if (!storageArea?.get) return normalizeState(null, options);
    const legacyKey = options.legacyKey || "atlasSidebarLastUrl";
    const stored = await storageArea.get([STORAGE_KEY, legacyKey]);
    const state = normalizeState(stored?.[STORAGE_KEY], {
      ...options,
      legacyUrl: stored?.[legacyKey]
    });
    await save(state, storageArea);
    return state;
  }

  async function save(value, storageArea = global.chrome?.storage?.local) {
    const state = normalizeState(value);
    if (storageArea?.set) await storageArea.set({ [STORAGE_KEY]: state });
    return state;
  }

  global.AtlasPageSessions = Object.freeze({
    STORAGE_KEY,
    VERSION,
    DEFAULT_HOME_URL,
    MAX_HISTORY,
    MAX_RECENTS,
    MAX_SAVED,
    normalizeUrl,
    formatDisplayUrl,
    normalizeState,
    createDefault,
    currentPage,
    recordNavigation,
    activateHistory,
    recordRecent,
    saveCurrent,
    renameCurrent,
    renameSaved,
    removeSaved,
    removeSavedMany,
    removeRecent,
    removeRecentMany,
    clearRecent,
    searchPages,
    visiblePageList,
    selectionRangeKeys,
    validateFrameNavigation,
    validateFrameSelection,
    load,
    save
  });
})(globalThis);
