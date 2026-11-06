/* Bought. Daily: loads a published issue into the page. The funnel writes issues/index.json and issues/<date>/issue.json (pipeline/funnel/publish.py). */

let PUBLISH_LABEL="07:00 IST", ISSUES=[], LATEST=null, PODCAST=null, ISSUE_STATS=null, ISSUE_META=null, LANG="en";
const getJSON=async u=>{const r=await fetch(u,{cache:"no-cache"});if(!r.ok)throw new Error(u+" "+r.status);return r.json()};
const clearObj=o=>Object.keys(o).forEach(k=>delete o[k]);
const Data={
 /* the list of issues, then the newest (or the one a shared link asks for) */
 async boot(want){
  try{const idx=await getJSON("issues/index.json");ISSUES=idx.dates||[];LATEST=idx.latest||ISSUES[0]||null;if(idx.publish_label)PUBLISH_LABEL=idx.publish_label}catch{ISSUES=[];LATEST=null}
  $$("[data-next-time]").forEach(el=>{el.textContent=PUBLISH_LABEL});
  if(!LATEST)return false;
  return await Data.load(ISSUES.includes(want)?want:LATEST)||(want&&await Data.load(LATEST));
 },
 async load(date){
  let d;try{d=await getJSON(`issues/${date}/issue.json`)}catch{return false}
  ISSUE_DAY=date;ISSUE_META=d;PODCAST=d.podcast||null;ISSUE_STATS=d.stats||null;
  S.length=0;d.stories.forEach(x=>{x.video=x.video||"";x.cc=x.cc||[];x.quick=x.min<=2;S.push(x)});
  clearObj(LAYOUT);CATS.forEach(c=>{const ids=S.filter(s=>s.cat===c.name&&!["lead","top"].includes(s.sz));LAYOUT[c.name]={main:ids.filter(s=>s.sz!=="b").map(s=>s.id),briefs:ids.filter(s=>s.sz==="b").map(s=>s.id)}});
  ORDER.length=0;ORDER.push(...S.filter(s=>["lead","top"].includes(s.sz)).map(s=>s.id),...CATS.flatMap(c=>[...LAYOUT[c.name].main,...LAYOUT[c.name].briefs]));
  NUMS.length=0;NUMS.push(...(d.nums||[]));BRIEF.length=0;BRIEF.push(...(d.brief||[]));CLIPIDS.length=0;CLIPIDS.push(...(d.clips||[]));
  clearObj(POLLS);Object.assign(POLLS,d.polls||{});clearObj(RX);Object.assign(RX,d.rx||{});
  /* what this reader did, per issue: read marks, votes, reactions, comments */
  P.read=new Set(store.get("bought-read-"+date,[]));P.votes=store.get("bought-votes-"+date,{});P.rx=store.get("bought-rx-"+date,{});
  CMX.mine=store.get("bought-cm-"+date,{});CMX.votes=store.get("bought-cmv-"+date,{});CMX.reports=store.get("bought-cmr-"+date,{});CMX.cache={};CMX.ui={};
  VS.clear();
  Data.langOptions();
  await Data.applyLang(store.get("bought-lang","en"));
  Radio.load();
  Live.winners(date);
  return true;
 },
 langOptions(){
  const list=(ISSUE_META&&ISSUE_META.translations)||[];
  $("lang").innerHTML=`<option value="en">English</option>`+list.map(l=>`<option value="${esc(l)}">${esc(LANG_NAMES[l]||l)}</option>`).join("");
 },
 /* headlines and summaries change language; audio and video stay in English */
 async applyLang(l){
  const list=(ISSUE_META&&ISSUE_META.translations)||[];
  if(!list.includes(l))l="en";
  let tr=null;
  if(l!=="en"){try{tr=await getJSON(`issues/${ISSUE_DAY}/translations/${l}.json`)}catch{l="en"}}
  const base=ISSUE_META.stories;
  S.forEach((s,i)=>{
   s._en=s._en||{t:s.t,dek:s.dek,gist:s.gist,body:s.body};
   const x=tr&&tr[s.uid];
   if(x&&x.headline){s.t=x.headline;s.dek=x.summary||"";s.gist=[];s.body=[]}else Object.assign(s,s._en);
  });
  BRIEF.forEach(b=>{const s=S[b[0]];if(s)b[1]=tr&&s.t!==s._en.t?s.t:(ISSUE_META.brief.find(o=>o[0]===b[0])||b)[1]});
  LANG=l;$("lang").value=l;
 },
 async setLang(l){store.set("bought-lang",l);await Data.applyLang(l);if(S.length){Reader.close();Paper.render();Radio.load();Issue.settle()}}
};
