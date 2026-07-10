(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) {
    root.CitationCore = api;
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  const MONTHS = {
    jan: "January", january: "January", feb: "February", february: "February",
    mar: "March", march: "March", apr: "April", april: "April", may: "May",
    jun: "June", june: "June", jul: "July", july: "July", aug: "August", august: "August",
    sep: "September", sept: "September", september: "September", oct: "October", october: "October",
    nov: "November", november: "November", dec: "December", december: "December"
  };

  const RIS_TYPES = {
    JOUR: "article", JFULL: "article", MGZN: "article", NEWS: "article",
    BOOK: "book", EBOOK: "book", CHAP: "chapter", ECHAP: "chapter",
    CONF: "conference", CPAPER: "conference", THES: "thesis",
    RPRT: "report", ELEC: "web", WEB: "web", BLOG: "web",
    DATA: "dataset", UNPB: "unpublished", GEN: "misc"
  };

  const BIB_TYPES = {
    article: "article", book: "book", booklet: "book", inbook: "chapter",
    incollection: "chapter", inproceedings: "conference", conference: "conference",
    proceedings: "conference", phdthesis: "thesis", mastersthesis: "thesis",
    thesis: "thesis", techreport: "report", report: "report", manual: "report",
    online: "web", electronic: "web", webpage: "web", www: "web",
    dataset: "dataset", unpublished: "unpublished", misc: "misc"
  };

  const STYLE_REGISTRY = Object.freeze({
    apa7: Object.freeze({ id: "apa7", label: "APA 7th edition", available: true, guideUrl: "https://apastyle.apa.org/" }),
    harvard: Object.freeze({ id: "harvard", label: "Harvard — UNSW", available: true, guideUrl: "https://www.unsw.edu.au/student/managing-your-studies/academic-skills-support/toolkit/referencing/harvard" })
  });

  function clean(value) {
    return String(value == null ? "" : value).replace(/\uFEFF/g, "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function smartQuotes(value) {
    let text = String(value == null ? "" : value);
    const urls = [];
    text = text.replace(/\b(?:https?|ftp):\/\/[^\s<>]+/gi, (url) => {
      const token = `ZZURL${urls.length}ZZ`;
      urls.push(url);
      return token;
    });
    text = text.replace(/"/g, (_, offset, whole) => {
      const previous = whole[offset - 1] || "";
      return !previous || /[\s([{\u2014\u2013]/.test(previous) ? "\u201c" : "\u201d";
    });
    text = text.replace(/'/g, (_, offset, whole) => {
      const previous = whole[offset - 1] || "";
      const next = whole[offset + 1] || "";
      if (/[\p{L}\p{N}]/u.test(previous) && /[\p{L}\p{N}]/u.test(next)) return "\u2019";
      return !previous || /[\s([{\u2014\u2013]/.test(previous) ? "\u2018" : "\u2019";
    });
    return text.replace(/ZZURL(\d+)ZZ/g, (_, index) => urls[Number(index)] || "");
  }

  function smartHtmlText(value) {
    return String(value == null ? "" : value).split(/(<[^>]+>)/g).map((part) => {
      if (part.startsWith("<")) return part;
      return smartQuotes(part.replace(/&#39;/g, "'").replace(/&quot;/g, '"'));
    }).join("");
  }

  function finalizeCitation(citation) {
    return Object.assign({}, citation, {
      text: smartQuotes(citation.text),
      html: smartHtmlText(citation.html)
    });
  }

  function stripOuterBraces(value) {
    let text = clean(value);
    while (text.startsWith("{") && text.endsWith("}")) {
      let depth = 0, balanced = true;
      for (let i = 0; i < text.length; i += 1) {
        if (text[i] === "{") depth += 1;
        if (text[i] === "}") depth -= 1;
        if (depth === 0 && i < text.length - 1) { balanced = false; break; }
      }
      if (!balanced) break;
      text = text.slice(1, -1).trim();
    }
    return text;
  }

  function decodeLatex(value) {
    let text = String(value == null ? "" : value);
    const direct = {
      "\\ae": "æ", "\\AE": "Æ", "\\oe": "œ", "\\OE": "Œ", "\\aa": "å", "\\AA": "Å",
      "\\o": "ø", "\\O": "Ø", "\\l": "ł", "\\L": "Ł", "\\ss": "ß", "\\i": "ı",
      "\\textendash": "–", "\\textemdash": "—", "\\&": "&", "\\%": "%", "\\_": "_",
      "\\#": "#", "\\$": "$", "\\textbackslash": "\\", "~": " "
    };
    Object.keys(direct).sort((a, b) => b.length - a.length).forEach((key) => {
      text = text.split(key).join(direct[key]);
    });
    const accents = {
      "'": "\u0301", "`": "\u0300", "^": "\u0302", "\"": "\u0308", "~": "\u0303",
      "=": "\u0304", ".": "\u0307", "u": "\u0306", "v": "\u030C", "H": "\u030B",
      "c": "\u0327", "k": "\u0328", "r": "\u030A", "b": "\u0331", "d": "\u0323"
    };
    text = text.replace(/\\(['`^\"~=\.uvHckrbd])\s*\{?([A-Za-z])\}?/g, (_, mark, letter) => letter + accents[mark]);
    text = text.replace(/\{\\(['`^\"~=\.uvHckrbd])\s*([A-Za-z])\}/g, (_, mark, letter) => letter + accents[mark]);
    text = text.normalize("NFC");
    text = text.replace(/\\(?:emph|textit|textbf|textrm|textsc|url)\s*\{([^{}]*)\}/g, "$1");
    text = text.replace(/\\[a-zA-Z]+\*?\s*/g, "");
    text = text.replace(/\{([^{}]*)\}/g, "$1").replace(/[{}]/g, "");
    return clean(text.replace(/---/g, "—").replace(/--/g, "–"));
  }

  function protectCaseGroups(value) {
    const protectedValues = [];
    let output = "", depth = 0, start = -1;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (char === "{" && (i === 0 || text[i - 1] !== "\\")) {
        if (depth === 0) start = i;
        depth += 1;
        continue;
      }
      if (char === "}" && depth > 0 && text[i - 1] !== "\\") {
        depth -= 1;
        if (depth === 0) {
          const inside = text.slice(start + 1, i);
          if (inside && !/^\\[\"'`^~=.uvHckrbd]/.test(inside)) {
            const token = `ZZPROTECTED${protectedValues.length}ZZ`;
            protectedValues.push(decodeLatex(inside));
            output += token;
          } else {
            output += text.slice(start, i + 1);
          }
        }
        continue;
      }
      if (depth === 0) output += char;
    }
    if (depth > 0) output += text.slice(start);
    return { text: output, protectedValues };
  }

  function sentenceCase(value) {
    if (!clean(value)) return "";
    const protectedCase = protectCaseGroups(value);
    let text = decodeLatex(protectedCase.text);
    let capitalizeNext = true;
    text = text.replace(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’\-]*/gu, (word, offset, whole) => {
      const token = /^ZZPROTECTED(\d+)ZZ$/.exec(word);
      if (token) {
        capitalizeNext = false;
        return protectedCase.protectedValues[Number(token[1])] || "";
      }
      const mixedCase = /[a-z][A-Z]|[A-Z][a-z]+[A-Z]/.test(word);
      const knownAcronym = /^(AI|APA|DNA|RNA|HIV|AIDS|COVID|NASA|NATO|UN|EU|UK|USA|WHO|PDF|URL|DOI|STEM)$/i.test(word);
      let result;
      if (mixedCase || knownAcronym) {
        result = knownAcronym ? word.toUpperCase() : word;
      } else {
        result = word.toLocaleLowerCase();
        if (capitalizeNext) result = result.charAt(0).toLocaleUpperCase() + result.slice(1);
      }
      const rest = whole.slice(offset + word.length);
      const punctuation = rest.match(/^\s*([:!?])/);
      capitalizeNext = Boolean(punctuation);
      return result;
    });
    return clean(text);
  }

  function titleCaseContainer(value) {
    const decoded = decodeLatex(value);
    if (!decoded || /[A-Z].*[A-Z]/.test(decoded)) return decoded;
    const minor = /^(a|an|and|as|at|but|by|for|from|in|nor|of|on|or|the|to|via|with)$/i;
    let majorNext = true;
    return decoded.replace(/[\p{L}\p{N}][\p{L}\p{M}\p{N}'’\-]*/gu, (word, offset, whole) => {
      const result = !majorNext && minor.test(word)
        ? word.toLocaleLowerCase()
        : word.charAt(0).toLocaleUpperCase() + word.slice(1).toLocaleLowerCase();
      majorNext = /^\s*[:–—]/.test(whole.slice(offset + word.length));
      return result;
    });
  }

  function splitTopLevel(value, separatorWord) {
    const output = [];
    let depth = 0, quoted = false, escaped = false, start = 0;
    const text = String(value || "");
    for (let i = 0; i < text.length; i += 1) {
      const char = text[i];
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === '"') quoted = !quoted;
      if (!quoted && char === "{") depth += 1;
      if (!quoted && char === "}") depth = Math.max(0, depth - 1);
      if (depth === 0 && !quoted) {
        const candidate = text.slice(i, i + separatorWord.length);
        if (candidate.toLowerCase() === separatorWord.toLowerCase()) {
          output.push(text.slice(start, i).trim());
          start = i + separatorWord.length;
          i = start - 1;
        }
      }
    }
    output.push(text.slice(start).trim());
    return output.filter(Boolean);
  }

  function isGroupName(raw) {
    const text = clean(raw);
    if (/^\{.*\}$/.test(text)) return true;
    return !text.includes(",") && /\b(association|agency|academy|committee|council|department|government|group|institute|institution|ministry|organization|society|university|foundation|office|center|centres|centers)\b/i.test(text);
  }

  function parseName(value) {
    if (value && typeof value === "object") return value;
    const raw = clean(value);
    if (!raw) return null;
    if (isGroupName(raw)) return { literal: decodeLatex(stripOuterBraces(raw)) };
    const decoded = decodeLatex(raw);
    const commaParts = decoded.split(/\s*,\s*/).filter(Boolean);
    if (commaParts.length >= 2) {
      return {
        family: commaParts[0],
        suffix: commaParts.length > 2 ? commaParts[1] : "",
        given: commaParts.length > 2 ? commaParts.slice(2).join(" ") : commaParts.slice(1).join(" ")
      };
    }
    const parts = decoded.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { literal: parts[0] };
    let familyStart = parts.length - 1;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (/^[a-zà-öø-ÿ]/u.test(parts[i])) { familyStart = i; break; }
    }
    return { given: parts.slice(0, familyStart).join(" "), family: parts.slice(familyStart).join(" "), suffix: "" };
  }

  function splitAuthors(value, source) {
    if (Array.isArray(value)) return value.map(parseName).filter(Boolean);
    const text = clean(value);
    if (!text) return [];
    let names;
    if (source === "bib") names = splitTopLevel(text, " and ");
    else if (/[;\n]/.test(text)) names = text.split(/[;\n]+/);
    else if (/\s+and\s+/i.test(text)) names = text.split(/\s+and\s+/i);
    else names = [text];
    return names.map(parseName).filter(Boolean);
  }

  function initials(given) {
    return clean(given).split(/\s+/).filter(Boolean).map((part) => {
      return part.split("-").map((piece) => {
        const letter = (piece.match(/[\p{L}\p{N}]/u) || [""])[0];
        return letter ? letter.toLocaleUpperCase() + "." : "";
      }).filter(Boolean).join("-");
    }).join(" ");
  }

  function personAuthor(person) {
    if (!person) return "";
    if (person.literal) return clean(person.literal);
    const family = clean(person.family);
    const init = initials(person.given);
    const suffix = clean(person.suffix);
    return [family, init].filter(Boolean).join(", ") + (suffix ? `, ${suffix}` : "");
  }

  function personEditor(person) {
    if (!person) return "";
    if (person.literal) return clean(person.literal);
    return [initials(person.given), clean(person.family)].filter(Boolean).join(" ") + (person.suffix ? `, ${clean(person.suffix)}` : "");
  }

  function joinNames(names, formatter, ellipsisRule) {
    const formatted = names.map(formatter).filter(Boolean);
    if (!formatted.length) return "";
    if (ellipsisRule && formatted.length > 20) return `${formatted.slice(0, 19).join(", ")}, … ${formatted[formatted.length - 1]}`;
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]}, & ${formatted[1]}`;
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  }

  function formatAuthors(names) { return joinNames(names || [], personAuthor, true); }
  function formatEditors(names) {
    const formatted = (names || []).map(personEditor).filter(Boolean);
    if (!formatted.length) return "";
    if (formatted.length === 1) return formatted[0];
    if (formatted.length === 2) return `${formatted[0]} & ${formatted[1]}`;
    return `${formatted.slice(0, -1).join(", ")}, & ${formatted[formatted.length - 1]}`;
  }

  function normalizeDoi(value) {
    let doi = clean(value);
    if (!doi) return "";
    try { doi = decodeURIComponent(doi); } catch (_) { /* retain original */ }
    doi = doi.replace(/^doi\s*:\s*/i, "").replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "").trim();
    doi = doi.replace(/[\s.,;]+$/g, "");
    return /^10\.\d{4,9}\/[\S]+$/i.test(doi) ? `https://doi.org/${doi}` : "";
  }

  function normalizeUrl(value) {
    const url = clean(value).replace(/[.,;]+$/g, "");
    if (!url) return "";
    if (/^10\.\d{4,9}\//i.test(url)) return normalizeDoi(url);
    if (/^(https?|ftp):\/\//i.test(url)) return url;
    if (/^www\./i.test(url)) return `https://${url}`;
    return url;
  }

  function pageRange(value) {
    return clean(value)
      .replace(/\s*(?:--+|–|—)\s*/g, "–")
      .replace(/([\p{L}\p{N}])\s*-\s*(?=[\p{L}\p{N}])/gu, "$1–");
  }

  function firstValue(object, keys) {
    for (const key of keys) if (clean(object[key])) return object[key];
    return "";
  }

  function yearFrom(value) {
    const match = clean(value).match(/(?:^|\D)((?:18|19|20|21)\d{2})(?:\D|$)/);
    return match ? match[1] : "";
  }

  function normalizeRecord(record) {
    const type = clean(record.type).toLowerCase() || "misc";
    const authors = splitAuthors(record.authors || record.author, record.source === "bib" ? "bib" : "manual");
    const editors = splitAuthors(record.editors || record.editor, record.source === "bib" ? "bib" : "manual");
    const doi = normalizeDoi(record.doi || ((/^10\./.test(clean(record.url))) ? record.url : ""));
    const rawUrl = normalizeUrl(record.url);
    const date = clean(record.date || record.year);
    return {
      id: record.id || `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      key: clean(record.key), source: clean(record.source), type,
      authors, editors,
      year: yearFrom(record.year || date), yearSuffix: clean(record.yearSuffix), date,
      month: clean(record.month), day: clean(record.day),
      title: clean(record.title),
      formattedText: clean(record.formattedText), formattedStyle: clean(record.formattedStyle),
      containerTitle: clean(record.containerTitle || record.journal || record.booktitle || record.website),
      volume: clean(record.volume), issue: clean(record.issue || record.number),
      pages: pageRange(record.pages), articleNumber: clean(record.articleNumber),
      doi, url: doi ? "" : rawUrl,
      publisher: clean(record.publisher), institution: clean(record.institution || record.school),
      place: clean(record.place || record.location || record.address),
      edition: clean(record.edition), reportNumber: clean(record.reportNumber),
      repository: clean(record.repository), thesisType: clean(record.thesisType),
      event: clean(record.event), accessed: clean(record.accessed), note: clean(record.note)
    };
  }

  function readBalancedEntry(text, openIndex) {
    const opener = text[openIndex];
    const closer = opener === "{" ? "}" : ")";
    let depth = 1, braceDepth = 0, quoted = false, escaped = false;
    for (let i = openIndex + 1; i < text.length; i += 1) {
      const char = text[i];
      if (escaped) { escaped = false; continue; }
      if (char === "\\") { escaped = true; continue; }
      if (char === '"') { quoted = !quoted; continue; }
      if (!quoted && opener === "(" && char === "{") { braceDepth += 1; continue; }
      if (!quoted && opener === "(" && char === "}" && braceDepth > 0) { braceDepth -= 1; continue; }
      if (!quoted && braceDepth === 0 && char === opener) depth += 1;
      if (!quoted && braceDepth === 0 && char === closer) depth -= 1;
      if (depth === 0) return { body: text.slice(openIndex + 1, i), end: i + 1 };
    }
    throw new Error("A BibTeX entry is missing its closing brace or parenthesis.");
  }

  function parseBibValue(text, start, macros) {
    let i = start;
    const parts = [];
    const skipSpace = () => { while (i < text.length && /\s/.test(text[i])) i += 1; };
    while (i < text.length) {
      skipSpace();
      let value = "";
      if (text[i] === "{") {
        let depth = 1, escaped = false;
        const begin = ++i;
        for (; i < text.length; i += 1) {
          const char = text[i];
          if (escaped) { escaped = false; continue; }
          if (char === "\\") { escaped = true; continue; }
          if (char === "{") depth += 1;
          if (char === "}") depth -= 1;
          if (depth === 0) { value = text.slice(begin, i); i += 1; break; }
        }
        if (depth !== 0) throw new Error("A braced BibTeX value is incomplete.");
      } else if (text[i] === '"') {
        let escaped = false;
        const begin = ++i;
        for (; i < text.length; i += 1) {
          const char = text[i];
          if (escaped) { escaped = false; continue; }
          if (char === "\\") { escaped = true; continue; }
          if (char === '"') { value = text.slice(begin, i); i += 1; break; }
        }
      } else {
        const begin = i;
        while (i < text.length && !/[#,}\)]/.test(text[i])) i += 1;
        const token = text.slice(begin, i).trim();
        value = Object.prototype.hasOwnProperty.call(macros, token.toLowerCase()) ? macros[token.toLowerCase()] : token;
      }
      parts.push(value);
      skipSpace();
      if (text[i] === "#") { i += 1; continue; }
      break;
    }
    return { value: parts.join(""), end: i };
  }

  function parseBibFields(body, macros, isString) {
    const fields = {};
    let i = 0;
    if (!isString) {
      let depth = 0, quoted = false, escaped = false;
      for (; i < body.length; i += 1) {
        const char = body[i];
        if (escaped) { escaped = false; continue; }
        if (char === "\\") { escaped = true; continue; }
        if (char === '"') quoted = !quoted;
        if (!quoted && char === "{") depth += 1;
        if (!quoted && char === "}") depth -= 1;
        if (!quoted && depth === 0 && char === ",") break;
      }
      fields.__key = body.slice(0, i).trim();
      i += 1;
    }
    while (i < body.length) {
      while (i < body.length && /[\s,]/.test(body[i])) i += 1;
      if (i >= body.length) break;
      const keyMatch = body.slice(i).match(/^([A-Za-z][\w-]*)\s*=/);
      if (!keyMatch) {
        const next = body.indexOf(",", i);
        if (next < 0) break;
        i = next + 1;
        continue;
      }
      const key = keyMatch[1].toLowerCase();
      i += keyMatch[0].length;
      const parsed = parseBibValue(body, i, macros);
      fields[key] = parsed.value;
      i = parsed.end;
      while (i < body.length && /\s/.test(body[i])) i += 1;
      if (body[i] === ",") i += 1;
    }
    return fields;
  }

  function parseBibTeX(input) {
    const text = String(input || "").replace(/^\uFEFF/, "");
    const macros = Object.assign({}, MONTHS);
    const rawEntries = [];
    let i = 0;
    while (i < text.length) {
      const at = text.indexOf("@", i);
      if (at < 0) break;
      const typeMatch = text.slice(at + 1).match(/^\s*([A-Za-z]+)\s*([\{\(])/);
      if (!typeMatch) { i = at + 1; continue; }
      const rawType = typeMatch[1].toLowerCase();
      const openIndex = at + 1 + typeMatch[0].lastIndexOf(typeMatch[2]);
      const entry = readBalancedEntry(text, openIndex);
      i = entry.end;
      if (rawType === "comment" || rawType === "preamble") continue;
      const fields = parseBibFields(entry.body, macros, rawType === "string");
      if (rawType === "string") {
        Object.keys(fields).forEach((key) => { if (key !== "__key") macros[key] = fields[key]; });
        continue;
      }
      rawEntries.push({ rawType, fields });
    }
    if (!rawEntries.length) throw new Error("No BibTeX entries were found.");
    const byKey = {};
    rawEntries.forEach((entry) => { byKey[entry.fields.__key] = entry.fields; });
    return rawEntries.map(({ rawType, fields }) => {
      const parent = fields.crossref && byKey[fields.crossref] ? byKey[fields.crossref] : {};
      const f = Object.assign({}, parent, fields);
      return normalizeRecord({
        source: "bib", key: f.__key, type: BIB_TYPES[rawType] || "misc",
        authors: f.author, editors: f.editor, year: f.year || f.date, date: f.date || f.year,
        month: f.month, title: f.title,
        containerTitle: f.journal || f.journaltitle || f.booktitle || f.organization,
        volume: f.volume, issue: f.number || f.issue, pages: f.pages,
        articleNumber: f.eid || f.articleno, doi: f.doi, url: f.url,
        publisher: f.publisher, institution: f.institution || f.school, place: f.address || f.location,
        edition: f.edition, reportNumber: f.number && rawType === "techreport" ? f.number : "",
        thesisType: rawType === "phdthesis" ? "Doctoral dissertation" : rawType === "mastersthesis" ? "Master’s thesis" : "",
        repository: f.repository, event: f.eventtitle, accessed: f.urldate, note: f.note
      });
    });
  }

  function parseRIS(input) {
    const lines = String(input || "").replace(/^\uFEFF/, "").split(/\r?\n/);
    const entries = [];
    let current = null, lastTag = "";
    const finish = () => { if (current && Object.keys(current).length) entries.push(current); current = null; lastTag = ""; };
    lines.forEach((line) => {
      const match = line.match(/^\s*([A-Z0-9]{2})\s{0,2}-\s?(.*)$/);
      if (match) {
        const tag = match[1], value = match[2].trim();
        if (tag === "TY") { if (current) finish(); current = {}; }
        if (!current) current = {};
        if (!current[tag]) current[tag] = [];
        current[tag].push(value);
        lastTag = tag;
        if (tag === "ER") finish();
      } else if (current && lastTag && line.trim()) {
        const values = current[lastTag];
        values[values.length - 1] += ` ${line.trim()}`;
      }
    });
    if (current) finish();
    if (!entries.length) throw new Error("No RIS records were found.");
    const one = (e, keys) => {
      for (const key of keys) if (e[key] && clean(e[key][0])) return e[key][0];
      return "";
    };
    return entries.map((e) => {
      const typeCode = one(e, ["TY"]).toUpperCase();
      const startPage = one(e, ["SP"]), endPage = one(e, ["EP"]);
      const date = one(e, ["DA", "Y1", "PY"]);
      const note = one(e, ["N1", "M3"]);
      let thesisType = "";
      if ((RIS_TYPES[typeCode] || "misc") === "thesis") {
        thesisType = /master/i.test(note) ? "Master’s thesis" : "Doctoral dissertation";
      }
      return normalizeRecord({
        source: "ris", type: RIS_TYPES[typeCode] || "misc",
        authors: e.AU || e.A1 || [], editors: e.ED || e.A2 || [],
        year: one(e, ["PY", "Y1", "DA"]), date,
        title: one(e, ["TI", "T1", "CT"]),
        containerTitle: one(e, ["JF", "JO", "J2", "T2", "BT"]),
        volume: one(e, ["VL"]), issue: one(e, ["IS"]),
        pages: startPage && endPage ? `${startPage}–${endPage}` : startPage,
        articleNumber: one(e, ["C7"]), doi: one(e, ["DO"]), url: one(e, ["UR", "L1", "LK"]),
        publisher: one(e, ["PB"]), institution: one(e, ["IN", "A3"]), place: one(e, ["CY", "PP"]),
        edition: one(e, ["ET"]), reportNumber: one(e, ["SN"]),
        thesisType, repository: one(e, ["DB"]), event: one(e, ["T3"]), accessed: one(e, ["Y2"]), note
      });
    });
  }

  function detectFormat(input) {
    const text = String(input || "").replace(/^\uFEFF/, "").trim();
    if (/^@\s*[A-Za-z]+\s*[\{\(]/m.test(text)) return "bibtex";
    if (/^\s*TY\s{0,2}-/m.test(text) || /^\s*(?:AU|TI|PY)\s{0,2}-/m.test(text)) return "ris";
    return "unknown";
  }

  function parseInput(input, explicitFormat) {
    const format = explicitFormat || detectFormat(input);
    if (format === "bibtex" || format === "bib") return parseBibTeX(input);
    if (format === "ris") return parseRIS(input);
    throw new Error("The pasted data does not look like BibTeX or RIS.");
  }

  function terminal(value) {
    const text = clean(value);
    return !text || /[.!?]$/.test(text) ? text : `${text}.`;
  }

  function editionText(value) {
    const edition = clean(value);
    if (!edition) return "";
    if (/ed\.?$/i.test(edition)) return edition;
    if (/^\d+$/.test(edition)) {
      const n = Number(edition), mod100 = n % 100;
      const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
      return `${n}${suffix} ed.`;
    }
    return `${edition} ed.`;
  }

  function dateParts(record, fullDate) {
    const raw = clean(record.date);
    const year = `${record.year || yearFrom(raw) || "n.d."}${record.yearSuffix || ""}`;
    if (!fullDate || year === "n.d.") return year;
    let month = clean(record.month), day = clean(record.day);
    const iso = raw.match(/(?:^|\D)((?:18|19|20|21)\d{2})[-\/]([01]?\d)(?:[-\/]([0-3]?\d))?/);
    const ris = raw.match(/(?:^|\D)((?:18|19|20|21)\d{2})\/([01]?\d)\/([0-3]?\d)?/);
    const match = iso || ris;
    if (match) { month = MONTHS[String(Number(match[2])).padStart(2, "0")] || new Date(2000, Number(match[2]) - 1, 1).toLocaleString("en", { month: "long" }); day = match[3] ? String(Number(match[3])) : day; }
    if (MONTHS[month.toLowerCase()]) month = MONTHS[month.toLowerCase()];
    if (!month) return year;
    return `${year}, ${month}${day ? ` ${Number(day) || day}` : ""}`;
  }

  function safeLink(url) {
    const value = normalizeUrl(url);
    const href = /^(https?|ftp):\/\//i.test(value) ? value : "";
    return href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(value)}</a>` : escapeHtml(value);
  }

  function leadParts(record, title, titleHtml, titleMovesToLead, fullDate) {
    const author = formatAuthors(record.authors);
    if (author) return { text: `${terminal(author)} (${dateParts(record, fullDate)}).`, html: `${escapeHtml(terminal(author))} (${escapeHtml(dateParts(record, fullDate))}).`, titleUsed: false };
    if (record.editors.length && (record.type === "book" || record.type === "report")) {
      const editor = formatAuthors(record.editors);
      const label = record.editors.length === 1 ? "(Ed.)" : "(Eds.)";
      const text = `${editor} ${label}`;
      return { text: `${terminal(text)} (${dateParts(record, fullDate)}).`, html: `${escapeHtml(terminal(text))} (${escapeHtml(dateParts(record, fullDate))}).`, titleUsed: false };
    }
    if (titleMovesToLead) return { text: `${terminal(title)} (${dateParts(record, fullDate)}).`, html: `${terminal(titleHtml)} (${escapeHtml(dateParts(record, fullDate))}).`, titleUsed: true };
    return { text: `(${dateParts(record, fullDate)}).`, html: `(${escapeHtml(dateParts(record, fullDate))}).`, titleUsed: false };
  }

  function formatRecord(input) {
    const record = normalizeRecord(input);
    if (record.type === "formatted") {
      const literal = record.formattedText || record.title || "Untitled reference";
      return finalizeCitation({ record, text: literal, html: escapeHtml(literal) });
    }
    const type = record.type === "misc" && record.containerTitle ? "article" : record.type;
    const title = sentenceCase(record.title || "Untitled work");
    const titleEsc = escapeHtml(title);
    const italicTitle = ["book", "web", "report", "thesis", "dataset"].includes(type);
    const titleHtml = italicTitle ? `<i>${titleEsc}</i>` : titleEsc;
    const lead = leadParts(record, title, titleHtml, !record.authors.length && !record.editors.length, type === "web");
    const text = [lead.text], html = [lead.html];
    const push = (plain, rich) => { if (clean(plain)) { text.push(plain); html.push(rich == null ? escapeHtml(plain) : rich); } };
    if (!lead.titleUsed) push(terminal(title), terminal(titleHtml));

    if (type === "article") {
      const journal = titleCaseContainer(record.containerTitle);
      let sourceText = journal, sourceHtml = journal ? `<i>${escapeHtml(journal)}</i>` : "";
      if (record.volume) {
        sourceText += `${sourceText ? ", " : ""}${record.volume}`;
        sourceHtml += `${sourceHtml ? ", " : ""}<i>${escapeHtml(record.volume)}</i>`;
      }
      if (record.issue) { sourceText += `(${record.issue})`; sourceHtml += `(${escapeHtml(record.issue)})`; }
      const locator = record.pages || (record.articleNumber ? `Article ${record.articleNumber}` : "");
      if (locator) { sourceText += `${sourceText ? ", " : ""}${locator}`; sourceHtml += `${sourceHtml ? ", " : ""}${escapeHtml(locator)}`; }
      if (sourceText) push(terminal(sourceText), terminal(sourceHtml));
    } else if (type === "book") {
      const details = editionText(record.edition);
      if (details) { text[text.length - 1] = `${text[text.length - 1].replace(/\.$/, "")} (${details}).`; html[html.length - 1] = `${html[html.length - 1].replace(/\.$/, "")} (${escapeHtml(details)}).`; }
      const groupAuthor = record.authors.length === 1 && record.authors[0].literal ? clean(record.authors[0].literal) : "";
      if (record.publisher && clean(record.publisher).toLocaleLowerCase() !== groupAuthor.toLocaleLowerCase()) push(terminal(decodeLatex(record.publisher)));
    } else if (type === "chapter") {
      const editors = formatEditors(record.editors);
      const editorLabel = record.editors.length === 1 ? "Ed." : "Eds.";
      let inText = "In";
      let inHtml = "In";
      if (editors) { inText += ` ${editors} (${editorLabel}),`; inHtml += ` ${escapeHtml(editors)} (${editorLabel}),`; }
      if (record.containerTitle) { const book = sentenceCase(record.containerTitle); inText += ` ${book}`; inHtml += ` <i>${escapeHtml(book)}</i>`; }
      const detailBits = [];
      const edition = editionText(record.edition);
      if (edition) detailBits.push(edition);
      if (record.pages) detailBits.push(`pp. ${record.pages}`);
      if (detailBits.length) { inText += ` (${detailBits.join(", ")})`; inHtml += ` (${escapeHtml(detailBits.join(", "))})`; }
      push(terminal(inText), terminal(inHtml));
      if (record.publisher) push(terminal(decodeLatex(record.publisher)));
    } else if (type === "conference") {
      let proceedings = record.containerTitle ? `In ${sentenceCase(record.containerTitle)}` : (record.event ? `Paper presented at ${decodeLatex(record.event)}` : "");
      if (record.pages) proceedings += ` (pp. ${record.pages})`;
      if (proceedings) push(terminal(proceedings), record.containerTitle ? terminal(`In <i>${escapeHtml(sentenceCase(record.containerTitle))}</i>${record.pages ? ` (pp. ${escapeHtml(record.pages)})` : ""}`) : undefined);
      if (record.publisher) push(terminal(decodeLatex(record.publisher)));
    } else if (type === "web") {
      const site = titleCaseContainer(record.containerTitle || record.publisher);
      const authorLiteral = record.authors.length === 1 && record.authors[0].literal ? clean(record.authors[0].literal) : "";
      if (site && site.toLocaleLowerCase() !== authorLiteral.toLocaleLowerCase()) push(terminal(site));
    } else if (type === "report") {
      if (record.reportNumber) { text[text.length - 1] = `${text[text.length - 1].replace(/\.$/, "")} (Report No. ${record.reportNumber}).`; html[html.length - 1] = `${html[html.length - 1].replace(/\.$/, "")} (Report No. ${escapeHtml(record.reportNumber)}).`; }
      if (record.publisher && (!record.authors[0] || record.authors[0].literal !== record.publisher)) push(terminal(decodeLatex(record.publisher)));
    } else if (type === "thesis") {
      const kind = record.thesisType || "Thesis";
      const institution = record.institution || record.publisher;
      const bracket = institution ? `${kind}, ${decodeLatex(institution)}` : kind;
      text[text.length - 1] = `${text[text.length - 1].replace(/\.$/, "")} [${bracket}].`;
      html[html.length - 1] = `${html[html.length - 1].replace(/\.$/, "")} [${escapeHtml(bracket)}].`;
      if (record.repository) push(terminal(decodeLatex(record.repository)));
    } else if (type === "dataset") {
      text[text.length - 1] = `${text[text.length - 1].replace(/\.$/, "")} [Data set].`;
      html[html.length - 1] = `${html[html.length - 1].replace(/\.$/, "")} [Data set].`;
      if (record.publisher) push(terminal(decodeLatex(record.publisher)));
    } else {
      if (record.containerTitle) push(terminal(titleCaseContainer(record.containerTitle)), `<i>${escapeHtml(terminal(titleCaseContainer(record.containerTitle)))}</i>`);
      if (record.publisher) push(terminal(decodeLatex(record.publisher)));
    }

    const locator = record.doi || record.url;
    if (locator) push(locator, safeLink(locator));
    return finalizeCitation({ record, text: text.filter(Boolean).join(" ").replace(/\s+/g, " ").trim(), html: html.filter(Boolean).join(" ").replace(/\s+/g, " ").trim() });
  }

  function harvardInitials(given) {
    return clean(given).split(/[\s-]+/).filter(Boolean).map((part) => {
      const match = part.match(/[\p{L}\p{N}]/u);
      return match ? match[0].toLocaleUpperCase() : "";
    }).join("");
  }

  function harvardMinimalCase(value) {
    return sentenceCase(value).replace(/(:\s+)([\p{Lu}])([\p{Ll}\p{M}]*)/gu, (_, punctuation, first, rest) => {
      const word = `${first}${rest}`;
      return punctuation + (/^(AI|APA|DNA|RNA|HIV|AIDS|COVID|NASA|NATO|UN|EU|UK|USA|WHO|PDF|URL|DOI|STEM)$/.test(word) ? word : word.toLocaleLowerCase());
    });
  }

  function harvardAuthorName(person) {
    if (!person) return "";
    if (person.literal) return clean(person.literal);
    return [clean(person.family), harvardInitials(person.given)].filter(Boolean).join(", ");
  }

  function harvardEditorName(person) {
    if (!person) return "";
    if (person.literal) return clean(person.literal);
    return [harvardInitials(person.given), clean(person.family)].filter(Boolean).join(" ");
  }

  function joinHarvardNames(names, editorMode) {
    const values = (names || []).map(editorMode ? harvardEditorName : harvardAuthorName).filter(Boolean);
    if (!values.length) return "";
    if (values.length === 1) return values[0];
    return `${values.slice(0, -1).join(", ")} & ${values[values.length - 1]}`;
  }

  function harvardEdition(value) {
    const edition = clean(value);
    if (!edition) return "";
    if (/edn\.?$/i.test(edition)) return edition.replace(/\.$/, "");
    if (/ed\.?$/i.test(edition)) return edition.replace(/ed\.?$/i, "edn");
    if (/^\d+$/.test(edition)) {
      const n = Number(edition), mod100 = n % 100;
      const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : n % 10 === 1 ? "st" : n % 10 === 2 ? "nd" : n % 10 === 3 ? "rd" : "th";
      return `${n}${suffix} edn`;
    }
    return `${edition} edn`;
  }

  function harvardAccessed(value) {
    const text = clean(value);
    if (!text) return "";
    const match = text.match(/^((?:18|19|20|21)\d{2})[-\/]([01]?\d)[-\/]([0-3]?\d)$/);
    if (!match) return text;
    const month = new Date(2000, Number(match[2]) - 1, 1).toLocaleString("en", { month: "long" });
    return `${Number(match[3])} ${month} ${match[1]}`;
  }

  function harvardLocator(record) {
    if (record.doi) {
      const bare = record.doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
      return { text: `DOI:${bare}`, html: `<a href="${escapeHtml(record.doi)}" target="_blank" rel="noopener noreferrer">DOI:${escapeHtml(bare)}</a>` };
    }
    if (record.url) {
      const url = normalizeUrl(record.url);
      const safe = /^(https?|ftp):\/\//i.test(url);
      return {
        text: `<${url}>`,
        html: safe ? `&lt;<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>&gt;` : `&lt;${escapeHtml(url)}&gt;`
      };
    }
    return null;
  }

  function formatHarvardRecord(input) {
    const record = normalizeRecord(input);
    if (record.type === "formatted") {
      const literal = record.formattedText || record.title || "Untitled reference";
      return finalizeCitation({ record, text: literal, html: escapeHtml(literal) });
    }
    const type = record.type === "misc" && record.containerTitle ? "article" : record.type;
    const title = harvardMinimalCase(record.title || "Untitled work");
    const authors = joinHarvardNames(record.authors, false);
    const year = `${record.year || "n.d."}${record.yearSuffix || ""}`;
    const pages = record.pages.replace(/–/g, "-");
    const text = [], html = [];
    const push = (plain, rich) => {
      if (!clean(plain)) return;
      text.push(plain);
      html.push(rich == null ? escapeHtml(plain) : rich);
    };
    let titleUsed = false;
    if (authors) push(`${authors} ${year}`);
    else {
      if (type === "article" || type === "chapter") push(`'${title}'`, `&#39;${escapeHtml(title)}&#39;`);
      else push(title, `<i>${escapeHtml(title)}</i>`);
      push(year);
      titleUsed = true;
    }

    if (type === "article") {
      if (!titleUsed) push(`'${title}'`, `&#39;${escapeHtml(title)}&#39;`);
      if (record.containerTitle) push(titleCaseContainer(record.containerTitle), `<i>${escapeHtml(titleCaseContainer(record.containerTitle))}</i>`);
      if (record.volume) push(`vol. ${record.volume}`);
      if (record.issue) push(`no. ${record.issue}`);
      if (pages) push(`pp. ${pages}`);
    } else if (type === "book") {
      if (!titleUsed) push(title, `<i>${escapeHtml(title)}</i>`);
      if (record.edition) push(harvardEdition(record.edition));
      if (record.publisher) push(decodeLatex(record.publisher));
      if (record.place) push(decodeLatex(record.place));
    } else if (type === "chapter") {
      if (!titleUsed) push(`'${title}'`, `&#39;${escapeHtml(title)}&#39;`);
      const editors = joinHarvardNames(record.editors, true);
      if (editors) push(`in ${editors} (${record.editors.length === 1 ? "ed." : "eds"})`);
      if (record.containerTitle) push(harvardMinimalCase(record.containerTitle), `<i>${escapeHtml(harvardMinimalCase(record.containerTitle))}</i>`);
      if (record.edition) push(harvardEdition(record.edition));
      if (record.publisher) push(decodeLatex(record.publisher));
      if (record.place) push(decodeLatex(record.place));
      if (pages) push(`pp. ${pages}`);
    } else if (type === "web") {
      if (!titleUsed) push(title, `<i>${escapeHtml(title)}</i>`);
      if (record.containerTitle) push(titleCaseContainer(record.containerTitle));
      const accessed = harvardAccessed(record.accessed);
      if (accessed) push(`accessed ${accessed}`);
    } else {
      if (!titleUsed) push(title, `<i>${escapeHtml(title)}</i>`);
      if (record.containerTitle) push(titleCaseContainer(record.containerTitle));
      if (record.publisher) push(decodeLatex(record.publisher));
      if (record.place) push(decodeLatex(record.place));
    }

    const locator = harvardLocator(record);
    if (locator) push(locator.text, locator.html);
    return finalizeCitation({ record, text: `${text.join(", ")}.`, html: `${html.join(", ")}.` });
  }

  function shortInTextTitle(record, styleId) {
    const source = styleId === "harvard" ? harvardMinimalCase(record.title) : sentenceCase(record.title);
    const words = clean(source || "Untitled work").split(/\s+/);
    const short = words.length > 5 ? `${words.slice(0, 5).join(" ")}\u2026` : words.join(" ");
    if (styleId === "apa7" && ["article", "chapter", "web"].includes(record.type)) return `\u201c${short}\u201d`;
    return short;
  }

  function inTextNames(record, styleId, narrative) {
    const names = record.authors.map((person) => clean(person.literal || person.family)).filter(Boolean);
    if (!names.length) return { lead: shortInTextTitle(record, styleId), titleLead: true };
    const threshold = styleId === "harvard" ? 3 : 2;
    if (names.length > threshold) return { lead: `${names[0]} et al.`, titleLead: false };
    if (names.length === 1) return { lead: names[0], titleLead: false };
    const conjunction = narrative ? "and" : "&";
    return { lead: `${names.slice(0, -1).join(", ")} ${conjunction} ${names[names.length - 1]}`, titleLead: false };
  }

  function inTextLocator(value, styleId) {
    const locator = clean(value);
    if (!locator) return "";
    const separator = styleId === "harvard" ? "-" : "\u2013";
    const normalizeRange = (text) => text.replace(/\s*[\u2013-]\s*/g, separator);
    const labelled = locator.match(/^((?:p{1,2}|paras?|secs?)\.)\s*(.+)$/i);
    if (labelled) return `${labelled[1]} ${normalizeRange(labelled[2])}`;
    if (/^(?:chapter\b|chap\.)/i.test(locator)) return locator;
    if (/^\d+(?:\s*[\u2013-]\s*\d+)?$/.test(locator)) return `${/[\u2013-]/.test(locator) ? "pp." : "p."} ${normalizeRange(locator)}`;
    return locator;
  }

  function formatInText(input, styleId, mode, locatorValue) {
    const selectedStyle = styleId === "harvard" ? "harvard" : "apa7";
    const record = normalizeRecord(input);
    if (record.type === "formatted" && !record.authors.length) return "";
    const narrative = mode === "narrative";
    const name = inTextNames(record, selectedStyle, narrative);
    const year = `${record.year || "n.d."}${record.yearSuffix || ""}`;
    const locator = inTextLocator(locatorValue, selectedStyle);
    const yearPart = `${year}${locator ? `, ${locator}` : ""}`;
    if (narrative) return smartQuotes(`${name.lead} (${yearPart})`);
    if (selectedStyle === "harvard") return smartQuotes(`(${name.lead} ${yearPart})`);
    if (name.titleLead && name.lead.endsWith("\u201d")) return smartQuotes(`(${name.lead.slice(0, -1)},\u201d ${yearPart})`);
    return smartQuotes(`(${name.lead}, ${yearPart})`);
  }

  function sortKey(record) {
    const lead = formatAuthors(record.authors || []) || record.title || record.formattedText;
    return clean(lead).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
  }

  function formatRecords(records, styleId) {
    const selectedStyle = styleId || "apa7";
    if (!STYLE_REGISTRY[selectedStyle] || !STYLE_REGISTRY[selectedStyle].available) {
      throw new Error("That citation style is not available yet.");
    }
    const normalized = (records || []).map(normalizeRecord).sort((a, b) => {
      const authorOrder = sortKey(a).localeCompare(sortKey(b), "en", { sensitivity: "base" });
      if (authorOrder) return authorOrder;
      const yearA = a.year || "9999", yearB = b.year || "9999";
      if (yearA !== yearB) return yearA.localeCompare(yearB);
      return sentenceCase(a.title).localeCompare(sentenceCase(b.title), "en", { sensitivity: "base" });
    });
    const groups = new Map();
    normalized.forEach((record) => {
      const key = `${sortKey(record)}\u0000${record.year || "n.d."}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(record);
    });
    groups.forEach((group) => {
      if (group.length < 2) return;
      group.forEach((record, index) => {
        let n = index, suffix = "";
        do { suffix = String.fromCharCode(97 + (n % 26)) + suffix; n = Math.floor(n / 26) - 1; } while (n >= 0);
        record.yearSuffix = suffix;
      });
    });
    return normalized.map(selectedStyle === "harvard" ? formatHarvardRecord : formatRecord);
  }

  return {
    detectFormat, parseInput, parseBibTeX, parseRIS, normalizeRecord,
    normalizeDoi, normalizeUrl, sentenceCase, splitAuthors, formatAuthors,
    formatRecord, formatHarvardRecord, formatRecords, formatInText, escapeHtml, smartQuotes,
    styles: STYLE_REGISTRY,
    availableStyles: () => Object.values(STYLE_REGISTRY).filter((style) => style.available)
  };
});
