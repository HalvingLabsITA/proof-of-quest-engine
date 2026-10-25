#!/usr/bin/env bash
# Prima configurazione del database della classifica (Cloudflare D1). Si lancia una volta sola.
# Rilanciarlo non fa danni: se il database esiste già lo riusa e le tabelle non vengono toccate.
#   1. crea il database "proof-of-quest" (dati conservati nell'Unione Europea)
#   2. scrive il suo ID in wrangler.jsonc
#   3. crea le tabelle (schema.sql)
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f .env.cloudflare ]; then echo "Manca .env.cloudflare (vedi README.md)."; exit 1; fi
set -a; source .env.cloudflare; set +a
export WRANGLER_SEND_METRICS=false
DB=proof-of-quest

find_id() { npx wrangler d1 list --json 2>/dev/null | node scripts/d1-id.mjs "$DB"; }

ID="$(find_id)"
if [ -z "$ID" ]; then
  echo "Creo il database $DB..."
  npx wrangler d1 create "$DB" --jurisdiction eu --no-update-config
  ID="$(find_id)"
fi
if [ -z "$ID" ]; then echo "Non trovo l'ID del database. Il token ha il permesso D1 - Modifica? (vedi README.md)"; exit 1; fi
echo "Database $DB: $ID"

node -e 'const fs=require("fs");const f="wrangler.jsonc";const s=fs.readFileSync(f,"utf8");const o=s.replace(/"database_id":\s*"[^"]*"/,`"database_id": "${process.argv[1]}"`);if(o!==s){fs.writeFileSync(f,o);console.log("wrangler.jsonc aggiornato.")}else console.log("wrangler.jsonc già a posto.")' "$ID"

echo "Creo le tabelle (se mancano)..."
npx wrangler d1 execute "$DB" --remote --file=schema.sql --yes
echo "Fatto. Ora puoi pubblicare con ./deploy.sh"
