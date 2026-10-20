// Screening room (silent loops + theater playback), VFX compare, polaroid wall.

const fine = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

/* --------------------------------------------------------------------------
   Loops: only load and play while on screen
   -------------------------------------------------------------------------- */

export function initLoops({ reduced }) {
  const videos = [...document.querySelectorAll('video[data-loop]')];
  const html = document.documentElement;
  const visible = new Set();

  const canPlay = () => !reduced && !html.classList.contains('motion-paused') && !html.classList.contains('theater-open');
  const play = (v) => {
    if (!v.src) v.src = v.dataset.loop;
    const p = v.play();
    if (p && p.catch) p.catch(() => {});
  };
  const sync = () => videos.forEach((v) => (visible.has(v) && canPlay() ? play(v) : v.pause()));

  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) visible.add(e.target);
      else visible.delete(e.target);
    });
    sync();
  }, { threshold: 0.35 });
  videos.forEach((v) => io.observe(v));

  // Reduced motion: still let people preview on hover/focus
  if (reduced) {
    videos.forEach((v) => {
      const host = v.closest('button');
      host.addEventListener('pointerenter', () => play(v));
      host.addEventListener('pointerleave', () => v.pause());
    });
  }
  return { sync };
}

/* --------------------------------------------------------------------------
   Theater: full-screen playback with sound, flies out of the clicked screen
   -------------------------------------------------------------------------- */

export function initTheater({ gsap, lenis, loops, scramble }) {
  const html = document.documentElement;
  const root = document.querySelector('[data-theater]');
  const house = root.querySelector('[data-theater-house]');
  const stage = root.querySelector('[data-theater-stage]');
  const video = root.querySelector('[data-theater-video]');
  const title = root.querySelector('[data-theater-title]');
  const kicker = root.querySelector('[data-theater-kicker]');
  const closeBtn = root.querySelector('[data-theater-close]');
  const label = document.querySelector('[data-scene-label]');
  const triggers = [...document.querySelectorAll('[data-play]')];
  let index = -1;
  let opener = null;
  let sceneBefore = '';

  const ratioOf = (btn) => {
    if (btn.closest('.daily--tall')) return 9 / 16;
    if (btn.closest('.vfx')) return 3 / 2;
    return 16 / 9;
  };

  const load = (i) => {
    index = (i + triggers.length) % triggers.length;
    const btn = triggers[index];
    stage.style.setProperty('--ar', ratioOf(btn).toFixed(4));
    video.src = `assets/media/${btn.dataset.play}.mp4`;
    video.poster = `assets/media/${btn.dataset.play}.jpg`;
    title.textContent = btn.dataset.title;
    kicker.textContent = btn.dataset.kicker + (btn.hasAttribute('data-silent') ? ' · picture only' : '');
    scramble(label, `PROJECTING · ${btn.dataset.title.toUpperCase()}`);
    const p = video.play();
    if (p && p.catch) p.catch(() => {});
  };

  const open = (btn) => {
    opener = btn;
    sceneBefore = label.textContent;
    root.hidden = false;
    html.classList.add('theater-open');
    lenis?.stop();
    loops.sync();
    load(triggers.indexOf(btn));

    // FLIP: start the stage where the clicked screen is
    const from = btn.getBoundingClientRect();
    const to = stage.getBoundingClientRect();
    gsap.fromTo(house, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
    gsap.fromTo(stage, {
      x: from.left - to.left,
      y: from.top - to.top,
      scaleX: from.width / to.width,
      scaleY: from.height / to.height,
    }, { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.85, ease: 'expo.inOut' });
    gsap.fromTo(root.querySelectorAll('.theater__meta, .theater__nav'), { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.5, delay: 0.5 });
    closeBtn.focus({ preventScroll: true });
  };

  const close = () => {
    if (root.hidden) return;
    video.pause();
    const done = () => {
      root.hidden = true;
      video.removeAttribute('src');
      video.load();
      html.classList.remove('theater-open');
      lenis?.start();
      loops.sync();
      label.textContent = sceneBefore;
      opener?.focus({ preventScroll: true });
    };
    const target = triggers[index];
    const from = stage.getBoundingClientRect();
    const to = target.getBoundingClientRect();
    gsap.to(house, { opacity: 0, duration: 0.45, delay: 0.2 });
    gsap.to(stage, {
      x: to.left - from.left,
      y: to.top - from.top,
      scaleX: to.width / from.width,
      scaleY: to.height / from.height,
      duration: 0.65,
      ease: 'expo.inOut',
      onComplete: () => { gsap.set(stage, { clearProps: 'transform' }); done(); },
    });
  };

  triggers.forEach((btn) => btn.addEventListener('click', () => open(btn)));
  closeBtn.addEventListener('click', close);
  house.addEventListener('click', close);
  root.querySelector('[data-theater-prev]').addEventListener('click', () => load(index - 1));
  root.querySelector('[data-theater-next]').addEventListener('click', () => load(index + 1));
  video.addEventListener('ended', () => load(index + 1));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    if (e.key === 'Tab') {
      const items = [...root.querySelectorAll('button, video')].filter((el) => el.offsetParent !== null);
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* --------------------------------------------------------------------------
   VFX compare slider
   -------------------------------------------------------------------------- */

export function initCompare({ gsap, ScrollTrigger, reduced }) {
  const root = document.querySelector('[data-compare]');
  if (!root) return;
  const range = root.querySelector('[data-compare-range]');
  const before = root.querySelector('[data-compare-before]');
  const tag = root.querySelector('[data-compare-tag]');
  const proxy = { v: 50 };
  const set = (v) => {
    proxy.v = v;
    root.style.setProperty('--pos', `${v}%`);
    range.value = v;
  };
  const tweenTo = (vars) => gsap.to(proxy, { ...vars, onUpdate: () => set(proxy.v) });
  range.addEventListener('input', () => { gsap.killTweensOf(proxy); set(Number(range.value)); });

  // Hover scrubbing on desktop, so it works without a drag
  if (fine()) {
    root.addEventListener('pointermove', (e) => {
      if (e.buttons) return;
      gsap.killTweensOf(proxy);
      const r = root.getBoundingClientRect();
      set(Math.max(0, Math.min(100, ((e.clientX - r.left) / r.width) * 100)));
    });
  }

  document.querySelectorAll('[data-stage]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-stage]').forEach((b) => b.classList.toggle('is-active', b === btn));
      before.src = btn.dataset.stage;
      tag.textContent = `Before · ${btn.dataset.stageLabel}`;
      if (!reduced) {
        gsap.killTweensOf(proxy);
        set(92);
        tweenTo({ v: 50, duration: 1.1, ease: 'expo.out' });
      }
    });
  });

  if (reduced) return;
  set(100);
  ScrollTrigger.create({
    trigger: root,
    start: 'top 70%',
    once: true,
    onEnter: () => {
      tweenTo({ v: 8, duration: 1.4, ease: 'power3.inOut' });
      tweenTo({ v: 50, duration: 1.1, ease: 'expo.out', delay: 1.4 });
    },
  });
}

/* --------------------------------------------------------------------------
   Polaroids: tossed onto the table, then draggable
   -------------------------------------------------------------------------- */

export function initPolaroids({ gsap, ScrollTrigger, reduced }) {
  const wall = document.querySelector('[data-polaroids]');
  if (!wall) return;
  const prints = [...wall.querySelectorAll('[data-polaroid]')];
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px)', () => {
    if (!reduced) {
      gsap.from(prints, {
        y: -260,
        x: () => gsap.utils.random(-80, 80),
        rotation: () => gsap.utils.random(-40, 40),
        autoAlpha: 0,
        duration: 1.1,
        ease: 'back.out(1.4)',
        stagger: 0.12,
        scrollTrigger: { trigger: wall, start: 'top 75%' },
      });
    }

    let z = 10;
    const cleanups = prints.map((p) => {
      let sx = 0;
      let sy = 0;
      let ox = 0;
      let oy = 0;
      let moved = false;
      let lastX = 0;
      let lastY = 0;
      let lastT = 0;
      let vx = 0;
      let vy = 0;

      const down = (e) => {
        if (e.button !== 0) return;
        p.setPointerCapture(e.pointerId);
        sx = e.clientX;
        sy = e.clientY;
        ox = gsap.getProperty(p, 'x');
        oy = gsap.getProperty(p, 'y');
        lastX = sx; lastY = sy; lastT = performance.now();
        moved = false;
        p.style.zIndex = ++z;
        p.classList.add('is-dragging');
        gsap.to(p, { scale: 1.05, duration: 0.25 });
      };
      const move = (e) => {
        if (!p.hasPointerCapture(e.pointerId)) return;
        const dx = e.clientX - sx;
        const dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 6) moved = true;
        const now = performance.now();
        const dt = Math.max(16, now - lastT);
        vx = (e.clientX - lastX) / dt;
        vy = (e.clientY - lastY) / dt;
        lastX = e.clientX; lastY = e.clientY; lastT = now;
        gsap.set(p, { x: ox + dx, y: oy + dy, rotation: gsap.utils.clamp(-18, 18, vx * 12) });
      };
      const up = (e) => {
        if (!p.hasPointerCapture(e.pointerId)) return;
        p.releasePointerCapture(e.pointerId);
        p.classList.remove('is-dragging');
        const w = wall.getBoundingClientRect();
        const r = p.getBoundingClientRect();
        const throwX = vx * 220;
        const throwY = vy * 220;
        const minX = w.left - r.left + gsap.getProperty(p, 'x') - r.width * 0.3;
        const maxX = w.right - r.right + gsap.getProperty(p, 'x') + r.width * 0.3;
        const minY = w.top - r.top + gsap.getProperty(p, 'y') - r.height * 0.2;
        const maxY = w.bottom - r.bottom + gsap.getProperty(p, 'y') + r.height * 0.2;
        gsap.to(p, {
          x: gsap.utils.clamp(minX, maxX, gsap.getProperty(p, 'x') + throwX),
          y: gsap.utils.clamp(minY, maxY, gsap.getProperty(p, 'y') + throwY),
          rotation: gsap.utils.random(-8, 8),
          scale: 1,
          duration: 0.9,
          ease: 'power3.out',
        });
      };
      const click = (e) => { if (moved) { e.preventDefault(); e.stopPropagation(); } };

      p.addEventListener('pointerdown', down);
      p.addEventListener('pointermove', move);
      p.addEventListener('pointerup', up);
      p.addEventListener('pointercancel', up);
      p.addEventListener('click', click, true);
      return () => {
        p.removeEventListener('pointerdown', down);
        p.removeEventListener('pointermove', move);
        p.removeEventListener('pointerup', up);
        p.removeEventListener('pointercancel', up);
        p.removeEventListener('click', click, true);
      };
    });
    return () => cleanups.forEach((fn) => fn());
  });
}
