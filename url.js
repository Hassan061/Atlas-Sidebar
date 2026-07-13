const ATLAS_URL_ERRORS = Object.freeze({
  "zh-CN": Object.freeze({
    empty: "请输入一个网址。",
    unsupportedProtocol: "侧边栏目前只支持 http:// 和 https:// 网页。",
    invalid: "网址格式不正确。",
    credentials: "网址中不能包含账号或密码。"
  }),
  en: Object.freeze({
    empty: "Enter a web address.",
    unsupportedProtocol: "The sidebar currently supports only http:// and https:// pages.",
    invalid: "The web address is invalid.",
    credentials: "Web addresses cannot contain a username or password."
  })
});

globalThis.AtlasUrl = Object.freeze({
  normalize(rawUrl) {
    const value = String(rawUrl || "").trim();
    if (!value) {
      throw urlError("empty");
    }

    if (
      /^[a-zA-Z][a-zA-Z\d+.-]*:(?!\d)/.test(value) &&
      !/^https?:\/\//i.test(value)
    ) {
      throw urlError("unsupportedProtocol");
    }

    const candidate = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    let url;
    try {
      url = new URL(candidate);
    } catch {
      throw urlError("invalid");
    }

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw urlError("unsupportedProtocol");
    }
    if (url.username || url.password) {
      throw urlError("credentials");
    }

    return url;
  },

  formatError(error, language = "zh-CN") {
    const locale = language === "zh-CN" ? "zh-CN" : "en";
    return ATLAS_URL_ERRORS[locale][error?.code] || (error instanceof Error ? error.message : String(error || ""));
  }
});

function urlError(code) {
  const error = new Error(ATLAS_URL_ERRORS["zh-CN"][code]);
  error.name = "AtlasUrlError";
  error.code = code;
  return error;
}
