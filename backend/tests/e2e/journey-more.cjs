const pw=require(process.env.PLAYWRIGHT_CORE||'playwright-core');const fs=require('fs');const crypto=require('crypto');
const T=process.argv[2];const U='http://localhost:8010',C='http://127.0.0.1:8798';
const q=async s=>(await fetch(C+'/query',{method:'POST',body:s})).json();const log=(...a)=>console.log(...a);const errs=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stall=false,got=0;
async function ctx(b,name,opts={}){const c=await b.newContext({viewport:{width:1280,height:900},...opts});
 await c.route('https://fake.supabase.test/**',async r=>{const q=r.request();const u=new URL(q.url());const h={...q.headers()};delete h.host;
  if(q.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  const res=await fetch(C+'/sb'+u.pathname+u.search,{method:q.method(),headers:h,body:q.postDataBuffer()||undefined});
  r.fulfill({status:res.status,headers:{'content-type':res.headers.get('content-type')||'application/json','access-control-allow-origin':'*','access-control-expose-headers':'*'},body:Buffer.from(await res.arrayBuffer())})});
 await c.route('https://storage.googleapis.com/fake-mux/**',async r=>{const q=r.request();if(q.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  if(stall)return r.abort();got+=(q.postDataBuffer()||Buffer.alloc(0)).length;r.fulfill({status:200,headers:{'access-control-allow-origin':'*'},body:''})});
 await c.route('https://checkout.razorpay.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.Razorpay=function(o){this.open=function(){setTimeout(function(){o.handler({})},50)}}'}));
 const p=await c.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|Failed to load resource|TensorFlow/.test(m.text()))errs.push(name+' console: '+m.text().slice(0,200))});
 await p.goto(U+'/#advertise');await p.waitForSelector('#adv .adv-tabs');await sleep(400);return p}
const next=p=>p.click('#sheet [data-next]');
const step=async(p,t)=>{try{await p.waitForFunction(x=>document.querySelector('#sheet h3')?.textContent===x,t,{timeout:15000})}catch(e){console.log('STUCK',t,await p.evaluate(()=>[document.querySelector('#sheet h3')?.textContent,document.querySelector('#sheet .msg')?.textContent]));throw e}};
async function pay(){const o=(await q("select payment_reference,charge_minor from public.bought_topups where state='created' order by created_at desc limit 1"))[0];
 const body=JSON.stringify({event:'payment.captured',payload:{payment:{entity:{id:'pay_'+crypto.randomUUID().replaceAll('-','').slice(0,14),order_id:o.payment_reference,status:'captured',amount:Number(o.charge_minor),currency:'INR'}}}});
 return fetch(U+'/api/bought/webhooks/razorpay',{method:'POST',headers:{'content-type':'application/json','x-razorpay-signature':crypto.createHmac('sha256','rzpsecret').update(body).digest('hex')},body})}
(async()=>{
 const b=await pw.chromium.launch({args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 await fetch(C+'/shift?seconds=0');
 // ---- wallet chip, signed out: asks who you are first, then opens the wallet
 const P=await ctx(b,'P');
 await P.click('#adv [data-wallet]');await step(P,'Account and payment');
 await P.fill('#b-biz','Third Co');await P.fill('#b-email','third@example.com');await next(P);await step(P,'Confirm your email');
 await P.fill('#b-code','123456');await next(P);await P.waitForSelector('#sheet .wallet');log('1 wallet opens after sign-in:',await P.evaluate(()=>[Live.user,AU.acct.name,AU.wallet.bal]));
 await P.screenshot({path:T+'/w-wallet.png'});
 await P.click('#sheet .wallet [data-topup="1000"]').catch(()=>P.locator('#sheet .wallet [data-topup]').last().click());await sleep(1000);await pay();
 await P.waitForFunction(()=>AU.wallet.bal>0,null,{timeout:20000});log('  credits:',await P.evaluate(()=>AU.wallet.bal));
 await P.click('#sheet [data-x]');
 // ---- a dropped connection mid-upload, then a refresh: the saved copy carries on
 stall=true;
 const iss=await P.evaluate(()=>AU.dates[2]);
 await P.evaluate(d=>Bid.start('front',[d]),iss);await next(P);await step(P,'Set your bid');await next(P);await step(P,'Add your ad');
 await P.setInputFiles('#b-file',T+'/upload.mp4');await P.waitForFunction(()=>Bid.st.cre.dur>0);
 await P.fill('#b-about','Third video');await P.fill('#b-thumb','Third');await P.fill('#b-who','Tess');await P.fill('#b-web','third.example');await next(P);await step(P,'Review and place');
 await P.check('#b-agree');await next(P);await step(P,'Bids placed');await sleep(1500);
 log('2 upload status while blocked:',await P.innerText('#b-up'),'| pending:',await P.evaluate(()=>Object.values(store.get('bought-pending',{})).length));
 stall=false;got=0;await P.reload();await P.waitForSelector('#adv .adv-tabs');
 await P.waitForFunction(()=>Object.keys(store.get('bought-pending',{})).length===0,null,{timeout:25000}).catch(()=>{});
 log('  after refresh: bytes at mux',got,'| pending',await P.evaluate(()=>Object.keys(store.get('bought-pending',{})).length),'|',(await q("select state,media_state from public.bought_ads where fields->>'about'='Third video'"))[0]);
 // ---- Mux says the file has no sound / bad media → rejected with a reason on the page
 await fetch(C+'/mux-ready?duration=9999');await sleep(300);await P.reload();await P.waitForSelector('#adv .adv-tabs');await sleep(500);
 log('3 bad media:',(await q("select state,media_state,review_reason from public.bought_ads where fields->>'about'='Third video'"))[0]);
 await P.evaluate(()=>Adv.tab('mine'));await sleep(300);log('  pill:',await P.locator('#adv .pill.sub').first().innerText());
 await P.screenshot({path:T+'/w-mine.png'});
 // ---- edit the ad with a new file: a new take, back through review
 await P.evaluate(d=>Bid.editAd(d,'front'),iss);await step(P,'Edit your ad');
 await P.setInputFiles('#b-file',T+'/upload.mp4');await P.waitForFunction(()=>Bid.st.cre.dur>0&&Bid.st.cre.blob);await P.fill('#b-about','Third video v2');await next(P);await P.waitForSelector('#sheet',{state:'hidden'}).catch(()=>{});await sleep(1500);
 const ad2=(await q("select id,state,media_state from public.bought_ads where fields->>'about'='Third video v2'"))[0];log('4 edited ad:',ad2,'| bid points at it:',(await q(`select count(*)::int c from public.bought_ad_bids where ad_id='${ad2.id}'`))[0].c);
 await fetch(C+'/mux-ready');await sleep(300);
 // ---- send back from /admin, the advertiser sees why
 const adm=await (await b.newContext()).newPage();await adm.goto(U+'/admin');await adm.fill('input[name=password]','test-pass');await adm.click('button');await adm.waitForSelector('h1');await adm.goto(U+'/admin/ads');
 const card=adm.locator('.card',{hasText:'Third Co'}).first();await card.locator('input[name=reason]').fill('Please show your <b>face</b>');await card.locator('button:has-text("Send back")').click();await adm.waitForSelector('.note');log('5 sent back:',await adm.innerText('.note'));
 await P.reload();await P.waitForSelector('#adv .adv-tabs');await sleep(500);log('  advertiser sees:',await P.evaluate(()=>AU.inbox[0].msg));
 // ---- raise: credits check, bid goes up
 await P.evaluate(d=>Bid.raise(d,'front'),iss);await step(P,'Raise your bid');
 const min=await P.evaluate(()=>Bid.minFor(Bid.ds()[0]));await P.fill('#b-one',String(min+200));await next(P);await step(P,'Review and place');await P.check('#b-agree');await next(P);await step(P,'Bids placed');await P.click('#sheet [data-x]');
 log('6 raised:',await P.evaluate(d=>{const e=myBid(d,'front');return [e.mode,e.amt,e.max,e.status]},iss),'held',await P.evaluate(()=>heldTotal()));
 // ---- withdraw what's free; /admin lists it to pay by hand
 await P.click('#adv [data-wallet]');await P.waitForSelector('#sheet [data-withdraw]');await P.click('#sheet [data-withdraw]');await sleep(800);
 log('7 withdrew:',await P.evaluate(()=>[AU.wallet.bal,availCredits()]),(await q('select amount_minor::int a,state from public.bought_withdrawals'))[0]);
 await adm.goto(U+'/admin/ads');log('  admin:',await adm.locator('.card h2').allInnerTexts());
 // ---- a second device signs in: same account, no retyping kept over the record
 const D=await ctx(b,'D');await D.click('#adv [data-wallet]');await step(D,'Account and payment');await D.fill('#b-biz','SHOULD NOT REPLACE');await D.fill('#b-email','third@example.com');await next(D);await step(D,'Confirm your email');await D.fill('#b-code','123456');await next(D);await D.waitForSelector('#sheet .wallet');
 log('8 second device:',await D.evaluate(()=>[AU.acct.name,AU.wallet.bal,myOpen().length]));
 // ---- phone width
 const M=await ctx(b,'M',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});await M.evaluate(()=>Bid.start('feed-a',[AU.dates[1]]));await next(M);await step(M,'Set your bid');await next(M);await step(M,'Add your ad');await M.screenshot({path:T+'/w-phone-ad.png'});
 log('9 phone record button uses camera input:',await M.evaluate(()=>{let hit=false;document.getElementById('b-cap').click=()=>{hit=true};Rec.start();return hit}));
 // ---- the old endpoints are gone; escaping
 for(const path of ['drops','review','snapshot','published','market','push/key'])log('10',path,(await fetch(U+'/api/bought/'+path)).status);
 log('page errors:',errs.length?errs:'none');await b.close();
})().catch(e=>{console.log('FAILED',e.message.slice(0,400));console.log('errs',errs);process.exit(1)});
