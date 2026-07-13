globalThis.AtlasTranscript = Object.freeze({
  normalizeSegments(segments) {
    const candidates = [];
    for (const segment of Array.isArray(segments) ? segments : []) {
      const text = String(segment?.text || "")
        .replace(/\s+/g, " ")
        .trim();
      if (!text) continue;
      const start = Math.max(0, Number(segment.start) || 0);
      const duration = Math.max(0, Number(segment.duration) || 0);
      candidates.push({ start, duration, text });
    }
    candidates.sort(
      (left, right) =>
        left.start - right.start || left.duration - right.duration || left.text.localeCompare(right.text)
    );

    const normalized = [];
    for (const candidate of candidates) {
      const previous = normalized[normalized.length - 1];
      if (
        previous &&
        previous.text === candidate.text &&
        Math.abs(previous.start - candidate.start) < 1
      ) {
        continue;
      }
      normalized.push(candidate);
    }
    return normalized;
  },

  parseJson3(payload) {
    const events = Array.isArray(payload?.events) ? payload.events : [];
    return this.normalizeSegments(
      events.map((event) => ({
        start: (Number(event.tStartMs) || 0) / 1000,
        duration: (Number(event.dDurationMs) || 0) / 1000,
        text: (event.segs || []).map((segment) => segment.utf8 || "").join("")
      }))
    );
  },

  parseTimedTextXml(xml) {
    const source = String(xml || "");
    const segments = [];
    const textPattern = /<text\b([^>]*)>([\s\S]*?)<\/text>/gi;
    let match;
    while ((match = textPattern.exec(source))) {
      const attributes = parseXmlAttributes(match[1]);
      segments.push({
        start: Number(attributes.start) || 0,
        duration: Number(attributes.dur) || 0,
        text: decodeXmlText(match[2])
      });
    }

    if (segments.length === 0) {
      const paragraphPattern = /<p\b([^>]*)>([\s\S]*?)<\/p>/gi;
      while ((match = paragraphPattern.exec(source))) {
        const attributes = parseXmlAttributes(match[1]);
        const text = match[2]
          .replace(/<s\b[^>]*>/gi, "")
          .replace(/<\/s>/gi, "");
        segments.push({
          start: (Number(attributes.t) || 0) / 1000,
          duration: (Number(attributes.d) || 0) / 1000,
          text: decodeXmlText(text)
        });
      }
    }

    return this.normalizeSegments(segments);
  },

  parseInnertubeTranscript(payload) {
    const segments = [];
    walkJson(payload, (node) => {
      const renderer = node?.transcriptSegmentRenderer;
      if (!renderer) return;
      const start = (Number(renderer.startMs) || 0) / 1000;
      const end = (Number(renderer.endMs) || 0) / 1000;
      segments.push({
        start,
        duration: Math.max(0, end - start),
        text: readText(renderer.snippet)
      });
    });
    return this.normalizeSegments(segments);
  },

  getInnertubeLanguageChoices(payload) {
    const choices = [];
    const seen = new Set();
    walkJson(payload, (node) => {
      for (const item of Array.isArray(node?.subMenuItems) ? node.subMenuItems : []) {
        const title = readText(item.title);
        const continuation =
          item.continuation?.reloadContinuationData?.continuation ||
          item.serviceEndpoint?.getTranscriptEndpoint?.params ||
          item.navigationEndpoint?.getTranscriptEndpoint?.params ||
          "";
        if (!title || seen.has(`${title}:${continuation}`)) continue;
        seen.add(`${title}:${continuation}`);
        choices.push({ title, selected: Boolean(item.selected), continuation });
      }
    });
    return choices;
  },

  chooseTrack(tracks, preferredLanguage) {
    const available = Array.isArray(tracks) ? tracks : [];
    if (available.length === 0) return null;
    const preferred = String(preferredLanguage || "").toLowerCase();
    const preferredBase = preferred.split("-")[0];
    const exactManual = available.find(
      (track) => track.languageCode?.toLowerCase() === preferred && track.kind !== "asr"
    );
    const exact = available.find(
      (track) => track.languageCode?.toLowerCase() === preferred
    );
    const baseManual = available.find(
      (track) =>
        preferredBase &&
        track.languageCode?.toLowerCase().split("-")[0] === preferredBase &&
        track.kind !== "asr"
    );
    const base = available.find(
      (track) =>
        preferredBase && track.languageCode?.toLowerCase().split("-")[0] === preferredBase
    );
    return (
      available.find((track) => track.id?.toLowerCase() === preferred) ||
      exactManual ||
      exact ||
      baseManual ||
      base ||
      available.find((track) => track.kind !== "asr") ||
      available[0]
    );
  },

  toTimestampedText(segments) {
    return this.normalizeSegments(segments)
      .map((segment) => `[${formatClock(segment.start)}] ${segment.text}`)
      .join("\n");
  },

  toVtt(segments) {
    const normalized = this.normalizeSegments(segments);
    const cues = normalized.map((segment, index) => {
      const start = segment.start;
      const nextStart = normalized[index + 1]?.start;
      const end = Math.max(
        start + 0.5,
        segment.duration ? start + segment.duration : nextStart || start + 3
      );
      return `${index + 1}\n${formatVttTime(start)} --> ${formatVttTime(end)}\n${segment.text}`;
    });
    return `WEBVTT\n\n${cues.join("\n\n")}\n`;
  }
});

function walkJson(value, visit) {
  if (!value || typeof value !== "object") return;
  visit(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) {
      child.forEach((entry) => walkJson(entry, visit));
    } else if (child && typeof child === "object") {
      walkJson(child, visit);
    }
  }
}

function readText(value) {
  if (typeof value === "string") return value;
  if (typeof value?.simpleText === "string") return value.simpleText;
  return Array.isArray(value?.runs)
    ? value.runs.map((run) => run?.text || "").join("")
    : "";
}

function parseXmlAttributes(source) {
  const attributes = {};
  const pattern = /([\w:-]+)\s*=\s*(["'])(.*?)\2/g;
  let match;
  while ((match = pattern.exec(source))) attributes[match[1]] = match[3];
  return attributes;
}

function decodeXmlText(source) {
  return String(source || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#x([0-9a-f]+);/gi, (_match, value) =>
      String.fromCodePoint(Number.parseInt(value, 16))
    )
    .replace(/&#(\d+);/g, (_match, value) =>
      String.fromCodePoint(Number.parseInt(value, 10))
    )
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function formatClock(totalSeconds) {
  const value = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const seconds = value % 60;
  return hours
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function formatVttTime(totalSeconds) {
  const milliseconds = Math.max(0, Math.round(totalSeconds * 1000));
  const hours = Math.floor(milliseconds / 3_600_000);
  const minutes = Math.floor((milliseconds % 3_600_000) / 60_000);
  const seconds = Math.floor((milliseconds % 60_000) / 1000);
  const remainder = milliseconds % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(remainder).padStart(3, "0")}`;
}
