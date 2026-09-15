import{n as e,t}from"./tweak.BLgDkXOo.js";var n=`#version 300 es
in vec2 aPos;
out vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`,r=`#version 300 es
precision highp float;

in vec2 vUv;
out vec4 frag;

uniform vec2 uTilt;      // card rotation in radians: x about the vertical axis, y about the horizontal
uniform vec2 uPointer;   // pointer position over the card, 0..1
uniform float uOpacity;  // how lit the foil is right now
uniform float uTime;
uniform float uSeed;
uniform float uAspect;
uniform float uGrain;    // flake density multiplier

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
    u.y
  );
}

void main() {
  vec2 uv = vUv;
  vec2 p = (uv - 0.5) * vec2(uAspect, 1.0);

  // Where the eye is, relative to this fragment.
  vec3 V = normalize(vec3(p, 1.65));

  // The card's normal, turned by however the card is tilted.
  float cx = cos(uTilt.y);
  float sx = sin(uTilt.y);
  float cy = cos(uTilt.x);
  float sy = sin(uTilt.x);
  vec3 N = normalize(vec3(sy * cx, -sx, cy * cx));

  // Flakes in the laminate: a two-scale hash field that bends the normal.
  vec2 fuv = uv * vec2(uAspect, 1.0);
  float fineFlake = noise(fuv * 210.0 * uGrain + uSeed * 37.0);
  float coarseFlake = noise(fuv * 48.0 - uSeed * 11.0);
  vec3 Nf = normalize(N + vec3((fineFlake - 0.5) * 0.30, (coarseFlake - 0.5) * 0.26, 0.0));

  float cosT = clamp(dot(Nf, V), 0.03, 1.0);

  // Film thickness: broad waves across the card plus the flake field, so the bands are not regular.
  float thickness =
    2.7 +
    1.8 * noise(fuv * 3.1 + uSeed) +
    1.1 * sin((p.x + p.y * 1.3) * 8.5 + uSeed * 6.283) +
    0.5 * coarseFlake;

  float phase = (thickness / cosT) * 5.0 + uTime * 0.05;
  vec3 film = 0.5 + 0.5 * sin(phase + vec3(0.0, 2.094, 4.188));

  // Pull the spectrum toward the brand: cyan and indigo keep their weight, the warm end is damped.
  film = mix(film, film * vec3(0.72, 0.92, 1.18), 0.42);

  float f0 = 0.05;
  float fresnel = f0 + (1.0 - f0) * pow(1.0 - cosT, 5.0);

  // The pool of light you drag across the card. Foil is a highlight travelling over an image,
  // not a coat of paint: everything outside the pool stays close to black so the photograph
  // underneath survives the blend.
  vec2 ptr = (uPointer - 0.5) * vec2(uAspect, 1.0);
  float d = distance(p, ptr);
  float spec = exp(-d * d * 6.0);
  float pool = 0.22 + 0.78 * exp(-d * d * 1.9);

  // Individual flakes catching the light.
  float glitter = pow(fineFlake, 26.0) * 2.6 * (0.25 + spec);

  vec3 col = film * (0.035 + fresnel * 0.78 + spec * 0.8) + glitter;
  // Crush the low end so the sheen reads as bands rather than a wash.
  col = pow(clamp(col, 0.0, 1.0), vec3(1.55)) * pool;

  frag = vec4(col * uOpacity * 1.15, 1.0);
}`;function i(e,t,n){let r=e.createShader(t);if(e.shaderSource(r,n),e.compileShader(r),!e.getShaderParameter(r,e.COMPILE_STATUS))throw Error(`foil-gl: ${e.getShaderInfoLog(r)}`);return r}function a(e,t=Math.random()){let a=e.getContext(`webgl2`,{alpha:!1,antialias:!1,depth:!1,stencil:!1,powerPreference:`high-performance`});if(!a)return null;let o=a.createProgram();if(a.attachShader(o,i(a,a.VERTEX_SHADER,n)),a.attachShader(o,i(a,a.FRAGMENT_SHADER,r)),a.linkProgram(o),!a.getProgramParameter(o,a.LINK_STATUS))throw Error(`foil-gl: ${a.getProgramInfoLog(o)}`);a.useProgram(o);let s=a.createVertexArray();a.bindVertexArray(s);let c=a.createBuffer();a.bindBuffer(a.ARRAY_BUFFER,c),a.bufferData(a.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),a.STATIC_DRAW);let l=a.getAttribLocation(o,`aPos`);a.enableVertexAttribArray(l),a.vertexAttribPointer(l,2,a.FLOAT,!1,0,0);let u={tilt:a.getUniformLocation(o,`uTilt`),pointer:a.getUniformLocation(o,`uPointer`),opacity:a.getUniformLocation(o,`uOpacity`),time:a.getUniformLocation(o,`uTime`),seed:a.getUniformLocation(o,`uSeed`),aspect:a.getUniformLocation(o,`uAspect`),grain:a.getUniformLocation(o,`uGrain`)};a.uniform1f(u.seed,t*10);let d=0,f=0,p=()=>{let t=Math.min(window.devicePixelRatio||1,2),n=e.getBoundingClientRect(),r=Math.max(2,Math.round(n.width*t)),i=Math.max(2,Math.round(n.height*t));(r!==d||i!==f)&&(d=r,f=i,e.width=d,e.height=f,a.viewport(0,0,d,f),a.uniform1f(u.aspect,d/f),a.uniform1f(u.grain,Math.max(.6,260/Math.max(d,1))))};p();let m=Math.PI/180;return{resize:p,render(e,t){a.useProgram(o),a.bindVertexArray(s),a.uniform2f(u.tilt,e.tiltX*m,e.tiltY*m),a.uniform2f(u.pointer,e.px,e.py),a.uniform1f(u.opacity,e.opacity),a.uniform1f(u.time,t),a.drawArrays(a.TRIANGLES,0,3)},dispose(){a.getExtension(`WEBGL_lose_context`)?.loseContext()}}}var o=(e,t=0,n=1)=>Math.min(n,Math.max(t,e)),s=(e,t,n)=>e+(t-e)*n,c=(e,t,n,r,i)=>r+(o(e,Math.min(t,n),Math.max(t,n))-t)/(n-t)*(i-r),l=(e,t=1.42)=>1+(t+1)*(e-1)**3+t*(e-1)**2,u={px:50,py:50,bx:50,by:50,rx:0,ry:0,o:0},d=[],f=[],p=new WeakMap,m=0,h=null,g={foilIntensity:1,tiltAmount:1,fanSpread:8.5,fanGap:142,ripSpeed:1,tickerSpeed:42,frameThickness:18,foilHoverOnly:!0,webglFoil:!0,darkGround:!0},_,v=()=>g.foilHoverOnly?.28:.6;function y(){_.style.setProperty(`--foil`,String(g.foilIntensity)),_.style.setProperty(`--tilt`,String(g.tiltAmount)),_.style.setProperty(`--fan-spread`,String(g.fanSpread)),_.style.setProperty(`--fan-gap`,String(g.fanGap)),_.style.setProperty(`--ticker-speed`,String(g.tickerSpeed)),_.style.setProperty(`--frame`,String(g.frameThickness)),_.style.setProperty(`--foil-ambient`,g.foilHoverOnly?`0`:`0.35`),_.classList.toggle(`ce--paper`,!g.darkGround),_.classList.toggle(`ce--gl`,g.webglFoil&&x),document.querySelector(`main`)?.classList.toggle(`dark`,g.darkGround);for(let e of d)e.dirty=!0}function b(e){let t=p.get(e);if(t)return t;let n={el:e,cur:{...u},target:{...u},tiltScale:Number(e.dataset.tiltScale??1),device:e.dataset.tilt===`device`,dirty:!0};if(d.push(n),p.set(e,n),e.closest(`.ce-hero`))return f.push(n),n;let r=t=>{let r=e.getBoundingClientRect();if(!r.width||!r.height)return;let i=o((t.clientX-r.left)/r.width),a=o((t.clientY-r.top)/r.height);n.target={px:i*100,py:a*100,bx:c(i,0,1,37,63),by:c(a,0,1,33,67),rx:-(i-.5)*2*13*n.tiltScale,ry:(a-.5)*2*13*n.tiltScale,o:1}},i=()=>{n.target={...u,o:n.gl?v():g.foilHoverOnly?0:.35}};return e.addEventListener(`pointermove`,r),e.addEventListener(`pointerenter`,r),e.addEventListener(`pointerleave`,i),e.addEventListener(`pointercancel`,i),n}var x=!1,S=!0;function C(){let e=Array.from(document.querySelectorAll(`.ce-fan .ce-card`));e.forEach((t,n)=>{let r=p.get(t);if(!r)return;let i=document.createElement(`canvas`);i.className=`ce-glfoil`,i.setAttribute(`aria-hidden`,`true`),t.querySelector(`.ce-card__face`)?.insertBefore(i,t.querySelector(`.ce-card__shine`));try{let t=a(i,(n+1)/(e.length+1));if(!t)return;r.gl=t,r.glTiltBias=(n-(e.length-1)/2)*4.5,r.target.o=v(),x=!0}catch{i.remove()}}),window.addEventListener(`resize`,()=>d.forEach(e=>e.gl?.resize()));let t=document.querySelector(`.ce-fan`);t&&`IntersectionObserver`in window&&new IntersectionObserver(([e])=>{S=e.isIntersecting},{rootMargin:`10% 0px`}).observe(t)}var w=performance.now();function T(e){let t=(e-w)/1e3;h?.(t);for(let e of d){let n=e.cur,r=e.target;if(!(Math.abs(n.px-r.px)+Math.abs(n.py-r.py)+Math.abs(n.rx-r.rx)+Math.abs(n.ry-r.ry)+Math.abs(n.o-r.o)*100<.05&&!e.dirty)){let t=.16;n.px=s(n.px,r.px,t),n.py=s(n.py,r.py,t),n.bx=s(n.bx,r.bx,t),n.by=s(n.by,r.by,t),n.rx=s(n.rx,r.rx,t),n.ry=s(n.ry,r.ry,t),n.o=s(n.o,r.o,t*1.2);let i=e.el.style;i.setProperty(`--px`,`${n.px.toFixed(2)}%`),i.setProperty(`--py`,`${n.py.toFixed(2)}%`),i.setProperty(`--bx`,`${n.bx.toFixed(2)}%`),i.setProperty(`--by`,`${n.by.toFixed(2)}%`),i.setProperty(`--rx`,`${n.rx.toFixed(2)}deg`),i.setProperty(`--ry`,`${n.ry.toFixed(2)}deg`),i.setProperty(`--o`,n.o.toFixed(3)),e.dirty=!1}e.gl&&g.webglFoil&&S&&e.gl.render({tiltX:n.rx*g.tiltAmount+(e.glTiltBias??0),tiltY:n.ry*g.tiltAmount,px:n.px/100,py:n.py/100,opacity:Math.max(n.o,0)*g.foilIntensity},t)}requestAnimationFrame(T)}function E(e,t){let n=document.querySelector(`.ce-hero-track`),r=document.querySelector(`.ce-hero`),i=document.querySelector(`.ce-pack`),a=document.querySelector(`.ce-fan`);if(!n||!r||!i||!a)return;let s=[],d=20260915,_=()=>(d=(d*1664525+1013904223)%4294967296)/4294967296;for(let e=0;e<=28;e++){let t=e/28*100,n=(_()-.5)*5.6+Math.sin(e*1.9)*1.5;s.push({x:t,y:19+n})}let y=s.map(e=>`${e.x.toFixed(2)}% ${e.y.toFixed(2)}%`).join(`, `),b=[...s].reverse().map(e=>`${e.x.toFixed(2)}% ${e.y.toFixed(2)}%`).join(`, `);i.style.setProperty(`--tear-top`,`polygon(0% 0%, 100% 0%, ${b})`),i.style.setProperty(`--tear-body`,`polygon(${y}, 100% 100%, 0% 100%)`);let x=Array.from(document.querySelectorAll(`.ce-fan__slot`)),S=(x.length-1)/2,C=0,w=0,T={v:0},E={v:0},D=!1,O=()=>{let e=Math.max(w,T.v,E.v)*g.ripSpeed;C=o(e/.55),r.style.setProperty(`--rip`,C.toFixed(4));let t=0;x.forEach((n,r)=>{let i=Math.abs(r-S),a=o((e-.26-i*.045)/.4),s=a<=0?0:a>=1?1:l(a,1.25);n.style.setProperty(`--fan`,s.toFixed(4)),r===Math.round(S)&&(t=a)}),a.classList.toggle(`is-open`,t>.55),i.classList.toggle(`is-open`,C>.7),r.classList.toggle(`is-torn`,C>.98),r.classList.toggle(`is-dealt`,t>.7)};O(),e.create({trigger:n,start:`top top`,end:`bottom bottom`,onUpdate:e=>{w=e.progress,w>.02&&(D=!0),O()}});let k=()=>{D||T.v>0||t.to(T,{v:1,duration:2.2,ease:`power2.inOut`,onUpdate:O})},A=window.setTimeout(k,4200),j=()=>{D=!0,window.clearTimeout(A)};r.ceReseal=()=>{D=!1,t.to([T,E],{v:0,duration:.7,ease:`power2.inOut`,onUpdate:O}),window.setTimeout(k,6e3)},r.addEventListener(`pointermove`,e=>{m=performance.now();for(let t of f){let n=t.el.getBoundingClientRect();if(!n.width||!n.height)continue;let r=(e.clientX-n.left)/n.width,i=(e.clientY-n.top)/n.height,a=r>=0&&r<=1&&i>=0&&i<=1,s=o(r),l=o(i),u=(e.clientX-(n.left+n.width/2))/(n.width*1.9),d=(e.clientY-(n.top+n.height/2))/(n.height*1.6),f=o(1-Math.hypot(u,d)),p=a?1:.5;t.target={px:s*100,py:l*100,bx:c(s,0,1,37,63),by:c(l,0,1,33,67),rx:-(o(r,-.6,1.6)-.5)*2*13*t.tiltScale*p,ry:(o(i,-.6,1.6)-.5)*2*13*t.tiltScale*p,o:a?1:Math.max(f*.85,t.gl?v():0)}}}),r.addEventListener(`pointerleave`,()=>{for(let e of f)e.target={...u,o:e.gl?v():g.foilHoverOnly?.18:.4}});let M=p.get(i);h=e=>{M&&(performance.now()-m<1500||C>.03||(M.target.rx=Math.sin(e*.62)*6.5,M.target.ry=Math.cos(e*.47)*4,M.target.bx=50+Math.sin(e*.62)*12,M.target.by=50+Math.cos(e*.47)*10,M.target.o=.42+.28*(.5+.5*Math.sin(e*.85)),M.dirty=!0))};let N=!1,P=0,F=0,I=0,L=0,R=0,z=0,B=0;i.addEventListener(`pointerdown`,e=>{j(),!(C>.98)&&(N=!0,P=e.clientX,F=e.clientY,I=E.v,L=0,z=0,R=0,B=performance.now(),t.killTweensOf(E),i.classList.add(`is-dragging`),i.setPointerCapture(e.pointerId),e.preventDefault())}),i.addEventListener(`pointermove`,e=>{if(!N)return;L=e.clientX-P-(e.clientY-F);let t=performance.now(),n=Math.max(16,t-B);R=(L-z)/n*1e3,z=L,B=t,i.style.setProperty(`--pull`,String(o(L/230,-.4,1))),E.v=o(I+L/(230*g.ripSpeed)*.55),O()});let V=e=>{if(!N)return;N=!1,i.classList.remove(`is-dragging`),i.hasPointerCapture(e.pointerId)&&i.releasePointerCapture(e.pointerId),t.to(i,{"--pull":0,duration:.5,ease:`elastic.out(1, 0.45)`});let n=C+o(R/2600,-.5,.6)>.34;t.to(E,{v:+!!n,duration:n?Math.max(.42,.95-Math.abs(R)/4200):.5,ease:n?`power3.out`:`power2.inOut`,onUpdate:O})};i.addEventListener(`pointerup`,V),i.addEventListener(`pointercancel`,V),i.addEventListener(`keydown`,e=>{(e.key===`Enter`||e.key===` `)&&(e.preventDefault(),j(),t.to(E,{v:1,duration:1.2,ease:`power2.inOut`,onUpdate:O}))});let H=(e,t=-30)=>{x.forEach((n,r)=>{let i=n.querySelector(`.ce-card`),a=r===e;n.style.setProperty(`--hover-lift`,a?`${t}px`:`0px`),n.classList.toggle(`is-hot`,a),i?.classList.toggle(`is-hot`,a)}),a.classList.toggle(`has-hot`,e!==null)};x.forEach((e,t)=>{e.addEventListener(`pointerenter`,()=>H(t)),e.addEventListener(`pointerleave`,()=>H(J))});let U=window.matchMedia(`(max-width: 620px)`),W=Math.round(S),G=W,K=()=>{let e=U.matches;x.forEach((t,n)=>{let r=e?n-G:n-S;t.style.setProperty(`--i`,String(r)),t.style.setProperty(`--abs-i`,String(Math.abs(r))),t.classList.toggle(`is-out`,e&&Math.abs(n-G)>1)})};K(),U.addEventListener(`change`,()=>{G=W,K()});let q=Array.from(document.querySelectorAll(`.ce-rail__chip`)),J=null,Y=e=>{J=e,q.forEach((t,n)=>t.setAttribute(`aria-pressed`,String(n===e))),G=e===null?W:Math.min(Math.max(e,1),x.length-2),K(),H(e,-46)};q.forEach((e,n)=>{e.addEventListener(`click`,()=>{j(),C<.98&&t.to(E,{v:1,duration:.9,ease:`power3.out`,onUpdate:O}),Y(J===n?null:n)}),e.addEventListener(`pointerenter`,()=>{C>.9&&!U.matches&&H(n,-46)}),e.addEventListener(`pointerleave`,()=>{U.matches||H(J,-46)})})}function D(e,t){e.utils.toArray(`.ce-reveal`).forEach(t=>{e.to(t,{opacity:1,y:0,scale:1,duration:1,ease:`expo.out`,scrollTrigger:{trigger:t,start:`top 88%`,once:!0}})}),e.utils.toArray(`.ce-slab`).forEach(n=>{e.fromTo(n,{opacity:0,y:80,rotateX:-9,transformPerspective:1400},{opacity:1,y:0,rotateX:0,duration:1.1,ease:`expo.out`,clearProps:`transform,willChange`,scrollTrigger:{trigger:n,start:`top 84%`,once:!0}}),t.create({trigger:n,start:`top 78%`,once:!0,onEnter:()=>n.classList.add(`is-graded`)});let r=n.querySelector(`.ce-label`);r&&e.fromTo(r,{opacity:0,yPercent:-18},{opacity:1,yPercent:0,duration:.9,delay:.16,ease:`expo.out`,clearProps:`transform,willChange`,scrollTrigger:{trigger:n,start:`top 84%`,once:!0}})}),e.utils.toArray(`.ce-set__row`).forEach(t=>{e.fromTo(t.children,{opacity:0,y:26},{opacity:1,y:0,duration:.9,ease:`expo.out`,stagger:.08,scrollTrigger:{trigger:t,start:`top 92%`,once:!0}})})}function O(){let e=Array.from(document.querySelectorAll(`.ce-tcard`)),t=document.querySelector(`[data-flipped]`),n=new Set;e.forEach((e,r)=>{e.addEventListener(`click`,()=>{let i=e.getAttribute(`aria-pressed`)!==`true`;e.setAttribute(`aria-pressed`,String(i)),i&&n.add(r),t&&(t.textContent=String(n.size).padStart(2,`0`))})})}function k(){document.querySelectorAll(`.ce-set`).forEach(e=>{let t=e.querySelector(`.ce-set__detail`),n=Array.from(e.querySelectorAll(`.ce-mini`));n.forEach(e=>{e.addEventListener(`click`,()=>{let r=e.getAttribute(`aria-expanded`)!==`true`;if(n.forEach(e=>e.setAttribute(`aria-expanded`,`false`)),e.setAttribute(`aria-expanded`,String(r)),!t)return;let i=e.dataset.detail??``;t.textContent=r?i:``,t.hidden=!r||!i})})})}function A(){let e=!1,t=e=>{if(e.gamma==null||e.beta==null)return;let t=o(e.gamma,-18,18),n=o(e.beta-40,-20,20);for(let e of d)e.device&&(e.target={px:c(t,-18,18,0,100),py:c(n,-20,20,0,100),bx:c(t,-18,18,37,63),by:c(n,-20,20,33,67),rx:-t*.8*e.tiltScale,ry:n*.6*e.tiltScale,o:1})},n=()=>{e||(e=!0,window.addEventListener(`deviceorientation`,t))},r=window.DeviceOrientationEvent;if(r){if(typeof r.requestPermission==`function`){let e=()=>{r.requestPermission?.().then(e=>e===`granted`&&n()).catch(()=>{}),window.removeEventListener(`touchend`,e)};window.addEventListener(`touchend`,e,{passive:!0})}else n()}}function j(){let n=document.querySelector(`.ce`);if(!n)return;_=n;let{gsap:r,ScrollTrigger:i}=e();document.querySelectorAll(`.ce-foil-host`).forEach(b),C(),y(),A(),requestAnimationFrame(T),E(i,r),D(r,i),O(),k();let a=t(`Collector's Edition`,g),o=()=>y();a.addBinding(g,`foilIntensity`,{label:`foil`,min:0,max:2,step:.05}).on(`change`,o),a.addBinding(g,`tiltAmount`,{label:`tilt`,min:0,max:2,step:.05}).on(`change`,o),a.addBinding(g,`fanSpread`,{label:`fan angle`,min:0,max:20,step:.5}).on(`change`,o),a.addBinding(g,`fanGap`,{label:`fan spread`,min:0,max:170,step:1}).on(`change`,o),a.addBinding(g,`ripSpeed`,{label:`rip speed`,min:.4,max:2.5,step:.05}).on(`change`,o),a.addBinding(g,`tickerSpeed`,{label:`ticker s`,min:8,max:120,step:1}).on(`change`,o),a.addBinding(g,`frameThickness`,{label:`slab frame`,min:4,max:38,step:1}).on(`change`,o),a.addBinding(g,`foilHoverOnly`,{label:`foil on hover only`}).on(`change`,o),a.addBinding(g,`webglFoil`,{label:`WebGL foil`}).on(`change`,o),a.addBinding(g,`darkGround`,{label:`dark ground`}).on(`change`,o),a.addButton({title:`Reseal the pack`}).on(`click`,()=>{document.querySelector(`.ce-hero`)?.ceReseal?.()}),i.refresh(),window.addEventListener(`load`,()=>i.refresh()),document.fonts?.ready.then(()=>i.refresh())}j();