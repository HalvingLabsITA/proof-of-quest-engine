// Copia il filtro dei nomi (src/names.js) dentro il gioco (public/play/index.html), tra i marcatori NAMES:START e NAMES:END.
// Lo lancia deploy.sh prima di ogni pubblicazione, così browser e server usano sempre lo stesso filtro.
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('../src/names.js', import.meta.url), 'utf8')
  .split('\n').filter(l => !/^export\s/.test(l) && !/^\/\/ (FONTE UNICA|Il gioco|riallineata|Usato sia)/.test(l)).join('\n').trim();
const file = new URL('../public/play/index.html', import.meta.url);
const html = readFileSync(file, 'utf8');
const re = /\/\* NAMES:START \*\/[\s\S]*?\/\* NAMES:END \*\//;
if (!re.test(html)) { console.error('Marcatori NAMES:START / NAMES:END non trovati in public/play/index.html'); process.exit(1); }
const out = html.replace(re, () => `/* NAMES:START */\n${src}\n/* NAMES:END */`); // funzione: i "$" del filtro non vanno interpretati
if (out !== html) { writeFileSync(file, out); console.log('Filtro nomi aggiornato nel gioco.'); } else console.log('Filtro nomi già allineato.');
