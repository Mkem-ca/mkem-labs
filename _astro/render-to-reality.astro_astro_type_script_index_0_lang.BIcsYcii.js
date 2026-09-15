import{i as e,n as t,r as n,t as r}from"./tweak.BLgDkXOo.js";import{F as i,Ma as a,Rn as o,U as s,V as c,ar as l,ea as u,jr as d,no as f,ta as p}from"./three.core.Dbc_D4oM.js";import{n as m}from"./three.module.QfN__-FO.js";var h=`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`,g=`
precision highp float;

uniform sampler2D uTex;
uniform vec2  uRes;          // drawing buffer size, device px
uniform vec2  uTexRes;       // source image size
uniform vec2  uFocus;        // cover-crop bias, -1..1 per axis
uniform float uCrop;         // <1 crops in on both axes (a phone needs the stage, not the ceiling)

uniform float uBuild;        // 0 concept -> 1 show

uniform float uEdgeThreshold;
uniform float uEdgeSoft;
uniform float uEdgeLift;     // shadow lift before the Sobel, so dark rooms still draw
uniform float uLineWidth;    // Sobel tap distance, device px
uniform vec3  uLineColor;
uniform float uLineOpacity;

uniform float uMaxCell;      // largest block, device px
uniform float uDither;
uniform float uDitherPx;     // size of the ordered pattern inside a block, device px
uniform vec3  uPalette[16];
uniform float uPaletteCount;

uniform vec3  uWashColor;
uniform float uWash;         // tonal fill under the blueprint lines

uniform float uZoom;         // crop settles from this much tighter back to the full frame
uniform float uSnap;         // flash of line colour as each block lands
uniform float uSeed;
uniform float uHold;         // 1 = animated build, 0 = skip the staggered reveals (hover cards)

varying vec2 vUv;

const float PHASE_LINE_IN   = 0.30;
/* The construction lines stay on top of the blocks for the whole assembly and only leave as
   the photograph resolves: without them the block phase reads as a pixelation filter. */
const float PHASE_LINE_OUT0 = 0.54;
const float PHASE_LINE_OUT1 = 0.94;
const float PHASE_BLOCK0    = 0.16;
const float PHASE_BLOCK1    = 0.56;
const float PHASE_PHOTO0    = 0.66;
const float PHASE_PHOTO1    = 1.00;

float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21) + uSeed);
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* Compact recursive Bayer matrix: Bayer2 -> Bayer4 -> Bayer8, no array indexing. */
float bayer2(vec2 a) { a = floor(a); return fract(a.x * 0.5 + a.y * a.y * 0.75); }
#define BAYER4(a) (bayer2(0.5 * (a)) * 0.25 + bayer2(a))
#define BAYER8(a) (BAYER4(0.5 * (a)) * 0.25 + bayer2(a))

/* Cover-fit the texture into the canvas, then bias the crop with uFocus. */
vec2 coverScale() {
  float ra = uRes.x / max(uRes.y, 1.0);
  float ta = uTexRes.x / max(uTexRes.y, 1.0);
  return (ra > ta) ? vec2(1.0, ta / ra) : vec2(ra / ta, 1.0);
}
vec2 coverUv(vec2 uv, vec2 s) {
  return (uv - 0.5) * s + 0.5 + (1.0 - s) * 0.5 * uFocus;
}

/* Staggered reveal: cells with a lower rank turn on first. prog and rank are 0..1. */
float staggerReveal(float prog, float rank, float feather) {
  float t = prog * (1.0 + feather);
  return smoothstep(rank, rank + feather, t);
}

float edgeLuma(vec2 uv) {
  /* Lift the shadows before the operator or a dark ballroom draws almost nothing. */
  return pow(clamp(luma(texture2D(uTex, uv).rgb), 0.0, 1.0), uEdgeLift);
}

float sobel(vec2 uv, vec2 texel) {
  float tl = edgeLuma(uv + texel * vec2(-1.0,  1.0));
  float tt = edgeLuma(uv + texel * vec2( 0.0,  1.0));
  float tr = edgeLuma(uv + texel * vec2( 1.0,  1.0));
  float ll = edgeLuma(uv + texel * vec2(-1.0,  0.0));
  float rr = edgeLuma(uv + texel * vec2( 1.0,  0.0));
  float bl = edgeLuma(uv + texel * vec2(-1.0, -1.0));
  float bb = edgeLuma(uv + texel * vec2( 0.0, -1.0));
  float br = edgeLuma(uv + texel * vec2( 1.0, -1.0));
  float gx = -tl - 2.0 * ll - bl + tr + 2.0 * rr + br;
  float gy =  tl + 2.0 * tt + tr - bl - 2.0 * bb - br;
  return length(vec2(gx, gy));
}

/* Nearest palette entry under the "redmean" low-cost perceptual distance. Plain RGB distance
   drags the room's blue-grey mid-tones into the warm half of the palette and the whole block
   state goes sepia; redmean keeps hue, so blues stay blue and only skin and timber go warm. */
vec3 snapToPalette(vec3 c) {
  vec3 best = uPalette[0];
  float bestD = 1e9;
  for (int i = 0; i < 16; i++) {
    if (float(i) < uPaletteCount) {
      vec3 p = uPalette[i];
      vec3 d = c - p;
      float rmean = (c.r + p.r) * 0.5;
      float dist = (2.0 + rmean) * d.r * d.r + 4.0 * d.g * d.g + (3.0 - rmean) * d.b * d.b;
      if (dist < bestD) { bestD = dist; best = p; }
    }
  }
  return best;
}

/* Straight-alpha "source over destination". */
vec4 over(vec4 src, vec4 dst) {
  float a = src.a + dst.a * (1.0 - src.a);
  vec3 c = (a > 0.0001) ? (src.rgb * src.a + dst.rgb * dst.a * (1.0 - src.a)) / a : vec3(0.0);
  return vec4(c, a);
}

void main() {
  vec2 uv = vUv;
  // The crop starts a little tighter and settles back to the full frame by the time the
  // callouts start drawing, so the drawing feels like it is being set down on the sheet.
  float settle = mix(1.0 - uZoom, 1.0, mix(1.0, smoothstep(0.0, PHASE_PHOTO0, uBuild), uHold));
  vec2 cs = coverScale() * settle * uCrop;
  vec2 uvTex = coverUv(uv, cs);

  vec3 built = texture2D(uTex, uvTex).rgb;
  vec2 texel = uLineWidth * cs / uRes;

  // ---- cell grid ------------------------------------------------------------------
  float ct = smoothstep(PHASE_BLOCK0, 0.96, uBuild);
  float cell = max(1.0, floor(mix(uMaxCell, 1.0, pow(ct, 1.35))));
  vec2 fc = gl_FragCoord.xy;
  vec2 cellId = floor(fc / cell);
  vec2 uvCellCanvas = (cellId + 0.5) * cell / uRes;
  vec2 uvCell = coverUv(uvCellCanvas, cs);

  // Four taps inside the cell so a block reads as the average of its patch, not one texel.
  vec2 h = (cell * 0.25) * cs / uRes;
  vec3 blockRaw = (
      texture2D(uTex, uvCell + vec2(-h.x, -h.y)).rgb
    + texture2D(uTex, uvCell + vec2( h.x, -h.y)).rgb
    + texture2D(uTex, uvCell + vec2(-h.x,  h.y)).rgb
    + texture2D(uTex, uvCell + vec2( h.x,  h.y)).rgb
  ) * 0.25;

  // ---- dither + quantize ----------------------------------------------------------
  // The ordered pattern has to be FINER than the block. Taking one Bayer threshold per cell
  // makes neighbouring cells alternate light and dark and the whole field reads as a
  // chessboard instead of assembled voxels. So the threshold is sampled on a fixed 2-4px
  // screen grid inside each cell, and its strength is banded: a big cell is a solid quantized
  // colour, the pattern comes in as the cells shrink, and it is gone again by the time a cell
  // is a pixel and the photograph is resolving.
  float ditherAmt = uDither * smoothstep(40.0, 10.0, cell) * smoothstep(1.5, 4.0, cell);
  float threshold = BAYER8(fc / max(uDitherPx, 1.0));
  vec3 blockCol = snapToPalette(blockRaw + (threshold - 0.5) * ditherAmt);

  // ---- staggered reveals ----------------------------------------------------------
  // Blocks assemble ALONG the blueprint: a cell sitting on an edge is first, flat cells fill
  // in behind it, with a slight bottom-up bias so the room builds off the floor. Rank is taken
  // from the Sobel at the cell centre, plus a fixed coarse hash so the stagger does not
  // re-shuffle as the cells shrink. The photo then resolves in a random per-cell dissolve.
  float cellEdge = smoothstep(uEdgeThreshold, uEdgeThreshold + uEdgeSoft, sobel(uvCell, texel));
  float rankBlock = clamp(
    0.60 * (1.0 - cellEdge) + 0.22 * hash21(floor(uvTex * vec2(48.0, 28.0))) + 0.18 * (1.0 - uv.y),
    0.0, 1.0
  );
  float rankPhoto = hash21(floor(uvTex * vec2(72.0, 42.0)) + 17.0);

  float blockA = mix(1.0, staggerReveal(smoothstep(PHASE_BLOCK0, PHASE_BLOCK1, uBuild), rankBlock, 0.45), uHold);
  float photoA = mix(
    smoothstep(PHASE_PHOTO0, PHASE_PHOTO1, uBuild),
    staggerReveal(smoothstep(PHASE_PHOTO0, PHASE_PHOTO1, uBuild), rankPhoto, 0.55),
    uHold
  );

  // Each block flashes the line colour as it lands, then settles into its palette entry.
  float snap = blockA * (1.0 - blockA) * 4.0;
  blockCol = mix(blockCol, uLineColor, clamp(snap, 0.0, 1.0) * uSnap * uHold);

  vec3 mid = mix(blockCol, built, photoA);

  // ---- blueprint ------------------------------------------------------------------
  float line = smoothstep(uEdgeThreshold, uEdgeThreshold + uEdgeSoft, sobel(uvTex, texel));

  float plotProg = smoothstep(0.0, PHASE_LINE_IN, uBuild) * 1.3 - 0.15;
  float plotOrder = uv.x * 0.6 + (1.0 - uv.y) * 0.3 + hash21(floor(uv * vec2(40.0, 24.0)) + 3.0) * 0.1;
  float plotted = mix(1.0, smoothstep(plotOrder - 0.10, plotOrder + 0.06, plotProg), uHold);

  float lineFade = 1.0 - smoothstep(PHASE_LINE_OUT0, PHASE_LINE_OUT1, uBuild);

  // The pen carriage: a narrow band travelling with the plot, brightening the lines it crosses.
  float head = exp(-pow((plotOrder - plotProg) * 22.0, 2.0)) * uHold * lineFade;
  float lineA = clamp(line * (1.0 + head * 1.6), 0.0, 1.0) * plotted * lineFade * uLineOpacity;

  // A faint tonal fill in the dark parts of the drawing, so the blueprint has body. It only
  // applies where no block has landed yet, or the assembly reads washed out rather than solid.
  float fillA = (1.0 - luma(built)) * uWash * lineFade * plotted * (1.0 - blockA);

  // ---- composite ------------------------------------------------------------------
  vec4 acc = vec4(uWashColor, fillA);
  acc = over(vec4(mid, blockA), acc);
  acc = over(vec4(uLineColor, lineA), acc);
  acc = over(vec4(uLineColor, head * 0.12 * (1.0 - blockA)), acc);

  gl_FragColor = acc;
}
`,_=[`#0a0820`,`#140f4d`,`#1d1866`,`#27397c`,`#2e3191`,`#364aea`,`#4f7fe8`,`#26a9e0`,`#7fd0f0`,`#c2ecff`],v=[`#231a1c`,`#3f2e2c`,`#6d5147`,`#9d7a63`,`#cfae92`,`#f7f6f2`],y=e=>[parseInt(e.slice(1,3),16)/255,parseInt(e.slice(3,5),16)/255,parseInt(e.slice(5,7),16)/255],b=([e,t,n])=>.2126*e+.7152*t+.0722*n,x=[..._,...v].map(y).sort((e,t)=>b(e)-b(t));function S(e){let t=Math.max(2,Math.min(16,Math.round(e))),n=new Float32Array(48);for(let e=0;e<16;e++){let r=x[e<t?Math.round(e*(x.length-1)/(t-1)):x.length-1];n[e*3]=r[0],n[e*3+1]=r[1],n[e*3+2]=r[2]}return n}var C={build:0,edgeThreshold:.38,edgeSoft:.46,edgeLift:.62,lineWidth:1.35,lineColor:`#26a9e0`,lineOpacity:.95,maxCell:72,dither:.5,ditherPx:3,paletteCount:12,wash:.16,washColor:`#c2ecff`,focusX:0,focusY:0,crop:1,zoom:.055,snap:.4,seed:0,hold:1},w=new Set,T=!1;function E(){if(T)return;T=!0;let e=()=>{w.forEach(e=>e()),requestAnimationFrame(e)};requestAnimationFrame(e)}var D=new Map;function O(e){let t=D.get(e);return t||(t=new a().loadAsync(e).then(e=>(e.minFilter=o,e.magFilter=o,e.generateMipmaps=!1,e.wrapS=c,e.wrapT=c,e.colorSpace=``,e.needsUpdate=!0,e)),D.set(e,t)),t}function k(e,t){let n={...C,...t.params},r=t.maxDpr??2,a=new m({canvas:e,alpha:!0,antialias:!1,premultipliedAlpha:!1,powerPreference:`high-performance`});a.setClearColor(0,0);let o={uTex:{value:null},uRes:{value:new f(1,1)},uTexRes:{value:new f(1,1)},uFocus:{value:new f(n.focusX,n.focusY)},uCrop:{value:n.crop},uBuild:{value:n.build},uEdgeThreshold:{value:n.edgeThreshold},uEdgeSoft:{value:n.edgeSoft},uEdgeLift:{value:n.edgeLift},uLineWidth:{value:n.lineWidth},uLineColor:{value:new s(n.lineColor)},uLineOpacity:{value:n.lineOpacity},uMaxCell:{value:n.maxCell},uDither:{value:n.dither},uDitherPx:{value:n.ditherPx},uPalette:{value:S(n.paletteCount)},uPaletteCount:{value:n.paletteCount},uWashColor:{value:new s(n.washColor)},uWash:{value:n.wash},uZoom:{value:n.zoom},uSnap:{value:n.snap},uSeed:{value:n.seed},uHold:{value:n.hold}},c=new p({vertexShader:h,fragmentShader:g,uniforms:o,depthTest:!1,depthWrite:!1,blending:0}),_=new u,v=new i,y=new l(new d(2,2),c);y.frustumCulled=!1,_.add(y);let b=!0,x=!0,T=!1,D=!1,k=()=>{let t=Math.min(window.devicePixelRatio||1,r),n=Math.max(1,Math.round(e.clientWidth)),i=Math.max(1,Math.round(e.clientHeight));a.setPixelRatio(t),a.setSize(n,i,!1),o.uRes.value.set(Math.round(n*t),Math.round(i*t)),b=!0},A=()=>{!D&&T&&b&&x&&(b=!1,a.render(_,v))};w.add(A),E();let j=new ResizeObserver(k);j.observe(e),k();let M=new IntersectionObserver(([e])=>{x=e?.isIntersecting??!0,x&&(b=!0)},{rootMargin:`200px`});return M.observe(e),O(t.src).then(t=>{if(D)return;o.uTex.value=t;let n=t.image;o.uTexRes.value.set(n.width,n.height),T=!0,b=!0,e.dataset.ready=`true`}),{canvas:e,setBuild(e){let t=Math.max(0,Math.min(1,e));t!==o.uBuild.value&&(o.uBuild.value=t,n.build=t,b=!0)},apply(e){Object.assign(n,e),e.build!==void 0&&(o.uBuild.value=e.build),e.edgeThreshold!==void 0&&(o.uEdgeThreshold.value=e.edgeThreshold),e.edgeSoft!==void 0&&(o.uEdgeSoft.value=e.edgeSoft),e.edgeLift!==void 0&&(o.uEdgeLift.value=e.edgeLift),e.lineWidth!==void 0&&(o.uLineWidth.value=e.lineWidth),e.lineColor!==void 0&&o.uLineColor.value.set(e.lineColor),e.lineOpacity!==void 0&&(o.uLineOpacity.value=e.lineOpacity),e.maxCell!==void 0&&(o.uMaxCell.value=e.maxCell),e.dither!==void 0&&(o.uDither.value=e.dither),e.ditherPx!==void 0&&(o.uDitherPx.value=e.ditherPx),e.paletteCount!==void 0&&(o.uPalette.value=S(e.paletteCount),o.uPaletteCount.value=e.paletteCount),e.washColor!==void 0&&o.uWashColor.value.set(e.washColor),e.wash!==void 0&&(o.uWash.value=e.wash),(e.focusX!==void 0||e.focusY!==void 0)&&o.uFocus.value.set(n.focusX,n.focusY),e.crop!==void 0&&(o.uCrop.value=e.crop),e.zoom!==void 0&&(o.uZoom.value=e.zoom),e.snap!==void 0&&(o.uSnap.value=e.snap),e.seed!==void 0&&(o.uSeed.value=e.seed),e.hold!==void 0&&(o.uHold.value=e.hold),b=!0},invalidate(){b=!0},dispose(){D=!0,w.delete(A),j.disconnect(),M.disconnect(),y.geometry.dispose(),c.dispose(),a.dispose()}}}var A=[{anchor:[.42,.25],elbow:[.48,.13],label:[.5,.13],align:`start`},{anchor:[.705,.455],elbow:[.87,.46],label:[.985,.46],align:`end`},{anchor:[.525,.55],elbow:[.85,.63],label:[.985,.63],align:`end`},{anchor:[.47,.66],elbow:[.66,.86],label:[.64,.86],align:`end`}],j=[{anchor:[.52,.45],elbow:[.72,.115],label:[.96,.115],align:`end`,labelIndex:2}],M=e=>Math.max(0,Math.min(1,e)),N=(e,t,n)=>M((e-t)/(n-t));function P(t){let n=t.querySelector(`[data-rtr-canvas]`),r=t.querySelector(`[data-rtr-frame]`),i=t.querySelector(`[data-rtr-rail]`),a=t.querySelector(`[data-rtr-knob]`),o=t.querySelector(`[data-rtr-readout]`),s=t.querySelector(`[data-rtr-state]`),c=t.querySelector(`[data-rtr-replay]`),l=t.querySelector(`[data-rtr-leaders]`),u=t.querySelector(`[data-rtr-labels]`),d=t.querySelector(`[data-rtr-pill]`),f=[...t.querySelectorAll(`[data-rtr-glyph] path`)],p=t.querySelector(`[data-rtr-rule] path`);if(!n||!r||!i||!a||!l||!u)return null;let m=window.matchMedia(`(max-width: 767px)`),h=n.dataset.srcWide??``,g=n.dataset.srcNarrow??h,_=Number(n.dataset.texW??1),v=Number(n.dataset.texH??1),y={crop:1,focusY:-.12},b={crop:.68,focusY:-1},x=()=>m.matches?b:y,S=k(n,{src:m.matches?g:h,params:{seed:.17,...x()}}),C={build:0,autoplay:!0,callouts:!0},w={x:0,y:x().focusY,crop:x().crop},T=[...u.querySelectorAll(`[data-rtr-label]`)],E=[],D=`http://www.w3.org/2000/svg`,O=()=>{l.replaceChildren(),E.length=0;let e=m.matches?j:A,t=r.clientWidth,n=r.clientHeight,i=t/Math.max(n,1),a=_/Math.max(v,1),o=i>a?{x:1,y:a/i}:{x:i/a,y:1},s={x:o.x*w.crop,y:o.y*w.crop},c=new Set(e.map((e,t)=>e.labelIndex??t));T.forEach((e,t)=>{e.style.display=c.has(t)?``:`none`}),e.forEach((e,r)=>{let i=T[e.labelIndex??r];if(!i)return;let a={x:e.anchor[0],y:1-e.anchor[1]},o=(a.x-.5-(1-s.x)*.5*w.x)/s.x+.5,c=(a.y-.5-(1-s.y)*.5*w.y)/s.y+.5;if(o<.02||o>.98||c<.02||c>.98){i.style.display=`none`;return}let u=o*t,d=(1-c)*n,f=e.elbow[0]*t,p=e.elbow[1]*n,m=e.label[0]*t,h=document.createElementNS(D,`circle`);h.setAttribute(`cx`,String(u)),h.setAttribute(`cy`,String(d)),h.setAttribute(`r`,`3.5`),h.setAttribute(`class`,`rtr-dot`);let g=document.createElementNS(D,`line`);g.setAttribute(`x1`,String(u)),g.setAttribute(`y1`,String(d)),g.setAttribute(`x2`,String(f)),g.setAttribute(`y2`,String(p)),g.setAttribute(`pathLength`,`1`),g.setAttribute(`class`,`rtr-leader`);let _=document.createElementNS(D,`line`);_.setAttribute(`x1`,String(f)),_.setAttribute(`y1`,String(p)),_.setAttribute(`x2`,String(e.align===`start`?m:m-i.offsetWidth)),_.setAttribute(`y2`,String(p)),_.setAttribute(`pathLength`,`1`),_.setAttribute(`class`,`rtr-leader`),l.append(h,g,_),i.style.display=``,i.style.left=`${e.label[0]*100}%`,i.style.top=`${e.label[1]*100}%`,i.dataset.align=e.align,E.push({dot:h,diag:g,shelf:_,label:i,def:e})}),P(C.build)},P=e=>{let t=Math.max(E.length,1);E.forEach((n,r)=>{let i=.64+r/t*.2,a=C.callouts?N(e,i,i+.16):0;n.dot.style.opacity=String(N(a,0,.2)),n.diag.style.strokeDashoffset=String(1-N(a,0,.5)),n.shelf.style.strokeDashoffset=String(1-N(a,.4,.75));let o=N(a,.6,1);n.label.style.opacity=String(o),n.label.style.transform=`translate3d(${n.def.align===`end`?`-100%`:`0`}, ${(1-o)*10}px, 0)`})},F=1,I=()=>{p&&(F=p.getTotalLength()||1,p.style.strokeDasharray=String(F))},L=[`concept`,`build`,`show`],R=[`Concept`,`Build`,`Show`],z=e=>{let n=M(e),r=Math.round(n*100),c=n<.34?0:n<.8?1:2;C.build=n,S.setBuild(n),a.style.left=`${n*100}%`,i.setAttribute(`aria-valuenow`,String(r)),o&&(o.textContent=`${String(r).padStart(3,` `)}%`),s&&(s.textContent=L[c]),d&&(d.textContent=`${R[c]} ${r}%`),f.forEach((e,t)=>{e.style.strokeDashoffset=String(1-N(n,.04+t*.07,.24+t*.07))}),p&&(p.style.strokeDashoffset=String(F*(1-N(n,.6,.94)))),t.style.setProperty(`--rtr-built`,String(N(n,.3,.78))),P(n)},B={build:0},V=null,H=()=>{V?.kill(),B.build=0,z(0),V=e.timeline({onUpdate:()=>z(B.build)}).to(B,{build:.3,duration:1.7,ease:`power2.out`}).to(B,{build:.72,duration:1.9,ease:`none`}).to(B,{build:1,duration:1.4,ease:`power2.inOut`})},U=()=>{V?.kill(),V=null},W=!1,G=e=>{let t=i.getBoundingClientRect();return M((e-t.left)/Math.max(t.width,1))},K=e=>{W=!0,U(),i.setPointerCapture(e.pointerId),t.dataset.scrubbing=`true`,z(G(e.clientX))},q=e=>{W&&z(G(e.clientX))},J=e=>{W&&(W=!1,t.dataset.scrubbing=`false`,i.hasPointerCapture(e.pointerId)&&i.releasePointerCapture(e.pointerId))};i.addEventListener(`pointerdown`,K),i.addEventListener(`pointermove`,q),i.addEventListener(`pointerup`,J),i.addEventListener(`pointercancel`,J),i.addEventListener(`keydown`,e=>{let t=e.shiftKey?.1:.02,n=null;e.key===`ArrowRight`||e.key===`ArrowUp`?n=C.build+t:e.key===`ArrowLeft`||e.key===`ArrowDown`?n=C.build-t:e.key===`Home`?n=0:e.key===`End`&&(n=1),n!==null&&(e.preventDefault(),U(),z(n))}),c?.addEventListener(`click`,()=>H()),new ResizeObserver(()=>{I(),O()}).observe(r),m.addEventListener(`change`,()=>{let e=x();w.y=e.focusY,w.crop=e.crop,S.apply(e),O()}),document.fonts?.ready&&document.fonts.ready.then(()=>{I(),O()}),I(),O(),z(0);let Y=()=>{if(n.dataset.ready===`true`){C.autoplay?H():z(1);return}requestAnimationFrame(Y)};return Y(),{surface:S,state:C,set(e){U(),z(e)},play:H,stop:U,applyParams(e){let{focusY:t,crop:n,...r}=e;S.apply(r),e.focusX!==void 0&&(w.x=e.focusX,O())},setCalloutsVisible(e){C.callouts=e,P(C.build)}}}function F(e){let t=[...e.querySelectorAll(`[data-rtr-service]`)];if(!t.length)return null;let r=1,i=[],a=[],o=t[0]?.closest(`section`),s=[...e.querySelectorAll(`[data-rtr-process-fill]`)];if(o&&s.length){let e=e=>{s.forEach((t,n)=>{let r=n/s.length,i=Math.max(0,Math.min(1,(e-r)*s.length));t.style.width=`${i*100}%`})};a.push(n.create({trigger:o,start:`top 70%`,end:`bottom bottom`,scrub:!0,onUpdate:t=>e(t.progress),onRefresh:t=>e(t.progress)}))}return t.forEach((e,t)=>{let o=e.querySelector(`[data-rtr-canvas]`);if(!o)return;let s=e.querySelector(`[data-rtr-pct]`),c=e.querySelector(`[data-rtr-stage]`),l=[...e.querySelectorAll(`[data-rtr-item]`)],u=k(o,{src:o.dataset.src??``,params:{seed:.31*(t+1),maxCell:64,zoom:.04}});i.push(u);let d=[`concept`,`build`,`show`],f=t=>{u.setBuild(t),e.style.setProperty(`--b`,String(t)),s&&(s.textContent=`${String(Math.round(t*100)).padStart(3,` `)}%`),c&&(c.textContent=d[t<.34?0:t<.8?1:2]),l.forEach((e,n)=>{let r=.3+n/Math.max(l.length,1)*.55;e.style.setProperty(`--on`,t>=r?`1`:`0`)})};a.push(n.create({trigger:e,start:`top 88%`,end:()=>`top ${Math.round(88-66*r)}%`,scrub:.4,onUpdate:e=>f(e.progress),onRefresh:e=>f(e.progress)})),f(0)}),{applyParams(e){i.forEach(t=>t.apply(e))},setSpan(e){r=e,a.forEach(e=>e.refresh())}}}var I=.62;function L(t){let n=t.querySelector(`[data-rtr-cases]`);if(!n)return null;let r=[...n.querySelectorAll(`a[href]`)].filter(e=>e.querySelector(`img`));if(!r.length)return null;let i=[];return r.forEach((t,n)=>{let r=t.querySelector(`img`),a=r?.parentElement,o=r?.currentSrc||r?.src;if(!r||!a||!o)return;a.classList.add(`rtr-shot`);let s=document.createElement(`canvas`);s.setAttribute(`aria-hidden`,`true`),a.append(s);let c=document.createElement(`span`);c.className=`rtr-shot-tag`,c.textContent=`concept`,a.append(c);let l=k(s,{src:o,params:{seed:.77*(n+1),maxCell:40,build:I,zoom:.03,snap:.25,wash:.1}});i.push(l);let u={build:I},d=e=>{u.build=e,l.setBuild(e),t.style.setProperty(`--b`,String(e)),c.textContent=e>.97?`built`:e<.62?`concept`:`build`};d(I);let f=t=>e.to(u,{build:t,duration:t>u.build?.8:.5,ease:t>u.build?`power2.out`:`power2.inOut`,overwrite:!0,onUpdate:()=>d(u.build)});t.addEventListener(`pointerenter`,()=>f(1)),t.addEventListener(`pointerleave`,()=>f(I)),t.addEventListener(`focusin`,()=>f(1)),t.addEventListener(`focusout`,()=>f(I))}),{applyParams(e){let{build:t,...n}=e;i.forEach(e=>e.apply(n))}}}function R(){let e=document.getElementById(`rtr`);if(!e)return;t();let n=P(e),i=F(e),a=L(e),o={...C,build:0,autoplay:!0,callouts:!0,gridOpacity:1,serviceSpan:1},s=[`edgeThreshold`,`edgeSoft`,`edgeLift`,`lineWidth`,`lineColor`,`lineOpacity`,`maxCell`,`dither`,`ditherPx`,`paletteCount`,`wash`,`washColor`,`focusX`,`zoom`,`snap`],c=()=>{let e={};s.forEach(t=>{e[t]=o[t]}),n?.applyParams(e),i?.applyParams({...e,focusX:0}),a?.applyParams({...e,focusX:0})},l=r(`Render to Reality`,o),u=l.addFolder({title:`Build`,expanded:!0}),d=!1,f=u.addBinding(o,`build`,{min:0,max:1,step:.001,label:`build`}).on(`change`,e=>{d||n?.set(e.value)});u.addBinding(o,`autoplay`,{label:`auto-play`}),u.addButton({title:`Replay 5 s`}).on(`click`,()=>n?.play()),u.addBinding(o,`callouts`,{label:`callouts`}).on(`change`,e=>n?.setCalloutsVisible(e.value));let p=l.addFolder({title:`Blueprint`,expanded:!1});p.addBinding(o,`edgeThreshold`,{min:.02,max:1.2,step:.01,label:`edge threshold`}),p.addBinding(o,`edgeSoft`,{min:.02,max:1.5,step:.01,label:`edge softness`}),p.addBinding(o,`edgeLift`,{min:.2,max:1.4,step:.01,label:`shadow lift`}),p.addBinding(o,`lineWidth`,{min:.5,max:4,step:.05,label:`line width`}),p.addBinding(o,`lineColor`,{label:`line colour`}),p.addBinding(o,`lineOpacity`,{min:0,max:1,step:.01,label:`line opacity`}),p.addBinding(o,`wash`,{min:0,max:.6,step:.01,label:`tonal wash`}),p.addBinding(o,`washColor`,{label:`wash colour`});let m=l.addFolder({title:`Blocks`,expanded:!1});m.addBinding(o,`maxCell`,{min:8,max:180,step:1,label:`max block px`}),m.addBinding(o,`paletteCount`,{min:2,max:16,step:1,label:`palette size`}),m.addBinding(o,`dither`,{min:0,max:1.2,step:.01,label:`dither`}),m.addBinding(o,`ditherPx`,{min:1,max:10,step:1,label:`dither px`}),m.addBinding(o,`snap`,{min:0,max:1,step:.01,label:`land flash`}),m.addBinding(o,`zoom`,{min:0,max:.2,step:.005,label:`settle zoom`});let h=l.addFolder({title:`Sheet`,expanded:!1});h.addBinding(o,`gridOpacity`,{min:0,max:2,step:.01,label:`graph paper`}).on(`change`,t=>e.style.setProperty(`--rtr-grid`,String(t.value))),h.addBinding(o,`focusX`,{min:-1,max:1,step:.01,label:`crop x`}),h.addBinding(o,`serviceSpan`,{min:.4,max:2.5,step:.05,label:`scroll span`}).on(`change`,e=>i?.setSpan(e.value)),l.on(`change`,()=>{d||c()}),e.style.setProperty(`--rtr-grid`,String(o.gridOpacity)),c(),i?.setSpan(o.serviceSpan),n?.setCalloutsVisible(o.callouts),n&&(n.state.autoplay=o.autoplay),window.rtr={hero:n,services:i,cases:a,knobs:o,pushShader:c},setInterval(()=>{n&&o.build!==n.state.build&&(d=!0,o.build=n.state.build,f.refresh(),d=!1)},90)}R();