// Filtro dei nomi in classifica. FONTE UNICA: modifica solo questo file.
// Il gioco (public/index.html) ne contiene una copia tra i marcatori NAMES:START / NAMES:END,
// riallineata in automatico da scripts/sync-names.mjs (lo lancia deploy.sh prima di ogni pubblicazione).
// Usato sia nel browser (per avvisare subito il giocatore) sia nel Worker (che decide davvero).

const NAME_MIN = 2, NAME_MAX = 12;
const NAME_ALLOWED = /^[\p{L}\p{N} ._'-]+$/u;
// Numeri e simboli usati al posto delle lettere ("c4zz0", "$tr0nz0")
const NAME_LEET = {'0': 'o', '1': 'i', '2': 'z', '3': 'e', '4': 'a', '5': 's', '6': 'g', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'i', '€': 'e', '+': 't'};
// Radici vietate: offese, volgarità, discriminazioni, bestemmie (confrontate dopo aver ridotto le lettere doppie).
const NAME_BLOCKED = [
  'cazo', 'stronz', 'puttan', 'putan', 'troia', 'merda', 'coglion', 'vafanculo', 'fanculo', 'minchi', 'pompin',
  'sbora', 'zocol', 'frocio', 'froci', 'richion', 'negro', 'negra', 'negri', 'niger', 'niga', 'culo', 'suca',
  'ritardat', 'mongoloid', 'handicapat', 'porcodio', 'diocan', 'dioporc', 'porcamadon', 'diobestia', 'dioboia',
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'pusy', 'whore', 'slut', 'porn', 'rapist', 'fagot', 'retard',
  'penis', 'vagina', 'dildo', 'hitler', 'heilhitler', 'siegheil', 'nazist', 'faggot', 'motherf', 'asshole', 'bastard'
];
// Nomi che si spacciano per il progetto o lo staff
const NAME_RESERVED = ['halvinglabs', 'halving', 'proofofquest', 'admin', 'amministrator', 'moderator', 'moderat',
  'staff', 'ufficial', 'oficial', 'sistema', 'system', 'root', 'suport'];

function nameClean(raw) {
  return String(raw == null ? '' : raw).normalize('NFC').replace(/\s+/g, ' ').trim();
}
// Riduce il nome alla sua "ossatura": minuscolo, senza accenti, numeri-lettere convertiti, solo a-z, niente doppie.
function nameSkeleton(name) {
  let s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  s = s.replace(/[0-9@$!|€+]/g, c => NAME_LEET[c] || c);
  s = s.replace(/[^a-z]/g, '');
  return s.replace(/(.)\1+/g, '$1');
}
// Chiave normalizzata del nome ("Mario", "MARIO" e "M4rio" danno la stessa): oggi serve solo come informazione, i nomi non sono più unici.
function nameKey(raw) {
  const name = nameClean(raw);
  return nameSkeleton(name) || name.toLowerCase();
}
function checkName(raw) {
  const name = nameClean(raw);
  if (name.length < NAME_MIN) return {ok: false, reason: 'Name too short: at least 2 characters.'};
  if (name.length > NAME_MAX) return {ok: false, reason: 'Name too long: 12 characters max.'};
  if (!NAME_ALLOWED.test(name)) return {ok: false, reason: "Use only letters, numbers, spaces and . _ - '"};
  const low = name.toLowerCase();
  if (/https?|www\.|\.(com|it|io|net|org|xyz|me|ly|gg|co)\b|t\.me/.test(low)) return {ok: false, reason: 'No links or addresses in the name.'};
  if ((name.match(/\d/g) || []).length >= 6) return {ok: false, reason: 'Too many digits: no phone numbers or codes.'};
  if (/k\s*k\s*k/.test(low)) return {ok: false, reason: 'This name is not allowed. Pick another one.'};
  const sk = nameSkeleton(name);
  const squash = w => w.replace(/(.)\1+/g, '$1');
  if (NAME_RESERVED.some(r => sk.includes(squash(r)))) return {ok: false, reason: 'This name is reserved. Pick another one.'};
  if (NAME_BLOCKED.some(b => sk.includes(squash(b)))) return {ok: false, reason: 'This name is not allowed. Pick another one.'};
  return {ok: true, name, key: nameKey(name)};
}

export { checkName, nameKey, nameClean, NAME_MAX };
