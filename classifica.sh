#!/usr/bin/env bash
# Moderazione della classifica (database D1 su Cloudflare). Si lancia dal computer che fa il deploy.
#   ./classifica.sh                  mostra i primi 30
#   ./classifica.sh cerca "testo"    cerca i nomi che contengono il testo
#   ./classifica.sh rimuovi "Nome"   cancella quel giocatore dalla classifica (il nome torna libero)
set -euo pipefail
cd "$(dirname "$0")"
set -a; source .env.cloudflare; set +a
export WRANGLER_SEND_METRICS=false
q() { printf "%s" "$1" | sed "s/'/''/g"; }   # protegge gli apostrofi nei nomi
run() { npx wrangler d1 execute proof-of-quest --remote --command "$1"; }
case "${1:-}" in
  "")      run "SELECT name AS nome, best_sats AS sats, best_floors AS piani, legends AS leggende, datetime(updated_at/1000,'unixepoch') AS aggiornato FROM players ORDER BY best_sats DESC, updated_at ASC LIMIT 30" ;;
  cerca)   run "SELECT name AS nome, best_sats AS sats, datetime(updated_at/1000,'unixepoch') AS aggiornato FROM players WHERE name LIKE '%$(q "${2:?scrivi il testo da cercare}")%' LIMIT 50" ;;
  rimuovi) N="$(q "${2:?scrivi il nome da rimuovere}")"
           run "SELECT name, best_sats FROM players WHERE name = '$N'"
           read -rp "Cancello questo giocatore? (s/N) " ok
           [ "$ok" = "s" ] && run "DELETE FROM players WHERE name = '$N'" && echo "Rimosso." || echo "Annullato." ;;
  *)       sed -n '2,5p' "$0" ;;
esac
