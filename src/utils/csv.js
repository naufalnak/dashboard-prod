// Parser CSV generik (auto-detect delimiter koma/titik-koma/tab dari baris
// header) -- dipakai /master-import (routes/masterData.routes.js). Pure
// function, tidak terikat ke domain Master Data manapun, jadi ditaruh di
// utils/ supaya bisa dipakai ulang kalau nanti ada import CSV lain.
function parseCsv(text) {
  // Auto-detect delimiter from the header line (comma, semicolon, or tab)
  const firstLine = text.split(/\r?\n/)[0] || '';
  const commas = (firstLine.match(/,/g) || []).length;
  const semis  = (firstLine.match(/;/g) || []).length;
  const tabs   = (firstLine.match(/\t/g) || []).length;
  const delim  = tabs > commas && tabs > semis ? '\t' : semis > commas ? ';' : ',';

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delim) {
      row.push(field); field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    if (row.some((c) => c.trim() !== '')) rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (r[idx] ?? '').trim(); });
    return obj;
  });
}

module.exports = { parseCsv };
