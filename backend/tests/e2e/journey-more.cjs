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
const q=async s=>(await fetch(C+'/query',{method:'POST',body:s})).json();const log=(...a)=>console.log(...a);const errs=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let stall=false;const puts=[];const R2HOST=/\.r2\.cloudflarestorage\.com$/;
// ---- leave the bucket as it was: delete every file this journey uploaded (ads/<its ad ids>/)
async function cleanR2(){const ids=(await q('select id from public.bought_ads')).map(r=>r.id);if(!ids.length)return 0;
 const py=require('path').resolve(__dirname,'../../..');const out=require('child_process').execFileSync(process.env.HOME+'/.cache/bought/funnel-venv/bin/python',['-c',
  'import sys\nfrom pipeline import r2\nr2.load_local_env()\nc=r2.R2()\nn=0\nids=sys.argv[1:]\nkeys=[o["key"] for i in ids for o in c.list("ads/"+i+"/")]+[o["key"] for o in c.list("ad-images/") if any("/"+i+"/" in o["key"] for i in ids)]\nfor k in keys:\n c.delete(k);n+=1\nprint(n)',...ids],{cwd:py}).toString().trim();return Number(out)}

async function ctx(b,name,opts={}){const c=await b.newContext({viewport:{width:1280,height:900},...opts});
 await c.route('https://fake.supabase.test/**',async r=>{const q=r.request();const u=new URL(q.url());const h={...q.headers()};delete h.host;
  if(q.method()==='OPTIONS')return r.fulfill({status:200,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'*'}});
  const res=await fetch(C+'/sb'+u.pathname+u.search,{method:q.method(),headers:h,body:q.postDataBuffer()||undefined,redirect:'manual'});
  const loc=res.headers.get('location');
  r.fulfill({status:res.status,headers:{'content-type':res.headers.get('content-type')||'application/json','access-control-allow-origin':'*','access-control-expose-headers':'*',...(loc?{location:loc}:{})},body:Buffer.from(await res.arrayBuffer())})});
 // the real R2 bucket; "stall" drops the connection to it, as a train tunnel would
 await c.route(u=>R2HOST.test(u.host),r=>stall?r.abort('internetdisconnected'):r.continue());
 c.on('response',r=>{const q=r.request();if(q.method()==='PUT'&&R2HOST.test(new URL(q.url()).host))puts.push(r.status())});
 await c.route('https://checkout.razorpay.com/**',r=>r.fulfill({status:200,contentType:'text/javascript',body:'window.Razorpay=function(o){this.open=function(){setTimeout(function(){o.handler({})},50)}}'}));
 const p=await c.newPage();p.on('pageerror',e=>errs.push(name+': '+e.message));p.on('console',m=>{if(m.type()==='error'&&!/favicon|ERR_|Failed to load resource/.test(m.text()))errs.push(name+' console: '+m.text().slice(0,200))});
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
 await P.click('#adv [data-wallet]');await step(P,'Log in or sign up');
 await P.fill('#b-email','third@example.com');await next(P);await step(P,'Check your email');
 await P.locator('#sheet .otp input').first().fill('123456');await step(P,'About you');await P.fill('#b-name','Third Co');await P.selectOption('#b-role','indie_hacker');await next(P);
 await step(P,"You're in");log('0 welcome:',await P.textContent('#sheet .wl-coin'),'| coins falling',await P.locator('.coinrain i').count(),'| role kept',await P.evaluate(()=>AU.acct.role));
 await next(P);await P.waitForSelector('#sheet .wallet');log('1 wallet opens after sign-in:',await P.evaluate(()=>[Live.user,AU.acct.name,AU.wallet.bal,AU.wallet.free]),'| withdraw button:',await P.locator('#sheet [data-withdraw]').count());
 await P.screenshot({path:T+'/w-wallet.png'});
 await P.click('#sheet .wallet [data-topup="100"]');await sleep(1000);await pay();
 await P.waitForFunction(()=>AU.wallet.bal>100,null,{timeout:20000});log('  points after buying 100:',await P.evaluate(()=>[AU.wallet.bal,AU.wallet.free,withdrawable()]));
 await P.click('#sheet [data-x]');
 // ---- card through Stripe with only STRIPE_SECRET_KEY: pay on Stripe's page, come back; no webhook, the server asks Stripe
 await P.route('https://checkout.stripe.com/**',r=>r.fulfill({status:200,contentType:'text/html',body:`<script>location.replace('${U}/#advertise')</script>`}));
 await P.click('#adv [data-wallet]');await P.waitForSelector('#sheet .wallet');
 log('  wallet with payments connected: blurred blocks',await P.locator('#sheet .soon').count());
 const before=await P.evaluate(()=>AU.wallet.bal);await P.check('#sheet input[name=wpm][value=card]');
 await Promise.all([P.waitForURL(/checkout\.stripe\.com/,{timeout:15000}),P.click('#sheet .wallet [data-topup="10"]')]);
 await P.waitForURL(U+'/#advertise',{timeout:15000});await P.waitForSelector('#adv .adv-tabs');
 const hook=await fetch(U+'/api/bought/webhooks/stripe',{method:'POST',headers:{'content-type':'application/json','stripe-signature':'t=1,v1=00'},body:'{}'});
 await fetch(C+'/stripe-pay');
 await P.waitForFunction(b=>AU.wallet.bal>=b+10,before,{timeout:30000}).catch(()=>{});
 log('1b card via Stripe, no webhook:',before,'->',await P.evaluate(()=>AU.wallet.bal),'|',(await q("select provider,method,state,charge_minor::int c,charge_currency from public.bought_topups where provider='stripe'"))[0],'| webhook without a secret:',hook.status,'| activity:',await P.evaluate(()=>AU.wallet.tx[0]?.label));
 await P.unroute('https://checkout.stripe.com/**');
 // ---- a dropped connection mid-upload, then a refresh: the saved copy carries on. The file has no sound,
 // so once it lands the server's check (ffprobe, in R2) sends it back with the reason
 stall=true;
 const iss=await P.evaluate(()=>AU.dates[2]);
 await P.evaluate(d=>Bid.start('front',[d]),iss);await next(P);await step(P,'Set your bid');await next(P);await step(P,'Add your ad');
 await P.setInputFiles('#b-file',T+'/silent.mp4');await P.waitForFunction(()=>Bid.st.cre.dur>0);
 await P.fill('#b-about','Third video');await P.fill('#b-thumb','Third');await P.fill('#b-who','Tess');await P.fill('#b-web','third.example');await next(P);await step(P,'Review and place');
 await P.check('#b-agree');await next(P);await step(P,'Bids placed');await sleep(1500);
 log('2 upload status while blocked:',await P.innerText('#b-up'),'| pending:',await P.evaluate(()=>Object.values(store.get('bought-pending',{})).length));
 stall=false;puts.length=0;await P.reload();await P.waitForSelector('#adv .adv-tabs');
 await P.waitForFunction(()=>Object.keys(store.get('bought-pending',{})).length===0,null,{timeout:25000}).catch(()=>{});
 log('  after refresh: R2 PUTs',puts,'| pending',await P.evaluate(()=>Object.keys(store.get('bought-pending',{})).length),'|',(await q("select state,media_state from public.bought_ads where fields->>'about'='Third video'"))[0]);
 // ---- the file had no sound → rejected with a reason on the page, and no "Try again" for the same file
 await sleep(300);await P.reload();await P.waitForSelector('#adv .adv-tabs');await sleep(500);
 log('3 bad media:',(await q("select state,media_state,problem from public.bought_ads where fields->>'about'='Third video'"))[0]);
 await P.evaluate(()=>Adv.tab('mine'));await sleep(300);log('  pill:',await P.locator('#adv .pill.sub').first().innerText());
 await P.screenshot({path:T+'/w-mine.png'});
 // ---- edit the ad with a new file: a new take
 await P.evaluate(d=>Bid.editAd(d,'front'),iss);await step(P,'Edit your ad');
 await P.setInputFiles('#b-file',T+'/upload.mp4');await P.waitForFunction(()=>Bid.st.cre.dur>0&&Bid.st.cre.blob);await P.fill('#b-about','Third video v2');await next(P);await P.waitForSelector('#sheet',{state:'hidden'}).catch(()=>{});await sleep(1500);
 const ad2=(await q("select id,state,media_state from public.bought_ads where fields->>'about'='Third video v2'"))[0];log('4 edited ad:',ad2,'| bid points at it:',(await q(`select count(*)::int c from public.bought_ad_bids where ad_id='${ad2.id}'`))[0].c);
 await P.waitForFunction(()=>!Object.keys(store.get('bought-pending',{})).length,null,{timeout:30000}).catch(()=>{});await sleep(300);
 log('5 new take ready, no review:',(await q("select state,media_state from public.bought_ads where fields->>'about'='Third video v2'"))[0]);
 await P.reload();await P.waitForSelector('#adv .adv-tabs');await sleep(500);await P.evaluate(()=>Adv.tab('mine'));await sleep(300);log('  pill:',await P.locator('#adv .pill.sub').first().innerText());
 const adm=await (await b.newContext()).newPage();await deskLogin(adm);
 // ---- raise: credits check, bid goes up
 await P.evaluate(d=>Bid.raise(d,'front'),iss);await step(P,'Raise your bid');
 const min=await P.evaluate(()=>Bid.minFor(Bid.ds()[0]));await P.fill('#b-one',String(min+20));await next(P);await step(P,'Review and place');await P.check('#b-agree');await next(P);await step(P,'Bids placed');await P.click('#sheet [data-x]');
 log('6 raised:',await P.evaluate(d=>{const e=myBid(d,'front');return [e.mode,e.amt,e.max,e.status]},iss),'held',await P.evaluate(()=>heldTotal()));
 // ---- withdraw what's free; /admin lists it to pay by hand
 await P.click('#adv [data-wallet]');await P.waitForSelector('#sheet [data-withdraw]');await P.click('#sheet [data-withdraw]');await sleep(800);
 log('7 withdrew:',await P.evaluate(()=>[AU.wallet.bal,AU.wallet.free,availCredits()]),(await q('select amount_minor::int a,state from public.bought_withdrawals'))[0],'| free points kept back');
 await adm.goto(DESK+'/admin/ads');log('  admin:',await adm.locator('.card h2').allInnerTexts());
 // ---- a second device signs in: same account, no retyping kept over the record
 const D=await ctx(b,'D');await D.click('#adv [data-wallet]');await step(D,'Log in or sign up');await D.fill('#b-email','third@example.com');await next(D);await step(D,'Check your email');await D.locator('#sheet .otp input').first().fill('123456');await D.waitForSelector('#sheet .wallet');
 log('8 second device:',await D.evaluate(()=>[AU.acct.name,AU.wallet.bal,myOpen().length]),'| asked About you again:',await D.evaluate(()=>!!(Bid.st&&Bid.st.steps.includes('acct')&&Bid.st.steps[Bid.st.i]==='acct')));
 // ---- the profile picture: signed in it shows the account; Sign out ends the session for real (still out after a reload)
 await D.click('#sheet [data-x]').catch(()=>{});await D.waitForTimeout(300);
 const ring=await D.evaluate(()=>document.getElementById('ab-me').classList.contains('in'));
 await D.click('#ab-me');await D.waitForSelector('#sheet .me-sheet');const who=await D.evaluate(()=>[document.querySelector('#sheet .me-head b').textContent,document.querySelector('#sheet .me-head small').textContent]);
 await D.click('#sheet [data-signout]');await D.waitForTimeout(800);
 const after=await D.evaluate(()=>[Live.user,document.getElementById('ab-me').classList.contains('in')]);
 await D.reload();await D.waitForSelector('#adv .adv-tabs');await D.waitForTimeout(800);
 const reloaded=await D.evaluate(()=>[Live.user,document.getElementById('ab-me').getAttribute('aria-label')]);
 await D.click('#ab-me');await D.waitForSelector('#sheet h3');
 log('8b profile: ring when signed in',ring,'| account',who,'| after sign out [user, ring]',after,'| after reload [user, label]',reloaded,'| picture opens:',await D.textContent('#sheet h3'));
 await D.click('#sheet [data-x]').catch(()=>{});
 // ---- Google: a small window signs in, the sheet carries on by itself (here "Google" signs in gita@googlemail.example)
 const G=await ctx(b,'G');await G.click('#adv [data-wallet]');await step(G,'Log in or sign up');
 const [pop]=await Promise.all([G.waitForEvent('popup'),G.click('#sheet [data-google]')]);
 log('  waiting text:',(await G.innerText('#sheet .hint')).slice(0,60));
 await pop.waitForURL(/auth\/done\.html/,{timeout:15000}).catch(async e=>{log('  popup at:',pop.url(),'|',(await pop.content().catch(()=>'')).slice(0,300));throw e});log('  window came back to:',new URL(pop.url()).pathname);
 await step(G,'About you');log('11 google signed in:',await G.evaluate(()=>[Live.user,Live.email,Bid.st.acct.email]));
 await G.fill('#b-name','Gita Labs');await G.selectOption('#b-role','investor');await next(G);await step(G,"You're in");await next(G);await G.waitForSelector('#sheet .wallet');log('  google account:',await G.evaluate(()=>[AU.acct.name,AU.acct.email,AU.wallet.bal,AU.wallet.free]));
 if(!pop.isClosed())await pop.waitForEvent('close',{timeout:5000}).catch(()=>{});log('  window closed itself:',pop.isClosed());
 // ---- phone width
 const M=await ctx(b,'M',{viewport:{width:390,height:844},isMobile:true,hasTouch:true});await M.evaluate(()=>Bid.start('feed-a',[AU.dates[1]]));await next(M);await step(M,'Set your bid');await next(M);await step(M,'Add your ad');await M.screenshot({path:T+'/w-phone-ad.png'});
 log('9 phone record button uses camera input:',await M.evaluate(()=>{let hit=false;document.getElementById('b-cap').click=()=>{hit=true};Rec.start();return hit}));
 // ---- the old endpoints are gone; escaping
 for(const path of ['drops','review','snapshot','published','market','push/key'])log('10',path,(await fetch(U+'/api/bought/'+path)).status);
 log('page errors:',errs.length?errs:'none');log('ad pictures in R2:',(await q("select count(*)::int c from public.bought_ads where thumbnail_verified and thumbnail_path like '%/verified-%'"))[0].c,'checked and copied');log('R2 files removed:',await cleanR2());await b.close();
})().catch(e=>{console.log('FAILED',e.message.slice(0,400));console.log('errs',errs);process.exit(1)});
