/* Bought. Daily: tells our own server what readers do, for the desk's dashboard. No cookie, no id, nothing sent elsewhere.
   The server counts a visitor once a day by a hash it forgets the day after (pipeline/analytics.py). This page keeps only
   the date of its first visit, to say whether a visit is a new reader. */
const Stats={
 sent:new Set(),open:null,
 send(k,o={}){
  const b=JSON.stringify({k,i:ISSUE_DAY||"",...o});
  try{if(!(navigator.sendBeacon&&navigator.sendBeacon("api/hit",new Blob([b],{type:"text/plain"}))))fetch("api/hit",{method:"POST",body:b,keepalive:true}).catch(()=>{})}catch{}
 },
 once(key,k,o){if(Stats.sent.has(key))return;Stats.sent.add(key);Stats.send(k,o)},
 visit(view){
  const first=store.get("bought-first",null);if(!first)store.set("bought-first",new Date().toISOString().slice(0,10));
  let zone="";try{zone=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch{}
  Stats.send("visit",{n:!first,v:view,l:LANG,r:document.referrer||"",z:zone});
 },
 /* time on a story: from opening it to closing it (or leaving the tab) */
 start(id){Stats.stop();const s=S[id];if(!s||!s.uid)return;Stats.open={uid:s.uid,t:Date.now()};Stats.send("read",{s:s.uid})},
 stop(){const o=Stats.open;if(!o)return;Stats.open=null;const d=Math.round((Date.now()-o.t)/1000);if(d>=1)Stats.send("time",{s:o.uid,d})}
};
(()=>{
 const open=Reader.open,close=Reader.close;
 Reader.open=function(id){Stats.start(id);return open.apply(this,arguments)};
 Reader.close=function(){Stats.stop();return close.apply(this,arguments)};
 const goTo=go;
 go=function(v){if(typeof BOOTED!=="undefined"&&BOOTED&&VIEW!==v)Stats.once("view:"+v,"view",{v});return goTo.apply(this,arguments)};
 document.addEventListener("visibilitychange",()=>{if(document.hidden)Stats.stop();else if(READER_ID!==null&&S[READER_ID])Stats.open={uid:S[READER_ID].uid,t:Date.now()}});
 addEventListener("pagehide",()=>Stats.stop());
 document.addEventListener("play",e=>{if(Radio.audio&&e.target===Radio.audio)Stats.once("listen:"+ISSUE_DAY,"listen")},true);
 document.addEventListener("click",e=>{
  const sh=e.target.closest("[data-share]");if(sh){const s=S[+sh.dataset.share];if(s&&s.uid)Stats.send("share",{s:s.uid});return}
  const src=e.target.closest("#reader .rd-acts a");if(src&&READER_ID!==null&&S[READER_ID])Stats.send("source",{s:S[READER_ID].uid});
 },true);
})();
