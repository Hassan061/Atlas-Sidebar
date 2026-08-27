(function reportAtlasFrameNavigation() {
  if (window.top === window) return;

  const extensionOrigin = chrome.runtime.getURL("").replace(/\/$/, "");
  const parentOrigin = Array.from(location.ancestorOrigins || [])[0] || "";
  if (parentOrigin !== extensionOrigin) return;

  const SOURCE = "atlas-frame-navigation";
  const documentId = crypto.randomUUID?.() || `frame-${Date.now()}-${Math.random()}`;
  globalThis.__atlasFrameDocumentId = documentId;
  let lastUrl = "";
  let lastTitle = "";
  let timer = null;

  function report(kind = "update") {
    timer = null;
    const url = location.href;
    const title = document.title;
    if (kind !== "ready" && url === lastUrl && title === lastTitle) return;
    lastUrl = url;
    lastTitle = title;
    window.parent.postMessage(
      {
        source: SOURCE,
        type: "ATLAS_FRAME_NAVIGATION",
        documentId,
        kind,
        url,
        title
      },
      "*"
    );
  }

  function schedule() {
    if (timer !== null) return;
    timer = setTimeout(() => report("update"), 120);
  }

  for (const eventName of ["pageshow", "popstate", "hashchange"]) {
    window.addEventListener(eventName, schedule, { passive: true });
  }
  document.addEventListener("visibilitychange", schedule, { passive: true });

  const observer = new MutationObserver(schedule);
  observer.observe(document.head || document.documentElement, {
    subtree: true,
    childList: true,
    characterData: true
  });

  report("ready");
  setInterval(() => report("poll"), 1_000);
})();
