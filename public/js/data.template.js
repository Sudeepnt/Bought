/* Bought. Daily — the standard newspaper template, daily themes, ad spots and auction rules.
   The template never changes; the theme changes by weekday. Every ad spot is a fixed slot
   in this template, auctioned separately for each issue. */

/* Daily themes, indexed by weekday (0 = Sunday). The hue tints edition labels and polls only. */
const THEMES=[
 {day:"Sunday",name:"The World Edition",short:"World",hue:"#5d6f8c",lede:"Geopolitics leads"},
 {day:"Monday",name:"The Week Ahead",short:"Week Ahead",hue:"#3e6f68",lede:"What to watch this week"},
 {day:"Tuesday",name:"The Builders Edition",short:"Builders",hue:"#ad6330",lede:"Founders and startups lead"},
 {day:"Wednesday",name:"The Money Edition",short:"Money",hue:"#2f6b4f",lede:"Deals, markets and funding lead"},
 {day:"Thursday",name:"The Frontier Edition",short:"Frontier",hue:"#5a4fa6",lede:"AI and science lead"},
 {day:"Friday",name:"Launch Day",short:"Launch Day",hue:"#a6443a",lede:"Product launches lead"},
 {day:"Saturday",name:"The Long Read",short:"Long Read",hue:"#7a5a3a",lede:"Fewer, longer stories"}
];
/* Reserve prices scale by weekday (Sun → Sat). */
const DAY_MULT=[0.9,1,1,1.1,1.1,1.25,0.8];

/* The paper is read one page at a time, like a printed edition. */
const PAGES=[
 {name:"Front page",short:"Front",c:"var(--theme)"},
 {name:"AI",short:"AI",c:"var(--c-ai)",sec:"AI"},
 {name:"Technology",short:"Technology",c:"var(--c-tech)",sec:"Technology"},
 {name:"Business",short:"Business",c:"var(--c-biz)",sec:"Business"},
 {name:"Founders",short:"Founders",c:"var(--c-found)",sec:"Founders"},
 {name:"Launches",short:"Launches",c:"var(--c-launch)",sec:"Launches"},
 {name:"Geopolitics",short:"Geopolitics",c:"var(--c-geo)",sec:"Geopolitics"},
 {name:"Clips and classifieds",short:"Back page",c:"var(--ink-2)"}
];
const SPOT_PAGE={top:0,front:0,"feed-a":1,half:3,"feed-e":5,clip:7,cls:2};

/* The template: every block of the paper, top to bottom. */
const TEMPLATE=[
 {id:"masthead",name:"Masthead",kind:"Editorial",note:"Wordmark, date, edition name, issue number, issue navigation"},
 {id:"top",name:"Top banner",kind:"Ad spot",spots:["top"],note:"One slim banner under the masthead"},
 {id:"lead",name:"Lead story",kind:"Editorial",note:"Largest headline, muted autoplay video, quick poll"},
 {id:"brief",name:"Today in 30 seconds",kind:"Editorial",note:"Three one-line summaries"},
 {id:"tops",name:"Top stories",kind:"Editorial",note:"Three ranked stories"},
 {id:"pulse",name:"The Pulse",kind:"Engagement",note:"Reader poll of the day"},
 {id:"numbers",name:"The day in numbers",kind:"Editorial",note:"Five figures, each linked to its story"},
 {id:"front",name:"Front-page native",kind:"Ad spot",spots:["front"],note:"Full-width native card"},
 {id:"sec-A",name:"Page 2 · AI",kind:"Editorial",spots:["feed-a"],note:"One in-feed ad"},
 {id:"sec-B",name:"Page 3 · Technology",kind:"Editorial",note:""},
 {id:"cls-0",name:"Classifieds · lines 1–4",kind:"Ad spot",spots:["cls"],note:"Highest four classified bids"},
 {id:"sec-C",name:"Page 4 · Business",kind:"Editorial",note:""},
 {id:"half",name:"Half page",kind:"Ad spot",spots:["half"],note:"Wide ad at the foot of the Business page"},
 {id:"sec-D",name:"Page 5 · Founders",kind:"Editorial",note:""},
 {id:"sec-E",name:"Page 6 · Launches",kind:"Editorial",spots:["feed-e"],note:"One in-feed ad"},
 {id:"sec-F",name:"Page 7 · Geopolitics",kind:"Editorial",note:""},
 {id:"clips",name:"60-second clips",kind:"Editorial",spots:["clip"],note:"Vertical clip rail with one clip break"},
 {id:"cls-1",name:"Classifieds · lines 5–8",kind:"Ad spot",spots:["cls"],note:"Back page"},
 {id:"footer",name:"Footer",kind:"Editorial",note:"Open thread, subscribe, newsroom stats, links"}
];

const FORMATS={
 video:{name:"Video or image",short:"Video",spec:["Record yourself on camera, or upload a video: up to 60 seconds (anything longer is cut at 60 s)","Or upload an image: JPG, PNG or WebP, up to 10 MB","16:9 (9:16 for the clip break)","For video we generate the text thumbnail and captions"]},
 creative:{name:"Image",short:"Image",spec:["JPG, PNG or WebP, up to 10 MB"]},
 classified:{name:"Classified line",short:"Classified",spec:["One line, up to 120 characters, no upload","Optional link","The 8 highest bids run; your rank sets your block"]}
};

/* 6 display spots (5 video + 1 image today; every display spot takes a video up to 60 s or an image) + 8 classified lines. */
const SPOTS={
 top:{name:"Top banner",zone:"Page 1, under the masthead",fmt:"video",shape:"std",reserve:600,inc:10,view:"First screen on every device"},
 front:{name:"Front-page native",zone:"Page 1, after the day in numbers",fmt:"video",shape:"std",reserve:450,inc:10,view:"Front page, after the top stories"},
 "feed-a":{name:"In-feed, AI",zone:"Page 2, between the AI stories",fmt:"video",shape:"std",reserve:220,inc:10,view:"Between the AI stories"},
 half:{name:"Half page",zone:"Page 4, foot of the Business page",fmt:"video",shape:"wide",reserve:700,inc:10,view:"The largest ad in the paper"},
 "feed-e":{name:"In-feed, Launches",zone:"Page 6, between the Launches stories",fmt:"video",shape:"std",reserve:180,inc:10,view:"Between the Launches stories"},
 clip:{name:"Clip break",zone:"Page 8, in the 60-second clips",fmt:"video",shape:"vert",reserve:200,inc:10,view:"Fourth tile in the clip rail"},
 cls:{name:"Classifieds",zone:"Pages 3 and 8, four lines each",fmt:"classified",reserve:5,inc:1,seats:8,view:"Lines 1–4 on page 3, 5–8 on the back page"}
};
const SPOT_ORDER=["top","front","feed-a","half","feed-e","clip","cls"];
function reserveFor(k,iso){const b=SPOTS[k].reserve*DAY_MULT[wdOf(iso)];return k==="cls"?Math.max(5,Math.round(b)):Math.round(b/10)*10}

/* Mock presenters for broadcast ads (illustrated; real ads use the advertiser's upload). */
const PEOPLE={
 meera:{skin:"#b97a52",hair:"#1d1410",shirt:"#2f5d4f",bg:"#dfe6df",style:"long"},
 arjun:{skin:"#a86c46",hair:"#141010",shirt:"#22304d",bg:"#d9dde6",style:"short",beard:true},
 dana:{skin:"#6e452c",hair:"#120c0a",shirt:"#7a3b2e",bg:"#e8ddd2",style:"bun"},
 lin:{skin:"#e2b994",hair:"#1a1414",shirt:"#4b3f72",bg:"#e4e0ee",style:"short",glasses:true},
 kavya:{skin:"#c08a62",hair:"#24170f",shirt:"#0f3d3e",bg:"#dde8e5",style:"long"},
 tom:{skin:"#efc8a8",hair:"#7a4b2a",shirt:"#3d3a36",bg:"#ebe6dc",style:"short",beard:true,glasses:true},
 amara:{skin:"#8a5636",hair:"#0f0b0a",shirt:"#1f4a33",bg:"#dfe8e0",style:"bun"},
 sofia:{skin:"#d9a882",hair:"#3a2418",shirt:"#8b2f24",bg:"#efe2dc",style:"long"},
 me:{skin:"#c99a74",hair:"#22180f",shirt:"#33456b",bg:"#e6e3dc",style:"short"}
};

/* Today's winning ads (mock advertisers) and the prices they won at. */
/* An uploaded-image ad, as an advertiser would supply it (inline SVG stands in for their JPG/PNG). */
const HARBOUR_POSTER="data:image/svg+xml;charset=utf-8,"+encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#2b4f78"/><stop offset="1" stop-color="#132439"/></radialGradient><radialGradient id="l" cx="50%" cy="0%" r="60%"><stop offset="0" stop-color="#ffd48a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd48a" stop-opacity="0"/></radialGradient></defs><rect width="640" height="360" fill="url(#g)"/><rect width="640" height="230" fill="url(#l)"/><path d="M300 0v40M340 0v40" stroke="#c9a862" stroke-width="2"/><ellipse cx="320" cy="44" rx="34" ry="9" fill="#e9c27a"/><rect x="70" y="232" width="500" height="22" rx="11" fill="#e8dcc4"/><g fill="#f7f1e4">${[110,170,230,290,350,410,470,530].map(x=>`<ellipse cx="${x}" cy="240" rx="18" ry="5"/>`).join("")}</g><g fill="#0d1a29">${[110,170,230,290,350,410,470,530].map(x=>`<circle cx="${x}" cy="208" r="13"/><rect x="${x-17}" y="219" width="34" height="18" rx="9"/>`).join("")}</g><text x="320" y="118" text-anchor="middle" font-family="Georgia,serif" font-size="44" fill="#f4efe4">Founder dinners</text><text x="320" y="152" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="15" letter-spacing="3" fill="#e9c27a">DUBLIN · BENGALURU · DUBAI</text><text x="320" y="300" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" font-size="15" fill="#d9d2c3">Twelve seats a table · next one 14 Nov · harbour.example</text></svg>`);
const TODAY_ADS={
 top:{web:"https://kilnworks.example",social:"https://www.linkedin.com/company/kilnworks-example",email:"sales@kilnworks.example",adv:"Kilnworks Compute",p:"arjun",who:"Arjun Rao, CTO of Kilnworks",thumb:"GPUs by the minute",line:"H200 hours, billed by the minute.",sub:"Mumbai, Frankfurt or Virginia. No contracts.",cta:"kilnworks.example",len:41,script:["I'm Arjun from Kilnworks.","Most GPU clouds want a year-long contract.","We bill H200 hours by the minute.","Spin one up in Mumbai, Frankfurt or Virginia today."]},
 front:{web:"https://loomline.example",social:"https://x.com/loomline_example",email:"hello@loomline.example",adv:"Loomline Payroll",p:"meera",who:"Meera Iyer, founder of Loomline",thumb:"Payroll in one day",line:"Payroll for 40 countries in one run.",sub:"What took a week now takes a day.",cta:"loomline.example",len:32,script:["Hi, I'm Meera. We run payroll for teams in 40 countries.","It used to eat a week of every month.","Now it's one run, done in a day.","Try Loomline free at loomline.example."]},
 "feed-a":{web:"https://quietroom.example",social:"https://www.instagram.com/quietroom.example",email:"pods@quietroom.example",adv:"Quietroom",p:"lin",who:"Lin Zhao, co-founder of Quietroom",thumb:"Silence on demand",line:"Noise-cancelling pods for open offices.",sub:"Two pods on your floor, free for 14 days.",cta:"quietroom.example",len:30,script:["This is a Quietroom pod.","Step in, close the door, and the office disappears.","We'll put two on your floor for 14 days, free.","quietroom.example."]},
 half:{web:"https://monsoon.example",social:"https://www.linkedin.com/company/monsoon-fund-example",email:"pitch@monsoon.example",adv:"Monsoon Fund",p:"kavya",who:"Kavya Menon, partner at Monsoon Fund",thumb:"Term sheet in 14 days",line:"Pre-seed cheques in 14 days.",sub:"For technical founders in India, Ireland and the Gulf.",cta:"monsoon.example",len:45,script:["I'm Kavya, a partner at Monsoon Fund.","We back technical founders before anyone else will.","One call, one term sheet, 14 days.","India, Ireland or the Gulf. Apply at monsoon.example."]},
 "feed-e":{web:"https://harbour.example",social:"https://www.instagram.com/harbourclub.example",email:"seats@harbour.example",adv:"Harbour Club",kind:"image",img:HARBOUR_POSTER,line:"Founder dinners in Dublin, Bengaluru and Dubai.",sub:"Twelve seats a table. Next one on 14 Nov.",cta:"harbour.example"},
 clip:{web:"https://tessellate.example",social:"https://www.youtube.com/@tessellate-example",email:"fleets@tessellate.example",adv:"Tessellate Maps",p:"sofia",who:"Sofia Reyes, founder of Tessellate",thumb:"Every street, mapped",line:"Street-level maps for delivery fleets.",cta:"tessellate.example",len:24,script:["Your drivers know the shortcuts. Your map doesn't.","Tessellate maps every lane, gate and loading bay.","Built for delivery fleets.","tessellate.example."]}
};
/* Bought's own ads for spots nobody bought, when the site is live. Empty: unsold spots stay empty.
   Same shape as TODAY_ADS (adv, line, sub, web, kind, img or the presenter fields); HOUSE_CLS like CLS_TODAY. */
const HOUSE_ADS={};
const HOUSE_CLS=[];
const TODAY_PRICE={top:2150,front:1380,"feed-a":420,half:1480,"feed-e":310,clip:520};
/* Today's 8 classified lines, in rank order: [price paid, line, advertiser]. */
const CLS_TODAY=[
 [95,"Hiring a founding ML engineer, Bengaluru or remote. Equity-heavy.","Saltpan AI"],
 [88,"Two seats free at a Dublin founders' dinner on 14 Nov.","Harbour Club"],
 [72,"Office seats in Indiranagar from ₹9,000 a month.","Common Desk Co."],
 [64,"Looking for a co-founder who has shipped B2B payments.","Ankita R."],
 [58,"Fractional CFO for seed-stage startups. First month free.","Ledgerline"],
 [51,"Selling four used GPU servers. Bengaluru pickup.","Rackroom"],
 [39,"Kannada and Hindi product copy, fast turnaround.","Meena K."],
 [26,"Beta users wanted for an offline AI notes app.","Orbit Notes"]
];

/* Auction rules, shown to advertisers and used in the developer spec. */
const RULES=[
 {h:"What you're buying",p:["Each issue has 6 display spots and 8 classified lines in fixed positions. The template never changes; the theme changes by weekday.","Every display spot takes a video of you on camera (record it here or upload it, up to 60 seconds; anything longer is cut at 60 s) or an image. Classifieds are text only."]},
 {h:"When bidding opens and closes",p:["Bidding for an issue opens 7 days ahead at 07:00 IST.","It closes at 22:00 IST the night before the issue.","A bid in the last 5 minutes extends that spot's close by 5 minutes, up to 22:30 IST. Other spots aren't affected."]},
 {h:"How you rank",p:["Display spots: the highest bid at close wins. Equal bids go to the earlier one.","Classifieds: the 8 highest bids run, ordered by bid. Lines 1–4 run on page 3, lines 5–8 on the back page.","Every bid must meet the reserve price and beat the highest bid by the increment: $10 for display spots, $1 for classifieds."]},
 {h:"Auto-raise",p:["Set a maximum and we bid for you, one increment at a time, only when someone outbids you.","You win at the lowest price that beats the next bidder, never above your maximum. Nobody sees your maximum.","Classifieds don't auto-raise: you pay the amount you bid."]},
 {h:"Credits and what you pay",p:["You bid from prepaid credits in your wallet (1 credit = $1). Add them by UPI or card before you bid.","Only winners pay, and they pay the winning price printed beside their ad.","A live bid sets aside its maximum plus tax from your credits. If you're outbid, those credits are free again at once. At close we deduct winners' credits; nothing else moves.","Unused credits never expire and can be withdrawn to your bank any time.","Indian advertisers pay 18% GST; advertisers outside India are invoiced without GST. Invoices are issued at close."]},
 {h:"Changing a bid",p:["You can raise a bid or your maximum any time before close.","Bids can't be lowered or withdrawn. The only exceptions: your ad fails review and isn't fixed in time, or we cancel the auction."]},
 {h:"Your ad",p:["You upload your ad when you bid. Uploading is free.","Automatic checks run immediately. A person reviews every ad within 2 hours, and always before 04:00 IST on issue day.","If your ad needs changes, you have until 05:00 IST to fix it. If it isn't fixed, the next-highest bidder's ad runs and your credits are freed."]},
 {h:"Why credits",p:["Every bid is backed by credits already in your wallet, so a winning bid can never fail to pay.","A bid that your free credits can't cover is refused, with the amount you'd need to add."]},
 {h:"Fair play",p:["Bidders stay anonymous until close; winners and winning prices are public after.","Every advertiser account is verified, one per business. Linked accounts bidding against each other are removed and charged nothing.","Bought. never bids on its own spots. Unsold spots run house ads."]},
 {h:"Editorial independence",p:["Ads never change what a story says or which stories run.","An ad never sits beside a story about the advertiser. If it would, the stories in that section are reordered."]},
 {h:"Delivery",p:["Your ad runs for one day, from 07:00 IST, in the issue you won.","If the issue doesn't publish or your ad doesn't show, you get a full refund.","A delivery report and your invoice arrive the next morning."]}
];
const LIFECYCLE=[
 ["D−7 · 07:00","Bidding opens",""],
 ["Until close","Bid, raise, upload your ad",""],
 ["D−1 · 22:00","Bidding closes","+5 min per late bid, until 22:30","key"],
 ["At close","Winners' credits deducted; the rest freed",""],
 ["D · 04:00","Final ad check",""],
 ["D · 07:00","Issue goes live","","key"],
 ["D+1 · 09:00","Report and invoice",""]
];
const FAQ=[
 ["Can I book a whole week?","Yes. Pick several issues when you bid. Each issue is its own auction, so you only pay for the ones you win."],
 ["Why can't I see who I'm bidding against?","Bidders stay anonymous until close so nobody can target a rival. Winners and their prices are public once the auction ends."],
 ["When will I know if I won?","At 22:00 IST, or a few minutes later if a late bid extended your spot. You'll get a notification here and by email."],
 ["Can I change my ad after I win?","Yes, until 04:00 IST on issue day. Changes go through review again."],
 ["What happens to my credits if I lose?","Nothing is deducted. Credits set aside for a bid are free again the moment you're outbid, or at close. Spend them on another spot or withdraw them to your bank."],
 ["Do I need credits before I bid?","Yes. Add credits once by UPI or card, then every bid comes out of your wallet. If a bid needs more than you have free, we'll show exactly how much to add."]
];
