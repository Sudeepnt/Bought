/* Bought. Daily — media: story video (files the funnel rendered; headline and credit are in the picture), broadcast ads (person on camera + generated thumbnail), creative marks, overlay player. */

const catColor=c=>`var(${CAT[c].v})`;

/* ---------- story video ---------- */
const VS=new Map();const vs=k=>{if(!VS.has(k))VS.set(k,{t:0,playing:false,user:false,muted:false});return VS.get(k)};
/* the caption for this moment: the spoken script, timed by how much of it has been read (the voice has a short breath at each end) */
function capAt(s,t){
 const n=s.cc.length;if(!n)return "";
 const total=s.cc.reduce((a,c)=>a+c.length,0), at=Math.max(0,Math.min(.999,(t-.5)/Math.max(1,s.len-1.2)))*total;
 let a=0;for(const c of s.cc){a+=c.length;if(at<a)return c}
 return s.cc[n-1];
}
function vidHTML(key,s,m){
 const st=vs(key), auto=m==="auto";
 const pic=m==="thumb"?`<img class="vp" src="${esc(s.poster)}" alt="" loading="lazy">`:`<video class="vp" src="${esc(s.video)}" poster="${esc(s.poster)}" playsinline preload="none"${auto?" muted loop":""}></video>`;
 return `<div class="vid${st.playing?" playing":""}${m==="thumb"?" thumb":""}${m==="vert"?" vert":""}" data-key="${key}" data-id="${s.id}" data-mode="${m}" style="--c:${catColor(s.cat)}" role="button" tabindex="0" aria-label="Video: ${esc(s.t)}">
  ${pic}
  <span class="tag"><i></i>${m==="thumb"?"Video":esc(s.kick)}</span>
  <span class="tc">${m==="thumb"?fmt(s.len):fmt(st.t)+" / "+fmt(s.len)}</span>
  <div class="cc"><span>${esc(capAt(s,st.t))}</span></div>
  <span class="big"><i></i></span>
  <div class="ctl"><span class="pp">${st.playing?"❚❚":"▶"}</span><span class="bar"><i style="width:${st.t/(s.len||1)*100}%"></i></span><span class="mut">${auto?"Muted preview":"Sound on"}</span></div></div>`;
}
/* a story with a picture and no video: same frame, no player */
function picHTML(s,full){
 return `<div class="vid still${full?"":" thumb"}" data-id="${s.id}" style="--c:${catColor(s.cat)}"><img class="vp" src="${esc(s.picture)}" alt="" loading="lazy">${s.credit?`<span class="pcred">Photo: ${esc(s.credit)}</span>`:""}</div>`;
}
function updVid(el){
 const s=S[+el.dataset.id], st=vs(el.dataset.key);
 el.classList.toggle("playing",st.playing);
 if(el.dataset.mode==="thumb")return;
 const v=el.querySelector("video");if(!v)return;
 const auto=el.dataset.mode==="auto";
 if(st.playing&&v.paused){
  v.muted=auto||st.muted;
  if(Math.abs(v.currentTime-st.t)>1){try{v.currentTime=st.t}catch{}}
  const p=v.play();
  /* a browser may refuse sound without a tap: play silently and offer the sound */
  if(p)p.catch(err=>{if(err.name!=="NotAllowedError")return;if(!v.muted){v.muted=st.muted=true;v.play().catch(()=>{st.playing=false;updVid(el)});updVid(el)}else{st.playing=false;updVid(el)}});
 }else if(!st.playing&&!v.paused)v.pause();
 el.querySelector(".tc").textContent=fmt(st.t)+" / "+fmt(s.len);
 el.querySelector(".bar i").style.width=(st.t/(s.len||1)*100)+"%";
 const cap=capAt(s,st.t), sp=el.querySelector(".cc span");if(sp&&sp.textContent!==cap)sp.textContent=cap;
 el.querySelector(".pp").textContent=st.playing?"❚❚":"▶";
 el.querySelector(".mut").textContent=auto?"Muted preview":v.muted?"Sound off":"Sound on";
}
setInterval(()=>{$$(".vid.playing").forEach(el=>{
 const v=el.querySelector("video");if(!v)return;
 const s=S[+el.dataset.id], st=vs(el.dataset.key);st.t=v.currentTime;
 if(v.ended){st.t=s.len;st.playing=false}
 updVid(el)})},250);
/* a tap on a video in the paper plays it right there with sound, from the start. A frame too small to watch in opens the overlay player. */
function playInPlace(el){
 const id=+el.dataset.id, s=S[id];
 const small=el.offsetWidth<240||el.offsetWidth/el.offsetHeight<1.5;
 Radio.pause();stopAds();
 $$('#v-paper .vid.playing[data-mode="full"]').forEach(o=>{if(o!==el){vs(o.dataset.key).playing=false;updVid(o)}});
 Paper.markRead(id);
 if(small){const key="ov-"+id,st=vs(key);st.t=0;st.playing=true;st.user=true;st.muted=false;Ov.open(vidHTML(key,s,"full"),false);return}
 const key=String(el.dataset.key), st=vs(key);
 st.t=0;st.playing=true;st.user=true;st.muted=false;
 const wrap=document.createElement("div");wrap.innerHTML=vidHTML(key,s,"full");
 const fresh=wrap.firstElementChild;if(Vids.io)Vids.io.unobserve(el);el.replaceWith(fresh);
 const v=fresh.querySelector("video");v.currentTime=0;
 updVid(fresh);
 if(Vids.io)Vids.io.observe(fresh);
}
const Vids={
 io:"IntersectionObserver" in window?new IntersectionObserver(es=>es.forEach(e=>{
  const el=e.target, st=vs(el.dataset.key);
  /* a video the reader started: it stops when scrolled away and waits for them to resume it */
  if(el.dataset.mode!=="auto"){if(st.playing&&e.intersectionRatio<.5){st.playing=false;updVid(el)}return}
  const on=e.isIntersecting&&e.intersectionRatio>=.5&&VIEW==="paper"&&READER_ID===null&&$("ov").hidden&&!reduce&&!document.hidden;
  if(st.playing!==on){st.playing=on;updVid(el)}
 }),{threshold:[0,.5]}):null,
 observe(root=document){if(Vids.io)$$('.vid[data-mode="auto"]',root).forEach(v=>Vids.io.observe(v))},
 stop(root=$("v-paper")){$$(".vid.playing",root).forEach(el=>{vs(el.dataset.key).playing=false;updVid(el)})},
 wake(){if(!Vids.io)return;$$('#v-paper .vid[data-mode="auto"]').forEach(v=>{Vids.io.unobserve(v);Vids.io.observe(v)})}
};

/* ---------- broadcast ads: a person on camera with a generated text thumbnail ---------- */
const AP=new Map();const ap=k=>{if(!AP.has(k))AP.set(k,{t:0,playing:false});return AP.get(k)};
const BVREG={};
function markText(cre){
 const t=esc(cre.thumb||cre.adv||""), w=t.split(" "), n=w.length>3?2:1;
 return w.length<2?`<mark>${t}</mark>`:w.slice(0,-n).join(" ")+` <mark>${w.slice(-n).join(" ")}</mark>`;
}

/* illustrated presenter (mock) — replaced by the advertiser's own video in production */
function shade(h,a){const n=parseInt(h.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=a<0?0:255,t=Math.abs(a);r=Math.round((f-r)*t+r);g=Math.round((f-g)*t+g);b=Math.round((f-b)*t+b);return `rgb(${r},${g},${b})`}
let SVGN=0;
function personSVG(p,shape){
  const i="ps"+(++SVGN), cx=shape==="vert"||shape==="av"?80:106, vb=shape==="av"?"63 25 34 34":"0 0 160 90";
  const sk=p.skin, hr=p.hair, sh=p.shirt, bg=p.bg;
  const books=[["#8a5a44",5],["#4d6a7a",4],["#c9a66b",6],["#5b4b6e",4],["#7a8a5a",5]];
  let bx=cx-94, bk="";books.forEach(([c,w],j)=>{bk+=`<rect x="${bx}" y="${j%2?17:16}" width="${w}" height="${j%2?13:14}" fill="${c}"/>`;bk+=`<rect x="${bx+1}" y="${j%2?37:36}" width="${w-1}" height="${j%2?13:14}" fill="${books[(j+2)%5][0]}"/>`;bx+=w+1});
  const face=`M${cx-12} 40 C${cx-12} 26 ${cx+12} 26 ${cx+12} 40 C${cx+12} 50 ${cx+7} 57.5 ${cx} 58 C${cx-7} 57.5 ${cx-12} 50 ${cx-12} 40Z`;
  const hairTop={
    short:`M${cx-12.6} 41 C${cx-14} 27 ${cx-6} 23.4 ${cx} 23.7 C${cx+8} 23.5 ${cx+14} 28 ${cx+12.6} 41 C${cx+11.6} 35 ${cx+9} 31.4 ${cx+3} 31 C${cx-3} 31.3 ${cx-9} 33 ${cx-12.6} 41Z`,
    long:`M${cx-13} 45 C${cx-15} 27 ${cx-5} 22.8 ${cx+1} 23.3 C${cx+10} 23.8 ${cx+15} 30 ${cx+13} 45 C${cx+12} 36 ${cx+8} 31 ${cx+1.5} 30.4 C${cx-5} 32 ${cx-10} 36 ${cx-13} 45Z`,
    bun:`M${cx-12.4} 40 C${cx-13.5} 28 ${cx-6} 24.2 ${cx} 24.4 C${cx+6} 24.2 ${cx+13.5} 28 ${cx+12.4} 40 C${cx+11} 33 ${cx+6} 30.2 ${cx} 30.2 C${cx-6} 30.2 ${cx-11} 33 ${cx-12.4} 40Z`
  }[p.style];
  const back=p.style==="long"?`<path d="M${cx-14} 38 C${cx-17} 22 ${cx+17} 22 ${cx+14} 38 L${cx+15.5} 63 C${cx+10} 67 ${cx-10} 67 ${cx-15.5} 63Z" fill="url(#${i}hr)"/>`:"";
  const bun=p.style==="bun"?`<circle cx="${cx}" cy="22" r="6.2" fill="url(#${i}hr)"/>`:"";
  const eye=(x)=>`<ellipse cx="${x}" cy="41.6" rx="2.1" ry="1.15" fill="#f3eee8"/><circle cx="${x}" cy="41.7" r=".95" fill="#2b1d16"/><circle cx="${x+.35}" cy="41.35" r=".3" fill="#fff"/><path d="M${x-2.2} 41.3 Q${x} 40 ${x+2.2} 41.3" stroke="${shade(sk,-.5)}" stroke-width=".55" fill="none"/>`;
  const beard=p.beard?`<path d="M${cx-11.5} 46 C${cx-10} 55 ${cx-6} 58.6 ${cx} 58.8 C${cx+6} 58.6 ${cx+10} 55 ${cx+11.5} 46 C${cx+9} 52 ${cx+5} 53.5 ${cx} 53.6 C${cx-5} 53.5 ${cx-9} 52 ${cx-11.5} 46Z" fill="${hr}" opacity=".42" filter="url(#${i}sf)"/>`:"";
  const glasses=p.glasses?`<g fill="none" stroke="#1d1a18" stroke-width=".7"><rect x="${cx-8.4}" y="39.4" width="6.6" height="4.6" rx="1.8"/><rect x="${cx+1.8}" y="39.4" width="6.6" height="4.6" rx="1.8"/><path d="M${cx-1.8} 41 Q${cx} 40.2 ${cx+1.8} 41"/></g>`:"";
  return `<svg class="ps" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
   <linearGradient id="${i}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(bg,.18)}"/><stop offset="1" stop-color="${shade(bg,-.22)}"/></linearGradient>
   <radialGradient id="${i}sk" cx=".4" cy=".36" r=".78"><stop offset="0" stop-color="${shade(sk,.2)}"/><stop offset=".58" stop-color="${sk}"/><stop offset="1" stop-color="${shade(sk,-.3)}"/></radialGradient>
   <linearGradient id="${i}sh" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${shade(sh,.16)}"/><stop offset="1" stop-color="${shade(sh,-.4)}"/></linearGradient>
   <linearGradient id="${i}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(hr,.28)}"/><stop offset="1" stop-color="${hr}"/></linearGradient>
   <radialGradient id="${i}vg" cx=".55" cy=".45" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>
   <radialGradient id="${i}kl" cx=".2" cy=".1" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
   <filter id="${i}bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.3"/></filter>
   <filter id="${i}sf"><feGaussianBlur stdDeviation=".4"/></filter></defs>
   <rect x="-40" y="-10" width="240" height="110" fill="url(#${i}bg)"/>
   <g filter="url(#${i}bl)">
    <rect x="${cx-97}" y="10" width="40" height="66" fill="${shade(bg,-.32)}"/><rect x="${cx-97}" y="31" width="40" height="2" fill="${shade(bg,-.5)}"/><rect x="${cx-97}" y="51" width="40" height="2" fill="${shade(bg,-.5)}"/>${bk}
    <rect x="${cx-52}" y="60" width="9" height="12" fill="#a0744f"/><ellipse cx="${cx-47.5}" cy="54" rx="9" ry="11" fill="#5e7c55"/><ellipse cx="${cx-52}" cy="50" rx="5" ry="7" fill="#6f8f62"/>
    <rect x="${cx+30}" y="3" width="46" height="48" fill="#fff" opacity=".6"/><rect x="${cx+52}" y="3" width="1.6" height="48" fill="${shade(bg,-.2)}"/>
    <circle cx="${cx+48}" cy="64" r="7" fill="#ffd9a0" opacity=".85"/><circle cx="${cx-22}" cy="14" r="3" fill="#fff" opacity=".35"/><circle cx="${cx+24}" cy="70" r="4" fill="#fff" opacity=".22"/>
   </g>
   <ellipse cx="${cx+5}" cy="72" rx="36" ry="30" fill="#000" opacity=".14" filter="url(#${i}bl)"/>
   <g class="hd">
    <path d="M${cx-37} 92 C${cx-35} 72 ${cx-21} 66 ${cx} 65 C${cx+21} 66 ${cx+35} 72 ${cx+37} 92Z" fill="url(#${i}sh)"/>
    <path d="M${cx-20} 70 C${cx-22} 78 ${cx-23} 85 ${cx-22} 92 M${cx+20} 70 C${cx+22} 78 ${cx+23} 85 ${cx+22} 92" stroke="${shade(sh,-.3)}" stroke-width=".7" fill="none" opacity=".6"/>
    ${back}
    <path d="M${cx-5.6} 51 L${cx-6.2} 66 C${cx-3} 69.5 ${cx+3} 69.5 ${cx+6.2} 66 L${cx+5.6} 51Z" fill="url(#${i}sk)"/>
    <ellipse cx="${cx}" cy="57.5" rx="6.4" ry="3.2" fill="${shade(sk,-.4)}" opacity=".45" filter="url(#${i}sf)"/>
    <path d="M${cx-9.5} 66 L${cx} 75.5 L${cx+9.5} 66 C${cx+5} 64.8 ${cx-5} 64.8 ${cx-9.5} 66Z" fill="${shade(sh,-.5)}"/>
    <ellipse cx="${cx-12.2}" cy="43.5" rx="2" ry="3.4" fill="${shade(sk,-.1)}"/><ellipse cx="${cx+12.2}" cy="43.5" rx="2" ry="3.4" fill="${shade(sk,-.18)}"/>
    ${bun}
    <path d="${face}" fill="url(#${i}sk)"/>
    <ellipse cx="${cx-6.6}" cy="48" rx="2.7" ry="1.5" fill="#d0645a" opacity=".13"/><ellipse cx="${cx+6.6}" cy="48" rx="2.7" ry="1.5" fill="#d0645a" opacity=".13"/>
    <path d="M${cx-8} 37.6 Q${cx-5} 36.1 ${cx-2.2} 37.3 M${cx+2.2} 37.3 Q${cx+5} 36.1 ${cx+8} 37.6" stroke="${shade(hr,.06)}" stroke-width="1.1" stroke-linecap="round" fill="none"/>
    ${eye(cx-4.8)}${eye(cx+4.8)}
    <path d="M${cx-.3} 42 Q${cx-1.7} 47.4 ${cx-1.9} 47.9 Q${cx} 49.3 ${cx+1.9} 47.9" stroke="${shade(sk,-.38)}" stroke-width=".6" fill="none" opacity=".75"/>
    <g class="mouth"><path d="M${cx-3.7} 52 Q${cx-1.5} 50.9 ${cx} 51.5 Q${cx+1.5} 50.9 ${cx+3.7} 52 Q${cx} 52.9 ${cx-3.7} 52Z" fill="${shade(sk,-.42)}"/><path d="M${cx-3.4} 52.1 Q${cx} 54.6 ${cx+3.4} 52.1 Q${cx} 52.9 ${cx-3.4} 52.1Z" fill="${shade(sk,-.26)}"/></g>
    ${beard}
    <path d="${hairTop}" fill="url(#${i}hr)"/>
    <path d="M${cx-7} 27.5 Q${cx-1} 25.5 ${cx+6} 27.5" stroke="${shade(hr,.5)}" stroke-width=".55" fill="none" opacity=".4"/>
    ${glasses}
    <circle cx="${cx+9.5}" cy="74" r="1.3" fill="#1b1b1b"/>
   </g>
   <rect x="-40" y="-10" width="240" height="110" fill="url(#${i}kl)"/><rect x="-40" y="-10" width="240" height="110" fill="url(#${i}vg)"/>
  </svg>`;
}

function bvHTML(key,cre,shape){
 BVREG[key]=cre;const st=ap(key), p=PEOPLE[cre.p||"me"], still=!!cre.img&&!cre.file;
 const media=cre.file?`<video class="uv" src="${cre.file}" muted playsinline preload="metadata"></video>`:cre.mux?`<video class="uv"${cre.poster?` poster="${esc(cre.poster)}"`:""} muted playsinline preload="none"></video>`:cre.img?`<img class="uv" src="${cre.img}" alt="${esc(cre.line||cre.adv||"Ad image")}">`:personSVG(p,shape);
 return `<div class="bv ${shape}${st.playing?" playing":""}${still?" still":""}" data-bv="${key}" role="${still?"img":"button"}" ${still?"":'tabindex="0"'} aria-label="${still?"Image ad":"Play ad"} from ${esc(cre.adv||"advertiser")}">
  ${media}<span class="bv-tag">${still?"Ad":`Ad · ${fmt(cre.len||30)}`}</span>
  <div class="tt"><b>${markText(cre)}</b>${cre.who?`<small>${esc(cre.who)}</small>`:""}</div>
  <div class="bv-cc"><span>${esc((cre.script&&cre.script[0])||cre.thumb||"")}</span></div>
  <span class="bv-play"><i></i></span><div class="bv-bar"><i></i></div></div>`;
}
function initials(name){return (name||"").split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("")||"Aa"}
function creMark(cre){const m=cre.mark||{bg:"#1f3b5c",fg:"#f4efe4"};return `<div class="cre-mark" style="--mb:${m.bg};--mf:${m.fg}" aria-hidden="true"><span>${esc(m.init||initials(cre.adv))}</span></div>`}
function setPlaying(el,on){
 const cre=BVREG[el.dataset.bv];if(cre&&cre.img&&!cre.file)return; /* image ads don't play */
 const st=ap(el.dataset.bv);st.playing=on;el.classList.toggle("playing",on);
 const v=el.querySelector("video");if(v){
  /* uploaded video plays only its 60-second window: trimStart → trimStart + len */
  const s0=cre?.trimStart||0, s1=s0+Math.min(60,cre?.len||60);
  /* a real ad streams from Mux: fetch its signed link the first time it plays */
  if(on&&cre?.mux&&!cre.file&&!v.dataset.ready){v.dataset.ready="1";Live.count(el.closest("[data-spot]")?.dataset.spot,"play");
   Live.attach(v,cre.mux).then(()=>{if(st.playing)setPlaying(el,true)}).catch(()=>{v.dataset.ready="";setPlaying(el,false);toast("This video couldn't be played.")});return}
  if(on){if(v.currentTime<s0||v.currentTime>=s1)v.currentTime=s0;v.ontimeupdate=()=>{if(v.currentTime>=s1){v.pause();v.currentTime=s0;st.t=0;setPlaying(el,false)}};
   v.muted=false;v.play().catch(()=>{v.muted=true;v.play().catch(()=>{})})}else v.pause()}
}
function stopAds(except){$$(".bv.playing").forEach(el=>{if(el!==except)setPlaying(el,false)})}
function toggleAd(el){const on=!ap(el.dataset.bv).playing;if(on){stopAds(el);Vids.stop()}setPlaying(el,on)}
setInterval(()=>{$$(".bv.playing").forEach(el=>{
 const st=ap(el.dataset.bv), cre=BVREG[el.dataset.bv];if(!cre)return;
 const len=cre.len||30, sc=(cre.script&&cre.script.length)?cre.script:[cre.thumb||""];
 st.t+=.25;if(st.t>=len){st.t=0;setPlaying(el,false)}
 const line=sc[Math.min(sc.length-1,Math.floor(st.t/(len/sc.length)))], sp=el.querySelector(".bv-cc span");
 if(sp.textContent!==line)sp.textContent=line;
 el.querySelector(".bv-bar i").style.width=(st.t/len*100)+"%";
 el.querySelector(".bv-tag").textContent="Ad · "+fmt(len-st.t);
})},250);

/* ---------- overlay player (sponsor ads, clip break, 60-second clips) ---------- */
const Ov={
 open(html,vert){
  Vids.stop();stopAds();
  $("ovbox").className="vbox"+(vert?" vert":" wide");$("ovbox").innerHTML=html;$("ov").hidden=false;Lock.sync();
  const b=$("ovbox").querySelector(".bv");if(b)setPlaying(b,true);
  $$(".vid",$("ovbox")).forEach(updVid);
  $("ovx").focus({preventScroll:true});
 },
 close(){
  if($("ov").hidden)return;
  $$(".vid",$("ovbox")).forEach(v=>vs(v.dataset.key).playing=false);stopAds();
  $("ov").hidden=true;$("ovbox").innerHTML="";Lock.sync();Vids.wake();
 }
};


/* ---------- advertiser links on every display ad: website, social profile, email ---------- */
const normUrl=u=>{u=(u||"").trim();return !u?"":/^https?:\/\//i.test(u)?u:"https://"+u};
const hostOf=u=>normUrl(u).replace(/^https?:\/\//i,"").replace(/^www\./i,"").split(/[/?#]/)[0];
function socialName(u){const h=hostOf(u).toLowerCase();return /linkedin\./.test(h)?"LinkedIn":/(^|\.)(x|twitter)\.com$/.test(h)?"X":/instagram\./.test(h)?"Instagram":/youtube\.|youtu\.be/.test(h)?"YouTube":/facebook\./.test(h)?"Facebook":/threads\./.test(h)?"Threads":"Social"}
const IC_WEB=`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M1.8 8h12.4M8 1.8c2 2.2 2 10.2 0 12.4M8 1.8c-2 2.2-2 10.2 0 12.4" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
const IC_SOC=`<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="3.8" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="12" cy="12.2" r="2" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M5.8 7.1l4.4-2.3M5.8 8.9l4.4 2.3" stroke="currentColor" stroke-width="1.2"/></svg>`;
const IC_MAIL=`<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.8" y="3.5" width="12.4" height="9" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M2.3 4.3 8 8.8l5.7-4.5" fill="none" stroke="currentColor" stroke-width="1.2"/></svg>`;
function adLinks(cre,cls=""){
 const L=[], who=esc(cre.adv||"the advertiser");
 if(cre.web)L.push(`<a class="al" href="${esc(normUrl(cre.web))}" target="_blank" rel="noopener sponsored" aria-label="Website of ${who}">${IC_WEB}<span>${esc(hostOf(cre.web))}</span></a>`);
 if(cre.social)L.push(`<a class="al" href="${esc(normUrl(cre.social))}" target="_blank" rel="noopener sponsored" aria-label="${socialName(cre.social)} profile of ${who}">${IC_SOC}<span>${socialName(cre.social)}</span></a>`);
 if(cre.email)L.push(`<a class="al" href="mailto:${esc(cre.email)}" aria-label="Email ${who}">${IC_MAIL}<span>Email</span></a>`);
 return L.length?`<span class="sp-links ${cls}">${L.join("")}</span>`:"";
}
