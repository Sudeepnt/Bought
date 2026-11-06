/* Bought. Daily — sample discussion content. In production: GET /threads/:id/comments (see #spec). */

/* readers who comment: handle, flair, avatar hue */
const CM_USERS=[
 ["kiran.builds","Founder","#b4432b"],["meera_vc","Investor","#6553c4"],["arjun.dev","Engineer","#2a7385"],["sana.k","Analyst","#89496f"],
 ["devika_ops","Operator","#38805a"],["rohan.m","Student","#a3730c"],["tara.policy","Policy","#5b6b7a"],["nikhil.ships","Founder","#b4432b"],
 ["aisha_r","Designer","#c0607a"],["vik.capital","Investor","#6553c4"],["leela.codes","Engineer","#2a7385"],["omar.f","Analyst","#89496f"],
 ["priya.n","Reader since No. 1","#7a6a4f"],["dublin_dan","Engineer","#2a7385"],["ananya.writes","Journalist","#5b6b7a"],["sid_hw","Hardware","#38805a"],
 ["mahesh.cfo","Finance","#a3730c"],["zoe.l","Product","#c0607a"],["ravi.blr","Reader since No. 1","#7a6a4f"],["fatima.ai","Researcher","#6553c4"],
 ["joel.k","Operator","#38805a"],["ishaan.t","Student","#a3730c"],["noor_trade","Policy","#5b6b7a"],["chen.w","Engineer","#2a7385"]
];

/* first comments, by section */
const CM_TOP={
 AI:[
  "Benchmarks are a starting point. I want to see how it holds up on our own evals before I believe any of this.",
  "The open-weights angle is the real story. Once weights are out, pricing power moves to whoever runs inference cheapest.",
  "Every week a new leaderboard flips. What I care about is cost per solved task, not a single score.",
  "We switched two internal tools to an open model last quarter. Quality was close; the bill dropped by about 60%.",
  "The export-rule detail is underrated. Policy is now shaping model releases as much as research is.",
  "Curious how much of this lead survives once the closed labs ship their next point release.",
  "Agents are where the money is. Chat was the demo; doing the task is the product.",
  "Would love a follow-up on what this means for Indian AI start-ups building on top of these models."
 ],
 Technology:[
  "Patch Tuesday energy, every day of the week now. Small teams can't keep up with this pace.",
  "This is why we pin versions and run a staging mirror. Boring, but it saved us twice this year.",
  "Hardware cycles are getting shorter and nobody is talking about the e-waste side of it.",
  "I'd like to see the actual numbers behind the rollout, not just the press release.",
  "The supply-chain part is what worries me. One vendor slips and half the industry waits.",
  "Good summary. The second paragraph explains it better than most long reads I saw on this.",
  "Anyone running this in production yet? Interested in real latency numbers.",
  "Feels like the platform owners hold all the cards again. Developers adapt or lose distribution."
 ],
 Business:[
  "Capacity being sold out through 2027 tells you who has pricing power for the next two years.",
  "The capex numbers are wild. At some point investors will ask for the revenue to match.",
  "As someone in finance: watch the depreciation schedules. That's where the real story hides.",
  "Margins look great until the cycle turns. I've seen this movie in telecom.",
  "Smaller players without long contracts are going to feel this first.",
  "Would like to see how Indian enterprises are budgeting for this. Most CFOs I speak to are cautious.",
  "Vendor financing their own customers is always a yellow flag for me.",
  "Clear explanation. Sharing this with my team before our planning meeting."
 ],
 Founders:[
  "Raising that much that early changes the company. Hope they keep the team small.",
  "The hiring detail is the part founders should study, not the valuation.",
  "Valuation headlines aside, revenue quality is what will matter at the next round.",
  "Love seeing vertical software win. Not everything needs to be a platform.",
  "Bengaluru founders are building for the world from day one now. Big shift from five years ago.",
  "I'd love a Bought. series on how these founders found their first ten customers.",
  "Second-time founders raise differently. Speed is the advantage.",
  "Down rounds don't get headlines, but they're happening quietly across the board."
 ],
 Launches:[
  "Four launches in four weeks is a marketing calendar, not a product strategy.",
  "Bought it on day one. Battery is better than expected, the crease is still visible.",
  "Price is the story here. At that point it's a status item, not a phone.",
  "Waiting for the second generation. First versions always have one fatal flaw.",
  "The software update matters more than the hardware this cycle.",
  "Indian pricing hasn't been announced yet. That decides everything for me.",
  "Reviewers got units a week early, so expect the honest takes in about a month.",
  "The accessories ecosystem is where they quietly make the margin."
 ],
 Geopolitics:[
  "Data centres becoming targets was always a matter of time. Infrastructure is strategy now.",
  "Chip export rules are trade policy dressed as security policy. Both sides know it.",
  "This affects Indian companies more than the coverage suggests. Our supply chains run through all of it.",
  "Good that this piece sticks to what's confirmed. Too much speculation elsewhere.",
  "Insurance costs for cloud infrastructure are going to rise. Nobody has priced this in.",
  "The long-term effect is two separate tech stacks. Companies will have to pick.",
  "Would appreciate a map or timeline with stories like this.",
  "Calm, factual coverage. This is why I read Bought. for geopolitics."
 ]
};
/* first comments that fit any story */
const CM_ANY=[
 "Great summary. Read this in two minutes and understood more than from a 20-minute podcast.",
 "Counterpoint: these are reported numbers, not filed ones. I'd wait for confirmation.",
 "The 'Why it matters' box is my favourite part of every story.",
 "Saving this. Will check back in six months to see who was right.",
 "Genuinely asking: who loses if this goes through?",
 "Bookmarking the source link. Thanks for always citing the original.",
 "Hot take: this will matter far less than the headlines suggest.",
 "Could you do a follow-up when the deal actually closes?"
];
/* replies (generic enough to sit under most comments) */
const CM_REPLY=[
 "Agreed, and it's worth adding the timeline. None of this happens before next year.",
 "Respectfully disagree. The numbers already show the shift.",
 "Source? Genuinely curious, not trying to argue.",
 "Same experience on our side.",
 "This is the most useful comment in the thread.",
 "Fair point, but the incumbents have distribution. That's hard to beat.",
 "I'd push back a bit. Early data is noisy.",
 "Exactly what I was going to say.",
 "We tried this. It worked for six months, then costs crept back up.",
 "Not sure that follows. Correlation isn't strategy.",
 "Underrated point. More people should be talking about this.",
 "Depends on the market. In India the math is very different.",
 "Good call. I hadn't thought of the regulatory side.",
 "Ha, I said the same last week and got downvoted.",
 "The real constraint is talent, not money.",
 "Both can be true at once.",
 "Do you have numbers on that? Would love to read more.",
 "This aged well already.",
 "The second-order effects are what interest me.",
 "Strong take. I'm not convinced, but strong take.",
 "Thanks, that's a clearer explanation than the article.",
 "History says otherwise, but we'll see.",
 "Fully agree. Clear and well put.",
 "As someone who works in this space: yes, this is accurate."
];
/* the journalist answering in their own story */
const CM_AUTHOR=[
 "Author here. One thing we couldn't fit: {why}",
 "Author here. Good question. What we can confirm so far: {g}.",
 "Author here. Fair challenge. The figures are from {src}; we'll update the story if they change.",
 "Thanks for reading. We'll follow this up when there's more to confirm."
];

/* Today's open thread (page 8): a whole-issue discussion, written out */
const ISSUE_THREAD=[
 {u:24,b:"Good morning. This is today's open thread: anything from this issue, or anything we missed. Corrections are welcome and get answered here.",s:96,a:400,pin:1,kids:[]},
 {u:12,b:"The Money Edition is the best day of the week. More business, fewer launches. Please keep it that way.",s:212,a:330,kids:[
  {u:24,b:"Noted, and thank you. The weekday themes stay fixed so you always know what Wednesday brings.",s:88,a:300,kids:[]}]},
 {u:5,b:"Could we get the Listen edition in Kannada and Hindi? I listen on my commute and would share it with my parents.",s:174,a:290,kids:[
  {u:18,b:"Seconding this. Even a 5-minute version would be enough.",s:61,a:260,kids:[]},
  {u:24,b:"It's on the roadmap. Hindi first, then Kannada. We'll announce it on the back page.",s:120,a:240,kids:[
   {u:5,b:"Brilliant, thanks.",s:22,a:230,kids:[]}]}]},
 {u:11,b:"Small correction: one of the figures in today's business section doesn't match the source it links to.",s:143,a:210,kids:[
  {u:24,b:"Thanks, you're right. Updated, with a note at the end of the story.",s:97,a:190,kids:[]}]},
 {u:1,b:"The ads here are the least annoying I've seen anywhere. One quiet video per page and you can see what it sold for. Weirdly honest.",s:131,a:170,kids:[
  {u:9,b:"The price tag beside each ad is a great idea. Always wondered what these spots cost.",s:47,a:150,kids:[]}]},
 {u:20,b:"Turning pages on my phone feels better than scrolling. I actually finish the issue now.",s:118,a:120,kids:[]},
 {u:22,b:"Would love a weekly geopolitics explainer with a map.",s:39,a:80,kids:[]},
 {u:3,b:"Hot take: the polls are the best part. The Pulse result yesterday surprised me.",s:28,a:45,kids:[]}
];
const CM_DESK=["Bought. Desk","Editor","#2a2723"];
