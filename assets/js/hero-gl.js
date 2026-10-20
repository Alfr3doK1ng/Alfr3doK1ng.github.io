// Hero background: anamorphic light leaks, drifting bokeh, a flare that
// follows the cursor, film grain. Raw WebGL1, one full-screen triangle.

const VERT = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const FRAG = `
precision highp float;
varying vec2 vUv;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uMouseOn;
uniform float uReveal;
uniform float uScroll;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = m * p; a *= 0.5; }
  return v;
}

void main() {
  float asp = uRes.x / uRes.y;
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(asp, 1.0);
  float t = uTime;

  // slow, warped field that gives the leaks an organic edge
  vec2 q = vec2(fbm(p * 1.3 + vec2(0.0, t * 0.05)), fbm(p * 1.3 + vec2(5.2, -t * 0.04)));
  float f = fbm(p * 1.1 + q * 2.4 + vec2(t * 0.03, -t * 0.02));

  // primary leak bleeds in from just past the top-right corner
  vec2 c1 = vec2(0.5 * asp + 0.08, 0.5) + vec2(sin(t * 0.11), cos(t * 0.09)) * 0.07;
  float d1 = length((p - c1) * vec2(0.8, 1.0)) + (f - 0.5) * 0.55;
  float L1 = exp(-d1 * d1 * 4.2) * 0.9;

  // secondary, dimmer leak from the bottom-left
  vec2 c2 = vec2(-0.5 * asp - 0.05, -0.56) + vec2(cos(t * 0.07), sin(t * 0.13)) * 0.05;
  float d2 = length((p - c2) * vec2(0.9, 1.2)) + (q.x - 0.5) * 0.5;
  float L2 = exp(-d2 * d2 * 6.5) * 0.55;

  vec3 ink = vec3(0.043, 0.039, 0.031);
  vec3 amber = vec3(1.0, 0.66, 0.26);
  vec3 verm = vec3(1.0, 0.25, 0.12);
  vec3 flare = vec3(0.62, 0.83, 1.0);

  vec3 col = ink;
  col += mix(verm, amber, smoothstep(0.25, 0.95, L1)) * L1 * 1.05;
  col += mix(verm * 0.8, vec3(1.0, 0.45, 0.2), smoothstep(0.3, 1.0, L2)) * L2 * 0.8;
  col += vec3(1.0, 0.93, 0.82) * pow(L1, 6.0) * 0.55;

  // cursor glow + horizontal anamorphic streak + a ghost on the opposite side
  vec2 m = (uMouse - 0.5) * vec2(asp, 1.0);
  float dm = length(p - m);
  float dy = abs(p.y - m.y), dx = abs(p.x - m.x);
  col += amber * exp(-dm * dm * 9.0) * 0.18 * uMouseOn;
  float streak = exp(-dy * 140.0) * exp(-dx * 1.7) * 0.7 + exp(-dy * 18.0) * exp(-dx * 2.8) * 0.09;
  col += flare * streak * uMouseOn;
  vec2 g = -m * 0.55;
  float gd = length(p - g);
  col += flare * (smoothstep(0.1, 0.0, gd) * 0.035 + smoothstep(0.008, 0.0, abs(gd - 0.11)) * 0.07) * uMouseOn;

  // bokeh
  for (int i = 0; i < 9; i++) {
    float fi = float(i);
    vec2 bp = vec2(hash(vec2(fi, 1.3)) * 2.0 - 1.0,
                   fract(hash(vec2(fi, 7.1)) + t * (0.008 + 0.006 * hash(vec2(fi, 3.0)))) * 1.4 - 0.7);
    bp.x *= asp * 0.55;
    float r = 0.03 + 0.06 * hash(vec2(fi, 9.2));
    float bd = length(p - bp);
    float disc = smoothstep(r, r * 0.8, bd);
    float rim = smoothstep(r * 0.08, 0.0, abs(bd - r * 0.9));
    col += amber * (disc * 0.045 + rim * 0.035) * (0.5 + 0.5 * sin(t * 0.5 + fi * 1.7));
  }

  float vig = smoothstep(1.3, 0.2, length(p * vec2(0.85, 1.15)));
  col *= mix(0.45, 1.0, vig);
  col *= 0.965 + 0.035 * noise(vec2(t * 18.0, 0.0));
  col = mix(ink, col, uReveal);
  col = mix(col, ink, clamp(uScroll, 0.0, 1.0) * 0.75);
  col = 1.0 - exp(-col * 1.35);
  col += (hash(uv * uRes + fract(t * 7.3) * 91.7) - 0.5) * 0.045;

  gl_FragColor = vec4(col, 1.0);
}`;

export function initHeroGL(canvas, { reduced = false } = {}) {
  const state = { reveal: 0, scroll: 0, paused: false };
  const gl = canvas && canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) {
    if (canvas) canvas.style.display = 'none';
    return state;
  }

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };

  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) {
    console.warn('[hero-gl]', err);
    canvas.style.display = 'none';
    return state;
  }

  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = (name) => gl.getUniformLocation(prog, name);
  const uRes = u('uRes'), uTime = u('uTime'), uMouse = u('uMouse'), uMouseOn = u('uMouseOn');
  const uReveal = u('uReveal'), uScroll = u('uScroll');

  const mouse = { x: 0.62, y: 0.55, tx: 0.62, ty: 0.55, on: 0.5, ton: 0.5, last: -1e9 };
  const host = canvas.parentElement;
  host.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.tx = (e.clientX - r.left) / r.width;
    mouse.ty = 1 - (e.clientY - r.top) / r.height;
    mouse.ton = 1;
    mouse.last = performance.now();
  }, { passive: true });

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const scale = dpr * 0.6;
    const w = Math.max(1, Math.round(canvas.clientWidth * scale));
    const h = Math.max(1, Math.round(canvas.clientHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }).observe(canvas);

  const start = performance.now();
  const draw = (now) => {
    const t = (now - start) / 1000;
    // Idle: the flare drifts on its own (also what touch devices see)
    if (now - mouse.last > 2500) {
      mouse.tx = 0.55 + 0.28 * Math.sin(t * 0.23);
      mouse.ty = 0.5 + 0.16 * Math.sin(t * 0.37 + 1.2);
      mouse.ton = 0.55;
    }
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    mouse.on += (mouse.ton - mouse.on) * 0.04;

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.uniform1f(uMouseOn, mouse.on);
    gl.uniform1f(uReveal, state.reveal);
    gl.uniform1f(uScroll, state.scroll);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  if (reduced) {
    state.reveal = 1;
    draw(start + 12000);
    state.redraw = () => draw(start + 12000);
    return state;
  }

  const loop = (now) => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden || state.paused) return;
    draw(now);
  };
  requestAnimationFrame(loop);
  return state;
}
