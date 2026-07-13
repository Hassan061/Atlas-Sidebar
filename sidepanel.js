const HOME_URL = "https://chatgpt.com/";
const LAST_URL_KEY = "atlasSidebarLastUrl";
const STAGING_KEY = "atlasStagedItems";
const STAGING_OPEN_KEY = "atlasOpenStagingOnLoad";
const BRIDGE_RESPONSE_SOURCE = "atlas-chatgpt-bridge";
const SIDEPANEL_LIFETIME_PORT = "ATLAS_SIDEPANEL_LIFETIME";
const CHATGPT_BRIDGE_TIMEOUT_MS = 12_000;
const MAX_BLOB_SIZE = 50 * 1024 * 1024;
const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

const addressForm = document.querySelector("#address-form");
const addressInput = document.querySelector("#address");
const browserFrame = document.querySelector("#browser-frame");
const status = document.querySelector("#status");
const backButton = document.querySelector("#back");
const forwardButton = document.querySelector("#forward");
const reloadButton = document.querySelector("#reload");
const openExternalButton = document.querySelector("#open-external");
const openSettingsButton = document.querySelector("#open-settings");
const pageLibraryToggleButton = document.querySelector("#page-library-toggle");
const pageLibraryBadge = document.querySelector("#page-library-badge");
const pageLibrary = document.querySelector("#page-library");
const pageLibrarySummary = document.querySelector("#page-library-summary");
const closePageLibraryButton = document.querySelector("#close-page-library");
const currentPageNameRow = document.querySelector("#current-page-name-row");
const currentPageName = document.querySelector("#current-page-name");
const editCurrentPageNameButton = document.querySelector("#edit-current-page-name");
const saveCurrentPageNameButton = document.querySelector("#save-current-page-name");
const cancelCurrentPageNameButton = document.querySelector("#cancel-current-page-name");
const currentPageTitle = document.querySelector("#current-page-title");
const currentPageUrl = document.querySelector("#current-page-url");
const saveCurrentPageButton = document.querySelector("#save-current-page");
const pageLibrarySearch = document.querySelector("#page-library-search");
const savedPagesTab = document.querySelector("#saved-pages-tab");
const recentPagesTab = document.querySelector("#recent-pages-tab");
const savedPagesCount = document.querySelector("#saved-pages-count");
const recentPagesCount = document.querySelector("#recent-pages-count");
const pageLibraryListPanel = document.querySelector("#page-library-list-panel");
const pageLibraryEmpty = document.querySelector("#page-library-empty");
const pageLibraryList = document.querySelector("#page-library-list");
const pageLibraryListSummary = document.querySelector("#page-library-list-summary");
const pageLibrarySelectedCount = document.querySelector("#page-library-selected-count");
const pageLibraryFooter = document.querySelector(".page-library-footer");
const selectAllPageResultsButton = document.querySelector("#select-all-page-results");
const viewAllRecentPagesButton = document.querySelector("#view-all-recent-pages");
const clearRecentPagesButton = document.querySelector("#clear-recent-pages");
const deleteSelectedPagesButton = document.querySelector("#delete-selected-pages");
const pageLibraryMessage = document.querySelector("#page-library-message");
const stageToggleButton = document.querySelector("#stage-toggle");
const stageBadge = document.querySelector("#stage-badge");
const stagingDrawer = document.querySelector("#staging-drawer");
const stagingSummary = document.querySelector("#staging-summary");
const stagingEmpty = document.querySelector("#staging-empty");
const stagingList = document.querySelector("#staging-list");
const stagingMessage = document.querySelector("#staging-message");
const clearStagingButton = document.querySelector("#clear-staging");
const closeStagingButton = document.querySelector("#close-staging");
const copyDiagnosticsButton = document.querySelector("#copy-diagnostics");
const copySelectedButton = document.querySelector("#copy-selected");
const downloadSelectedButton = document.querySelector("#download-selected");
const transferSelectedButton = document.querySelector("#transfer-selected");
const captureActionButtons = Array.from(
  document.querySelectorAll("[data-capture-kind]")
);
const transcriptButton = document.querySelector('[data-capture-kind="transcript"]');
const transcriptLanguage = document.querySelector("#transcript-language");
const documentSource = document.querySelector("#document-source");
const localFileButton = document.querySelector("#local-file");
const localFileInput = document.querySelector("#local-file-input");
const savedPromptsButton = document.querySelector("#saved-prompts");
const promptPicker = document.querySelector("#prompt-picker");
const promptPickerSearch = document.querySelector("#prompt-picker-search");
const promptPickerList = document.querySelector("#prompt-picker-list");
const promptPickerEmpty = document.querySelector("#prompt-picker-empty");
const promptVariablePanel = document.querySelector("#prompt-variable-panel");
const promptVariableFields = document.querySelector("#prompt-variable-fields");
const promptVariableHelp = document.querySelector("#prompt-variable-help");
const selectedPromptName = document.querySelector("#selected-prompt-name");
const selectedPromptPreview = document.querySelector("#selected-prompt-preview");
const promptPickerMessage = document.querySelector("#prompt-picker-message");
const addSavedPromptButton = document.querySelector("#add-saved-prompt");
const errorPanel = document.querySelector("#error-panel");
const errorTitle = document.querySelector("#error-title");
const errorMessage = document.querySelector("#error-message");
const errorRetryButton = document.querySelector("#error-retry");
const errorOpenExternalButton = document.querySelector("#error-open-external");

let currentUrl = HOME_URL;
let pageState = globalThis.AtlasPageSessions.createDefault(HOME_URL);
let pageLibraryView = "saved";
let showAllRecentPages = false;
let visiblePageEntries = [];
const selectedSavedPageIds = new Set();
const selectedRecentPageUrls = new Set();
let lastPageSelectionIndex = -1;
let editingSavedPageId = "";
let editingCurrentPageName = false;
let activeFrameDocumentId = "";
let stagedItems = [];
let activePageContext = null;
let bridgeConnected = false;
let bridgeReady = false;
let bridgeHealthTimer = null;
let navigationVersion = 0;
let captureCapabilitiesVersion = 0;
let documentOptionsVersion = 0;
let transcriptOptionsVersion = 0;
const frameLeaseId = crypto.randomUUID();
let frameLeasePort = null;
let sidepanelClosing = false;
const bridgeRequests = new Map();
const previewUrls = new Map();
let currentSettings = globalThis.AtlasSettings.normalize();
let promptLibrary = globalThis.AtlasPrompts.normalizeLibrary();
let selectedSavedPrompt = null;

addressForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void navigate(addressInput.value, { addToHistory: true });
});
addressInput.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  addressInput.value = currentUrl;
  addressInput.blur();
});

backButton.addEventListener("click", () => {
  void moveThroughPageHistory(-1);
});

forwardButton.addEventListener("click", () => {
  void moveThroughPageHistory(1);
});

reloadButton.addEventListener("click", () => {
  void navigate(currentUrl, { addToHistory: false });
});

openExternalButton.addEventListener("click", () => {
  void openCurrentUrlInTab().catch(reportNavigationError);
});
openSettingsButton.addEventListener("click", () => chrome.runtime.openOptionsPage());
pageLibraryToggleButton.addEventListener("click", openPageLibrary);
closePageLibraryButton.addEventListener("click", closePageLibrary);
saveCurrentPageButton.addEventListener("click", () => void saveCurrentPage());
editCurrentPageNameButton.addEventListener("click", startCurrentPageNameEdit);
saveCurrentPageNameButton.addEventListener("click", () => void saveCurrentPageName());
cancelCurrentPageNameButton.addEventListener("click", cancelCurrentPageNameEdit);
currentPageName.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    void saveCurrentPageName();
  } else if (event.key === "Escape") {
    event.preventDefault();
    cancelCurrentPageNameEdit();
  }
});
pageLibrarySearch.addEventListener("input", handlePageLibrarySearchInput);
savedPagesTab.addEventListener("click", () => selectPageLibraryView("saved"));
recentPagesTab.addEventListener("click", () => selectPageLibraryView("recent"));
for (const tab of [savedPagesTab, recentPagesTab]) {
  tab.addEventListener("keydown", handlePageLibraryTabKeydown);
}
viewAllRecentPagesButton.addEventListener("click", () => {
  showAllRecentPages = true;
  renderPageLibrary();
});
selectAllPageResultsButton.addEventListener("click", toggleSelectAllPageResults);
clearRecentPagesButton.addEventListener("click", () => void clearRecentPages());
deleteSelectedPagesButton.addEventListener("click", () => void deleteSelectedPages());
pageLibrary.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePageLibrary();
});
errorOpenExternalButton.addEventListener("click", () => {
  void openCurrentUrlInTab().catch(reportNavigationError);
});
errorRetryButton.addEventListener("click", () => {
  void navigate(currentUrl, { addToHistory: false });
});
stageToggleButton.addEventListener("click", () => toggleStagingDrawer());
closeStagingButton.addEventListener("click", closeStagingDrawer);
clearStagingButton.addEventListener("click", () => {
  void clearStaging().catch(reportStageActionError);
});
transferSelectedButton.addEventListener("click", () => void transferSelectedItems());
downloadSelectedButton.addEventListener("click", () => void downloadSelectedItems());
copySelectedButton.addEventListener("click", () => void copySelectedItems());
copyDiagnosticsButton.addEventListener("click", () => void copyRuntimeDiagnostics());
captureActionButtons.forEach((button) => {
  button.addEventListener("click", () => void captureActivePage(button.dataset.captureKind));
});
localFileButton.addEventListener("click", () => localFileInput.click());
localFileInput.addEventListener("change", () => {
  const [file] = localFileInput.files || [];
  localFileInput.value = "";
  if (file) void stageLocalFile(file);
});
savedPromptsButton.addEventListener("click", () => void openPromptPicker());
document.querySelector("#close-prompt-picker").addEventListener("click", closePromptPicker);
document.querySelector("#manage-prompts").addEventListener("click", () => {
  closePromptPicker();
  void chrome.runtime.openOptionsPage();
});
promptPicker.addEventListener("cancel", (event) => {
  event.preventDefault();
  closePromptPicker();
});
promptPickerSearch.addEventListener("input", renderPromptPickerList);
addSavedPromptButton.addEventListener("click", () => void stageSelectedPrompt());

window.addEventListener("pagehide", () => {
  sidepanelClosing = true;
  clearBridgeHealthTimer();
  frameLeasePort?.disconnect();
  void chrome.runtime.sendMessage({
    type: "ATLAS_CLEAR_FRAME_HOST",
    leaseId: frameLeaseId
  });
});

browserFrame.addEventListener("load", () => {
  status.textContent = isChatGptUrl(currentUrl) && !bridgeReady
    ? localCopy("ChatGPT 页面已加载，正在等待输入框…", "ChatGPT loaded; waiting for the composer…")
    : localCopy(`已打开 ${new URL(currentUrl).hostname}`, `Opened ${new URL(currentUrl).hostname}`);
  renderStaging();
  void recordLoadedPage();
});

browserFrame.addEventListener("error", () => {
  showError(localCopy(
    "浏览器没有完成这个 iframe 请求。你可以重试，或改在普通标签页打开。",
    "The browser did not complete this iframe request. Retry or open it in a regular tab."
  ));
});

window.addEventListener("message", handleWindowMessage);
window.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || stagingDrawer.hidden) return;
  event.preventDefault();
  closeStagingDrawer();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local" && changes[STAGING_KEY]) {
    stagedItems = Array.isArray(changes[STAGING_KEY].newValue)
      ? changes[STAGING_KEY].newValue
      : [];
    renderStaging();
  }
  if (areaName === "local" && changes[globalThis.AtlasSettings.STORAGE_KEY]) {
    const previousTranscriptLanguage = currentSettings.transcriptLanguage;
    currentSettings = globalThis.AtlasSettings.normalize(
      changes[globalThis.AtlasSettings.STORAGE_KEY].newValue
    );
    applySettings();
    if (previousTranscriptLanguage !== currentSettings.transcriptLanguage) {
      transcriptLanguage.value = "";
    }
    void refreshTranscriptOptions();
  }
  if (areaName === "local" && changes[globalThis.AtlasPrompts.STORAGE_KEY]) {
    promptLibrary = globalThis.AtlasPrompts.normalizeLibrary(
      changes[globalThis.AtlasPrompts.STORAGE_KEY].newValue
    );
    if (promptPicker.open) renderPromptPickerList();
  }
  if (areaName === "local" && changes[globalThis.AtlasPageSessions.STORAGE_KEY]) {
    pageState = globalThis.AtlasPageSessions.normalizeState(
      changes[globalThis.AtlasPageSessions.STORAGE_KEY].newValue,
      { homeUrl: HOME_URL }
    );
    renderPageLibrary();
    updateNavigationButtons();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "ATLAS_STAGE_CHANGED") {
    void Promise.all([loadActivePageContext(), loadStagedItems()]).then(
      openStagingDrawer
    );
  }
  if (message?.type === "ATLAS_ACTIVE_CONTEXT_CHANGED") {
    void loadActivePageContext();
  }
});

void initializeSidepanel().catch(reportNavigationError);

async function initializeSidepanel() {
  connectFrameLease();
  [currentSettings, promptLibrary] = await Promise.all([
    globalThis.AtlasSettings.load(),
    globalThis.AtlasPrompts.load()
  ]);
  applySettings();
  await Promise.all([restorePageState(), loadActivePageContext()]);
  await loadStagedItems();
}

function applySettings() {
  const language = currentSettings.uiLanguage;
  const t = (key) => globalThis.AtlasSettings.t(language, key);
  document.documentElement.lang = language;
  document.documentElement.dataset.toolbarMode = currentSettings.toolbarMode;
  document.documentElement.dataset.toolbarTheme = currentSettings.toolbarTheme;
  document.querySelector(".browser-toolbar").setAttribute("aria-label", t("toolbar"));
  document.querySelector(".navigation-controls").setAttribute("aria-label", t("navigation"));
  setButtonCopy(backButton, t("back"), t("backTitle"));
  setButtonCopy(forwardButton, t("forward"), t("forwardTitle"));
  setButtonCopy(reloadButton, t("reload"), t("reloadTitle"));
  document.querySelector('label[for="address"]').textContent = t("address");
  addressInput.placeholder = t("addressPlaceholder");
  setButtonCopy(document.querySelector(".go-button"), t("openUrl"), t("openUrl"));
  setButtonCopy(openExternalButton, t("openExternal"), t("openExternal"));
  setButtonCopy(pageLibraryToggleButton, t("pages"), t("pages"));
  setButtonCopy(openSettingsButton, t("settings"), t("settings"));
  document.querySelector("#page-library-title").textContent = t("pages");
  setButtonCopy(closePageLibraryButton, t("closePages"), t("closePages"));
  document.querySelector("#current-page-heading").textContent = t("currentPage");
  document.querySelector('label[for="current-page-name"]').textContent = t("customPageName");
  currentPageName.placeholder = t("customPageName");
  setButtonLabel(saveCurrentPageNameButton, t("savePageName"));
  setButtonCopy(saveCurrentPageNameButton, t("savePageName"), t("savePageName"));
  setButtonCopy(editCurrentPageNameButton, t("customPageName"), t("customPageName"));
  setButtonCopy(cancelCurrentPageNameButton, t("cancelEdit"), t("cancelEdit"));
  document.querySelector('label[for="page-library-search"]').textContent = t("searchPages");
  pageLibrarySearch.placeholder = t("searchPagesPlaceholder");
  document.querySelector(".page-library-tabs").setAttribute("aria-label", t("pageScope"));
  savedPagesTab.querySelector(".page-library-tab-label").textContent = t("savedPages");
  recentPagesTab.querySelector(".page-library-tab-label").textContent = t("recentPages");
  viewAllRecentPagesButton.textContent = t("showAll");
  clearRecentPagesButton.textContent = t("clearRecent");
  setButtonLabel(deleteSelectedPagesButton, t("deleteSelected"));
  setButtonCopy(deleteSelectedPagesButton, t("deleteSelected"), t("deleteSelected"));
  document.querySelector("#staging-title").textContent = t("materials");
  clearStagingButton.textContent = t("clear");
  setButtonCopy(closeStagingButton, t("closeMaterials"), t("closeMaterials"));
  const captureActions = document.querySelector(".capture-actions");
  captureActions.setAttribute("aria-label", t("captureGroup"));
  const featureLabels = {
    link: t("link"), screenshot: t("screenshot"), document: t("document"),
    "local-file": t("localFile"), prompt: t("prompt"), transcript: t("transcript")
  };
  for (const feature of captureActions.querySelectorAll("[data-feature]")) {
    const id = feature.dataset.feature;
    const button = feature.querySelector("button");
    if (button) button.textContent = featureLabels[id];
  }
  document.querySelector('label[for="document-source"]').textContent = t("documentSource");
  document.querySelector('label[for="transcript-language"]').textContent = t("transcriptLanguage");
  stagingEmpty.textContent = t("emptyHint");
  stagingList.setAttribute("aria-label", t("materialList"));
  copyDiagnosticsButton.textContent = t("copyDiagnostics");
  setButtonLabel(copySelectedButton, t("copySelected"));
  setButtonCopy(copySelectedButton, t("copySelected"), t("copySelected"));
  setButtonLabel(downloadSelectedButton, localCopy("下载已选", "Download selected"));
  setButtonLabel(transferSelectedButton, t("addToChatGPT"));
  document.querySelector(".viewport").setAttribute("aria-label", t("webContent"));
  errorTitle.textContent = t("pageUnavailable");
  errorRetryButton.textContent = t("retry");
  errorOpenExternalButton.textContent = t("openInTab");
  status.textContent = t("ready");
  savedPromptsButton.textContent = t("prompt");
  document.querySelector("#prompt-picker-title").textContent = localCopy("常用提示词", "Saved prompts");
  document.querySelector("#prompt-picker-description").textContent = localCopy(
    "选择提示词；变量可先填，也可留到 ChatGPT 输入框中填写。",
    "Choose a prompt. Fill variables now or leave them for the ChatGPT composer."
  );
  document.querySelector('label[for="prompt-picker-search"]').textContent = localCopy("搜索提示词", "Search prompts");
  promptPickerSearch.placeholder = localCopy("搜索名称、正文或标签", "Search names, text, or tags");
  promptPickerList.setAttribute("aria-label", localCopy("选择提示词", "Choose a prompt"));
  promptPickerEmpty.textContent = localCopy("还没有保存提示词。", "No saved prompts yet.");
  document.querySelector("#close-prompt-picker").setAttribute(
    "aria-label",
    localCopy("关闭提示词", "Close prompts")
  );
  document.querySelector("#manage-prompts").textContent = localCopy("管理提示词", "Manage prompts");
  addSavedPromptButton.textContent = localCopy("加入临时素材", "Add to materials");
  promptVariableHelp.textContent = localCopy(
    "变量可选；留空会保留占位符，可在 ChatGPT 输入框中填写。",
    "Variables are optional. Blank values stay as placeholders for the ChatGPT composer."
  );
  for (const id of currentSettings.captureOrder) {
    const feature = captureActions.querySelector(`[data-feature="${id}"]`);
    if (feature) captureActions.append(feature);
  }
  renderPageLibrary();
  renderStaging();
}

async function openPromptPicker() {
  promptLibrary = await globalThis.AtlasPrompts.load();
  selectedSavedPrompt = null;
  promptPickerSearch.value = "";
  promptPickerMessage.textContent = "";
  promptVariablePanel.hidden = true;
  addSavedPromptButton.disabled = true;
  renderPromptPickerList();
  promptPicker.showModal();
  requestAnimationFrame(() => promptPickerSearch.focus());
}

function closePromptPicker() {
  if (promptPicker.open) promptPicker.close();
}

function renderPromptPickerList() {
  const query = promptPickerSearch.value.trim().toLocaleLowerCase();
  const visible = promptLibrary.prompts.filter((prompt) => {
    const haystack = `${prompt.name}\n${prompt.text}\n${prompt.tags.join(" ")}`.toLocaleLowerCase();
    return !query || haystack.includes(query);
  });
  promptPickerList.replaceChildren(...visible.map(createPromptPickerOption));
  promptPickerList.hidden = visible.length === 0;
  promptPickerEmpty.hidden = visible.length > 0;
  if (
    selectedSavedPrompt &&
    !promptLibrary.prompts.some((prompt) => prompt.id === selectedSavedPrompt.id)
  ) {
    selectedSavedPrompt = null;
    promptVariablePanel.hidden = true;
    addSavedPromptButton.disabled = true;
  }
}

function createPromptPickerOption(prompt) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "prompt-picker-option";
  button.setAttribute("role", "option");
  button.setAttribute("aria-selected", String(selectedSavedPrompt?.id === prompt.id));
  const name = document.createElement("strong");
  name.textContent = prompt.name;
  const preview = document.createElement("span");
  const variables = globalThis.AtlasPrompts.extractVariables(prompt.text);
  preview.textContent = variables.length
    ? localCopy(`${variables.length} 个可选变量 · ${prompt.text}`, `${variables.length} optional variables · ${prompt.text}`)
    : prompt.text;
  button.append(name, preview);
  button.addEventListener("click", () => selectSavedPrompt(prompt));
  return button;
}

function selectSavedPrompt(prompt) {
  selectedSavedPrompt = prompt;
  promptPickerMessage.textContent = "";
  selectedPromptName.textContent = prompt.name;
  selectedPromptPreview.textContent = prompt.text;
  const variables = globalThis.AtlasPrompts.extractVariables(prompt.text);
  promptVariableFields.replaceChildren(...variables.map(createPromptVariableField));
  promptVariableFields.hidden = variables.length === 0;
  promptVariableHelp.hidden = variables.length === 0;
  promptVariablePanel.hidden = false;
  addSavedPromptButton.disabled = false;
  renderPromptPickerList();
  requestAnimationFrame(() => {
    const first = promptVariableFields.querySelector("input");
    (first || addSavedPromptButton).focus();
  });
}

function createPromptVariableField(variable) {
  const label = document.createElement("label");
  label.className = "prompt-variable-field";
  const caption = document.createElement("span");
  caption.textContent = variable;
  const input = document.createElement("input");
  input.type = "text";
  input.dataset.variable = variable;
  input.maxLength = 2_000;
  input.autocomplete = "off";
  input.placeholder = localCopy("可选；留空保留占位符", "Optional; leave blank to keep the placeholder");
  label.append(caption, input);
  return label;
}

async function stageSelectedPrompt() {
  if (!selectedSavedPrompt) return;
  promptPickerMessage.textContent = "";
  const values = Object.fromEntries(
    Array.from(promptVariableFields.querySelectorAll("input"), (input) => [
      input.dataset.variable,
      input.value
    ])
  );
  try {
    const rendered = globalThis.AtlasPrompts.render(selectedSavedPrompt, values);
    addSavedPromptButton.disabled = true;
    const beforeIds = stagedItems.map((item) => item.id);
    await globalThis.AtlasPrompts.stageWithReadback(
      {
        promptId: selectedSavedPrompt.id,
        name: selectedSavedPrompt.name,
        text: rendered.text,
        variables: rendered.variables
      },
      {
        beforeIds,
        sendMessage: (message) => chrome.runtime.sendMessage(message),
        readItems: async () => {
          const stored = await chrome.storage.local.get(STAGING_KEY);
          return Array.isArray(stored[STAGING_KEY]) ? stored[STAGING_KEY] : [];
        }
      }
    );
    await loadStagedItems();
    closePromptPicker();
    openStagingDrawer();
    setStagingMessage(
      localCopy(`提示词“${selectedSavedPrompt.name}”已加入临时素材。`, `Prompt “${selectedSavedPrompt.name}” added to materials.`),
      "success"
    );
  } catch (error) {
    promptPickerMessage.textContent = globalThis.AtlasPrompts.formatError(
      error,
      currentSettings.uiLanguage
    );
    addSavedPromptButton.disabled = false;
  }
}

function setButtonCopy(button, label, title) {
  button.setAttribute("aria-label", label);
  button.title = title;
}

function createUiIcon(name) {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.classList.add("ui-icon");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const use = document.createElementNS(SVG_NAMESPACE, "use");
  use.setAttribute("href", `#icon-${name}`);
  svg.append(use);
  return svg;
}

function setButtonLabel(button, label) {
  const labelNode = button.querySelector(".button-label");
  if (labelNode) labelNode.textContent = label;
  else button.textContent = label;
}

function localCopy(zh, en) {
  return currentSettings.uiLanguage === "zh-CN" ? zh : en;
}

function connectFrameLease() {
  if (sidepanelClosing) return;
  const port = chrome.runtime.connect({ name: SIDEPANEL_LIFETIME_PORT });
  frameLeasePort = port;
  port.onDisconnect.addListener(() => {
    if (frameLeasePort !== port) return;
    frameLeasePort = null;
    if (!sidepanelClosing) setTimeout(connectFrameLease, 250);
  });
  syncFrameLease();
}

function syncFrameLease() {
  if (!frameLeasePort || !currentUrl) return;
  try {
    frameLeasePort.postMessage({
      type: "ATLAS_FRAME_LEASE_SYNC",
      leaseId: frameLeaseId,
      hostname: new URL(currentUrl).hostname
    });
  } catch {
    // onDisconnect reconnects and restores the current host rule.
  }
}

async function restorePageState() {
  pageState = await globalThis.AtlasPageSessions.load(chrome.storage.local, {
    legacyKey: LAST_URL_KEY,
    homeUrl: HOME_URL
  });
  const restored = globalThis.AtlasPageSessions.currentPage(pageState);
  currentUrl = restored.url;
  addressInput.value = currentUrl;
  renderPageLibrary();
  updateNavigationButtons();
  await navigate(currentUrl, { addToHistory: false });
}

async function moveThroughPageHistory(delta) {
  const nextIndex = pageState.historyIndex + delta;
  if (nextIndex < 0 || nextIndex >= pageState.history.length) return;
  const previousState = pageState;
  pageState = globalThis.AtlasPageSessions.activateHistory(pageState, nextIndex);
  try {
    const opened = await navigate(globalThis.AtlasPageSessions.currentPage(pageState).url, {
      addToHistory: false
    });
    if (!opened) {
      pageState = previousState;
      await persistPageState();
      updateNavigationButtons();
    }
  } catch (error) {
    pageState = previousState;
    await persistPageState().catch(() => {});
    updateNavigationButtons();
    reportNavigationError(error);
  }
}

async function navigate(rawUrl, options) {
  hideError();
  clearBridgeHealthTimer();

  let url;
  try {
    url = globalThis.AtlasUrl.normalize(rawUrl);
  } catch (error) {
    showError(globalThis.AtlasUrl.formatError(error, currentSettings.uiLanguage));
    return false;
  }

  status.textContent = localCopy(`正在打开 ${url.hostname}…`, `Opening ${url.hostname}…`);

  try {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_SET_FRAME_HOST",
      hostname: url.hostname,
      leaseId: frameLeaseId
    });

    if (!result?.ok) {
      throw new Error(result?.error || localCopy(
        "无法更新当前站点的 frame 规则。",
        "Could not update the frame rule for this site."
      ));
    }

    currentUrl = url.href;
    addressInput.value = currentUrl;

    if (options.addToHistory) {
      pageState = globalThis.AtlasPageSessions.recordNavigation(pageState, {
        url: currentUrl,
        title: options.pageTitle || "",
        customTitle: options.customTitle
      });
    }

    updateNavigationButtons();
    await persistPageState();

    bridgeConnected = false;
    bridgeReady = false;
    activeFrameDocumentId = "";
    navigationVersion += 1;
    browserFrame.src = currentUrl;
    syncFrameLease();
    scheduleBridgeHealthCheck(currentUrl, navigationVersion);
    return true;
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    return false;
  }
}

function updateNavigationButtons() {
  backButton.disabled = pageState.historyIndex <= 0;
  forwardButton.disabled = pageState.historyIndex >= pageState.history.length - 1;
}

async function persistPageState() {
  pageState = globalThis.AtlasPageSessions.normalizeState(pageState, {
    homeUrl: HOME_URL
  });
  await chrome.storage.local.set({
    [globalThis.AtlasPageSessions.STORAGE_KEY]: pageState,
    [LAST_URL_KEY]: globalThis.AtlasPageSessions.currentPage(pageState).url
  });
  renderPageLibrary();
}

async function recordLoadedPage() {
  const current = globalThis.AtlasPageSessions.currentPage(pageState);
  pageState = globalThis.AtlasPageSessions.recordRecent(pageState, current);
  await persistPageState();
}

function openPageLibrary() {
  if (!stagingDrawer.hidden) closeStagingDrawer();
  if (promptPicker.open) closePromptPicker();
  pageLibraryMessage.textContent = "";
  pageLibrarySearch.value = "";
  showAllRecentPages = false;
  clearPageLibrarySelection();
  editingSavedPageId = "";
  editingCurrentPageName = false;
  renderPageLibrary();
  pageLibrary.showModal();
  pageLibraryToggleButton.setAttribute("aria-expanded", "true");
  requestAnimationFrame(() => pageLibrarySearch.focus());
}

function closePageLibrary() {
  if (pageLibrary.open) pageLibrary.close();
  pageLibraryToggleButton.setAttribute("aria-expanded", "false");
}

async function saveCurrentPage() {
  pageState = globalThis.AtlasPageSessions.saveCurrent(pageState);
  await persistPageState();
  pageLibraryMessage.textContent = localCopy("当前页面已保存。", "Current page saved.");
}

async function saveCurrentPageName() {
  pageState = globalThis.AtlasPageSessions.renameCurrent(
    pageState,
    currentPageName.value
  );
  editingCurrentPageName = false;
  await persistPageState();
  currentPageName.value = globalThis.AtlasPageSessions.currentPage(pageState).customTitle;
  pageLibraryMessage.textContent = currentPageName.value.trim()
    ? localCopy("页面名称已保存。", "Page name saved.")
    : localCopy("已恢复网页自动标题。", "The automatic page title is in use again.");
  editCurrentPageNameButton.focus();
}

function startCurrentPageNameEdit() {
  editingCurrentPageName = true;
  renderPageLibrary();
  requestAnimationFrame(() => {
    currentPageName.focus();
    currentPageName.select();
  });
}

function cancelCurrentPageNameEdit() {
  editingCurrentPageName = false;
  currentPageName.value = globalThis.AtlasPageSessions.currentPage(pageState).customTitle || "";
  renderPageLibrary();
  editCurrentPageNameButton.focus();
}

async function clearRecentPages() {
  pageState = globalThis.AtlasPageSessions.clearRecent(pageState);
  clearPageLibrarySelection();
  await persistPageState();
  pageLibraryMessage.textContent = localCopy("最近访问已清空。", "Recent visits cleared.");
}

async function removeSavedPage(id) {
  pageState = globalThis.AtlasPageSessions.removeSaved(pageState, id);
  selectedSavedPageIds.delete(id);
  if (editingSavedPageId === id) editingSavedPageId = "";
  await persistPageState();
  pageLibraryMessage.textContent = localCopy("已删除保存页面。", "Saved page deleted.");
}

async function removeRecentPage(url) {
  pageState = globalThis.AtlasPageSessions.removeRecent(pageState, url);
  selectedRecentPageUrls.delete(url);
  await persistPageState();
  pageLibraryMessage.textContent = localCopy("已从最近访问移除。", "Removed from recent visits.");
}

function selectPageLibraryView(view, options = {}) {
  pageLibraryView = view === "recent" ? "recent" : "saved";
  if (pageLibraryView === "recent") showAllRecentPages = false;
  clearPageLibrarySelection();
  editingSavedPageId = "";
  renderPageLibrary();
  if (options.focus !== false) {
    (pageLibraryView === "recent" ? recentPagesTab : savedPagesTab).focus();
  }
}

function handlePageLibrarySearchInput() {
  clearPageLibrarySelection();
  editingSavedPageId = "";
  renderPageLibrary();
}

function handlePageLibraryTabKeydown(event) {
  if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
  event.preventDefault();
  selectPageLibraryView(pageLibraryView === "saved" ? "recent" : "saved");
}

function currentPageSelection() {
  return pageLibraryView === "saved" ? selectedSavedPageIds : selectedRecentPageUrls;
}

function pageSelectionKey(entry, view = pageLibraryView) {
  return view === "saved" ? entry.id : entry.url;
}

function clearPageLibrarySelection() {
  selectedSavedPageIds.clear();
  selectedRecentPageUrls.clear();
  lastPageSelectionIndex = -1;
}

function handlePageEntrySelection(event, entry, index) {
  const selection = currentPageSelection();
  const checked = event.currentTarget.checked;
  if (event.shiftKey && lastPageSelectionIndex >= 0) {
    const rangeKeys = globalThis.AtlasPageSessions.selectionRangeKeys(
      visiblePageEntries,
      lastPageSelectionIndex,
      index,
      pageLibraryView
    );
    for (const key of rangeKeys) {
      if (checked) selection.add(key);
      else selection.delete(key);
    }
  } else {
    const key = pageSelectionKey(entry);
    if (checked) selection.add(key);
    else selection.delete(key);
  }
  lastPageSelectionIndex = index;
  syncPageSelectionControls();
}

function toggleSelectAllPageResults() {
  const selection = currentPageSelection();
  const visibleKeys = visiblePageEntries.map((entry) => pageSelectionKey(entry));
  const allSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selection.has(key));
  for (const key of visibleKeys) {
    if (allSelected) selection.delete(key);
    else selection.add(key);
  }
  lastPageSelectionIndex = -1;
  syncPageSelectionControls();
}

async function deleteSelectedPages() {
  const selection = currentPageSelection();
  const count = selection.size;
  if (!count) return;
  if (pageLibraryView === "saved") {
    pageState = globalThis.AtlasPageSessions.removeSavedMany(pageState, selection);
    if (selection.has(editingSavedPageId)) editingSavedPageId = "";
  } else {
    pageState = globalThis.AtlasPageSessions.removeRecentMany(pageState, selection);
  }
  clearPageLibrarySelection();
  await persistPageState();
  pageLibraryMessage.textContent = formatDeletedPageCount(count);
}

function startSavedPageEdit(id) {
  editingSavedPageId = id;
  renderPageLibrary();
  requestAnimationFrame(() => {
    const input = pageLibraryList.querySelector(`[data-page-edit-id="${CSS.escape(id)}"]`);
    input?.focus();
    input?.select();
  });
}

async function renameSavedPage(id, value) {
  pageState = globalThis.AtlasPageSessions.renameSaved(pageState, id, value);
  editingSavedPageId = "";
  await persistPageState();
  pageLibraryMessage.textContent = value.trim()
    ? localCopy("已保存页面名称已更新。", "Saved page name updated.")
    : localCopy("已恢复网页自动标题。", "The automatic page title is in use again.");
}

function renderPageLibrary() {
  if (!pageLibrary) return;
  const t = (key) => globalThis.AtlasSettings.t(currentSettings.uiLanguage, key);
  const current = globalThis.AtlasPageSessions.currentPage(pageState);
  const isSaved = pageState.savedPages.some((entry) => entry.url === current.url);
  if (document.activeElement !== currentPageName) {
    currentPageName.value = current.customTitle || "";
  }
  currentPageTitle.textContent = current.customTitle || current.title;
  currentPageTitle.title = current.customTitle ? current.title : "";
  currentPageUrl.textContent = globalThis.AtlasPageSessions.formatDisplayUrl(current.url);
  currentPageUrl.title = current.url;
  currentPageNameRow.hidden = !editingCurrentPageName;
  editCurrentPageNameButton.hidden = editingCurrentPageName;
  setButtonLabel(saveCurrentPageButton, t(isSaved ? "updateSaved" : "saveCurrent"));
  savedPagesCount.textContent = String(pageState.savedPages.length);
  recentPagesCount.textContent = String(pageState.recentPages.length);
  savedPagesTab.setAttribute("aria-selected", String(pageLibraryView === "saved"));
  savedPagesTab.tabIndex = pageLibraryView === "saved" ? 0 : -1;
  recentPagesTab.setAttribute("aria-selected", String(pageLibraryView === "recent"));
  recentPagesTab.tabIndex = pageLibraryView === "recent" ? 0 : -1;
  pageLibraryListPanel.setAttribute(
    "aria-labelledby",
    pageLibraryView === "saved" ? "saved-pages-tab" : "recent-pages-tab"
  );
  const query = pageLibrarySearch.value.trim();
  const visible = globalThis.AtlasPageSessions.visiblePageList(
    pageState,
    pageLibraryView,
    { query, showAll: showAllRecentPages, recentLimit: 10 }
  );
  visiblePageEntries = visible.items;
  pageLibraryList.replaceChildren(
    ...visible.items.map((entry, index) =>
      createPageLibraryEntry(entry, pageLibraryView, index)
    )
  );
  pageLibraryList.hidden = visible.items.length === 0;
  pageLibraryEmpty.hidden = visible.items.length > 0;
  pageLibraryEmpty.textContent = query
    ? t("noPageMatches")
    : t(pageLibraryView === "saved" ? "noSavedPages" : "noRecentPages");
  pageLibraryListSummary.textContent = formatVisiblePageSummary(visible, query);
  viewAllRecentPagesButton.hidden = pageLibraryView !== "recent" || !visible.truncated;
  clearRecentPagesButton.hidden = pageLibraryView !== "recent";
  clearRecentPagesButton.disabled = pageState.recentPages.length === 0;
  syncPageSelectionControls();
  pageLibrarySummary.textContent = formatPageLibrarySummary(
    pageState.savedPages.length,
    pageState.recentPages.length
  );
  pageLibraryBadge.textContent = String(pageState.savedPages.length);
  pageLibraryBadge.hidden = pageState.savedPages.length === 0;
}

function createPageLibraryEntry(entry, kind, index) {
  const t = (key) => globalThis.AtlasSettings.t(currentSettings.uiLanguage, key);
  const row = document.createElement("div");
  row.className = "page-library-entry";
  row.setAttribute("role", "listitem");

  const displayTitle = entry.customTitle || entry.title;
  const key = pageSelectionKey(entry, kind);
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "page-entry-select";
  checkbox.dataset.pageSelectionKey = key;
  checkbox.checked = currentPageSelection().has(key);
  checkbox.setAttribute("aria-label", `${t("selectPage")}: ${displayTitle}`);
  checkbox.addEventListener("click", (event) =>
    handlePageEntrySelection(event, entry, index)
  );

  let content;
  const isEditing = kind === "saved" && editingSavedPageId === entry.id;
  if (isEditing) {
    checkbox.disabled = true;
    const form = document.createElement("form");
    form.className = "page-entry-edit-form";
    const input = document.createElement("input");
    input.className = "page-entry-edit-input";
    input.type = "text";
    input.maxLength = 80;
    input.autocomplete = "off";
    input.value = entry.customTitle || entry.title;
    input.placeholder = entry.title;
    input.dataset.pageEditId = entry.id;
    input.setAttribute("aria-label", `${t("editSavedPage")}: ${displayTitle}`);
    const save = document.createElement("button");
    save.type = "submit";
    save.className = "page-entry-edit-action";
    setButtonCopy(save, t("saveEdit"), t("saveEdit"));
    save.append(createUiIcon("check"));
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "page-entry-edit-action";
    setButtonCopy(cancel, t("cancelEdit"), t("cancelEdit"));
    cancel.append(createUiIcon("x"));
    cancel.addEventListener("click", () => {
      editingSavedPageId = "";
      renderPageLibrary();
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      void renameSavedPage(entry.id, input.value);
    });
    form.append(input, save, cancel);
    content = form;
  } else {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "page-entry-open";
    open.setAttribute(
      "aria-label",
      `${t("openSavedPage")}: ${displayTitle}; ${entry.url}`
    );
    const title = document.createElement("strong");
    title.textContent = displayTitle;
    const url = document.createElement("span");
    url.textContent = globalThis.AtlasPageSessions.formatDisplayUrl(entry.url);
    url.title = entry.url;
    open.title = entry.url;
    open.append(title, url);
    open.addEventListener("click", () => {
      closePageLibrary();
      void navigate(entry.url, {
        addToHistory: true,
        pageTitle: entry.title,
        customTitle: entry.customTitle
      });
    });
    content = open;
  }

  const actions = document.createElement("div");
  actions.className = "page-entry-actions";
  actions.hidden = isEditing;
  if (kind === "saved") {
    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "page-entry-edit-action";
    setButtonCopy(edit, `${t("editSavedPage")}: ${displayTitle}`, t("editSavedPage"));
    edit.append(createUiIcon("edit"));
    edit.addEventListener("click", () => startSavedPageEdit(entry.id));
    actions.append(edit);
  }

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "page-entry-remove";
  const removeLabel = t(kind === "saved" ? "removeSavedPage" : "removeRecentPage");
  setButtonCopy(remove, `${removeLabel}: ${displayTitle}`, removeLabel);
  remove.append(createUiIcon("trash"));
  remove.addEventListener("click", () => {
    void (kind === "saved" ? removeSavedPage(entry.id) : removeRecentPage(entry.url));
  });
  actions.append(remove);

  row.append(checkbox, content, actions);
  return row;
}

function formatPageLibrarySummary(savedCount, recentCount) {
  const language = currentSettings.uiLanguage;
  if (language === "zh-CN") return `${savedCount} 个已保存 · ${recentCount} 条最近访问`;
  if (language === "ja") return `保存 ${savedCount} · 最近 ${recentCount}`;
  if (language === "ko") return `저장 ${savedCount} · 최근 ${recentCount}`;
  return `${savedCount} saved · ${recentCount} recent`;
}

function formatVisiblePageSummary(visible, query) {
  const language = currentSettings.uiLanguage;
  const shown = visible.items.length;
  const total = query ? visible.filteredTotal : visible.total;
  if (language === "zh-CN") return query ? `找到 ${total} 条` : `显示 ${shown} / ${total}`;
  if (language === "ja") return query ? `${total} 件見つかりました` : `${shown} / ${total} を表示`;
  if (language === "ko") return query ? `${total}개 찾음` : `${shown} / ${total} 표시`;
  return query ? `${total} found` : `Showing ${shown} of ${total}`;
}

function syncPageSelectionControls() {
  const t = (key) => globalThis.AtlasSettings.t(currentSettings.uiLanguage, key);
  const selection = currentPageSelection();
  const source = pageLibraryView === "saved" ? pageState.savedPages : pageState.recentPages;
  const validKeys = new Set(source.map((entry) => pageSelectionKey(entry)));
  for (const key of Array.from(selection)) {
    if (!validKeys.has(key)) selection.delete(key);
  }
  for (const checkbox of pageLibraryList.querySelectorAll(".page-entry-select")) {
    checkbox.checked = selection.has(checkbox.dataset.pageSelectionKey);
  }
  const visibleKeys = visiblePageEntries.map((entry) => pageSelectionKey(entry));
  const allVisibleSelected = visibleKeys.length > 0 && visibleKeys.every((key) => selection.has(key));
  selectAllPageResultsButton.disabled = visibleKeys.length === 0;
  selectAllPageResultsButton.hidden = visibleKeys.length === 0;
  selectAllPageResultsButton.textContent = t(
    allVisibleSelected ? "deselectCurrentResults" : "selectCurrentResults"
  );
  pageLibrarySelectedCount.textContent = formatSelectedPageCount(selection.size);
  pageLibrarySelectedCount.hidden = selection.size === 0;
  pageLibraryListSummary.hidden = selection.size > 0;
  pageLibraryFooter.dataset.selectionActive = String(selection.size > 0);
  deleteSelectedPagesButton.disabled = selection.size === 0;
  deleteSelectedPagesButton.hidden = selection.size === 0;
}

function formatSelectedPageCount(count) {
  return globalThis.AtlasSettings
    .t(currentSettings.uiLanguage, "selectedPageCount")
    .replace("{count}", String(count));
}

function formatDeletedPageCount(count) {
  return globalThis.AtlasSettings
    .t(currentSettings.uiLanguage, "deletedPageCount")
    .replace("{count}", String(count));
}

function showError(
  message,
  title = localCopy("这个页面暂时无法在侧边栏打开", "This page cannot be opened in the sidebar right now")
) {
  status.textContent = localCopy("打开失败", "Could not open");
  errorTitle.textContent = title;
  errorMessage.textContent = message;
  errorPanel.hidden = false;
}

function hideError() {
  errorPanel.hidden = true;
  errorTitle.textContent = localCopy(
    "这个页面暂时无法在侧边栏打开",
    "This page cannot be opened in the sidebar right now"
  );
  errorMessage.textContent = "";
}

function scheduleBridgeHealthCheck(url, version) {
  if (!isChatGptUrl(url)) return;
  bridgeHealthTimer = setTimeout(() => {
    if (version !== navigationVersion || bridgeReady) return;
    const message = bridgeConnected
      ? localCopy(
          "Atlas 已连接到 ChatGPT 页面，但没有找到可用输入框。请先在普通标签页确认登录，或重试当前页面。",
          "Atlas connected to ChatGPT but could not find a composer. Confirm that you are signed in in a regular tab, or retry."
        )
      : localCopy(
          "ChatGPT 页面没有与 Atlas 建立连接。扩展可能刚更新、页面仍在加载，或当前页面拒绝了嵌入。",
          "ChatGPT did not connect to Atlas. The extension may have just updated, the page may still be loading, or embedding may be blocked."
        );
    showError(message, localCopy("ChatGPT 尚未准备好", "ChatGPT is not ready"));
  }, CHATGPT_BRIDGE_TIMEOUT_MS);
}

function clearBridgeHealthTimer() {
  if (bridgeHealthTimer === null) return;
  clearTimeout(bridgeHealthTimer);
  bridgeHealthTimer = null;
}

async function openCurrentUrlInTab() {
  const result = await chrome.runtime.sendMessage({
    type: "ATLAS_OPEN_EXTERNAL",
    url: currentUrl
  });
  if (!result?.ok) throw new Error(result?.error || localCopy("无法打开标签页。", "Could not open the tab."));
}

async function loadStagedItems() {
  const [persistent, session] = await Promise.all([
    chrome.storage.local.get(STAGING_KEY),
    chrome.storage.session.get(STAGING_OPEN_KEY)
  ]);
  stagedItems = Array.isArray(persistent[STAGING_KEY]) ? persistent[STAGING_KEY] : [];
  void chrome.runtime.sendMessage({ type: "ATLAS_STAGE_PRUNE" }).catch(() => {});
  renderStaging();
  if (session[STAGING_OPEN_KEY]) {
    openStagingDrawer();
    await chrome.storage.session.remove(STAGING_OPEN_KEY);
  }
}

function toggleStagingDrawer() {
  if (stagingDrawer.hidden) openStagingDrawer({ focus: true });
  else closeStagingDrawer({ restoreFocus: false });
}

function openStagingDrawer({ focus = false } = {}) {
  stagingDrawer.hidden = false;
  stageToggleButton.setAttribute("aria-expanded", "true");
  if (focus) {
    requestAnimationFrame(() => {
      if (!stagingDrawer.hidden) stagingDrawer.focus({ preventScroll: true });
    });
  }
}

function closeStagingDrawer({ restoreFocus = true } = {}) {
  if (stagingDrawer.hidden) return;
  stagingDrawer.hidden = true;
  stageToggleButton.setAttribute("aria-expanded", "false");
  if (restoreFocus) {
    requestAnimationFrame(() => stageToggleButton.focus({ preventScroll: true }));
  }
}

function renderStaging() {
  const focusKey = document.activeElement?.dataset?.stageFocus || "";
  clearPreviewUrls();
  const visibleItems = getVisibleStagedItems();
  const selectedCount = visibleItems.filter(
    (item) => item.selected && isTransferableStageItem(item)
  ).length;
  const selectedDownloadCount = visibleItems.filter(
    (item) => item.selected && Boolean(globalThis.AtlasExport.describe(item))
  ).length;
  const failedCount = visibleItems.filter((item) => item.status === "failed").length;
  stageBadge.textContent = String(stagedItems.length);
  stageBadge.hidden = stagedItems.length === 0;
  const materialLabel = localCopy(
    `临时素材，${stagedItems.length} 项`,
    `Temporary materials, ${stagedItems.length} items`
  );
  stageToggleButton.setAttribute("aria-label", materialLabel);
  stageToggleButton.title = materialLabel;
  stagingSummary.textContent = [
    localCopy(`${visibleItems.length} 项`, `${visibleItems.length} items`),
    localCopy(`已选 ${selectedCount}`, `${selectedCount} selected`),
    failedCount ? localCopy(`${failedCount} 失败`, `${failedCount} failed`) : ""
  ]
    .filter(Boolean)
    .join(" · ");
  stagingEmpty.hidden = visibleItems.length !== 0;
  stagingEmpty.textContent = localCopy(
    "还没有草稿素材；你可以跨网页收集后一起使用。",
    "No draft materials yet. Collect across pages and use them together."
  );
  stagingList.hidden = visibleItems.length === 0;
  clearStagingButton.disabled = visibleItems.length === 0;
  clearStagingButton.textContent = localCopy("清空", "Clear");
  clearStagingButton.setAttribute(
    "aria-label",
    localCopy("清空全部草稿素材", "Clear all draft materials")
  );

  const isChatGpt = isChatGptUrl(currentUrl);
  copySelectedButton.disabled = selectedCount === 0;
  const copyLabel = localCopy(`复制 ${selectedCount} 项`, `Copy ${selectedCount}`);
  setButtonLabel(copySelectedButton, copyLabel);
  setButtonCopy(copySelectedButton, copyLabel, copyLabel);
  downloadSelectedButton.disabled = selectedDownloadCount === 0;
  setButtonLabel(downloadSelectedButton, localCopy(
    `下载 ${selectedDownloadCount} 项`,
    `Download ${selectedDownloadCount}`
  ));
  transferSelectedButton.disabled = selectedCount === 0 || !isChatGpt;
  setButtonLabel(transferSelectedButton, isChatGpt
    ? localCopy(`添加 ${selectedCount} 项到 ChatGPT`, `Add ${selectedCount} items to ChatGPT`)
    : localCopy("先打开 ChatGPT", "Open ChatGPT first"));

  stagingList.replaceChildren(...visibleItems.map(createStageCard));
  if (focusKey) {
    requestAnimationFrame(() => {
      if (stagingDrawer.hidden) return;
      const target = Array.from(
        stagingDrawer.querySelectorAll("[data-stage-focus]")
      ).find((element) => element.dataset.stageFocus === focusKey);
      if (target) target.focus({ preventScroll: true });
      else if (!stagingDrawer.hidden) stagingDrawer.focus({ preventScroll: true });
    });
  }
}

function createStageCard(item) {
  const card = document.createElement("article");
  card.className = "stage-card";
  card.setAttribute("role", "listitem");
  if (item.status === "capturing") card.setAttribute("aria-busy", "true");
  const itemName = stageAccessibleName(item);

  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  const transferable = isTransferableStageItem(item);
  checkbox.checked = transferable && Boolean(item.selected);
  checkbox.disabled = !transferable;
  checkbox.title = transferable
    ? ""
    : item.status === "capturing"
      ? localCopy("这份素材正在采集，完成后才能选择。", "This material is still being captured and cannot be selected yet.")
      : localCopy("这份素材采集失败，不能传输；请先重试。", "This material failed to capture and cannot be transferred. Retry first.");
  checkbox.setAttribute(
    "aria-label",
    item.status === "capturing"
      ? localCopy(`${itemName}，完成后才能选择`, `${itemName}; available after capture completes`)
      : localCopy(`选择${itemName}`, `Select ${itemName}`)
  );
  checkbox.dataset.stageFocus = `${item.id}:select`;
  checkbox.addEventListener("change", () => {
    void updateStageItem(item.id, { selected: checkbox.checked }).catch(
      reportStageActionError
    );
  });

  const copy = document.createElement("div");
  copy.className = "stage-copy";

  if (item.kind === "screenshot" && item.blobKey) {
    const image = document.createElement("img");
    image.className = "stage-thumbnail";
    image.alt =
      item.width && item.height
        ? localCopy(`截图预览，${item.width}×${item.height} 像素`, `Screenshot preview, ${item.width}×${item.height} pixels`)
        : localCopy("截图预览", "Screenshot preview");
    copy.append(image);
    void hydrateScreenshotPreview(item, image);
  }

  const kind = document.createElement("div");
  kind.className = "stage-kind";
  kind.textContent = stageKindLabel(item.kind);

  const preview = document.createElement("div");
  preview.className = "stage-preview";
  preview.textContent = stagePreviewText(item);
  preview.tabIndex = 0;
  preview.setAttribute("role", "button");
  preview.setAttribute(
    "aria-label",
    localCopy(`${itemName}，展开或收起预览`, `${itemName}; expand or collapse preview`)
  );
  preview.setAttribute("aria-expanded", "false");
  preview.dataset.stageFocus = `${item.id}:preview`;
  preview.addEventListener("click", () => toggleStagePreview(preview));
  preview.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleStagePreview(preview);
    }
  });
  if (item.status === "failed") preview.classList.add("stage-preview-error");

  const source = document.createElement("div");
  source.className = "stage-source";
  source.textContent = stageSourceText(item);
  if (item.lastTransfer) {
    const added = document.createElement("span");
    added.className = "stage-status";
    added.textContent =
      {
        inserted: localCopy("已写入", "Inserted"),
        attached: localCopy("已加入附件区", "Attached"),
        copied: localCopy("已复制", "Copied"),
        downloaded: localCopy("已下载", "Downloaded"),
        failed: localCopy("失败", "Failed")
      }[item.lastTransfer.outcome] || localCopy("已处理", "Processed");
    source.append(added);
  } else if (item.status === "capturing") {
    const capturing = document.createElement("span");
    capturing.className = "stage-status";
    capturing.textContent = localCopy("处理中", "Processing");
    source.append(capturing);
  }

  copy.append(kind, preview, source);

  const remove = document.createElement("button");
  remove.className = "stage-remove";
  remove.type = "button";
  remove.setAttribute("aria-label", localCopy(`删除${itemName}`, `Delete ${itemName}`));
  remove.dataset.stageFocus = `${item.id}:remove`;
  remove.title = localCopy("删除", "Delete");
  remove.append(createUiIcon("trash"));
  remove.addEventListener("click", () => {
    void removeStageItem(item.id).catch(reportStageActionError);
  });

  const actions = document.createElement("div");
  actions.className = "stage-card-actions";
  if (globalThis.AtlasExport.describe(item)) {
    const download = document.createElement("button");
    download.className = "stage-download";
    download.type = "button";
    download.setAttribute(
      "aria-label",
      localCopy(`下载${itemName}`, `Download ${itemName}`)
    );
    download.dataset.stageFocus = `${item.id}:download`;
    download.title = localCopy("下载这份素材", "Download this material");
    download.append(createUiIcon("download"));
    download.addEventListener("click", () => {
      void downloadOneItem(item, download);
    });
    actions.append(download);
  }
  if (transferable) {
    const transferOne = document.createElement("button");
    transferOne.className = "stage-single-transfer";
    transferOne.type = "button";
    transferOne.setAttribute(
      "aria-label",
      localCopy(`只添加${itemName}到 ChatGPT`, `Add only ${itemName} to ChatGPT`)
    );
    transferOne.dataset.stageFocus = `${item.id}:transfer`;
    transferOne.title = localCopy("只添加这一项", "Add only this item");
    transferOne.append(createUiIcon("message-plus"));
    transferOne.addEventListener("click", () => {
      void transferSelectedItems([item.id]);
    });
    actions.append(transferOne);
  }
  if (
    item.status === "failed" &&
    ["link", "screenshot", "document", "transcript"].includes(item.kind) &&
    getItemGroupKey(item) === activePageContext?.groupKey
  ) {
    const retry = document.createElement("button");
    retry.className = "stage-retry";
    retry.type = "button";
    retry.setAttribute("aria-label", localCopy(`重试采集${itemName}`, `Retry capture for ${itemName}`));
    retry.dataset.stageFocus = `${item.id}:retry`;
    retry.title = localCopy("重试", "Retry");
    retry.append(createUiIcon("refresh"));
    retry.addEventListener("click", () => {
      void retryFailedItem(item).catch(reportStageActionError);
    });
    actions.append(retry);
  }
  if (item.status !== "capturing") actions.append(remove);

  card.append(checkbox, copy, actions);
  return card;
}

function stageAccessibleName(item) {
  const preview = stagePreviewText(item).replace(/\s+/g, " ").trim();
  const suffix = preview ? `“${preview.slice(0, 80)}”` : localCopy("素材", "material");
  return `${stageKindLabel(item.kind)}${suffix}`;
}

function toggleStagePreview(preview) {
  const expanded = preview.classList.toggle("expanded");
  preview.setAttribute("aria-expanded", String(expanded));
}

async function updateStageItem(id, patch) {
  await applyStageMutation({ action: "patch", patches: [{ id, patch }] });
}

async function removeStageItem(id) {
  const item = stagedItems.find((candidate) => candidate.id === id);
  await applyStageMutation({ action: "remove", ids: [id] });
  if (item?.blobKey) {
    try {
      await globalThis.AtlasBlobStore.delete(item.blobKey);
    } catch {
      void chrome.runtime.sendMessage({ type: "ATLAS_STAGE_PRUNE" }).catch(() => {});
      setStagingMessage(localCopy(
        "素材已删除；残留临时文件将在稍后清理。",
        "Material deleted; remaining temporary files will be cleaned up later."
      ), "error");
    }
  }
}

async function clearStaging() {
  const visibleIds = new Set(getVisibleStagedItems().map((item) => item.id));
  const itemsToDelete = stagedItems.filter((item) => visibleIds.has(item.id));
  await applyStageMutation({ action: "remove", ids: Array.from(visibleIds) });
  const deletions = await Promise.allSettled(
    itemsToDelete
      .filter((item) => item.blobKey)
      .map((item) => globalThis.AtlasBlobStore.delete(item.blobKey))
  );
  const cleanupFailed = deletions.some((result) => result.status === "rejected");
  if (cleanupFailed) {
    void chrome.runtime.sendMessage({ type: "ATLAS_STAGE_PRUNE" }).catch(() => {});
  }
  setStagingMessage(
    cleanupFailed
      ? localCopy("素材已清空；残留临时文件将在稍后清理。", "Materials cleared; remaining temporary files will be cleaned up later.")
      : localCopy("临时素材已清空。", "Temporary materials cleared."),
    cleanupFailed ? "error" : "success"
  );
}

async function applyStageMutation(mutation) {
  const result = await chrome.runtime.sendMessage({
    type: "ATLAS_STAGE_MUTATE",
    mutation
  });
  if (!result?.ok) {
    throw new Error(result?.error || localCopy("无法保存临时素材修改。", "Could not save the material change."));
  }
  stagedItems = Array.isArray(result.items) ? result.items : [];
  renderStaging();
}

async function stageLocalFile(file) {
  setStagingMessage(localCopy("正在添加本地文件…", "Adding local file…"), "");
  localFileButton.disabled = true;
  let blobKey = "";
  try {
    if (!file.size) throw new Error(localCopy("这个文件是空的，无法加入临时区。", "This file is empty and cannot be added."));
    if (file.size > MAX_BLOB_SIZE) {
      throw new Error(localCopy("素材超过 50 MB，暂时无法加入临时区。", "Materials over 50 MB cannot be added."));
    }
    blobKey = crypto.randomUUID();
    await globalThis.AtlasBlobStore.put({
      key: blobKey,
      blob: file,
      fileName: file.name
    });
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_STAGE_LOCAL_FILE",
      file: {
        blobKey,
        fileName: file.name,
        mime: file.type || "application/octet-stream",
        size: file.size
      }
    });
    if (!result?.ok) throw new Error(result?.error || localCopy("无法加入本地文件。", "Could not add the local file."));
    await loadStagedItems();
    openStagingDrawer();
    setStagingMessage(localCopy(`${file.name} 已加入临时素材。`, `${file.name} added to temporary materials.`), "success");
  } catch (error) {
    if (blobKey) await globalThis.AtlasBlobStore.delete(blobKey).catch(() => {});
    setStagingMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    localFileButton.disabled = false;
  }
}

async function transferSelectedItems(onlyIds = null) {
  setStagingMessage("", "");

  if (!isChatGptUrl(currentUrl)) {
    setStagingMessage(localCopy("请先在侧边栏打开 ChatGPT。", "Open ChatGPT in the sidebar first."), "error");
    return;
  }

  const requestedIds = Array.isArray(onlyIds) ? new Set(onlyIds) : null;
  const selectedItems = getVisibleStagedItems().filter(
    (item) =>
      isTransferableStageItem(item) &&
      (requestedIds ? requestedIds.has(item.id) : item.selected)
  );
  let bundle;
  try {
    bundle = globalThis.AtlasTransfer.buildBundle(selectedItems, {
      forceSelectedIds: requestedIds ? Array.from(requestedIds) : [],
      language: currentSettings.uiLanguage
    });
  } catch (error) {
    setStagingMessage(
      globalThis.AtlasTransfer.formatError(error, currentSettings.uiLanguage),
      "error"
    );
    return;
  }
  if (!bundle.composerText && bundle.attachments.length === 0) {
    setStagingMessage(localCopy("请至少选择一份可传输素材。", "Select at least one transferable material."), "error");
    return;
  }

  transferSelectedButton.disabled = true;
  setButtonLabel(transferSelectedButton, bridgeReady
    ? localCopy("正在添加…", "Adding…")
    : localCopy("正在连接 ChatGPT…", "Connecting to ChatGPT…"));

  let result;
  try {
    const attachments = await Promise.all(
      bundle.attachments.map(async (attachment) => {
        const record = await globalThis.AtlasBlobStore.get(attachment.blobKey);
        if (!record?.blob) throw new Error(localCopy(`找不到附件：${attachment.fileName}`, `Attachment not found: ${attachment.fileName}`));
        return {
          ...attachment,
          mime: record.mime || attachment.mime,
          bytes: await record.blob.arrayBuffer()
        };
      })
    );

    result = await requestChatGptTransfer({
      text: bundle.composerText,
      attachments
    });
    if (result?.autoSent !== false) {
      throw new Error(result?.error || localCopy("ChatGPT 没有返回安全的传输结果。", "ChatGPT did not return a safe transfer result."));
    }

  } catch (error) {
    await applyTransferFallback(
      selectedItems,
      bundle,
      error instanceof Error ? error.message : String(error)
    );
    renderStaging();
    return;
  }

  const attachmentResults = new Map(
    (result.attachments || []).map((item) => [item.stagingId, item])
  );
  const outcomes = new Map();

  for (const item of selectedItems) {
    if (item.blobKey) {
      const attachmentResult = attachmentResults.get(item.id);
      if (attachmentResult?.ok) {
        outcomes.set(item.id, {
          outcome: "attached",
          method: attachmentResult.method
        });
      } else {
        outcomes.set(item.id, await downloadAttachmentFallback(item));
      }
    } else if (result.text?.ok) {
      outcomes.set(item.id, { outcome: "inserted", method: result.text.method });
    } else {
      outcomes.set(item.id, {
        outcome: "failed",
        error: result.text?.error || localCopy("ChatGPT 没有确认文字写入。", "ChatGPT did not confirm the text insertion.")
      });
    }
  }

  let persistenceError = "";
  try {
    await persistTransferOutcomes(outcomes);
  } catch (error) {
    persistenceError = error instanceof Error ? error.message : String(error);
  }

  const outcomeValues = Array.from(outcomes.values());
  const attached = outcomeValues.filter((item) => item.outcome === "attached").length;
  const inserted = outcomeValues.filter((item) => item.outcome === "inserted").length;
  const downloaded = outcomeValues.filter((item) => item.outcome === "downloaded").length;
  const failed = outcomeValues.filter((item) => item.outcome === "failed").length;
  const parts = [];
  if (inserted) parts.push(localCopy(`写入 ${inserted} 项`, `Inserted ${inserted}`));
  if (attached) parts.push(localCopy(`加入附件区 ${attached} 项`, `Attached ${attached}`));
  if (downloaded) parts.push(localCopy(`下载 ${downloaded} 项待手动附加`, `Downloaded ${downloaded} for manual attachment`));
  if (failed) parts.push(localCopy(`失败 ${failed} 项`, `${failed} failed`));
  if (persistenceError) parts.push(localCopy(`状态保存失败：${persistenceError}`, `Could not save status: ${persistenceError}`));
  setStagingMessage(
    localCopy(`${parts.join("，")}；消息没有发送。`, `${parts.join(", ")}. Message not sent.`),
    failed || persistenceError ? "error" : "success"
  );
  renderStaging();
}

function requestChatGptTransfer(payload) {
  const requestId = crypto.randomUUID();

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      bridgeRequests.delete(requestId);
      reject(new Error(localCopy("没有收到 ChatGPT 传输响应，请刷新后重试。", "No transfer response from ChatGPT. Refresh and retry.")));
    }, 20_000);

    bridgeRequests.set(requestId, { resolve, reject, timeoutId });
    const transferables = (payload.attachments || []).map((item) => item.bytes);
    browserFrame.contentWindow.postMessage(
      {
        source: "atlas-sidebar",
        type: "ATLAS_TRANSFER_PREPARE",
        requestId,
        payload
      },
      "https://chatgpt.com",
      transferables
    );
  });
}

function handleWindowMessage(event) {
  if (
    event.source === browserFrame.contentWindow &&
    event.data?.source === "atlas-frame-navigation" &&
    event.data?.type === "ATLAS_FRAME_NAVIGATION"
  ) {
    handleFrameNavigationMessage(event);
    return;
  }
  if (
    event.source === browserFrame.contentWindow &&
    event.data?.source === "atlas-sidebar-selection" &&
    event.data?.type === "ATLAS_SIDEBAR_SELECTION_REQUEST"
  ) {
    void handleSidebarSelectionMessage(event);
    return;
  }
  handleBridgeMessage(event);
}

async function handleSidebarSelectionMessage(event) {
  const selection = globalThis.AtlasPageSessions.validateFrameSelection(event.data, {
    activeDocumentId: activeFrameDocumentId,
    currentUrl,
    eventOrigin: event.origin
  });
  if (!selection) return;
  let response;
  try {
    response = await chrome.runtime.sendMessage({
      type: "ATLAS_STAGE_SIDEBAR_SELECTION",
      selection: {
        text: selection.selectionText,
        url: selection.url,
        title: selection.title,
        documentId: selection.documentId
      }
    });
    if (response?.ok) {
      await loadStagedItems();
      renderStaging();
    }
  } catch (error) {
    response = {
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
  browserFrame.contentWindow?.postMessage({
    source: "atlas-sidebar",
    type: "ATLAS_SIDEBAR_SELECTION_RESULT",
    requestId: selection.requestId,
    ok: Boolean(response?.ok),
    error: String(response?.error || "")
  }, event.origin);
}

function handleFrameNavigationMessage(event) {
  const navigation = globalThis.AtlasPageSessions.validateFrameNavigation(event.data, {
    activeDocumentId: activeFrameDocumentId,
    eventOrigin: event.origin
  });
  if (!navigation) return;
  if (navigation.activateDocument) activeFrameDocumentId = navigation.documentId;
  void syncFrameNavigation(new URL(navigation.url), navigation.title).catch(
    reportNavigationError
  );
}

async function syncFrameNavigation(url, title) {
  const previousUrl = new URL(currentUrl);
  if (previousUrl.hostname !== url.hostname) {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_SET_FRAME_HOST",
      hostname: url.hostname,
      leaseId: frameLeaseId
    });
    if (!result?.ok) {
      throw new Error(result?.error || localCopy(
        "页面已经跳转，但无法为新站点更新 frame 规则。",
        "The page navigated, but Atlas could not update the frame rule for the new site."
      ));
    }
  }

  currentUrl = url.href;
  if (document.activeElement !== addressInput) addressInput.value = currentUrl;
  pageState = globalThis.AtlasPageSessions.recordNavigation(pageState, {
    url: currentUrl,
    title
  });
  pageState = globalThis.AtlasPageSessions.recordRecent(
    pageState,
    globalThis.AtlasPageSessions.currentPage(pageState)
  );
  updateNavigationButtons();
  await persistPageState();
  syncFrameLease();
  status.textContent = localCopy(`已打开 ${url.hostname}`, `Opened ${url.hostname}`);
}

function handleBridgeMessage(event) {
  if (
    !isChatGptUrl(currentUrl) ||
    event.source !== browserFrame.contentWindow ||
    event.origin !== "https://chatgpt.com" ||
    event.data?.source !== BRIDGE_RESPONSE_SOURCE
  ) {
    return;
  }

  if (event.data.type === "ATLAS_BRIDGE_READY") {
    bridgeConnected = true;
    bridgeReady = event.data.composerReady === true;
    status.textContent = bridgeReady
      ? localCopy("ChatGPT 输入框已就绪", "ChatGPT composer is ready")
      : localCopy("已连接 ChatGPT，正在等待输入框…", "Connected to ChatGPT; waiting for the composer…");
    if (bridgeReady) {
      clearBridgeHealthTimer();
      hideError();
    }
    renderStaging();
    return;
  }

  if (event.data.type !== "ATLAS_COMPOSER_RESULT") return;
  const pending = bridgeRequests.get(event.data.requestId);
  if (!pending) return;

  clearTimeout(pending.timeoutId);
  bridgeRequests.delete(event.data.requestId);
  pending.resolve(event.data.result);
}

function setStagingMessage(message, kind) {
  const isError = kind === "error";
  stagingMessage.setAttribute("role", isError ? "alert" : "status");
  stagingMessage.setAttribute("aria-live", isError ? "assertive" : "polite");
  stagingMessage.textContent = message;
  stagingMessage.dataset.kind = kind;
}

async function copyRuntimeDiagnostics() {
  copyDiagnosticsButton.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({
      type: "ATLAS_DIAGNOSTICS_GET"
    });
    if (!response?.ok) throw new Error(response?.error || localCopy("无法读取运行诊断。", "Could not read runtime diagnostics."));
    const diagnostics = response.diagnostics || {};
    const kinds = new Map();
    for (const item of stagedItems) {
      kinds.set(item.kind, (kinds.get(item.kind) || 0) + 1);
    }
    const sourceHost = safeHostname(activePageContext?.url);
    const readyCount = stagedItems.filter((item) => item.status === "ready").length;
    const failedCount = stagedItems.filter((item) => item.status === "failed").length;
    const frameRuleState = diagnostics.frameRuleInstalled
      ? diagnostics.frameRuleHost || "installed"
      : "none";
    const kindSummary =
      Array.from(kinds, ([kind, count]) => `${kind}=${count}`).join(",") || "none";
    const text = [
      "Atlas Sidebar diagnostics",
      `version: ${diagnostics.version || "unknown"}`,
      `sidebarHost: ${safeHostname(currentUrl) || "unknown"}`,
      `sourceHost: ${sourceHost || "unknown"}`,
      `bridgeConnected: ${bridgeConnected}`,
      `composerReady: ${bridgeReady}`,
      `frameRule: ${frameRuleState}`,
      `fileUrlAccess: ${diagnostics.fileSchemeAllowed ? "allowed" : "not-allowed"}`,
      `staged: total=${stagedItems.length}, ready=${readyCount}, failed=${failedCount}`,
      `kinds: ${kindSummary}`,
      "privacy: no material content, full URL, Cookie, Token, or account credential included"
    ].join("\n");
    await navigator.clipboard.writeText(text);
    setStagingMessage(localCopy(
      "诊断已复制；不含素材内容、完整网址、Cookie、Token 或账号凭证。",
      "Diagnostics copied without material content, full URLs, cookies, tokens, or account credentials."
    ), "success");
  } catch (error) {
    setStagingMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    copyDiagnosticsButton.disabled = false;
  }
}

function safeHostname(value) {
  try {
    const url = new URL(value || "");
    return url.protocol === "file:" ? "local-file" : url.hostname;
  } catch {
    return "";
  }
}

function isChatGptUrl(rawUrl) {
  try {
    const hostname = new URL(rawUrl).hostname;
    return hostname === "chatgpt.com" || hostname.endsWith(".chatgpt.com");
  } catch {
    return false;
  }
}

async function captureActivePage(kind, retryOptions = null) {
  await loadActivePageContext();
  if (kind === "document" && !retryOptions) await refreshDocumentOptions();
  if (kind === "transcript" && !retryOptions) await refreshTranscriptOptions();
  setStagingMessage(
    localCopy(`正在添加${captureKindLabel(kind)}…`, `Adding ${captureKindLabel(kind)}…`),
    ""
  );
  captureActionButtons.forEach((button) => {
    button.disabled = true;
  });

  try {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_CAPTURE_ACTIVE",
      kind,
      options:
        retryOptions ||
        (kind === "transcript"
          ? { preferredTrackId: transcriptLanguage.value }
          : kind === "document"
            ? {
                document: {
                  url: documentSource.value,
                  kind: documentSource.selectedOptions[0]?.dataset.kind || "current",
                  label: documentSource.selectedOptions[0]?.textContent || localCopy("当前文档", "Current document")
                }
              }
          : undefined)
    });
    if (!result?.ok) {
      setStagingMessage(localizeCaptureFailure(result?.failure, kind), "error");
      return false;
    }
    await loadStagedItems();
    openStagingDrawer();
    setStagingMessage(
      localCopy(
        `${captureKindLabel(kind)}已加入临时素材。`,
        `${captureKindLabel(kind)} added to temporary materials.`
      ),
      "success"
    );
    return true;
  } catch (error) {
    setStagingMessage(error instanceof Error ? error.message : String(error), "error");
    return false;
  } finally {
    await refreshCaptureCapabilities();
    await Promise.all([refreshTranscriptOptions(), refreshDocumentOptions()]);
  }
}

async function retryFailedItem(item) {
  if (await captureActivePage(item.kind, item.retryOptions || null)) {
    await removeStageItem(item.id);
  }
}

async function loadActivePageContext() {
  try {
    const result = await chrome.runtime.sendMessage({ type: "ATLAS_ACTIVE_CONTEXT_GET" });
    if (!result?.ok) throw new Error(result?.error || localCopy("无法读取当前页面。", "Could not read the current page."));
    activePageContext = result.context;
    renderStaging();
    void refreshCaptureCapabilities();
    void refreshTranscriptOptions();
    void refreshDocumentOptions();
  } catch {
    activePageContext = null;
    captureActionButtons.forEach((button) => {
      button.disabled = true;
      button.dataset.capabilityState = "failed";
      button.setAttribute(
        "aria-description",
        localCopy("无法读取当前标签页状态。", "Could not read the current tab state.")
      );
    });
    transcriptLanguage.hidden = true;
  }
}

async function refreshCaptureCapabilities() {
  const requestVersion = ++captureCapabilitiesVersion;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_CAPTURE_CAPABILITIES_GET"
    });
    if (requestVersion !== captureCapabilitiesVersion) return;
    if (!result?.ok) throw new Error(result?.error || localCopy("无法检测页面采集能力。", "Could not detect capture capabilities for this page."));
    const capabilities = result.capabilities || {};

    for (const button of captureActionButtons) {
      const kind = button.dataset.captureKind;
      const capability = capabilities[kind] || {
        state: "failed",
        reason: localCopy("没有取得这项采集能力。", "This capture capability is unavailable."),
        fallback: localCopy("请刷新当前标签页后重试。", "Refresh the current tab and retry.")
      };
      button.dataset.capabilityState = capability.state;
      const localizedCapability = localizeCaptureCapability(kind, capability);
      const detail = [localizedCapability.reason, localizedCapability.fallback]
        .filter(Boolean)
        .join(" ");
      button.setAttribute("aria-description", detail);

      if (kind === "transcript" && capability.state === "available") {
        continue;
      }
      button.disabled = capability.state !== "available";
      button.title =
        capability.state === "available"
          ? localCopy(`添加${captureKindLabel(kind)}到临时素材`, `Add ${captureKindLabel(kind)} to temporary materials`)
          : detail;
    }
  } catch (error) {
    if (requestVersion !== captureCapabilitiesVersion) return;
    const message = error instanceof Error ? error.message : String(error);
    captureActionButtons.forEach((button) => {
      button.disabled = true;
      button.dataset.capabilityState = "failed";
      button.title = message;
      button.setAttribute("aria-description", message);
    });
  }
}

async function refreshDocumentOptions() {
  const requestVersion = ++documentOptionsVersion;
  try {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_DOCUMENT_OPTIONS_GET"
    });
    const options = result?.ok ? result.options || [] : [];
    if (requestVersion !== documentOptionsVersion) return;
    const currentValue = documentSource.value;
    const elements = options.map((option) => {
      const element = new Option(localizeDocumentOptionLabel(option), option.value);
      element.dataset.kind = option.kind;
      return element;
    });
    if (elements.length === 0) {
      const current = new Option(localCopy("当前页面正文（TXT）", "Current page text (TXT)"), "");
      current.dataset.kind = "current";
      elements.push(current);
    }
    documentSource.replaceChildren(...elements);
    documentSource.hidden = elements.length <= 1;
    if (elements.some((option) => option.value === currentValue)) {
      documentSource.value = currentValue;
    } else {
      const preferred = elements.find((option) => option.dataset.kind === "pdf");
      documentSource.value = preferred?.value || elements[0].value;
    }
  } catch {
    if (requestVersion !== documentOptionsVersion) return;
    const current = new Option(localCopy("当前页面正文（TXT）", "Current page text (TXT)"), "");
    current.dataset.kind = "current";
    documentSource.replaceChildren(current);
    documentSource.hidden = true;
  }
}

async function refreshTranscriptOptions() {
  const requestVersion = ++transcriptOptionsVersion;
  const isYouTube = isYouTubeWatchUrl(activePageContext?.url);
  const isBilibili = globalThis.AtlasBilibiliTranscript.isVideoUrl(activePageContext?.url);
  const isTranscriptVideo = isYouTube || isBilibili;
  const providerName = isBilibili ? "Bilibili" : "YouTube";
  const previousValue = transcriptLanguage.value;
  transcriptButton.disabled = true;
  transcriptButton.title = isTranscriptVideo
    ? localCopy(`正在检测 ${providerName} 字幕`, `Detecting ${providerName} transcripts`)
    : localCopy("当前页面不是支持的视频", "The current page is not a supported video");
  transcriptLanguage.hidden = !isTranscriptVideo;
  if (!isTranscriptVideo) {
    transcriptLanguage.replaceChildren(new Option(localCopy("非支持视频", "Not a supported video"), ""));
    transcriptLanguage.disabled = true;
    return;
  }

  transcriptLanguage.hidden = false;
  transcriptLanguage.disabled = true;
  transcriptLanguage.replaceChildren(new Option(localCopy("正在检测字幕…", "Detecting transcripts…"), ""));

  try {
    const result = await chrome.runtime.sendMessage({
      type: "ATLAS_TRANSCRIPT_OPTIONS_GET"
    });
    if (requestVersion !== transcriptOptionsVersion) return;
    if (!result?.ok) throw new Error(result?.error || localCopy("字幕检测失败。", "Transcript detection failed."));
    const capability = result.capability || { state: "unknown", tracks: [] };
    const tracks = Array.isArray(result.options) ? result.options : [];

    if (capability.state === "available" && tracks.length > 0) {
      const options = tracks.map((track) => {
        const option = new Option(transcriptTrackLabel(track), track.value);
        option.dataset.kind = track.kind;
        option.dataset.languageCode = track.languageCode;
        return option;
      });
      transcriptLanguage.replaceChildren(...options);
      transcriptLanguage.disabled = false;
      transcriptButton.disabled = false;
      transcriptButton.title = localCopy(
        `添加所选 ${providerName} 字幕到临时素材`,
        `Add the selected ${providerName} transcript to temporary materials`
      );
      transcriptLanguage.title = localCopy(
        `检测到 ${options.length} 条字幕轨道`,
        `${options.length} transcript tracks detected`
      );
      if (options.some((option) => option.value === previousValue)) {
        transcriptLanguage.value = previousValue;
      } else {
        const preferredLanguage = globalThis.AtlasSettings.resolveTranscriptLanguage(
          currentSettings,
          globalThis.navigator?.language
        );
        const selectedTrack = isBilibili
          ? globalThis.AtlasBilibiliTranscript.chooseTrack(tracks, preferredLanguage)
          : globalThis.AtlasTranscript.chooseTrack(tracks, preferredLanguage);
        if (selectedTrack?.value || selectedTrack?.id) {
          transcriptLanguage.value = selectedTrack.value || selectedTrack.id;
        }
      }
      return;
    }

    const stateCopy = currentSettings.uiLanguage === "en"
      ? ({
          none: `No ${providerName} transcripts`,
          "login-required": "Sign in to access transcripts",
          blocked: "Transcript request blocked",
          unavailable: "Transcripts unavailable",
          unknown: "Transcript status unknown"
        }[capability.state] || "Transcripts unavailable")
      : ({
          none: `无 ${providerName} 字幕`,
          "login-required": "登录后才能读取字幕",
          blocked: "字幕请求被暂时拦截",
          unavailable: "字幕不可用",
          unknown: "无法判断字幕"
        }[capability.state] || "字幕不可用");
    transcriptLanguage.replaceChildren(new Option(stateCopy, ""));
    transcriptLanguage.disabled = true;
    transcriptButton.disabled = true;
    const detail = transcriptCapabilityDetail(capability);
    transcriptLanguage.title = `${stateCopy}${detail}`;
    transcriptButton.title = `${stateCopy}${detail}`;
  } catch (error) {
    if (requestVersion !== transcriptOptionsVersion) return;
    const message = error instanceof Error ? error.message : String(error);
    transcriptLanguage.replaceChildren(new Option(localCopy("字幕检测失败", "Transcript detection failed"), ""));
    transcriptLanguage.disabled = true;
    transcriptButton.disabled = true;
    transcriptLanguage.title = message;
    transcriptButton.title = message;
  }
}

function isYouTubeWatchUrl(rawUrl) {
  try {
    const url = new URL(rawUrl || "");
    return (
      (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") &&
      url.pathname === "/watch" &&
      Boolean(url.searchParams.get("v"))
    );
  } catch {
    return false;
  }
}

function getVisibleStagedItems() {
  return stagedItems;
}

function getItemGroupKey(item) {
  if (item.groupKey || item.source?.groupKey) {
    return item.groupKey || item.source.groupKey;
  }
  let url = String(item.source?.url || "");
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    url = parsed.href;
  } catch {
    // Keep restricted or malformed source URLs serialized as-is.
  }
  return `${item.source?.tabId ?? "unknown"}:${url}`;
}

async function hydrateScreenshotPreview(item, image) {
  try {
    const record = await globalThis.AtlasBlobStore.get(item.blobKey);
    if (!record?.blob || !image.isConnected) return;
    const objectUrl = URL.createObjectURL(record.blob);
    previewUrls.set(item.id, objectUrl);
    image.src = objectUrl;
  } catch {
    image.alt = localCopy("截图预览不可用", "Screenshot preview unavailable");
  }
}

function clearPreviewUrls() {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url);
  previewUrls.clear();
}

function stageKindLabel(kind) {
  const labels = currentSettings.uiLanguage === "en"
    ? { selection: "Selected text", link: "Page link", screenshot: "Screenshot", document: "Document", prompt: "Prompt", transcript: "Transcript" }
    : { selection: "选中文字", link: "页面链接", screenshot: "截图", document: "文档", prompt: "提示词", transcript: "字幕" };
  return labels[kind] || localCopy("素材", "Material");
}

function stagePreviewText(item) {
  if (item.status === "capturing") {
    return localCopy(`正在采集${stageKindLabel(item.kind)}…`, `Capturing ${stageKindLabel(item.kind)}…`);
  }
  if (item.status === "failed") {
    return localizeCaptureFailure(
      {
        code: item.errorCode,
        message: item.error,
        fallback: item.fallback
      },
      item.kind
    );
  }
  switch (item.kind) {
    case "link":
      return item.title || item.url || localCopy("页面链接", "Page link");
    case "screenshot":
      return [
        item.fileName || "screenshot.png",
        item.width && item.height ? `${item.width}×${item.height}` : "",
        formatBytes(item.size)
      ]
        .filter(Boolean)
        .join(" · ");
    case "document":
      return `${item.fileName || "document"} · ${formatBytes(item.size)}`;
    case "prompt":
      return [item.promptName || localCopy("常用提示词", "Saved prompt"), item.text]
        .filter(Boolean)
        .join(" · ");
    case "transcript":
      return [
        item.fileName || item.preview || item.text || localCopy("视频字幕", "Video transcript"),
        item.language && item.language !== "und" ? item.language : "",
        item.segmentCount ? localCopy(`${item.segmentCount} 段`, `${item.segmentCount} segments`) : ""
      ]
        .filter(Boolean)
        .join(" · ");
    default:
      return item.error || item.text || item.preview || item.fileName || "";
  }
}

function isTransferableStageItem(item) {
  if (!item || !["ready", "added"].includes(item.status)) return false;
  if (item.blobKey && item.fileName) return true;
  if (item.kind === "selection" || item.kind === "transcript" || item.kind === "prompt") {
    return Boolean(item.text?.trim());
  }
  if (item.kind === "link") {
    return Boolean(item.url || item.source?.url);
  }
  return false;
}

function stageSourceText(item) {
  const source =
    item.kind === "link"
      ? item.url || item.source?.url || localCopy("未知链接", "Unknown link")
      : item.source?.title || item.source?.url || localCopy("未知来源", "Unknown source");
  return item.capturedAt ? `${source} · ${formatCapturedTime(item.capturedAt)}` : source;
}

function captureKindLabel(kind) {
  const labels = currentSettings.uiLanguage === "en"
    ? { link: "link", screenshot: "screenshot", document: "document", transcript: "transcript" }
    : { link: "链接", screenshot: "截图", document: "文档", transcript: "字幕" };
  return labels[kind] || localCopy("内容", "content");
}

function formatBytes(size) {
  const bytes = Number(size) || 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatCapturedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(currentSettings.uiLanguage === "en" ? "en" : "zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

async function downloadAttachmentFallback(item) {
  try {
    await startMaterialDownload(item);
    return { outcome: "downloaded", method: "download-fallback" };
  } catch (error) {
    return {
      outcome: "failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function downloadOneItem(item, button) {
  button.disabled = true;
  try {
    const result = await startMaterialDownload(item);
    setStagingMessage(
      localCopy(`已下载 ${result.fileName}。`, `Downloaded ${result.fileName}.`),
      "success"
    );
  } catch (error) {
    setStagingMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    button.disabled = false;
  }
}

async function downloadSelectedItems() {
  const items = getVisibleStagedItems().filter(
    (item) => item.selected && Boolean(globalThis.AtlasExport.describe(item))
  );
  if (items.length === 0) {
    setStagingMessage(
      localCopy("请至少选择一份可下载素材。", "Select at least one downloadable material."),
      "error"
    );
    return;
  }

  downloadSelectedButton.disabled = true;
  setButtonLabel(downloadSelectedButton, localCopy("正在下载…", "Downloading…"));
  const results = await globalThis.AtlasExport.downloadMany(items, materialDownloadDependencies());
  const downloaded = results.filter((result) => result.ok).length;
  const failed = results.length - downloaded;
  setStagingMessage(
    localCopy(
      `下载 ${downloaded} 项${failed ? `，失败 ${failed} 项` : ""}；素材选择和传输状态未改变。`,
      `Downloaded ${downloaded}${failed ? `; ${failed} failed` : ""}. Selection and transfer state were not changed.`
    ),
    failed ? "error" : "success"
  );
  renderStaging();
}

async function copySelectedItems() {
  const items = getVisibleStagedItems().filter(
    (item) => item.selected && isTransferableStageItem(item)
  );
  if (items.length === 0) {
    setStagingMessage(
      localCopy("请至少选择一份可复制素材。", "Select at least one material to copy."),
      "error"
    );
    return;
  }

  copySelectedButton.disabled = true;
  setButtonLabel(copySelectedButton, localCopy("正在复制…", "Copying…"));
  try {
    const result = await globalThis.AtlasTransfer.buildClipboardText(items, {
      language: currentSettings.uiLanguage,
      loadBlob: async (blobKey) => (await globalThis.AtlasBlobStore.get(blobKey))?.blob || null
    });
    if (!result.text) {
      throw new Error(localCopy("选中的素材没有可复制内容。", "The selected materials have no copyable content."));
    }
    await navigator.clipboard.writeText(result.text);
    const attachmentNote = result.binaryAttachments.length
      ? localCopy(
          `；其中 ${result.binaryAttachments.length} 个 PDF、图片或无法读取的文件只复制了名称和来源，可用下载按钮取得原文件`,
          `; ${result.binaryAttachments.length} binary or unavailable files were represented by name and source only—use Download for the originals`
        )
      : "";
    setStagingMessage(
      localCopy(
        `已复制 ${items.length} 项${attachmentNote}。选择和传输状态未改变。`,
        `Copied ${items.length} items${attachmentNote}. Selection and transfer state were not changed.`
      ),
      "success"
    );
  } catch (error) {
    setStagingMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    renderStaging();
  }
}

async function startMaterialDownload(item) {
  try {
    return await globalThis.AtlasExport.download(item, materialDownloadDependencies());
  } catch (error) {
    const message = {
      "not-downloadable": localCopy("这份素材没有可下载内容。", "This material has no downloadable content."),
      "missing-blob": localCopy("本地素材文件不存在。", "The local material file is missing."),
      "download-unavailable": localCopy("Chrome 下载功能不可用。", "Chrome downloads are unavailable."),
      "download-rejected": localCopy("Chrome 没有接受下载请求。", "Chrome did not accept the download request.")
    }[error?.code];
    throw new Error(message || (error instanceof Error ? error.message : String(error)));
  }
}

function materialDownloadDependencies() {
  return {
    loadBlob: async (blobKey) => (await globalThis.AtlasBlobStore.get(blobKey))?.blob || null,
    startDownload: (options) => chrome.downloads.download(options),
    createObjectUrl: (blob) => URL.createObjectURL(blob),
    revokeObjectUrl: (url) => URL.revokeObjectURL(url),
    scheduleRevoke: (callback) => setTimeout(callback, 30_000)
  };
}

async function applyTransferFallback(selectedItems, bundle, bridgeError) {
  let tabTextResult = null;
  let tabTransferError = "";
  if (bundle.composerText) {
    try {
      const response = await chrome.runtime.sendMessage({
        type: "ATLAS_TRANSFER_TO_CHATGPT_TAB",
        payload: { text: bundle.composerText }
      });
      if (!response?.ok) throw new Error(response?.error || localCopy("ChatGPT 标签页传输失败。", "Transfer to the ChatGPT tab failed."));
      if (response.result?.autoSent !== false || !response.result?.text?.ok) {
        throw new Error(response.result?.text?.error || localCopy("ChatGPT 标签页没有确认文字写入。", "The ChatGPT tab did not confirm the text insertion."));
      }
      tabTextResult = response.result.text;
    } catch (error) {
      tabTransferError = error instanceof Error ? error.message : String(error);
    }
  }

  let copied = false;
  if (bundle.composerText && !tabTextResult) {
    try {
      await navigator.clipboard.writeText(bundle.composerText);
      copied = true;
    } catch {
      copied = false;
    }
  }

  const outcomes = new Map();
  for (const item of selectedItems) {
    if (item.blobKey) {
      outcomes.set(item.id, await downloadAttachmentFallback(item));
    } else {
      outcomes.set(
        item.id,
        tabTextResult
          ? { outcome: "inserted", method: `top-level-${tabTextResult.method || "bridge"}` }
          : copied
          ? { outcome: "copied", method: "clipboard-fallback" }
          : { outcome: "failed", error: tabTransferError || bridgeError }
      );
    }
  }

  let persistenceError = "";
  try {
    await persistTransferOutcomes(outcomes);
  } catch (error) {
    persistenceError = error instanceof Error ? error.message : String(error);
  }

  if (!tabTextResult) {
    try {
      await openCurrentUrlInTab();
    } catch {
      // Clipboard/download fallback remains useful even if tab focus fails.
    }
  }

  const values = Array.from(outcomes.values());
  const insertedCount = values.filter((item) => item.outcome === "inserted").length;
  const copiedCount = values.filter((item) => item.outcome === "copied").length;
  const downloadedCount = values.filter((item) => item.outcome === "downloaded").length;
  const failedCount = values.filter((item) => item.outcome === "failed").length;
  const parts = [];
  if (insertedCount) parts.push(localCopy(`标签页写入 ${insertedCount} 项`, `Inserted ${insertedCount} in the tab`));
  if (copiedCount) parts.push(localCopy(`复制 ${copiedCount} 项`, `Copied ${copiedCount}`));
  if (downloadedCount) parts.push(localCopy(`下载 ${downloadedCount} 项`, `Downloaded ${downloadedCount}`));
  if (failedCount) parts.push(localCopy(`失败 ${failedCount} 项`, `${failedCount} failed`));
  if (persistenceError) parts.push(localCopy(`状态保存失败：${persistenceError}`, `Could not save status: ${persistenceError}`));
  setStagingMessage(
    localCopy(
      `${parts.join("，")}；侧栏内嵌传输失败：${bridgeError}${
        tabTransferError ? `；标签页传输失败：${tabTransferError}` : ""
      }；草稿素材仍然保留，消息没有发送。`,
      `${parts.join(", ")}. Embedded transfer failed: ${bridgeError}${
        tabTransferError ? `; tab transfer failed: ${tabTransferError}` : ""
      }. Draft materials are still available. Message not sent.`
    ),
    failedCount || persistenceError ? "error" : "success"
  );
}

function transcriptTrackLabel(track) {
  const base = String(track.label || track.languageCode || "")
    .replace(/\s*[（(](?:自动|人工|AI|作者提供|类型未知|auto(?:-generated)?|manual|provided|unknown)[）)]\s*$/i, "")
    .trim();
  if (track.provider === "bilibili") {
    const suffix = {
      ai: localCopy("（AI）", " (AI)"),
      provided: localCopy("（作者提供）", " (provided)"),
      unknown: localCopy("（类型未知）", " (unknown type)")
    }[track.kind] || localCopy("（类型未知）", " (unknown type)");
    return `${base}${suffix}`;
  }
  return `${base}${localCopy(
    track.kind === "asr" ? "（自动）" : "（人工）",
    track.kind === "asr" ? " (auto-generated)" : " (manual)"
  )}`;
}

function localizeCaptureCapability(kind, capability) {
  if (currentSettings.uiLanguage !== "en") return capability;
  if (capability.state === "available") return { reason: "", fallback: "" };
  if (capability.state === "failed") {
    return {
      reason: `Could not determine whether ${captureKindLabel(kind)} is available.`,
      fallback: "Refresh the current tab and retry."
    };
  }
  if (kind === "document" && capability.state === "permission-required") {
    return {
      reason: "Atlas Sidebar is not allowed to access file URLs.",
      fallback: "Enable “Allow access to file URLs” or use the Local file button."
    };
  }
  const copy = {
    selection: ["No selected text is available for this action.", "Select some text, then open the Atlas Sidebar menu."],
    link: ["The current tab URL is unavailable.", "Refresh the current tab and retry."],
    screenshot: ["Chrome does not allow screenshots of this page.", "Use a regular web page or local file page."],
    document: ["This page cannot be read as a document.", "Use Link, Screenshot, or Local file instead."],
    transcript: ["The current page is not a supported video.", "Open a YouTube or Bilibili video first."]
  }[kind] || ["This capture type is unavailable.", "Use Link or Screenshot instead."];
  return { reason: copy[0], fallback: copy[1] };
}

function localizeCaptureFailure(failure, kind = "") {
  const source = failure && typeof failure === "object" ? failure : {};
  if (currentSettings.uiLanguage !== "en") {
    return [source.message || `${stageKindLabel(kind)}采集失败。`, source.fallback || ""]
      .filter(Boolean)
      .join(" ");
  }
  const copy = {
    "invalid-selection": ["The selection does not contain text that can be saved.", "Select some text and retry."],
    unsupported: ["This capture type is not supported here.", "Use Link or Screenshot instead."],
    "permission-required": ["Atlas Sidebar needs additional permission for this page.", "Check extension permissions or use Local file."],
    "storage-limit": ["Temporary storage is full or the material is too large.", "Clear materials you no longer need and retry."],
    "invalid-pdf": ["The selected or downloaded file is not a valid PDF.", "Choose the original PDF file."],
    "empty-document": ["The server returned an empty document (0 B).", "Retry, add only the link, or choose the local file."],
    "page-changed": ["The active tab or page changed during capture, so the material was not saved.", "Return to the original page and retry."],
    "invalid-image": ["Chrome did not return a valid PNG screenshot.", "Retry the screenshot."],
    "transcript-not-youtube": ["The current page is not a supported video.", "Open a YouTube or Bilibili video first."],
    "transcript-none": ["This video has no transcript tracks.", "Use speech recognition separately if you need a transcript."],
    "transcript-login-required": ["Sign in to Bilibili to access this transcript.", "Sign in using the current Chrome profile and retry."],
    "transcript-blocked": ["Bilibili temporarily blocked the transcript request.", "Refresh the video or retry later."],
    "transcript-unavailable": ["The video or its transcripts are restricted or unavailable.", "Confirm that the video plays normally, then retry."],
    "transcript-unknown": ["Atlas cannot reliably determine whether this video has transcripts.", "Confirm that the video plays normally, then retry."],
    "transcript-track-missing": ["The selected transcript track is no longer available.", "Choose a language again and retry."],
    "transcript-po-token": ["A transcript track exists, but YouTube requires a PO Token to fetch it.", "Open the transcript panel on YouTube and retry."],
    "transcript-fetch-failed": ["A transcript track exists, but its text could not be fetched.", "Retry or choose another transcript track."],
    "capture-failed": [`${stageKindLabel(kind)} capture failed.`, "Retry; if it still fails, use Link or Screenshot."]
  }[source.code] || [`${stageKindLabel(kind)} capture failed.`, "Retry; if it still fails, use Link or Screenshot."];
  return copy.join(" ");
}

function localizeDocumentOptionLabel(option) {
  if (currentSettings.uiLanguage !== "en") return option.label;
  if (option.kind === "current") {
    return /原文件/.test(option.label) ? "Current document file" : "Current page text (TXT)";
  }
  const prefix = { pdf: "PDF", text: "Text", html: "HTML", source: "Source files" }[option.kind] || "Document";
  const detail = String(option.label || "").replace(/^(?:PDF|文本|HTML|源文件|文档)\s*·\s*/, "");
  return detail ? `${prefix} · ${detail}` : prefix;
}

function transcriptCapabilityDetail(capability) {
  if (!capability?.reason) return "";
  if (currentSettings.uiLanguage !== "en") return `：${capability.reason}`;
  const detail = {
    none: "",
    unavailable: ": The video or its transcripts are restricted or unavailable.",
    unknown: ": YouTube did not return a reliable transcript state."
  }[capability.state];
  return detail || "";
}

async function persistTransferOutcomes(outcomes) {
  const at = new Date().toISOString();
  await applyStageMutation({
    action: "patch",
    patches: Array.from(outcomes, ([id, transfer]) => ({
      id,
      patch: {
        status: transfer.outcome === "failed" ? "ready" : "added",
        selected: transfer.outcome === "failed",
        lastTransfer: { at, ...transfer }
      }
    }))
  });
}

function reportStageActionError(error) {
  renderStaging();
  setStagingMessage(
    error instanceof Error ? error.message : String(error),
    "error"
  );
}

function reportNavigationError(error) {
  showError(error instanceof Error ? error.message : String(error));
}
