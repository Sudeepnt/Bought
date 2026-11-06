/* Bought. Daily — Advertise view: issue picker, template map, spot detail, bid flow, My bids, rules, receipts, reports */

const ADV={tab:"spots",date:null,spot:"top"};

/* ---------- small parts ---------- */
const closeText=(d,k)=>{const c=closeOf(d,k);return `${timeIST(c)} IST ${istISO(c)===istISO(now())?"tonight":"on "+dayShort(istISO(c))}`};
function statusPill(e){
 const m=({leading:()=>["ok",e.mode==="auto"?`Leading · auto to ${usd(e.max)}`:"Leading"],outbid:()=>["out","Outbid"],in:()=>["ok",`In · line ${e.ref&&AU.cls[e.d]?clsRank(e.d,e.ref):e.rank} of ${SPOTS.cls.seats}`],out:()=>["out",`Below line ${SPOTS.cls.seats}`],won:()=>["ink",`Won · ${usd2(e.total)} charged`],live:()=>["ink","Live · report ready"],lost:()=>["muted","Not won · hold released"]})[e.status]();
 return `<span class="pill ${m[0]}">${m[1]}</span>`;
}
const reviewPill=e=>e.adState==="rejected"?`<span class="pill sub out">Ad needs changes</span>`:e.review==="approved"?`<span class="pill sub ok">Ad approved</span>`:`<span class="pill sub">Ad in review</span>`;
const needsRaise=e=>e.status==="outbid"||e.status==="out";
function demoHTML(){
 if(Live.on)return "";
 const pend=[...new Set(AU.past.filter(e=>e.status==="won").map(e=>e.d))][0];
 return `<section class="demo"><div><b>Prototype controls</b><p>${AU.ff?`Clock moved to ${timeIST(now())} IST. Late bids now extend each spot's close by 5 minutes.`:"These stand in for time passing. They're not part of the product."}</p></div><div class="demo-b">
  <button type="button" class="chip-btn" data-demo="ff"${AU.ff?" disabled":""}>Skip to 5 min before close</button>
  <button type="button" class="chip-btn" data-demo="close">Close bidding for ${dayShort(AU.dates[0])} now</button>
  ${pend?`<button type="button" class="chip-btn" data-demo="publish" data-d="${pend}">Publish the ${dayShort(pend)} issue</button>`:""}</div></section>`;
}

/* ---------- Spots tab ---------- */
function tmSpot(d,k,label,extra=""){
 const sp=SPOTS[k], hi=highOf(d,k), my=myBid(d,k);
 const val=k==="cls"?(hi!=null?`cut-off ${usd(hi)}`:`from ${usd(reserveFor(k,d))}`):(hi!=null?usd(hi):`reserve ${usd(reserveFor(k,d))}`);
 const me=my?`<i class="me ${needsRaise(my)?"out":"ok"}" title="${needsRaise(my)?"You were outbid":"You lead"}"></i>`:"";
 return `<button type="button" class="tm-sp f-${sp.fmt} ${extra}" data-spot-sel="${k}" aria-pressed="${ADV.spot===k}"><span class="tm-n">${me}${esc(label||sp.name)}</span><span class="tm-v">${val}</span></button>`;
}
const ed=(l,c="")=>`<div class="tm-ed ${c}"><span>${l}</span></div>`;
function mapHTML(d){
 return `<div class="tm" aria-label="Map of the ${dayShort(d)} issue">
  <div class="tm-h"><span>Issue ${issueNo(d)} · ${THEMES[wdOf(d)].name}</span><span class="tm-key"><i class="k-video"></i>Video or image <i class="k-classified"></i>Classified</span></div>
  <div class="tm-row">${ed("Page 1 · Front · masthead","mast")}</div>
  <div class="tm-row">${tmSpot(d,"top")}</div>
  <div class="tm-row two">${ed("Lead story","big")}${ed("Lead video","big")}</div>
  <div class="tm-row">${ed("Today in 30 seconds")}</div>
  <div class="tm-row three">${ed("Top 1")}${ed("Top 2")}${ed("Top 3")}</div>
  <div class="tm-row two">${ed("The Pulse · poll")}${ed("Day in numbers")}</div>
  <div class="tm-row">${tmSpot(d,"front")}</div>
  <div class="tm-row sec">${ed("Page 2 · AI","h")}</div>
  <div class="tm-row three">${ed("Story")}${ed("Story")}${ed("Story")}</div>
  <div class="tm-row">${tmSpot(d,"feed-a")}</div>
  <div class="tm-row sec">${ed("Page 3 · Technology","h")}</div>
  <div class="tm-row three">${ed("Story")}${ed("Story")}${ed("Story")}</div>
  <div class="tm-row">${tmSpot(d,"cls","Classifieds · lines 1–4")}</div>
  <div class="tm-row sec">${ed("Page 4 · Business","h")}</div>
  <div class="tm-row three">${ed("Story")}${ed("Story")}${ed("Story")}</div>
  <div class="tm-row">${tmSpot(d,"half","Half page","tall")}</div>
  <div class="tm-row sec">${ed("Page 5 · Founders","h")}</div>
  <div class="tm-row three">${ed("Story")}${ed("Story")}${ed("Story")}</div>
  <div class="tm-row sec">${ed("Page 6 · Launches","h")}</div>
  <div class="tm-row">${tmSpot(d,"feed-e")}</div>
  <div class="tm-row sec">${ed("Page 7 · Geopolitics","h")}</div>
  <div class="tm-row three">${ed("Story")}${ed("Story")}${ed("Story")}</div>
  <div class="tm-row sec">${ed("Page 8 · Back page","h")}</div>
  <div class="tm-row clips">${ed("Clip","v")}${ed("Clip","v")}${ed("Clip","v")}${tmSpot(d,"clip","Clip break","v")}</div>
  <div class="tm-row">${tmSpot(d,"cls","Classifieds · lines 5–8")}</div>
 </div>`;
}
function previewFor(k){
 if(k==="cls")return `<ol class="cls-list one">${CLS_TODAY.slice(0,3).map(([p,t,w])=>`<li><b>${usd(p)}</b><span>${esc(t)} <em>${esc(w)}</em></span></li>`).join("")}</ol>`;
 if(k==="spon-a"||k==="spon-d")return `<div class="spp-spon"><span class="sec-mock">${k==="spon-a"?"Page 2 · AI":"Page 5 · Founders"}</span>${sponsorHTML(k,true).replace(/data-adv-spot="[^"]*"/,"disabled")}</div>`;
 if(k==="clip")return `<div class="spp-clip">${bvHTML("pv-clip",TODAY_ADS.clip,"vert")}</div>`;
 return spotHTML(k,k==="top"?"banner":k==="half"?"half":"native",{preview:true}).replace(" rv"," in");
}
function panelHTML(d,k){
 const sp=SPOTS[k], f=FORMATS[sp.fmt], my=myBid(d,k), open=isOpenSpot(d,k), hi=highOf(d,k), st=spotState(d,k);
 const hist=k==="cls"?clsSorted(d).slice(0,SPOTS.cls.seats).map((x,i)=>`<li class="${x.me?"me":""}"><span>${i+1}. ${x.me?"You":esc(x.h)}</span><b>${usd(x.amt)}</b><em>block ${Math.floor(i/4)+1}</em></li>`).join("")
  :st.hist.slice(0,6).map(h=>`<li class="${h.me?"me":""}"><span>${esc(h.h)}</span><b>${usd(h.amt)}</b><em>${ago(h.t)}</em></li>`).join("");
 const btn=!open?`<button class="btn" disabled>Bidding closed</button>`:my?`<button class="btn${needsRaise(my)?" accent":""}" data-raise="${d}|${k}">${needsRaise(my)?`Raise to ${usd(minBid(d,k))}`:"Raise your bid"}</button>`:`<button class="btn" data-bid-start="${k}">Bid on this spot</button>`;
 return `<div class="spp-h"><span class="fchip f-${sp.fmt}">${f.name}</span><h2>${esc(sp.name)}</h2><p>${esc(sp.zone)} · ${esc(sp.view)}</p></div>
  <div class="spp-pv"><small>Example: today's winner</small>${previewFor(k)}</div>
  <dl class="spp-stats"><div><dt>${k==="cls"?`Cut-off · line ${SPOTS.cls.seats}`:"Highest bid"}</dt><dd>${hi!=null?usd(hi):"None yet"}</dd></div><div><dt>Next minimum</dt><dd>${usd(minBid(d,k))}</dd></div><div><dt>Bids</dt><dd>${bidsOf(d,k)}</dd></div><div><dt>Reserve</dt><dd>${usd(reserveFor(k,d))}</dd></div></dl>
  <p class="spp-close">${open?`Bidding for the <b>${dayShort(d)}</b> issue closes ${closeText(d,k)} · <b class="cdx" data-until="${closeOf(d,k)}">${hms(closeOf(d,k)-now())}</b>${st.ext?` · <span class="ext">extended ${st.ext}×</span>`:""}`:"Bidding for this issue has closed."}</p>
  ${my?`<div class="spp-me">${statusPill(my)}${reviewPill(my)}<span>${my.mode==="auto"?`Your price ${usd(my.amt)}, max ${usd(my.max)}`:`Your bid ${usd(my.amt)}`}</span></div>`:""}
  <div class="spp-act">${btn}<span class="spp-note">Only the winner pays. ${k==="cls"?`Top ${SPOTS.cls.seats} run.`:`+${usd(sp.inc)} increments.`}</span></div>
  <div class="spp-hist"><h4>${k==="cls"?`Current top ${SPOTS.cls.seats}`:"Recent bids"}</h4>${hist?`<ul>${hist}</ul>`:`<p class="hint">No bids yet. Be first at the reserve price.</p>`}<small>Bidders stay anonymous until close.</small></div>
  <details class="spp-spec"${ADV.specOpen?" open":""}><summary>Format and specs</summary><ul>${f.spec.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></details>`;
}
function spotsHTML(){
 const d=ADV.date, d0=AU.dates[0];
 return `<section class="adv-hero rv"><span class="eyebrow">Bought. Ads</span>
  <h1>Buy a spot in the paper. <span>Only the winner pays.</span></h1>
  <p>Every spot in every issue is its own live auction. Bid, upload a short video of yourself, and if yours is the highest bid at close, it runs from 07:00 IST with your price printed beside it.</p>
  <ol class="adv-steps"><li><b>1</b>Pick an issue and a spot</li><li><b>2</b>Bid and add your ad</li><li><b>3</b>Highest bid at 22:00 IST wins</li></ol>
  <div class="adv-kpis"><div><small>Next close</small><b class="cdx" data-until="${nextClose()}">${hms(nextClose()-now())}</b><span>${dayShort(d0)} issue · 22:00 IST</span></div><div><small>Open issues</small><b>${AU.dates.length}</b><span>book up to a week ahead</span></div><div><small>Per issue</small><b>6 + 8</b><span>display spots + classified lines</span></div></div></section>
  <div class="adv-dates" role="tablist" aria-label="Choose an issue">${AU.dates.map((x,i)=>{const T=THEMES[wdOf(x)],c=closeAt(x);return `<button type="button" role="tab" aria-selected="${x===d}" data-adate="${x}" style="--th:${T.hue}"><span class="dw">${new Date(x+"T00:00:00Z").toLocaleDateString("en-GB",{weekday:"short",timeZone:"UTC"})}</span><span class="dd">${dayNum(x)}</span><span class="dt">${T.short}</span><span class="dc">${istISO(c)===istISO(now())?"Closes tonight":"Closes "+dayNum(istISO(c))}</span></button>`}).join("")}</div>
  <div class="adv-grid"><div class="adv-map">${mapHTML(d)}</div><aside class="sp-panel" id="sp-panel" aria-live="polite">${panelHTML(d,ADV.spot)}</aside></div>
  ${demoHTML()}`;
}

/* ---------- My bids tab ---------- */
function mineHTML(){
 const open=myOpen(), past=AU.past.slice().reverse(), charged=AU.past.filter(e=>e.inv).reduce((a,e)=>a+e.total,0);
 let h=`<div class="mb-sum rv"><div><small>Active bids</small><b>${open.length}</b><span>${open.filter(e=>!needsRaise(e)).length} leading</span></div><div><small>Credits free</small><b>${usd(availCredits())}</b><span>${usd(heldTotal())} set aside · <button type="button" class="linkbtn" data-wallet>Wallet</button></span></div><div><small>Spent</small><b>${usd(charged)}</b><span>${AU.past.filter(e=>e.inv).length} invoice${AU.past.filter(e=>e.inv).length===1?"":"s"}</span></div><div><small>Next close</small><b class="cdx" data-until="${nextClose()}">${hms(nextClose()-now())}</b><span>${dayShort(AU.dates[0])} issue</span></div></div>`;
 if(!open.length&&!past.length)h+=`<div class="empty rv"><b>No bids yet</b><p>Add credits to your wallet, pick an issue and a spot, set your price and add your ad. Credits are only used if you win.</p><button class="btn" type="button" data-atab="spots">See the spots</button></div>`;
 AU.dates.forEach(d=>{
  const es=open.filter(e=>e.d===d);if(!es.length)return;
  h+=`<section class="mb-group rv"><div class="mb-gh"><div><b>${dayLong(d)}</b><span>${THEMES[wdOf(d)].name} · Issue ${issueNo(d)}</span></div><span class="mb-close">Closes in <b class="cdx" data-until="${lastClose(d)}">${hms(lastClose(d)-now())}</b></span></div><ul class="mb-rows">${es.map(e=>`<li><div class="mb-spot"><b>${esc(SPOTS[e.k].name)}</b><small>${e.mode==="auto"?`Your price ${usd(e.amt)} · max ${usd(e.max)}`:`Your bid ${usd(e.amt)}`} · highest ${usd(highOf(d,e.k)??e.amt)}</small></div><div class="mb-st">${statusPill(e)}${reviewPill(e)}</div><div class="mb-act"><button type="button" class="chip-btn${needsRaise(e)?" warn":""}" data-raise="${d}|${e.k}">${needsRaise(e)?`Raise to ${usd(minBid(d,e.k))}`:"Raise"}</button><button type="button" class="chip-btn" data-editad="${d}|${e.k}">Edit ad</button></div></li>`).join("")}</ul></section>`;
 });
 if(AU.inbox.length)h+=`<section class="mb-inbox rv"><h4>Updates</h4><ul>${AU.inbox.slice(0,6).map(n=>`<li class="${n.kind}"><span>${esc(n.msg)}</span><em>${ago(n.t)}</em></li>`).join("")}</ul></section>`;
 const pd=[...new Set(past.map(e=>e.d))];
 if(pd.length)h+=`<h3 class="mb-h">Results</h3>`+pd.map(d=>`<section class="mb-group rv"><div class="mb-gh"><div><b>${dayLong(d)}</b><span>Issue ${issueNo(d)} · bidding closed</span></div></div><ul class="mb-rows">${past.filter(e=>e.d===d).map(e=>{const i=AU.past.indexOf(e);return `<li><div class="mb-spot"><b>${esc(SPOTS[e.k].name)}</b><small>${e.status==="lost"?`Your bid ${usd(e.price)} · the spot went for ${usd(e.final)}`:`Won at ${usd(e.price)}${e.gst?` + ${usd2(e.gst)} GST`:""} · invoice ${e.inv}`}</small></div><div class="mb-st">${statusPill(e)}</div><div class="mb-act">${e.inv?`<button type="button" class="chip-btn" data-receipt="${i}">Invoice</button><button type="button" class="chip-btn" data-seepaper="${e.k}">See it in the paper</button>`:""}${e.status==="live"?`<button type="button" class="chip-btn" data-report="${i}">Report</button>`:""}<button type="button" class="chip-btn" data-book="${e.k}">Book again</button></div></li>`}).join("")}</ul></section>`).join("");
 return h+demoHTML();
}

/* ---------- How it works tab ---------- */
function rulesHTML(){
 return `<section class="rules-top rv"><span class="eyebrow">How it works</span><h2>One spot, one winner, one public price.</h2><p>Here's the life of an issue, from the first bid to the delivery report.</p>
  <ol class="life">${LIFECYCLE.map(([t,h,s,key])=>`<li class="${key||""}"><b>${t}</b><span>${h}</span>${s?`<small>${s}</small>`:""}</li>`).join("")}</ol></section>
  <div class="rules-grid">${RULES.map((r,i)=>`<section class="rule rv"><h3><span>${String(i+1).padStart(2,"0")}</span>${esc(r.h)}</h3><ul>${r.p.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></section>`).join("")}</div>
  <section class="faq rv"><h3>Questions</h3>${FAQ.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("")}</section>
  <p class="rules-foot">Building this? <button type="button" class="linkbtn" data-go="spec">Read the developer spec</button></p>`;
}

/* ---------- view controller ---------- */
const Adv={
 render(){
  const nOut=myOpen().filter(needsRaise).length, nMy=myOpen().length;
  $("adv").innerHTML=`<div class="adv-tabs" role="tablist">${[["spots","Spots"],["mine",`My bids${nMy?` <span class="cnt${nOut?" warn":""}">${nMy}</span>`:""}`],["rules","How it works"]].map(([k,l])=>`<button type="button" role="tab" data-atab="${k}" aria-selected="${ADV.tab===k}">${l}</button>`).join("")}<button type="button" class="wallet-chip" data-wallet aria-label="Wallet: ${usd2(availCredits())} free to bid"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 8.5h4" stroke="currentColor" stroke-width="1.3"/><circle cx="11.5" cy="8.5" r=".9" fill="currentColor"/></svg><span>Wallet</span><b>${usd(availCredits())}</b></button></div><div id="adv-body">${Adv.body()}</div>`;
 },
 body(){return ADV.tab==="mine"?mineHTML():ADV.tab==="rules"?rulesHTML():spotsHTML()},
 refresh(force){
  Adv.badge();Bid.onMarket();
  if(VIEW==="advertise"&&AU.dates.length)$("ab-status").innerHTML=`Bids for ${dayShort(AU.dates[0])} close in <b class="cdx" data-until="${nextClose()}">${hms(nextClose()-now())}</b>`;
  if(VIEW!=="advertise"||(ADV.tab==="rules"&&!force))return;
  const a=document.activeElement, fk=a&&(a.dataset.spotSel||a.dataset.adate||a.dataset.atab||a.dataset.raise);
  const det=$("adv").querySelector(".spp-spec");if(det)ADV.specOpen=det.open;
  Adv.render();$$("#adv .rv").forEach(el=>el.classList.add("in"));
  if(fk){const el=$("adv").querySelector(`[data-spot-sel="${fk}"],[data-adate="${fk}"],[data-atab="${fk}"],[data-raise="${fk}"]`);el&&el.focus({preventScroll:true})}
 },
 badge(){const n=myOpen().filter(needsRaise).length;$$('[data-go="advertise"]').forEach(b=>b.classList.toggle("has-alert",n>0))},
 tab(t){const order=["spots","mine","rules"],dir=order.indexOf(t)>=order.indexOf(ADV.tab)?1:-1;ADV.tab=t;if(t==="mine")$("toasts").innerHTML="";if(VIEW!=="advertise")go("advertise");else{Adv.render();scrollTo({top:0,behavior:"instant"});$$("#adv .rv").forEach(el=>el.classList.add("in"));Fade.in($("adv"))}},
 openSpot(k){ADV.spot=k;ADV.tab="spots";if(!AU.dates.includes(ADV.date))ADV.date=AU.dates[0];go("advertise");if(innerWidth<=900)setTimeout(()=>$("sp-panel")?.scrollIntoView({block:"start",behavior:reduce?"auto":"smooth"}),60)},
 receipt(e){
  const rate=e.gst?"18%":"0%, export of services";
  Sheet.open(`<div class="sh-top"><div><span class="eyebrow">Invoice ${e.inv}</span><h3>${esc(SPOTS[e.k].name)} · ${dayShort(e.d)}</h3></div><button type="button" class="chip-btn" data-x>Close</button></div>
  <div class="sh-body"><table class="inv"><tr><td>Winning bid, Issue ${e.issue}</td><td>${usd2(e.price)}</td></tr><tr><td>GST (${rate})</td><td>${usd2(e.gst)}</td></tr><tr class="tot"><td>Total deducted</td><td>${usd2(e.total)}</td></tr></table>
  <dl class="kv"><dt>Billed to</dt><dd>${esc(AU.acct?.name||e.cre?.adv||"Advertiser")}${AU.acct?.gstin?` · GSTIN ${esc(AU.acct.gstin)}`:""}</dd><dt>Paid with</dt><dd>Bought. credits, deducted from your wallet at close</dd><dt>Deducted</dt><dd>${dayShort(istISO(e.settledAt))}, ${timeIST(e.settledAt)} IST</dd></dl>
  ${Live.on?"":`<p class="hint">Sample invoice from the prototype. No money moved.</p>`}</div><div class="sh-acts"><button type="button" class="btn" data-x>Done</button></div>`,{label:"Invoice"});
 },
 report(e){
  const r=e.report;if(!r)return;
  Sheet.open(`<div class="sh-top"><div><span class="eyebrow">Delivery report · Issue ${e.issue}</span><h3>${esc(SPOTS[e.k].name)} · ${dayShort(e.d)}</h3></div><button type="button" class="chip-btn" data-x>Close</button></div>
  <div class="sh-body"><div class="rep">${[["Readers reached",num(r.views)],...(r.plays?[["Video plays",num(r.plays)],...(r.watch?[["Average watch",r.watch+" s"]]:[])]:[]),["Clicks",num(r.clicks)],["Click rate",(r.clicks/(r.views||1)*100).toFixed(1)+"%"],["Cost per 1,000 readers",usd2(e.price/(r.views||1)*1000)]].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join("")}</div>
  ${Live.on?"":`<p class="hint">Sample numbers from the prototype.</p>`}</div><div class="sh-acts"><button type="button" class="chip-btn" data-book="${e.k}">Book this spot again</button><button type="button" class="btn" data-x>Done</button></div>`,{label:"Delivery report"});
 },
 click(e){
  const t=e.target;
  if(t.closest("[data-wallet]")){Wallet.open();return true}
  const tu=t.closest("[data-topup]");if(tu){Wallet.topup(tu);return true}
  if(Live.on&&t.closest("[data-withdraw]")){Live.withdraw();return true}
  if(t.closest("[data-withdraw]")){const a=withdrawCredits(availCredits());Wallet.render();Adv.refresh(true);toast(a?`${usd2(a)} is on its way to your bank. It usually arrives in 3–5 working days.`:"Nothing to withdraw right now.");return true}
  const at=t.closest("[data-atab]");if(at){Sheet.close();Adv.tab(at.dataset.atab);return true}
  const dt=t.closest("[data-adate]");if(dt){ADV.date=dt.dataset.adate;Adv.render();$$("#adv .rv").forEach(el=>el.classList.add("in"));$("adv").querySelector(`[data-adate="${ADV.date}"]`)?.focus({preventScroll:true});return true}
  const ss=t.closest("[data-spot-sel]");if(ss){ADV.spot=ss.dataset.spotSel;$("sp-panel").innerHTML=panelHTML(ADV.date,ADV.spot);$$("[data-spot-sel]").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.spotSel===ADV.spot)));if(innerWidth<=900)$("sp-panel").scrollIntoView({block:"start",behavior:reduce?"auto":"smooth"});return true}
  const bs=t.closest("[data-bid-start]");if(bs){Bid.start(bs.dataset.bidStart,[ADV.date]);return true}
  const rs=t.closest("[data-raise]");if(rs){const[d,k]=rs.dataset.raise.split("|");Bid.raise(d,k);return true}
  const ea=t.closest("[data-editad]");if(ea){const[d,k]=ea.dataset.editad.split("|");Bid.editAd(d,k);return true}
  const rc=t.closest("[data-receipt]");if(rc){Adv.receipt(AU.past[+rc.dataset.receipt]);return true}
  const rp=t.closest("[data-report]");if(rp){Adv.report(AU.past[+rp.dataset.report]);return true}
  const sp=t.closest("[data-seepaper]");if(sp){Sheet.close();go("paper");const k=sp.dataset.seepaper;setTimeout(()=>Pager.goSpot(k),120);return true}
  const bk=t.closest("[data-book]");if(bk){Sheet.close();Bid.start(bk.dataset.book,[AU.dates.find(d=>!myBid(d,bk.dataset.book))].filter(Boolean));return true}
  const dm=t.closest("[data-demo]");if(dm){const a=dm.dataset.demo;if(a==="ff")fastForward();else if(a==="close")closeNow();else if(a==="publish")publish(dm.dataset.d);return true}
  return Bid.click(e);
 }
};
VIEW_HOOKS.advertise={
 enter(){if(!AU.dates.includes(ADV.date))ADV.date=AU.dates[0];Adv.render();Vids.stop();stopAds();$("ab-status").innerHTML=`Bids for ${dayShort(AU.dates[0])} close in <b class="cdx" data-until="${nextClose()}">${hms(nextClose()-now())}</b>`},
 leave(){$("ab-status").innerHTML="";stopAds()}
};

/* =========================================================
   Bid flow (bottom sheet): Issues → Bid → Ad → Payment → Review → Done
   Raise: Bid → Review. Edit ad: Ad only.
   ========================================================= */
const BANNED=/(guarantee[ds]?\s+(returns?|profits?)|risk[- ]free|100%\s*safe|\bcures?\b|get rich)/i;
const STEP_T={dates:"Choose issues",bid:"Set your bid",ad:"Add your ad",signin:"Sign in",acct:"Account and payment",verify:"Confirm your email",review:"Review and place",done:"Bids placed"};
const STEP_S={dates:"Issues",bid:"Bid",ad:"Ad",signin:"Sign in",acct:"Payment",verify:"Email",review:"Review"};
const GOOGLE_G=`<svg class="g-mark" viewBox="0 0 18 18" aria-hidden="true"><path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"/><path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"/><path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"/><path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"/></svg>`;
function defCre(k){const f=SPOTS[k].fmt;if(f==="video")return {p:"me",about:"",thumb:"",who:"",file:null,img:null,fname:"",len:30,web:"",social:"",email:""};if(f==="creative")return {line:"",sub:"",cta:"",mark:{bg:"#1f3b5c",fg:"#f4efe4"}};return {line:"",link:""}}
function adChecks(k,c){
 const f=SPOTS[k].fmt, txt=[c.about,c.thumb,c.who,c.line,c.sub].filter(Boolean).join(" "), out=[];
 if(f==="video"&&c.img&&!c.file){out.push({ok:true,l:`Image: ${c.fname||"added"}`});out.push({ok:!!(c.line||"").trim()&&c.line.length<=60,l:"Headline, up to 60 characters"})}
 else if(f==="video"){out.push({ok:!!(c.thumb||"").trim()&&c.thumb.length<=32,l:"Thumbnail text, up to 32 characters"});out.push({ok:!!(c.who||"").trim(),l:"Name and role shown on screen"});out.push({ok:true,l:c.fname?`File: ${c.fname}`:"No file yet: the sample presenter is used until you record or upload"});if(c.file&&c.dur)out.push({ok:true,l:c.dur>60?`Video is ${fmt(c.dur)}: the minute from ${fmt(c.trimStart||0)} to ${fmt((c.trimStart||0)+60)} runs`:`Video is ${fmt(c.dur)}, within 60 seconds`})}
 if(f==="creative"){out.push({ok:!!(c.line||"").trim()&&c.line.length<=40,l:"Headline, up to 40 characters"});out.push({ok:(c.sub||"").length<=70,l:"Supporting line, up to 70 characters"})}
 if(f==="classified"){out.push({ok:!!(c.line||"").trim()&&c.line.length<=120,l:"One line, up to 120 characters"});out.push({ok:!c.link||/^https:\/\/\S+\.\S+/.test(c.link),l:"Link starts with https://"})}
 if(f==="video"){
  const urlOk=u=>/^https?:\/\/[^\s/.]+\.[^\s]{2,}$/i.test(normUrl(u));
  out.push({ok:urlOk(c.web),l:"Website, like yourcompany.com"});
  if((c.social||"").trim())out.push({ok:urlOk(c.social),l:`Social profile link (${socialName(c.social)})`});
  if((c.email||"").trim())out.push({ok:/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(c.email.trim()),l:"Email address, like hello@yourcompany.com"});
 }
 out.push({ok:!BANNED.test(txt),l:"No restricted claims such as guaranteed returns, cures or risk-free"});
 return out;
}
function suggestions(about){
 const w=(about||"").trim().replace(/[.!?]+$/,"").split(/\s+/).filter(Boolean);if(!w.length)return [];
 const cut=s=>s.length>32?s.slice(0,32).replace(/\s+\S*$/,""):s;
 return [...new Set([cut(w.slice(0,4).join(" ")),cut(w.slice(-4).join(" ")),cut(w.slice(0,3).join(" "))].filter(Boolean))];
}
const Bid={
 st:null,
 open(st){Bid.st=st;Sheet.open("",{label:st.gate?"Your account":"Bid for "+SPOTS[st.k].name,onClose:()=>{Rec.cancel();Bid.st=null}});Bid.render();Live.restoreDraft(st)},
 start(k,dates){
  if(dates&&dates.length===1&&myBid(dates[0],k)&&isOpenSpot(dates[0],k)){Bid.raise(dates[0],k);return}
  const ds=(dates&&dates.length?dates:[ADV.date]).filter(d=>AU.dates.includes(d)&&isOpenSpot(d,k)&&!myBid(d,k));
  const steps=["dates","bid","ad"];if(Live.on&&!Live.user)steps.push("signin","verify");if(!AU.acct)steps.push("acct");steps.push("review");
  Bid.open({k,steps,i:0,dates:new Set(ds),mode:SPOTS[k].fmt==="classified"?"exact":"auto",same:true,one:null,per:{},cre:AU.cre[k]?{...AU.cre[k]}:defCre(k),acct:AU.acct?{...AU.acct}:{name:"",email:"",country:"India",gstin:"",method:"upi"},agree:false,err:""});
 },
 raise(d,k){
  const my=myBid(d,k);if(!my||!isOpenSpot(d,k)){Bid.start(k,[d]);return}
  Bid.open({k,steps:["bid","review"],i:0,dates:new Set([d]),mode:my.mode,same:true,one:null,per:{},cre:{...my.cre},acct:AU.acct,raise:true,agree:false,err:""});
 },
 editAd(d,k){const my=myBid(d,k);if(!my)return;Bid.open({k,steps:["ad"],i:0,dates:new Set([d]),cre:{...my.cre},acct:AU.acct||{name:my.cre.adv},edit:true,err:""})},
 ds(){return AU.dates.filter(d=>Bid.st.dates.has(d))},
 minFor(d){
  const k=Bid.st.k, my=myBid(d,k);
  if(my&&k!=="cls"&&my.status==="leading")return Bid.st.mode==="auto"?my.max+SPOTS[k].inc:AU.s[K(d,k)].high+SPOTS[k].inc;
  if(my&&k==="cls"&&my.status==="in")return my.amt+1;
  return minBid(d,k);
 },
 amt(d){const v=Bid.st.same?Bid.st.one:Bid.st.per[d];return Math.round(+v)},
 /* credits this bid would set aside, net of what the same bids already hold */
 need(){const st=Bid.st,rate=gstRate(st.acct);return c2(Bid.ds().reduce((a,d)=>{const m=Bid.amt(d)||0,my=myBid(d,st.k);const nm=my&&st.k!=="cls"&&my.status==="leading"&&st.mode==="exact"?Math.max(my.max,m):m;return a+Math.max(0,nm*(1+rate)-(my?setAside(my,rate):0))},0))},
 sumHTML(){
  const st=Bid.st, ds=Bid.ds(), tot=ds.reduce((a,d)=>a+(Bid.amt(d)||0),0), rate=gstRate(st.acct), tax=tot*rate;
  const need=Bid.need(), av=availCredits();
  return `<b>Only winners pay.</b> The most you can spend is ${usd(tot)}${rate?` + ${usd2(tax)} GST`:""}${ds.length>1?` across ${ds.length} issues`:""}. We set this aside from your credits until bidding closes, then deduct only what you win. <span class="wb-inline${need>av?" short":""}">Wallet: ${usd2(av)} free${need>av?` · you'll need ${usd2(need-av)} more`:""}.</span>`;
 },
 collect(){
  const st=Bid.st, step=st.steps[st.i], q=id=>$(id)?.value??"";
  if(step==="bid"){if(st.same)st.one=q("b-one");else $$("[data-per]").forEach(i=>st.per[i.dataset.per]=i.value)}
  if(step==="signin")st.acct.email=q("b-email").trim();
  if(step==="acct")Object.assign(st.acct,{name:q("b-biz").trim(),email:q("b-email").trim(),country:q("b-country"),gstin:q("b-gst").trim(),method:(document.querySelector('input[name="pm"]:checked')||{}).value||"upi"});
  if(step==="review")st.agree=!!$("b-agree")?.checked;
 },
 validate(){
  const st=Bid.st, step=st.steps[st.i], ds=Bid.ds();
  if(step==="dates"&&!ds.length)return "Choose at least one issue.";
  if(step==="bid"||step==="review"){for(const d of ds){const a=Bid.amt(d),m=Bid.minFor(d);if(!(a>=m))return `${dayShort(d)}: the minimum is now ${usd(m)}. Raise your amount and try again.`}}
  if(step==="ad"){const bad=adChecks(st.k,st.cre).find(c=>!c.ok);if(bad)return `Fix this before you continue: ${bad.l.toLowerCase()}.`}
  if(step==="signin"&&!/^\S+@\S+\.\S+$/.test(st.acct.email))return "Add your work email, like you@company.com, or continue with Google.";
  if(step==="acct"){if(!st.acct.name)return "Add your business name.";if(!/^\S+@\S+\.\S+$/.test(st.acct.email))return "Add a work email, like you@company.com.";if(st.acct.country==="India"&&st.acct.gstin&&!/^[0-9A-Z]{15}$/.test(st.acct.gstin.toUpperCase()))return "A GSTIN has 15 letters and digits. Check it, or leave it blank.";}
  if(step==="review"&&!st.agree)return "Tick the box to confirm you understand bids are binding.";
  if(step==="review"){const sh=c2(Bid.need()-availCredits());if(sh>0)return `Add at least ${usd2(sh)} in credits to place ${ds.length>1?"these bids":"this bid"}.`}
  return "";
 },
 async next(){
  const st=Bid.st;Bid.collect();st.err=Bid.validate();if(st.err){Bid.render();return}
  const step=st.steps[st.i];
  if(Live.on&&(step==="acct"||step==="verify"||step==="signin")){
   const btn=$("sheet").querySelector("[data-next]");if(btn)btn.disabled=true;
   try{if(step==="signin")await Live.signinStep(st);else if(step==="acct")await Live.accountStep(st);else{await Live.verifyStep(st);await Live.afterSignIn(st);return}}catch(e){st.err=e.message||"Please try again.";Bid.render();return}
   if(st.gate&&st.i===st.steps.length-1){const after=st.gate;Sheet.close();after();return}
  }
  if(step==="review")return Bid.submit();
  if(step==="ad"&&st.edit)return Bid.saveAd();
  st.i++;Bid.render();
 },
 back(){const st=Bid.st;Bid.collect();st.err="";if(st.i>0)st.i--;Bid.render()},
 submit(){
  const st=Bid.st, cre={...st.cre,adv:st.acct.name};
  if(SPOTS[st.k].fmt==="video"&&!(cre.img&&!cre.file)){cre.script=cre.about?[cre.about,`${st.acct.name}.`]:[cre.thumb];cre.line=cre.about||cre.thumb;cre.sub=cre.who}
  if(SPOTS[st.k].fmt==="video"){cre.web=normUrl(cre.web);cre.social=normUrl(cre.social);cre.email=(cre.email||"").trim();cre.cta=hostOf(cre.web)}
  if(Live.on){Live.submit(st,cre);return}
  if(!AU.acct)AU.acct={...st.acct};AU.cre[st.k]={...st.cre};
  st.results=Bid.ds().map(d=>({d,...placeBid(d,st.k,{mode:st.mode,max:Bid.amt(d),cre})}));
  const fail=st.results.find(r=>!r.ok);
  if(fail&&st.results.every(r=>!r.ok)){st.err=fail.err;st.i=st.steps.indexOf(fail.credits?"review":"bid");Bid.render();return}
  st.steps=[...st.steps,"done"];st.i=st.steps.length-1;Bid.render();Adv.refresh(true);
 },
 saveAd(){
  const st=Bid.st,d=[...st.dates][0],my=myBid(d,st.k);
  if(my){const cre={...st.cre,adv:my.cre.adv};if(SPOTS[st.k].fmt==="video"&&!(cre.img&&!cre.file)){cre.script=cre.about?[cre.about,`${cre.adv}.`]:[cre.thumb];cre.line=cre.about||cre.thumb;cre.sub=cre.who}if(SPOTS[st.k].fmt==="video"){cre.web=normUrl(cre.web);cre.social=normUrl(cre.social);cre.email=(cre.email||"").trim();cre.cta=hostOf(cre.web)}if(Live.on){Live.saveAd(st,d,my,cre);return}my.cre=cre;my.review="pending";AU.cre[st.k]={...st.cre};scheduleReview(K(d,st.k))}
  Sheet.close();toast("Ad saved. It goes back through review, usually within minutes.");Adv.refresh(true);
 },
 onMarket(){
  const st=Bid.st;if(!st||$("sheetwrap").hidden)return;
  const step=st.steps[st.i];if(step!=="bid"&&step!=="review")return;
  Bid.ds().forEach(d=>{const el=$("sheet").querySelector(`[data-min-d="${d}"]`);if(el){const m=Bid.minFor(d);if(el.dataset.v!==String(m)){el.dataset.v=m;el.textContent=`min ${usd(m)}`;el.classList.add("bump");const n=$("b-live");if(n){n.hidden=false;n.textContent=`New bid on ${dayShort(d)}. The minimum is now ${usd(m)}.`}}}});
 },
 preview(){
  const st=Bid.st, f=SPOTS[st.k].fmt, c={...st.cre,adv:st.acct?.name||"Your company"};
  if(f==="video"){if(!(c.img&&!c.file)){c.thumb=c.thumb||"Your thumbnail text";c.script=c.about?[c.about]:[c.thumb]}return bvHTML("pv-bid",c,SPOTS[st.k].shape==="vert"?"vert":"std")+adLinks({...c,web:c.web&&normUrl(c.web),social:c.social&&normUrl(c.social)},"pv-links")}
  if(f==="creative")return `<div class="spot native in f-creative pvc"><div class="sp-media">${creMark({...c,mark:{...c.mark,init:initials(c.adv)}})}</div><div class="sp-txt"><div class="sp-meta"><span class="sp-l"><i></i>Sponsored</span></div><span class="sp-adv">${esc(c.adv)}</span><b class="sp-hl">${esc(c.line||"Your headline")}</b>${c.sub?`<span class="sp-line">${esc(c.sub)}</span>`:""}</div></div>`;
  return `<ol class="cls-list one"><li class="mine"><b>${usd(Bid.amt(Bid.ds()[0])||reserveFor("cls",Bid.ds()[0]||AU.dates[0]))}</b><span>${esc(c.line||"Your line goes here.")} <em>${esc(c.adv)}</em></span></li></ol>`;
 },
 render(){
  const st=Bid.st;if(!st)return;
  const step=st.steps[st.i], k=st.k, sp=SPOTS[k], ds=Bid.ds();
  const head=`<div class="sh-top"><div><span class="eyebrow">${st.gate?"Your account":`${esc(sp.name)} · ${FORMATS[sp.fmt].name}`}</span><h3>${st.edit?"Edit your ad":st.raise&&step==="bid"?"Raise your bid":STEP_T[step]}</h3></div><button type="button" class="chip-btn" data-x>Close</button></div>`
   +(st.steps.length>1&&step!=="done"?`<ol class="stepper">${st.steps.filter(s=>s!=="done").map((s,j)=>`<li class="${j<st.i?"done":j===st.i?"on":""}">${STEP_S[s]}</li>`).join("")}</ol>`:"");
  let body="",acts="";
  const back=st.i>0&&step!=="done"?`<button type="button" class="btn ghost" data-back>Back</button>`:"";
  if(step==="dates"){
   body=`<p class="hint">Each issue is its own auction. Pick as many as you like; you only pay for the issues you win.</p>
   <div class="dpick">${AU.dates.map(d=>{const open=isOpenSpot(d,k), mine=myBid(d,k), T=THEMES[wdOf(d)], hi=highOf(d,k);return `<label class="dp${open&&!mine?"":" dis"}" style="--th:${T.hue}"><input type="checkbox" data-pick="${d}"${st.dates.has(d)?" checked":""}${open&&!mine?"":" disabled"}><span class="dp-d"><b>${dayShort(d)}</b><em>${T.short}</em></span><span class="dp-v">${hi!=null?`Highest ${usd(hi)}`:`Reserve ${usd(reserveFor(k,d))}`}<small>${mine?"You're already bidding":`min ${usd(minBid(d,k))} · ${bidsOf(d,k)} bids`}</small></span></label>`}).join("")}</div>
   <div class="qchips"><button type="button" data-pickall>All open issues</button><button type="button" data-pickwk>Weekdays only</button><button type="button" data-pickone>Just the next one</button></div>`;
   acts=`<span class="sh-note">${ds.length} issue${ds.length===1?"":"s"} selected</span><button type="button" class="btn" data-next>Continue</button>`;
  }
  if(step==="bid"){
   const cls=sp.fmt==="classified", mins=Object.fromEntries(ds.map(d=>[d,Bid.minFor(d)])), maxMin=Math.max(...Object.values(mins));
   if(st.one==null||+st.one<maxMin&&!st.err)st.one=maxMin;
   const lab=cls||st.mode==="exact"?"Your bid":"Your maximum";
   body=(cls?`<p class="hint">Classifieds are pay-as-bid: your line runs if it's in the top 8 at close, and you pay exactly what you bid. Higher bids run earlier in the paper.</p>`
    :`<div class="seg" role="radiogroup" aria-label="How to bid"><button type="button" role="radio" aria-checked="${st.mode==="auto"}" data-mode="auto"><b>Auto-raise</b><small>Set a maximum. We bid for you, one step at a time, only when someone outbids you. You win at the lowest price that beats them.</small></button><button type="button" role="radio" aria-checked="${st.mode==="exact"}" data-mode="exact"><b>Exact bid</b><small>Bid one amount. If someone beats it, you'll need to raise it yourself.</small></button></div>`)
   +`<ul class="bidtbl">${ds.map(d=>`<li><span>${dayShort(d)}<small>${THEMES[wdOf(d)].short}</small></span><span>${highOf(d,k)!=null?`Highest ${usd(highOf(d,k))}`:"No bids yet"}</span><b data-min-d="${d}" data-v="${mins[d]}">min ${usd(mins[d])}</b></li>`).join("")}</ul>
   <p class="msg live" id="b-live" hidden></p>`
   +(ds.length>1?`<label class="chk"><input type="checkbox" id="b-same"${st.same?" checked":""}> Same ${lab.toLowerCase().replace("your ","")} for every issue</label>`:"")
   +(st.same?`<label class="fld" for="b-one">${lab} in USD<small>${ds.length>1?"for each issue · ":""}at least ${usd(maxMin)}</small><span class="money"><i>$</i><input id="b-one" type="number" inputmode="numeric" min="${maxMin}" step="${sp.inc}" value="${st.one}"></span></label><div class="qchips"><button type="button" data-q="0">Minimum</button><button type="button" data-q="${sp.inc*5}">+${usd(sp.inc*5)}</button><button type="button" data-q="${sp.inc*20}">+${usd(sp.inc*20)}</button></div>`
    :`<div class="perfld">${ds.map(d=>`<label class="fld">${dayShort(d)}<small>at least ${usd(mins[d])}</small><span class="money"><i>$</i><input type="number" inputmode="numeric" data-per="${d}" min="${mins[d]}" step="${sp.inc}" value="${st.per[d]??mins[d]}"></span></label>`).join("")}</div>`)
   +`<div class="paybox" id="b-sum">${Bid.sumHTML()}</div>`;
   acts=`${back}<button type="button" class="btn" data-next>Continue</button>`;
  }
  if(step==="ad"){
   const c=st.cre;let form="";
   if(sp.fmt==="video"){const still=!!c.img&&!c.file;form=`<p class="hint">Record yourself talking to camera, or upload a video or an image. Videos run up to 60 seconds; anything longer is cut at 60 s. ${sp.shape==="vert"?"Vertical (9:16) fits this spot.":"Horizontal (16:9) fits this spot best."} Uploading is free.</p>
    <div class="up"><button type="button" class="btn ghost sm" data-rec><i class="recdot" aria-hidden="true"></i>Record video</button><label class="btn ghost sm" for="b-file">Upload video or image</label><input id="b-file" type="file" accept="video/*,image/*" class="vh"><input id="b-cap" type="file" accept="video/*" capture="user" class="vh" tabindex="-1" aria-hidden="true"><span id="b-fname">${c.fname?esc(c.fname):"No file yet"}</span></div>
    <div class="rec" id="b-rec" hidden></div>
    ${trimHTML(c)}`
    +(still?`<label class="fld" for="b-line">Headline<small>shown beside your image and read aloud to screen readers</small><input id="b-line" maxlength="60" placeholder="Up to 60 characters" value="${esc(c.line)}"></label>
`
    :`<label class="fld" for="b-about">What is your video about?<input id="b-about" maxlength="80" placeholder="We help clinics book patients in one tap" value="${esc(c.about)}"></label>
    <div class="sugg-w"><small>Thumbnail text, generated from your title. Pick one or write your own.</small><div class="sugg" id="b-sugg"></div></div>
    <label class="fld" for="b-thumb">Thumbnail text<input id="b-thumb" maxlength="32" placeholder="Up to 32 characters" value="${esc(c.thumb)}"></label>
    <label class="fld" for="b-who">Name and role on screen<input id="b-who" maxlength="48" placeholder="Asha Rao, founder of Example" value="${esc(c.who)}"></label>`)+`    <fieldset class="links-f"><legend>Where people can reach you</legend>
     <label class="fld" for="b-web">Website<input id="b-web" type="url" inputmode="url" autocomplete="url" placeholder="yourcompany.com" value="${esc(c.web||"")}"></label>
     <label class="fld" for="b-social">Social profile <small>optional · LinkedIn, X, Instagram or YouTube</small><input id="b-social" type="url" inputmode="url" placeholder="linkedin.com/company/yourcompany" value="${esc(c.social||"")}"></label>
     <label class="fld" for="b-mail">Email <small>optional</small><input id="b-mail" type="email" inputmode="email" autocomplete="email" placeholder="hello@yourcompany.com" value="${esc(c.email||"")}"></label>
     <small class="lf-note">Shown as small links on your ad. Readers tap through to your site, profile or inbox.</small>
    </fieldset>`;}
   else if(sp.fmt==="creative")form=`<label class="fld" for="b-line">Headline<input id="b-line" maxlength="40" placeholder="Up to 40 characters" value="${esc(c.line)}"></label>
    <label class="fld" for="b-sub">Supporting line<input id="b-sub" maxlength="70" placeholder="Optional, up to 70 characters" value="${esc(c.sub)}"></label>
    <label class="fld" for="b-cta">Link text<input id="b-cta" maxlength="40" placeholder="yourcompany.com" value="${esc(c.cta)}"></label>
    <div class="sw-w"><small>Brand colours</small><div class="sw">${[["#1f3b5c","#f4efe4"],["#e9c84a","#1a1916"],["#1d3b2a","#e9f5ec"],["#7a2e22","#fbefe8"],["#e8e1d4","#2a2723"]].map(([b,f])=>`<button type="button" data-sw="${b},${f}" style="--ab:${b};--af:${f}" aria-label="Colour ${b}" aria-pressed="${c.mark.bg===b}">Aa</button>`).join("")}</div></div>`;
   else form=`<label class="fld" for="b-line">Your line<input id="b-line" maxlength="120" placeholder="Up to 120 characters" value="${esc(c.line)}"></label>
    <label class="fld" for="b-link">Link (optional)<input id="b-link" inputmode="url" placeholder="https://" value="${esc(c.link)}"></label>`;
   body=form+`<div class="pv"><small>Preview</small><div id="b-pv">${Bid.preview()}</div></div><ul class="checks" id="b-checks">${adChecks(k,c).map(x=>`<li class="${x.ok?"ok":"no"}">${esc(x.l)}</li>`).join("")}</ul><p class="hint">A person reviews every ad within 2 hours, always before 04:00 IST on issue day.</p>`;
   acts=`${back}<button type="button" class="btn" data-next>${st.edit?"Save ad":"Continue"}</button>`;
  }
  if(step==="acct"){
   const a=st.acct;
   body=`<p class="hint">You set this up once. Every advertiser is verified before their first ad runs, one account per business.</p>
   <label class="fld" for="b-biz">Business name<input id="b-biz" autocomplete="organization" value="${esc(a.name)}" placeholder="Shown on your ad and invoice"></label>
   <label class="fld" for="b-email">Work email<input id="b-email" type="email" autocomplete="email" value="${esc(a.email)}" placeholder="you@company.com"></label>
   <div class="row2"><label class="fld" for="b-country">Billing country<select id="b-country"><option${a.country==="India"?" selected":""}>India</option><option value="Other"${a.country!=="India"?" selected":""}>Another country</option></select></label>
   <label class="fld" for="b-gst">GSTIN <small>optional</small><input id="b-gst" value="${esc(a.gstin)}" placeholder="15 characters" maxlength="15"></label></div>
   <fieldset class="methods"><legend>Buy credits with</legend><label><input type="radio" name="pm" value="upi"${a.method!=="card"?" checked":""}> UPI <small>India</small></label><label><input type="radio" name="pm" value="card"${a.method==="card"?" checked":""}> Card <small>any country</small></label></fieldset>
   <div class="paybox"><b>How credits work.</b> You bid from prepaid credits in your wallet (1 credit = $1). A live bid sets aside its maximum plus tax. If you're outbid, those credits are free again at once. At 22:00 IST we deduct only what you win. Unused credits can be withdrawn any time.</div>
   ${Live.on?"":`<p class="hint">Prototype: no payment details are collected and no money moves.</p>`}`;
   acts=`${back}<button type="button" class="btn" data-next>Continue</button>`;
  }
  if(step==="review"){
   const cls=sp.fmt==="classified", rate=gstRate(st.acct), tot=ds.reduce((x,d)=>x+Bid.amt(d),0);
   const c=st.cre, adSum=sp.fmt==="video"?`"${esc(c.thumb)}" · ${c.fname?esc(c.fname):"sample presenter"}`:esc(c.line);
   body=`<dl class="kv"><dt>Spot</dt><dd>${esc(sp.name)}</dd><dt>Advertiser</dt><dd>${esc(st.acct?.name||"")}</dd><dt>Ad</dt><dd>${adSum}${st.raise?"":` <button type="button" class="linkbtn" data-goto-step="ad">Edit</button>`}</dd>${sp.fmt==="video"?`<dt>Links</dt><dd>${[c.web&&hostOf(c.web),c.social&&socialName(c.social),c.email].filter(Boolean).map(esc).join(" · ")||"None"} <button type="button" class="linkbtn" data-goto-step="ad">Edit</button></dd>`:""}<dt>How</dt><dd>${cls?"Pay-as-bid":st.mode==="auto"?"Auto-raise up to your maximum":"Exact bid"} <button type="button" class="linkbtn" data-goto-step="bid">Change</button></dd></dl>
   <div class="tblw"><table class="rvtbl"><thead><tr><th>Issue</th><th>Highest now</th><th>${cls||st.mode==="exact"?"Your bid":"Your max"}</th><th>Price if it closed now</th></tr></thead><tbody>${ds.map(d=>{const a=Bid.amt(d),m=Bid.minFor(d),now_=cls||st.mode==="exact"?a:Math.max(m,Math.min(a,m));return `<tr><td>${dayShort(d)}</td><td>${highOf(d,k)!=null?usd(highOf(d,k)):"None"}</td><td>${usd(a)}</td><td>${usd(st.raise&&st.mode==="auto"?myBid(d,k).amt:now_)}</td></tr>`}).join("")}</tbody></table></div>
   ${walletBox(Bid.need(),ds.length,rate)}
   <label class="chk agree"><input type="checkbox" id="b-agree"${st.agree?" checked":""}> I understand bids can be raised but not lowered or withdrawn, and credits are only deducted for bids I win.</label>`;
   acts=`${back}<button type="button" class="btn" data-next>${st.raise?"Confirm":"Place "+(ds.length>1?ds.length+" bids":"bid")} · up to ${usd(tot)}</button>`;
  }
  if(step==="signin"){
   body=st.waiting?`<p class="hint">Finish signing in with Google in the window that opened. This sheet carries on by itself.</p>`
   :`<p class="hint">Only advertisers sign in. Readers never need an account.</p>
   <button type="button" class="btn ghost g-btn" data-google>${GOOGLE_G}Continue with Google</button>
   <p class="or-rule"><span>or get a code by email</span></p>
   <label class="fld" for="b-email">Work email<input id="b-email" type="email" autocomplete="email" value="${esc(st.acct.email)}" placeholder="you@company.com"></label>`;
   acts=st.waiting?`<button type="button" class="btn ghost" data-google-cancel>Cancel</button>`:`${back}<button type="button" class="btn" data-next>Email me a code</button>`;
  }
  if(step==="verify"){
   body=`<p class="hint">We sent a code to <b>${esc(st.acct.email)}</b>. Enter it here to confirm it's you.</p><label class="fld" for="b-code">Code from your email<input id="b-code" inputmode="numeric" autocomplete="one-time-code" maxlength="10"></label><p class="hint"><button type="button" class="linkbtn" data-resend>Send a new code</button></p>`;
   acts=`${back}<button type="button" class="btn" data-next>Continue</button>`;
  }
  if(step==="done"){
   const rs=st.results||[];
   body=`<div class="okmark" aria-hidden="true">✓</div><p class="done-h">${rs.filter(r=>r.ok).length===rs.length?(st.raise?"Your bid is updated.":"You're in the auction."):"Some bids didn't go through."}</p>
   <ul class="mb-rows compact">${rs.map(r=>{const e=myBid(r.d,k);return `<li><div class="mb-spot"><b>${dayShort(r.d)}</b><small>${r.ok&&e?(e.mode==="auto"?`Price ${usd(e.amt)} · max ${usd(e.max)}`:`Bid ${usd(e.amt)}`):esc(r.err)}</small></div><div class="mb-st">${r.ok&&e?statusPill(e):`<span class="pill out">Not placed</span>`}</div></li>`}).join("")}</ul>
   <p class="hint">We'll tell you here the moment you're outbid. Bidding for the ${dayShort(ds[0])} issue closes ${closeText(ds[0],k)}.</p>${st.sending?`<p class="hint" id="b-up" role="status">Uploading your ad…</p>`:""}`;
   acts=`<button type="button" class="btn ghost" data-atab="mine">Track in My bids</button><button type="button" class="btn" data-x>Done</button>`;
  }
  Sheet.set(head+`<div class="sh-body">${body}</div>${st.err?`<p class="msg" role="alert">${esc(st.err)}</p>`:""}<div class="sh-acts">${acts}</div>`);
  Bid.bind(step);
 },
 bind(step){
  const st=Bid.st, sh=$("sheet");
  if(step==="bid"){
   const upd=()=>{Bid.collect();$("b-sum").innerHTML=Bid.sumHTML()};
   $$("input[type=number]",sh).forEach(i=>i.addEventListener("input",upd));
   $("b-same")?.addEventListener("change",e=>{Bid.collect();st.same=e.target.checked;Bid.render()});
   (st.same?$("b-one"):sh.querySelector("[data-per]"))?.focus({preventScroll:true});
  }
  if(step==="ad"){
   const c=st.cre, pv=()=>{stopAds();$("b-pv").innerHTML=Bid.preview();$("b-checks").innerHTML=adChecks(st.k,c).map(x=>`<li class="${x.ok?"ok":"no"}">${esc(x.l)}</li>`).join("")};
   const sug=()=>{const s=suggestions(c.about),el=$("b-sugg");if(el)el.innerHTML=s.length?s.map(x=>`<button type="button" data-sg="${esc(x)}">${esc(x)}</button>`).join(""):`<em>Type what your video is about to get suggestions.</em>`};
   const on=(id,key,extra)=>$(id)?.addEventListener("input",e=>{c[key]=e.target.value;extra&&extra();pv()});
   on("b-about","about",sug);on("b-thumb","thumb");on("b-who","who");on("b-line","line");on("b-sub","sub");on("b-cta","cta");on("b-link","link");on("b-web","web");on("b-social","social");on("b-mail","email");sug();
   const take=f=>{if(!f)return;
    const isV=/^video\//.test(f.type), isI=/^image\//.test(f.type);
    if(!isV&&!isI){st.err="That file isn't a video or an image. Choose an MP4, MOV, WebM, JPG, PNG or WebP file.";Bid.render();return}
    if(isI&&f.size>10*1024*1024){st.err="That image is over 10 MB. Export it smaller and try again.";Bid.render();return}
    if(isV&&f.size>500*1024*1024){st.err="That video is over 500 MB. Export it at a lower quality and try again.";Bid.render();return}
    [c.file,c.img].forEach(u=>u&&URL.revokeObjectURL(u));const u=URL.createObjectURL(f);c.fname=f.name;c.trimStart=0;c.blob=f;delete c.adId;delete c.mux;st.err="";
    if(isI){c.img=u;c.file=null;c.dur=0;c.len=0;Bid.render();return}
    c.file=u;c.img=null;const v=document.createElement("video");v.preload="metadata";
    v.onloadedmetadata=async()=>{const d=isFinite(v.duration)?v.duration:0;c.dur=Math.round(d);c.len=Math.max(1,Math.min(60,c.dur||30));
     const lib=d?await Live.client().catch(()=>null):null,bad=lib&&lib.importedRecordingIssue({size:f.size,type:f.type,name:f.name,duration:d,width:v.videoWidth,height:v.videoHeight});
     if(bad){URL.revokeObjectURL(u);c.file=null;c.blob=null;c.fname="";c.dur=0;st.err=bad}
     Bid.render()};
    v.onerror=()=>{c.dur=0;c.len=30;Bid.render()};v.src=u;};
   $("b-file")?.addEventListener("change",e=>take(e.target.files[0]));
   $("b-cap")?.addEventListener("change",e=>take(e.target.files[0]));
   $("b-trim")?.addEventListener("input",e=>{c.trimStart=+e.target.value;$("b-trim-o").textContent=`${fmt(c.trimStart)} → ${fmt(c.trimStart+60)}`;stopAds();pv()});
   sh.querySelector("input:not(.vh)")?.focus({preventScroll:true});
  }
 },
 click(e){
  if(!Bid.st||!e.target.closest("#sheet"))return false;
  const t=e.target, st=Bid.st;
  if(t.closest("[data-google]")){Live.google();return true}
  if(t.closest("[data-google-cancel]")){Live.cancelGoogle();return true}
  if(t.closest("[data-resend]")){Live.client().then(l=>l.sendCode(st.acct.email)).then(()=>toast("A new code is on its way."),e=>toast(e.message));return true}
  if(t.closest("[data-rec]")){Rec.start();return true}
  if(t.closest("[data-rec-stop]")){Rec.stop();return true}
  if(t.closest("[data-rec-cancel]")){Rec.cancel();return true}
  if(t.closest("[data-next]")){Rec.cancel();Bid.next();return true}
  if(t.closest("[data-back]")){Bid.back();return true}
  const gs=t.closest("[data-goto-step]");if(gs){Bid.collect();const j=st.steps.indexOf(gs.dataset.gotoStep);if(j>=0){st.i=j;st.err="";Bid.render()}else if(gs.dataset.gotoStep==="ad"){st.steps.splice(st.i,0,"ad");st.err="";Bid.render()}return true}
  const pk=t.closest("[data-pick]");if(pk){const d=pk.dataset.pick;if(pk.checked)st.dates.add(d);else st.dates.delete(d);st.err="";Bid.render();return true}
  const openFree=d=>isOpenSpot(d,st.k)&&!myBid(d,st.k);
  if(t.closest("[data-pickall]")){st.dates=new Set(AU.dates.filter(openFree));Bid.render();return true}
  if(t.closest("[data-pickwk]")){st.dates=new Set(AU.dates.filter(d=>openFree(d)&&wdOf(d)>0&&wdOf(d)<6));Bid.render();return true}
  if(t.closest("[data-pickone]")){const d=AU.dates.find(openFree);st.dates=new Set(d?[d]:[]);Bid.render();return true}
  const md=t.closest("[data-mode]");if(md){Bid.collect();st.mode=md.dataset.mode;st.one=null;st.per={};Bid.render();return true}
  const q=t.closest("[data-q]");if(q){const ds=Bid.ds();st.one=Math.max(...ds.map(d=>Bid.minFor(d)))+(+q.dataset.q);$("b-one").value=st.one;$("b-sum").innerHTML=Bid.sumHTML();return true}
  const sg=t.closest("[data-sg]");if(sg){st.cre.thumb=sg.dataset.sg;$("b-thumb").value=st.cre.thumb;$("b-thumb").dispatchEvent(new Event("input"));return true}
  const sw=t.closest("[data-sw]");if(sw){const[b,f]=sw.dataset.sw.split(",");st.cre.mark={bg:b,fg:f};$$("[data-sw]",$("sheet")).forEach(x=>x.setAttribute("aria-pressed",String(x===sw)));$("b-pv").innerHTML=Bid.preview();return true}
  return false;
 }
};


/* =========================================================
   Wallet: prepaid credits for bidding
   ========================================================= */
const PACKS=[500,1000,2500,5000];
function packsFor(short){const up=Math.ceil(short/10)*10, ps=PACKS.filter(p=>p>up).slice(0,2);return [up,...ps]}
function walletBox(need,n,rate){
 const av=availCredits(), short=c2(need-av), m=Bid.st?.acct?.method||AU.acct?.method||"upi";
 return `<div class="wbox${short>0?" short":""}">
  <div class="wb-rows"><div><small>Free in your wallet</small><b>${usd2(av)}</b></div><div><small>${n>1?"These bids set":"This bid sets"} aside</small><b>${usd2(need)}</b></div><div><small>Left after</small><b>${short>0?"—":usd2(av-need)}</b></div></div>
  ${short>0?`<p class="wb-msg">Add at least <b>${usd2(short)}</b> in credits${rate?" (bids are set aside with 18% GST)":""}.</p><div class="wb-packs">${packsFor(short).map((a,i)=>`<button type="button" class="${i?"chip-btn":"btn sm"}" data-topup="${a}">Add ${usd(a)}</button>`).join("")}</div><small class="wb-pay">Paid by ${m==="card"?"card":"UPI"} · 1 credit = $1 · unused credits can be withdrawn</small>`
  :`<p class="wb-msg ok">Covered by your credits. They're set aside until close: deducted only if you win, free again the moment you're outbid.</p>`}
 </div>`;
}
const Wallet={
 open(){if(Live.on&&(!Live.user||!AU.acct)){Live.gate(()=>Wallet.open());return}Sheet.open(Wallet.html(),{label:"Wallet"})},
 render(){if(!$("sheetwrap").hidden&&$("sheet").querySelector(".wallet"))Sheet.set(Wallet.html())},
 html(){
  const w=AU.wallet, held=heldTotal(), av=availCredits(), m=AU.acct?.method||"upi", nLive=myOpen().filter(e=>setAside(e)>0).length;
  return `<div class="sh-top"><div><span class="eyebrow">Bought. credits</span><h3>Your wallet</h3></div><button type="button" class="chip-btn" data-x>Close</button></div>
  <div class="sh-body wallet">
   <div class="w-kpis"><div><small>Balance</small><b>${usd2(w.bal)}</b></div><div><small>Set aside</small><b>${usd2(held)}</b><span>${nLive} live bid${nLive===1?"":"s"}</span></div><div class="on"><small>Free to bid</small><b>${usd2(av)}</b></div></div>
   <div class="w-add"><b>Add credits</b>
    <div class="wb-packs">${PACKS.map(a=>`<button type="button" class="chip-btn" data-topup="${a}">+${usd(a)}</button>`).join("")}</div>
    <div class="w-custom"><span class="money"><i>$</i><input id="w-amt" type="number" inputmode="numeric" min="50" step="50" placeholder="Other amount"></span><button type="button" class="btn sm" data-topup="custom">Add</button></div>
    <fieldset class="methods"><legend>Pay with</legend><label><input type="radio" name="wpm" value="upi"${m!=="card"?" checked":""}> UPI <small>India</small></label><label><input type="radio" name="wpm" value="card"${m==="card"?" checked":""}> Card <small>any country</small></label></fieldset>
    <p class="hint">1 credit = $1; in India you pay in rupees at the day's rate. Minimum top-up $50. Credits never expire.</p></div>
   <div class="w-tx"><b>Activity</b>${w.tx.length?`<ul>${w.tx.map(x=>`<li><span>${esc(x.label)}<small>${dayShort(istISO(x.t))}, ${timeIST(x.t)} IST</small></span><b class="${x.amt<0?"neg":"pos"}">${x.amt<0?"−":"+"}${usd2(Math.abs(x.amt))}</b></li>`).join("")}</ul>`:`<p class="hint">No activity yet. Add credits to start bidding.</p>`}</div>
   ${Live.on?"":`<p class="hint">Prototype: no payment details are collected and no money moves.</p>`}
  </div>
  <div class="sh-acts">${av>0?`<button type="button" class="btn ghost" data-withdraw>Withdraw ${usd2(av)}</button>`:""}<button type="button" class="btn" data-x autofocus>Done</button></div>`;
 },
 topup(btn){
  let amt=btn.dataset.topup;
  if(amt==="custom"){amt=Math.round(+($("w-amt")?.value||0));if(!(amt>=50)){toast("Enter at least $50.");return}}else amt=+amt;
  const method=(document.querySelector('input[name="wpm"]:checked')||{}).value||Bid.st?.acct?.method||AU.acct?.method||"upi";
  btn.disabled=true;btn.textContent="Adding…";
  if(Live.on){Live.topup(btn,amt,method);return}
  setTimeout(()=>{addCredits(amt,method);if(Bid.st){Bid.st.err="";Bid.render()}else Wallet.render();Adv.refresh(true);toast(`${usd(amt)} in credits added to your wallet.`)},reduce?0:800);
 }
};


/* =========================================================
   Video for display ads: record in the browser (or the phone camera), upload, and the 60-second cut
   ========================================================= */
function trimHTML(c){
 if(!c.file||!c.dur)return "";
 if(c.dur<=60)return `<p class="trim ok">Video length ${fmt(c.dur)}. It fits the 60-second limit.</p>`;
 const s=Math.min(c.trimStart||0,c.dur-60);
 return `<div class="trim"><b>Your video is ${fmt(c.dur)}. Only 60 seconds run.</b><label for="b-trim">Choose the minute that runs: <output id="b-trim-o">${fmt(s)} → ${fmt(s+60)}</output></label><input type="range" id="b-trim" min="0" max="${Math.floor(c.dur-60)}" step="1" value="${s}"><small>Everything outside this window is cut. Change it any time before 04:00 IST on issue day.</small></div>`;
}
const Rec={stream:null,mr:null,t0:0,timer:0,chunks:[],cancelled:false,
 async start(){
  const st=Bid.st;if(!st)return;
  if(matchMedia("(pointer:coarse)").matches&&$("b-cap")){$("b-cap").click();return} /* phones: the camera app records */
  const box=$("b-rec");
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){Rec.fail();return}
  const lib=await Live.client().catch(()=>null), set=lib?lib.cameraSettings():null;
  try{Rec.stream=await navigator.mediaDevices.getUserMedia(set?set.constraints:{video:{width:{ideal:1280},height:{ideal:720}},audio:true})}catch(e){Rec.fail();return}
  if(!Bid.st){Rec.release();return}
  box.hidden=false;box.innerHTML=`<video id="rec-v" muted playsinline autoplay></video><div class="rec-bar"><span class="rec-live"><i></i>Recording <b id="rec-t">0:00</b> / 1:00</span><button type="button" class="btn sm" data-rec-stop>Stop</button><button type="button" class="chip-btn" data-rec-cancel>Cancel</button></div><div class="rec-meter"><i id="rec-m"></i></div><p class="hint" id="rec-hint" role="status" hidden></p>`;
  $("rec-v").srcObject=Rec.stream;Rec.chunks=[];Rec.cancelled=false;
  try{Rec.mr=lib?lib.recorderFor(Rec.stream,set.profile.cameraBitsPerSecond):new MediaRecorder(Rec.stream)}catch(e){Rec.release();Rec.fail();return}
  if(lib){Rec.unhold=lib.holdScreen();
   Rec.unwatch=lib.watchTake($("rec-v"),Rec.stream,({face,sound})=>{const h=$("rec-hint");if(!h)return;const msg=Date.now()-Rec.t0<3000?"":face===false?"We can't see your face. Stay in the frame.":!sound?"We can't hear you. Check your microphone.":"";h.hidden=!msg;h.textContent=msg},set.profile.faceSampleMs)}
  Rec.mr.ondataavailable=e=>{if(e.data&&e.data.size)Rec.chunks.push(e.data)};
  Rec.mr.onstop=()=>{const elapsed=Date.now()-Rec.t0,secs=Math.max(1,Math.min(60,Math.round(elapsed/1000))), type=Rec.mr.mimeType||"video/webm";Rec.release();
   if(Rec.cancelled||!Bid.st){Rec.cancelled=false;return}
   const c=Bid.st.cre;[c.file,c.img].forEach(u=>u&&URL.revokeObjectURL(u));
   const blob=new Blob(Rec.chunks,{type});
   if(lib&&!lib.validRecordedTake(blob.size,elapsed)){Bid.st.err="That take was too short to use. Record again.";Bid.render();return}
   c.file=URL.createObjectURL(blob);c.blob=blob;delete c.adId;delete c.mux;c.img=null;c.dur=secs;c.len=secs;c.trimStart=0;c.fname=`Recording · ${fmt(secs)}`;Bid.st.err="";Bid.render();Live.saveDraft(Bid.st.k,c,blob)};
  Rec.t0=Date.now();Rec.mr.start(250);
  Rec.timer=setInterval(()=>{const s=(Date.now()-Rec.t0)/1000,t=$("rec-t"),m=$("rec-m");if(t)t.textContent=fmt(Math.min(60,Math.floor(s)));if(m)m.style.width=Math.min(100,s/60*100)+"%";if(s>=60)Rec.stop()},200); /* recording stops itself at 60 s */
 },
 stop(){clearInterval(Rec.timer);if(Rec.mr&&Rec.mr.state!=="inactive")Rec.mr.stop();else Rec.release()},
 cancel(){if(!Rec.stream&&!(Rec.mr&&Rec.mr.state!=="inactive"))return;Rec.cancelled=true;Rec.stop();const b=$("b-rec");if(b){b.hidden=true;b.innerHTML=""}},
 release(){clearInterval(Rec.timer);Rec.unhold?.();Rec.unwatch?.();Rec.unhold=Rec.unwatch=null;if(Rec.stream)Rec.stream.getTracks().forEach(t=>t.stop());Rec.stream=null},
 fail(){const b=$("b-rec");if(b){b.hidden=false;b.innerHTML=`<p class="hint">The camera isn't available here: it may be blocked in this browser or in an embedded view. Upload a video instead, or open Bought. on your phone and tap Record video.</p>`}}
};
