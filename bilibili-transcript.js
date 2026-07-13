(function installAtlasBilibiliTranscript(global) {
  const VIDEO_HOSTS = new Set(["bilibili.com", "www.bilibili.com"]);
  const ENCODED_SUBTITLE_HOST = "subtitle.bilibili.com";
  const SUBTITLE_URL_DECODERS = [
    [
      'nP](wOFRvU.+<fjS{jn-!$D|Dz&",zT`',
      '=CFxYRn{.y|uVyO$uh&sikph?N.ilF/`'
    ],
    [
      'Bn"q~|albg@]Go~ACgyDvKnd+)_D}^&J?',
      "Cu~L!xs~f^&r@'vh=q]q{eeng*sEg^kp#J"
    ]
  ];
  const utf8 = new TextDecoder();

  function isVideoUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (!VIDEO_HOSTS.has(url.hostname)) return false;
      return /^\/video\/(?:BV[0-9A-Za-z]{10}|av\d+)/i.test(url.pathname) ||
        /^\/bangumi\/play\/(?:ep|ss)\d+/i.test(url.pathname);
    } catch {
      return false;
    }
  }

  function parseReference(rawUrl) {
    try {
      const url = new URL(rawUrl);
      if (!VIDEO_HOSTS.has(url.hostname)) return null;
      const video = url.pathname.match(/^\/video\/(BV[0-9A-Za-z]{10}|av(\d+))/i);
      const bangumi = url.pathname.match(/^\/bangumi\/play\/(ep|ss)(\d+)/i);
      if (!video && !bangumi) return null;
      return {
        bvid: video?.[1]?.toUpperCase().startsWith("BV") ? video[1] : "",
        aid: video?.[2] ? Number(video[2]) : 0,
        page: Math.max(1, Number(url.searchParams.get("p")) || 1),
        episodeType: bangumi?.[1] || "",
        episodeId: bangumi?.[2] ? Number(bangumi[2]) : 0
      };
    } catch {
      return null;
    }
  }

  function normalizeTracks(rawTracks) {
    return (Array.isArray(rawTracks) ? rawTracks : [])
      .map((track, index) => {
        const subtitleUrl = normalizeSubtitleUrl(
          decodeSubtitleUrl(track?.subtitle_url || track?.subtitleUrl)
        );
        const languageCode = String(track?.lan || track?.languageCode || "und");
        const identifier = String(track?.id_str || track?.id || `${languageCode}-${index}`);
        return {
          id: `bilibili:${identifier}`,
          baseUrl: subtitleUrl,
          subtitleUrl,
          languageCode,
          name: String(
            track?.lan_doc || track?.lanDoc || track?.lan_doc_brief || track?.lanDocBrief ||
              track?.name || languageCode
          ),
          kind: inferTrackKind(track, subtitleUrl),
          provider: "bilibili",
          aiType: finiteNumber(track?.ai_type ?? track?.aiType),
          aiStatus: finiteNumber(track?.ai_status ?? track?.aiStatus),
          role: finiteNumber(track?.role),
          source: String(track?.source || "player-v2")
        };
      })
      .filter((track) => track.subtitleUrl);
  }

  function inferTrackKind(track, subtitleUrl) {
    const language = String(track?.lan || track?.languageCode || "").toLowerCase();
    if (
      language.startsWith("ai-") ||
      Number(track?.type) === 1 ||
      Number(track?.ai_type ?? track?.aiType) > 0 ||
      /(^|\.)aisubtitle\.hdslb\.com$/i.test(safeHostname(subtitleUrl))
    ) return "ai";
    if (track && ("ai_type" in track || "author_mid" in track || "is_lock" in track)) {
      return "provided";
    }
    return "unknown";
  }

  function classifyCapability(result) {
    const tracks = normalizeTracks(result?.tracks);
    if (tracks.length > 0) return { state: "available", tracks };
    if (result?.httpStatus === 412 || result?.blocked) return { state: "blocked", tracks: [] };
    if (result?.needLogin || Number(result?.code) === -101) {
      return { state: "login-required", tracks: [] };
    }
    if (result?.restricted) return { state: "unavailable", tracks: [] };
    if (Array.isArray(result?.tracks) && result.tracks.length > 0) {
      return { state: "unknown", tracks: [] };
    }
    if (result?.ok === true && result?.tracksKnown === true) {
      return { state: "none", tracks: [] };
    }
    return { state: "unknown", tracks: [] };
  }

  function chooseTrack(tracks, preferredLanguage) {
    const available = Array.isArray(tracks) ? tracks : [];
    if (!available.length) return null;
    const preferred = String(preferredLanguage || "").toLowerCase();
    const preferredBase = preferred.split("-")[0];
    const rankKind = (track) => track.kind === "provided" ? 0 : track.kind === "unknown" ? 1 : 2;
    const ranked = available.slice().sort((left, right) => rankKind(left) - rankKind(right));
    return (
      available.find((track) => track.id?.toLowerCase() === preferred) ||
      ranked.find((track) => track.languageCode?.toLowerCase() === preferred) ||
      ranked.find((track) =>
        preferredBase && track.languageCode?.toLowerCase().split("-")[0] === preferredBase
      ) ||
      ranked[0]
    );
  }

  function parseSubtitlePayload(payload) {
    return global.AtlasTranscript.normalizeSegments(
      (Array.isArray(payload?.body) ? payload.body : []).map((entry) => {
        const start = Math.max(0, Number(entry?.from) || 0);
        const end = Math.max(start, Number(entry?.to) || start);
        return {
          start,
          duration: end - start,
          text: String(entry?.content || "")
        };
      })
    );
  }

  function decodeSubtitleView(input) {
    const reader = new ProtoReader(input);
    let videoSubtitle = null;
    while (!reader.done) {
      const { field, wire } = reader.readTag();
      if (field === 1 && wire === 2) {
        videoSubtitle = decodeVideoSubtitle(reader.readBytes());
      } else {
        reader.skip(wire);
      }
    }
    return videoSubtitle || { lan: "", lan_doc: "", tracks: [] };
  }

  function decodeVideoSubtitle(input) {
    const reader = new ProtoReader(input);
    const result = { lan: "", lan_doc: "", tracks: [] };
    while (!reader.done) {
      const { field, wire } = reader.readTag();
      if (wire === 2 && field === 1) result.lan = reader.readString();
      else if (wire === 2 && field === 2) result.lan_doc = reader.readString();
      else if (wire === 2 && field === 3) result.tracks.push(decodeSubtitleItem(reader.readBytes()));
      else reader.skip(wire);
    }
    return result;
  }

  function decodeSubtitleItem(input) {
    const reader = new ProtoReader(input);
    const result = { source: "subtitle-web-view" };
    while (!reader.done) {
      const { field, wire } = reader.readTag();
      if (wire === 0 && field === 1) result.id = reader.readVarint().toString();
      else if (wire === 2 && field === 2) result.id_str = reader.readString();
      else if (wire === 2 && field === 3) result.lan = reader.readString();
      else if (wire === 2 && field === 4) result.lan_doc = reader.readString();
      else if (wire === 2 && field === 5) result.subtitle_url = decodeSubtitleUrl(reader.readString());
      else if (wire === 0 && field === 7) result.type = Number(reader.readVarint());
      else if (wire === 2 && field === 8) result.lan_doc_brief = reader.readString();
      else if (wire === 0 && field === 9) result.ai_type = Number(reader.readVarint());
      else if (wire === 0 && field === 10) result.ai_status = Number(reader.readVarint());
      else if (wire === 0 && field === 11) result.role = Number(reader.readVarint());
      else reader.skip(wire);
    }
    return result;
  }

  function decodeSubtitleUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    let url;
    try {
      url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
    } catch {
      return raw;
    }
    if (url.hostname !== ENCODED_SUBTITLE_HOST) return raw;
    let encodedPath;
    try {
      encodedPath = decodeURIComponent(url.pathname.slice(1));
    } catch {
      return "";
    }
    for (const [prefix, key] of SUBTITLE_URL_DECODERS) {
      const cipher = `${key}bilibili`;
      let decoded = "";
      for (let index = 0; index < encodedPath.length; index += 1) {
        decoded += String.fromCharCode(
          encodedPath.charCodeAt(index) ^ cipher.charCodeAt(index % cipher.length)
        );
      }
      if (!decoded.startsWith(prefix)) continue;
      const path = decoded.slice(prefix.length);
      if (!path.startsWith("/")) return "";
      return `https://aisubtitle.hdslb.com${path}${url.search}`;
    }
    return "";
  }

  class ProtoReader {
    constructor(input) {
      if (input instanceof Uint8Array) this.bytes = input;
      else if (input instanceof ArrayBuffer) this.bytes = new Uint8Array(input);
      else if (ArrayBuffer.isView(input)) {
        this.bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      } else this.bytes = Uint8Array.from(Array.isArray(input) ? input : []);
      this.offset = 0;
    }

    get done() {
      return this.offset >= this.bytes.length;
    }

    readTag() {
      const tag = Number(this.readVarint());
      if (!tag) throw new Error("B 站字幕 protobuf tag 无效。");
      return { field: tag >>> 3, wire: tag & 7 };
    }

    readVarint() {
      let value = 0n;
      let shift = 0n;
      while (this.offset < this.bytes.length && shift <= 70n) {
        const byte = this.bytes[this.offset++];
        value |= BigInt(byte & 0x7f) << shift;
        if ((byte & 0x80) === 0) return value;
        shift += 7n;
      }
      throw new Error("B 站字幕 protobuf varint 不完整。");
    }

    readBytes() {
      const length = Number(this.readVarint());
      if (!Number.isSafeInteger(length) || length < 0 || this.offset + length > this.bytes.length) {
        throw new Error("B 站字幕 protobuf 长度无效。");
      }
      const value = this.bytes.subarray(this.offset, this.offset + length);
      this.offset += length;
      return value;
    }

    readString() {
      return utf8.decode(this.readBytes());
    }

    skip(wire) {
      if (wire === 0) this.readVarint();
      else if (wire === 1) this.advance(8);
      else if (wire === 2) this.readBytes();
      else if (wire === 5) this.advance(4);
      else throw new Error(`不支持的 B 站字幕 protobuf wire type：${wire}`);
    }

    advance(length) {
      if (this.offset + length > this.bytes.length) {
        throw new Error("B 站字幕 protobuf 数据不完整。");
      }
      this.offset += length;
    }
  }

  function finiteNumber(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function normalizeSubtitleUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    try {
      const url = new URL(raw.startsWith("//") ? `https:${raw}` : raw);
      if (
        url.protocol !== "https:" ||
        url.username ||
        url.password ||
        !(url.hostname === "hdslb.com" || url.hostname.endsWith(".hdslb.com"))
      ) return "";
      return url.href;
    } catch {
      return "";
    }
  }

  function safeHostname(rawUrl) {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return "";
    }
  }

  global.AtlasBilibiliTranscript = Object.freeze({
    isVideoUrl,
    parseReference,
    normalizeTracks,
    classifyCapability,
    chooseTrack,
    parseSubtitlePayload,
    decodeSubtitleView,
    decodeSubtitleUrl
  });
})(globalThis);
