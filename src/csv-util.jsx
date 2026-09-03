// CSV utilities. Browser-only; no dependencies. RFC 4180 quoting,
// CRLF row separator (Excel-on-Windows is stricter about line endings
// than Sheets — CRLF works in both), UTF-8 BOM prepended so Excel
// auto-detects encoding when the export contains Arabic or other
// non-ASCII characters.

// Quote a single cell. Wrap in double-quotes if it contains a comma,
// newline, CR, or double-quote; escape inner double-quotes by doubling.
// null / undefined become empty strings.
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// Build a full CSV string from rows of arbitrary cell values. Header row
// is just rows[0] — the caller decides whether to include one. Every cell
// goes through csvEscape, including the header (cheaper than reasoning
// about which row is "safe").
function buildCsv(rows) {
  return rows.map(row => row.map(csvEscape).join(',')).join('\r\n');
}

// Trigger a download. Blob + objectURL + temp <a download> + revoke
// after a short delay to let the browser pick up the download before
// the URL is freed. BOM ensures Excel reads UTF-8.
function downloadCsv(filename, csvString) {
  const blob = new Blob(['\uFEFF' + csvString], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  // Some browsers require the anchor to be in the document tree to
  // honor .click(); attach, click, detach.
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

window.csvEscape = csvEscape;
window.buildCsv = buildCsv;
window.downloadCsv = downloadCsv;
