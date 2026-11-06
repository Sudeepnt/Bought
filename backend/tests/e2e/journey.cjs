const pw=require(process.env.PLAYWRIGHT_CORE||'playwright-core');const fs=require('fs');const crypto=require('crypto');
const T=process.argv[2];const U='http://localhost:8010',C='http://127.0.0.1:8798';

// The desk is private (its own port) and asks for a code from an authenticator app, as on the server.
const DESK='http://localhost:8011',TOTP='JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
function totp(t){const b32='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of TOTP)bits+=b32.indexOf(c).toString(2).padStart(5,'0');
 const key=Buffer.from(bits.match(/.{8}/g).map(x=>parseInt(x,2)));const msg=Buffer.alloc(8);msg.writeBigUInt64BE(BigInt(Math.floor(t/30)));
 const h=require('crypto').createHmac('sha1',key).update(msg).digest();const o=h[h.length-1]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1e6).padStart(6,'0')}
async function deskLogin(adm){
 for(let i=0;i<3;i++){await adm.goto(DESK+'/admin/login');await adm.fill('input[name=password]','test-pass');await adm.fill('input[name=code]',totp(Date.now()/1000));await adm.click('button');
  await adm.waitForLoadState();if(!adm.url().includes('/login'))return;await new Promise(r=>setTimeout(r,31000))}   // a code is good once: wait for the next
 throw new Error('desk sign-in failed')}
const q=async s=>(await fetch(C+'/query',{method:'POST',body:s})).json();
const log=(...a)=>console.log(...a);const errs=[];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let uploaded=0;
async function ctx(b,name,opts={}){
 const c=await b.newContext({viewport:{width:1280,height:900},...opts});
 // the browser's Supabase client reaches the same fake the backend uses
 await c.route('https://fake.supabase.test/**',async r=>{const q=r.request();const u=new URL(q.url());const h={...q.headers()};delete h['host'];
  if(q.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  const res=await fetch(C+'/sb'+u.pathname+u.search,{method:q.method(),headers:h,body:q.postDataBuffer()||undefined,redirect:'manual'});
  const loc=res.headers.get('location');
  r.fulfill({status:res.status,headers:{'content-type':res.headers.get('content-type')||'application/json','access-control-allow-origin':'*','access-control-expose-headers':'*',...(loc?{location:loc}:{})},body:Buffer.from(await res.arrayBuffer())})});
 // Mux's upload target and stream
 await c.route('https://storage.googleapis.com/fake-mux/**',async r=>{const q=r.request();
  if(q.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  uploaded+=(q.postDataBuffer()||Buffer.alloc(0)).length;r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:''})});
 await c.route('https://stream.mux.com/**',async r=>{const u=new URL(r.request().url());const n=u.pathname.endsWith('.m3u8')?'index.m3u8':u.pathname.split('/').pop();
  r.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':n.endsWith('m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'},body:fs.readFileSync(T+'/hls/'+n)})});
 // Razorpay's checkout window: a stand-in that reports a completed payment
 await c.route('https://checkout.razorpay.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.Razorpay=function(o){window.__rzp=o;this.open=function(){setTimeout(function(){o.handler({})},50)}}'}));
 const p=await c.newPage();
 p.on('pageerror',e=>errs.push(name+': '+e.message));
 p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|Failed to load resource/.test(m.text()))errs.push(name+' console: '+m.text().slice(0,200))});
 await p.goto(U+'/#advertise');await p.waitForSelector('#adv .adv-tabs');await sleep(400);return p;
}
const next=p=>p.click('#sheet [data-next]');
const waitStep=async(p,t)=>{try{await p.waitForFunction(x=>document.querySelector('#sheet h3')?.textContent===x,t,{timeout:15000})}catch(e){console.log('STUCK waiting for',t,'on:',await p.evaluate(()=>[document.querySelector('#sheet h3')?.textContent,document.querySelector('#sheet .msg')?.textContent,Bid.st&&Bid.st.err]));await p.screenshot({path:T+'/stuck.png'});throw e}};
async function openBid(p,k){await p.evaluate(k=>Bid.start(k,[AU.dates[1]]),k);await p.waitForSelector('#sheet h3')}
async function payWebhook(amountInr){
 const o=(await q("select payment_reference,charge_minor from public.bought_topups where state='created' order by created_at desc limit 1"))[0];
 const body=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_'+crypto.randomUUID().replaceAll('-','').slice(0,14),order_id:o.payment_reference,status:'captured',amount:Number(o.charge_minor),currency:'INR'}}}});
 const sig=crypto.createHmac('sha256','rzpsecret').update(body).digest('hex');
 const r=await fetch(U+'/api/bought/webhooks/razorpay',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':sig},body});
 return [r.status,o];
}
(async()=>{
 const b=await pw.chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--autoplay-policy=no-user-gesture-required']});
 const A=await ctx(b,'A');
 log('1 live:',await A.evaluate(()=>Live.on),'| dates',await A.evaluate(()=>AU.dates.length),'| prototype controls:',await A.locator('.demo').count(),'| bids seen:',await A.evaluate(()=>Object.values(AU.s).reduce((a,s)=>a+s.n,0)));
 await A.screenshot({path:T+'/1-advertise.png'});
 // ---- A records with the camera
 await openBid(A,'feed-e');await next(A);
 await waitStep(A,'Set your bid');await A.fill('#b-one','300');await next(A);
 await waitStep(A,'Add your ad');
 await A.click('#sheet [data-rec]');await A.waitForSelector('#rec-v');await sleep(4000);
 log('2 recording:',await A.evaluate(()=>({mime:Rec.mr.mimeType,state:Rec.mr.state,w:document.getElementById('rec-v').videoWidth,hint:document.getElementById('rec-hint').textContent,bits:Rec.mr.videoBitsPerSecond})));
 await A.screenshot({path:T+'/2-recording.png'});
 await A.click('#sheet [data-rec-stop]');await A.waitForFunction(()=>Bid.st.cre.fname&&Bid.st.cre.blob);
 log('  take:',await A.evaluate(()=>({f:Bid.st.cre.fname,size:Bid.st.cre.blob.size,type:Bid.st.cre.blob.type})));
 await A.reload();await A.waitForSelector('#adv .adv-tabs');await sleep(300);await openBid(A,'feed-e');await sleep(800);
 log('  draft after refresh:',await A.evaluate(()=>({f:Bid.st.cre.fname,hasBlob:!!Bid.st.cre.blob})));
 await next(A);await waitStep(A,'Set your bid');await A.fill('#b-one','300');await next(A);await waitStep(A,'Add your ad');
 await A.fill('#b-about','We help clinics book patients in one tap');await A.fill('#b-thumb','Book in one tap');await A.fill('#b-who','Asha Rao, founder');await A.fill('#b-web','example.com');await next(A);
 await waitStep(A,'Sign in');log('  sign-in offers Google:',await A.locator('#sheet [data-google]').count());await A.fill('#b-email','asha@example.com');await next(A);
 await waitStep(A,'Confirm your email');await A.screenshot({path:T+'/3-code.png'});
 await A.fill('#b-code','000000');await next(A);await A.waitForSelector('#sheet .msg');log('3 wrong code:',await A.innerText('#sheet .msg'));
 await A.fill('#b-code','123456');await next(A);await waitStep(A,'Account and payment');
 log('  email carried over:',await A.inputValue('#b-email'));await A.fill('#b-biz','Clinic Co');await next(A);await waitStep(A,'Review and place');
 log('  free points on the new account:',await A.evaluate(()=>[AU.wallet.bal,AU.wallet.free,AU.wallet.tx[0]?.label]));
 log('  signed in:',await A.evaluate(()=>({user:Live.user,acct:AU.acct.name,bal:AU.wallet.bal})));
 await A.check('#b-agree');await next(A);await A.waitForSelector('#sheet .msg');log('4 not enough points:',await A.innerText('#sheet .msg'));
 // ---- pay
 await A.screenshot({path:T+'/4-review.png'});
 await A.evaluate(()=>{document.querySelector('#sheet input[name=wpm][value=upi]')?.click()});
 log('  buy buttons:',await A.locator('#sheet [data-topup]').allInnerTexts());await A.locator('#sheet [data-topup]').first().click();
 await sleep(1200);
 const [st,o]=await payWebhook();log('5 webhook',st,'charged',Number(o.charge_minor)/100,'INR');
 const forged=await fetch(U+'/api/bought/webhooks/razorpay',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':'0'.repeat(64)},body:'{}'});log('  forged webhook:',forged.status);
 await A.waitForFunction(()=>AU.wallet.bal>100,null,{timeout:20000});log('  wallet:',await A.evaluate(()=>AU.wallet.bal));
 await A.waitForFunction(()=>Bid.st&&Bid.st.steps[Bid.st.i]==='review');await sleep(300);
 if(!await A.isChecked('#b-agree'))await A.check('#b-agree');await next(A);
 await waitStep(A,'Bids placed');log('6 placed:',await A.innerText('#sheet .done-h'),'|',await A.innerText('#sheet .mb-rows'));
 await A.waitForFunction(()=>/uploaded\./.test(document.getElementById('b-up')?.textContent||''),null,{timeout:30000}).catch(()=>{});
 log('  upload status:',await A.innerText('#b-up'),'| bytes at mux:',uploaded);
 await A.screenshot({path:T+'/6-done.png'});await A.click('#sheet [data-x]');
 log('  ad row:',(await q("select state,media_state,kind,thumbnail_verified,fields->>'about' a from public.bought_ads"))[0]);
 const st2=await (await fetch(C+'/state')).json();log('  mux request:',JSON.stringify(st2.mux[0]).slice(0,200));
 // ---- Mux finishes: the ad is ready, with nobody reviewing it
 log('7 mux events:',await (await fetch(C+'/mux-ready')).json());
 log('  ad row:',(await q("select state,media_state from public.bought_ads"))[0]);
 const adm=await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
 adm.on('pageerror',e=>errs.push('desk: '+e.message));
 await deskLogin(adm);await adm.goto(DESK+'/admin/ads');
 log('8 desk ads:',(await adm.innerText('main')).slice(0,200).replace(/\n/g,' | '),'| review buttons:',await adm.locator('button:has-text("Approve"),button:has-text("Send back")').count());
 await adm.screenshot({path:T+'/8-admin.png',fullPage:true});
 // ---- B uploads a file and fights the auto-raise
 const B=await ctx(b,'B');
 await openBid(B,'feed-e');await next(B);await waitStep(B,'Set your bid');
 await B.click('#sheet [data-mode="exact"]');await B.fill('#b-one','200');await next(B);await waitStep(B,'Add your ad');
 await B.setInputFiles('#b-file',T+'/upload.mp4');await B.waitForFunction(()=>Bid.st.cre.dur>0);
 log('9 upload file:',await B.evaluate(()=>({f:Bid.st.cre.fname,d:Bid.st.cre.dur,blob:Bid.st.cre.blob.size})));
 await B.fill('#b-about','Rival video');await B.fill('#b-thumb','Rival');await B.fill('#b-who','Ben');await B.fill('#b-web','rival.example');await next(B);
 await waitStep(B,'Sign in');await B.fill('#b-email','ben@example.com');await next(B);
 await waitStep(B,'Confirm your email');await B.fill('#b-code','123456');await next(B);
 await waitStep(B,'Account and payment');await B.fill('#b-biz','Rival Inc');await B.selectOption('#b-country',{label:'United States'}).catch(()=>{});await next(B);await waitStep(B,'Review and place');
 await B.locator('#sheet [data-topup]').first().click();await sleep(1200);await payWebhook();await B.waitForFunction(()=>AU.wallet.bal>100,null,{timeout:20000});
 await B.waitForFunction(()=>Bid.st&&Bid.st.steps[Bid.st.i]==='review');await sleep(300);if(!await B.isChecked('#b-agree'))await B.check('#b-agree');await next(B);await waitStep(B,'Bids placed');
 log('  B result:',await B.innerText('#sheet .mb-rows'),'| wallet',await B.evaluate(()=>[AU.wallet.bal,heldTotal()]));await B.click('#sheet [data-x]');
 await sleep(6000);
 log('10 A after auto-raise:',await A.evaluate(()=>{const e=myOpen()[0];return {status:e.status,amt:e.amt,max:e.max,high:AU.s[K(e.d,e.k)].high}}),'| toast seen by A? inbox:',await A.evaluate(()=>AU.inbox[0]?.msg));
 // ---- classified on the same account
 await B.evaluate(()=>Bid.start('cls',[AU.dates[1]]));await next(B);await waitStep(B,'Set your bid');await next(B);await waitStep(B,'Add your ad');
 await B.fill('#b-line','Hiring backend engineers in Bengaluru');await next(B);await waitStep(B,'Review and place');await B.check('#b-agree');await next(B);await waitStep(B,'Bids placed');await B.click('#sheet [data-x]');
 log('11 classified:',await B.evaluate(()=>{const e=myBid(AU.dates[1],'cls');return e&&{status:e.status,amt:e.amt,rank:clsRank(e.d,e.ref)}}));
 await fetch(C+'/mux-ready');await sleep(300);
 log('12 ads:',await q("select fields->>'about' a,fields->>'line' l,state from public.bought_ads order by created_at"));
 const issue=await A.evaluate(()=>AU.dates[1]);
 // ---- the clock passes close
 const shift=await A.evaluate(d=>Math.ceil((closeAt(d)-Date.now())/1000)+120,issue);
 await fetch(C+'/shift?seconds='+shift);await A.reload();await A.waitForSelector('#adv .adv-tabs');await sleep(800);
 await A.evaluate(()=>Adv.tab('mine'));await sleep(300);
 log('13 settled:',await q("select spot,status,price_minor::int p,free_minor::int free,total_minor::int tot,invoice from public.bought_ad_results order by spot"));
 log('  A wallet:',await A.evaluate(()=>[AU.wallet.bal,AU.past.map(e=>[e.k,e.status,e.total]),AU.wallet.tx.map(x=>x.label)]));
 await A.screenshot({path:T+'/13-mybids.png',fullPage:false});
 // ---- issue goes live; a stranger reads it. The test reads the issue on screen.
 const onDay=await A.evaluate(()=>ISSUE_DAY);
 await q(`update public.bought_ad_results set issue='${onDay}'`);
 const cron=await fetch(U+'/api/bought/cron');log('14 cron from outside:',cron.status);
 const r=await q(`select public.bought_ad_mark_live('${onDay}') n`);log('  live:',r[0].n);
 const R=await (await ctx(b,'reader')).context().newPage();
 await R.context().route('https://stream.mux.com/**',async x=>{const u=new URL(x.request().url());const n=u.pathname.endsWith('.m3u8')?'index.m3u8':u.pathname.split('/').pop();x.fulfill({status:200,headers:{'access-control-allow-origin':'*','content-type':n.endsWith('m3u8')?'application/vnd.apple.mpegurl':'video/mp2t'},body:fs.readFileSync(T+'/hls/'+n)})});
 R.on('pageerror',e=>errs.push('reader: '+e.message));
 await R.goto(U+'/#paper');await R.waitForSelector('#v-paper [data-spot="feed-e"]',{timeout:15000});await R.waitForFunction(()=>ISSUE_ADS['feed-e'],null,{timeout:8000});await sleep(500);
 const el=R.locator('#v-paper [data-spot="feed-e"]').first();await el.scrollIntoViewIfNeeded();await sleep(800);
 log('15 reader sees:',(await el.innerText()).replace(/\n/g,' | ').slice(0,220));
 log('  unsold spots:',await R.evaluate(()=>{const names=Object.values(TODAY_ADS).map(a=>a.adv);const txt=document.getElementById('v-paper').innerText;
  return {empty:[...document.querySelectorAll('#v-paper [data-spot][hidden]')].map(e=>e.dataset.spot),sampleAdvertisersShown:names.filter(n=>txt.includes(n)),wonAtShown:(txt.match(/Won at/g)||[]).length}}));
 log('  classifieds:',(await R.locator('#v-paper .cls-list').first().innerText()).replace(/\n/g,' | ').slice(0,180));
 await el.screenshot({path:T+'/15-ad.png'});
 await el.locator('.bv').click();await sleep(2500);
 log('  ad plays (Mux HLS):',await el.evaluate(n=>{const v=n.querySelector('video');return {t:v.currentTime,w:v.videoWidth,paused:v.paused,cap:n.querySelector('.bv-cc span').textContent}}));
 await el.locator('a[rel~="sponsored"]').first().evaluate(a=>{a.addEventListener('click',e=>e.preventDefault());a.click()});await sleep(600);
 log('  counters:',await q("select spot,views::int,plays::int,clicks::int from public.bought_ad_results where status='live' order by spot"));
 // ---- security
 const stranger=await fetch(U+'/api/bought/admin/money',{headers:{authorization:'Bearer cronsecret'}});log('16 admin API from outside even with secret:',stranger.status);
 const cross=await fetch(U+'/api/bought/ads/bid',{method:'POST',headers:{'content-type':'application/json',origin:'https://evil.example'},body:'{}'});log('  anon bid:',cross.status);
 for(const p of ['/admin','/admin/login','/admin/ads']){const r=await fetch(U+p);log('  public '+p+':',r.status)}
 const noauth=await fetch('http://127.0.0.1:8797/api/bought/admin/money');log('  backend direct, no secret:',noauth.status);
 await R.locator('#v-paper [data-spot="feed-e"] video').first().evaluate(v=>v.pause());log('  poster loaded:',await R.evaluate(()=>{const v=document.querySelector('#v-paper [data-spot="feed-e"] video');return !!v.poster}));await fetch(C+'/shift?seconds=0');
 log('page errors:',errs.length?errs:'none');
 await b.close();
})().catch(e=>{console.log('FAILED',e.message.slice(0,500));console.log('errs',errs);process.exit(1)});
