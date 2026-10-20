import { initHeroGL } from './hero-gl.js';
import { initCursor } from './cursor.js';
import { initLoops, initTheater, initCompare, initPolaroids } from './media.js';

const html = document.documentElement;
const reduced = html.classList.contains('reduced');
const { gsap, ScrollTrigger, SplitText } = window;

const RUNTIME_S = 3 * 60 + 12; // the "film" is 3:12 long; scroll position maps onto it
const FPS = 24;
const pad = (n) => String(n).padStart(2, '0');

if (!gsap || !ScrollTrigger || !SplitText) {
  html.classList.add('failsafe');
} else {
  boot().catch((err) => {
    console.error(err);
    html.classList.add('failsafe');
  });
}

async function boot() {
  gsap.registerPlugin(ScrollTrigger, SplitText);
  await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 2500))]);
  html.classList.add('is-ready');

  let lenis = null;
  if (!reduced) {
    html.classList.add('motion');
    if (window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 0.9 });
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add((t) => lenis.raf(t * 1000));
      gsap.ticker.lagSmoothing(0);
    }
  }

  const gl = initHeroGL(document.querySelector('[data-hero-gl]'), { reduced });
  initCursor(gsap);
  initAnchors(lenis);
  initMagnetic();
  const loops = initLoops({ reduced });
  initTheater({ gsap, lenis, loops, scramble });
  initPause(lenis, gl, loops);

  const hero = prepareHero();
  initSlugs();
  initLogline();
  initTakes();
  initReel();
  initOdometers();
  initMarquee(lenis);
  initSheet();
  initCompare({ gsap, ScrollTrigger, reduced });
  initPolaroids({ gsap, ScrollTrigger, reduced });
  initWrap();
  initCredits(lenis);
  initReveals();
  initTimeline();

  gsap.to(gl, {
    scroll: 1,
    ease: 'none',
    scrollTrigger: { trigger: '.open', start: 'top top', end: 'bottom top', scrub: true },
  });

  if (reduced) {
    hero.show();
    gl.reveal = 1;
    return;
  }
  await playLeader(lenis, () => {
    hero.play();
    gsap.to(gl, { reveal: 1, duration: 2.4, ease: 'power2.out' });
  });
}

/* --------------------------------------------------------------------------
   Intro: Academy leader countdown, then letterbox halves part
   -------------------------------------------------------------------------- */

function playLeader(lenis, onReveal) {
  const leader = document.querySelector('[data-leader]');
  const playing = leader && getComputedStyle(leader).display !== 'none';
  if (!playing) {
    leader?.remove();
    onReveal();
    return Promise.resolve();
  }
  try { sessionStorage.setItem('al:leader', '1'); } catch (e) { /* private mode */ }

  return new Promise((resolve) => {
    const num = leader.querySelector('[data-leader-num]');
    const sweep = leader.querySelector('[data-leader-sweep]');
    const stage = leader.querySelector('[data-leader-stage]');
    const dial = leader.querySelector('.leader__dial');
    const [top, bottom] = leader.querySelectorAll('.leader__half');
    lenis?.stop();

    let revealed = false;
    const reveal = () => {
      if (revealed) return;
      revealed = true;
      onReveal();
    };
    const finish = () => {
      leader.remove();
      lenis?.start();
      removeEventListener('keydown', skip);
      resolve();
    };

    const tl = gsap.timeline({ onComplete: finish });
    [3, 2, 1].forEach((n, i) => {
      const at = i * 0.48;
      tl.call(() => { num.textContent = n; }, null, at)
        .fromTo(sweep, { '--a': '0deg' }, { '--a': '360deg', duration: 0.48, ease: 'none' }, at)
        .fromTo(num, { scale: 1.12, opacity: 0.5 }, { scale: 1, opacity: 1, duration: 0.3, ease: 'power3.out' }, at);
    });
    // the "2-pop": one white frame on the two
    tl.to(dial, { backgroundColor: '#efe8db', duration: 0.042, yoyo: true, repeat: 1 }, 0.5)
      .to(stage, { opacity: 0, scale: 1.04, duration: 0.2, ease: 'power2.in' }, 1.42)
      .call(reveal, null, 1.5)
      .to(top, { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, 1.5)
      .to(bottom, { yPercent: 100, duration: 1.1, ease: 'expo.inOut' }, 1.5);

    function skip() {
      if (tl.progress() < 1) tl.progress(1);
    }
    leader.addEventListener('click', skip);
    addEventListener('keydown', skip);
  });
}

/* --------------------------------------------------------------------------
   SC.01 — Hero title: masked char reveal, then a variable-width field
   that reacts to the cursor
   -------------------------------------------------------------------------- */

function prepareHero() {
  const title = document.querySelector('[data-hero-title]');
  const fades = gsap.utils.toArray('[data-hero-fade]');
  const lines = gsap.utils.toArray('.open__line', title);
  const stretchLines = lines.filter((l) => l.hasAttribute('data-stretch'));
  const serifLine = lines.find((l) => !l.hasAttribute('data-stretch'));

  const splits = stretchLines.map((l) => new SplitText(l, { type: 'lines,chars', charsClass: 'ch', mask: 'lines' }));
  const serifSplit = new SplitText(serifLine, { type: 'lines', mask: 'lines' });
  const chars = splits.flatMap((s) => s.chars);
  const isWide = (c) => !!c.closest('.open__line--3');

  const show = () => gsap.set([title, ...fades], { autoAlpha: 1 });

  const play = () => {
    show();
    const tl = gsap.timeline({ onComplete: () => stretchField(chars, isWide) });
    tl.from(chars, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.045 })
      .fromTo(chars, { fontStretch: '62%' }, {
        fontStretch: (i, el) => (isWide(el) ? '125%' : '100%'),
        duration: 1.8,
        ease: 'expo.out',
        stagger: 0.045,
      }, 0)
      .from(serifSplit.lines, { yPercent: 110, rotate: 3, duration: 1.4, ease: 'expo.out' }, 0.35)
      .from(fades, { y: 24, autoAlpha: 0, duration: 1.1, ease: 'expo.out', stagger: 0.09 }, 0.6);

    gsap.to('.open__inner', {
      yPercent: -14,
      autoAlpha: 0.25,
      ease: 'none',
      scrollTrigger: { trigger: '.open', start: 'top top', end: 'bottom top', scrub: true },
    });
  };

  return { show, play };
}

function stretchField(chars, isWide) {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const hero = document.querySelector('.open');
  const base = chars.map((c) => (isWide(c) ? 125 : 100));
  const cur = base.slice();
  gsap.set(chars, { clearProps: 'fontStretch' });
  let mx = -1e4;
  let my = -1e4;
  let active = false;
  let settled = true;

  hero.addEventListener('pointermove', (e) => { mx = e.clientX; my = e.clientY; active = true; settled = false; });
  hero.addEventListener('pointerleave', () => { active = false; settled = false; });

  gsap.ticker.add(() => {
    if (settled || scrollY > innerHeight) return;
    const rects = chars.map((c) => c.getBoundingClientRect());
    let moving = false;
    for (let i = 0; i < chars.length; i++) {
      const r = rects[i];
      const dx = mx - (r.left + r.width / 2);
      const dy = (my - (r.top + r.height / 2)) * 1.4;
      const inf = active ? Math.exp(-(dx * dx + dy * dy) / (2 * 190 * 190)) : 0;
      // top line widens toward the cursor, bottom line condenses
      const target = base[i] + (isWide(chars[i]) ? -55 : 25) * inf;
      cur[i] += (target - cur[i]) * 0.14;
      if (Math.abs(target - cur[i]) > 0.05) moving = true;
    }
    for (let i = 0; i < chars.length; i++) chars[i].style.fontStretch = `${cur[i].toFixed(2)}%`;
    if (!moving && !active) settled = true;
  });
}

/* --------------------------------------------------------------------------
   Timeline nav + timecode + scene label
   -------------------------------------------------------------------------- */

function initTimeline() {
  const sections = gsap.utils.toArray('[data-scene]');
  const links = gsap.utils.toArray('[data-chapter]');
  const items = links.map((a) => a.parentElement);
  const lane = document.querySelector('[data-lane]');
  const playhead = document.querySelector('[data-playhead]');
  const tc = document.querySelector('[data-tc]');
  const tcMini = document.querySelector('[data-tc-mini]');
  const label = document.querySelector('[data-scene-label]');
  let tops = [];
  let laneW = 0;
  let current = -1;

  const outer = (el) => (el.parentElement?.classList.contains('pin-spacer') ? el.parentElement : el);

  const measure = () => {
    const docH = document.documentElement.scrollHeight;
    tops = sections.map((s) => outer(s).getBoundingClientRect().top + scrollY);
    tops.forEach((top, i) => {
      const next = i < tops.length - 1 ? tops[i + 1] : docH;
      items[i].style.flexGrow = String(Math.max(next - top, 1));
    });
    laneW = lane.clientWidth;
    update();
  };

  const update = () => {
    const y = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    playhead.style.transform = `translate3d(${(p * laneW).toFixed(1)}px, 0, 0)`;

    const frames = Math.round(p * RUNTIME_S * FPS);
    const ff = frames % FPS;
    const s = Math.floor(frames / FPS);
    tc.textContent = `00:${pad(Math.floor(s / 60))}:${pad(s % 60)}:${pad(ff)}`;
    tcMini.textContent = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;

    const probe = y + innerHeight * 0.45;
    let idx = 0;
    for (let i = 0; i < tops.length; i++) if (probe >= tops[i]) idx = i;
    if (idx !== current) {
      current = idx;
      links.forEach((a, i) => {
        a.classList.toggle('is-active', i === idx);
        a.classList.toggle('is-past', i < idx);
        if (i === idx) a.setAttribute('aria-current', 'true');
        else a.removeAttribute('aria-current');
      });
      scramble(label, sections[idx].dataset.scene);
    }
  };

  ScrollTrigger.addEventListener('refresh', measure);
  addEventListener('scroll', update, { passive: true });
  measure();
}

function scramble(el, text) {
  if (reduced) { el.textContent = text; return; }
  const glyphs = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const from = el.textContent;
  const total = 16;
  let frame = 0;
  cancelAnimationFrame(el._raf);
  const tick = () => {
    frame++;
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const at = (i / text.length) * total;
      const ch = text[i];
      if (frame >= at + 5 || ch === ' ' || ch === '·') out += ch;
      else if (frame >= at) out += glyphs[(Math.random() * glyphs.length) | 0];
      else out += from[i] || '';
    }
    el.textContent = out;
    if (frame < total + 5) el._raf = requestAnimationFrame(tick);
    else el.textContent = text;
  };
  tick();
}

/* --------------------------------------------------------------------------
   Slug headers: chars rise, the title breathes wider as it scrolls in,
   the slugline types itself out
   -------------------------------------------------------------------------- */

function initSlugs() {
  gsap.utils.toArray('[data-slug]').forEach((slug) => {
    const title = slug.querySelector('.slug__title');
    if (reduced) return;
    const split = new SplitText(title, { type: 'words,chars', charsClass: 'ch' });
    gsap.from(split.chars, {
      yPercent: 90,
      autoAlpha: 0,
      duration: 1,
      ease: 'expo.out',
      stagger: 0.035,
      scrollTrigger: { trigger: slug, start: 'top 85%' },
    });
    gsap.fromTo(title, { fontStretch: '62%' }, {
      fontStretch: '100%',
      ease: 'none',
      scrollTrigger: { trigger: slug, start: 'top 95%', end: 'top 30%', scrub: true },
    });
    gsap.fromTo(slug, { '--s': 0 }, {
      '--s': 1,
      duration: 1.4,
      ease: 'expo.out',
      scrollTrigger: { trigger: slug, start: 'top 90%' },
    });
  });

  if (reduced) return;
  gsap.utils.toArray('[data-type]').forEach((el) => {
    const split = new SplitText(el, { type: 'chars' });
    gsap.from(split.chars, {
      autoAlpha: 0,
      duration: 0.01,
      stagger: 0.022,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 92%' },
    });
  });
}

/* --------------------------------------------------------------------------
   SC.02 — Logline: words light up as you read; casting card parallax
   -------------------------------------------------------------------------- */

function initLogline() {
  const text = document.querySelector('[data-words]');
  const card = document.querySelector('[data-casting]');
  if (reduced) return;
  const split = new SplitText(text, { type: 'words' });
  gsap.fromTo(split.words, { opacity: 0.13 }, {
    opacity: 1,
    ease: 'none',
    stagger: 0.05,
    scrollTrigger: { trigger: text, start: 'top 78%', end: 'bottom 52%', scrub: true },
  });
  text.querySelectorAll('mark').forEach((mark) => {
    gsap.fromTo(mark, { '--u': 0 }, {
      '--u': 1,
      ease: 'none',
      scrollTrigger: { trigger: mark, start: 'top 72%', end: 'top 55%', scrub: true },
    });
  });
  gsap.fromTo(card, { y: 90, rotate: 7 }, {
    y: -70,
    rotate: -2,
    ease: 'none',
    scrollTrigger: { trigger: '.logline', start: 'top bottom', end: 'bottom top', scrub: true },
  });
  gsap.fromTo(card.querySelector('img'), { scale: 1.3 }, {
    scale: 1.05,
    ease: 'none',
    scrollTrigger: { trigger: '.logline', start: 'top bottom', end: 'bottom top', scrub: true },
  });
}

/* --------------------------------------------------------------------------
   SC.03 — Takes list + the monitor that follows the cursor
   -------------------------------------------------------------------------- */

function initTakes() {
  const list = document.querySelector('[data-takes]');
  const takes = gsap.utils.toArray('.take', list);
  const monitor = document.querySelector('[data-monitor]');
  const pvs = gsap.utils.toArray('[data-pv]', monitor);
  const label = monitor.querySelector('[data-monitor-label]');

  const activate = (take) => {
    takes.forEach((t) => t.classList.toggle('is-active', t === take));
    list.classList.add('is-hovering');
    pvs.forEach((p) => p.classList.toggle('is-active', p.dataset.pv === take.dataset.take));
    label.textContent = take.querySelector('.take__name').textContent;
  };
  const clear = () => {
    takes.forEach((t) => t.classList.remove('is-active'));
    list.classList.remove('is-hovering');
  };

  takes.forEach((t) => {
    t.addEventListener('pointerenter', () => activate(t));
    t.addEventListener('focus', () => activate(t));
    t.addEventListener('blur', clear);
  });
  list.addEventListener('pointerleave', clear);

  if (!reduced) {
    takes.forEach((t) => {
      gsap.from(t.querySelectorAll('.take__name, .take__n, .take__desc'), {
        yPercent: 60,
        autoAlpha: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: t, start: 'top 94%' },
      });
    });
  }

  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  gsap.set(monitor, { xPercent: -50, yPercent: -50, scale: 0.6 });
  const xTo = gsap.quickTo(monitor, 'x', { duration: 0.65, ease: 'power3' });
  const yTo = gsap.quickTo(monitor, 'y', { duration: 0.65, ease: 'power3' });
  const rTo = gsap.quickTo(monitor, 'rotation', { duration: 0.9, ease: 'power3' });
  let lastX = 0;

  list.addEventListener('pointerenter', (e) => {
    gsap.set(monitor, { x: e.clientX, y: e.clientY });
    lastX = e.clientX;
    gsap.to(monitor, { autoAlpha: 1, scale: 1, duration: 0.55, ease: 'expo.out', overwrite: 'auto' });
  });
  list.addEventListener('pointermove', (e) => {
    xTo(e.clientX);
    yTo(e.clientY);
    rTo(gsap.utils.clamp(-10, 10, (e.clientX - lastX) * 0.5));
    lastX = e.clientX;
  });
  list.addEventListener('pointerleave', () => {
    gsap.to(monitor, { autoAlpha: 0, scale: 0.6, duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
  });
}

/* --------------------------------------------------------------------------
   SC.04 — The reel: pinned, horizontally scrubbed filmstrip on desktop,
   native swipe strip on touch / narrow screens
   -------------------------------------------------------------------------- */

function initReel() {
  const count = document.querySelector('[data-reel-count]');
  const frames = gsap.utils.toArray('[data-frame]');
  const mm = gsap.matchMedia();

  mm.add('(min-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
    const pin = document.querySelector('[data-reel-pin]');
    const strip = document.querySelector('[data-strip]');
    const track = document.querySelector('[data-strip-track]');
    const list = track.querySelector('.strip__frames');
    const dist = () => Math.max(0, track.scrollWidth - strip.clientWidth);
    const skewTo = gsap.quickTo(list, 'skewX', { duration: 0.5, ease: 'power3' });
    let settle;

    const tween = gsap.to(track, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${dist()}`,
        pin: true,
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          skewTo(gsap.utils.clamp(-5, 5, self.getVelocity() / -400));
          clearTimeout(settle);
          settle = setTimeout(() => skewTo(0), 90);
        },
      },
    });

    frames.forEach((frame, i) => {
      gsap.fromTo(frame.querySelector('[data-plate]'), { xPercent: -9 }, {
        xPercent: 9,
        ease: 'none',
        scrollTrigger: { trigger: frame, containerAnimation: tween, start: 'left right', end: 'right left', scrub: true },
      });
      gsap.from(frame.querySelectorAll('.frame__body > *'), {
        y: 30,
        autoAlpha: 0,
        duration: 0.9,
        ease: 'expo.out',
        stagger: 0.06,
        // frames already on screen when the pin starts reveal off the pin itself
        scrollTrigger: frame.getBoundingClientRect().left < innerWidth * 0.8
          ? { trigger: pin, start: 'top 55%' }
          : { trigger: frame, containerAnimation: tween, start: 'left 78%' },
      });
      ScrollTrigger.create({
        trigger: frame,
        containerAnimation: tween,
        start: 'left 55%',
        end: 'right 55%',
        onToggle: (self) => { if (self.isActive) count.textContent = pad(i + 1); },
      });
    });
  });
}

/* --------------------------------------------------------------------------
   SC.05 — Odometer numbers
   -------------------------------------------------------------------------- */

function initOdometers() {
  gsap.utils.toArray('[data-odo]').forEach((el) => {
    const text = el.textContent.trim();
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    const cols = [];
    for (const ch of text) {
      if (/\d/.test(ch)) {
        const win = document.createElement('span');
        win.className = 'odo__win';
        win.setAttribute('aria-hidden', 'true');
        const col = document.createElement('span');
        col.className = 'odo__col';
        for (let r = 0; r < 3; r++) {
          for (let d = 0; d < 10; d++) {
            const s = document.createElement('span');
            s.textContent = d;
            col.append(s);
          }
        }
        win.append(col);
        el.append(win);
        cols.push({ col, digit: Number(ch) });
      } else {
        const s = document.createElement('span');
        s.className = 'odo__s';
        s.setAttribute('aria-hidden', 'true');
        s.textContent = ch;
        el.append(s);
      }
    }
    const final = (d) => -((20 + d) / 30) * 100;
    if (reduced) {
      cols.forEach(({ col, digit }) => gsap.set(col, { yPercent: final(digit) }));
      return;
    }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 88%',
      once: true,
      onEnter: () => cols.forEach(({ col, digit }, i) => {
        gsap.fromTo(col, { yPercent: 0 }, { yPercent: final(digit), duration: 2.2 + i * 0.18, delay: i * 0.05, ease: 'expo.out' });
      }),
    });
  });
}

/* --------------------------------------------------------------------------
   Marquee: speeds up and flips direction with scroll velocity
   -------------------------------------------------------------------------- */

function initMarquee(lenis) {
  const wrap = document.querySelector('[data-marquee]');
  const row = wrap.querySelector('[data-marquee-row]');
  const track = document.createElement('div');
  track.className = 'marquee__track';
  row.replaceWith(track);
  track.append(row);
  for (let i = 0; i < 2; i++) {
    const clone = row.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    track.append(clone);
  }
  if (reduced) return;

  let w = row.offsetWidth;
  addEventListener('resize', () => { w = row.offsetWidth; });
  let x = 0;
  let dir = -1;
  let visible = false;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(wrap);

  gsap.ticker.add((time, dt) => {
    if (!visible || html.classList.contains('motion-paused')) return;
    const v = lenis ? lenis.velocity : 0;
    if (Math.abs(v) > 0.5) dir = v > 0 ? -1 : 1;
    const speed = 70 + Math.min(Math.abs(v) * 22, 900);
    x += dir * speed * (dt / 1000);
    if (x <= -w) x += w;
    if (x > 0) x -= w;
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  });
}

/* --------------------------------------------------------------------------
   SC.06 — Contact sheet: the editor's pick gets circled
   -------------------------------------------------------------------------- */

function initSheet() {
  const pick = document.querySelector('.shot--select');
  if (!pick || reduced) return;
  ScrollTrigger.create({ trigger: pick, start: 'top 72%', once: true, onEnter: () => pick.classList.add('is-drawn') });
}

/* --------------------------------------------------------------------------
   SC.07 — Final cut
   -------------------------------------------------------------------------- */

function initWrap() {
  if (reduced) return;
  const words = gsap.utils.toArray('.wrap__w');
  const splits = words.map((w) => new SplitText(w, { type: 'words,chars', wordsClass: 'word', charsClass: 'ch' }));
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.wrap__title', start: 'top 80%' } });
  splits.forEach((s, i) => {
    tl.from(s.chars, {
      yPercent: 100,
      rotate: i === 1 ? -8 : 0,
      autoAlpha: 0,
      duration: 1.1,
      ease: 'expo.out',
      stagger: 0.04,
    }, i * 0.28);
  });
  tl.fromTo('.wrap__w--last .ch', { fontStretch: '62%' }, { fontStretch: '108%', duration: 1.6, ease: 'expo.out', stagger: 0.03 }, 0.6);
}

/* --------------------------------------------------------------------------
   SC.08 — Credits roll, scrubbed; rewind
   -------------------------------------------------------------------------- */

function initCredits(lenis) {
  const rewind = document.querySelector('[data-rewind]');
  rewind.addEventListener('click', () => {
    html.classList.add('is-rewinding');
    const done = () => html.classList.remove('is-rewinding');
    if (lenis) lenis.scrollTo(0, { duration: 2.6, easing: (t) => 1 - Math.pow(1 - t, 4), onComplete: done });
    else { scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }); setTimeout(done, 1200); }
  });

  if (reduced) return;
  const footer = document.querySelector('.credits');
  const viewport = document.querySelector('[data-credits-viewport]');
  const roll = document.querySelector('[data-credits-roll]');
  const end = document.querySelector('[data-credits-end]');
  const distance = () => roll.offsetHeight + viewport.clientHeight;

  gsap.timeline({
    scrollTrigger: {
      trigger: footer,
      start: 'top top',
      end: () => `+=${distance() * 0.9}`,
      pin: true,
      scrub: true,
      invalidateOnRefresh: true,
    },
  })
    .fromTo(roll, { y: 0 }, { y: () => -distance(), ease: 'none', duration: 1 })
    .fromTo(end, { autoAlpha: 0, scale: 0.94 }, { autoAlpha: 1, scale: 1, duration: 0.18, ease: 'power2.out' }, 0.86);
}

/* --------------------------------------------------------------------------
   Generic focus-pull reveals
   -------------------------------------------------------------------------- */

function initReveals() {
  const els = gsap.utils.toArray('[data-reveal]');
  if (reduced) return;
  gsap.set(els, { autoAlpha: 0, y: 40, filter: 'blur(10px)' });
  ScrollTrigger.batch(els, {
    start: 'top 90%',
    once: true,
    onEnter: (batch) => gsap.to(batch, {
      autoAlpha: 1,
      y: 0,
      filter: 'blur(0px)',
      duration: 1.2,
      ease: 'expo.out',
      stagger: 0.09,
      clearProps: 'filter,transform',
    }),
  });
}

/* --------------------------------------------------------------------------
   Small interactions
   -------------------------------------------------------------------------- */

function initAnchors(lenis) {
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    e.preventDefault();
    const spacer = target.parentElement?.classList.contains('pin-spacer') ? target.parentElement : target;
    if (lenis) lenis.scrollTo(spacer, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else spacer.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
    history.replaceState(null, '', `#${id}`);
  });
}

function initMagnetic() {
  if (reduced || !matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  gsap.utils.toArray('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.35);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
  });
}

function initPause(lenis, gl, loops) {
  const btn = document.querySelector('[data-pause]');
  if (!btn) return;
  if (reduced) { btn.hidden = true; return; }
  const text = btn.querySelector('[data-pause-text]');
  btn.addEventListener('click', () => {
    const paused = !html.classList.contains('motion-paused');
    html.classList.toggle('motion-paused', paused);
    btn.setAttribute('aria-pressed', String(paused));
    text.textContent = paused ? 'Play motion' : 'Pause motion';
    gl.paused = paused;
    loops.sync();
  });
}
