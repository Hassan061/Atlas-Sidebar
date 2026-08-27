importScripts("blob-store.js", "transcript.js", "bilibili-transcript.js", "settings.js", "prompts.js");

const FRAME_RULE_ID = 10_001;
const ROOT_MENU_ID = "atlas-sidebar-root";
const SELECTION_MENU_ID = "atlas-add-selection";
const PAGE_LINK_MENU_ID = "atlas-add-page-link";
const SCREENSHOT_MENU_ID = "atlas-capture-visible";
const DOCUMENT_MENU_ID = "atlas-add-document";
const TRANSCRIPT_MENU_ID = "atlas-add-transcript";
const STAGING_KEY = "atlasStagedItems";
const STAGING_OPEN_KEY = "atlasOpenStagingOnLoad";
const SIDEPANEL_LIFETIME_PORT = "ATLAS_SIDEPANEL_LIFETIME";
const MAX_BLOB_SIZE = 50 * 1024 * 1024;
const MAX_INLINE_SELECTION_CHARS = 120_000;
const BILIBILI_CAPABILITY_CACHE_MS = 30_000;
const CAPTURE_ADAPTERS = Object.freeze({
  selection: Object.freeze({
    kind: "selection",
    canCapture: (context) => getBaseCaptureCapability("selection", context),
    capture: ({ info, tab }) => stageSelection(info, tab)
  }),
  link: Object.freeze({
    kind: "link",
    canCapture: (context) => getBaseCaptureCapability("link", context),
    capture: ({ tab }) => captureLink(tab)
  }),
  screenshot: Object.freeze({
    kind: "screenshot",
    canCapture: (context) => getBaseCaptureCapability("screenshot", context),
    capture: ({ tab }) => captureScreenshot(tab)
  }),
  document: Object.freeze({
    kind: "document",
    canCapture: (context) => getBaseCaptureCapability("document", context),
    capture: ({ options, tab }) => captureDocument(tab, options?.document)
  }),
  transcript: Object.freeze({
    kind: "transcript",
    canCapture: (context) => getBaseCaptureCapability("transcript", context),
    capture: ({ options, tab }) =>
      captureTranscript(tab, options?.preferredTrackId)
  })
});
let captureQueue = Promise.resolve();
let stageMutationQueue = Promise.resolve();
let frameRuleQueue = Promise.resolve();
let contextMenuQueue = Promise.resolve();
let activeFrameLease = null;
const bilibiliCapabilityCache = new Map();

async function configureSidePanel() {
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
  void enqueueContextMenuConfiguration();
  void enqueueFrameRule(clearFrameRule);
  void initializePersistentDraft();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[globalThis.AtlasSettings.STORAGE_KEY]) return;
  const before = globalThis.AtlasSettings.normalize(
    changes[globalThis.AtlasSettings.STORAGE_KEY].oldValue
  );
  const after = globalThis.AtlasSettings.normalize(
    changes[globalThis.AtlasSettings.STORAGE_KEY].newValue
  );
  if (before.uiLanguage !== after.uiLanguage) {
    void enqueueContextMenuConfiguration();
  }
});

chrome.runtime.onStartup.addListener(() => {
  void configureSidePanel();
  void initializePersistentDraft();
  void enqueueFrameRule(clearFrameRule);
});

async function initializePersistentDraft() {
  return enqueueStageMutation(async () => {
    const [persistent, legacySession] = await Promise.all([
      chrome.storage.local.get(STAGING_KEY),
      chrome.storage.session.get(STAGING_KEY)
    ]);
    const persistentItems = Array.isArray(persistent[STAGING_KEY])
      ? persistent[STAGING_KEY]
      : [];
    const legacyItems = Array.isArray(legacySession[STAGING_KEY])
      ? legacySession[STAGING_KEY]
      : [];
    const itemsById = new Map();
    for (const item of [...legacyItems, ...persistentItems]) {
      if (typeof item?.id === "string" && item.id) itemsById.set(item.id, item);
    }
    const items = Array.from(itemsById.values(), recoverInterruptedStageItem);

    await chrome.storage.local.set({ [STAGING_KEY]: items });
    await chrome.storage.session.remove([STAGING_KEY, STAGING_OPEN_KEY]);
    await globalThis.AtlasBlobStore.prune(
      items.filter((item) => item.blobKey).map((item) => item.blobKey)
    );
    return items;
  });
}

function recoverInterruptedStageItem(item) {
  if (item?.status !== "capturing") return item;
  return {
    ...item,
    selected: false,
    status: "failed",
    errorCode: "capture-interrupted",
    error: "采集过程被浏览器关闭或扩展重载中断。",
    fallback: "请回到原页面重新采集；这条草稿会保留到你手动删除。",
    retryable: false
  };
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SIDEPANEL_LIFETIME_PORT) return;

  const lease = { port, id: "" };
  port.onMessage.addListener((message) => {
    if (
      message?.type !== "ATLAS_FRAME_LEASE_SYNC" ||
      typeof message.leaseId !== "string" ||
      !message.leaseId ||
      typeof message.hostname !== "string" ||
      !message.hostname
    ) {
      return;
    }

    lease.id = message.leaseId;
    activeFrameLease = lease;
    void enqueueFrameRule(() => updateFrameRule(message.hostname));
  });

  port.onDisconnect.addListener(() => {
    if (activeFrameLease !== lease) return;
    activeFrameLease = null;
    void enqueueFrameRule(clearFrameRule);
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (
    ![SELECTION_MENU_ID, PAGE_LINK_MENU_ID, SCREENSHOT_MENU_ID, DOCUMENT_MENU_ID, TRANSCRIPT_MENU_ID].includes(
      info.menuItemId
    )
  ) {
    return;
  }

  if (tab?.id !== undefined) {
    void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }

  void enqueueCapture(() => captureFromMenu(info, tab)).catch(() => {});
});

const QUICK_CAPTURE_COMMANDS = Object.freeze({
  "quick-screenshot": "screenshot",
  "quick-transcript": "transcript"
});

chrome.commands.onCommand.addListener((command, tab) => {
  void runQuickCaptureCommand(command, tab);
});

async function runQuickCaptureCommand(command, tab) {
  const kind = QUICK_CAPTURE_COMMANDS[command];
  if (!kind) return null;

  if (tab?.id !== undefined) {
    void chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  }

  await chrome.runtime
    .sendMessage({ type: "ATLAS_QUICK_CAPTURE_START" })
    .catch(() => {});

  try {
    const item = await enqueueCapture(() => captureActiveTab(kind, {}));
    if (item?.id) {
      await chrome.runtime
        .sendMessage({ type: "ATLAS_QUICK_TRANSFER", itemId: item.id })
        .catch(() => {});
    }
    return item;
  } catch {
    await chrome.runtime
      .sendMessage({ type: "ATLAS_QUICK_CAPTURE_FAILED" })
      .catch(() => {});
    return null;
  }
}

chrome.tabs.onActivated.addListener(() => {
  void notifyActiveContextChanged();
});

chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.url || changeInfo.status === "complete") {
    void notifyActiveContextChanged();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ATLAS_STAGE_INLINE_SELECTION") {
    const tab = sender?.tab;
    if (!tab?.id) {
      sendResponse({ ok: false, error: "无法识别当前页面。" });
      return false;
    }
    const pageUrl = String(tab.url || sender.url || "");
    const frameUrl = String(sender.url || pageUrl);
    void enqueueCapture(() => stageSelection({
      selectionText: message.selectionText,
      pageUrl,
      frameUrl,
      frameId: sender.frameId
    }, tab))
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    return true;
  }

  if (message?.type === "ATLAS_STAGE_SIDEBAR_SELECTION") {
    if (sender?.id !== chrome.runtime.id || !String(sender?.url || "").includes("/sidepanel.html")) {
      sendResponse({ ok: false, error: "不接受这个页面提交的侧边栏选区。" });
      return false;
    }
    void enqueueCapture(() => stageSidebarSelection(message.selection))
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) => sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      }));
    return true;
  }

  if (message?.type === "ATLAS_STAGE_MUTATE") {
    void mutateStagedItems(message.mutation)
      .then((items) => sendResponse({ ok: true, items }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_STAGE_PRUNE") {
    void enqueueCapture(pruneStagedBlobs)
      .then(() => sendResponse({ ok: true }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_STAGE_LOCAL_FILE") {
    void enqueueCapture(() => stageLocalFile(message.file))
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_STAGE_PROMPT") {
    void enqueueCapture(() => stageSavedPrompt(message.prompt, message.requestId))
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          code: error?.code || "stageRejected",
          details: error?.details || {}
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_OPEN_EXTERNAL") {
    void openOrFocusExternalUrl(message.url)
      .then((tab) => sendResponse({ ok: true, tabId: tab.id }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_TRANSFER_TO_CHATGPT_TAB") {
    void transferToTopLevelChatGpt(message.payload)
      .then(({ tab, result }) =>
        sendResponse({ ok: true, tabId: tab.id, result })
      )
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_TRANSCRIPT_OPTIONS_GET") {
    void getTranscriptOptions()
      .then((capability) =>
        sendResponse({
          ok: true,
          capability,
          options: capability.tracks || []
        })
      )
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_DOCUMENT_OPTIONS_GET") {
    void getDocumentOptions()
      .then((options) => sendResponse({ ok: true, options }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_CAPTURE_CAPABILITIES_GET") {
    void getActiveTab()
      .then((tab) => getCaptureCapabilities(tab))
      .then((capabilities) => sendResponse({ ok: true, capabilities }))
      .catch((error) => {
        const failure = normalizeCaptureFailure(error);
        sendResponse({ ok: false, error: failure.message, failure });
      });
    return true;
  }

  if (message?.type === "ATLAS_ACTIVE_CONTEXT_GET") {
    void getActiveTab()
      .then((tab) =>
        sendResponse({
          ok: true,
          context: {
            tabId: tab.id,
            title: tab.title || "未命名页面",
            url: tab.url || "",
            groupKey: makeGroupKey(tab)
          }
        })
      )
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_DIAGNOSTICS_GET") {
    void getRuntimeDiagnostics()
      .then((diagnostics) => sendResponse({ ok: true, diagnostics }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        })
      );
    return true;
  }

  if (message?.type === "ATLAS_CAPTURE_ACTIVE") {
    void enqueueCapture(() => captureActiveTab(message.kind, message.options))
      .then((item) => sendResponse({ ok: true, item }))
      .catch((error) => {
        const failure = normalizeCaptureFailure(error);
        sendResponse({
          ok: false,
          error: failure.message,
          failure
        });
      });
    return true;
  }

  if (message?.type === "ATLAS_CLEAR_FRAME_HOST") {
    if (
      message.leaseId &&
      activeFrameLease?.id &&
      message.leaseId !== activeFrameLease.id
    ) {
      sendResponse({ ok: true, ignored: true });
      return false;
    }
    activeFrameLease = null;
    void enqueueFrameRule(clearFrameRule)
      .then(() => sendResponse({ ok: true }))
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        });
      });
    return true;
  }

  if (message?.type !== "ATLAS_SET_FRAME_HOST") {
    return false;
  }

  if (typeof message.leaseId === "string" && message.leaseId) {
    if (activeFrameLease?.id !== message.leaseId) {
      activeFrameLease = { port: null, id: message.leaseId };
    }
  }
  void enqueueFrameRule(() => updateFrameRule(message.hostname))
    .then(() => sendResponse({ ok: true }))
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error)
      });
    });

  return true;
});

function enqueueFrameRule(operation) {
  const current = frameRuleQueue.catch(() => undefined).then(operation);
  frameRuleQueue = current.catch(() => undefined);
  return current;
}

async function updateFrameRule(hostname) {
  if (typeof hostname !== "string" || !hostname) {
    throw new Error("A valid hostname is required.");
  }

  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [FRAME_RULE_ID],
    addRules: [
      {
        id: FRAME_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: [
            { header: "x-frame-options", operation: "remove" },
            { header: "content-security-policy", operation: "remove" }
          ]
        },
        condition: {
          initiatorDomains: [chrome.runtime.id],
          requestDomains: [hostname],
          resourceTypes: ["sub_frame"]
        }
      }
    ]
  });
}

async function clearFrameRule() {
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [FRAME_RULE_ID]
  });
}

async function getRuntimeDiagnostics() {
  const [rules, fileSchemeAllowed] = await Promise.all([
    chrome.declarativeNetRequest.getSessionRules(),
    chrome.extension.isAllowedFileSchemeAccess()
  ]);
  const frameRule = rules.find((rule) => rule.id === FRAME_RULE_ID);
  return {
    version: chrome.runtime.getManifest().version,
    frameRuleInstalled: Boolean(frameRule),
    frameRuleHost: frameRule?.condition?.requestDomains?.[0] || "",
    fileSchemeAllowed: Boolean(fileSchemeAllowed)
  };
}

async function configureContextMenus() {
  const settings = await globalThis.AtlasSettings.load(chrome.storage.local);
  const t = (key) => globalThis.AtlasSettings.t(settings.uiLanguage, key);
  await chrome.contextMenus.removeAll();
  await createContextMenu({
    id: ROOT_MENU_ID,
    title: "Atlas Sidebar",
    contexts: ["all"]
  });
  await createContextMenu({
    id: SELECTION_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: t("addSelectionMenu"),
    contexts: ["selection"]
  });
  await createContextMenu({
    id: PAGE_LINK_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: t("addPageLinkMenu"),
    contexts: ["page"]
  });
  await createContextMenu({
    id: TRANSCRIPT_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: t("addTranscriptMenu"),
    contexts: ["page"],
    documentUrlPatterns: [
      "https://www.youtube.com/watch*",
      "https://youtube.com/watch*",
      "https://www.bilibili.com/video/*",
      "https://www.bilibili.com/bangumi/play/*"
    ]
  });
  await createContextMenu({
    id: SCREENSHOT_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: t("addScreenshotMenu"),
    contexts: ["page"]
  });
  await createContextMenu({
    id: DOCUMENT_MENU_ID,
    parentId: ROOT_MENU_ID,
    title: t("addDocumentMenu"),
    contexts: ["page"]
  });
}

function enqueueContextMenuConfiguration() {
  contextMenuQueue = contextMenuQueue
    .catch(() => undefined)
    .then(configureContextMenus);
  return contextMenuQueue;
}

async function stageSelection(info, tab, options = {}) {
  const text = normalizeSelectionText(info.selectionText);
  if (!text) {
    throw createCaptureError(
      "invalid-selection",
      "选中的内容没有可保存的文字。",
      false,
      "请重新选择一段文字。"
    );
  }
  const pageUrl = String(info.pageUrl || tab?.url || "");
  const source = options.source || makeSource({ ...tab, url: pageUrl });
  if (info.frameUrl && info.frameUrl !== pageUrl) {
    source.frameUrl = String(info.frameUrl);
  }
  if (Number.isInteger(info.frameId)) source.frameId = info.frameId;
  const common = {
    id: crypto.randomUUID(),
    kind: "selection",
    textLength: text.length,
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source
  };

  if (text.length <= MAX_INLINE_SELECTION_CHARS) {
    return appendStagedItem({ ...common, text });
  }

  const fileName = `${safeFileName(source.title || tab?.title || "selected-text")}-selection.txt`;
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  assertBlobSize(blob);
  const blobKey = crypto.randomUUID();
  await globalThis.AtlasBlobStore.put({ key: blobKey, blob, fileName });
  return appendStagedItem({
    ...common,
    blobKey,
    fileName,
    mime: blob.type,
    size: blob.size,
    preview: selectionPreview(text),
    extractionMode: "selection-text-file"
  });
}

async function stageSidebarSelection(selection) {
  const url = normalizeHttpUrl(selection?.url);
  if (!url) {
    throw createCaptureError(
      "invalid-source",
      "侧边栏页面网址无效。",
      false,
      "请刷新右侧页面后重试。"
    );
  }
  const activeTab = await getActiveTab();
  const title = String(selection?.title || activeTab.title || "侧边栏页面").trim();
  return stageSelection({
    selectionText: selection?.text,
    pageUrl: url,
    frameUrl: url,
    frameId: 0
  }, {
    title,
    url,
    id: null
  }, {
    source: {
      tabId: null,
      title,
      url,
      frameUrl: url,
      frameId: 0,
      contextKind: "sidebar-page",
      groupKey: makeGroupKey(activeTab)
    }
  });
}

function normalizeSelectionText(value) {
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .normalize("NFC")
    .trim();
}

function normalizeHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return "";
    return url.href;
  } catch {
    return "";
  }
}

function selectionPreview(text) {
  return Array.from(String(text).slice(0, 1200)).slice(0, 600).join("");
}

async function captureFromMenu(info, tab) {
  if (!tab?.id) throw new Error("无法识别当前页面。");
  const kind = kindFromMenuId(info.menuItemId);
  return dispatchCaptureRequest({ kind, tab, info, options: {} });
}

async function captureActiveTab(kind, options = {}) {
  const tab = await getActiveTab();
  return dispatchCaptureRequest({ kind, tab, info: null, options });
}

async function dispatchCaptureRequest(request) {
  const adapter = CAPTURE_ADAPTERS[request.kind];
  if (!adapter) {
    throw createCaptureError(
      "unsupported",
      "暂不支持这种采集类型。",
      false,
      "请改用链接或截图。"
    );
  }
  return captureWithPlaceholder(adapter.kind, request.tab, async () => {
    const capability = await evaluateCaptureCapability(adapter, request);
    if (capability.state !== "available") {
      throw createCaptureError(
        capability.state,
        capability.reason || "当前页面不能执行这项采集。",
        capability.state === "failed",
        capability.fallback || ""
      );
    }
    return adapter.capture(request);
  }, captureRetryOptions(adapter.kind, request.options));
}

async function captureWithPlaceholder(kind, tab, operation, retryOptions = null) {
  const placeholder = await appendStagedItem({
    id: crypto.randomUUID(),
    kind: kind || "unknown",
    selected: false,
    status: "capturing",
    ...(retryOptions ? { retryOptions } : {}),
    capturedAt: new Date().toISOString(),
    source: makeSource(tab || {})
  });

  try {
    const item = await operation();
    await mutateStagedItems({ action: "remove", ids: [placeholder.id] });
    return item;
  } catch (error) {
    const failure = normalizeCaptureFailure(error);
    try {
      await mutateStagedItems({
        action: "patch",
        patches: [
          {
            id: placeholder.id,
            patch: {
              status: "failed",
              error: failure.message,
              errorCode: failure.code,
              retryable: failure.retryable,
              fallback: failure.fallback
            }
          }
        ]
      });
    } catch (stageError) {
      const stageMessage =
        stageError instanceof Error ? stageError.message : String(stageError);
      throw new Error(`${failure.message}；失败状态也无法保存：${stageMessage}`);
    }
    throw error;
  }
}

function captureRetryOptions(kind, options) {
  if (kind === "document" && options?.document) {
    const candidate = options.document;
    let url = "";
    try {
      const parsed = new URL(String(candidate.url || ""));
      if (["http:", "https:"].includes(parsed.protocol)) url = parsed.href;
    } catch {
      // Current-page document retries intentionally use no URL.
    }
    const sourceKind = ["current", "pdf", "text", "html", "source"].includes(
      candidate.kind
    )
      ? candidate.kind
      : "current";
    if (!url && sourceKind === "current") return null;
    return {
      document: {
        url,
        kind: sourceKind,
        label: String(candidate.label || "当前文档").slice(0, 160)
      }
    };
  }
  if (kind === "transcript" && options?.preferredTrackId) {
    return {
      preferredTrackId: String(options.preferredTrackId).slice(0, 300)
    };
  }
  return null;
}

async function getCaptureCapabilities(tab) {
  const kinds = ["link", "screenshot", "document", "transcript"];
  const entries = await Promise.all(
    kinds.map(async (kind) => [
      kind,
      await evaluateCaptureCapability(CAPTURE_ADAPTERS[kind], {
        kind,
        tab,
        info: null,
        options: {}
      })
    ])
  );
  return Object.fromEntries(entries);
}

async function evaluateCaptureCapability(adapter, context) {
  try {
    const capability = await adapter.canCapture(context);
    return {
      state: ["available", "permission-required", "unsupported", "failed"].includes(
        capability?.state
      )
        ? capability.state
        : "failed",
      reason: String(capability?.reason || ""),
      fallback: String(capability?.fallback || "")
    };
  } catch (error) {
    return {
      state: "failed",
      reason: error instanceof Error ? error.message : String(error),
      fallback: "请刷新页面后重试。"
    };
  }
}

async function getBaseCaptureCapability(kind, { info, tab }) {
  const rawUrl = String(tab?.url || "");
  let url = null;
  try {
    url = rawUrl ? new URL(rawUrl) : null;
  } catch {
    // The capability below will explain the missing/invalid page URL.
  }

  if (kind === "selection") {
    return info?.selectionText?.trim()
      ? { state: "available", reason: "", fallback: "" }
      : {
          state: "unsupported",
          reason: "当前右键操作没有可用的选中文字。",
          fallback: "请先选择一段文字再打开 Atlas Sidebar 菜单。"
        };
  }
  if (kind === "link") {
    return rawUrl
      ? { state: "available", reason: "", fallback: "" }
      : {
          state: "failed",
          reason: "无法读取当前标签页网址。",
          fallback: "请刷新当前标签页后重试。"
        };
  }
  if (kind === "screenshot") {
    return url && ["http:", "https:", "file:"].includes(url.protocol)
      ? { state: "available", reason: "", fallback: "" }
      : {
          state: "unsupported",
          reason: "Chrome 限制页面不能由扩展截图。",
          fallback: "请在普通网页或本地文件页使用截图。"
        };
  }
  if (kind === "document") {
    if (url?.protocol === "file:") {
      const allowed = await chrome.extension.isAllowedFileSchemeAccess();
      return allowed
        ? { state: "available", reason: "", fallback: "" }
        : {
            state: "permission-required",
            reason: "Atlas Sidebar 尚未开启“允许访问文件网址”权限。",
            fallback: "请开启“允许访问文件网址”，或使用“本地文件”按钮。"
          };
    }
    return url && ["http:", "https:"].includes(url.protocol)
      ? { state: "available", reason: "", fallback: "" }
      : {
          state: "unsupported",
          reason: "当前页面不能作为文档读取。",
          fallback: "可以改用链接、截图或“本地文件”。"
        };
  }
  if (kind === "transcript") {
    return isYouTubeWatchUrl(rawUrl) || globalThis.AtlasBilibiliTranscript.isVideoUrl(rawUrl)
      ? { state: "available", reason: "", fallback: "" }
      : {
          state: "unsupported",
          reason: "当前页面不是支持字幕采集的视频页面。",
          fallback: "请先打开 YouTube 或哔哩哔哩视频页面。"
        };
  }
  return {
    state: "unsupported",
    reason: "未知的采集类型。",
    fallback: "请改用链接或截图。"
  };
}

function createCaptureError(code, message, retryable = false, fallback = "") {
  const error = new Error(message);
  error.code = code;
  error.retryable = retryable;
  error.fallback = fallback;
  return error;
}

function normalizeCaptureFailure(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (error?.code) {
    return {
      code: String(error.code),
      message,
      retryable: Boolean(error.retryable),
      fallback: String(error.fallback || "")
    };
  }
  if (/100 MB|50 MB|空间|容量/.test(message)) {
    return {
      code: "storage-limit",
      message,
      retryable: false,
      fallback: "请清空不需要的临时素材后重试。"
    };
  }
  if (/权限|允许访问文件网址/.test(message)) {
    return {
      code: "permission-required",
      message,
      retryable: false,
      fallback: "请检查扩展权限或改用本地文件按钮。"
    };
  }
  return {
    code: "capture-failed",
    message,
    retryable: true,
    fallback: "请重试；若仍失败可改用链接或截图。"
  };
}

async function captureLink(tab) {
  return appendStagedItem({
    id: crypto.randomUUID(),
    kind: "link",
    url: tab.url || "",
    title: tab.title || "未命名页面",
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  });
}

async function captureScreenshot(tab) {
  await assertActivePageUnchanged(tab);
  const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  const blob = await (await fetch(dataUrl)).blob();
  assertBlobSize(blob);
  const dimensions = await readImageDimensions(blob);
  await assertActivePageUnchanged(tab);
  const blobKey = crypto.randomUUID();
  const fileName = `${safeFileName(tab.title || "screenshot")}.png`;
  await globalThis.AtlasBlobStore.put({ key: blobKey, blob, fileName });

  return appendStagedItem({
    id: crypto.randomUUID(),
    kind: "screenshot",
    blobKey,
    fileName,
    mime: blob.type || "image/png",
    size: blob.size,
    width: dimensions.width,
    height: dimensions.height,
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  });
}

async function captureDocument(tab, documentOption = null) {
  await assertActivePageUnchanged(tab);
  const linkedUrl = normalizeDiscoveredDocumentUrl(documentOption?.url, tab.url);
  const targetTab = linkedUrl
    ? {
        ...tab,
        url: linkedUrl,
        title: documentOption?.label || tab.title
      }
    : tab;
  const directFile = await tryFetchDirectDocument(targetTab, {
    expectedDocument: Boolean(linkedUrl),
    allowHtml: documentOption?.kind === "html",
    sourceKind: documentOption?.kind || ""
  });
  if (directFile) {
    await assertActivePageUnchanged(tab);
    const blobKey = crypto.randomUUID();
    await globalThis.AtlasBlobStore.put({
      key: blobKey,
      blob: directFile.blob,
      fileName: directFile.fileName
    });
    return appendStagedItem({
      id: crypto.randomUUID(),
      kind: "document",
      blobKey,
      fileName: directFile.fileName,
      mime:
        directFile.mime || directFile.blob.type || "application/octet-stream",
      size: directFile.blob.size,
      extractionMode: "direct-file",
      selected: true,
      status: "ready",
      capturedAt: new Date().toISOString(),
      source: makeDocumentSource(tab, targetTab, documentOption)
    });
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: extractReadableText
  });
  if (!result?.text?.trim()) throw new Error("当前页面没有可提取的正文。");
  await assertActivePageUnchanged(tab);

  const fileName = `${safeFileName(result.title || tab.title || "document")}.txt`;
  const blob = new Blob([result.text], { type: "text/plain;charset=utf-8" });
  assertBlobSize(blob);
  const blobKey = crypto.randomUUID();
  await globalThis.AtlasBlobStore.put({ key: blobKey, blob, fileName });

  return appendStagedItem({
    id: crypto.randomUUID(),
    kind: "document",
    blobKey,
    fileName,
    mime: blob.type,
    size: blob.size,
    extractionMode: "visible-main-text",
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  });
}

async function getDocumentOptions() {
  const tab = await getActiveTab();
  const currentLabel = isLikelyDirectDocumentUrl(tab.url)
    ? "当前文档原文件"
    : "当前页面正文（TXT）";
  const current = {
    value: "",
    url: "",
    kind: "current",
    label: currentLabel
  };
  if (!tab.url || !/^https?:/i.test(tab.url) || isLikelyDirectDocumentUrl(tab.url)) {
    return [current];
  }

  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: discoverDocumentLinks
  });
  const discovered = Array.isArray(result) ? result : [];
  return [
    current,
    ...discovered.slice(0, 20).map((option) => ({
      value: option.url,
      url: option.url,
      kind: option.kind,
      label: option.label
    }))
  ];
}

async function stageLocalFile(file) {
  if (
    typeof file?.blobKey !== "string" ||
    !file.blobKey ||
    typeof file.fileName !== "string" ||
    !file.fileName.trim() ||
    !Number.isFinite(file.size) ||
    file.size <= 0
  ) {
    throw new Error("本地文件信息无效。");
  }
  if (file.size > MAX_BLOB_SIZE) {
    throw new Error("素材超过 50 MB，暂时无法加入临时区。");
  }

  const record = await globalThis.AtlasBlobStore.get(file.blobKey);
  if (!record?.blob) throw new Error("找不到刚选择的本地文件，请重新选择。");
  if (record.blob.size !== file.size) {
    throw new Error("本地文件大小校验失败，请重新选择。");
  }
  if (record.blob.size > MAX_BLOB_SIZE) {
    throw new Error("素材超过 50 MB，暂时无法加入临时区。");
  }
  const localMime = normalizeMime(
    record.mime || record.blob.type || file.mime || ""
  );
  if (
    (localMime === "application/pdf" || /\.pdf$/i.test(file.fileName)) &&
    !(await blobHasPdfHeader(record.blob))
  ) {
    throw createCaptureError(
      "invalid-pdf",
      "选择的文件没有有效的 PDF 文件头。",
      false,
      "请重新选择原始 PDF 文件。"
    );
  }

  const tab = await getActiveTab();
  return appendStagedItem({
    id: crypto.randomUUID(),
    kind: "document",
    blobKey: file.blobKey,
    fileName: safeFileName(file.fileName),
    mime:
      localMime ||
      (typeof file.mime === "string" && file.mime
        ? file.mime
        : "application/octet-stream"),
    size: record.blob.size,
    extractionMode: "file-picker",
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  });
}

async function stageSavedPrompt(value, requestId = "") {
  const normalized = globalThis.AtlasPrompts.normalizePrompt({
    id: value?.promptId,
    name: value?.name,
    text: value?.text
  });
  const tab = await getActiveTab();
  const itemId = /^[a-z0-9_-]{1,100}$/i.test(String(requestId || ""))
    ? String(requestId)
    : crypto.randomUUID();
  return appendStagedItem({
    id: itemId,
    kind: "prompt",
    promptRequestId: itemId,
    promptId: normalized.id,
    promptName: normalized.name,
    text: normalized.text,
    variables:
      value?.variables && typeof value.variables === "object"
        ? Object.fromEntries(
            Object.entries(value.variables)
              .slice(0, 50)
              .map(([key, entry]) => [String(key).slice(0, 50), String(entry).slice(0, 2_000)])
          )
        : {},
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  });
}

async function captureTranscript(tab, preferredTrackId = "") {
  if (globalThis.AtlasBilibiliTranscript.isVideoUrl(tab?.url)) {
    return captureBilibiliTranscript(tab, preferredTrackId);
  }
  return captureYouTubeTranscript(tab, preferredTrackId);
}

async function captureYouTubeTranscript(tab, preferredTrackId = "") {
  if (!tab.url || !isYouTubeWatchUrl(tab.url)) {
    throw createCaptureError(
      "transcript-not-youtube",
      "当前活动页面不是 YouTube 视频。",
      false,
      "请先打开一个 YouTube watch 页面。"
    );
  }

  const capability = await detectYouTubeTranscriptCapability(tab);
  if (capability.state !== "available") {
    throw createCaptureError(
      `transcript-${capability.state}`,
      transcriptCapabilityError(capability),
      capability.state !== "none",
      capability.state === "none"
        ? "若需要文字，请另行进行语音识别转录。"
        : "请确认视频可正常播放后重试。"
    );
  }

  const settings = preferredTrackId
    ? null
    : await globalThis.AtlasSettings.load(chrome.storage.local);
  const preferredLanguage = preferredTrackId || globalThis.AtlasSettings.resolveTranscriptLanguage(
    settings,
    globalThis.navigator?.language
  );
  const track = globalThis.AtlasTranscript.chooseTrack(capability.tracks, preferredLanguage);
  if (!track?.baseUrl) {
    throw createCaptureError(
      "transcript-track-missing",
      "检测到了字幕，但没有找到当前选择的字幕轨道。",
      true,
      "请重新选择语言后重试。"
    );
  }

  const endpointResult = await fetchTranscriptViaInnertube(tab, track);
  let segments = endpointResult.segments;
  let extractionMode = endpointResult.method;
  let lastError = endpointResult.error || "";

  if (segments.length === 0) {
    const timedTextResult = await fetchTranscriptViaTimedText(tab, track);
    segments = timedTextResult.segments;
    extractionMode = timedTextResult.method;
    lastError = timedTextResult.error || lastError;
  }

  if (segments.length === 0) {
    const [{ result: domResult }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: readYouTubeTranscriptDom
    });
    const domLanguageMatches =
      capability.tracks.length === 1 ||
      !domResult?.language ||
      sameTranscriptLanguage(domResult.language, track.name) ||
      sameTranscriptLanguage(domResult.language, track.languageCode);
    if (domResult?.panelOpen && domLanguageMatches) {
      segments = globalThis.AtlasTranscript.normalizeSegments(domResult.segments);
      extractionMode = segments.length > 0 ? "visible-transcript-dom" : extractionMode;
    }
  }

  if (segments.length === 0) {
    const label = track.name || track.languageCode || "所选";
    if (lastError === "po-token") {
      throw createCaptureError(
        "transcript-po-token",
        `已检测到${label}字幕轨道，但 YouTube 要求字幕 PO Token，当前版本还无法取得正文。`,
        true,
        "可以先在视频页面手动打开文字记录后重试。"
      );
    }
    throw createCaptureError(
      "transcript-fetch-failed",
      `已检测到${label}字幕轨道，但正文取得失败${lastError ? `：${lastError}` : ""}。`,
      true,
      "请重试或切换另一条字幕轨道。"
    );
  }

  await assertActivePageUnchanged(tab);
  const timestampedText = globalThis.AtlasTranscript.toTimestampedText(segments);
  const videoId = capability.videoId || getYouTubeVideoId(tab.url) || "video";
  const baseName = safeFileName(tab.title || `youtube-${videoId}`);
  const common = {
    id: crypto.randomUUID(),
    kind: "transcript",
    language: track.languageCode || "und",
    trackKind: track.kind === "asr" ? "asr" : "manual",
    extractionMode,
    segmentCount: segments.length,
    videoId,
    preview: timestampedText.slice(0, 600),
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  };

  return appendTranscriptAttachment(common, segments, timestampedText, baseName);
}

async function getTranscriptOptions() {
  const tab = await getActiveTab();
  if (globalThis.AtlasBilibiliTranscript.isVideoUrl(tab?.url)) {
    return getBilibiliTranscriptOptions(tab);
  }
  if (!tab.url || !isYouTubeWatchUrl(tab.url)) {
    return { state: "unsupported", provider: "", videoId: "", reason: "", tracks: [] };
  }
  const capability = await detectYouTubeTranscriptCapability(tab);
  return {
    state: capability.state,
    provider: "youtube",
    videoId: capability.videoId,
    reason: capability.reason || "",
    tracks: (capability.tracks || []).map((track) => ({
      value: track.id,
      label: `${String(track.name || track.languageCode).replace(/\s*\(auto-generated\)\s*$/i, "")}${track.kind === "asr" ? "（自动）" : "（人工）"}`,
      kind: track.kind,
      languageCode: track.languageCode
    }))
  };
}

async function getBilibiliTranscriptOptions(tab) {
  const capability = await detectBilibiliTranscriptCapability(tab);
  return {
    state: capability.state,
    provider: "bilibili",
    videoId: capability.videoId,
    cid: capability.cid,
    reason: capability.reason || "",
    tracks: (capability.tracks || []).map((track) => ({
      value: track.id,
      label: track.name || track.languageCode,
      kind: track.kind,
      provider: "bilibili",
      languageCode: track.languageCode
    }))
  };
}

async function detectBilibiliTranscriptCapability(tab) {
  const reference = globalThis.AtlasBilibiliTranscript.parseReference(tab?.url);
  if (!reference) {
    return {
      state: "unknown",
      provider: "bilibili",
      videoId: "",
      cid: 0,
      reason: "无法识别当前 B 站视频。",
      tracks: []
    };
  }
  const cacheKey = makeBilibiliCapabilityCacheKey(tab);
  const now = Date.now();
  pruneBilibiliCapabilityCache(now);
  const cached = bilibiliCapabilityCache.get(cacheKey);
  if (
    cached &&
    now - cached.at < BILIBILI_CAPABILITY_CACHE_MS &&
    bilibiliCapabilityMatchesReference(cached.capability, reference)
  ) {
    return cached.capability;
  }
  if (cached) bilibiliCapabilityCache.delete(cacheKey);
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readBilibiliTranscriptCapability,
      args: [tab.url]
    });
    let resolvedResult = result;
    if (Array.isArray(result?.subtitleViewBytes) && result.subtitleViewBytes.length > 0) {
      try {
        const decoded = globalThis.AtlasBilibiliTranscript.decodeSubtitleView(
          result.subtitleViewBytes
        );
        if (decoded.tracks.length > 0) {
          resolvedResult = {
            ...result,
            tracks: decoded.tracks,
            tracksKnown: true,
            needLogin: false,
            subtitleSource: "subtitle-web-view"
          };
        }
      } catch (error) {
        resolvedResult = {
          ...result,
          subtitleViewError: error instanceof Error ? error.message : String(error)
        };
      }
    }
    const identityRequired =
      resolvedResult?.ok === true ||
      resolvedResult?.tracksKnown === true ||
      (Array.isArray(resolvedResult?.tracks) && resolvedResult.tracks.length > 0);
    if (identityRequired && !bilibiliCapabilityMatchesReference(resolvedResult, reference)) {
      return {
        state: "unknown",
        provider: "bilibili",
        videoId: reference.bvid || (reference.aid ? `av${reference.aid}` : ""),
        cid: 0,
        reason: "B 站返回的视频身份与当前地址不一致，已拒绝使用这份字幕轨道。",
        tracks: []
      };
    }
    const classified = globalThis.AtlasBilibiliTranscript.classifyCapability(resolvedResult);
    const capability = {
      state: classified.state,
      provider: "bilibili",
      videoId: String(resolvedResult?.bvid || reference.bvid || (reference.aid ? `av${reference.aid}` : "")),
      bvid: String(resolvedResult?.bvid || ""),
      aid: Number(resolvedResult?.aid) || 0,
      cid: Number(resolvedResult?.cid) || 0,
      episodeId: Number(resolvedResult?.episodeId) || 0,
      subtitleSource: String(resolvedResult?.subtitleSource || "player-v2"),
      reason: String(resolvedResult?.reason || bilibiliCapabilityReason(classified.state)),
      tracks: classified.tracks
    };
    if (capability.state === "available") {
      bilibiliCapabilityCache.set(cacheKey, { at: now, capability });
    }
    return capability;
  } catch (error) {
    return {
      state: "unknown",
      provider: "bilibili",
      videoId: reference.bvid || (reference.aid ? `av${reference.aid}` : ""),
      cid: 0,
      reason: error instanceof Error ? error.message : String(error),
      tracks: []
    };
  }
}

function bilibiliCapabilityMatchesReference(value, reference) {
  if (!reference) return false;
  if (reference.bvid) {
    const valueBvid = String(
      value?.bvid || (/^BV/i.test(String(value?.videoId || "")) ? value.videoId : "")
    );
    return valueBvid.toLowerCase() === reference.bvid.toLowerCase();
  }
  if (reference.aid) {
    const valueAid = Number(value?.aid) || Number(String(value?.videoId || "").replace(/^av/i, ""));
    return valueAid === reference.aid;
  }
  if (reference.episodeType === "ep") {
    return Number(value?.episodeId) === reference.episodeId;
  }
  return Boolean(value?.bvid || value?.aid || value?.episodeId);
}

function makeBilibiliCapabilityCacheKey(tab) {
  const reference = globalThis.AtlasBilibiliTranscript.parseReference(tab?.url);
  const videoIdentity = reference?.bvid ||
    (reference?.aid ? `av${reference.aid}` : "") ||
    (reference?.episodeId ? `${reference.episodeType}${reference.episodeId}` : "unknown");
  return `${Number(tab?.id) || 0}:${videoIdentity}:p${reference?.page || 1}`;
}

function pruneBilibiliCapabilityCache(now = Date.now()) {
  for (const [key, entry] of bilibiliCapabilityCache) {
    if (now - Number(entry?.at || 0) >= BILIBILI_CAPABILITY_CACHE_MS) {
      bilibiliCapabilityCache.delete(key);
    }
  }
}

async function captureBilibiliTranscript(tab, preferredTrackId = "") {
  const capability = await detectBilibiliTranscriptCapability(tab);
  if (capability.state !== "available") {
    const code = {
      none: "transcript-none",
      "login-required": "transcript-login-required",
      blocked: "transcript-blocked",
      unavailable: "transcript-unavailable",
      unknown: "transcript-unknown"
    }[capability.state] || "transcript-unknown";
    throw createCaptureError(
      code,
      capability.reason || bilibiliCapabilityReason(capability.state),
      !["none", "login-required"].includes(capability.state),
      capability.state === "none"
        ? "若需要文字，请另行进行语音识别转录。"
        : capability.state === "login-required"
          ? "请先在当前 Chrome 中登录 B 站并确认视频可播放。"
          : "请确认视频可播放后重试。"
    );
  }

  const settings = preferredTrackId
    ? null
    : await globalThis.AtlasSettings.load(chrome.storage.local);
  const preferredLanguage = preferredTrackId || globalThis.AtlasSettings.resolveTranscriptLanguage(
    settings,
    globalThis.navigator?.language
  );
  const track = globalThis.AtlasBilibiliTranscript.chooseTrack(
    capability.tracks,
    preferredLanguage
  );
  if (!track?.subtitleUrl) {
    throw createCaptureError(
      "transcript-track-missing",
      "检测到了 B 站字幕，但所选轨道已经不可用。",
      true,
      "请重新选择语言后重试。"
    );
  }

  const result = await fetchBilibiliSubtitlePayload(tab, track.subtitleUrl);
  if (result?.httpStatus === 412 || result?.code === "blocked") {
    throw createCaptureError(
      "transcript-blocked",
      "B 站拒绝了字幕请求（HTTP 412）。",
      true,
      "请刷新视频、稍后重试，或改用页面已经显示的字幕。"
    );
  }
  if (!result?.ok || !result.payload) {
    throw createCaptureError(
      "transcript-fetch-failed",
      `检测到了 B 站字幕轨道，但正文取得失败${result?.error ? `：${result.error}` : ""}。`,
      true,
      "请重试或切换另一条字幕轨道。"
    );
  }
  const segments = globalThis.AtlasBilibiliTranscript.parseSubtitlePayload(result.payload);
  if (!segments.length) {
    throw createCaptureError(
      "transcript-fetch-failed",
      "B 站字幕响应中没有可用正文。",
      true,
      "请重试或切换另一条字幕轨道。"
    );
  }
  await assertActivePageUnchanged(tab);
  return appendTranscriptMaterial(tab, {
    segments,
    language: track.languageCode,
    trackKind: track.kind,
    extractionMode: track.source === "subtitle-web-view"
      ? "bilibili-subtitle-web-view-json"
      : "bilibili-subtitle-json",
    videoId: capability.videoId,
    cid: capability.cid,
    provider: "bilibili"
  });
}

async function fetchBilibiliSubtitlePayload(tab, rawUrl) {
  const extensionResult = await fetchBilibiliSubtitleTrackFromExtension(rawUrl);
  if (
    extensionResult.ok ||
    extensionResult.code === "blocked" ||
    extensionResult.code === "invalid-url"
  ) {
    return extensionResult;
  }

  let pageResult;
  try {
    [{ result: pageResult }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: fetchBilibiliSubtitleTrack,
      args: [rawUrl]
    });
  } catch (error) {
    pageResult = {
      ok: false,
      code: "page-fetch-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
  if (pageResult?.ok || pageResult?.code === "blocked") return pageResult;

  const errors = [
    extensionResult.error ? `后台请求：${extensionResult.error}` : "",
    pageResult?.error ? `页面请求：${pageResult.error}` : ""
  ].filter(Boolean);
  return {
    ...(pageResult || extensionResult),
    ok: false,
    error: errors.join("；") || "字幕正文请求失败。"
  };
}

async function fetchBilibiliSubtitleTrackFromExtension(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      !(url.hostname === "hdslb.com" || url.hostname.endsWith(".hdslb.com"))
    ) {
      return { ok: false, code: "invalid-url", error: "字幕地址不可信。" };
    }
    const response = await fetch(url.href, {
      credentials: "omit",
      cache: "no-store"
    });
    if (response.status === 412) {
      return { ok: false, code: "blocked", httpStatus: 412, error: "HTTP 412" };
    }
    if (!response.ok) {
      return {
        ok: false,
        code: "http",
        httpStatus: response.status,
        error: `HTTP ${response.status}`
      };
    }
    return { ok: true, payload: await response.json(), fetchMode: "extension" };
  } catch (error) {
    return {
      ok: false,
      code: "fetch-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function appendTranscriptMaterial(tab, details) {
  const segments = globalThis.AtlasTranscript.normalizeSegments(details.segments);
  const timestampedText = globalThis.AtlasTranscript.toTimestampedText(segments);
  const baseName = safeFileName(tab.title || `${details.provider || "video"}-${details.videoId || "video"}`);
  const common = {
    id: crypto.randomUUID(),
    kind: "transcript",
    provider: details.provider || "unknown",
    language: details.language || "und",
    trackKind: details.trackKind || "unknown",
    extractionMode: details.extractionMode || "subtitle",
    segmentCount: segments.length,
    videoId: details.videoId || "",
    ...(details.cid ? { cid: details.cid } : {}),
    preview: timestampedText.slice(0, 600),
    selected: true,
    status: "ready",
    capturedAt: new Date().toISOString(),
    source: makeSource(tab)
  };
  return appendTranscriptAttachment(common, segments, timestampedText, baseName);
}

async function appendTranscriptAttachment(common, segments, timestampedText, baseName) {
  const useVtt = timestampedText.length > 30_000;
  const fileName = useVtt ? `${baseName}.vtt` : `${baseName}-transcript.txt`;
  const blob = new Blob(
    [useVtt ? globalThis.AtlasTranscript.toVtt(segments) : timestampedText],
    { type: useVtt ? "text/vtt;charset=utf-8" : "text/plain;charset=utf-8" }
  );
  assertBlobSize(blob);
  const blobKey = crypto.randomUUID();
  await globalThis.AtlasBlobStore.put({ key: blobKey, blob, fileName });
  return appendStagedItem({
    ...common,
    blobKey,
    fileName,
    mime: blob.type,
    size: blob.size
  });
}

function bilibiliCapabilityReason(state) {
  return {
    none: "当前 B 站视频没有可用字幕轨道。",
    "login-required": "B 站要求登录后才能读取这个视频的字幕。",
    blocked: "B 站暂时拒绝了字幕请求。",
    unavailable: "当前 B 站视频或字幕受限。",
    unknown: "无法可靠判断当前 B 站视频是否有字幕。"
  }[state] || "B 站字幕不可用。";
}

async function detectYouTubeTranscriptCapability(tab) {
  const expectedVideoId = getYouTubeVideoId(tab.url);
  if (!expectedVideoId) {
    return { state: "unknown", videoId: "", reason: "无法识别当前视频 ID。", tracks: [] };
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: readYouTubeTranscriptCapability,
      args: [expectedVideoId]
    });
    const tracks = Array.isArray(result?.tracks)
      ? result.tracks
          .filter((track) => track?.baseUrl && track?.languageCode)
          .map((track, index) => ({
            id:
              String(track.id || "") ||
              `${track.languageCode}:${track.kind === "asr" ? "asr" : "manual"}:${index}`,
            baseUrl: String(track.baseUrl),
            languageCode: String(track.languageCode),
            kind: track.kind === "asr" ? "asr" : "manual",
            name: String(track.name || track.languageCode),
            isTranslatable: Boolean(track.isTranslatable),
            sourceClient: String(track.sourceClient || "web"),
            poTokenRequired: Boolean(track.poTokenRequired)
          }))
      : [];
    const reportedState = result?.state || "unknown";
    const state =
      tracks.length > 0
        ? "available"
        : reportedState === "available"
          ? "unknown"
          : reportedState;
    return {
      state,
      videoId: result?.videoId || expectedVideoId,
      reason: String(
        result?.reason ||
          (reportedState === "available" && tracks.length === 0
            ? "播放器报告了字幕轨道，但轨道缺少可用地址。"
            : "")
      ),
      tracks
    };
  } catch (error) {
    return {
      state: "unknown",
      videoId: expectedVideoId,
      reason: error instanceof Error ? error.message : String(error),
      tracks: []
    };
  }
}

async function fetchTranscriptViaInnertube(tab, track) {
  const empty = { segments: [], method: "", error: "" };
  try {
    let [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "MAIN",
      func: fetchYouTubeTranscriptEndpoint,
      args: [getYouTubeVideoId(tab.url), ""]
    });
    if (!result?.ok || !result.payload) {
      return { ...empty, error: result?.error || "文字记录接口不可用" };
    }

    const choices = globalThis.AtlasTranscript.getInnertubeLanguageChoices(
      result.payload
    );
    const targetChoice = choices.find((choice) =>
      sameTranscriptLanguage(choice.title, track.name)
    );
    const selectedChoice = choices.find((choice) => choice.selected);
    if (targetChoice && !targetChoice.selected && targetChoice.continuation) {
      [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: fetchYouTubeTranscriptEndpoint,
        args: [getYouTubeVideoId(tab.url), targetChoice.continuation]
      });
      if (!result?.ok || !result.payload) {
        return { ...empty, error: result?.error || "所选语言文字记录不可用" };
      }
    } else if (
      selectedChoice &&
      !sameTranscriptLanguage(selectedChoice.title, track.name) &&
      choices.length > 1
    ) {
      return { ...empty, error: "文字记录接口没有返回所选语言" };
    }

    const segments = globalThis.AtlasTranscript.parseInnertubeTranscript(
      result.payload
    );
    return segments.length > 0
      ? { segments, method: "innertube-get-transcript", error: "" }
      : { ...empty, error: "文字记录接口没有返回字幕段落" };
  } catch (error) {
    return {
      ...empty,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchTranscriptViaTimedText(tab, track) {
  const errors = [];
  for (const format of ["json3", "xml"]) {
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "MAIN",
        func: fetchYouTubeTimedText,
        args: [track.baseUrl, format, track.sourceClient]
      });
      if (!result?.ok) {
        errors.push(result?.code || result?.error || "timed-text 请求失败");
        continue;
      }
      let segments = [];
      if (format === "json3") {
        try {
          segments = globalThis.AtlasTranscript.parseJson3(JSON.parse(result.raw));
        } catch {
          errors.push("json3 无法解析");
          continue;
        }
      } else {
        segments = globalThis.AtlasTranscript.parseTimedTextXml(result.raw);
      }
      if (segments.length > 0) {
        return { segments, method: `timed-text-${format}`, error: "" };
      }
      errors.push(result.code || `${format} 没有字幕段落`);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  const error = errors.includes("po-token")
    ? "po-token"
    : errors.filter(Boolean).join("；").slice(0, 300);
  return { segments: [], method: "", error };
}

function transcriptCapabilityError(capability) {
  if (capability.state === "none") {
    return "这个视频没有 YouTube 提供的字幕轨道。若要得到文字，需要另行进行语音识别转录。";
  }
  if (capability.state === "unavailable") {
    return `当前视频或字幕不可用${capability.reason ? `：${capability.reason}` : ""}。`;
  }
  return `暂时无法判断这个视频是否有字幕${capability.reason ? `：${capability.reason}` : ""}。`;
}

function sameTranscriptLanguage(left, right) {
  const normalize = (value) =>
    String(value || "")
      .toLowerCase()
      .replace(/\((?:auto-generated|automatic|自动|人工)\)/g, "")
      .replace(/[\s_-]+/g, "")
      .trim();
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && (a === b || a.includes(b) || b.includes(a)));
}

function getYouTubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    return url.searchParams.get("v") || "";
  } catch {
    return "";
  }
}

async function tryFetchDirectDocument(
  tab,
  { expectedDocument = false, allowHtml = false, sourceKind = "" } = {}
) {
  if (!tab.url) return null;
  const url = new URL(tab.url);

  if (url.protocol === "file:") {
    const allowed = await chrome.extension.isAllowedFileSchemeAccess();
    if (!allowed) {
      throw new Error(
        "Atlas Sidebar 尚未获准读取本地文件。请在扩展详情中开启“允许访问文件网址”后重试，或点击“本地文件”手动选择原文件。"
      );
    }
    try {
      const response = await fetch(url.href);
      return await directDocumentFromResponse(response, url, tab, true, false, "current");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`无法读取这个本地文件：${message}。也可以点击“本地文件”手动选择原文件。`);
    }
  }

  if (!/^https?:$/.test(url.protocol)) return null;
  const obviousDocumentUrl = isLikelyDirectDocumentUrl(url.href);
  let probeDeclaredDocument = false;

  if (!obviousDocumentUrl && !expectedDocument) {
    try {
      const probe = await fetch(url.href, {
        method: "HEAD",
        credentials: "include"
      });
      if (probe.ok) {
        if (isDocumentResponse(probe)) {
          probeDeclaredDocument = true;
        } else if (!isGenericBinaryResponse(probe)) {
          return null;
        }
      } else if ([404, 410].includes(probe.status)) {
        return null;
      }
    } catch {
      // Some authenticated/download endpoints reject HEAD but allow GET.
    }
  }

  let response;
  try {
    response = await fetch(url.href, { credentials: "include" });
  } catch (error) {
    if (!obviousDocumentUrl && !expectedDocument) return null;
    throw error;
  }
  return directDocumentFromResponse(
    response,
    url,
    tab,
    obviousDocumentUrl || expectedDocument || probeDeclaredDocument,
    allowHtml,
    sourceKind
  );
}

async function directDocumentFromResponse(
  response,
  requestedUrl,
  tab,
  expectedDocument,
  allowHtml,
  sourceKind
) {
  if (!response.ok && response.status !== 0) {
    throw new Error(`文档请求失败：HTTP ${response.status}`);
  }
  const declaredDocument = isDocumentResponse(response);
  const dispositionName = fileNameFromContentDisposition(
    response.headers.get("content-disposition")
  );
  const expectsPdf =
    sourceKind === "pdf" ||
    isLikelyDirectDocumentUrl(requestedUrl.href) ||
    /\.pdf$/i.test(dispositionName);
  const sniffGenericBinary =
    !declaredDocument &&
    isGenericBinaryResponse(response) &&
    (!expectedDocument || expectsPdf);
  if (!declaredDocument && !expectedDocument && !sniffGenericBinary) return null;

  const declaredSize = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredSize) && declaredSize > MAX_BLOB_SIZE) {
    throw new Error("素材超过 50 MB，暂时无法加入临时区。");
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw createCaptureError(
      "empty-document",
      "服务器返回了空文档（0 B），因此没有加入临时素材。",
      true,
      "可以重试、只添加链接，或使用“本地文件”选择原文件。"
    );
  }
  let mime = normalizeMime(blob.type || response.headers.get("content-type"));
  if (expectsPdf || mime === "application/pdf") {
    if (!(await blobHasPdfHeader(blob))) {
      throw createCaptureError(
        "invalid-pdf",
        "服务器没有返回有效的 PDF 文件。",
        true,
        "可以只添加链接，或手动选择下载后的 PDF。"
      );
    }
    mime = "application/pdf";
  } else if (sniffGenericBinary) {
    if (!(await blobHasPdfHeader(blob))) return null;
    mime = "application/pdf";
  }
  if (mime.includes("html") && !allowHtml) {
    throw new Error("服务器返回了网页而不是文档文件。");
  }
  assertBlobSize(blob);

  const finalUrl = safeParsedUrl(response.url) || requestedUrl;
  const pathName = safeDecodeURIComponent(
    finalUrl.pathname.split("/").filter(Boolean).pop() || ""
  );
  const extension = documentExtension(mime, finalUrl.pathname, sourceKind);
  const rawName = dispositionName || pathName || tab.title || "document";
  const fileName = ensureDocumentExtension(safeFileName(rawName), extension);
  return { blob, fileName, mime };
}

function isGenericBinaryResponse(response) {
  const mime = normalizeMime(response.headers.get("content-type"));
  return !mime || mime === "application/octet-stream" || mime === "binary/octet-stream";
}

async function blobHasPdfHeader(blob) {
  return (await blob.slice(0, 1024).text()).includes("%PDF-");
}

function isDocumentResponse(response) {
  const mime = normalizeMime(response.headers.get("content-type"));
  const disposition = response.headers.get("content-disposition") || "";
  return (
    mime === "application/pdf" ||
    mime === "text/plain" ||
    mime === "text/markdown" ||
    mime === "application/markdown" ||
    /filename\*?=.*\.(?:pdf|txt|md|markdown)(?:[;\s]|$)/i.test(disposition)
  );
}

function normalizeMime(value) {
  return String(value || "").split(";", 1)[0].trim().toLowerCase();
}

function documentExtension(mime, pathname, sourceKind = "") {
  if (mime === "application/pdf") return ".pdf";
  if (mime === "text/html" || sourceKind === "html") return ".html";
  if (mime === "text/markdown" || mime === "application/markdown") return ".md";
  if (
    sourceKind === "source" ||
    mime.includes("gzip") ||
    mime.includes("tar") ||
    mime === "application/x-eprint-tar"
  ) {
    return ".tar.gz";
  }
  const match = pathname.match(/\.(pdf|txt|md|markdown)$/i);
  return match ? `.${match[1].toLowerCase()}` : ".txt";
}

function ensureDocumentExtension(fileName, extension) {
  return /\.(?:pdf|txt|md|markdown|html|tar\.gz|tgz)$/i.test(fileName)
    ? fileName
    : `${fileName}${extension}`;
}

function fileNameFromContentDisposition(value) {
  const source = String(value || "");
  const encoded = source.match(/filename\*\s*=\s*UTF-8''([^;]+)/i)?.[1];
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      return encoded;
    }
  }
  return source.match(/filename\s*=\s*"([^"]+)"/i)?.[1] ||
    source.match(/filename\s*=\s*([^;]+)/i)?.[1]?.trim() ||
    "";
}

function safeParsedUrl(value) {
  try {
    return value ? new URL(value) : null;
  } catch {
    return null;
  }
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return String(value || "");
  }
}

function isLikelyDirectDocumentUrl(value) {
  try {
    const url = new URL(value || "");
    return (
      url.protocol === "file:" ||
      /\.(?:pdf|txt|md|markdown)(?:$|[?#])/i.test(url.href) ||
      /\/pdf(?:\/|$)/i.test(url.pathname)
    );
  } catch {
    return false;
  }
}

function normalizeDiscoveredDocumentUrl(value, pageUrl) {
  if (!value) return "";
  const url = new URL(value, pageUrl || undefined);
  if (!/^https?:$/.test(url.protocol)) {
    throw new Error("发现的文档链接不是 HTTP(S) 地址。");
  }
  return url.href;
}

function makeDocumentSource(pageTab, targetTab, documentOption) {
  const source = makeSource(pageTab);
  if (!documentOption?.url) return source;
  return {
    ...source,
    pageUrl: pageTab.url || "",
    url: targetTab.url || pageTab.url || "",
    title: documentOption.label || targetTab.title || pageTab.title || "文档"
  };
}

function appendStagedItem(item) {
  return enqueueStageMutation(() => appendStagedItemNow(item));
}

async function appendStagedItemNow(item) {
  const stored = await chrome.storage.local.get(STAGING_KEY);
  const items = Array.isArray(stored[STAGING_KEY]) ? stored[STAGING_KEY] : [];
  const existing = items.find((candidate) => candidate?.id === item?.id);
  if (existing) return existing;
  const stagedItem = {
    ...item,
    groupKey:
      item.groupKey || item.source?.groupKey || makeGroupKeyFromSource(item.source)
  };
  items.push(stagedItem);

  await chrome.storage.local.set({ [STAGING_KEY]: items });
  await chrome.storage.session.set({ [STAGING_OPEN_KEY]: true });

  try {
    await chrome.runtime.sendMessage({ type: "ATLAS_STAGE_CHANGED" });
  } catch {
    // Side Panel may not have finished opening yet; it also reads storage on load.
  }
  return stagedItem;
}

function enqueueCapture(operation) {
  const pending = captureQueue.catch(() => undefined).then(operation);
  captureQueue = pending.catch(() => undefined);
  return pending;
}

function enqueueStageMutation(operation) {
  const pending = stageMutationQueue.catch(() => undefined).then(operation);
  stageMutationQueue = pending.catch(() => undefined);
  return pending;
}

function mutateStagedItems(mutation) {
  return enqueueStageMutation(async () => {
    const stored = await chrome.storage.local.get(STAGING_KEY);
    let items = Array.isArray(stored[STAGING_KEY]) ? stored[STAGING_KEY] : [];

    if (mutation?.action === "patch") {
      const patches = new Map(
        (Array.isArray(mutation.patches) ? mutation.patches : [])
          .filter((entry) => typeof entry?.id === "string")
          .map((entry) => [entry.id, sanitizeStagePatch(entry.patch)])
      );
      items = items.map((item) =>
        patches.has(item.id) ? { ...item, ...patches.get(item.id) } : item
      );
    } else if (mutation?.action === "remove") {
      const ids = new Set(
        (Array.isArray(mutation.ids) ? mutation.ids : []).filter(
          (id) => typeof id === "string"
        )
      );
      items = items.filter((item) => !ids.has(item.id));
    } else {
      throw new Error("未知的临时素材修改操作。");
    }

    await chrome.storage.local.set({ [STAGING_KEY]: items });
    return items;
  });
}

function sanitizeStagePatch(patch) {
  const safePatch = {};
  if (typeof patch?.selected === "boolean") safePatch.selected = patch.selected;
  if (["capturing", "ready", "added", "failed"].includes(patch?.status)) {
    safePatch.status = patch.status;
  }
  if (typeof patch?.error === "string") safePatch.error = patch.error.slice(0, 1000);
  if (typeof patch?.errorCode === "string") {
    safePatch.errorCode = patch.errorCode.slice(0, 80);
  }
  if (typeof patch?.retryable === "boolean") safePatch.retryable = patch.retryable;
  if (typeof patch?.fallback === "string") {
    safePatch.fallback = patch.fallback.slice(0, 500);
  }
  if (patch?.lastTransfer && typeof patch.lastTransfer === "object") {
    safePatch.lastTransfer = patch.lastTransfer;
  }
  return safePatch;
}

async function pruneStagedBlobs() {
  return enqueueStageMutation(async () => {
    const stored = await chrome.storage.local.get(STAGING_KEY);
    const items = Array.isArray(stored[STAGING_KEY]) ? stored[STAGING_KEY] : [];
    await globalThis.AtlasBlobStore.prune(
      items.filter((item) => item.blobKey).map((item) => item.blobKey)
    );
  });
}

function kindFromMenuId(menuItemId) {
  return (
    {
      [SELECTION_MENU_ID]: "selection",
      [PAGE_LINK_MENU_ID]: "link",
      [SCREENSHOT_MENU_ID]: "screenshot",
      [DOCUMENT_MENU_ID]: "document",
      [TRANSCRIPT_MENU_ID]: "transcript"
    }[menuItemId] || "unknown"
  );
}

function createContextMenu(options) {
  return new Promise((resolve, reject) => {
    chrome.contextMenus.create(options, () => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve();
    });
  });
}

function makeSource(tab) {
  return {
    tabId: tab.id ?? null,
    title: tab.title || "未命名页面",
    url: tab.url || "",
    groupKey: makeGroupKey(tab)
  };
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("无法识别当前活动页面。");
  return tab;
}

async function assertActivePageUnchanged(tab) {
  const current = await getActiveTab();
  if (makeGroupKey(current) === makeGroupKey(tab)) return;
  throw createCaptureError(
    "page-changed",
    "采集期间活动标签页或页面已经切换，因此没有保存这份素材。",
    true,
    "请回到原页面后重试。"
  );
}

async function openOrFocusExternalUrl(rawUrl) {
  const url = new URL(rawUrl);
  if (!/^https?:$/.test(url.protocol)) throw new Error("只能打开 HTTP(S) 页面。");
  const candidates = await chrome.tabs.query({ url: `${url.origin}/*` });
  const exact = candidates.find((tab) => tab.url === url.href);
  const chatGptHost =
    url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com");
  const existing = chatGptHost
    ? chooseChatGptTab(candidates) || exact
    : exact;
  if (existing?.id) {
    await chrome.tabs.update(existing.id, { active: true });
    if (existing.windowId !== undefined) {
      await chrome.windows.update(existing.windowId, { focused: true });
    }
    return existing;
  }
  return chrome.tabs.create({ url: url.href, active: true });
}

function chooseChatGptTab(candidates) {
  const tabs = Array.isArray(candidates) ? candidates : [];
  return (
    tabs.find(
      (tab) =>
        tab.active &&
        (isChatGptConversationUrl(tab.url) || isChatGptRootUrl(tab.url))
    ) ||
    tabs.find((tab) => isChatGptConversationUrl(tab.url)) ||
    tabs.find((tab) => isChatGptRootUrl(tab.url)) ||
    null
  );
}

function isChatGptConversationUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    if (!(url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com"))) {
      return false;
    }
    return /^\/(?:c|g|project)\//.test(url.pathname);
  } catch {
    return false;
  }
}

function isChatGptRootUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    return (
      (url.hostname === "chatgpt.com" || url.hostname.endsWith(".chatgpt.com")) &&
      url.pathname === "/"
    );
  } catch {
    return false;
  }
}

async function transferToTopLevelChatGpt(payload) {
  const text = String(payload?.text || "");
  if (!text.trim()) throw new Error("没有可写入 ChatGPT 标签页的文字。");

  const tab = await openOrFocusExternalUrl("https://chatgpt.com/");
  if (!tab?.id) throw new Error("无法识别 ChatGPT 标签页。");

  const result = await sendTabMessageWithRetry(
    tab.id,
    {
      type: "ATLAS_TOP_LEVEL_TRANSFER",
      payload: { text }
    },
    10_000
  );
  if (result?.autoSent !== false || !result?.text?.ok) {
    throw new Error(result?.text?.error || result?.error || "ChatGPT 标签页没有确认文字写入。");
  }
  return { tab, result };
}

async function sendTabMessageWithRetry(tabId, message, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;
  do {
    try {
      return await chrome.tabs.sendMessage(tabId, message, { frameId: 0 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  } while (Date.now() < deadline);

  throw new Error(
    `无法连接 ChatGPT 标签页：${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

function makeGroupKey(tab) {
  return makeGroupKeyFromSource({ tabId: tab?.id ?? null, url: tab?.url || "" });
}

function makeGroupKeyFromSource(source) {
  let url = String(source?.url || "");
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    url = parsed.href;
  } catch {
    // Restricted pages may not expose a normal URL; keep the serialized value.
  }
  return `${source?.tabId ?? "unknown"}:${url}`;
}

function safeFileName(value) {
  return String(value || "file")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "file";
}

function isYouTubeWatchUrl(value) {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") &&
      url.pathname === "/watch" &&
      Boolean(url.searchParams.get("v"))
    );
  } catch {
    return false;
  }
}

function assertBlobSize(blob) {
  if (blob.size > MAX_BLOB_SIZE) {
    throw new Error("素材超过 50 MB，暂时无法加入临时区。");
  }
}

async function readImageDimensions(blob) {
  const declaredType = String(blob?.type || "").toLowerCase().split(";", 1)[0];
  if (declaredType && declaredType !== "image/png") {
    throw createCaptureError(
      "invalid-image",
      `Chrome 返回了 ${declaredType}，不是预期的 PNG 截图。`,
      true,
      "请重试截图。"
    );
  }
  if (!(blob instanceof Blob) || blob.size < 24) {
    throw createCaptureError(
      "invalid-image",
      "Chrome 返回的截图为空或不完整。",
      true,
      "请重试截图。"
    );
  }

  const header = new Uint8Array(await blob.slice(0, 24).arrayBuffer());
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const hasSignature = signature.every((value, index) => header[index] === value);
  const hasIhdr = String.fromCharCode(...header.slice(12, 16)) === "IHDR";
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);
  if (
    !hasSignature ||
    !hasIhdr ||
    width <= 0 ||
    height <= 0 ||
    width > 100_000 ||
    height > 100_000
  ) {
    throw createCaptureError(
      "invalid-image",
      "Chrome 返回的截图不是有效的 PNG 图像。",
      true,
      "请重试截图。"
    );
  }

  if (typeof createImageBitmap === "function") {
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      if (bitmap.width !== width || bitmap.height !== height) {
        throw new Error("PNG header dimensions do not match decoded pixels.");
      }
    } catch {
      throw createCaptureError(
        "invalid-image",
        "截图 PNG 无法解码，因此没有保存。",
        true,
        "请重试截图。"
      );
    } finally {
      bitmap?.close?.();
    }
  }

  return { width, height };
}

function extractReadableText() {
  const source =
    document.querySelector("article, main, [role='main']") || document.body;
  if (!source) return { title: document.title, url: location.href, text: "" };
  const clone = source.cloneNode(true);
  clone
    .querySelectorAll("script, style, noscript, nav, aside, footer, form, button, input, textarea, select")
    .forEach((element) => element.remove());
  const text = (clone.innerText || clone.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, 2_000_000);
  return { title: document.title, url: location.href, text };
}

function discoverDocumentLinks() {
  const seen = new Set();
  const options = [];
  const anchors = Array.from(document.querySelectorAll("a[href]"));
  for (const anchor of anchors) {
    let url;
    try {
      url = new URL(anchor.href, location.href);
    } catch {
      continue;
    }
    if (!/^https?:$/.test(url.protocol)) continue;
    url.hash = "";
    if (seen.has(url.href)) continue;

    const text = String(
      anchor.innerText || anchor.textContent || anchor.getAttribute("aria-label") || ""
    )
      .replace(/\s+/g, " ")
      .trim();
    const lowerText = text.toLowerCase();
    const path = url.pathname.toLowerCase();
    let kind = "";
    let priority = 0;

    const declaredType = String(anchor.type || anchor.getAttribute("type") || "")
      .toLowerCase()
      .split(";", 1)[0]
      .trim();
    const downloadName = String(anchor.download || anchor.getAttribute("download") || "")
      .toLowerCase()
      .trim();

    if (
      declaredType === "application/pdf" ||
      /\.pdf$/.test(downloadName) ||
      /\.pdf$/.test(path) ||
      /\/pdf(?:\/|$)/.test(path) ||
      /\bpdf\b/.test(lowerText)
    ) {
      kind = "pdf";
      priority = 100;
    } else if (
      /\.(?:txt|md|markdown)$/.test(path) ||
      /\b(?:markdown|plain text)\b/.test(lowerText)
    ) {
      kind = "text";
      priority = 80;
    } else if (
      /\/html(?:\/|$)/.test(path) ||
      /\bhtml(?: full text)?\b|html \(experimental\)/.test(lowerText)
    ) {
      kind = "html";
      priority = 60;
    } else if (
      /\/src(?:\/|$)/.test(path) ||
      /\b(?:tex source|source files?)\b/.test(lowerText)
    ) {
      kind = "source";
      priority = 40;
    }
    if (!kind) continue;

    seen.add(url.href);
    const kindLabel =
      { pdf: "PDF", text: "文本", html: "HTML", source: "源文件" }[kind] || "文档";
    options.push({
      url: url.href,
      kind,
      priority,
      label: `${kindLabel} · ${(text || url.pathname.split("/").pop() || url.hostname).slice(0, 80)}`
    });
  }

  return options
    .sort((left, right) => right.priority - left.priority)
    .map(({ priority: _priority, ...option }) => option);
}

async function notifyActiveContextChanged() {
  try {
    await chrome.runtime.sendMessage({ type: "ATLAS_ACTIVE_CONTEXT_CHANGED" });
  } catch {
    // Side Panel may be closed.
  }
}

function readYouTubeTranscriptDom() {
  const renderers = Array.from(
    document.querySelectorAll(
      "ytd-transcript-segment-renderer, transcript-segment-view-model"
    )
  );
  const segments = renderers
    .map((renderer) => {
      const timestamp = (
        renderer.querySelector(
          "#segment-timestamp, .segment-timestamp, [class*='Timestamp']"
        )?.textContent || ""
      ).trim();
      const text = (
        renderer.querySelector(
          "#segment-text, .segment-text, [class*='Snippet'], [class*='segmentText']"
        )?.textContent || ""
      ).trim();
      const parts = timestamp.split(":").map(Number);
      const start = parts.reduce(
        (total, part) => total * 60 + (Number(part) || 0),
        0
      );
      return { start, duration: 0, text };
    })
    .filter((segment) => segment.text);
  const language = (
    document.querySelector(
      "ytd-transcript-search-panel-renderer yt-dropdown-menu #label-text, ytd-transcript-search-panel-renderer [aria-selected='true']"
    )?.textContent || ""
  ).trim();
  return { panelOpen: renderers.length > 0, segments, language };
}

async function readBilibiliTranscriptCapability(expectedUrl) {
  try {
    const url = new URL(expectedUrl || location.href);
    const initial = globalThis.__INITIAL_STATE__ || {};
    const videoData = initial.videoData || initial.videoInfo || {};
    const epInfo = initial.epInfo || initial.epInfoData || {};
    const videoMatch = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10}|av(\d+))/i);
    const epMatch = url.pathname.match(/^\/bangumi\/play\/ep(\d+)/i);
    const matchedVideoId = String(videoMatch?.[1] || "");
    const urlBvid = /^BV/i.test(matchedVideoId) ? matchedVideoId : "";
    const urlAid = Number(videoMatch?.[2]) || 0;
    const stateBvid = String(videoData.bvid || initial.bvid || epInfo.bvid || "");
    const stateAid = Number(videoData.aid || initial.aid || epInfo.aid) || 0;
    const directVideo = Boolean(videoMatch);
    const stateIdentityMatches = urlBvid
      ? stateBvid.toLowerCase() === urlBvid.toLowerCase()
      : urlAid
        ? stateAid === urlAid
        : true;
    let bvid = urlBvid || (stateIdentityMatches && /^BV/i.test(stateBvid) ? stateBvid : "");
    let aid = urlAid || (stateIdentityMatches ? stateAid : 0);
    let cid = directVideo
      ? stateIdentityMatches
        ? Number(videoData.cid || initial.cid) || 0
        : 0
      : Number(videoData.cid || initial.cid || epInfo.cid) || 0;
    const page = Math.max(1, Number(url.searchParams.get("p")) || 1);
    const initialPages = stateIdentityMatches && Array.isArray(videoData.pages)
      ? videoData.pages
      : [];
    const initialPageCid = Number(
      initialPages.find((entry) => Number(entry.page) === page)?.cid
    ) || 0;
    if (initialPageCid) cid = initialPageCid;

    if (!cid || (!bvid && !aid) || (page > 1 && !initialPageCid)) {
      const viewParams = new URLSearchParams();
      if (bvid) viewParams.set("bvid", bvid);
      else if (aid) viewParams.set("aid", String(aid));
      if (viewParams.size) {
        const viewResponse = await fetch(
          `https://api.bilibili.com/x/web-interface/view?${viewParams}`,
          { credentials: "include" }
        );
        if (viewResponse.status === 412) {
          return {
            ok: false,
            blocked: true,
            httpStatus: 412,
            bvid,
            aid,
            cid,
            episodeId: Number(epMatch?.[1]) || 0,
            tracksKnown: false
          };
        }
        const viewPayload = await viewResponse.json();
        if (viewPayload?.code === 0 && viewPayload.data) {
          const viewBvid = String(viewPayload.data.bvid || "");
          const viewAid = Number(viewPayload.data.aid) || 0;
          const viewIdentityMatches = urlBvid
            ? viewBvid.toLowerCase() === urlBvid.toLowerCase()
            : urlAid
              ? viewAid === urlAid
              : true;
          if (!viewIdentityMatches) {
            return {
              ok: false,
              tracksKnown: false,
              bvid: urlBvid,
              aid: urlAid,
              cid: 0,
              episodeId: Number(epMatch?.[1]) || 0,
              reason: "B 站 view 接口返回了其他视频的数据。"
            };
          }
          bvid = urlBvid || viewBvid || bvid;
          aid = urlAid || viewAid || aid;
          const pages = Array.isArray(viewPayload.data.pages) ? viewPayload.data.pages : [];
          cid = Number(pages.find((entry) => Number(entry.page) === page)?.cid) ||
            Number(viewPayload.data.cid) || cid;
        }
      }
    }

    if (!cid || (!bvid && !aid)) {
      return {
        ok: false,
        tracksKnown: false,
        bvid,
        aid,
        cid,
        episodeId: Number(epMatch?.[1]) || 0,
        reason: "无法识别当前 B 站视频的 bvid/aid 与 cid。"
      };
    }

    const playerParams = new URLSearchParams({ cid: String(cid) });
    if (bvid) playerParams.set("bvid", bvid);
    else playerParams.set("aid", String(aid));
    if (epMatch?.[1]) playerParams.set("ep_id", epMatch[1]);
    const response = await fetch(
      `https://api.bilibili.com/x/player/v2?${playerParams}`,
      { credentials: "include" }
    );
    if (response.status === 412) {
      return { ok: false, blocked: true, httpStatus: 412, bvid, aid, cid, episodeId: Number(epMatch?.[1]) || 0, tracksKnown: false };
    }
    const payload = await response.json();
    if (Number(payload?.code) === -101) {
      return { ok: false, code: -101, needLogin: true, bvid, aid, cid, episodeId: Number(epMatch?.[1]) || 0, tracksKnown: false };
    }
    if (payload?.code !== 0 || !payload.data) {
      return {
        ok: false,
        restricted: [-10403, -403, -404].includes(Number(payload?.code)),
        code: Number(payload?.code),
        bvid,
        aid,
        cid,
        episodeId: Number(epMatch?.[1]) || 0,
        tracksKnown: false,
        reason: String(payload?.message || "播放器信息不可用。")
      };
    }
    const playerBvid = String(payload.data.bvid || "");
    const playerAid = Number(payload.data.aid) || 0;
    const playerCid = Number(payload.data.cid) || 0;
    const playerIdentityMismatch =
      (bvid && playerBvid && playerBvid.toLowerCase() !== bvid.toLowerCase()) ||
      (!bvid && aid && playerAid && playerAid !== aid) ||
      (playerCid && playerCid !== cid);
    if (playerIdentityMismatch) {
      return {
        ok: false,
        tracksKnown: false,
        bvid,
        aid,
        cid,
        episodeId: Number(epMatch?.[1]) || 0,
        reason: "B 站 player 接口返回了其他视频或分 P 的数据。"
      };
    }
    const tracks = Array.isArray(payload.data.subtitle?.subtitles)
      ? payload.data.subtitle.subtitles.map((track) => ({
          ...track,
          source: "player-v2"
        }))
      : [];
    const needLogin = Boolean(payload.data.need_login_subtitle) && tracks.length === 0;
    let subtitleViewBytes = [];
    let subtitleViewError = "";
    let subtitleViewHttpStatus = 0;
    try {
      const subtitleViewParams = new URLSearchParams({
        oid: String(playerCid || cid),
        pid: String(playerAid || aid),
        type: "1",
        context_ext: JSON.stringify({ video_type: epMatch?.[1] ? 2 : 1 })
      });
      if (payload.data.asr_language) {
        subtitleViewParams.set("arc_video_language", String(payload.data.asr_language));
      }
      if (payload.data.ocr_language) {
        subtitleViewParams.set("arc_hardcoded_language", String(payload.data.ocr_language));
      }
      const subtitleViewResponse = await fetch(
        `https://api.bilibili.com/x/v2/subtitle/web/view?${subtitleViewParams}`,
        { credentials: "include" }
      );
      subtitleViewHttpStatus = subtitleViewResponse.status;
      if (subtitleViewResponse.ok) {
        subtitleViewBytes = Array.from(new Uint8Array(await subtitleViewResponse.arrayBuffer()));
      } else {
        subtitleViewError = `HTTP ${subtitleViewResponse.status}`;
      }
    } catch (error) {
      subtitleViewError = error instanceof Error ? error.message : String(error);
    }
    return {
      ok: true,
      bvid: playerBvid || bvid,
      aid: playerAid || aid,
      cid: playerCid || cid,
      episodeId: Number(epMatch?.[1]) || 0,
      needLogin,
      tracksKnown: !needLogin,
      tracks,
      subtitleViewBytes,
      subtitleViewHttpStatus,
      subtitleViewError
    };
  } catch (error) {
    return {
      ok: false,
      tracksKnown: false,
      reason: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchBilibiliSubtitleTrack(rawUrl) {
  try {
    const url = new URL(String(rawUrl || ""));
    if (
      url.protocol !== "https:" ||
      !(url.hostname === "hdslb.com" || url.hostname.endsWith(".hdslb.com"))
    ) return { ok: false, code: "invalid-url", error: "字幕地址不可信。" };
    const response = await fetch(url.href, { credentials: "omit" });
    if (response.status === 412) {
      return { ok: false, code: "blocked", httpStatus: 412, error: "HTTP 412" };
    }
    if (!response.ok) {
      return {
        ok: false,
        code: "http",
        httpStatus: response.status,
        error: `HTTP ${response.status}`
      };
    }
    const payload = await response.json();
    return { ok: true, payload, fetchMode: "page" };
  } catch (error) {
    return {
      ok: false,
      code: "fetch-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function readYouTubeTranscriptCapability(expectedVideoId) {
  const CACHE_KEY = "__atlasTranscriptCapabilityV3";
  const cached = window[CACHE_KEY];
  if (
    cached?.videoId === expectedVideoId &&
    Date.now() - Number(cached.at || 0) < 15_000
  ) {
    return cached.result;
  }
  const finish = (result) => {
    try {
      window[CACHE_KEY] = { videoId: expectedVideoId, at: Date.now(), result };
    } catch {
      // A frozen page global only disables the short-lived cache.
    }
    return result;
  };
  const readConfig = (key) => {
    try {
      return window.ytcfg?.get?.(key) ?? window.ytcfg?.data_?.[key];
    } catch {
      return undefined;
    }
  };
  const parsePlayerResponse = (value) => {
    if (!value) return null;
    if (typeof value === "object") return value;
    if (typeof value !== "string") return null;
    try {
      return JSON.parse(value);
    } catch {
      return null;
    }
  };
  const responseVideoId = (response) => response?.videoDetails?.videoId || "";
  const responseTracks = (response) => {
    const tracks =
      response?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
    return Array.isArray(tracks) ? tracks : [];
  };
  const requiresPoToken = (baseUrl) => {
    try {
      const url = new URL(baseUrl);
      return (
        /^xp[ev]$/.test(url.searchParams.get("exp") || "") &&
        !url.searchParams.get("pot")
      );
    } catch {
      return false;
    }
  };
  const fetchPlayerResponse = async ({
    apiKey,
    context,
    clientNumber,
    credentials,
    visitorData = ""
  }) => {
    const client = context.client;
    const headers = {
      "content-type": "application/json",
      "x-youtube-client-name": String(clientNumber),
      "x-youtube-client-version": String(client.clientVersion)
    };
    if (visitorData) headers["x-goog-visitor-id"] = visitorData;
    const response = await fetch(
      `/youtubei/v1/player?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
      {
        method: "POST",
        credentials,
        headers,
        body: JSON.stringify({
          context,
          videoId: expectedVideoId,
          contentCheckOk: true,
          racyCheckOk: true
        })
      }
    );
    if (!response.ok) return null;
    const payload = await response.json();
    return responseVideoId(payload) === expectedVideoId ? payload : null;
  };
  const currentResponses = [];
  try {
    currentResponses.push(
      parsePlayerResponse(document.querySelector("#movie_player")?.getPlayerResponse?.())
    );
  } catch {
    // Some player variants do not expose getPlayerResponse.
  }
  currentResponses.push(
    parsePlayerResponse(window.ytInitialPlayerResponse),
    parsePlayerResponse(window.ytplayer?.config?.args?.player_response)
  );

  let webResponse = currentResponses.find(
    (response) => responseVideoId(response) === expectedVideoId
  );
  const apiKey = readConfig("INNERTUBE_API_KEY");
  const pageContext = readConfig("INNERTUBE_CONTEXT");
  const pageClientVersion =
    pageContext?.client?.clientVersion || readConfig("INNERTUBE_CLIENT_VERSION");
  const responses = [];
  if (webResponse) responses.push({ response: webResponse, sourceClient: "web" });

  if (
    (!webResponse || responseTracks(webResponse).length === 0) &&
    apiKey &&
    pageClientVersion
  ) {
    try {
      const client = pageContext?.client || {
        clientName: "WEB",
        clientVersion: pageClientVersion,
        hl: document.documentElement.lang || "en",
        gl: "US"
      };
      const visitorData = client.visitorData || readConfig("VISITOR_DATA") || "";
      const freshWeb = await fetchPlayerResponse({
        apiKey,
        context: pageContext || { client },
        clientNumber: readConfig("INNERTUBE_CONTEXT_CLIENT_NAME") || 1,
        credentials: "include",
        visitorData
      });
      if (freshWeb) {
        webResponse = freshWeb;
        responses.push({ response: freshWeb, sourceClient: "web" });
      }
    } catch {
      // Continue with the matching in-page response and alternate client.
    }
  }

  if (apiKey) {
    try {
      const language =
        pageContext?.client?.hl || document.documentElement.lang || "en";
      const region = pageContext?.client?.gl || "US";
      const androidResponse = await fetchPlayerResponse({
        apiKey,
        context: {
          client: {
            clientName: "ANDROID",
            clientVersion: "20.10.38",
            androidSdkVersion: 30,
            osName: "Android",
            osVersion: "11",
            hl: language,
            gl: region
          }
        },
        clientNumber: 3,
        credentials: "omit"
      });
      if (androidResponse) {
        responses.push({ response: androidResponse, sourceClient: "android" });
      }
    } catch {
      // WEB/session tracks remain available when the alternate client changes.
    }
  }

  const mergedTracks = new Map();
  for (const { response, sourceClient } of responses) {
    if (response?.playabilityStatus?.status !== "OK") continue;
    for (const [index, track] of responseTracks(response).entries()) {
      if (!track?.baseUrl || !track?.languageCode) continue;
      const name =
        track.name?.simpleText ||
        track.name?.runs?.map((run) => run.text).join("") ||
        track.languageCode;
      const kind = track.kind === "asr" ? "asr" : "manual";
      const id =
        track.vssId || `${track.languageCode}:${kind}:${String(name).toLowerCase()}`;
      const candidate = {
        id,
        baseUrl: track.baseUrl,
        languageCode: track.languageCode,
        kind,
        name,
        isTranslatable: Boolean(track.isTranslatable),
        sourceClient,
        poTokenRequired: requiresPoToken(track.baseUrl),
        index
      };
      const previous = mergedTracks.get(id);
      const score = (value) =>
        (value.poTokenRequired ? 100 : 0) +
        (value.sourceClient === "android" ? 0 : 10) +
        value.index / 1000;
      if (!previous || score(candidate) < score(previous)) {
        mergedTracks.set(id, candidate);
      }
    }
  }

  const tracks = Array.from(
    mergedTracks.values(),
    ({ index: _index, ...track }) => track
  );
  if (tracks.length > 0) {
    return finish({
      state: "available",
      videoId: expectedVideoId,
      reason: "",
      tracks
    });
  }

  const playableResponse = responses.find(
    ({ response }) => response?.playabilityStatus?.status === "OK"
  );
  if (playableResponse) {
    return finish({
      state: "none",
      videoId: expectedVideoId,
      reason: "WEB/Android 播放器数据中都没有 captionTracks。",
      tracks: []
    });
  }

  const unavailable = responses.find(
    ({ response }) => response?.playabilityStatus?.status
  )?.response?.playabilityStatus;
  if (unavailable) {
    return finish({
      state: "unavailable",
      videoId: expectedVideoId,
      reason:
        unavailable.reason ||
        unavailable.messages?.join?.("；") ||
        `播放器状态 ${unavailable.status}`,
      tracks: []
    });
  }

  return finish({
    state: "unknown",
    videoId: expectedVideoId,
    reason: "没有取得与当前视频一致的 WEB 或 Android 播放器数据。",
    tracks: []
  });
}

async function fetchYouTubeTranscriptEndpoint(expectedVideoId, paramsOverride) {
  const readConfig = (key) => {
    try {
      return window.ytcfg?.get?.(key) ?? window.ytcfg?.data_?.[key];
    } catch {
      return undefined;
    }
  };
  const findTranscriptParams = (root) => {
    const stack = [root];
    const seen = new Set();
    while (stack.length > 0) {
      const value = stack.pop();
      if (!value || typeof value !== "object" || seen.has(value)) continue;
      seen.add(value);
      const params = value.getTranscriptEndpoint?.params;
      if (typeof params === "string" && params) return params;
      for (const child of Object.values(value)) {
        if (child && typeof child === "object") stack.push(child);
      }
    }
    return "";
  };
  const paramsMatchVideo = (params, videoId) => {
    try {
      const normalized = decodeURIComponent(params)
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const padded = normalized.padEnd(
        normalized.length + ((4 - (normalized.length % 4)) % 4),
        "="
      );
      return atob(padded).includes(videoId);
    } catch {
      return false;
    }
  };

  try {
    const currentVideoId = new URL(location.href).searchParams.get("v") || "";
    if (!expectedVideoId || currentVideoId !== expectedVideoId) {
      return { ok: false, code: "stale-video", error: "YouTube 页面已经切换到另一个视频。" };
    }

    let params = String(paramsOverride || "") || findTranscriptParams(window.ytInitialData);
    if (!paramsOverride && params && !paramsMatchVideo(params, expectedVideoId)) {
      params = "";
    }
    if (!params) {
      const watchResponse = await fetch(location.href, { credentials: "include" });
      const html = await watchResponse.text();
      params =
        html.match(/"getTranscriptEndpoint":\{"params":"([^"]+)"/)?.[1] ||
        "";
    }
    const apiKey = readConfig("INNERTUBE_API_KEY");
    const context = readConfig("INNERTUBE_CONTEXT");
    const clientVersion =
      context?.client?.clientVersion || readConfig("INNERTUBE_CLIENT_VERSION");
    if (!params || !apiKey || !clientVersion) {
      return {
        ok: false,
        code: "missing-config",
        error: "页面没有提供文字记录接口参数。"
      };
    }

    const client = context?.client || {
      clientName: "WEB",
      clientVersion,
      hl: document.documentElement.lang || "en",
      gl: "US"
    };
    const visitorData = client.visitorData || readConfig("VISITOR_DATA") || "";
    const headers = {
      "content-type": "application/json",
      "x-youtube-client-name": String(
        readConfig("INNERTUBE_CONTEXT_CLIENT_NAME") || 1
      ),
      "x-youtube-client-version": String(clientVersion)
    };
    if (visitorData) headers["x-goog-visitor-id"] = visitorData;
    const response = await fetch(
      `/youtubei/v1/get_transcript?key=${encodeURIComponent(apiKey)}&prettyPrint=false`,
      {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({ context: context || { client }, params })
      }
    );
    if (!response.ok) {
      return {
        ok: false,
        code: "http",
        error: `文字记录接口返回 HTTP ${response.status}`
      };
    }
    return { ok: true, payload: await response.json() };
  } catch (error) {
    return {
      ok: false,
      code: "request-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function fetchYouTubeTimedText(baseUrl, format, sourceClient = "web") {
  try {
    const url = new URL(baseUrl);
    if (!(url.hostname === "youtube.com" || url.hostname.endsWith(".youtube.com"))) {
      return { ok: false, code: "invalid-host", error: "字幕地址不属于 YouTube。" };
    }
    if (format === "json3") url.searchParams.set("fmt", "json3");
    else url.searchParams.delete("fmt");
    const response = await fetch(url.href, {
      credentials: sourceClient === "android" ? "omit" : "include"
    });
    const raw = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        code: `http-${response.status}`,
        error: `timed-text 返回 HTTP ${response.status}`
      };
    }
    if (!raw.trim()) {
      const poTokenRequired = /(?:^|[?&])exp=xp[ev](?:&|$)/.test(url.search);
      return {
        ok: false,
        code: poTokenRequired ? "po-token" : "empty",
        error: poTokenRequired ? "字幕请求需要 PO Token" : "timed-text 返回空内容"
      };
    }
    return {
      ok: true,
      raw: raw.slice(0, 5_000_000),
      contentType: response.headers.get("content-type") || ""
    };
  } catch (error) {
    return {
      ok: false,
      code: "request-failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}
