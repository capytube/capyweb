'use strict';
// Vendored from the capy.life family site (levara-capy-life site/morph.js), unchanged except that it is a function,
// window.capyMorph(hero), so hero.js can start it again when the Next.js app shows the home page anew, and that it
// announces "Picture n of m" (these are generated pictures, not photographs), and that software WebGL gets the cross-fade.
// Hero gallery: our photographs dissolve into each other through noise (one WebGL pass over two textures), after the
// morph-gallery component by kedhareswer (21st component library), ported from React to plain JS; nothing is loaded from outside this site.
// The first photograph is a plain <img> (it is the page's largest paint); the canvas covers it once ready.
// Without WebGL, or if it fails, the same gallery cross-fades the <img>s. Reduced motion: no autoplay, no dissolve.
window.capyMorph = (hero) => {
  const stage = hero.querySelector('.morph-stage');
  const slides = [...hero.querySelectorAll('.morph-slide')];
  const canvas = hero.querySelector('.morph-canvas');
  const thumbs = [...hero.querySelectorAll('[data-morph-go]')];
  const status = hero.querySelector('.morph-status');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const n = slides.length;
  const AUTOPLAY = 6000, DURATION = 1500, NOISE = 3.5, EDGE = 0.15, DRIFT = 0.5;
  let active = 0, timer = 0, hovered = false, focused = false, visible = true, gl = null;

  const wrap = (i) => ((i % n) + n) % n;
  const ease = (t) => { const x = Math.min(Math.max(t, 0), 1); return x < 0.5 ? 16 * x ** 5 : 1 - (-2 * x + 2) ** 5 / 2; };
  // Phones get the 768 px copies, wider screens the 1536 px originals (as the page's srcset does).
  const wide = () => hero.clientWidth * Math.min(window.devicePixelRatio || 1, 2) > 900;
  const source = (i) => i === 0 ? (slides[0].currentSrc || slides[0].src) : `${slides[i].dataset.src}${wide() ? '' : '-768'}.webp`;

  // ---- the DOM side: which slide is shown, thumbnails, announcements ----
  const mark = (i) => {
    slides.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.setAttribute('aria-hidden', String(k !== i)); });
    thumbs.forEach((b, k) => b.setAttribute('aria-current', String(k === i)));
  };
  // hero.js gives pictures not shown yet a data: placeholder src
  const unloaded = (img) => !img.getAttribute('src') || img.getAttribute('src').startsWith('data:');
  const ensureImg = (i) => { const s = slides[i]; if (unloaded(s)) s.src = source(i); };

  const go = (next, byPerson) => {
    const to = wrap(next);
    if (to === active) return;
    const from = active;
    active = to;
    mark(to);
    if (byPerson && status) status.textContent = `Picture ${to + 1} of ${n}: ${slides[to].alt.replace(/; generated concept imagery$/, '')}`;
    if (gl && gl.ok) gl.transition(from, to);
    else { ensureImg(to); ensureImg(wrap(to + 1)); }
    schedule();
  };

  // ---- autoplay: off for reduced motion, while hovered or focused, in a hidden tab or off screen ----
  function schedule() {
    clearTimeout(timer);
    if (reduced.matches || hovered || focused || !visible || document.hidden || n < 2) return;
    timer = setTimeout(() => go(active + 1, false), AUTOPLAY);
  }
  stage.addEventListener('mouseenter', () => { hovered = true; schedule(); });
  stage.addEventListener('mouseleave', () => { hovered = false; schedule(); });
  hero.addEventListener('focusin', () => { focused = true; schedule(); });
  hero.addEventListener('focusout', () => { focused = hero.contains(document.activeElement); schedule(); });
  document.addEventListener('visibilitychange', schedule);
  reduced.addEventListener('change', schedule);
  new IntersectionObserver((e) => { visible = e[0].isIntersecting; schedule(); }).observe(hero);

  // ---- controls: arrows, thumbnails, keys, swipe ----
  hero.querySelectorAll('[data-morph-step]').forEach((b) => b.addEventListener('click', () => go(active + Number(b.dataset.morphStep), true)));
  thumbs.forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.morphGo), true)));
  stage.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1, true); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1, true); }
  });
  let swipeX = null;
  stage.addEventListener('pointerdown', (e) => { swipeX = e.clientX; });
  stage.addEventListener('pointerup', (e) => {
    if (swipeX === null) return;
    const dx = e.clientX - swipeX; swipeX = null;
    if (Math.abs(dx) > 48) go(active + (dx < 0 ? 1 : -1), true);
  });
  // Thumbnails are only shown on wide screens; their pictures load only there.
  const loadThumbs = () => thumbs.forEach((b) => { const img = b.querySelector('img'); if (b.offsetParent && unloaded(img)) img.src = img.dataset.thumb; });

  // ---- WebGL ----
  const VERT = 'attribute vec2 a_position;varying vec2 v_uv;void main(){v_uv=a_position*0.5+0.5;gl_Position=vec4(a_position,0.0,1.0);}';
  const FRAG = `precision highp float;
uniform sampler2D u_from;uniform sampler2D u_to;uniform float u_progress;uniform vec2 u_resolution;
uniform float u_fromAspect;uniform float u_toAspect;uniform float u_scale;uniform float u_direction;uniform float u_edge;uniform float u_drift;
varying vec2 v_uv;
vec3 permute(vec3 x){return mod(((x*34.0)+1.0)*x,289.0);}
float snoise(vec2 v){
  const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);
  vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.0,0.0):vec2(0.0,1.0);
  vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod(i,289.0);
  vec3 p=permute(permute(i.y+vec3(0.0,i1.y,1.0))+i.x+vec3(0.0,i1.x,1.0));
  vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.0);m=m*m;m=m*m;
  vec3 x=2.0*fract(p*C.www)-1.0;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;
  m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);
  vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.0*dot(m,g);}
float fbm(vec2 v){float value=0.0;float amplitude=0.5;for(int i=0;i<5;i++){value+=amplitude*snoise(v);v*=2.0;amplitude*=0.5;}return value;}
vec2 mirror(vec2 uv){return 1.0-abs(1.0-mod(uv,2.0));}
vec2 coverUV(vec2 uv,float imgAspect,vec2 focus){
  float canvasAspect=u_resolution.x/u_resolution.y;
  vec2 scale=(canvasAspect>imgAspect)?vec2(1.0,imgAspect/canvasAspect):vec2(canvasAspect/imgAspect,1.0);
  return mirror((uv-0.5)*scale+focus);}
void main(){
  vec2 focus=vec2(0.43,0.5);
  float adjusted=u_progress*(1.0+2.0*u_edge)-u_edge;
  float noise=fbm(v_uv*u_scale+vec2(0.0,u_progress*u_direction))*0.5+0.5;
  noise=smoothstep(0.0,2.0,length(texture2D(u_to,coverUV(v_uv,u_toAspect,focus)).rgb)+noise);
  float mixFactor=1.0-smoothstep(adjusted-u_edge,adjusted+u_edge,noise);
  vec2 fromUV=coverUV(v_uv+vec2(0.0,noise*u_progress*u_drift*u_direction),u_fromAspect,focus);
  vec2 toUV=coverUV(v_uv+vec2(0.0,noise*(1.0-u_progress)*-0.5*u_drift*u_direction),u_toAspect,focus);
  gl_FragColor=mix(texture2D(u_from,fromUV),texture2D(u_to,toUV),mixFactor);}`;

  function startGl() {
    const ctx = canvas.getContext('webgl', {alpha: false, antialias: false, preserveDrawingBuffer: false});
    if (!ctx) return null;
    // WebGL in software (SwiftShader, llvmpipe) leaves the lower hero dark after a scroll (seen in headless Chromium,
    // not with a GPU): such browsers get the image cross-fade instead.
    const info = ctx.getExtension('WEBGL_debug_renderer_info');
    if (/swiftshader|llvmpipe|software/i.test(info ? ctx.getParameter(info.UNMASKED_RENDERER_WEBGL) : '')) return null;
    const compile = (type, src) => {
      const s = ctx.createShader(type); ctx.shaderSource(s, src); ctx.compileShader(s);
      if (!ctx.getShaderParameter(s, ctx.COMPILE_STATUS)) throw new Error('shader');
      return s;
    };
    const program = ctx.createProgram();
    const vs = compile(ctx.VERTEX_SHADER, VERT), fs = compile(ctx.FRAGMENT_SHADER, FRAG);
    ctx.attachShader(program, vs); ctx.attachShader(program, fs); ctx.linkProgram(program);
    ctx.deleteShader(vs); ctx.deleteShader(fs);
    if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) throw new Error('link');
    ctx.useProgram(program);
    ctx.bindBuffer(ctx.ARRAY_BUFFER, ctx.createBuffer());
    ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), ctx.STATIC_DRAW);
    const loc = ctx.getAttribLocation(program, 'a_position');
    ctx.enableVertexAttribArray(loc); ctx.vertexAttribPointer(loc, 2, ctx.FLOAT, false, 0, 0);
    const u = {};
    for (const k of ['from', 'to', 'progress', 'resolution', 'fromAspect', 'toAspect', 'scale', 'direction', 'edge', 'drift']) u[k] = ctx.getUniformLocation(program, 'u_' + k);
    ctx.pixelStorei(ctx.UNPACK_FLIP_Y_WEBGL, true);

    const textures = new Array(n).fill(null), aspects = new Array(n).fill(1.5), loading = new Array(n).fill(null);
    let from = 0, to = 0, progress = 1, startedAt = 0, direction = 1, raf = 0;
    const state = {ok: true};

    const upload = (i, img) => {
      const t = ctx.createTexture();
      ctx.bindTexture(ctx.TEXTURE_2D, t);
      ctx.texImage2D(ctx.TEXTURE_2D, 0, ctx.RGBA, ctx.RGBA, ctx.UNSIGNED_BYTE, img);
      for (const [k, v] of [[ctx.TEXTURE_WRAP_S, ctx.CLAMP_TO_EDGE], [ctx.TEXTURE_WRAP_T, ctx.CLAMP_TO_EDGE], [ctx.TEXTURE_MIN_FILTER, ctx.LINEAR], [ctx.TEXTURE_MAG_FILTER, ctx.LINEAR]]) ctx.texParameteri(ctx.TEXTURE_2D, k, v);
      textures[i] = t; aspects[i] = img.naturalWidth / Math.max(img.naturalHeight, 1);
    };
    const load = (i) => loading[i] || (loading[i] = new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { if (state.ok) upload(i, img); resolve(); };
      img.onerror = () => reject(new Error('image'));
      img.src = source(i);
    }));

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
      if (!w || !h || (canvas.width === w && canvas.height === h)) return false;
      canvas.width = w; canvas.height = h; ctx.viewport(0, 0, w, h);
      return true;
    };
    const draw = () => {
      const a = textures[from] || textures[to], b = textures[to] || textures[from];
      if (!a || !b) return;
      ctx.activeTexture(ctx.TEXTURE0); ctx.bindTexture(ctx.TEXTURE_2D, a); ctx.uniform1i(u.from, 0);
      ctx.activeTexture(ctx.TEXTURE1); ctx.bindTexture(ctx.TEXTURE_2D, b); ctx.uniform1i(u.to, 1);
      ctx.uniform1f(u.progress, progress); ctx.uniform2f(u.resolution, canvas.width, canvas.height);
      ctx.uniform1f(u.fromAspect, aspects[from]); ctx.uniform1f(u.toAspect, aspects[to]);
      ctx.uniform1f(u.scale, NOISE); ctx.uniform1f(u.direction, direction); ctx.uniform1f(u.edge, EDGE); ctx.uniform1f(u.drift, DRIFT);
      ctx.drawArrays(ctx.TRIANGLE_STRIP, 0, 4);
    };
    // Frames only while a dissolve runs; otherwise the canvas holds its last picture and the GPU rests.
    const frame = () => {
      raf = 0;
      if (!state.ok) return;   // fallen back while an image was loading: no more GPU frames
      progress = reduced.matches ? 1 : ease((performance.now() - startedAt) / DURATION);
      draw();
      if (progress < 1) raf = requestAnimationFrame(frame);
    };
    state.transition = (a, b) => {
      // A dissolve already running starts from what is on screen now.
      if (progress < 1) a = progress < 0.5 ? from : to;
      direction = ((b - a + n) % n) * 2 <= n ? 1 : -1;
      const begin = () => {
        if (!state.ok || active !== b) return;
        from = a; to = b; progress = 0; startedAt = performance.now();
        if (!raf) raf = requestAnimationFrame(frame);
      };
      load(wrap(b + 1)).catch(() => {});
      if (textures[b]) begin(); else load(b).then(begin, () => fallBack());
    };
    new ResizeObserver(() => { if (resize() && state.ok) draw(); }).observe(canvas);
    canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fallBack(); });

    resize();
    load(0).then(() => {
      draw();
      hero.classList.add('is-gl');
      // The rest after the page has finished loading, so they never compete with the first picture.
      const rest = () => { for (let i = 1; i < n; i++) load(i).catch(() => {}); };
      if (document.readyState === 'complete') setTimeout(rest, 300); else window.addEventListener('load', () => setTimeout(rest, 300), {once: true});
    }, () => fallBack());
    state.stop = () => { state.ok = false; cancelAnimationFrame(raf); };
    return state;
  }

  function fallBack() {
    if (gl) gl.stop?.();
    gl = null;
    hero.classList.remove('is-gl');
    ensureImg(active); ensureImg(wrap(active + 1));
  }

  try { gl = startGl(); } catch (e) { gl = null; }
  if (!gl) fallBack();
  mark(0);
  loadThumbs();
  window.addEventListener('resize', loadThumbs, {passive: true});
  schedule();
};
