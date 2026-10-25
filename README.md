# Proof of Quest engine

**Every Bitcoin block is a dungeon.** A retro action RPG where each level is generated from a real Bitcoin block: hash, transactions, fees, mining pool, difficulty and timing all shape the floor you play.

This is the open source engine of [Proof of Quest](https://poq.halvinglabs.it), a project by [Halving Labs](https://www.halvinglabs.it). It is released under the MIT license, in the spirit of Bitcoin: use it, study it, fork it, build your own game on it. Just keep the credit (see [Credits](#credits)).

- One HTML file, vanilla JavaScript and canvas. No build step, no runtime dependencies.
- Block data from the public [mempool.space](https://mempool.space) API, called from the player's browser.
- Optional shared leaderboard on Cloudflare Workers + D1.
- Works on computers (keyboard) and phones (touch controls).
- Code comments are in Italian; all game texts are in English.

## Play locally

```
npm run serve
```

Open http://127.0.0.1:8742/play/. Without network access to mempool.space the game offers only the history mode (built-in blocks).

With the leaderboard and a local database:

```
npm install
npm run dev
```

## From block to level

| Block data | In the game |
|---|---|
| Hash | Seed of the generator: rooms, corridors, positions, chest contents |
| Transactions | Number of rooms and enemies |
| Weight | Map size |
| Median fee | Loot only: richer sats from enemies, guardian and chests. 50 sat/vB or more = "fee war" with rain |
| Total fees | Sats multiplier |
| Time since the previous block | Vision radius (fast block = wide view, slow block = fog) |
| Mining pool | The guardian of the floor, with its own name, special move and sprite |
| Solo-mined block (live game only) | The rare legendary boss, the Lone Miner |
| Difficulty | Guardian HP |
| Average block time in the difficulty epoch | Strength of every enemy. Hostile epochs (1.5× the 10 minutes or more) can be skipped by waiting for the retarget |
| Leading zeros of the hash | Chance of relics in the chests |
| Nonce | Number of chests |
| Height / 210,000 | Halving era: 4-colour palette |
| Halving block | Max HP +10 |
| Retarget block | Healing shrine |

Healing, parrying and spells cost sats at fixed prices, and sats are the score: the leaderboard rewards players who manage damage well.

## Modes

- **Live game**: start 6 blocks behind the tip and climb to the present, then wait for the next real block. The only mode sent to the leaderboard.
- **Pick a block**: any height. Not ranked.
- **History mode**: a sequence of built-in blocks with short texts, playable offline. Not ranked. Its content comes from `content.js` (below).

## Your own content: `public/play/content.js`

The engine contains no story content. Chapters, block captions, intro texts and the donation link live in `public/play/content.js`, which sets `window.PQ_CONTENT`. The file in this repository is a one-block example. Every field is optional, and without the file the game still runs.

```js
window.PQ_CONTENT = {
  supportUrl: '',                 // your donation page, or empty
  history: {
    name: 'MY HISTORY', chapter: 'CHAPTER 1', short: 'CH 1', sub: 'not ranked',
    end: {title: 'THE END', text: '...'},
    blocks: [
      {height: 0, legend: 'Card line', scrolls: ['Scroll 1', 'Scroll 2', 'Scroll 3'], outro: 'After the guardian'},
    ],
  },
  legends: {840000: 'Card line for a built-in block'},
  intro: [{d: 6000, scene: 'tower', y: 146, text: 'INTRO TEXT'}],
};
```

Built-in blocks: 0, 170, 57043, 97231, 210000, 420000, 630000, 689420, 689472, 840000. For other blocks add `block` (same fields as `LEGENDS` in the game) and `epoch` (same fields as `EPOCHS`).

The chapters of the official game are written by Halving Labs and are **not** part of this repository or of the MIT license.

## Deploy on Cloudflare (optional leaderboard)

1. Copy `.env.cloudflare.example` to `.env.cloudflare` and fill in an API token (template "Edit Cloudflare Workers" plus Account › D1 › Edit) and your account ID. Never commit this file.
2. Change `"name"` in `wrangler.jsonc` to your own Worker name.
3. `./setup-db.sh` once: creates the D1 database and its tables.
4. `./deploy.sh` to publish (`./deploy.sh test` for a preview URL).
5. `./classifica.sh` lists the leaderboard, `./classifica.sh rimuovi "Name"` removes a player.

If you put the Worker behind your own reverse proxy, set a `PROXY_KEY` secret with `wrangler secret put PROXY_KEY` and send it in the `X-PoQ-Proxy` header together with `X-Real-IP`. Without it the Worker uses `CF-Connecting-IP`.

Security headers for the pages (Content-Security-Policy and others) are in `public/_headers`. If you load anything from a new domain, add it there.

Optional: set a `RATE_SALT` secret (`wrangler secret put RATE_SALT`) so the IP fingerprints in the rate-limit table cannot be reversed.

The name filter lives in `src/names.js` and is copied into the game by `node scripts/sync-names.mjs` (run by `deploy.sh`).

## Credits

Proof of Quest engine © 2026 Mario De Rosa · [Halving Labs](https://www.halvinglabs.it), MIT license.

If you build something with this engine, please:

- keep the `LICENSE` file and the copyright line (the MIT license requires it);
- credit the project where players can see it, for example "Based on Proof of Quest by Halving Labs" with a link to https://poq.halvinglabs.it;
- give your game its own name and look. "Proof of Quest", "Halving Labs" and their logos are not covered by the MIT license.

## Contributing

Issues and pull requests are welcome. By sending a contribution you agree that it is released under the MIT license of this repository.

Want to support the project? The official game has a ⚡ SUPPORT link: donations fund free Bitcoin projects by Halving Labs and give nothing inside the game.
