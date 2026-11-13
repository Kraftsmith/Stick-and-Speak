import { SETS } from './data.js';

// Screen state that is not saved between visits. Modules read and write these fields directly.
export const U = {
  current: 'home',       // the open screen
  home: 'home',          // where Back leads from the top screens: 'home', or 'who' while nobody is chosen yet
  streak: 0,             // correct answers in a row (a bonus every third)
  pathTr: 'main',        // the level shown on the lesson path
  sceneId: 'farm',       // the album page
  parentThen: null,      // what the parent code unlocks: null = the parent zone, 'extend' = 15 more minutes
};
// lesson screens: quiet music; spoken instructions can be switched off there (settings)
export const LESSON_SCREENS = ['intro', 'quiz', 'trace', 'puzzle', 'pairs', 'lines', 'race'];
