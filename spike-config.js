// Spike decision test settings.
// Each situation is one moment of a spike round, shown once with the current HUD
// and once with the redesign. The tester decides: can I still defuse, or is it too late?
//
// To add a situation: put the two screenshots in frames/ (or frames/spike/) and add a line below.
//   timeLeft: seconds left on the spike in that screenshot (for your notes and the results table)
//   answer:   'defuse' if there is still time, 'late' if there isn't
// A defuse takes 7 seconds (3.5 with a kit).

window.SPIKE_TEST = {
  // How long the tester has to decide before the trial counts as missed (milliseconds)
  timeoutMs: 5000,
  // Blank pause before each screenshot appears (milliseconds)
  fixationMs: 800,

  situations: [
    { id: 's1', timeLeft: 10, answer: 'defuse', current: 'frames/spike-before-normal.jpg',  redesign: 'frames/spike-after-normal.jpg' },
    { id: 's2', timeLeft: 5,  answer: 'late',   current: 'frames/spike-before-warning.jpg', redesign: 'frames/spike-after-warning.jpg' },
    // { id: 's3', timeLeft: 8, answer: 'defuse', current: 'frames/spike/s3-current.jpg', redesign: 'frames/spike/s3-redesign.jpg' },
  ],

  // Optional fixed order for version A, as [situation id, 'current' | 'redesign'].
  // Leave it empty to build it automatically (versions alternate, a situation's two
  // versions are never back to back when there are 3+ situations). Version B is A flipped.
  orderA: [],
};
