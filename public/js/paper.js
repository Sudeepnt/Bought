/* Bought. Daily — the newspaper (Today view): masthead, stories, engagement, ad slots, classifieds, reader */

const P={read:new Set(),filter:"all",votes:{},rx:{}}; /* filled per issue by Data.load */
let READER_ID=null;
/* the issue on screen: the latest published one, or one from the archive */
let ISSUE_DAY=TODAY;
/* When an advertiser wins a spot, their ad previews in this issue's slot: spot → {cre, amt, date} */
const PREVIEW={};
/* the ads that really won the issue on screen (js/live.js fills these when the backend is connected) */
const ISSUE_ADS={}, ISSUE_CLS=[];

/* ---------- small parts ---------- */
function fmtBadge(s){return !s.video?`<span class="fmtb">Text · ${s.min} min</span>`:s.media==="reveal"?`<span class="fmtb"><i></i>Video inside · ${s.min} min</span>`:`<span class="fmtb"><i></i>${fmt(s.len)} · ${s.min} min</span>`}
function byline(s){const j=JOUR[s.j];return `<div class="meta"><span class="av" style="--jc:${j.c}">${s.j[0]}</span><span><b>${s.j}</b> · ${esc(s.src[0])}</span>${P.read.has(s.id)?'<span class="readtag">Read</span>':""}<button type="button" class="cmt" data-discuss="${s.id}" data-ccount="${s.id}" aria-label="Comments">${ICON_CM}<b>${cmCount(s.id)}</b></button></div>`}

/* ---------- engagement: polls and reactions ---------- */
function pollHTML(id,anim){
 const Q=POLLS[id], mine=P.votes[id], voted=mine!=null;
 const v=Q.v.map((n,i)=>n+(mine===i?1:0)), tot=v.reduce((a,b)=>a+b,0);
 return `<div class="poll${voted?" voted":""}${anim?" anim":""}" data-poll="${id}">
  <div class="poll-h"><span>${id==="pulse"?"Reader poll":"Quick poll"}</span><span>${num(tot)} votes</span></div>
  <p class="poll-q">${esc(Q.q)}</p>
  <div class="poll-o">${Q.o.map((o,i)=>{const p=Math.round(v[i]/tot*100);return `<button type="button" class="po${mine===i?" mine":""}" data-vote="${id}:${i}"${voted?' aria-disabled="true"':""} style="--w:${p}%"><i></i><span>${esc(o)}</span><b class="pp">${p}%</b></button>`}).join("")}</div>
  <small class="poll-n">${voted?"Thanks for voting. Results update through the day.":"Tap an answer to see how others voted."}</small></div>`;
}
function rxHTML(id){const base=RX[id],mine=P.rx[id];return `<div class="rx" data-rx="${id}" role="group" aria-label="React to this story">${RXSET.map((r,i)=>`<button type="button" data-react="${id}:${i}" aria-pressed="${mine===i}">${r}<b>${num(base[i]+(mine===i?1:0))}</b></button>`).join("")}</div>`}
function engageHTML(id){return POLLS[id]?pollHTML(id):RX[id]?rxHTML(id):""}
function vote(id,i){
 if(P.votes[id]!=null)return;P.votes[id]=i;store.set("bought-votes-"+ISSUE_DAY,P.votes);
 $$(`[data-poll="${id}"]`).forEach(el=>{el.outerHTML=pollHTML(id,true)});
 requestAnimationFrame(()=>requestAnimationFrame(()=>$$(`.poll.anim[data-poll="${id}"]`).forEach(el=>el.classList.remove("anim"))));
}
function react(id,i){
 P.rx[id]=P.rx[id]===i?null:i;store.set("bought-rx-"+ISSUE_DAY,P.rx);
 $$(`[data-rx="${id}"]`).forEach(el=>{el.outerHTML=rxHTML(id)});
 if(P.rx[id]===i)$$(`[data-react="${id}:${i}"]`).forEach(b=>b.classList.add("bump"));
}

/* ---------- story cards ---------- */
function card(s,opt={}){
 const sz=opt.sz||s.sz;let media="";
 if(s.media==="auto")media=vidHTML(s.id,s,"auto");
 else if(s.media==="thumb")media=vidHTML(s.id,s,"thumb");
 else if(s.media==="pic")media=picHTML(s);
 const compact=(s.media==="thumb"||s.media==="pic")&&(sz==="s"||sz==="m"), big=sz==="xl", say=!!(POLLS[s.id]||RX[s.id]);
 const cls=["card","rv","sz-"+sz,media&&big?"pkg":"",compact?"compact":"",s.video?"has-video":"",s.quick?"quick":"",say?"has-say":""].filter(Boolean).join(" ");
 return `<article class="${cls}" data-id="${s.id}" id="card-${s.id}" style="--c:${catColor(s.cat)}">
  ${media?`<div class="media">${media}</div>`:""}
  <div class="txt"><div class="kick">${opt.rank?`<b class="rk">${opt.rank}</b>`:""}<span>${esc(s.kick)}</span>${fmtBadge(s)}</div>
  <h${big?2:3} class="hl"><a href="#paper" data-open="${s.id}">${esc(s.t)}</a></h${big?2:3}>
  ${sz==="s"||!s.dek?"":`<p class="dek">${esc(s.dek)}</p>`}${!media&&!big&&s.gist.length?`<ul class="cgist">${s.gist.slice(0,sz==="s"?2:3).map(g=>`<li>${esc(g)}</li>`).join("")}</ul>${sz!=="s"&&s.why?`<p class="cwhy"><b>Why it matters</b> ${esc(s.why)}</p>`:""}`:""}${byline(s)}${sz==="s"||sz==="top"?"":engageHTML(s.id)}
  ${big?`<button type="button" class="more" data-open="${s.id}">Read the full story <span aria-hidden="true">→</span></button>`:""}</div></article>`;
}

/* ---------- ad slots: same grid as the news, quiet tint, one small "Sponsored" mark ---------- */
const adCre=k=>PREVIEW[k]?.cre||ISSUE_ADS[k]?.cre||TODAY_ADS[k];
function spMeta(k){
 const pv=PREVIEW[k];
 return {label:`<span class="sp-l"><i></i>${pv?"Your ad · preview":"Sponsored"}</span>`,
  price:pv?`<span class="sp-p">You won at ${usd(pv.amt)} · ${dayShort(pv.date)}</span>`:`<span class="sp-p">Won at ${usd(ISSUE_ADS[k]?ISSUE_ADS[k].amt:TODAY_PRICE[k])}</span>`};
}
function spotHTML(k,layout,opt={}){
 const sp=SPOTS[k], cre=adCre(k), m=spMeta(k), pre=opt.preview?"-pv":"";
 const bid=opt.preview?"":`<button type="button" class="sp-bid" data-adv-spot="${k}">Bid for this spot</button>`;
 const shape=layout==="half"?"wide":layout==="clip"?"vert":"std";
 const media=sp.fmt==="video"?bvHTML("ad-"+k+pre,cre,shape):creMark(cre);
 const ovAttr=layout==="banner"&&sp.fmt==="video"?` data-adplay="${k}"`:"";
 if(layout==="banner")return `<aside class="spot banner rv" data-spot="${k}" data-layout="banner"><div class="sp-media"${ovAttr}>${media}</div><div class="sp-txt"><div class="sp-meta">${m.label}<span class="sp-adv">${esc(cre.adv)}</span></div><b class="sp-hl">${esc(cre.line)}</b>${adLinks(cre,"tight")}</div><div class="sp-side">${m.price}${bid}</div></aside>`;
 if(layout==="half")return `<aside class="spot half rv" data-spot="${k}" data-layout="half">${media}<div class="sp-row"><div class="sp-txt"><div class="sp-meta">${m.label}<span class="sp-adv">${esc(cre.adv)}</span></div><b class="sp-hl">${esc(cre.line)}</b>${cre.sub?`<span class="sp-line">${esc(cre.sub)}</span>`:""}${adLinks(cre)}</div><div class="sp-side">${m.price}${bid}</div></div></aside>`;
 return `<aside class="spot native rv f-${sp.fmt}" data-spot="${k}" data-layout="native"><div class="sp-media">${media}</div><div class="sp-txt"><div class="sp-meta">${m.label}</div><span class="sp-adv">${esc(cre.adv)}</span><b class="sp-hl">${esc(cre.line)}</b>${cre.sub?`<span class="sp-line">${esc(cre.sub)}</span>`:""}${adLinks(cre)||(cre.cta?`<span class="sp-cta">${esc(cre.cta)}</span>`:"")}<div class="sp-foot">${m.price}${bid}</div></div></aside>`;
}
function sponsorHTML(k){
 const cre=adCre(k);
 return `<span class="sec-spon" data-spot="${k}" data-layout="sponsor"><span class="sp-l"><i></i>Presented by</span><button type="button" class="spav" data-adplay="${k}" aria-label="Play ad from ${esc(cre.adv)}">${personSVG(PEOPLE[cre.p||"me"],"av")}</button><b>${esc(cre.adv)}</b><button type="button" class="sp-bid" data-adv-spot="${k}">Bid</button></span>`;
}
function clsBlock(n){
 const lines=(ISSUE_CLS.length?ISSUE_CLS:CLS_TODAY).slice(n*4,n*4+4), mine=PREVIEW.cls&&PREVIEW.cls.block===n?PREVIEW.cls:null;
 return `<aside class="cls-block rv" data-spot="cls" data-layout="cls-${n}">
  <div class="cls-h"><h4>Classifieds</h4><span class="sp-l"><i></i>Lines ${n*4+1}–${n*4+4} · ranked by bid</span></div>
  <ol class="cls-list">${mine?`<li class="mine"><b>${usd(mine.amt)}</b><span>${esc(mine.cre.line)} <em>${esc(mine.cre.adv)} · your line, ${dayShort(mine.date)}</em></span></li>`:""}${lines.map(([p,t,w])=>`<li><b>${usd(p)}</b><span>${esc(t)} <em>${esc(w)}</em></span></li>`).join("")}</ol>
  <button type="button" class="sp-bid" data-adv-spot="cls">Place a line in an upcoming issue</button></aside>`;
}
function clipAdHTML(){const cre=adCre("clip");return `<div class="clip-ad" data-spot="clip" data-layout="clip"><button type="button" class="clip-ad-btn" data-adplay="clip" aria-label="Play ad from ${esc(cre.adv)}">${bvHTML("ad-clip",cre,"vert")}</button><span class="sp-l"><i></i>Sponsored</span><button type="button" class="sp-bid" data-adv-spot="clip">Bid for this spot</button></div>`}
function afterHTML(a){if(!a)return "";const inner=a==="half"?spotHTML("half","half"):a.startsWith("cls-")?clsBlock(+a.slice(4)):"";return inner}

/* ---------- render the issue ---------- */
const Paper={
 render(){
  document.body.classList.toggle("no-issue",!S.length);
  $("m-date").innerHTML=`<span class="d-long">${dayLong(ISSUE_DAY)}</span><span class="d-short">${dayShort(ISSUE_DAY)}</span>`;
  $("m-edition").textContent=EDITION.name;
  $("m-issue").textContent="Issue No. "+issueNo(ISSUE_DAY);Issue.nav();$("engine").innerHTML=engineHTML(ISSUE_DAY);
  if(!S.length){$("lead").innerHTML=`<p class="no-issue-note">Today's issue isn't out yet. The next one arrives at ${esc(PUBLISH_LABEL)}.</p>`;return}
  $("top-spot").innerHTML=spotHTML("top","banner");
  const L=S[0];$("lead").style.setProperty("--c",catColor(L.cat));
  $("lead").innerHTML=`${L.video?`<div class="media">${vidHTML(0,L,"auto")}</div>`:L.picture?`<div class="media">${picHTML(L,true)}</div>`:""}<div class="txt" data-id="0"><div class="kick"><span>Lead story · ${esc(L.kick)}</span>${fmtBadge(L)}</div><h2 class="hl${L.t.length>80?" long":""}"><a href="#paper" data-open="0">${esc(L.t)}</a></h2>${L.dek?`<p class="dek">${esc(L.dek)}</p>`:""}${byline(L)}<button type="button" class="cta" data-open="0">Read the full story</button></div><div class="lead-poll">${pollHTML(0)}</div>`;
  $("brief").innerHTML=BRIEF.map(([id,t])=>`<li><button type="button" data-open="${id}">${esc(t)}</button></li>`).join("");
  $("tops").innerHTML=[1,2,3].filter(id=>S[id]&&S[id].sz==="top").map((id,i)=>card(S[id],{sz:"top",rank:i+1})).join("");
  $("pulse").innerHTML=`<div class="pulse-l"><span class="eyebrow">The Pulse</span><p>One question a day. Results update live.</p></div>${pollHTML("pulse")}`;
  $("nums").innerHTML=NUMS.map(([n,l,id])=>`<button type="button" data-open="${id}" style="--c:${catColor(S[id].cat)}"><b>${n}</b><span>${esc(l)}</span></button>`).join("");
  $("front-spot").innerHTML=spotHTML("front","native");
  $("sections").innerHTML=CATS.map((c,ci)=>{
   const L=LAYOUT[c.name], n=ci+1, kicks=[...new Set(L.main.map(id=>S[id].kick))].slice(0,3);
   const head=`<header class="pagehead rv"><span class="pg">${n+1}</span><div class="ph-t"><span class="ph-k">Page ${n+1} of ${PAGES.length}</span><h2>${c.name}</h2><p class="ph-index">${kicks.map(esc).join(" · ")} · ${L.main.length+L.briefs.length} stories</p></div>${c.spon?sponsorHTML(c.spon):""}</header>`;
   const cards=L.main.map(id=>card(S[id]));
   if(c.feed)cards.splice(3,0,spotHTML(c.feed,"native"));
   const briefs=L.briefs.length?`<div class="inbrief rv"><b>In brief</b><ul>${L.briefs.map(id=>`<li data-id="${id}"><a href="#paper" data-open="${id}">${esc(S[id].t)}</a></li>`).join("")}</ul></div>`:"";
   return `<article class="page" data-page="${n}" id="sec-${c.pg}" aria-label="Page ${n+1}, ${c.name}" style="--c:var(${c.v})">${runHead(n)}<section class="sec">${head}<div class="g">${cards.join("")}</div><p class="pg-empty" hidden></p>${briefs}</section>${afterHTML(c.after)}</article>`;
  }).join("");
  $("pindex").innerHTML=PAGES.slice(1).map((p,k)=>{const n=k+1,c=CATS[k],first=c&&S[LAYOUT[c.name].main[0]],hl=c?(first?first.t:""):"Clips, classifieds and the back page";return `<li style="--c:${p.c}"><button type="button" data-page-go="${n}"><span class="pg">${n+1}</span><span><b>${esc(p.name)}</b><em>${esc(hl)}</em></span></button></li>`}).join("");
  $$("#pages [data-rh]").forEach(el=>{el.outerHTML=runHead(+el.dataset.rh)});
  const tiles=CLIPIDS.map(id=>{const s=S[id];return `<button class="clip" type="button" data-clip="${id}" style="--c:${catColor(s.cat)};background:linear-gradient(rgba(0,0,0,.15) 30%,rgba(0,0,0,.82)),url('${esc(s.poster)}') center/cover"><small>${esc(s.cat)}</small><span class="pl"><i></i></span><span><b>${esc(s.t)}</b><em>${fmt(s.len)}</em></span></button>`});
  tiles.splice(3,0,clipAdHTML());$("clips").innerHTML=tiles.join("");
  $("cls-end").innerHTML=clsBlock(1);
  $("issue-thread").innerHTML=discussHTML("issue",{title:"Today's open thread"});Talk.render();
  Vids.observe($("v-paper"));Paper.balance();Paper.progress();Paper.applyFilter(P.filter);Pager.nav();
 },
 /* newspaper column fill: on wide screens, if a text-only story sits beside a much taller one,
    the section's "In brief" list moves into that column instead of leaving a gap. Phones keep the original order. */
 balance(){
  $$("#sections .sec").forEach(sec=>{
   const ib=sec.querySelector(".inbrief");if(!ib)return;
   const home=sec.querySelector(".ib-home")||(()=>{const m=document.createElement("i");m.className="ib-home";m.hidden=true;ib.before(m);return m})();
   home.after(ib);ib.classList.remove("inset");
   if(innerWidth<=760||P.filter!=="all")return;
   let best=null,gap=140;
   sec.querySelectorAll(".g > .card:not(.has-video)").forEach(c=>{
    const r=c.getBoundingClientRect();if(!r.height)return;
    const row=[...c.parentElement.children].filter(o=>o!==c&&Math.abs(o.getBoundingClientRect().top-r.top)<4);
    const tall=Math.max(0,...row.map(o=>o.getBoundingClientRect().height));
    const used=[...c.children].reduce((a,k)=>a+k.getBoundingClientRect().height,0);
    if(tall-used>gap){gap=tall-used;best=c}
   });
   if(best){ib.classList.add("inset");best.querySelector(".txt").append(ib)}
  });
 },
 refreshAds(){
  $$("#v-paper [data-spot][data-layout]").forEach(el=>{
   const k=el.dataset.spot, lay=el.dataset.layout;
   const html=lay==="sponsor"?sponsorHTML(k):lay==="clip"?clipAdHTML():lay.startsWith("cls-")?clsBlock(+lay.slice(4)):spotHTML(k,lay);
   el.outerHTML=html;
  });
  $$("#v-paper .spot.rv:not(.in),#v-paper .cls-block.rv:not(.in)").forEach(el=>el.classList.add("in"));
 },
 progress(){
  const n=S.filter(s=>P.read.has(s.id)).length;$("done").hidden=n!==S.length;
  $$("#pages .page").forEach(pg=>{const ids=[...new Set($$("[data-id]",pg).map(e=>+e.dataset.id))].filter(x=>!isNaN(x)),r=ids.filter(x=>P.read.has(x)).length,note=pg.querySelector(".pe-note");
   const nc=ids.reduce((a,x)=>a+cmCount(x),0)+(pg.dataset.page==="7"?cmCount("issue"):0);
   if(note)note.textContent=(nc?`${num(nc)} comments · `:"")+(ids.length?(r===ids.length?`All ${ids.length} stories on this page read`:`${r} of ${ids.length} read on this page`):`${n} of ${S.length} read in this issue`);
   const tab=document.querySelector(`#abp-tabs [data-page-go="${pg.dataset.page}"]`);if(tab)tab.classList.toggle("done",ids.length>0&&r===ids.length)});
 },
 markRead(id){
  if(P.read.has(id))return;P.read.add(id);store.set("bought-read-"+ISSUE_DAY,[...P.read]);Paper.progress();
  $$(`#v-paper [data-id="${id}"] .meta`).forEach(m=>{if(!m.querySelector(".readtag"))m.insertAdjacentHTML("beforeend",'<span class="readtag">Read</span>')});
 },
 applyFilter(f){
  P.filter=f;const sel=$("pfilter");if(sel&&sel.value!==f)sel.value=f;
  const lab={video:"video",quick:"2-minute",say:"have-your-say"}[f];
  $$("#sections .card").forEach(c=>{c.hidden=f==="video"?!c.classList.contains("has-video"):f==="quick"?!c.classList.contains("quick"):f==="say"?!c.classList.contains("has-say"):false});
  $$("#sections .g > .spot,#sections .inbrief").forEach(a=>a.hidden=f!=="all");
  $$("#sections .page").forEach(pg=>{const any=[...pg.querySelectorAll(".card")].some(c=>!c.hidden),e=pg.querySelector(".pg-empty");e.hidden=any;if(!any)e.innerHTML=`No ${lab} stories on this page. <button type="button" class="linkbtn" data-turn="next">Turn the page</button> or <button type="button" class="linkbtn" data-filter="all">show everything</button>.`;
   const tab=document.querySelector(`#abp-tabs [data-page-go="${pg.dataset.page}"]`);if(tab)tab.classList.toggle("dim",!any)});
  document.body.classList.toggle("filtered",f!=="all");Paper.balance&&Paper.balance();
 },
 click(e){
  const t=e.target;
  const vt=t.closest("[data-vote]");if(vt){const[id,i]=vt.dataset.vote.split(":");vote(isNaN(+id)?id:+id,+i);return true}
  const rc=t.closest("[data-react]");if(rc){const[id,i]=rc.dataset.react.split(":");react(+id,+i);return true}
  const f=t.closest("[data-filter]");if(f){Paper.applyFilter(f.dataset.filter);return true}
  const li=t.closest("[data-listen]");if(li){Radio.listenTo(+li.dataset.listen);return true}
  const shr=t.closest("[data-share]");if(shr){shareStory(S[+shr.dataset.share]);return true}
  const clip=t.closest("[data-clip]");if(clip){const id=+clip.dataset.clip,key="clip-"+id,st=vs(key);st.t=0;st.playing=true;st.user=true;st.muted=false;Radio.pause();Ov.open(vidHTML(key,S[id],"full"),false);Paper.markRead(id);return true}
  const apl=t.closest("[data-adplay]");if(apl){const k=apl.dataset.adplay,cre=adCre(k),vert=SPOTS[k].shape==="vert";Ov.open(bvHTML("ov-"+k,cre,vert?"vert":"std")+`<div class="ovcap"><span><b>${esc(cre.adv)}</b> · ${esc(cre.line||"")}</span>${adLinks(cre,"onvid")}<button class="sp-bid" type="button" data-adv-spot="${k}">Bid for this spot</button></div>`,vert);return true}
  const bvv=t.closest(".bv");if(bvv&&!bvv.closest("#ov")){toggleAd(bvv);return true}
  if(bvv&&bvv.closest("#ov")){toggleAd(bvv);return true}
  const v=t.closest(".vid:not(.still)");
  if(v&&v.closest("#v-paper")&&v.dataset.mode!=="full"){playInPlace(v);return true}
  if(v){
   const st=vs(v.dataset.key),s=S[+v.dataset.id],el=v.querySelector("video");
   if(t.closest(".mut")&&el){st.muted=!el.muted;el.muted=st.muted;updVid(v);return true}
   const bar=t.closest(".ctl")&&!t.closest(".pp")&&v.querySelector(".bar");
   if(bar&&el){const r=bar.getBoundingClientRect();st.t=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*s.len;el.currentTime=st.t;updVid(v);return true}
   if(st.t>=s.len)st.t=0;st.playing=!st.playing;st.user=true;if(st.playing)Radio.pause();updVid(v);return true}
  const op=t.closest("[data-open]");if(op){e.preventDefault();Reader.open(+op.dataset.open);return true}
  if(t.closest("a,button,input,select,label,form,.poll,.rx"))return false;
  const c=t.closest("#v-paper .card,#lead .txt,#lead .media");if(c){const id=c.dataset.id??c.closest("[data-id]")?.dataset.id??0;Reader.open(+id);return true}
  return false;
 }
};

/* ---------- reader: the full story in a side panel (full screen on phones) ---------- */
const Reader={
 lastFocus:null,
 open(id){
  const s=S[id], pos=ORDER.indexOf(id), prev=ORDER[pos-1], next=ORDER[pos+1];
  let from=null;
  if(READER_ID!==null&&READER_ID!==id&&!reduce){const b=$("rdbody");if(b)from={node:b.cloneNode(true),top:b.offsetTop,h:b.offsetHeight,scroll:b.scrollTop,dir:pos>ORDER.indexOf(READER_ID)?1:-1}}
  if(READER_ID===null)Reader.lastFocus=document.activeElement;
  const rk="r"+id, rst=vs(rk);
  if(s.video){rst.t=0;rst.playing=!reduce;rst.user=true;rst.muted=false;if(!reduce)Radio.pause()}
  READER_ID=id;Vids.stop();stopAds();
  const R=$("reader");R.style.setProperty("--c",catColor(s.cat));
  R.innerHTML=`<div class="rd-top"><span class="pos">Page ${pageOfStory(id)+1} · ${esc(s.cat)} · ${pos+1} of ${ORDER.length}</span><button type="button" class="chip-btn" data-share="${id}">Share</button><button type="button" class="chip-btn" data-listen="${id}">Listen</button><button type="button" class="chip-btn" id="rdx">Close</button></div>
  <div class="rd-bar"><i style="width:${(pos+1)/ORDER.length*100}%"></i></div>
  <div class="rd-body" id="rdbody">
   <div class="kick"><span>${esc(s.kick)}</span>${fmtBadge(s)}</div>
   <h2 class="hl">${esc(s.t)}</h2>${s.dek?`<p class="dek">${esc(s.dek)}</p>`:""}${byline(s)}
   ${s.video?vidHTML(rk,s,"full"):s.picture?picHTML(s,true):""}
   ${s.gist.length?`<p class="gist-h">The gist</p><ul class="gist">${s.gist.map(g=>`<li>${esc(g)}</li>`).join("")}</ul>`:""}
   ${s.body.length?`<div class="copy">${s.body.map(p=>`<p>${esc(p)}</p>`).join("")}</div>`:""}
   ${s.why?`<div class="why"><b>Why it matters</b><p>${esc(s.why)}</p></div>`:""}
   ${engageHTML(id)}
   <div class="rd-acts"><a href="${esc(s.src[1])}" target="_blank" rel="noopener">Read the original on ${esc(s.src[0])} <span aria-hidden="true">↗</span></a></div>
   ${discussHTML(id)}
  </div>
  <div class="rd-foot"><button type="button" class="prev" ${prev===undefined?"disabled":`data-open="${prev}"`}>← Prev</button><button type="button" class="next" ${next===undefined?"disabled":`data-open="${next}"`}><small>${next===undefined?"End of issue":"Next story"}</small><b>${next===undefined?"You've reached the last story":esc(S[next].t)}</b></button></div>`;
  $("rdscrim").hidden=false;R.hidden=false;Lock.sync();
  $("rdbody").scrollTop=0;$("rdx").focus({preventScroll:true});
  $$(".vid",R).forEach(updVid);
  if(from)Fade.in($("rdbody"));
  Paper.markRead(id);
 },
 close(){
  if(READER_ID===null)return;
  $$(".vid",$("reader")).forEach(v=>vs(v.dataset.key).playing=false);
  $("reader").hidden=true;$("rdscrim").hidden=true;$("reader").innerHTML="";READER_ID=null;Lock.sync();Vids.wake();
  if(Reader.lastFocus&&document.contains(Reader.lastFocus))Reader.lastFocus.focus({preventScroll:true});
 },
 key(e){
  if(READER_ID===null||/INPUT|TEXTAREA/.test(e.target.tagName))return false;
  const pos=ORDER.indexOf(READER_ID);
  if(e.key==="ArrowRight"||e.key==="j"){if(ORDER[pos+1]!==undefined)Reader.open(ORDER[pos+1]);return true}
  if(e.key==="ArrowLeft"||e.key==="k"){if(ORDER[pos-1]!==undefined)Reader.open(ORDER[pos-1]);return true}
  if(e.key==="Tab"){const f=[...$("reader").querySelectorAll("button,a,[tabindex='0']")].filter(x=>!x.disabled);if(!f.length)return false;const a=f[0],z=f[f.length-1];if(e.shiftKey&&document.activeElement===a){e.preventDefault();z.focus()}else if(!e.shiftKey&&document.activeElement===z){e.preventDefault();a.focus()}return true}
  return false;
 }
};

/* ---------- the issue: one continuous paper, eight sections. As you scroll, the paper's tint fades
   from one section colour to the next. The page strip follows along and jumps with a smooth scroll. ---------- */
function pageOfStory(id){if(id<=3)return 0;const k=CATS.findIndex(c=>LAYOUT[c.name].main.includes(id)||LAYOUT[c.name].briefs.includes(id));return k<0?0:k+1}
function runHead(n){return `<div class="runhead" aria-hidden="true"><span class="rh-b">Bought<i>.</i></span><span class="rh-d">${dayShort(ISSUE_DAY)} · No. ${issueNo(ISSUE_DAY)}</span><span class="rh-p">Page ${n+1} · ${esc(PAGES[n].short)}</span></div>`}
const Pager={
 i:-1,raf:0,
 list(){return $$("#pages > .page, #sections > .page").sort((a,b)=>a.dataset.page-b.dataset.page)},
 init(){
  $("abp-tabs").innerHTML=PAGES.map((p,n)=>`<button type="button" data-page-go="${n}" style="--c:${p.c}" aria-label="Page ${n+1}, ${esc(p.name)}"><i>${n+1}</i><span>${esc(p.short)}</span></button>`).join("");
  $("pfilter").addEventListener("change",e=>Paper.applyFilter(e.target.value));
  addEventListener("scroll",()=>{if(!Pager.raf)Pager.raf=requestAnimationFrame(()=>{Pager.raf=0;Pager.spy()})},{passive:true});
  addEventListener("resize",()=>Pager.spy(),{passive:true});
  Paper.progress();Paper.applyFilter(P.filter);Pager.set(0);
 },
 /* the section that holds the reading line (a little above the middle of the screen) sets the colour */
 spy(){
  if(VIEW!=="paper")return;
  const line=innerHeight*.42;let cur=0;
  Pager.list().forEach(p=>{if(p.getBoundingClientRect().top<=line)cur=+p.dataset.page});
  if(atBottom())cur=PAGES.length-1;
  Pager.set(cur);
 },
 set(i){
  if(i===Pager.i)return;Pager.i=i;
  document.body.dataset.page=i;document.body.style.setProperty("--sec",PAGES[i].c);
  Pager.nav();Shell.update();
 },
 nav(){
  const i=Math.max(0,Pager.i),last=PAGES.length-1;
  $$("#abp-tabs button").forEach(b=>{if(+b.dataset.pageGo===i)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current")});
  const box=$("abp-tabs"),on=box.querySelector("[aria-current]");
  if(on&&(on.offsetLeft<box.scrollLeft||on.offsetLeft+on.offsetWidth>box.scrollLeft+box.clientWidth))box.scrollTo({left:on.offsetLeft-24,behavior:reduce?"auto":"smooth"});
  $$(".abp-arrow").forEach(b=>{b.disabled=b.dataset.turn==="prev"?i===0:i===last});
 },
 /* jump to a section: a smooth scroll; the colour fades on the way */
 show(i){
  i=Math.max(0,Math.min(PAGES.length-1,i));const el=Pager.list()[i];if(!el)return;
  Reader.close();Ov.close();
  const top=i===0?0:scrollY+el.getBoundingClientRect().top-$("appbar").offsetHeight-6;
  scrollTo({top:Math.max(0,top),behavior:reduce?"auto":"smooth"});
 },
 next(){Pager.show(Math.max(0,Pager.i)+1)},
 prev(){Pager.show(Math.max(0,Pager.i)-1)},
 pageOf(el){const p=el&&el.closest(".page");return p?+p.dataset.page:0},
 goSpot(k){
  const el=$("v-paper").querySelector(`[data-spot="${k}"]`);if(!el)return;
  const r=el.getBoundingClientRect();
  scrollTo({top:Math.max(0,scrollY+r.top-Math.max(110,(innerHeight-r.height)/2)),behavior:reduce?"auto":"smooth"});
  el.classList.add("in","flash");setTimeout(()=>el.classList.remove("flash"),2200);
 }
};
const atBottom=()=>scrollY+innerHeight>=document.documentElement.scrollHeight-3;


/* ---------- issues: step back and forward, or pick any date from the archive ---------- */
const Issue={
 calMonth:null,
 async go(d){
  if(d==="today")d=LATEST;
  if(!ISSUES.includes(d)||d===ISSUE_DAY){Issue.nav();return}
  Sheet.close();Reader.close();Ov.close();
  if(!await Data.load(d)){toast("That issue could not be loaded.");Issue.nav();return}
  Theme.edition(wdOf(d));document.body.classList.toggle("archive",d!==LATEST);
  Paper.render();Issue.settle();
  scrollTo({top:0,behavior:"instant"});Pager.i=-1;Pager.spy();
  Fade.in($("pages"));
 },
 /* a freshly rendered page: everything already on screen is shown at once */
 settle(){$$("#v-paper .rv").forEach(el=>{el.classList.remove("pre");el.classList.add("in")});Motion.scan($("v-paper"));Paper.progress();Paper.applyFilter(P.filter)},
 step(n){const k=ISSUES.indexOf(ISSUE_DAY)-n;if(ISSUES[k])Issue.go(ISSUES[k])},   /* the list is newest first */
 nav(){
  const arch=!!LATEST&&ISSUE_DAY!==LATEST, k=ISSUES.indexOf(ISSUE_DAY);
  $("inav-lab").textContent=arch?`No. ${issueNo(ISSUE_DAY)}`:ISSUE_DAY===TODAY?"Today":"Latest";
  $$(".inav-b").forEach(b=>{b.disabled=+b.dataset.issueStep<0?k<0||k>=ISSUES.length-1:k<=0});
  const a=$("arch");a.hidden=!arch;
  if(arch)a.innerHTML=`<span><b>From the archive</b> · Issue ${issueNo(ISSUE_DAY)}, ${dayLong(ISSUE_DAY)} · ${esc(THEMES[wdOf(ISSUE_DAY)].name)}</span><button type="button" class="chip-btn" data-issue-go="today">Latest issue →</button>`;
 },
 cal(m){
  const cur=m||Issue.calMonth||ISSUE_DAY.slice(0,7);Issue.calMonth=cur;
  const [y,mo]=cur.split("-").map(Number), first=`${cur}-01`, days=new Date(Date.UTC(y,mo,0)).getUTCDate(), lead=(wdOf(first)+6)%7;
  const prevM=new Date(Date.UTC(y,mo-2,1)).toISOString().slice(0,7), nextM=new Date(Date.UTC(y,mo,1)).toISOString().slice(0,7);
  const title=new Date(first+"T00:00:00Z").toLocaleDateString("en-GB",{month:"long",year:"numeric",timeZone:"UTC"});
  let cells="";for(let i=0;i<lead;i++)cells+=`<span></span>`;
  for(let n=1;n<=days;n++){const d=`${cur}-${String(n).padStart(2,"0")}`, ok=ISSUES.includes(d);
   cells+=ok?`<button type="button" class="cd${d===TODAY?" today":""}${d===ISSUE_DAY?" on":""}" data-issue-go="${d}" style="--th:${THEMES[wdOf(d)].hue}" aria-label="Issue ${issueNo(d)}, ${dayLong(d)}${d===TODAY?", today":""}"><b>${n}</b><i></i></button>`:`<span class="cd off" aria-hidden="true"><b>${n}</b></span>`}
  const week=ISSUES.slice(0,7);
  const html=`<div class="sh-top"><div><span class="eyebrow">The archive · ${ISSUES.length} issue${ISSUES.length===1?"":"s"}</span><h3>Read any issue</h3></div><button type="button" class="chip-btn" data-x>Close</button></div>
  <div class="sh-body cal">
   <div class="cal-week">${week.map(d=>`<button type="button" class="${d===ISSUE_DAY?"on":""}" data-issue-go="${d}" style="--th:${THEMES[wdOf(d)].hue}"><small>${d===TODAY?"Today":new Date(d+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"})}</small><b>${dayNum(d)}</b><em>No. ${issueNo(d)}</em></button>`).join("")}</div>
   <div class="cal-h"><button type="button" class="inav-b" data-cal-m="${prevM}" ${!ISSUES.length||first<=ISSUES[ISSUES.length-1]?"disabled":""} aria-label="Previous month">‹</button><b>${title}</b><button type="button" class="inav-b" data-cal-m="${nextM}" ${nextM>TODAY.slice(0,7)?"disabled":""} aria-label="Next month">›</button></div>
   <div class="cal-g" role="grid">${["M","T","W","T","F","S","S"].map(x=>`<small>${x}</small>`).join("")}${cells}</div>
   <p class="hint">Each dot is that day's edition colour. Every published issue stays here.</p>
  </div>
  <div class="sh-acts">${ISSUE_DAY!==LATEST?`<button type="button" class="btn ghost" data-issue-go="today">Back to the latest</button>`:""}<button type="button" class="btn" data-x>Done</button></div>`;
  if($("sheetwrap").hidden||!$("sheet").querySelector(".cal"))Sheet.open(html,{label:"Archive"});else Sheet.set(html);
 },
 click(e){
  const t=e.target;
  const g=t.closest("[data-issue-go]");if(g){e.preventDefault();if(VIEW!=="paper")go("paper");Issue.go(g.dataset.issueGo);return true}
  const st=t.closest("[data-issue-step]");if(st){Issue.step(+st.dataset.issueStep);return true}
  if(t.closest("[data-cal]")){Issue.calMonth=null;Issue.cal();return true}
  const cm=t.closest("[data-cal-m]");if(cm){Issue.cal(cm.dataset.calM);return true}
  return false;
 }
};

/* ---------- how this issue was made: the funnel's own counts for this issue (back page) ---------- */
function engineHTML(d){
 const e=ISSUE_STATS;if(!e)return "";
 const w=x=>Math.max(2,Math.log10(Math.max(1,x))/Math.log10(Math.max(10,e.read))*100).toFixed(1);
 const cut=ISSUE_META&&ISSUE_META.generated_at?`Cut at ${timeIST(Date.parse(ISSUE_META.generated_at))} IST`:"Final";
 return `<div class="eng-h"><span class="eng-dot${d===TODAY?" live":""}" aria-hidden="true"></span><b>How this issue was made</b><span>${cut}</span></div>
 <div class="eng-funnel" aria-hidden="true">${[["Read",e.read],["Unique",e.unique],["On brief",e.on_brief],["Published",e.published]].map(([l,v])=>`<i style="--w:${w(v)}%"><em>${l}</em></i>`).join("")}</div>
 <dl class="eng-g">
  <div><dt>Items read</dt><dd>${num(e.read)}</dd><span>from ${num(e.sources)} sources</span></div>
  <div><dt>Duplicates removed</dt><dd>${num(e.duplicates)}</dd><span>the same story from more than one source</span></div>
  <div><dt>Filtered out</dt><dd>${num(e.off_brief+e.expired)}</dd><span>promotions, off-topic or too old</span></div>
  <div><dt>On brief</dt><dd>${num(e.on_brief)}</dd><span>passed the keyword rules and the date window</span></div>
  <div><dt>Published</dt><dd>${num(e.published)}</dd><span>the highest ranked in each section</span></div>
  <div><dt>Videos</dt><dd>${num(e.videos)}</dd><span>made for the top stories, each past a quality check</span></div>
 </dl>
 <p class="eng-n">Keyword rules read, de-duplicate and rank the news. Every story links to its original source.</p>`;
}
/* share a story: its preview page when it has one, otherwise a link that opens it in the issue */
function shareStory(s){
 const base=location.href.split("#")[0].replace(/index\.html$/,"");
 const url=s.share?`${base}s/${s.uid}/`:`${base}#s-${ISSUE_DAY}-${s.uid}`;
 if(navigator.share){navigator.share({title:s.t,url}).catch(()=>{});return}
 const done=()=>toast("Link copied.");
 if(navigator.clipboard)navigator.clipboard.writeText(url).then(done).catch(()=>toast(url));else toast(url);
}
