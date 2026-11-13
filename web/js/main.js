// Stick & Play: the entry point. Importing a screen module registers it with the navigation; boot() starts the app.
import './path.js';
import './quiz.js';
import './trace.js';
import './puzzle.js';
import './pairs.js';
import './lines.js';
import './race.js';
import './album.js';
import './collection.js';
import './parent.js';
import { $ } from './stage.js';
import { registerOffline, fullscreenOnFirstTouch } from './platform.js';
import { VERSION } from './version.js';
import { boot } from './startup.js';
import { Cloud } from './cloud.js';

/* ================= start ================= */
$('note').textContent = 'Stick & Play · ' + VERSION;
registerOffline();
fullscreenOnFirstTouch();
Cloud.init();
boot();
