(function installAtlasSelectionBubble() {
  if (globalThis.top !== globalThis && location.protocol === "about:") return;

  const labels = {
    "zh-CN": { add: "添加选中文字到 Atlas Sidebar", adding: "正在添加", added: "已添加", failed: "添加失败，请重试" },
    en: { add: "Add selected text to Atlas Sidebar", adding: "Adding", added: "Added", failed: "Could not add. Try again" },
    es: { add: "Añadir texto seleccionado a Atlas Sidebar", adding: "Añadiendo", added: "Añadido", failed: "No se pudo añadir" },
    fr: { add: "Ajouter le texte sélectionné à Atlas Sidebar", adding: "Ajout…", added: "Ajouté", failed: "Échec de l’ajout" },
    de: { add: "Markierten Text zu Atlas Sidebar hinzufügen", adding: "Wird hinzugefügt", added: "Hinzugefügt", failed: "Hinzufügen fehlgeschlagen" },
    ja: { add: "選択したテキストを Atlas Sidebar に追加", adding: "追加中", added: "追加しました", failed: "追加できませんでした" },
    ko: { add: "선택한 텍스트를 Atlas Sidebar에 추가", adding: "추가 중", added: "추가됨", failed: "추가하지 못했습니다" },
    "pt-BR": { add: "Adicionar texto selecionado ao Atlas Sidebar", adding: "Adicionando", added: "Adicionado", failed: "Não foi possível adicionar" }
  };
  let copy = labels["zh-CN"];
  let selectedText = "";
  let selectionTimer = 0;
  let pending = false;
  const parentRequests = new Map();

  const host = document.createElement("div");
  host.id = "atlas-selection-bubble-host";
  host.style.cssText = "all:initial;position:fixed;display:none;z-index:2147483647;pointer-events:auto;";
  const shadow = host.attachShadow({ mode: "closed" });
  const button = document.createElement("button");
  button.type = "button";
  button.setAttribute("aria-label", copy.add);
  button.title = copy.add;
  button.append(createIcon("idle"));
  const style = document.createElement("style");
  style.textContent = `
    :host { color-scheme: light dark; }
    button { display:grid; width:28px; height:28px; place-items:center; border:1px solid rgb(0 0 0 / 16%); border-radius:8px; padding:0; background:#fff; color:#171717; box-shadow:0 4px 14px rgb(0 0 0 / 22%); cursor:pointer; }
    button:hover { background:#eef6ff; color:#075985; transform:translateY(-1px); }
    button:focus-visible { outline:2px solid #1677ff; outline-offset:2px; }
    button[disabled] { cursor:wait; opacity:.72; }
    svg { width:16px; height:16px; fill:none; stroke:currentColor; stroke-width:2; stroke-linecap:round; }
    button[data-state="added"] { background:#eaf8ef; color:#137333; }
    button[data-state="failed"] { background:#fff1f0; color:#b42318; }
    @media (prefers-color-scheme: dark) { button { border-color:rgb(255 255 255 / 18%); background:#252525; color:#f5f5f5; box-shadow:0 4px 16px rgb(0 0 0 / 48%); } button:hover { background:#173047; color:#8bc8ff; } }
    @media (forced-colors: active) { button { border:1px solid ButtonText; background:ButtonFace; color:ButtonText; box-shadow:none; } }
  `;
  shadow.append(style, button);
  (document.documentElement || document.body).append(host);

  void chrome.storage.local.get("atlasSettings").then((stored) => {
    const language = stored?.atlasSettings?.uiLanguage;
    copy = labels[language] || labels.en;
    setButtonState("idle");
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes.atlasSettings) return;
    copy = labels[changes.atlasSettings.newValue?.uiLanguage] || labels.en;
    setButtonState("idle");
  });

  document.addEventListener("pointerup", scheduleSelectionBubble, true);
  document.addEventListener("keyup", (event) => {
    if (event.key.startsWith("Arrow") || event.key === "Shift") scheduleSelectionBubble();
  }, true);
  document.addEventListener("selectionchange", scheduleSelectionBubble, true);
  document.addEventListener("pointerdown", (event) => {
    if (!event.composedPath().includes(host)) hideBubble();
  }, true);
  addEventListener("scroll", hideBubble, true);
  addEventListener("resize", hideBubble, true);
  addEventListener("blur", hideBubble, true);
  addEventListener("message", handleParentResult);

  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  button.addEventListener("click", () => void addSelection());

  function scheduleSelectionBubble() {
    clearTimeout(selectionTimer);
    selectionTimer = setTimeout(showForCurrentSelection, 90);
  }

  function showForCurrentSelection() {
    if (pending) return;
    const selection = getSelection();
    const text = String(selection || "").trim();
    if (!selection || selection.isCollapsed || !text || !selection.rangeCount) return hideBubble();
    const range = selection.getRangeAt(selection.rangeCount - 1);
    const rects = range.getClientRects();
    const rect = rects.length ? rects[rects.length - 1] : range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return hideBubble();
    selectedText = text;
    setButtonState("idle");
    const size = 28;
    const gap = 7;
    const left = Math.max(6, Math.min(innerWidth - size - 6, rect.right + gap));
    const below = rect.bottom + gap;
    const top = below + size <= innerHeight - 6
      ? below
      : Math.max(6, rect.top - size - gap);
    host.style.left = `${left}px`;
    host.style.top = `${top}px`;
    host.style.display = "block";
  }

  async function addSelection() {
    if (pending || !selectedText) return;
    pending = true;
    setButtonState("adding");
    try {
      let response;
      if (isHostedByAtlasSidebar()) {
        response = await stageThroughSidebar(selectedText);
      } else {
        response = await chrome.runtime.sendMessage({
          type: "ATLAS_STAGE_INLINE_SELECTION",
          selectionText: selectedText
        });
        if (!response?.ok && globalThis.top !== globalThis) {
          response = await stageThroughSidebar(selectedText);
        }
      }
      if (!response?.ok) throw new Error(response?.error || "stage rejected");
      setButtonState("added");
      setTimeout(hideBubble, 650);
    } catch {
      setButtonState("failed");
      pending = false;
    }
  }

  function isHostedByAtlasSidebar() {
    if (globalThis.top === globalThis) return false;
    const extensionOrigin = new URL(chrome.runtime.getURL("/")).origin;
    return Array.from(location.ancestorOrigins || []).includes(extensionOrigin);
  }

  function stageThroughSidebar(selectionText) {
    const requestId = crypto.randomUUID?.() || `selection-${Date.now()}-${Math.random()}`;
    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        parentRequests.delete(requestId);
        resolve({ ok: false, error: "sidebar selection timed out" });
      }, 3_000);
      parentRequests.set(requestId, { resolve, timeoutId });
      window.parent.postMessage({
        source: "atlas-sidebar-selection",
        type: "ATLAS_SIDEBAR_SELECTION_REQUEST",
        requestId,
        documentId: globalThis.__atlasFrameDocumentId || "",
        selectionText,
        url: location.href,
        title: document.title
      }, "*");
    });
  }

  function handleParentResult(event) {
    const data = event.data;
    if (
      event.source !== window.parent ||
      data?.source !== "atlas-sidebar" ||
      data?.type !== "ATLAS_SIDEBAR_SELECTION_RESULT"
    ) return;
    const pendingRequest = parentRequests.get(data.requestId);
    if (!pendingRequest) return;
    clearTimeout(pendingRequest.timeoutId);
    parentRequests.delete(data.requestId);
    pendingRequest.resolve({ ok: Boolean(data.ok), error: String(data.error || "") });
  }

  function setButtonState(state) {
    const title = copy[state] || copy.add;
    button.dataset.state = state;
    button.disabled = state === "adding" || state === "added";
    button.setAttribute("aria-label", title);
    button.title = title;
    button.replaceChildren(createIcon(state));
  }

  function createIcon(state) {
    const namespace = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(namespace, "svg");
    svg.setAttribute("viewBox", "0 0 20 20");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(namespace, "path");
    path.setAttribute(
      "d",
      state === "added" ? "m4 10 4 4 8-9" : state === "failed" ? "M10 6v5M10 14h.01" : "M10 4v12M4 10h12"
    );
    svg.append(path);
    if (state === "failed") {
      const circle = document.createElementNS(namespace, "circle");
      circle.setAttribute("cx", "10");
      circle.setAttribute("cy", "10");
      circle.setAttribute("r", "7");
      svg.append(circle);
    }
    return svg;
  }

  function hideBubble() {
    clearTimeout(selectionTimer);
    host.style.display = "none";
    selectedText = "";
    pending = false;
    setButtonState("idle");
  }
})();
