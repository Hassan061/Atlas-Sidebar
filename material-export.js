(function installAtlasExport(global) {
  const MAX_FILE_NAME_LENGTH = 180;
  const DOWNLOADABLE_STATUSES = Object.freeze(["ready", "added"]);

  function describe(item) {
    if (!item || !DOWNLOADABLE_STATUSES.includes(item.status)) return null;
    if (item.blobKey && item.fileName) {
      return {
        mode: "blob",
        blobKey: String(item.blobKey),
        fileName: safeFileName(item.fileName, fallbackName(item)),
        mime: String(item.mime || "application/octet-stream")
      };
    }

    const sourceTitle = item.source?.title || "";
    if (item.kind === "selection" && item.text?.trim()) {
      return textDescriptor(
        item.text,
        `${safeStem(sourceTitle || "selected-text")}-selection.txt`
      );
    }
    if (item.kind === "link" && (item.url || item.source?.url)) {
      const url = String(item.url || item.source.url).replace(/[\r\n]+/g, "");
      return {
        mode: "text",
        fileName: safeFileName(`${safeStem(item.title || sourceTitle || "page-link")}.url`, "page-link.url"),
        mime: "application/internet-shortcut;charset=utf-8",
        text: `[InternetShortcut]\r\nURL=${url}\r\n`
      };
    }
    if (item.kind === "prompt" && item.text?.trim()) {
      return textDescriptor(
        item.text,
        `${safeStem(item.promptName || "saved-prompt")}.txt`
      );
    }
    if (item.kind === "transcript" && item.text?.trim()) {
      return textDescriptor(
        item.text,
        `${safeStem(sourceTitle || "video-transcript")}-transcript.txt`
      );
    }
    if (item.kind === "document" && item.text?.trim()) {
      return textDescriptor(
        item.text,
        `${safeStem(sourceTitle || "document")}.txt`
      );
    }
    return null;
  }

  function textDescriptor(text, fileName) {
    return {
      mode: "text",
      fileName: safeFileName(fileName, "atlas-material.txt"),
      mime: "text/plain;charset=utf-8",
      text: String(text).replace(/\r\n?/g, "\n").normalize("NFC")
    };
  }

  function safeStem(value) {
    return safeFileName(String(value || "material"), "material")
      .replace(/\.[a-z0-9]{1,12}$/i, "") || "material";
  }

  function safeFileName(value, fallback = "atlas-material") {
    const cleaned = String(value || "")
      .normalize("NFC")
      .replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069/\\:*?"<>|]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^\.+/g, "")
      .replace(/[. ]+$/g, "")
      .trim();
    let name = cleaned || fallback;
    if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) {
      name = `_${name}`;
    }
    if (name.length <= MAX_FILE_NAME_LENGTH) return name;
    const match = name.match(/(\.[a-z0-9]{1,12})$/i);
    const extension = match?.[1] || "";
    return `${name.slice(0, MAX_FILE_NAME_LENGTH - extension.length).trim()}${extension}`;
  }

  function fallbackName(item) {
    const extension = {
      screenshot: ".png",
      transcript: ".vtt",
      feed: ".md",
      selection: ".txt",
      document: ""
    }[item?.kind] || "";
    return `atlas-${item?.kind || "material"}${extension}`;
  }

  async function download(
    item,
    {
      loadBlob,
      startDownload,
      createObjectUrl = (blob) => global.URL.createObjectURL(blob),
      revokeObjectUrl = (url) => global.URL.revokeObjectURL(url),
      scheduleRevoke = (callback) => setTimeout(callback, 30_000)
    } = {}
  ) {
    const descriptor = describe(item);
    if (!descriptor) throw exportError("not-downloadable");
    if (typeof startDownload !== "function") throw exportError("download-unavailable");

    let blob;
    if (descriptor.mode === "blob") {
      blob = typeof loadBlob === "function" ? await loadBlob(descriptor.blobKey) : null;
      if (!(blob instanceof Blob)) throw exportError("missing-blob");
    } else {
      blob = new Blob([descriptor.text], { type: descriptor.mime });
    }

    const objectUrl = createObjectUrl(blob);
    try {
      const downloadId = await startDownload({
        url: objectUrl,
        filename: descriptor.fileName,
        conflictAction: "uniquify",
        saveAs: false
      });
      if (!Number.isInteger(downloadId)) throw exportError("download-rejected");
      scheduleRevoke(() => revokeObjectUrl(objectUrl));
      return { ok: true, downloadId, fileName: descriptor.fileName };
    } catch (error) {
      revokeObjectUrl(objectUrl);
      if (error?.name === "AtlasExportError") throw error;
      throw exportError("download-rejected");
    }
  }

  async function downloadMany(items, dependencies) {
    const results = [];
    for (const item of Array.isArray(items) ? items : []) {
      try {
        results.push({ itemId: item?.id || "", ...(await download(item, dependencies)) });
      } catch (error) {
        results.push({
          itemId: item?.id || "",
          ok: false,
          code: error?.code || "download-failed",
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    return results;
  }

  function exportError(code) {
    const error = new Error(code);
    error.name = "AtlasExportError";
    error.code = code;
    return error;
  }

  global.AtlasExport = Object.freeze({
    MAX_FILE_NAME_LENGTH,
    DOWNLOADABLE_STATUSES,
    describe,
    safeFileName,
    download,
    downloadMany
  });
})(globalThis);
