// Example content for the Proof of Quest engine. Replace it with your own.
// The engine reads window.PQ_CONTENT. Every field is optional: without this file the game still works
// (live chain and "pick a block"), only the history mode, the intro and the support link disappear.
window.PQ_CONTENT = {
  // Optional donation page, shown under the title leaderboard and at the end of the history mode.
  supportUrl: '',
  supportLink: '⚡ SUPPORT',
  supportSub: '',

  // History mode: blocks played in order, offline too. Each block shows "legend" on its card,
  // hides its "scrolls" in the dungeon (walk over them to read) and shows "outro" after the guardian.
  // Blocks 0, 170, 57043, 97231, 210000, 420000, 630000, 689420 and 840000 are built in.
  // For any other block add its data in "block" (same fields as LEGENDS in the game) and its epoch in "epoch" (same fields as EPOCHS).
  history: {
    name: 'DEMO HISTORY',
    chapter: 'A ONE-BLOCK EXAMPLE',
    short: 'DEMO',
    sub: 'example chapter · not ranked',
    offline: 'the demo chapter',
    end: {title: 'THE END', text: 'Write your own chapter in public/play/content.js.', again: 'PLAY AGAIN', last: 'the end of the demo'},
    blocks: [
      {height: 0,
       legend: 'Block 0. Your first line goes here.',
       scrolls: ['This is a scroll: walk over it to read it.', 'Keep each line short: it must fit the message bar.', 'Add as many blocks as you like.'],
       outro: 'The guardian is down. The next block awaits.'},
    ],
  },

  // Short lines shown on the card of built-in blocks outside the history mode, by height.
  legends: {},

  // Intro video (title menu item INTRO). Scenes: genesis, tower, hero, bugs, pools, climb, title.
  // d = duration in ms, y = text position on the 256×192 scene. Leave empty to hide the INTRO item.
  intro: [],
};
