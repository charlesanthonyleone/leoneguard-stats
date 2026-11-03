(()=>{const pe="attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }",me=`
precision highp float;
uniform vec2 R; uniform float T; uniform float TS; uniform vec4 RIP[4]; uniform sampler2D MW; uniform float MWON;
const float HZ = __HZ__;
uniform vec3 MOON; // moon direction, set from JS so the photo disc sits top-right at any aspect
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float h31(vec3 p){ p = fract(p*vec3(.1031,.11369,.13787)); p += dot(p, p.yzx+19.19); return fract((p.x+p.y)*p.z); }
float n2(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return -1.+2.*mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y); }
float n3(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm3(vec3 p, int o){ float a=.5, s=0.; for(int i=0;i<5;i++){ if(i>=o) break; s+=a*n3(p); p=p*2.03+vec3(1.7,9.2,3.1); a*=.5; } return s; }
mat3 rotY(float a){ float c=cos(a), s=sin(a); return mat3(c,0,-s, 0,1,0, s,0,c); }
mat3 rotX(float a){ float c=cos(a), s=sin(a); return mat3(1,0,0, 0,c,s, 0,-s,c); }

float starfield(vec3 s, float sc, float thr){ // dense faint stars: one hashed point per cell on the sphere
  vec3 c = floor(s*sc), f = fract(s*sc) - .5; float h = h31(c);
  if (h < thr) return 0.;
  vec3 o = vec3(h31(c+7.1), h31(c+3.3), h31(c+1.7)) - .5; float d = length(f - o*.7);
  return smoothstep(.16, 0., d) * pow((h-thr)/(1.-thr), 2.);
}
vec3 sky(vec3 d, bool refl){
  float e = max(d.y, 0.);
  // Bortle 1: true black overhead, natural airglow (green 557nm + faint red 630nm) in a band above the horizon
  vec3 col = mix(vec3(.006,.010,.020), vec3(.0008,.0014,.0035), pow(e, .4));
  col += vec3(.010,.030,.016) * exp(-e*11.) * (.8 + .4*n3(d*4. + TS*.01));
  col += vec3(.020,.006,.004) * exp(-e*30.);
  vec3 s = rotX(.62) * rotY(TS*.004) * rotX(-.62) * d; // the celestial sphere turns slowly (for procedural field stars)
  // real photograph: ESO/S. Brunier all-sky Milky Way panorama (CC BY 4.0), projected onto the sky with a very slow drift
  if (MWON > .5 && d.z > .05) {
    vec2 q = d.xy / d.z;
    float a = sin(TS*.0021)*.035; q = mat2(cos(a),sin(a),-sin(a),cos(a)) * (q - vec2(.23,.17)) + vec2(.23,.17);
    q.x += sin(TS*.0013)*.06;
    vec2 tuv = vec2((q.x - .22)/1.5 + .5, (.49 - q.y)/.75);
    vec3 ph = texture2D(MW, tuv).rgb; ph = pow(ph, vec3(2.2)) * (refl ? .9 : 1.55);
    float edge = smoothstep(0.,.06,tuv.x)*smoothstep(1.,.94,tuv.x)*smoothstep(0.,.06,tuv.y)*smoothstep(1.,.94,tuv.y);
    col += ph * edge * smoothstep(0.,.12,e) * (1. - .55*exp(-e*14.)); // fades into airglow at the horizon
  }
  if (!refl) col += starfield(s+.77, 180., .985) * vec3(.7,.75,.9) * .18 * smoothstep(0.,.1,e); // scattered faint field stars everywhere
  // moon: the disc itself is a real photo drawn on the 2D layer; here only a soft, local halo (keeps the Milky Way intact)
  float md = dot(d, MOON), ang = acos(clamp(md,-1.,1.));
  col += vec3(.85,.88,.95) * (exp(-ang*45.)*.06 + exp(-ang*12.)*.010) * (refl ? 0. : 1.);
  // very thin high cloud wisps, only visible as stars dimming
  if (!refl && e > .005) {
    vec2 cp = d.xz/(d.y+.08) * .9 + vec2(TS*.006, TS*.002);
    float c = smoothstep(.72, .98, fbm3(vec3(cp*1.6, TS*.01), 4));
    col *= 1. - c*.35*smoothstep(.0,.3,e);
  }
  return col;
}

// ---- ocean: long Gerstner swells + choppy wind sea (Seascape-style octaves)
const mat2 OM = mat2(1.6,1.2,-1.2,1.6);
float oct(vec2 uv, float ch){ uv += n2(uv); vec2 wv = 1.-abs(sin(uv)), sw = abs(cos(uv)); wv = mix(wv, sw, wv); return pow(1.-pow(wv.x*wv.y,.65), ch); }
float swell(vec2 p){
  float h = 0.;
  h += 1.25*sin(dot(p, normalize(vec2(1.,.28)))*.045 + T*.62);
  h += .80*sin(dot(p, normalize(vec2(.7,-.6)))*.071 + T*.80 + 1.3);
  h += .45*sin(dot(p, normalize(vec2(-.3,1.)))*.11 + T*.99 + 4.);
  return h;
}
float ripple(vec2 p){
  float h = 0.;
  for (int i=0;i<4;i++){ vec4 r = RIP[i]; if (r.w <= 0.) continue;
    float age = T - r.z; if (age < 0.) continue;
    float d = length(p - r.xy), R0 = age*5.2;
    h += r.w * sin((d-R0)*2.3) * exp(-pow((d-R0)/(1.4+age*.9),2.)) * exp(-age*.55) / (1.+d*.15); }
  return h;
}
float sea(vec3 p, int it){
  float fq = .16, amp = .52, ch = 4.2, h = 0.; vec2 uv = p.xz; uv.x *= .75;
  for (int i=0;i<5;i++){ if (i>=it) break;
    float d = oct((uv + T*.75)*fq, ch) + oct((uv - T*.75)*fq, ch);
    h += d*amp; uv *= OM; fq *= 1.9; amp *= .22; ch = mix(ch, 1., .2); }
  return p.y - h - swell(p.xz) - ripple(p.xz);
}
vec3 nrm(vec3 p, float eps){
  vec3 n; n.y = sea(p,5); n.x = sea(vec3(p.x+eps,p.y,p.z),5) - n.y; n.z = sea(vec3(p.x,p.y,p.z+eps),5) - n.y; n.y = eps; return normalize(n);
}
float trace(vec3 o, vec3 d, out vec3 p){
  float tm = 0., tx = 2000.; float hx = sea(o + d*tx, 3);
  if (hx > 0.) { p = o + d*tx; return tx; }
  float hm = sea(o, 3), tmid = 0.;
  for (int i=0;i<9;i++){ tmid = mix(tm, tx, hm/(hm-hx)); p = o + d*tmid; float hh = sea(p, 3);
    if (hh < 0.) { tx = tmid; hx = hh; } else { tm = tmid; hm = hh; } }
  return tmid;
}

void main(){
  vec2 uv = (gl_FragCoord.xy - .5*R) / R.y;
  float hz = (1. - HZ) - .5;
  vec3 rd = normalize(vec3(uv.x, uv.y - hz, 1.25));
  rd = rotX(sin(T*.21)*.006) * rotY(sin(T*.05)*.012) * rd; // a drifting raft: barely perceptible pitch and yaw
  vec3 ro = vec3(0., 6.2 + .5*sin(T*.62), T*.6);
  vec3 col;
  float mist = exp(-abs(rd.y)*38.); // sea mist hugging the horizon
  if (rd.y > -.0015) {
    col = sky(rd, false);
  } else {
    vec3 p; float dist = trace(ro, rd, p);
    vec3 n = nrm(p, max(.02, dist*.0021));
    n = normalize(mix(n, vec3(0,1,0), smoothstep(200., 1600., dist)*.6));
    vec3 r = reflect(rd, n); r.y = abs(r.y) + .001;
    float fres = clamp(.02 + .98*pow(1. - max(dot(n, -rd), 0.), 5.), 0., 1.);
    vec3 refl = sky(r, true) * 1.3;
    vec3 deep = vec3(.0006,.003,.007);
    vec3 sss = vec3(.010,.040,.055) * pow(max(p.y + 1.5, 0.)*.28, 2.) * max(dot(n, MOON*vec3(1,0,1)) + .3, 0.);
    col = mix(deep + sss, refl, fres*.8);
    float sp = max(dot(r, MOON), 0.);
    // moonlit glitter path: a column straight down from the moon on screen, widening slightly toward the viewer,
    // lit only where wave facets tilt the reflection toward the moon (so it shimmers instead of being a flat stripe)
    float cx = rd.x/rd.z - MOON.x/MOON.z, wdt = .035 + (-rd.y)*.10;
    float column = exp(-cx*cx/(wdt*wdt));
    col += vec3(.92,.95,1.) * (pow(sp, 2400.)*1.5*column + column*(pow(sp, 14.)*1.1 + pow(sp, 120.)*.9 + .012)) * (.6 + .4*fres*6.);
    // starlight glinting off facets: reflected stars break into sparkles
    vec3 rs = rotX(.62) * rotY(TS*.004) * rotX(-.62) * r;
    float gl = starfield(rs, 140., .955) * fres * 6. * exp(-dist*.004);
    col += vec3(.75,.82,1.) * gl * .5;
    float fog = 1. - exp(-dist*.0016);
    col = mix(col, vec3(.006,.014,.012), fog*.92);
  }
  col = mix(col, vec3(.010,.022,.016), mist*.55);
  col *= 1. - .32*dot(uv*.85, uv*.85); // vignette
  col = col / (1. + col*.5);
  col = pow(col, vec3(.4545));
  col += (h21(gl_FragCoord.xy + fract(T)*100.) - .5) / 220.; // dither: no banding in the dark gradients
  gl_FragColor = vec4(col, 1.);
}`,ue=["175,200,255","205,220,255","240,244,255","255,244,222","255,214,170","255,184,150"],ge=l=>{const f=document.createElement("canvas");f.width=f.height=64;const m=f.getContext("2d"),h=m.createRadialGradient(32,32,0,32,32,32);return h.addColorStop(0,"rgba(255,255,255,1)"),h.addColorStop(.1,`rgba(${l},.85)`),h.addColorStop(.28,`rgba(${l},.22)`),h.addColorStop(.55,`rgba(${l},.05)`),h.addColorStop(1,`rgba(${l},0)`),m.fillStyle=h,m.beginPath(),m.arc(32,32,32,0,Math.PI*2),m.fill(),f},ye=()=>{const l=document.createElement("canvas");l.width=l.height=128;const f=l.getContext("2d");for(const m of[!1,!0]){const h=m?f.createLinearGradient(64,0,64,128):f.createLinearGradient(0,64,128,64);h.addColorStop(0,"rgba(0,0,0,0)"),h.addColorStop(.5,"rgba(220,228,255,.75)"),h.addColorStop(1,"rgba(0,0,0,0)"),f.fillStyle=h,f.beginPath(),m?f.ellipse(64,64,.9,64,0,0,Math.PI*2):f.ellipse(64,64,64,.9,0,0,Math.PI*2),f.fill()}return l};function Z(l){return()=>{l|=0,l=l+1831565813|0;let f=Math.imul(l^l>>>15,1|l);return f=f+Math.imul(f^f>>>7,61|f)^f,((f^f>>>14)>>>0)/4294967296}}const $="lg.scene.v1",Y="lg-scene";function V(l){document.documentElement.classList.toggle("still",!l.ocean&&!l.sky)}function _(){const l=window.matchMedia("(prefers-reduced-motion: reduce)").matches,f={ocean:!l,sky:!l};try{const m=JSON.parse(localStorage.getItem($)||"null");if(m&&typeof m=="object")return{ocean:typeof m.ocean=="boolean"?m.ocean:f.ocean,sky:typeof m.sky=="boolean"?m.sky:f.sky}}catch{}return f}const M=l=>document.getElementById(l);function ve(){const l=_(),f=M("gear"),m=M("scene-panel");for(const h of["ocean","sky"]){const L=M("set-"+h);L.checked=l[h],L.addEventListener("change",()=>{const S=_();S[h]=L.checked;try{localStorage.setItem($,JSON.stringify(S))}catch{}window.dispatchEvent(new Event(Y))})}f.addEventListener("click",()=>{const h=m.hidden;m.hidden=!h,f.setAttribute("aria-expanded",String(h))}),document.addEventListener("keydown",h=>{h.key==="Escape"&&!m.hidden&&(m.hidden=!0,f.setAttribute("aria-expanded","false"),f.focus())})}function xe(){var fe;const l=M("scene-gl"),f=M("scene-2d"),m=M("scene-top");let h=_();const L=()=>{h=_(),V(h),h.sky||(v.length=0,I.length=0,A.length=0),C=!1,P()};V(h),window.addEventListener(Y,L);let S=40,U=40,C=!1,q=!1,n=null;try{n=l.getContext("webgl",{antialias:!1,premultipliedAlpha:!1,powerPreference:"high-performance"})}catch{n=null}const d=f.getContext("2d"),w=m.getContext("2d");let E=0,u=0,p=0,G=1,O=1,k=!1,J=null,j=null,K=null,Q=null,ee=null;if(n){const e=(o,a)=>{const s=n.createShader(o);return n.shaderSource(s,a),n.compileShader(s),n.getShaderParameter(s,n.COMPILE_STATUS)?s:(console.warn(n.getShaderInfoLog(s)),null)},t=e(n.VERTEX_SHADER,pe),i=e(n.FRAGMENT_SHADER,me.replace("__HZ__",.6.toFixed(3)));if(t&&i){const o=n.createProgram();if(n.attachShader(o,t),n.attachShader(o,i),n.linkProgram(o),n.getProgramParameter(o,n.LINK_STATUS)){n.useProgram(o);const a=n.createBuffer();n.bindBuffer(n.ARRAY_BUFFER,a),n.bufferData(n.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),n.STATIC_DRAW);const s=n.getAttribLocation(o,"p");n.enableVertexAttribArray(s),n.vertexAttribPointer(s,2,n.FLOAT,!1,0,0),K=n.getUniformLocation(o,"R"),Q=n.getUniformLocation(o,"T"),j=n.getUniformLocation(o,"TS"),ee=n.getUniformLocation(o,"RIP[0]"),J=n.getUniformLocation(o,"MOON");const r=n.getUniformLocation(o,"MWON");n.uniform1f(r,0),n.uniform1i(n.getUniformLocation(o,"MW"),0);const g=n.createTexture(),y=new Image;y.onload=()=>{const c=n;c.bindTexture(c.TEXTURE_2D,g),c.texImage2D(c.TEXTURE_2D,0,c.RGB,c.RGB,c.UNSIGNED_BYTE,y);for(const b of[c.TEXTURE_WRAP_S,c.TEXTURE_WRAP_T])c.texParameteri(c.TEXTURE_2D,b,c.CLAMP_TO_EDGE);c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MIN_FILTER,c.LINEAR),c.texParameteri(c.TEXTURE_2D,c.TEXTURE_MAG_FILTER,c.LINEAR),!q&&(c.useProgram(o),c.uniform1f(r,1),C=!1,P())},y.src="assets/sky/milkyway.webp",k=!0}}}k||(l.style.display="none",(fe=M("scene-fb"))==null||fe.classList.add("on"));const te=ue.map(ge),oe=ye();let W=[];const ne=[-.8,.58,-.122],be=Math.hypot(...ne),F=ne.map(e=>e/be),D=[-.08,.1,1].map((e,t,i)=>e/Math.hypot(...i)),Me=(()=>{const e=Z(11),t=[];for(;t.length<5200;){const i=e()*2-1,o=e()*6.283,a=Math.sqrt(1-i*i),s=[a*Math.cos(o),a*Math.sin(o),i],r=s[0]*F[0]+s[1]*F[1]+s[2]*F[2],g=Math.exp(-((s[0]-D[0])**2+(s[1]-D[1])**2+(s[2]-D[2])**2)*4);e()>Math.exp(-r*r*60)*(.35+.65*g+.3)||t.push({x:s[0],y:s[1],z:s[2],m:Math.pow(e(),3),w:g})}return t})(),ae=(e,t)=>{const i=Math.cos(t),o=Math.sin(t);return[e[0],i*e[1]-o*e[2],o*e[1]+i*e[2]]},we=(e,t)=>{const i=Math.cos(t),o=Math.sin(t);return[i*e[0]+o*e[2],e[1],-o*e[0]+i*e[2]]},_e=e=>{const t=-.09999999999999998,i=p*.6;d.globalCompositeOperation="lighter";for(const o of Me){const a=ae(we(ae([o.x,o.y,o.z],-.62),-e*.004),.62);if(a[2]<=.05)continue;const s=u/2+a[0]/a[2]*1.25*p,r=p/2-(a[1]/a[2]*1.25+t)*p;if(s<0||s>u||r<0||r>i-2)continue;const g=Math.min(1,(i-r)/(p*.12)),y=.7+o.m*1.6;d.globalAlpha=(.18+.55*o.m)*g,d.drawImage(te[o.w>.45?3:o.m>.5?1:2],s-y*2,r-y*2,y*4,y*4)}d.globalAlpha=1},re=()=>{u=window.innerWidth,p=window.innerHeight,O=Math.min(window.devicePixelRatio||1,2),G=Math.min(O,Math.sqrt(24e5/(u*p))),l.width=Math.round(u*G),l.height=Math.round(p*G);for(const o of[f,m])o.width=Math.round(u*O),o.height=Math.round(p*O),o.getContext("2d").setTransform(O,0,0,O,0,0);n&&k&&n.viewport(0,0,l.width,l.height);const e=Z(7),t=Math.hypot(u,p)*1.35,i=Math.round(Math.min(4500,u*p/300));W=Array.from({length:i},()=>{const o=e(),a=Math.pow(o,6.5),s=e();return{r:Math.sqrt(e())*t,a:e()*Math.PI*2,m:a,c:s<.12?0:s<.32?1:s<.7?2:s<.86?3:s<.96?4:5,f1:1.5+e()*3.5,f2:4+e()*6,p:e()*6.283}})};re(),window.addEventListener("resize",re);const z=new Image;z.onload=()=>{C=!1,P()},z.src="assets/sky/moon.webp";const ie=()=>{const e=Math.max(26,Math.min(58,p*.06));return{x:Math.min(u-e-40,u*.86),y:Math.max(e+80,p*.17),r:e}},Se=()=>{const e=ie(),t=1-.6-.5,i=[(e.x-u/2)/p,(p/2-e.y)/p-t,1.25],o=Math.hypot(...i);return i.map(a=>a/o)},Te=()=>{const e=ie();d.globalCompositeOperation="source-over";const t=d.createRadialGradient(e.x,e.y,e.r*.9,e.x,e.y,e.r*7);t.addColorStop(0,"rgba(215,225,245,.22)"),t.addColorStop(.25,"rgba(190,205,235,.07)"),t.addColorStop(1,"rgba(160,180,220,0)"),d.fillStyle=t,d.fillRect(e.x-e.r*7,e.y-e.r*7,e.r*14,e.r*14),d.fillStyle="#02040a",d.beginPath(),d.arc(e.x,e.y,e.r*.99,0,6.283),d.fill(),z.complete&&z.naturalWidth&&d.drawImage(z,e.x-e.r,e.y-e.r,e.r*2,e.r*2)},Re=e=>{const t=p*.6,i=u*.78,o=-p*.55,a=e*.0045;d.globalCompositeOperation="lighter";for(let s=0;s<W.length;s++){const r=W[s],g=r.a+a,y=i+Math.cos(g)*r.r,c=o+Math.sin(g)*r.r;if(y<-20||y>u+20||c<-20||c>t-2)continue;const b=Math.min(1,(t-c)/(p*.16)),T=h.sky?Math.max(0,.62+.38*Math.sin(e*r.f1+r.p)*Math.sin(e*r.f2+r.p*1.7)+.18*Math.sin(e*(9+s%7)+r.p*3)*r.m):.8,R=(1.1+r.m*9)*(.75+.45*T);if(d.globalAlpha=Math.min(1,(.32+.9*r.m)*T*b*b),d.drawImage(te[r.c],y-R,c-R,R*2,R*2),r.m>.42){const x=(8+34*r.m)*(.5+.6*T);d.globalAlpha=.5*T*b*r.m,d.drawImage(oe,y-x,c-x,x*2,x*2),r.m>.7&&(d.save(),d.translate(y,c),d.rotate(.785),d.globalAlpha*=.35,d.drawImage(oe,-x*.6,-x*.6,x*1.2,x*1.2),d.restore())}}d.globalAlpha=1},v=[],A=[];let se=1.2,le=10,ce=7;const Ee=e=>{const t=p*.6;if(e>se){const i=Math.random()<.5?-1:1,o=650+Math.random()*550,a=.22+Math.random()*.4;v.push({x:u*(.1+Math.random()*.8),y:t*(.04+Math.random()*.45),vx:Math.cos(a)*o*i,vy:Math.sin(a)*o,life:.5+Math.random()*.6,age:0,len:110+Math.random()*150}),se=e+2.2+Math.random()*5.5}if(e>le){const i=Math.random()<.5?-1:1;v.push({x:i>0?-80:u+80,y:t*(.1+Math.random()*.3),vx:i*(22+Math.random()*16),vy:3+Math.random()*5,life:(u+160)/26,age:0,len:170+Math.random()*100,comet:!0}),le=e+50+Math.random()*40}if(e>ce){const i=t+(p-t)*(.1+Math.random()*.35),o=u*(.15+Math.random()*.7),a=1.4+Math.random()*.6,s=o+(Math.random()<.5?-1:1)*u*(.22+Math.random()*.15),r=t*.04;v.push({x:s,y:r,vx:(o-s)/a,vy:(i-r)/a,life:a,age:0,len:230,lands:!0,ly:i}),ce=e+20+Math.random()*18}},Ce=(e,t,i)=>{const o=(e-u/2)/p,a=(p/2-t)/p,s=1-.6-.5,r=a-s,g=Math.hypot(o,r,1.25),y=r/g;if(y>=-.001)return null;const c=-(6.2+.5*Math.sin(i*.62))/y;return{x:o/g*c,z:i*.6+1.25/g*c}},de=(e,t)=>{try{Oe(e,t)}catch{t.age=t.life+99}},Oe=(e,t)=>{if(!(Math.hypot(t.vx,t.vy)>0)||![t.x,t.y,t.len,t.age].every(Number.isFinite))return;const i=Math.hypot(t.vx,t.vy),o=t.vx/i,a=t.vy/i,s=t.age/t.life,r=t.comet?Math.min(1,t.age/3,(t.life-t.age)/3):t.lands?Math.min(1,t.age*4):Math.sin(Math.min(1,s)*Math.PI);if(e.lineCap="round",t.comet){const T=t.x-o*t.len,R=t.y-a*t.len-20,x=e.createLinearGradient(t.x,t.y,T,R);x.addColorStop(0,`rgba(205,228,255,${.5*r})`),x.addColorStop(1,"rgba(205,228,255,0)"),e.strokeStyle=x;for(const[Ie,he]of[[8,0],[3,7],[2,-6]])e.lineWidth=Ie,e.globalAlpha=.3,e.beginPath(),e.moveTo(t.x,t.y),e.quadraticCurveTo((t.x+T)/2,(t.y+R)/2+he,T,R+he*2),e.stroke();e.globalAlpha=1;const N=e.createRadialGradient(t.x,t.y,0,t.x,t.y,11);N.addColorStop(0,`rgba(245,250,255,${.95*r})`),N.addColorStop(.3,`rgba(200,225,255,${.4*r})`),N.addColorStop(1,"rgba(180,210,255,0)"),e.fillStyle=N,e.beginPath(),e.arc(t.x,t.y,11,0,7),e.fill();return}const g=Math.min(t.len,i*t.age),y=e.createLinearGradient(t.x,t.y,t.x-o*g,t.y-a*g);y.addColorStop(0,`rgba(255,255,255,${r})`),y.addColorStop(.2,`rgba(190,215,255,${.55*r})`),y.addColorStop(1,"rgba(160,190,255,0)"),e.strokeStyle=y,e.lineWidth=t.lands?2.6:1.5,e.beginPath(),e.moveTo(t.x,t.y),e.lineTo(t.x-o*g,t.y-a*g),e.stroke();const c=t.lands?7+s*8:4.5,b=e.createRadialGradient(t.x,t.y,0,t.x,t.y,c);b.addColorStop(0,`rgba(255,255,255,${r})`),b.addColorStop(.35,`rgba(215,230,255,${.5*r})`),b.addColorStop(1,"rgba(170,200,255,0)"),e.fillStyle=b,e.beginPath(),e.arc(t.x,t.y,c,0,7),e.fill()},I=[],B=new Float32Array(16);let H=performance.now();const X=e=>{var t;try{ke(e)}catch(i){console.warn("[scene] render failed, using fallback",i),k=!1,l.style.display="none",(t=M("scene-fb"))==null||t.classList.add("on")}},ke=e=>{const t=Math.min(.05,(e-H)/1e3);H=e,h.ocean&&(S+=t),h.sky&&(U+=t);const i=U;if(d.clearRect(0,0,u,p),w.clearRect(0,0,u,p),Re(i),Te(),h.sky){Ee(i);for(const o of v)o.age+=t,o.x+=o.vx*t,o.y+=o.vy*t;for(const o of v)if(o.lands&&o.age>=o.life){const a=Ce(o.x,o.ly,S);a&&(A.push({x:a.x,z:a.z,t:S,s:.9}),A.length>4&&A.shift()),I.push({x:o.x,y:o.ly,age:0})}for(let o=v.length-1;o>=0;o--)v[o].age>=v[o].life&&v.splice(o,1);d.globalCompositeOperation="lighter",d.save(),d.beginPath(),d.rect(0,0,u,p*.6),d.clip();for(const o of v)o.lands||de(d,o);d.restore(),w.globalCompositeOperation="lighter";for(const o of v)o.lands&&de(w,o);for(let o=I.length-1;o>=0;o--){const a=I[o];if(a.age+=t,a.age>.6){I.splice(o,1);continue}const s=1-a.age/.6,r=26+40*(a.y/p),g=w.createRadialGradient(a.x,a.y,0,a.x,a.y,r);g.addColorStop(0,`rgba(240,246,255,${.9*s})`),g.addColorStop(1,"rgba(200,220,255,0)"),w.fillStyle=g,w.beginPath(),w.ellipse(a.x,a.y,r,r*.45,0,0,7),w.fill()}d.globalCompositeOperation=w.globalCompositeOperation="source-over"}n&&k&&(B.fill(0),A.forEach((o,a)=>B.set([o.x,o.z,o.t,S-o.t<14?o.s:0],a*4)),n.uniform3fv(J,Se()),n.uniform2f(K,l.width,l.height),n.uniform1f(Q,S),n.uniform1f(j,U),n.uniform4fv(ee,B),n.drawArrays(n.TRIANGLES,0,3)),C=!0,E=!q&&(h.ocean||h.sky)?requestAnimationFrame(X):0};function P(){q||(!E||!C)&&(cancelAnimationFrame(E),H=performance.now(),E=requestAnimationFrame(X))}E=requestAnimationFrame(X);const Le=()=>{C=!1,P()};window.addEventListener("resize",Le);const ze=()=>{cancelAnimationFrame(E),E=0,document.hidden||P()};document.addEventListener("visibilitychange",ze);const Ae=e=>{var t;e.preventDefault(),k=!1,l.style.display="none",(t=M("scene-fb"))==null||t.classList.add("on")};l.addEventListener("webglcontextlost",Ae)}ve(),xe()})();
