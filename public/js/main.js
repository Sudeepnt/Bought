/* Bought. Daily — boot + global events */

VIEW_HOOKS.paper={enter(){Vids.wake();Motion.scan($("v-paper"));Pager.i=-1;requestAnimationFrame(()=>Pager.spy())},leave(){Vids.stop();stopAds();Reader.close()}};

/* one click handler for the whole app */
document.addEventListener("click",e=>{
 const t=e.target;
 if(t.closest("#themebtn")){Theme.toggle();return}
 const g=t.closest("[data-go]");if(g){e.preventDefault();Sheet.close();Reader.close();Ov.close();go(g.dataset.go);return}
 const ed=t.closest("[data-edition]");if(ed){Theme.edition(+ed.dataset.edition);Paper.render();Spec.render();toast(`Previewing ${EDITION.name}. Only the edition name and accent change.`);return}
 if(t.closest("[data-x]")){Sheet.close();return}
 if(t.closest("#rdx")){Reader.close();return}
 if(t.closest("#ovx")){Ov.close();return}
 const as=t.closest("[data-adv-spot]");if(as){e.preventDefault();Ov.close();Reader.close();Adv.openSpot(as.dataset.advSpot);return}
 const pgo=t.closest("[data-page-go]");if(pgo){e.preventDefault();const n=+pgo.dataset.pageGo;if(VIEW!=="paper"){go("paper");setTimeout(()=>Pager.show(n),60)}else Pager.show(n);return}
 const trn=t.closest("[data-turn]");if(trn){e.preventDefault();trn.dataset.turn==="prev"?Pager.prev():Pager.next();return}
 if(Issue.click(e))return;
 if(Discuss.click(e))return;
 if(Adv.click(e))return;
 if(Paper.click(e))return;
});
$("sheetwrap").addEventListener("click",e=>{if(e.target===$("sheetwrap"))Sheet.close()});
$("ov").addEventListener("click",e=>{if(e.target===$("ov"))Ov.close()});
$("rdscrim").addEventListener("click",()=>Reader.close());
document.addEventListener("keydown",e=>{
 if(e.key==="Escape"){if(!$("sheetwrap").hidden)Sheet.close();else if(!$("ov").hidden)Ov.close();else Reader.close();return}
 const el=e.target.closest&&e.target.closest(".vid,.bv");
 if(el&&(e.key==="Enter"||e.key===" ")){e.preventDefault();el.click();return}
 if(Reader.key(e))return;
 if(VIEW==="paper"&&READER_ID===null&&$("sheetwrap").hidden&&$("ov").hidden&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)&&!e.metaKey&&!e.ctrlKey&&!e.altKey){
  if(e.key==="ArrowRight"){e.preventDefault();Pager.next()}else if(e.key==="ArrowLeft"){e.preventDefault();Pager.prev()}
 }
});
$("subform").addEventListener("submit",async e=>{e.preventDefault();const v=$("email").value.trim(),t=$("toast-sub");t.hidden=false;
 if(!/^\S+@\S+\.\S+$/.test(v)){t.textContent="Enter a full email address, like you@company.com.";return}
 t.textContent="Signing you up…";
 try{const r=await fetch("api/subscribe",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:v})}),d=await r.json();t.textContent=d.message||d.error||"Couldn't sign you up. Please try again."}
 catch{t.textContent="Couldn't sign you up right now. Please try again later."}
});
document.addEventListener("visibilitychange",()=>{if(document.hidden)Vids.stop();else if(READER_ID===null&&VIEW==="paper")Vids.wake()});
addEventListener("resize",()=>{Toasts.place();clearTimeout(window._bal);window._bal=setTimeout(()=>Paper.balance(),150)},{passive:true});

/* every second: countdowns + auto-settle */
function tickCountdowns(){$$(".cdx[data-until]").forEach(el=>{el.textContent=hms(+el.dataset.until-now())})}
setInterval(()=>{tickCountdowns();tickAuction()},1000);

$("lang").addEventListener("change",e=>Data.setLang(e.target.value));

/* boot: the newest published issue, or the one a shared link names (#s-<date>-<story id>) */
(async()=>{
 const h=location.hash.slice(1), link=h.match(/^s-(\d{4}-\d{2}-\d{2})-(\w+)$/);
 Theme.paint();
 if(!await Live.boot())initAuction();ADV.date=AU.dates[0];
 await Data.boot(link&&link[1]);
 Theme.edition(wdOf(ISSUE_DAY));document.body.classList.toggle("archive",!!LATEST&&ISSUE_DAY!==LATEST);
 Paper.render();Radio.init();Spec.render();
 Motion.init();Shell.init();Pager.init();
 go(link?"paper":VIEWS.includes(h)?h:h==="listen"?"radio":store.get("bought-view","paper"));
 BOOTED=true;Stats.visit(VIEW);
 if(link){const s=S.find(x=>x.uid===link[2]);if(s)Reader.open(s.id)}
 if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>Paper.balance());
 tickCountdowns();
})();
