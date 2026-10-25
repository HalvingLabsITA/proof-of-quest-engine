-- Proof of Quest: database della classifica (Cloudflare D1).
-- Si applica con ./setup-db.sh (o: npx wrangler d1 execute proof-of-quest --remote --file=schema.sql)

-- Un giocatore = un id casuale generato dal browser. Per ognuno si tiene la partita live migliore.
CREATE TABLE IF NOT EXISTS players (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  name_key    TEXT NOT NULL,          -- nome normalizzato (i nomi non sono unici: come in sala giochi)
  best_sats   INTEGER NOT NULL DEFAULT 0,
  best_height INTEGER,
  best_floors INTEGER,
  legends     INTEGER NOT NULL DEFAULT 0,  -- Minatori Solitari battuti nella partita migliore
  best_lvl    INTEGER,                     -- livello dell'eroe nella partita migliore (grado di Bitcointalk in classifica)
  run_id      TEXT,
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  last_submit INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_players_rank ON players (best_sats DESC, updated_at ASC);

-- Limite di frequenza per rete: solo l'impronta dell'IP (non l'IP), cancellata dopo 2 ore.
CREATE TABLE IF NOT EXISTS rate (
  ip_hash TEXT NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate ON rate (ip_hash, ts);

-- PASSWORD stile NES per continuare la partita su un altro dispositivo.
-- Solo l'impronta della password, mai la password. Una riga per password.
CREATE TABLE IF NOT EXISTS passwords (
  pass_hash  TEXT PRIMARY KEY,
  player_id  TEXT NOT NULL,
  name       TEXT,
  data       TEXT NOT NULL,          -- JSON {save, albo}: le stesse chiavi del localStorage del gioco
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_passwords_player ON passwords (player_id);
