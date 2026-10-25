#!/usr/bin/env bash
# Pubblica su Cloudflare (gioco + classifica).
#   ./deploy.sh        produzione  -> https://<nome-worker>.<sottodominio>.workers.dev
#   ./deploy.sh test   anteprima   -> https://test-<nome-worker>.<sottodominio>.workers.dev (la produzione non cambia)
# Attenzione: anche l'anteprima scrive nella classifica vera (stesso database). Per togliere un nome: ./classifica.sh rimuovi "Nome"
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env.cloudflare ]; then echo "Manca .env.cloudflare: copia .env.cloudflare.example e inserisci token e account ID (vedi README.md)."; exit 1; fi
if grep -q '"DA_CONFIGURARE"' wrangler.jsonc; then echo "Database della classifica non ancora configurato: lancia prima ./setup-db.sh"; exit 1; fi
set -a; source .env.cloudflare; set +a
export WRANGLER_SEND_METRICS=false
node scripts/sync-names.mjs   # stesso filtro dei nomi nel gioco e nel server
if [ "${1:-}" = "test" ]; then
  npx wrangler versions upload --preview-alias test
else
  npx wrangler deploy
fi
