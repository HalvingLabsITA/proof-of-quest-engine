// Legge l'output di "wrangler d1 list --json" e stampa l'ID del database col nome indicato (vuoto se non esiste).
// Uso: npx wrangler d1 list --json | node scripts/d1-id.mjs proof-of-quest
let s = '';
process.stdin.on('data', d => s += d).on('end', () => {
  try {
    const list = JSON.parse(s.slice(s.search(/^\s*\[\s*[{\]]/m)));
    const db = list.find(x => x.name === process.argv[2]);
    process.stdout.write(db ? db.uuid : '');
  } catch (e) { /* nessun elenco leggibile: stampa vuoto */ }
});
