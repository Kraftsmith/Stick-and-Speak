// The frame and the stage. The frame is the 1280×800 picture every screen is drawn in; it is scaled to fit the window
// and centred. The stage is the whole window around it: the screen's background runs out to the window's edges and
// the controls at the edges (Back, coins, sound) sit at the window's edges, so there are no bars at the sides.
// All geometry is in frame pixels: pt() and rectIn() are relative to the frame.
export const $ = id => document.getElementById(id);
export const stage = $('stage'), frame = $('frame');
export let scale = 1;

const px = v => parseFloat(v) || 0;
// The window's safe area (a notch, a camera hole, the home indicator) in CSS px: env() where the browser knows it
// (iOS, newer Android WebViews), else the values Capacitor injects on Android (--safe-area-inset-*).
function safeArea() {
  const cs = getComputedStyle(document.documentElement);
  const g = side => Math.max(px(cs.getPropertyValue('--env-' + side)), px(cs.getPropertyValue('--safe-area-inset-' + side)));
  return { left: g('left'), right: g('right'), top: g('top'), bottom: g('bottom') };
}

// Stage variables, in frame px, for the style sheets:
//   --bx, --by   how far the window reaches beyond the frame on each side (the "bleed"); one of them is 0
//   --sl, --sr, --st, --sb   the safe-area insets, for what sits on the stage itself
//   --el, --er   the window's safe left / right edge relative to the frame's edge (0 or negative), for what sits
//                inside a screen but is pinned to the window's edge
export function fit() {
  scale = Math.min(innerWidth / 1280, innerHeight / 800);
  const W = innerWidth / scale, H = innerHeight / scale, bx = (W - 1280) / 2, by = (H - 800) / 2, s = safeArea();
  stage.style.width = W + 'px'; stage.style.height = H + 'px'; stage.style.transform = `scale(${scale})`;
  const v = { bx, by, sl: s.left / scale, sr: s.right / scale, st: s.top / scale, sb: s.bottom / scale };
  v.el = Math.min(0, v.sl - bx); v.er = Math.min(0, v.sr - bx);
  for (const k in v) stage.style.setProperty('--' + k, v[k].toFixed(2) + 'px');
}
addEventListener('resize', fit); fit();
// the safe-area values may arrive after the page is up (Capacitor on Android sets them on <html>)
new MutationObserver(fit).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });

export function pt(ev) { const r = frame.getBoundingClientRect(); return { x: (ev.clientX - r.left) / scale, y: (ev.clientY - r.top) / scale }; }
export function rectIn(el) { const r = el.getBoundingClientRect(), s = frame.getBoundingClientRect();
  return { x:(r.left-s.left)/scale, y:(r.top-s.top)/scale, w:r.width/scale, h:r.height/scale }; }
export const capture = (el, ev) => { try { el.setPointerCapture(ev.pointerId); } catch (e) {} };
