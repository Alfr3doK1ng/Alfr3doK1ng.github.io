// Viewfinder cursor: a small focus box that locks onto whatever you point at,
// like autofocus grabbing a subject.

const TARGETS = 'a, button, .take, [data-focus]';
const IDLE = 26;

function labelFor(el) {
  if (el.dataset.cursorText) return el.dataset.cursorText;
  if (el.matches('.take')) return el.querySelector('.take__n')?.textContent.replace('T.', 'Take ') || '';
  if (el.matches('[data-chapter]')) return 'Cut to';
  if (el.matches('a[target="_blank"]')) return 'Open ↗';
  if (el.matches('a[href^="#"]')) return 'Cut to';
  if (el.matches('button')) return 'Press';
  return '';
}

export function initCursor(gsap) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const root = document.querySelector('[data-cursor]');
  if (!root) return;
  const box = root.querySelector('[data-cursor-box]');
  const dot = root.querySelector('[data-cursor-dot]');
  const label = root.querySelector('[data-cursor-label]');

  document.documentElement.classList.add('has-cursor');

  let mx = innerWidth / 2;
  let my = innerHeight / 2;
  let target = null;
  const cur = { x: mx - IDLE / 2, y: my - IDLE / 2, w: IDLE, h: IDLE };

  addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    root.classList.add('is-visible');
  }, { passive: true });
  document.addEventListener('pointerleave', () => root.classList.remove('is-visible'));
  addEventListener('blur', () => root.classList.remove('is-visible'));
  addEventListener('pointerdown', () => root.classList.add('is-down'));
  addEventListener('pointerup', () => root.classList.remove('is-down'));

  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest?.(TARGETS) || null;
    if (t === target) return;
    target = t;
    root.classList.toggle('is-locked', !!t);
    label.textContent = t ? labelFor(t) : '';
  });

  gsap.ticker.add(() => {
    let tx, ty, tw, th;
    if (target && target.isConnected) {
      const r = target.getBoundingClientRect();
      const pad = target.matches('.take') ? 2 : 8;
      tx = r.left - pad;
      ty = r.top - pad;
      tw = r.width + pad * 2;
      th = r.height + pad * 2;
    } else {
      target = null;
      tx = mx - IDLE / 2;
      ty = my - IDLE / 2;
      tw = IDLE;
      th = IDLE;
    }
    const k = target ? 0.24 : 0.4;
    cur.x += (tx - cur.x) * k;
    cur.y += (ty - cur.y) * k;
    cur.w += (tw - cur.w) * k;
    cur.h += (th - cur.h) * k;
    box.style.transform = `translate3d(${cur.x}px, ${cur.y}px, 0)`;
    box.style.width = `${cur.w}px`;
    box.style.height = `${cur.h}px`;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
    label.style.transform = `translate3d(${cur.x}px, ${cur.y - 20}px, 0)`;
  });
}
