(function installAtlasPrompts(global) {
  const STORAGE_KEY = "atlasSavedPrompts";
  const FORMAT = "atlas-sidebar-prompts";
  const VERSION = 1;
  const MAX_PROMPTS = 200;
  const MAX_NAME_LENGTH = 100;
  const MAX_TEXT_LENGTH = 20_000;
  const MAX_TOTAL_TEXT_LENGTH = 2_000_000;
  const MAX_TAGS = 10;
  const MAX_TAG_LENGTH = 40;
  const VARIABLE_PATTERN_SOURCE = String.raw`(?<!\{)\{([\p{L}_][\p{L}\p{N}_ .-]{0,49})\}(?!\})`;
  const ERROR_COPY = Object.freeze({
    "zh-CN": Object.freeze({
      required: "提示词名称和正文不能为空。",
      nameTooLong: ({ max = MAX_NAME_LENGTH }) => `提示词名称不能超过 ${max} 个字符。`,
      textTooLong: ({ max = MAX_TEXT_LENGTH }) => `提示词正文不能超过 ${max} 个字符。`,
      tooManyPrompts: ({ max = MAX_PROMPTS }) => `最多保存 ${max} 个提示词。`,
      totalTextTooLong: "提示词库正文总长度超过本地存储预算。",
      invalidJson: "导入文件不是有效的 JSON。",
      unsupportedFile: "这不是受支持的 Atlas Sidebar 提示词文件。",
      importTooMany: ({ max = MAX_PROMPTS }) => `导入文件超过 ${max} 个提示词。`,
      stageRejected: "后台拒绝了这条提示词，请重新保存模板后再试。",
      backgroundUnavailable: "扩展后台没有响应。请在 chrome://extensions 中 Reload Atlas Sidebar 后重试。",
      stagingNotPersisted: "提示词没有写入临时素材。请 Reload 扩展后重试。"
    }),
    en: Object.freeze({
      required: "Prompt name and text are required.",
      nameTooLong: ({ max = MAX_NAME_LENGTH }) => `Prompt names cannot exceed ${max} characters.`,
      textTooLong: ({ max = MAX_TEXT_LENGTH }) => `Prompt text cannot exceed ${max} characters.`,
      tooManyPrompts: ({ max = MAX_PROMPTS }) => `You can save up to ${max} prompts.`,
      totalTextTooLong: "The prompt library exceeds its local storage budget.",
      invalidJson: "The import file is not valid JSON.",
      unsupportedFile: "This is not a supported Atlas Sidebar prompt file.",
      importTooMany: ({ max = MAX_PROMPTS }) => `The import file contains more than ${max} prompts.`,
      stageRejected: "The extension rejected this prompt. Save the template again and retry.",
      backgroundUnavailable: "The extension background did not respond. Reload Atlas Sidebar in chrome://extensions and retry.",
      stagingNotPersisted: "The prompt was not written to temporary materials. Reload the extension and retry."
    })
  });

  function normalizeLibrary(value) {
    const source = Array.isArray(value)
      ? value
      : Array.isArray(value?.prompts)
        ? value.prompts
        : [];
    const prompts = [];
    const ids = new Set();
    let totalTextLength = 0;
    for (const candidate of source.slice(0, MAX_PROMPTS)) {
      const prompt = normalizePrompt(candidate, { strict: false });
      if (!prompt || ids.has(prompt.id)) continue;
      if (totalTextLength + prompt.text.length > MAX_TOTAL_TEXT_LENGTH) continue;
      ids.add(prompt.id);
      prompts.push(prompt);
      totalTextLength += prompt.text.length;
    }
    prompts.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    return { version: VERSION, prompts };
  }

  function normalizePrompt(value, { strict = true, idFactory = makeId } = {}) {
    const source = value && typeof value === "object" ? value : {};
    const name = String(source.name || "").trim().slice(0, MAX_NAME_LENGTH);
    const text = normalizeText(source.text).slice(0, MAX_TEXT_LENGTH);
    if (!name || !text) {
      if (strict) throw promptError("required");
      return null;
    }
    if (strict && String(source.name || "").trim().length > MAX_NAME_LENGTH) {
      throw promptError("nameTooLong", { max: MAX_NAME_LENGTH });
    }
    if (strict && normalizeText(source.text).length > MAX_TEXT_LENGTH) {
      throw promptError("textTooLong", { max: MAX_TEXT_LENGTH });
    }
    const id = /^[a-z0-9_-]{1,100}$/i.test(String(source.id || ""))
      ? String(source.id)
      : idFactory();
    const now = new Date().toISOString();
    const createdAt = validIso(source.createdAt) || now;
    const updatedAt = validIso(source.updatedAt) || now;
    return {
      id,
      name,
      text,
      tags: normalizeTags(source.tags),
      createdAt,
      updatedAt
    };
  }

  function normalizeTags(value) {
    const candidates = Array.isArray(value)
      ? value
      : String(value || "").split(/[,，]/);
    const seen = new Set();
    const tags = [];
    for (const candidate of candidates) {
      const tag = String(candidate || "").trim().slice(0, MAX_TAG_LENGTH);
      const key = tag.toLocaleLowerCase();
      if (!tag || seen.has(key)) continue;
      seen.add(key);
      tags.push(tag);
      if (tags.length >= MAX_TAGS) break;
    }
    return tags;
  }

  function extractVariables(text) {
    const variables = [];
    const seen = new Set();
    const pattern = variablePattern();
    let match;
    while ((match = pattern.exec(String(text || "")))) {
      const name = match[1].trim();
      const key = name.toLocaleLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      variables.push(name);
    }
    return variables;
  }

  function render(prompt, values = {}) {
    const normalized = normalizePrompt(prompt);
    const variables = extractVariables(normalized.text);
    const supplied = new Map(
      Object.entries(values && typeof values === "object" ? values : {}).map(([name, value]) => [
        String(name).trim().toLocaleLowerCase(),
        String(value ?? "").trim()
      ])
    );
    const resolved = Object.fromEntries(
      variables.map((name) => [name, supplied.get(name.toLocaleLowerCase()) || ""])
    );
    const lookup = new Map(
      Object.entries(resolved)
        .filter(([, value]) => value)
        .map(([name, value]) => [name.toLocaleLowerCase(), value])
    );
    const text = normalized.text.replace(variablePattern(), (token, rawName) => {
      const value = lookup.get(String(rawName).trim().toLocaleLowerCase());
      return value === undefined ? token : value;
    });
    return { text, variables: resolved };
  }

  function variablePattern() {
    return new RegExp(VARIABLE_PATTERN_SOURCE, "gu");
  }

  function upsert(library, value, options = {}) {
    const normalizedLibrary = normalizeLibrary(library);
    const prompt = normalizePrompt(value, options);
    const existing = normalizedLibrary.prompts.find((item) => item.id === prompt.id);
    const updated = {
      ...prompt,
      createdAt: existing?.createdAt || prompt.createdAt,
      updatedAt: new Date().toISOString()
    };
    const prompts = [updated, ...normalizedLibrary.prompts.filter((item) => item.id !== updated.id)];
    if (prompts.length > MAX_PROMPTS) {
      throw promptError("tooManyPrompts", { max: MAX_PROMPTS });
    }
    if (prompts.reduce((total, item) => total + item.text.length, 0) > MAX_TOTAL_TEXT_LENGTH) {
      throw promptError("totalTextTooLong");
    }
    return { version: VERSION, prompts };
  }

  function remove(library, id) {
    const normalized = normalizeLibrary(library);
    return { version: VERSION, prompts: normalized.prompts.filter((prompt) => prompt.id !== id) };
  }

  function exportJson(library) {
    const normalized = normalizeLibrary(library);
    return `${JSON.stringify({
      format: FORMAT,
      version: VERSION,
      exportedAt: new Date().toISOString(),
      prompts: normalized.prompts
    }, null, 2)}\n`;
  }

  function importJson(raw, existingLibrary, options = {}) {
    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw promptError("invalidJson");
    }
    if (parsed?.format !== FORMAT || parsed?.version !== VERSION || !Array.isArray(parsed.prompts)) {
      throw promptError("unsupportedFile");
    }
    if (parsed.prompts.length > MAX_PROMPTS) {
      throw promptError("importTooMany", { max: MAX_PROMPTS });
    }
    let merged = normalizeLibrary(existingLibrary);
    let imported = 0;
    for (const candidate of parsed.prompts) {
      const prompt = normalizePrompt(candidate, { strict: true, idFactory: options.idFactory || makeId });
      merged = upsert(merged, prompt, { strict: true, idFactory: options.idFactory || makeId });
      imported += 1;
    }
    return { library: merged, imported };
  }

  async function load(storageArea = global.chrome?.storage?.local) {
    if (!storageArea?.get) return normalizeLibrary();
    const stored = await storageArea.get(STORAGE_KEY);
    return normalizeLibrary(stored?.[STORAGE_KEY]);
  }

  async function save(library, storageArea = global.chrome?.storage?.local) {
    const normalized = normalizeLibrary(library);
    if (storageArea?.set) await storageArea.set({ [STORAGE_KEY]: normalized });
    return normalized;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\r\n?/g, "\n").normalize("NFC").trim();
  }

  function validIso(value) {
    const date = new Date(value || "");
    return Number.isNaN(date.getTime()) ? "" : date.toISOString();
  }

  function makeId() {
    return global.crypto?.randomUUID?.() || `prompt-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function stageWithReadback(
    value,
    {
      sendMessage,
      readItems,
      beforeIds = [],
      requestId = makeId(),
      attempts = 2,
      retryDelay = () => new Promise((resolve) => setTimeout(resolve, 80))
    } = {}
  ) {
    if (typeof sendMessage !== "function" || typeof readItems !== "function") {
      throw promptError("backgroundUnavailable");
    }
    const normalized = normalizePrompt({
      id: value?.promptId,
      name: value?.name,
      text: value?.text
    });
    const knownIds = new Set(Array.from(beforeIds, String));
    let receivedResponse = false;
    let lastError = null;

    for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
      let result;
      try {
        result = await sendMessage({
          type: "ATLAS_STAGE_PROMPT",
          requestId,
          prompt: {
            promptId: normalized.id,
            name: normalized.name,
            text: normalized.text,
            variables:
              value?.variables && typeof value.variables === "object"
                ? value.variables
                : {}
          }
        });
        receivedResponse ||= result !== undefined;
      } catch (error) {
        lastError = error;
      }

      const items = await readItems().catch(() => []);
      const staged = (Array.isArray(items) ? items : []).find((item) =>
        item?.kind === "prompt" &&
        (
          item.id === requestId ||
          item.promptRequestId === requestId ||
          (
            !knownIds.has(String(item.id)) &&
            item.promptId === normalized.id &&
            item.text === normalized.text
          )
        )
      );
      if (staged) return staged;

      if (result && result.ok === false) {
        const error = promptError(result.code || "stageRejected", result.details || {});
        if (result.error && !ERROR_COPY["zh-CN"][error.code]) error.message = result.error;
        throw error;
      }
      if (attempt + 1 < attempts) await retryDelay();
    }

    if (!receivedResponse || lastError) throw promptError("backgroundUnavailable");
    throw promptError("stagingNotPersisted");
  }

  function promptError(code, details = {}) {
    const error = new Error(formatError({ code, details }, "zh-CN"));
    error.name = "AtlasPromptError";
    error.code = code;
    error.details = details;
    return error;
  }

  function formatError(error, language = "zh-CN") {
    const locale = language === "zh-CN" ? "zh-CN" : "en";
    const template = ERROR_COPY[locale][error?.code];
    if (typeof template === "function") return template(error?.details || {});
    if (typeof template === "string") return template;
    return error instanceof Error ? error.message : String(error || "");
  }

  global.AtlasPrompts = Object.freeze({
    STORAGE_KEY,
    FORMAT,
    VERSION,
    MAX_PROMPTS,
    MAX_NAME_LENGTH,
    MAX_TEXT_LENGTH,
    MAX_TOTAL_TEXT_LENGTH,
    MAX_TAGS,
    MAX_TAG_LENGTH,
    ERROR_COPY,
    normalizeLibrary,
    normalizePrompt,
    normalizeTags,
    extractVariables,
    render,
    upsert,
    remove,
    exportJson,
    importJson,
    formatError,
    stageWithReadback,
    load,
    save
  });
})(globalThis);
