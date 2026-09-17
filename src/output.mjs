export function printValue(value, options = {}) {
  if (options.json) {
    console.log(JSON.stringify(value, null, 2));
    return;
  }

  if (Array.isArray(value)) {
    printTable(value);
    return;
  }

  printObject(value);
}

function printObject(value) {
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined || entry === null || typeof entry === "object")
      continue;
    console.log(`${humanize(key)}: ${sanitize(entry)}`);
  }
}

function printTable(rows) {
  if (rows.length === 0) {
    console.log("No results.");
    return;
  }

  const keys = uniqueKeys(rows);
  const widths = keys.map((key) =>
    Math.max(key.length, ...rows.map((row) => formatCell(row[key]).length)),
  );
  console.log(
    keys
      .map((key, index) => key.toUpperCase().padEnd(widths[index]))
      .join("  "),
  );
  console.log(widths.map((width) => "-".repeat(width)).join("  "));
  for (const row of rows) {
    console.log(
      keys
        .map((key, index) => formatCell(row[key]).padEnd(widths[index]))
        .join("  "),
    );
  }
}

function uniqueKeys(rows) {
  return [...new Set(rows.flatMap((row) => Object.keys(row)))];
}

function formatCell(value) {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") return sanitize(JSON.stringify(value));
  return sanitize(value);
}

function sanitize(value) {
  return [...String(value)]
    .map((character) => {
      const codePoint = character.codePointAt(0);
      const isControl =
        codePoint <= 31 || (codePoint >= 127 && codePoint <= 159);
      return isControl
        ? `\\u${codePoint.toString(16).padStart(4, "0")}`
        : character;
    })
    .join("");
}

function humanize(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (letter) => letter.toUpperCase());
}
