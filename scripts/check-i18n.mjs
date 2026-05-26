#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const localeFiles = {
  en: "src/locales/en.strings",
  ru: "src/locales/ru.strings",
  "zh-Hans": "src/locales/zh-Hans.strings",
};

const failures = [];
const dictionaries = Object.fromEntries(
  await Promise.all(
    Object.entries(localeFiles).map(async ([locale, relativePath]) => {
      const raw = await readFile(path.join(root, relativePath), "utf8");
      return [locale, parseAppleStrings(raw)];
    }),
  ),
);

const i18nSource = await readFile(path.join(root, "src/i18n.ts"), "utf8");
const overlayKeys = parseOverlayTranslationKeys(i18nSource);
const frontendFiles = await listTypeScriptFiles(path.join(root, "src"));
const localizedCallKeys = new Set();

for (const file of frontendFiles) {
  const source = await readFile(file, "utf8");
  for (const key of extractLocalizedCallKeys(source)) {
    localizedCallKeys.add(key);
  }
}

assertLocaleParity(dictionaries, "Localizable.strings");
assertLocaleParity(overlayKeys, "Tauri overlayTranslations");

const knownEnglishKeys = new Set([...dictionaries.en.keys(), ...overlayKeys.en]);
const missingLocalizedCalls = [...localizedCallKeys].filter((key) => !knownEnglishKeys.has(key)).sort();
if (missingLocalizedCalls.length > 0) {
  failures.push(
    `Missing English dictionary or overlay keys for t()/tf(): ${missingLocalizedCalls.map((key) => JSON.stringify(key)).join(", ")}`,
  );
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(
  `i18n coverage OK: ${dictionaries.en.size} source keys, ${overlayKeys.en.size} overlay keys, ${localizedCallKeys.size} t()/tf() keys.`,
);

async function listTypeScriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listTypeScriptFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(".ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseAppleStrings(raw) {
  const map = new Map();
  const expression = /"((?:\\.|[^"\\])*)"\s*=\s*"((?:\\.|[^"\\])*)";/g;
  let match;
  while ((match = expression.exec(raw)) !== null) {
    map.set(unescapeStringValue(match[1]), unescapeStringValue(match[2]));
  }
  return map;
}

function parseOverlayTranslationKeys(source) {
  return {
    en: parseObjectKeys(extractBetween(source, "  en: {", "\n  },\n  ru: {")),
    ru: parseObjectKeys(extractBetween(source, "  ru: {", '\n  },\n  "zh-Hans": {')),
    "zh-Hans": parseObjectKeys(extractBetween(source, '  "zh-Hans": {', "\n  },\n};")),
  };
}

function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start === -1 || end === -1) {
    failures.push(`Could not parse overlayTranslations block: ${startMarker.trim()}`);
    return "";
  }
  return source.slice(start + startMarker.length, end);
}

function parseObjectKeys(block) {
  const keys = new Set();
  const expression = /^\s*(?:"((?:\\.|[^"\\])*)"|([A-Za-z][A-Za-z0-9_]*))\s*:/gm;
  let match;
  while ((match = expression.exec(block)) !== null) {
    keys.add(unescapeStringValue(match[1] ?? match[2]));
  }
  return keys;
}

function assertLocaleParity(localeMaps, label) {
  const englishKeys = toKeySet(localeMaps.en);
  for (const locale of ["ru", "zh-Hans"]) {
    const keys = toKeySet(localeMaps[locale]);
    const missing = [...englishKeys].filter((key) => !keys.has(key)).sort();
    const extra = [...keys].filter((key) => !englishKeys.has(key)).sort();
    if (missing.length > 0) {
      failures.push(`${label}: ${locale} is missing ${missing.length} keys: ${missing.map((key) => JSON.stringify(key)).join(", ")}`);
    }
    if (extra.length > 0) {
      failures.push(`${label}: ${locale} has ${extra.length} extra keys: ${extra.map((key) => JSON.stringify(key)).join(", ")}`);
    }
  }
}

function toKeySet(collection) {
  if (collection instanceof Map) {
    return new Set(collection.keys());
  }
  return collection;
}

function extractLocalizedCallKeys(source) {
  const keys = [];
  const expression = /\b(t|tf)\s*\(/g;
  let match;
  while ((match = expression.exec(source)) !== null) {
    const openParen = source.indexOf("(", match.index);
    const argument = readCallArgument(source, openParen);
    if (!argument) {
      continue;
    }

    const literals = extractStringLiterals(argument);
    if (match[1] === "tf") {
      if (literals[0]) {
        keys.push(literals[0].value);
      }
      continue;
    }

    const firstToken = argument.search(/\S/);
    if (literals[0] && literals[0].start === firstToken) {
      keys.push(literals[0].value);
      continue;
    }

    for (const literal of literals) {
      const previous = previousNonWhitespace(argument, literal.start);
      if (previous === "?" || previous === ":") {
        keys.push(literal.value);
      }
    }
  }
  return keys;
}

function readCallArgument(source, openParen) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openParen; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") {
      depth += 1;
      continue;
    }
    if (char === ")") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openParen + 1, index);
      }
    }
  }
  return null;
}

function extractStringLiterals(argument) {
  const literals = [];
  const expression = /(["'])((?:\\.|(?!\1)[\s\S])*?)\1/g;
  let match;
  while ((match = expression.exec(argument)) !== null) {
    literals.push({
      value: unescapeStringValue(match[2]),
      start: match.index,
    });
  }
  return literals;
}

function previousNonWhitespace(value, index) {
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    if (!/\s/.test(value[cursor])) {
      return value[cursor];
    }
  }
  return null;
}

function unescapeStringValue(value) {
  return value
    .replaceAll("\\n", "\n")
    .replaceAll("\\r", "\r")
    .replaceAll("\\t", "\t")
    .replaceAll('\\"', '"')
    .replaceAll("\\'", "'")
    .replaceAll("\\\\", "\\");
}
