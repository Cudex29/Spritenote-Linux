// markdown.js — parser markdown ligero + resaltado de código.
// Renderiza en vivo el contenido de las notas (mini-Notion).

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── resaltado de código genérico (token-based) ──────────────────
const KEYWORDS = new Set([
  // generic / multi-lang
  'def','return','if','else','elif','for','while','in','import','from','as','class',
  'function','const','let','var','new','await','async','try','catch','finally','throw',
  'public','private','static','void','int','float','double','char','bool','string',
  'true','false','null','none','None','True','False','undefined','this','self','print',
  'echo','sudo','cd','ls','git','export','source','and','or','not','is','with','lambda',
  'break','continue','pass','yield','switch','case','default','do','struct','enum','type',
]);

function highlight(code) {
  // tokeniza respetando strings, comentarios, números, identificadores
  let out = '';
  let i = 0;
  const n = code.length;
  const isIdentStart = c => /[A-Za-z_$]/.test(c);
  const isIdent = c => /[A-Za-z0-9_$]/.test(c);

  while (i < n) {
    const c = code[i];

    // comentario de línea  // # --
    if ((c === '/' && code[i + 1] === '/') || c === '#' ||
        (c === '-' && code[i + 1] === '-')) {
      let j = i;
      while (j < n && code[j] !== '\n') j++;
      out += `<span class="tok-com">${escHtml(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // comentario de bloque /* */
    if (c === '/' && code[i + 1] === '*') {
      let j = i + 2;
      while (j < n && !(code[j] === '*' && code[j + 1] === '/')) j++;
      j = Math.min(j + 2, n);
      out += `<span class="tok-com">${escHtml(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // strings  ' " `
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < n && code[j] !== c) { if (code[j] === '\\') j++; j++; }
      j = Math.min(j + 1, n);
      out += `<span class="tok-str">${escHtml(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // números
    if (/[0-9]/.test(c)) {
      let j = i;
      while (j < n && /[0-9.xa-fA-F_]/.test(code[j])) j++;
      out += `<span class="tok-num">${escHtml(code.slice(i, j))}</span>`;
      i = j;
      continue;
    }
    // identificadores / keywords
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdent(code[j])) j++;
      const word = code.slice(i, j);
      // ¿llamada a función? (sigue paréntesis)
      let k = j; while (k < n && code[k] === ' ') k++;
      if (KEYWORDS.has(word)) out += `<span class="tok-kw">${escHtml(word)}</span>`;
      else if (code[k] === '(') out += `<span class="tok-fn">${escHtml(word)}</span>`;
      else out += escHtml(word);
      i = j;
      continue;
    }
    // puntuación
    if (/[{}()\[\];:,.<>+\-*/=&|!?]/.test(c)) {
      out += `<span class="tok-punct">${escHtml(c)}</span>`;
      i++;
      continue;
    }
    out += escHtml(c);
    i++;
  }
  return out;
}

// ── inline: **bold** *it* `code` ~~del~~ [t](u) ─────────────────
function inline(s) {
  s = escHtml(s);
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => {
    codes.push(c);
    return `\u0000${codes.length - 1}\u0000`;
  });
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  s = s.replace(/_([^_]+)_/g, '<em>$1</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code class="inline">${codes[+i]}</code>`);
  return s;
}

// ── render markdown completo ────────────────────────────────────
function renderMarkdown(src) {
  if (!src || !src.trim()) return '<p style="color:var(--text-faint)">— vacío —</p>';
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  let html = '';
  let i = 0;
  let listType = null; // 'ul' | 'ol' | null

  const closeList = () => { if (listType) { html += `</${listType}>`; listType = null; } };

  while (i < lines.length) {
    let line = lines[i];

    // code fence
    const fence = line.match(/^```\s*(\w+)?\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1] || '';
      const buf = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // cierre
      html += `<pre><div class="code-head"><span>${lang || 'code'}</span><span>···</span></div>` +
              `<code>${highlight(buf.join('\n'))}</code></pre>`;
      continue;
    }

    // tabla
    if (/^\|.*\|/.test(line) && i + 1 < lines.length && /^\|[\s:|-]+\|/.test(lines[i + 1])) {
      closeList();
      const head = line.split('|').slice(1, -1).map(c => c.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|.*\|/.test(lines[i])) {
        rows.push(lines[i].split('|').slice(1, -1).map(c => c.trim()));
        i++;
      }
      html += '<table><thead><tr>' + head.map(h => `<th>${inline(h)}</th>`).join('') +
              '</tr></thead><tbody>' +
              rows.map(r => '<tr>' + r.map(c => `<td>${inline(c)}</td>`).join('') + '</tr>').join('') +
              '</tbody></table>';
      continue;
    }

    // checkbox
    const chk = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/);
    if (chk) {
      closeList();
      const done = chk[1].toLowerCase() === 'x';
      html += `<div class="md-check ${done ? 'checked' : ''}">` +
              `<input type="checkbox" disabled ${done ? 'checked' : ''}>` +
              `<span>${inline(chk[2])}</span></div>`;
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      html += `<h${lvl}>${inline(h[2])}</h${lvl}>`;
      i++;
      continue;
    }

    // hr
    if (/^(\s*[-*_]){3,}\s*$/.test(line) && !/\[/.test(line)) {
      closeList();
      html += '<hr>';
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      html += `<blockquote>${inline(buf.join(' '))}</blockquote>`;
      continue;
    }

    // unordered list
    if (/^\s*[-*]\s+/.test(line)) {
      if (listType !== 'ul') { closeList(); html += '<ul>'; listType = 'ul'; }
      html += `<li>${inline(line.replace(/^\s*[-*]\s+/, ''))}</li>`;
      i++;
      continue;
    }
    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      if (listType !== 'ol') { closeList(); html += '<ol>'; listType = 'ol'; }
      html += `<li>${inline(line.replace(/^\s*\d+\.\s+/, ''))}</li>`;
      i++;
      continue;
    }

    // blank
    if (!line.trim()) { closeList(); i++; continue; }

    // paragraph (junta líneas consecutivas)
    closeList();
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim() &&
           !/^(#{1,3}\s|>|\s*[-*]\s|\s*\d+\.\s|```|\|)/.test(lines[i])) {
      buf.push(lines[i]);
      i++;
    }
    html += `<p>${inline(buf.join(' '))}</p>`;
  }
  closeList();
  return html;
}

window.renderMarkdown = renderMarkdown;
window.escHtml = escHtml;
