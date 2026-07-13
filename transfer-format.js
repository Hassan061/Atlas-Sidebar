const DEFAULT_MAX_COMPOSER_CHARS = 180_000;
const COPY = Object.freeze({
  "zh-CN": Object.freeze({
    selection: (index) => `选中文字 ${index}`,
    pageLink: "页面链接",
    untitled: "未命名页面",
    transcript: "视频字幕",
    documentText: "文档正文",
    prompt: (name) => name ? `常用提示词：${name}` : "常用提示词",
    screenshotAttachment: "截图附件",
    transcriptAttachment: "字幕附件",
    selectionAttachment: "选中文字附件",
    documentAttachment: "文档附件",
    question: "我的问题：",
    title: "标题：",
    source: "来源：",
    tooLong: ({ actual = 0, max = DEFAULT_MAX_COMPOSER_CHARS }) => `选中的文字合计 ${actual.toLocaleString()} 个字符，超过单次 ${max.toLocaleString()} 字符限制。请减少勾选项后分批添加。`
  }),
  en: Object.freeze({
    selection: (index) => `Selected text ${index}`,
    pageLink: "Page link",
    untitled: "Untitled page",
    transcript: "Video transcript",
    documentText: "Document text",
    prompt: (name) => name ? `Saved prompt: ${name}` : "Saved prompt",
    screenshotAttachment: "Screenshot attachment",
    transcriptAttachment: "Transcript attachment",
    selectionAttachment: "Selected text attachment",
    documentAttachment: "Document attachment",
    question: "My question:",
    title: "Title: ",
    source: "Source: ",
    tooLong: ({ actual = 0, max = DEFAULT_MAX_COMPOSER_CHARS }) => `The selected text contains ${actual.toLocaleString()} characters, exceeding the ${max.toLocaleString()} character limit. Select fewer items and add them in batches.`
  })
});

globalThis.AtlasTransfer = Object.freeze({
  buildBundle(items, options = {}) {
    const language = !options.language || options.language === "zh-CN" ? "zh-CN" : "en";
    const copy = COPY[language];
    const forceSelectedIds = new Set(
      Array.isArray(options.forceSelectedIds) ? options.forceSelectedIds : []
    );
    const selectedItems = items.filter(
      (item) =>
        item &&
        (item.selected || forceSelectedIds.has(item.id)) &&
        ["ready", "added"].includes(item.status)
    );
    const textSections = [];
    const promptSections = [];
    const attachments = [];
    let hasSavedPrompt = false;
    let textIndex = 0;

    for (const item of selectedItems) {
      if (item.kind === "selection" && item.text?.trim()) {
        textIndex += 1;
        textSections.push(
          section(copy.selection(textIndex), item.text.trim(), item.source, copy)
        );
        continue;
      }

      if (item.kind === "link" && (item.url || item.source?.url)) {
        textSections.push(
          section(copy.pageLink, item.title || item.source?.title || copy.untitled, {
            title: "",
            url: item.url || item.source?.url
          }, copy)
        );
        continue;
      }

      if (item.kind === "transcript" && item.text?.trim() && !item.blobKey) {
        textSections.push(section(copy.transcript, item.text.trim(), item.source, copy));
        continue;
      }

      if (item.kind === "prompt" && item.text?.trim()) {
        hasSavedPrompt = true;
        promptSections.push(
          section(copy.prompt(item.promptName), item.text.trim(), null, copy)
        );
        continue;
      }

      if (item.kind === "document" && item.text?.trim()) {
        textSections.push(section(copy.documentText, item.text.trim(), item.source, copy));
        continue;
      }

      if (item.blobKey && item.fileName) {
        attachments.push({
          stagingId: item.id,
          blobKey: item.blobKey,
          fileName: item.fileName,
          mime: item.mime || "application/octet-stream"
        });
        textSections.push(
          section(
            item.kind === "screenshot"
              ? copy.screenshotAttachment
              : item.kind === "transcript"
                ? copy.transcriptAttachment
                : item.kind === "selection"
                  ? copy.selectionAttachment
                  : copy.documentAttachment,
            item.fileName,
            item.source,
            copy
          )
        );
      }
    }

    const allSections = [...textSections, ...promptSections];
    const composerText =
      allSections.length > 0
        ? `${allSections.join("\n\n")}${hasSavedPrompt ? "" : `\n\n${copy.question}`}`
        : "";

    const maxComposerChars = Number.isFinite(options.maxComposerChars)
      ? Math.max(1, Number(options.maxComposerChars))
      : DEFAULT_MAX_COMPOSER_CHARS;
    if (composerText.length > maxComposerChars) {
      const error = new RangeError(copy.tooLong({ actual: composerText.length, max: maxComposerChars }));
      error.code = "composerTooLong";
      error.details = { actual: composerText.length, max: maxComposerChars };
      throw error;
    }

    return { composerText, attachments };
  },

  async buildClipboardText(items, options = {}) {
    const loadBlob = typeof options.loadBlob === "function"
      ? options.loadBlob
      : async () => null;
    const hydrated = [];
    for (const item of Array.isArray(items) ? items : []) {
      if (!item?.blobKey || !isClipboardTextMime(item.mime)) {
        hydrated.push(item);
        continue;
      }
      const blob = await loadBlob(item.blobKey);
      if (!blob || typeof blob.text !== "function") {
        hydrated.push(item);
        continue;
      }
      hydrated.push({ ...item, blobKey: "", text: await blob.text() });
    }
    const bundle = this.buildBundle(hydrated, {
      language: options.language,
      forceSelectedIds: options.forceSelectedIds,
      maxComposerChars: Number.MAX_SAFE_INTEGER
    });
    return {
      text: bundle.composerText,
      binaryAttachments: bundle.attachments
    };
  },

  formatSelections(items) {
    return this.buildBundle(items).composerText;
  },

  formatError(error, language = "zh-CN") {
    const copy = COPY[language === "zh-CN" ? "zh-CN" : "en"];
    if (error?.code === "composerTooLong") return copy.tooLong(error.details || {});
    return error instanceof Error ? error.message : String(error || "");
  }
});

function isClipboardTextMime(value) {
  const mime = String(value || "").split(";", 1)[0].trim().toLowerCase();
  return mime.startsWith("text/") || [
    "application/json",
    "application/ld+json",
    "application/xml",
    "application/javascript"
  ].includes(mime);
}

function section(label, content, source, copy) {
  const lines = [`【${label}】`, content];
  if (source?.title) lines.push(`${copy.title}${source.title}`);
  if (source?.url) lines.push(`${copy.source}${source.url}`);
  return lines.join("\n");
}
