(() => {
  const REQUEST_SOURCE = "atlas-sidebar";
  const RESPONSE_SOURCE = "atlas-chatgpt-bridge";
  const MAX_TEXT_LENGTH = 200_000;
  const EXTENSION_ORIGIN = chrome.runtime.getURL("").replace(/\/$/, "");

  if (window.top === window) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (
        sender.id !== chrome.runtime.id ||
        message?.type !== "ATLAS_TOP_LEVEL_TRANSFER"
      ) {
        return false;
      }

      void prepareTransfer({ text: message.payload?.text || "" })
        .then(sendResponse)
        .catch((error) => {
          sendResponse({
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            autoSent: false
          });
        });
      return true;
    });
  } else if (isDirectExtensionChild()) {
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent || event.origin !== EXTENSION_ORIGIN) {
        return;
      }

      const message = event.data;
      if (
        message?.source !== REQUEST_SOURCE ||
        !["ATLAS_COMPOSER_INSERT", "ATLAS_TRANSFER_PREPARE"].includes(message?.type) ||
        typeof message.requestId !== "string"
      ) {
        return;
      }

      void prepareTransfer(message.payload || {})
        .then((result) => respondToParent(event.origin, message.requestId, result))
        .catch((error) => {
          respondToParent(event.origin, message.requestId, {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            autoSent: false
          });
        });
    });

    announceEmbeddedReadiness();
  }

  function isDirectExtensionChild() {
    try {
      return location.ancestorOrigins?.[0] === EXTENSION_ORIGIN;
    } catch {
      return false;
    }
  }

  function announceEmbeddedReadiness() {
    const postReadiness = (composerReady) => {
      window.parent.postMessage(
        {
          source: RESPONSE_SOURCE,
          type: "ATLAS_BRIDGE_READY",
          composerReady
        },
        EXTENSION_ORIGIN
      );
    };

    if (findComposer()) {
      postReadiness(true);
      return;
    }

    postReadiness(false);
    if (typeof MutationObserver !== "function" || !document.documentElement) return;

    const observer = new MutationObserver(() => {
      if (!findComposer()) return;
      observer.disconnect();
      postReadiness(true);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function prepareTransfer(payload) {
    const rawText = payload.text;
    const attachmentPayloads = Array.isArray(payload.attachments)
      ? payload.attachments
      : [];

    let textResult = { ok: true, skipped: true };
    if (String(rawText || "").trim()) {
      try {
        textResult = await insertIntoComposer(rawText);
      } catch (error) {
        textResult = {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    const attachments = await attachFiles(attachmentPayloads);
    return {
      ok: textResult.ok && attachments.every((item) => item.ok),
      text: textResult,
      attachments,
      autoSent: false
    };
  }

  async function insertIntoComposer(rawText) {
    const text = String(rawText || "");
    if (!text.trim()) {
      throw new Error("没有可写入的文字。");
    }
    if (text.length > MAX_TEXT_LENGTH) {
      throw new Error("文字过长，请减少选中的素材。");
    }

    const composer = findComposer();
    if (!composer) {
      throw new Error("没有找到 ChatGPT 输入框。");
    }

    const existingText = readComposerText(composer);
    const insertion = `${existingText.trim() ? "\n\n" : ""}${text}`;
    let method;

    composer.focus();

    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      const prototype =
        composer instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(prototype, "value")?.set;
      if (!setter) throw new Error("无法更新 ChatGPT 输入框。");

      setter.call(composer, `${existingText}${insertion}`);
      composer.dispatchEvent(
        new InputEvent("input", {
          bubbles: true,
          inputType: "insertText",
          data: insertion
        })
      );
      method = "native-value";
    } else {
      placeCaretAtEnd(composer);
      const inserted = document.execCommand("insertText", false, insertion);

      if (inserted) {
        method = "exec-command";
      } else {
        throw new Error("ChatGPT 输入框拒绝了文字写入。");
      }
    }

    await nextPaint();

    const finalText = readComposerText(composer);
    const normalizedFinalText = normalizeText(finalText);
    const normalizedInsertedText = normalizeText(text);
    if (
      finalText.length <= existingText.length ||
      !normalizedFinalText.endsWith(normalizedInsertedText)
    ) {
      throw new Error("输入框没有确认写入结果。");
    }

    composer.focus();
    placeCaretAtEnd(composer);
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      composer.setSelectionRange(composer.value.length, composer.value.length);
    }

    return {
      ok: true,
      method,
      composerTextLength: finalText.length
    };
  }

  async function attachFiles(payloads) {
    if (payloads.length === 0) return [];
    const input = findFileInput();
    if (!input) {
      return payloads.map((payload) => ({
        stagingId: payload.stagingId,
        ok: false,
        error: "没有找到 ChatGPT 附件输入控件。"
      }));
    }

    let dataTransfer;
    try {
      dataTransfer = new DataTransfer();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return payloads.map((payload) => ({
        stagingId: payload.stagingId,
        ok: false,
        error: `当前页面不支持构造附件列表：${message}`
      }));
    }
    const validPayloads = [];
    const payloadErrors = new Map();
    for (const payload of payloads) {
      if (!(payload.bytes instanceof ArrayBuffer) || !payload.fileName) {
        payloadErrors.set(payload, "附件数据不可用。");
        continue;
      }
      try {
        const file = new File([payload.bytes], payload.fileName, {
          type: payload.mime || "application/octet-stream",
          lastModified: Date.now()
        });
        dataTransfer.items.add(file);
        validPayloads.push(payload);
      } catch (error) {
        payloadErrors.set(
          payload,
          error instanceof Error ? error.message : String(error)
        );
      }
    }

    if (validPayloads.length === 0) {
      return payloads.map((payload) => ({
        stagingId: payload.stagingId,
        ok: false,
        error: payloadErrors.get(payload) || "附件数据不可用。"
      }));
    }

    const fileNames = validPayloads.map((payload) => payload.fileName);
    const evidenceBaseline = countAttachmentEvidence(fileNames);
    try {
      input.files = dataTransfer.files;
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return payloads.map((payload) => ({
        stagingId: payload.stagingId,
        ok: false,
        error: payloadErrors.get(payload) || `附件输入控件拒绝了文件：${message}`
      }));
    }

    const visibleCounts = await waitForAttachmentCounts(
      fileNames,
      10_000,
      evidenceBaseline
    );
    const remainingEvidence = new Map(visibleCounts);

    return payloads.map((payload) => {
      const payloadError = payloadErrors.get(payload);
      if (payloadError) {
        return { stagingId: payload.stagingId, ok: false, error: payloadError };
      }
      const available = remainingEvidence.get(payload.fileName) || 0;
      const ok = available > 0;
      if (ok) remainingEvidence.set(payload.fileName, available - 1);
      return {
        stagingId: payload.stagingId,
        ok,
        method: ok ? "data-transfer" : undefined,
        error: ok ? undefined : "ChatGPT 没有显示这份附件的独立回执。"
      };
    });
  }

  function findComposer() {
    const selectors = [
      "#prompt-textarea",
      '[data-testid="prompt-textarea"]',
      'textarea[name="prompt-textarea"]',
      'textarea[placeholder*="Message"]',
      'textarea[placeholder*="Ask"]',
      '[contenteditable="true"][role="textbox"]'
    ];

    for (const selector of selectors) {
      const candidates = document.querySelectorAll(selector);
      for (const candidate of candidates) {
        if (isUsableComposer(candidate)) return candidate;
      }
    }

    return null;
  }

  function findFileInput() {
    const inputs = document.querySelectorAll('input[type="file"]');
    const composer = findComposer();
    const composerForm = composer?.closest?.("form") || null;
    let bestInput = null;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const input of inputs) {
      if (!(input instanceof HTMLInputElement) || input.disabled) continue;
      const accept = String(input.getAttribute("accept") || "").toLowerCase();
      const acceptsOnlyImages = /^image\/\*(?:\s*,\s*image\/\*)*$/.test(accept);
      let score = 0;
      if (!accept) score += 8;
      if (input.multiple) score += 3;
      if (/application\/|text\/|\.pdf|\.txt|\.md/.test(accept)) score += 6;
      if (acceptsOnlyImages) score -= 8;
      if (composerForm?.contains(input)) score += 5;
      if (score > bestScore) {
        bestInput = input;
        bestScore = score;
      }
    }
    return bestInput;
  }

  function isUsableComposer(element) {
    if (!(element instanceof HTMLElement)) return false;
    if (element.getAttribute("aria-disabled") === "true") return false;
    return element.getClientRects().length > 0;
  }

  function readComposerText(composer) {
    if (composer instanceof HTMLTextAreaElement || composer instanceof HTMLInputElement) {
      return composer.value;
    }
    return composer.innerText || composer.textContent || "";
  }

  function placeCaretAtEnd(element) {
    if (!element.isContentEditable) return;
    const selection = document.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    range.collapse(false);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function nextPaint() {
    return new Promise((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(resolve));
    });
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function waitForAttachmentCounts(fileNames, timeoutMs, evidenceBaseline) {
    const required = countValues(fileNames);
    return new Promise((resolve) => {
      const startedAt = Date.now();
      const check = () => {
        const evidence = countAttachmentEvidence(fileNames);
        const visible = new Map(
          Array.from(required, ([name]) => [
            name,
            Math.max(0, (evidence.get(name) || 0) - (evidenceBaseline.get(name) || 0))
          ])
        );
        const complete = Array.from(required).every(
          ([name, count]) => (visible.get(name) || 0) >= count
        );
        if (complete || Date.now() - startedAt >= timeoutMs) {
          resolve(visible);
          return;
        }
        setTimeout(check, 200);
      };
      check();
    });
  }

  function countAttachmentEvidence(fileNames) {
    const counts = new Map(fileNames.map((name) => [name, 0]));
    const evidenceNodes = new Map(fileNames.map((name) => [name, []]));
    const composer = findComposer();
    const candidates = document.querySelectorAll(
      [
        '[data-testid*="attachment" i]',
        '[data-testid*="file" i]',
        '[aria-label*="attachment" i]',
        '[aria-label*="file" i]',
        '[class*="attachment" i]',
        '[class*="file" i]',
        '[role="listitem"]',
        "button"
      ].join(",")
    );

    for (const candidate of candidates) {
      if (!(candidate instanceof HTMLElement)) continue;
      if (
        composer &&
        (candidate === composer || composer.contains(candidate) || candidate.contains(composer))
      ) {
        continue;
      }
      if (candidate.getClientRects().length === 0) continue;
      const evidenceText = normalizeText(
        `${candidate.innerText || candidate.textContent || ""} ${candidate.getAttribute("aria-label") || ""}`
      );
      if (!evidenceText || evidenceText.length > 500) continue;
      for (const fileName of fileNames) {
        const probe = normalizeText(fileName);
        if (probe && evidenceText.includes(probe)) {
          addDistinctEvidenceNode(evidenceNodes.get(fileName), candidate);
        }
      }
    }
    for (const [fileName, nodes] of evidenceNodes) counts.set(fileName, nodes.length);
    return counts;
  }

  function addDistinctEvidenceNode(nodes, candidate) {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const existing = nodes[index];
      if (existing === candidate) return;
      if (existing.contains(candidate)) {
        nodes.splice(index, 1);
        continue;
      }
      if (candidate.contains(existing)) return;
    }
    nodes.push(candidate);
  }

  function countValues(values) {
    const counts = new Map();
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
    return counts;
  }

  function respondToParent(targetOrigin, requestId, result) {
    window.parent.postMessage(
      {
        source: RESPONSE_SOURCE,
        type: "ATLAS_COMPOSER_RESULT",
        requestId,
        result
      },
      targetOrigin
    );
  }
})();
