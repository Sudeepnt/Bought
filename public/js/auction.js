/* Bought. Daily — auction engine.
   This is a client-side simulation of the server rules in RULES (data.template.js). In production every function
   here is a server operation: bids are validated and written under a per-auction row lock, events are pushed over
   a websocket, and close/settle/capture run as scheduled jobs. Rival bidders are simulated. */

const GST=0.18;   /* added to the price when points are bought in India; bids and wins carry no tax */
const AU={dates:[],s:{},cls:{},my:{},past:[],feed:[],inbox:[],acct:null,cre:{},ff:false,wallet:{bal:100,free:100,tx:[{t:Date.now(),kind:"bonus",amt:100,label:"100 free points to start",bal:100}]}};
const K=(d,k)=>d+"|"+k;
const handle=()=>"Bidder "+(10+Math.floor(Math.random()*80));
const gstRate=()=>0;

/* ---------- seed the next 7 issues with plausible activity ---------- */
function seedDate(d,i){
 const R=seeded(hashStr(d)), t0=now();
 SPOT_ORDER.forEach(k=>{
  if(k==="cls"){
   const n=Math.max(3,Math.round(15-i*2+R()*3)), list=[];
   for(let j=0;j<n;j++)list.push({h:"Bidder "+(10+Math.floor(R()*80)),amt:Math.max(reserveFor("cls",d),Math.round((9-i)*R()+1)),t:t0-(j+1)*R()*36e5*(3+i)});
   AU.cls[d]={list,close:closeAt(d),ext:0};return;
  }
  const sp=SPOTS[k], res=reserveFor(k,d);
  const n=Math.max(0,Math.round((7-i)*1.3*R()+(i<2?2:0)));
  const hist=[];let amt=res;
  for(let j=0;j<n;j++){if(j)amt+=sp.inc*(1+Math.floor(R()*4));hist.unshift({h:"Bidder "+(10+Math.floor(R()*80)),amt,t:0})}
  hist.forEach((h,j)=>h.t=t0-(j+1)*(6+R()*40)*6e4*(1+i));
  AU.s[K(d,k)]={high:n?amt:0,n,hist,close:closeAt(d),ext:0,leader:n?"rival":null};
 });
}
function initAuction(){
 let d=TODAY;while(closeAt(d)<=now())d=addDays(d,1);
 for(let i=0;i<7;i++){const x=addDays(d,i);AU.dates.push(x);seedDate(x,i)}
 const d0=AU.dates[0];
 SPOT_ORDER.filter(k=>k!=="cls").forEach(k=>{const h=AU.s[K(d0,k)].hist[0];if(h)AU.feed.push({kind:"bid",d:d0,k,amt:h.amt,h:h.h,t:h.t})});
 AU.feed.sort((a,b)=>b.t-a.t);
}

/* ---------- reads ---------- */
const spotState=(d,k)=>k==="cls"?AU.cls[d]:AU.s[K(d,k)];
const clsSorted=d=>AU.cls[d].list.slice().sort((a,b)=>b.amt-a.amt||a.t-b.t);
function clsCut(d){const s=clsSorted(d);return s.length<SPOTS.cls.seats?null:s[SPOTS.cls.seats-1].amt}
function minBid(d,k){
 if(k==="cls"){const c=clsCut(d);return Math.max(reserveFor("cls",d),c==null?0:c+1)}
 const s=AU.s[K(d,k)];return s.n?s.high+SPOTS[k].inc:reserveFor(k,d);
}
const highOf=(d,k)=>k==="cls"?clsCut(d):(AU.s[K(d,k)].n?AU.s[K(d,k)].high:null);
const bidsOf=(d,k)=>k==="cls"?AU.cls[d].list.length:AU.s[K(d,k)].n;
const closeOf=(d,k)=>spotState(d,k).close;
const isOpenSpot=(d,k)=>!!spotState(d,k)&&now()<closeOf(d,k);
const clsRank=(d,ref)=>clsSorted(d).indexOf(ref)+1;
const myBid=(d,k)=>AU.my[K(d,k)];
const myOpen=()=>Object.values(AU.my);
/* ---------- wallet: bids are paid in points ----------
   100 free points to start, more at $1 each. A live bid sets aside its maximum. If you're outbid, the points are free
   again at once. At close, winners' points are spent, free ones first; nothing else moves. Bought points can be withdrawn. */
const c2=x=>Math.round(x*100)/100;
const setAside=(e,rate=gstRate())=>(e.status==="leading"||e.status==="in")?c2(e.max*(1+rate)):0;
const heldTotal=()=>c2(myOpen().reduce((a,e)=>a+setAside(e),0));
const availCredits=()=>Math.max(0,c2(AU.wallet.bal-heldTotal()));
function walletTx(kind,amt,label){AU.wallet.tx.unshift({t:now(),kind,amt:c2(amt),label,bal:AU.wallet.bal})}
function addCredits(amt,method){amt=c2(amt);if(!(amt>0))return;AU.wallet.bal=c2(AU.wallet.bal+amt);walletTx("topup",amt,`Points bought · ${method==="card"?"Card":"UPI"}`)}
/* free points never go to a bank: only bought ones that aren't set aside */
const withdrawable=()=>Math.max(0,Math.min(availCredits(),c2(AU.wallet.bal-(AU.wallet.free||0))));
function withdrawCredits(amt){amt=c2(Math.min(amt,withdrawable()));if(!(amt>0))return 0;AU.wallet.bal=c2(AU.wallet.bal-amt);walletTx("withdraw",-amt,"Withdrawn to your bank · 3–5 working days");return amt}
function nextClose(){return Math.min(...SPOT_ORDER.map(k=>closeOf(AU.dates[0],k)))}
function lastClose(d){return Math.max(...SPOT_ORDER.map(k=>closeOf(d,k)))}

/* ---------- events ---------- */
function pushFeed(ev){AU.feed.unshift(ev);AU.feed.length=Math.min(AU.feed.length,40)}
const QUIET=new Set(["auto","clock"]);
function notify(msg,action,kind="info"){AU.inbox.unshift({msg,t:now(),kind});AU.inbox.length=Math.min(AU.inbox.length,30);const onScreen=VIEW==="advertise"&&ADV.tab==="mine"&&$("sheetwrap").hidden;if(!QUIET.has(kind)&&!onScreen)toast(msg,action);Adv.refresh()}
function extendIfLate(d,k){
 const s=spotState(d,k), t=now(), base=closeAt(d);
 if(t<s.close&&s.close-t<SOFT_MS){
  const nc=Math.min(t+SOFT_MS,base+HARD_MS);
  if(nc>s.close){s.close=nc;s.ext++;pushFeed({kind:"ext",d,k,t,until:nc});
   if(myBid(d,k))notify(`A late bid extended ${SPOTS[k].name} for ${dayShort(d)} to ${timeIST(nc)} IST.`,null,"ext")}
 }
}

/* ---------- place a bid (the server validates every rule here) ---------- */
function placeBid(d,k,{mode,max,cre}){
 if(!AU.dates.includes(d)||!isOpenSpot(d,k))return {ok:false,err:"Bidding for this issue has closed."};
 const key=K(d,k), prev=AU.my[key], t=now();
 /* points first: the new maximum must fit in what's free in the wallet (this bid's current set-aside counts) */
 const newMax=k!=="cls"&&prev&&prev.status==="leading"&&mode==="exact"?Math.max(prev.max,max):max;
 const need=c2(newMax*(1+gstRate())-(prev?setAside(prev):0));
 if(need>availCredits()+.004)return {ok:false,credits:true,short:c2(need-availCredits()),err:`You need ${pts(need-availCredits())} more for ${dayShort(d)}. Get more points and try again.`};
 if(k==="cls"){
  const min=minBid(d,k), inTop=prev&&clsRank(d,prev.ref)<=SPOTS.cls.seats;
  if(prev&&max<=prev.amt)return {ok:false,err:`Your new bid must be above your current ${pts(prev.amt)}.`};
  if(!inTop&&max<min)return {ok:false,err:`The minimum to get into the top 8 is ${pts(min)}.`};
  if(prev)AU.cls[d].list=AU.cls[d].list.filter(x=>x!==prev.ref);
  const ref={h:"You",amt:max,t,me:true};AU.cls[d].list.push(ref);
  AU.my[key]={d,k,amt:max,max,mode:"exact",ref,cre,placed:prev?.placed||t,status:"in"};
  AU.my[key].status=clsRank(d,ref)<=SPOTS.cls.seats?"in":"out";
 } else {
  const s=AU.s[key], inc=SPOTS[k].inc;
  if(prev&&prev.status==="leading"){
   if(mode==="auto"){if(max<prev.max+inc)return {ok:false,err:`A new maximum must be at least ${pts(prev.max+inc)}.`};prev.max=max;prev.mode="auto"}
   else{if(max<s.high+inc)return {ok:false,err:`An exact bid must be at least ${pts(s.high+inc)}.`};s.high=max;s.n++;prev.amt=max;prev.max=Math.max(prev.max,max);prev.mode="exact";s.hist.unshift({h:"You",amt:max,t,me:true})}
   if(cre)prev.cre=cre;extendIfLate(d,k);pushFeed({kind:"bid",d,k,amt:s.high,me:true,t});return {ok:true};
  }
  const min=minBid(d,k);
  if(max<min)return {ok:false,err:`The minimum bid is ${pts(min)}.`};
  const price=mode==="auto"?min:max;
  s.high=price;s.n++;s.leader="me";s.hist.unshift({h:"You",amt:price,t,me:true});
  AU.my[key]={d,k,amt:price,max,mode,cre:cre||prev?.cre,placed:t,status:"leading"};
 }
 extendIfLate(d,k);pushFeed({kind:"bid",d,k,amt:AU.my[key].amt,me:true,t});
 
 if(!AU.my[key].tested){AU.my[key].tested=true;setTimeout(()=>{const e=AU.my[key];if(e&&isOpenSpot(d,k))rivalBid(d,k)},9000+Math.random()*6000)}
 return {ok:true};
}

/* ---------- simulated rival bidders ---------- */
function rivalBid(d,k){
 if(!isOpenSpot(d,k))return;
 const h=handle(), key=K(d,k), my=AU.my[key], t=now();
 if(k==="cls"){
  const c=clsCut(d), amt=Math.max(reserveFor("cls",d),(c??reserveFor("cls",d)-1)+1)+Math.floor(Math.random()*5);
  AU.cls[d].list.push({h,amt,t});pushFeed({kind:"bid",d,k,amt,h,t});
  if(my){const was=my.status;my.status=clsRank(d,my.ref)<=SPOTS.cls.seats?"in":"out";
   if(was==="in"&&my.status==="out")notify(`Your classified for ${dayShort(d)} dropped below line 8. ${pts(minBid(d,k))} gets you back in.`,{label:"Raise",run:()=>Bid.raise(d,k)},"outbid")}
  extendIfLate(d,k);return;
 }
 const s=AU.s[key], inc=SPOTS[k].inc, R=Math.max(minBid(d,k),s.high+inc*(1+Math.floor(Math.random()*3)));
 s.n++;s.hist.unshift({h,amt:R,t});
 if(my&&my.status==="leading"){
  if(my.mode==="auto"&&R<=my.max){
   const p=Math.min(R+inc,my.max);s.high=p;my.amt=p;s.hist.unshift({h:"You · auto-raise",amt:p,t:t+1,me:true});
   pushFeed({kind:"auto",d,k,amt:p,t});
   notify(`${h} bid ${pts(R)} on ${SPOTS[k].name} for ${dayShort(d)}. Auto-raise kept you in the lead at ${pts(p)}.`,null,"auto");
  } else {
   s.high=R;s.leader="rival";my.status="outbid";pushFeed({kind:"bid",d,k,amt:R,h,t});
   notify(`You were outbid on ${SPOTS[k].name} for ${dayShort(d)}. The minimum is now ${pts(minBid(d,k))}.`,{label:`Raise to ${pts(minBid(d,k))}`,run:()=>Bid.raise(d,k)},"outbid");
  }
 } else {s.high=R;s.leader="rival";pushFeed({kind:"bid",d,k,amt:R,h,t})}
 extendIfLate(d,k);
}
setInterval(()=>{
 if(Live.on||document.hidden||!AU.dates.length)return;
 const d0=AU.dates[0], closing=nextClose()-now()<SOFT_MS*1.5;
 const d=closing||Math.random()<.55?d0:rnd(AU.dates);
 const ks=SPOT_ORDER.filter(k=>isOpenSpot(d,k));if(!ks.length)return;
 const mine=ks.filter(k=>{const e=myBid(d,k);return e&&(e.status==="leading"||e.status==="in")});
 rivalBid(d,(mine.length&&Math.random()<.35)?rnd(mine):rnd(ks));
 Adv.refresh();
},6500);

/* ---------- close + settle: rank, spend winners' points (free first), free the rest, issue receipts ---------- */
function settle(d){
 if(!AU.dates.includes(d))return;
 const res=[], rate=gstRate();
 SPOT_ORDER.forEach(k=>{
  const key=K(d,k), my=AU.my[key];if(!my)return;
  let won,final;
  if(k==="cls"){const r=clsRank(d,my.ref);won=r>0&&r<=SPOTS.cls.seats;my.rank=r;final=clsCut(d)??my.amt}
  else{won=my.status==="leading";final=AU.s[key].high}
  const gst=won?Math.round(my.amt*rate*100)/100:0;
  const e={...my,issue:issueNo(d),final,status:won?"won":"lost",price:my.amt,gst,total:won?my.amt+gst:0,inv:won?`BGT-${issueNo(d)}-${String(1000+Math.floor(Math.random()*9000))}`:null,settledAt:now()};
  AU.past.push(e);delete AU.my[key];res.push(e);
 });
 AU.dates.shift();const nd=addDays(AU.dates[AU.dates.length-1]||d,1);AU.dates.push(nd);seedDate(nd,6);
 AU.ff=false;if(ADV.date===d||!AU.dates.includes(ADV.date))ADV.date=AU.dates[0];
 const w=res.filter(e=>e.status==="won");
 w.forEach(e=>{PREVIEW[e.k]={cre:{...e.cre,adv:e.cre.adv||AU.acct?.name},amt:e.price,date:d,block:e.k==="cls"?Math.floor((e.rank-1)/4):0}});
 if(w.length)Paper.refreshAds();
 w.forEach(e=>{AU.wallet.bal=c2(AU.wallet.bal-e.total);AU.wallet.free=Math.max(0,c2((AU.wallet.free||0)-e.total));walletTx("win",-e.total,`Won ${SPOTS[e.k].name} · ${dayShort(d)} · ${e.inv}`)});
 const charged=w.reduce((a,e)=>a+e.total,0);
 notify(!res.length?`Bidding closed for the ${dayShort(d)} issue.`:w.length?`Bidding closed for ${dayShort(d)}. You won ${w.length} of ${res.length} and spent ${pts(charged)}; everything else set aside is free again.`:`Bidding closed for ${dayShort(d)}. You didn't win this time, so no points were used. They're free to bid again.`,w.length?{label:"See results",run:()=>Adv.tab("mine")}:null,"close");
 Adv.refresh(true);
}
/* the issue publishes at 11:30 IST (06:00 UTC); next morning the report and receipt arrive */
function publish(d){
 const es=AU.past.filter(e=>e.d===d&&e.status==="won");if(!es.length)return;
 es.forEach(e=>{const R=seeded(hashStr(e.inv)), big={top:1,front:.8,half:.75}[e.k]||.45;
  const views=Math.round((28000+R()*16000)*big), plays=SPOTS[e.k].fmt==="video"?Math.round(views*(.14+R()*.1)):0, clicks=Math.round(views*(.008+R()*.012));
  e.status="live";e.report={views,plays,watch:SPOTS[e.k].fmt==="video"?Math.round(14+R()*16):0,clicks}});
 notify(`The ${dayShort(d)} issue is live. Your delivery report is ready.`,{label:"View report",run:()=>Adv.report(es[0])},"live");
 Adv.refresh(true);
}
function fastForward(){
 if(!AU.dates.length)return;
 CLOCK_OFFSET+=nextClose()-SOFT_MS+20e3-now();AU.ff=true;
 notify(`Prototype clock moved to ${timeIST(now())} IST, five minutes before bidding closes for ${dayShort(AU.dates[0])}.`,null,"clock");
 Adv.refresh(true);
}
function closeNow(){const d=AU.dates[0];SPOT_ORDER.forEach(k=>{spotState(d,k).close=now()-1});settle(d)}
/* auto-settle the moment every spot of the next issue has closed */
function tickAuction(){if(!Live.on&&AU.dates.length&&now()>=lastClose(AU.dates[0]))settle(AU.dates[0])}
