/** Orbit log definitions. Shared by server-rendered markup and the client module. */
export type StarId = 'sound' | 'note' | 'spin' | 'loop' | 'share' | 'night' | 'eclipse';

export const STARS: { id: StarId; title: string; hint: string }[] = [
  { id: 'sound', title: 'Let there be sound', hint: 'Turn the sound on.' },
  { id: 'note', title: 'First note', hint: 'Tap a ring to place a note.' },
  { id: 'spin', title: 'Turn of phrase', hint: 'Turn a ring to shift the groove.' },
  { id: 'loop', title: 'Eight-note loop', hint: 'Make a loop with eight notes or more.' },
  { id: 'share', title: 'Pass it on', hint: 'Share a loop with someone.' },
  { id: 'night', title: 'Night owl', hint: 'Stay until nightfall on the home page.' },
  { id: 'eclipse', title: 'Totality', hint: 'Something in the footer eclipses when tapped three times.' },
];

export const REWARD_AT = 5;
