/* Bought. Daily — core: helpers, IST clock, day/night theme, router, app shell, motion, toasts, overlays */

const $=id=>document.getElementById(id);
const $$=(sel,root=document)=>[...root.querySelectorAll(sel)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const store={get(k,d){try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch{return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch{}}};
const fmt=x=>Math.floor(x/60)+":"+String(Math.floor(x%60)).padStart(2,"0");
const usd=n=>"$"+Math.round(n).toLocaleString("en-US");
/* ads are bid in points: 100 free for every new advertiser, more at $1 each */
const pts=n=>{const r=Math.round(n);return r.toLocaleString("en-US")+(Math.abs(r)===1?" point":" points")};
const ptsShort=n=>Math.round(n).toLocaleString("en-US")+" pts";   /* for the narrow slots: classified prices, the wallet chip */
const num=n=>Math.round(n).toLocaleString("en-US");
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const rnd=a=>a[Math.floor(Math.random()*a.length)];
function seeded(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function hashStr(s){let h=2166136261;for(const c of s){h^=c.charCodeAt(0);h=Math.imul(h,16777619)}return h>>>0}

/* ---------- clock: all auction times are IST; CLOCK_OFFSET lets the prototype fast-forward ---------- */
const IST_MS=5.5*3600e3, SOFT_MS=5*60e3, HARD_MS=5*60e3;
let CLOCK_OFFSET=0;
const now=()=>Date.now()+CLOCK_OFFSET;
const istISO=(t=now())=>new Date(t+IST_MS).toISOString().slice(0,10);
const addDays=(iso,n)=>{const d=new Date(iso+"T00:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const wdOf=iso=>new Date(iso+"T00:00:00Z").getUTCDay();
/* an issue goes live at 06:00 UTC (11:30 IST); bidding closes at 11:15 IST that morning, 11:20 at the latest */
const closeAt=iso=>Date.parse(iso+"T05:45:00Z");
const dayShort=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"short",day:"numeric",month:"short",timeZone:"UTC"});
const dayLong=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric",timeZone:"UTC"});
const dayNum=iso=>new Date(iso+"T00:00:00Z").toLocaleDateString("en-GB",{day:"numeric",month:"short",timeZone:"UTC"});
const timeIST=t=>new Date(t+IST_MS).toISOString().slice(11,16);
const issueNo=iso=>287+Math.round((Date.parse(iso)-Date.parse("2026-10-25"))/864e5);
const hms=ms=>{ms=Math.max(0,ms);const s=Math.floor(ms/1e3);return[Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(x=>String(x).padStart(2,"0")).join(":")};
const ago=t=>{const m=Math.round((now()-t)/6e4);return m<1?"just now":m<60?m+" min ago":Math.round(m/60)+" h ago"};
const TODAY=istISO(Date.now());
let EDITION=THEMES[wdOf(TODAY)];

/* ---------- day / night ---------- */
const Theme={
 cur(){return document.documentElement.dataset.theme||(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light")},
 toggle(){Theme.set(Theme.cur()==="dark"?"light":"dark")},
 set(t){document.documentElement.dataset.theme=t;store.set("bought-theme",t);Theme.paint()},
 paint(){
  const t=Theme.cur(), b=$("themebtn"), lab=t==="dark"?"Switch to day":"Switch to night";
  if(b){b.dataset.t=t;b.setAttribute("aria-label",lab);b.title=lab}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.content=t==="dark"?"#232427":"#f3eee4";
 },
 edition(i){EDITION=THEMES[i];document.documentElement.style.setProperty("--theme",EDITION.hue)}
};
(()=>{const s=store.get("bought-theme",null);if(s==="light"||s==="dark")document.documentElement.dataset.theme=s})();
Theme.edition(wdOf(TODAY));
matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change",()=>Theme.paint());

/* ---------- body lock while an overlay is open ---------- */
const Lock={sync(){document.body.classList.toggle("lock",!$("reader").hidden||!$("sheetwrap").hidden||!$("ov").hidden)}};

/* ---------- router: Today · Listen · Advertise · For developers ---------- */
const VIEWS=["paper","radio","advertise","spec"];
let VIEW="paper";
const VIEW_HOOKS={};
let BOOTED=false;
function go(v,opt={}){
 if(!VIEWS.includes(v))v="paper";
 const changed=v!==VIEW;goNow(v,opt);if(BOOTED&&changed)Fade.in($("v-"+v));
}
function goNow(v,opt={}){
 const prev=VIEW;VIEW=v;document.body.dataset.view=v;
 VIEWS.forEach(k=>{$("v-"+k).hidden=k!==v});
 $$("[data-go]").forEach(b=>{if(b.dataset.go===v)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
 if(prev!==v){VIEW_HOOKS[prev]?.leave?.();if(!opt.keepScroll)scrollTo({top:0,behavior:"instant"})}
 VIEW_HOOKS[v]?.enter?.(opt);
 if(v!=="spec")store.set("bought-view",v);
 Shell.update();Shell.onScroll();Toasts.place();
 requestAnimationFrame(()=>Motion.scan($("v-"+v)));
}

/* ---------- app shell: sticky bar, brand reveal, reading progress ---------- */
const Shell={
 mastVisible:true,
 init(){
  addEventListener("scroll",Shell.onScroll,{passive:true});
  const mw=$("mastword");
  if(mw&&"IntersectionObserver" in window)new IntersectionObserver(([e])=>{Shell.mastVisible=e.isIntersecting;Shell.update()},{rootMargin:"-56px 0px 0px 0px"}).observe(mw);
  Shell.onScroll();
 },
 onScroll(){
  const y=scrollY;$("appbar").classList.toggle("scrolled",y>4);
  const h=document.documentElement.scrollHeight-innerHeight;
  $("readline").style.width=VIEW==="paper"&&h>0?(y/h*100)+"%":"0";
 },
 update(){$("appbar").classList.toggle("show-brand",VIEW!=="paper"||(typeof Pager!=="undefined"&&Pager.i>0)||!Shell.mastVisible)}
};

/* ---------- motion: content settles in as it scrolls into view (starts visible, never hidden) ---------- */
const Motion={
 io:null,
 init(){
  if(reduce||!("IntersectionObserver" in window))return;
  Motion.io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");e.target.classList.remove("pre");Motion.io.unobserve(e.target)}}),{rootMargin:"0px 0px -4% 0px"});
 },
 scan(root=document){
  if(!Motion.io||!root)return;
  const vh=innerHeight;
  $$(".rv:not(.in):not(.pre)",root).forEach(el=>{
   const r=el.getBoundingClientRect();if(!r.height&&!r.width)return; /* on a page not yet turned to */
   if(r.height&&r.top>vh*0.94){el.classList.add("pre");Motion.io.observe(el)}else el.classList.add("in");
  });
 }
};

/* ---------- toasts ---------- */
const Toasts={
 place(){
  const T=$("toasts").style, mobile=innerWidth<=760;
  T.top="auto";
  let b=16;if(mobile)b+=64;if(!$("mini").hidden)b+=60;
  T.bottom=`calc(${b}px + env(safe-area-inset-bottom,0px))`;
 }
};
function toast(msg,action,ms=7000){
 if(!$("sheetwrap").hidden){ /* while a sheet is open, notices appear inside it so nothing covers its controls */
  const n=document.createElement("div");n.className="sheet-live";n.setAttribute("role","status");
  n.innerHTML=`<span>${esc(msg)}</span>${action?`<button type="button" class="chip-btn">${esc(action.label)}</button>`:""}`;
  if(action)n.querySelector("button").onclick=()=>{n.remove();action.run()};
  $$(".sheet-live",$("sheet")).forEach(x=>x.remove());
  const top=$("sheet").querySelector(".sh-top");top?top.after(n):$("sheet").prepend(n);
  setTimeout(()=>n.remove(),ms+3000);return;
 }
 const el=document.createElement("div");el.className="tst";el.setAttribute("role","status");
 el.innerHTML=`<span>${esc(msg)}</span>${action?`<button type="button" class="ta">${esc(action.label)}</button>`:""}<button type="button" class="tx" aria-label="Dismiss">×</button>`;
 const kill=()=>{el.classList.add("out");setTimeout(()=>el.remove(),250)};
 el.querySelector(".tx").onclick=kill;if(action)el.querySelector(".ta").onclick=()=>{kill();action.run()};
 Toasts.place();$("toasts").prepend(el);
 while($("toasts").children.length>2)$("toasts").lastElementChild.remove();
 setTimeout(kill,ms);
}

/* ---------- soft transitions: content fades in; no page turns anywhere ---------- */
const Fade={in(el){if(reduce||!el)return;el.classList.remove("fadein");void el.offsetWidth;el.classList.add("fadein");el.addEventListener("animationend",()=>el.classList.remove("fadein"),{once:true})}};

/* ---------- bottom sheet ---------- */
const Sheet={
 onClose:null,lastFocus:null,
 open(html,{label,onClose}={}){
  if($("sheetwrap").hidden)Sheet.lastFocus=document.activeElement;
  $("sheet").innerHTML=html;$("sheet").setAttribute("aria-label",label||"Dialog");
  Sheet.onClose=onClose||null;$("sheetwrap").hidden=false;Lock.sync();Toasts.place();
  requestAnimationFrame(()=>{const f=$("sheet").querySelector("[autofocus],input:not([type=hidden]):not(.vh),button.btn");f&&f.focus({preventScroll:true})});
 },
 set(html){$("sheet").innerHTML=html;$("sheet").scrollTop=0},
 close(){
  if($("sheetwrap").hidden)return;
  $("sheetwrap").hidden=true;$("sheet").innerHTML="";Lock.sync();Toasts.place();
  stopAds();const f=Sheet.onClose;Sheet.onClose=null;f&&f();
  if(Sheet.lastFocus&&document.contains(Sheet.lastFocus))Sheet.lastFocus.focus({preventScroll:true});
 }
};
