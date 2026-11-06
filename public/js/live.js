/* Bought. Daily: connects the Advertise page to the backend (backend/, Bought's Mux, Supabase and payments code).
   Until every key is set, /api/bought/config says live:false and auction.js keeps its local simulation.
   When live, the server owns every number: this file only mirrors its market into AU and sends the page's buttons to it. */
const Live={on:false,user:false,lib:null,cfg:null,local:{},seen:store.get("bought-notice-seen",0),polls:0,
 client(){return Live.lib||(Live.lib=import("./live/client.js?v=12"))},
 async boot(){
  let cfg=null;
  try{const c=new AbortController(),tm=setTimeout(()=>c.abort(),2500);const r=await fetch("api/bought/config",{signal:c.signal,cache:"no-store"});clearTimeout(tm);if(r.ok)cfg=await r.json()}catch{}
  if(!cfg||!cfg.live)return false;
  Live.cfg=cfg;Live.on=true;
  try{
   const lib=await Live.client();await lib.connect(cfg.supabaseUrl,cfg.supabaseKey);
   Live.user=await lib.signedIn();await Live.sync();
  }catch{Live.emptyDates()}
  if(!AU.dates.length)Live.emptyDates();
  setInterval(Live.poll,5000);
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)Live.poll(true)});
  document.addEventListener("click",e=>{const a=e.target.closest?.('a[rel~="sponsored"]');if(a)Live.count(a.closest("[data-spot]")?.dataset.spot,"click")},true);
  Live.resume();
  return true;
 },
 /* the market could not be read: show the next issues with nothing on them, never made-up bids */
 emptyDates(){
  let d=TODAY;while(closeAt(d)<=now())d=addDays(d,1);
  for(let i=0;i<7;i++){const x=addDays(d,i);AU.dates.push(x);AU.cls[x]={list:[],close:closeAt(x),ext:0};
   SPOT_ORDER.filter(k=>k!=="cls").forEach(k=>{AU.s[K(x,k)]={high:0,n:0,hist:[],close:closeAt(x),ext:0,leader:null}})}
 },
 poll(force){
  if(!Live.on||document.hidden||navigator.onLine===false)return;
  Live.polls++;
  if(force===true||VIEW==="advertise"||(Live.user&&Live.polls%3===0))Live.sync().then(()=>{Adv.refresh();Wallet.render()}).catch(()=>{});
 },
 async sync(){const lib=await Live.client();Live.user=await lib.signedIn();Live.apply(await lib.api("ads/market"))},
 /* the server counts points in hundredths; the page counts whole points */
 cre(raw,adv){
  if(!raw)return {adv};
  const c={...raw,adv:adv||raw.adv,adId:raw.id},local=Live.local[raw.id];
  if(raw.kind==="image"&&raw.signedImage)c.img=raw.signedImage;
  if(raw.kind==="video"&&raw.signedImage)c.poster=raw.signedImage;
  if(!c.mux)delete c.mux;
  return local?{...c,...local}:c;
 },
 apply(m){
  CLOCK_OFFSET=Date.parse(m.serverNow)-Date.now();
  const t=x=>x?Date.parse(x):0,h=x=>({h:x.h,amt:x.amt/100,t:t(x.t),me:!!x.me});
  AU.dates=m.dates.slice();AU.s={};AU.cls={};
  for(const[key,x]of Object.entries(m.spots))AU.s[key]={high:x.high/100,n:x.n,hist:x.hist.map(h),close:t(x.close),ext:x.ext,leader:x.leader};
  for(const[d,x]of Object.entries(m.cls))AU.cls[d]={list:x.list.map(h),close:t(x.close),ext:x.ext};
  AU.feed=m.feed.map(f=>({kind:f.kind,d:f.d,k:f.k,amt:f.amt==null?null:f.amt/100,t:t(f.t),until:t(f.until),me:!!f.me,h:f.h}));
  if(!ADV.date||!AU.dates.includes(ADV.date))ADV.date=AU.dates[0];
  const me=m.me;
  if(!me){AU.acct=null;AU.my={};AU.past=[];AU.inbox=[];AU.wallet={bal:0,tx:[]};return}
  AU.acct=me.acct?{...me.acct,gstin:me.acct.gstin||""}:null;
  const adv=AU.acct?.name;
  AU.wallet={bal:me.balance/100,free:(me.free||0)/100,tx:me.tx.map(x=>({t:t(x.t),kind:x.kind,amt:x.amt/100,label:x.label,bal:x.bal/100}))};
  AU.my={};
  me.my.forEach(b=>{const e={d:b.d,k:b.k,amt:b.amt/100,max:b.max/100,mode:b.mode,status:b.status,placed:t(b.placed),adState:b.adState,adReason:b.adReason,cre:Live.cre(b.cre,adv)};
   if(b.k==="cls"){e.ref=AU.cls[b.d]?.list.find(x=>x.me);e.rank=e.ref?clsRank(b.d,e.ref):0}
   AU.my[K(b.d,b.k)]=e});
  AU.past=me.past.map(p=>({...p,issue:issueNo(p.d),final:p.final/100,price:p.price/100,amt:p.amt/100,gst:p.gst/100,total:p.total/100,settledAt:t(p.settledAt),cre:Live.cre(p.cre,adv),
   report:p.report?{views:+p.report.views,plays:+p.report.plays,clicks:+p.report.clicks,watch:0}:undefined}));
  AU.inbox=me.notices.map(n=>({msg:n.msg,t:t(n.t),kind:n.kind}));
  const fresh=me.notices.filter(n=>n.id>Live.seen).reverse();
  if(me.notices.length){const top=me.notices[0].id;if(top>Live.seen){const first=!store.get("bought-notice-seen",0);Live.seen=top;store.set("bought-notice-seen",top);if(first)return}}
  const onScreen=VIEW==="advertise"&&ADV.tab==="mine"&&$("sheetwrap").hidden;
  fresh.forEach(n=>{if(!QUIET.has(n.kind)&&!onScreen)toast(n.msg,n.kind==="outbid"&&n.d?{label:"Raise",run:()=>Bid.raise(n.d,n.k)}:null)});
 },
 fields(c){const f={};["thumb","who","about","line","sub","cta","web","social","email","link","fname","script","trimStart","len","dur","mark"].forEach(k=>{if(c[k]!=null&&c[k]!=="")f[k]=c[k]});return f},
 kind(k,c){return SPOTS[k].fmt==="classified"?"classified":(c.img&&!c.file?"image":"video")},
 /* place the bids first, then send the ad: a slow upload must never cost anyone the auction */
 async submit(st,cre){
  const lib=await Live.client(),btn=$("sheet").querySelector("[data-next]");if(btn)btn.disabled=true;
  const kind=Live.kind(st.k,st.cre);
  try{
   const adId=st.raise?(st.cre.adId||null):(st.cre.adId||=crypto.randomUUID());
   if(!st.raise)await lib.api("ads/ads",{id:adId,spot:st.k,kind,fields:Live.fields(cre)});
   const rs=[];
   for(const d of Bid.ds()){const r=await lib.api("ads/bid",{issue:d,spot:st.k,mode:st.mode,max:Bid.amt(d),adId:st.raise?null:adId});rs.push({d,...r,short:r.short?r.short/100:undefined})}
   st.results=rs;
   await Live.sync();
   if(!st.raise&&rs.some(r=>r.ok)){Live.keep(adId,st.cre);AU.cre[st.k]={...st.cre}}
   const fail=rs.find(r=>!r.ok);
   if(fail&&rs.every(r=>!r.ok)){st.err=fail.err;st.i=st.steps.indexOf(fail.credits?"review":"bid");Bid.render();return}
   st.steps=[...st.steps,"done"];st.i=st.steps.length-1;
   st.sending=!st.raise&&kind!=="classified"&&!!st.cre.blob;
   Bid.render();Adv.refresh(true);
   if(!st.raise&&rs.some(r=>r.ok))Live.send(adId,st.k,kind,st.cre);
  }catch(e){st.err=e.message;Bid.render()}
 },
 keep(adId,c){if(c.file||c.img)Live.local[adId]={...(c.file?{file:c.file}:{}),...(c.img?{img:c.img}:{})}},
 async saveAd(st,d,my,cre){
  const lib=await Live.client(),kind=Live.kind(st.k,st.cre),fresh=!!st.cre.blob;
  const adId=fresh?crypto.randomUUID():(my.cre.adId||crypto.randomUUID());
  try{
   await lib.api("ads/ads",{id:adId,spot:st.k,kind,fields:Live.fields(cre)});
   if(adId!==my.cre.adId)await lib.api("ads/bid-ad",{issue:d,spot:st.k,adId});
   Live.keep(adId,st.cre);AU.cre[st.k]={...st.cre,adId};
   Sheet.close();toast("Ad saved.");
   await Live.send(adId,st.k,kind,st.cre);
   await Live.sync();Adv.refresh(true);
  }catch(e){st.err=e.message;Bid.render()}
 },
 /* Bought's order: video to Mux in resumable chunks, then a still as the poster; it is ready once Mux has it */
 async send(adId,k,kind,c){
  const lib=await Live.client(),say=x=>{const el=$("b-up");if(el)el.textContent=x};
  const blob=c.blob;
  const pend=store.get("bought-pending",{});pend[adId]={k,kind,fname:c.fname||""};store.set("bought-pending",pend);
  try{
   if(kind==="video"&&blob){
    await lib.uploadVideo(adId,blob,p=>say(`Uploading your video… ${Math.round(p)}%`));
    say("Video uploaded. Finishing up…");
    await lib.posterFrom(blob).then(f=>lib.uploadImage(adId,f)).catch(()=>{});
   }else if(kind==="image"&&blob)await lib.uploadImage(adId,blob);
   if(kind==="classified"||blob||c.mux||(kind==="image"&&c.img))await lib.api(`ads/ads/${adId}/submit`,{});
   Live.settled(adId,k);
   say("Your ad is uploaded. It's ready as soon as the video finishes processing.");
   await Live.sync();Adv.refresh();
  }catch(e){
   const msg=e.message||"Your ad didn't finish uploading.";say(msg);
   toast(msg,{label:"Try again",run:()=>Live.send(adId,k,kind,c)});
  }
 },
 settled(adId,k){if(AU.cre[k])delete AU.cre[k].blob;const p=store.get("bought-pending",{});delete p[adId];store.set("bought-pending",p);store.set("bought-draft-"+k,null);Live.client().then(l=>{l.dropLocal(adId).catch(()=>{});l.dropLocal("draft-"+k).catch(()=>{})})},
 /* a refresh or a dropped connection mid-upload: the saved copy carries on by itself */
 async resume(){
  if(!Live.user)return;
  const lib=await Live.client();
  for(const[adId,p]of Object.entries(store.get("bought-pending",{}))){
   const take=await lib.loadLocal(adId).catch(()=>null);
   if(take&&!take.uploaded)Live.send(adId,p.k,p.kind,{blob:take.video,fname:p.fname});
   else if(take?.uploaded)lib.api(`ads/ads/${adId}/submit`,{}).then(()=>Live.settled(adId,p.k)).catch(()=>{});
   else if(p.kind==="classified")lib.api(`ads/ads/${adId}/submit`,{}).then(()=>Live.settled(adId,p.k)).catch(()=>{});
  }
 },
 /* a take recorded but not bid on yet survives a refresh, on this device */
 async saveDraft(k,c,blob){
  try{const lib=await Live.client();await lib.saveLocal("draft-"+k,blob);store.set("bought-draft-"+k,{fname:c.fname,dur:c.dur,len:c.len})}catch{}
 },
 async restoreDraft(st){
  const meta=store.get("bought-draft-"+st.k,null);if(!meta||st.cre.file||st.cre.img||SPOTS[st.k].fmt!=="video")return;
  try{const lib=await Live.client(),take=await lib.loadLocal("draft-"+st.k);
   if(take&&Bid.st===st&&!st.cre.file){Object.assign(st.cre,meta,{blob:take.video,file:URL.createObjectURL(take.video),img:null,trimStart:0});Bid.render()}}catch{}
 },
 /* ---------- sign-in, inside the page's own bid sheet: Google in a small window, or a code by email ---------- */
 async signinStep(st){const lib=await Live.client();await lib.sendCode(st.acct.email);return true},
 async verifyStep(st){
  const lib=await Live.client(),code=($("b-code")?.value||"").trim();
  if(!/^\d{4,10}$/.test(code))throw new Error("Enter the code from your email.");
  await lib.verifyCode(st.acct.email,code);
  Live.user=true;await Live.sync();
 },
 async google(){
  const st=Bid.st;if(!st||st.waiting)return;
  st.err="";st.waiting=true;Bid.render();
  try{
   const lib=await Live.client(),ok=await lib.googleSignIn();
   st.waiting=false;
   if(!ok){if(Bid.st===st)Bid.render();return}
   Live.user=true;await Live.sync();await Live.afterSignIn(st);
  }catch(e){st.waiting=false;st.err=e.message||"Please try again.";if(Bid.st===st)Bid.render()}
 },
 cancelGoogle(){Live.client().then(l=>l.cancelGoogle()).catch(()=>{})},
 /* signed in: a returning advertiser keeps the details on file and skips that step; a new one starts from their email */
 async afterSignIn(st){
  const lib=await Live.client();Live.email=await lib.userEmail().catch(()=>null);
  if(AU.acct)st.acct={...AU.acct};else if(Live.email&&!st.acct.email)st.acct.email=Live.email;
  const at=st.steps.indexOf("signin");
  st.steps=st.steps.filter(s=>s!=="signin"&&s!=="verify"&&!(s==="acct"&&AU.acct));st.i=Math.max(0,at);st.err="";
  Live.resume();
  if(st.gate&&st.i>=st.steps.length){const after=st.gate;Sheet.close();after();return}
  if(Bid.st===st)Bid.render();
 },
 async accountStep(st){const lib=await Live.client();await lib.api("ads/account",st.acct);await Live.sync();return true},
 gate(after){
  const steps=Live.user?["acct"]:["signin","verify","acct"];
  Bid.open({k:"top",steps,i:0,dates:new Set(),mode:"exact",same:true,one:null,per:{},cre:defCre("top"),acct:{name:"",email:"",country:"India",gstin:"",method:"upi"},gate:after,err:""});
 },
 async topup(btn,amt,method){
  const reset=btn.textContent;
  try{
   const lib=await Live.client(),r=await lib.topup(amt,method);
   if(r==="paid"){toast("Payment received. Your points appear as soon as it's confirmed.");for(let i=0;i<6;i++){await new Promise(z=>setTimeout(z,2500));await Live.sync().catch(()=>{});Adv.refresh(true);if(Bid.st){Bid.st.err="";Bid.render()}else Wallet.render()}}
  }catch(e){toast(e.message)}
  btn.disabled=false;btn.textContent=reset;
 },
 async withdraw(){
  try{const lib=await Live.client(),r=await lib.api("ads/withdraw",{amount:withdrawable()});await Live.sync();Wallet.render();Adv.refresh(true);
   toast(r.withdrawn?`${usd(r.withdrawn)} for ${pts(r.withdrawn)} is on its way to your bank. It usually arrives in 3–5 working days.`:"Nothing to withdraw right now. Free points stay in your wallet for bidding.")}catch(e){toast(e.message)}
 },
 /* ---------- readers: the ads that won this issue ---------- */
 async winners(date){
  clearObj(ISSUE_ADS);ISSUE_CLS.length=0;
  if(!Live.on)return;
  try{
   const lib=await Live.client(),{winners}=await lib.api("ads/winners?date="+encodeURIComponent(date));
   winners.forEach(w=>{
    const f=w.fields||{},amt=w.amt/100;
    if(w.spot==="cls"){ISSUE_CLS.push([amt,f.line||"",w.adv]);return}
    const cre={...f,adv:w.adv,cta:f.cta||hostOf(f.web||"")};
    if(w.kind==="image"&&w.signedImage)cre.img=w.signedImage;
    if(w.kind==="video"){if(w.mux)cre.mux=w.ad;if(w.signedImage)cre.poster=w.signedImage;
     if(w.script){const lines=w.script.split(/(?<=[.!?])\s+/).filter(Boolean);if(lines.length)cre.script=lines}}
    ISSUE_ADS[w.spot]={cre,amt,date};
   });
   if(BOOTED||winners.length)Paper.refreshAds();
   Live.watchViews(date);
  }catch{}
 },
 counted:new Set(),
 watchViews(date){
  if(!window.IntersectionObserver)return;
  const io=new IntersectionObserver(es=>es.forEach(e=>{if(!e.isIntersecting)return;io.unobserve(e.target);const k=e.target.dataset.spot;Live.count(k,"view",date)}),{threshold:.5});
  $$("#v-paper [data-spot][data-layout]").forEach(el=>{if(ISSUE_ADS[el.dataset.spot])io.observe(el)});
 },
 count(k,kind,date=ISSUE_DAY){
  if(!Live.on||!k||!ISSUE_ADS[k])return;
  const key=date+k+kind;if(Live.counted.has(key))return;Live.counted.add(key);
  fetch("api/bought/ads/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({issue:date,spot:k,kind}),keepalive:true}).catch(()=>{});
 },
 attach(v,adId){return Live.client().then(l=>l.attach(v,adId))}
};
