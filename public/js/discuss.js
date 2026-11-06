/* Bought. Daily — discussion threads on every story, plus today's open thread for the whole issue.
   Reddit-style: nested replies, up/down votes, Best/Top/New, collapse, reply, edit, delete, report.
   Sample threads are generated from data.comments.js; your comments, votes and reports stay in this browser.
   In production every action here is an API call (see #spec). */

const CMX={
 mine:{},                               /* thread → [{id,parent,body,t,edited,deleted,u?}] */
 votes:{},                              /* comment id → 1 | -1 */
 reports:{},                            /* comment id → true */
 name:store.get("bought-cm-name",""),
 cache:{},                              /* thread → generated tree */
 ui:{}                                  /* thread → {sort, shown, collapsed:Set} */
};
const cmSave=()=>{store.set("bought-cm-"+ISSUE_DAY,CMX.mine);store.set("bought-cmv-"+ISSUE_DAY,CMX.votes);store.set("bought-cmr-"+ISSUE_DAY,CMX.reports)};
const cmUser=u=>u===24||u==="desk"?CM_DESK:CM_USERS[u%CM_USERS.length];
const cmAge=m=>m<1?"now":m<60?Math.round(m)+"m":m<1440?Math.floor(m/60)+"h":Math.floor(m/1440)+"d";

/* ---------- build a sample thread: same story, same comments every time ---------- */
function cmGen(tid){
 if(CMX.cache[tid])return CMX.cache[tid];
 let out=[];
 if(tid==="issue"){
  let n=0;const walk=(c,parent)=>{const id=`issue-${n++}`;out.push({id,parent,u:c.u,b:c.b,s:c.s,age:c.a,pin:!!c.pin,desk:c.u===24});c.kids.forEach(k=>walk(k,id))};
  ISSUE_THREAD.forEach(c=>walk(c,null));
  return CMX.cache[tid]=out;
 }
 const s=S[+tid], r=seeded(hashStr("cm"+s.uid)), pick=a=>a[Math.floor(r()*a.length)];
 const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
 const big=s.sz==="lead"||s.sz==="xl"||s.sz==="top";
 const tops=shuffle([...(CM_TOP[s.cat]||[]),...CM_ANY]).slice(0,(big?6:3)+Math.floor(r()*(big?5:4)));
 const fill=t=>t.replace("{why}",s.why).replace("{g}",(s.gist[0]||s.dek).replace(/\.$/,"")).replace("{src}",s.src[0]);
 let n=0, users=shuffle(CM_USERS.map((_,i)=>i));
 const nextU=()=>users[n%users.length];
 tops.forEach((b,ti)=>{
  const id=`${tid}-${n++}`, score=Math.max(1,Math.round(Math.pow(r(),2.2)*(big?1400:520))), age=20+r()*660;
  out.push({id,parent:null,u:nextU(),b,s:score,age});
  const pool=shuffle(CM_REPLY);let pi=0;
  const kids=(pid,ps,pa,depth)=>{
   const k=depth===1?Math.floor(Math.pow(r(),1.4)*4):r()<.38?1:0;
   for(let i=0;i<k&&pi<pool.length;i++){
    const cid=`${tid}-${n++}`, sc=Math.max(-3,Math.round(ps*r()*.55)-(r()<.12?6:0)), ag=Math.max(2,pa*r()*.9);
    out.push({id:cid,parent:pid,u:nextU(),b:pool[pi++],s:sc,age:ag});
    if(depth<3)kids(cid,Math.max(1,sc),ag,depth+1);
   }
  };
  kids(id,score,age,1);
  if(ti<2&&r()<.55){out.push({id:`${tid}-${n++}`,parent:id,u:"author",b:fill(pick(CM_AUTHOR.filter(x=>s.why||!x.includes("{why}")))),s:Math.round(score*.4)+3,age:Math.max(3,age*.6),author:true})}
 });
 return CMX.cache[tid]=out;
}

/* everything in a thread: sample comments plus yours */
function cmAll(tid){
 const mine=(CMX.mine[tid]||[]).map(c=>({...c,u:c.u??"me",s:1,age:(now()-c.t)/6e4,me:c.u==null}));
 return cmGen(tid).concat(mine);
}
function cmCount(tid){return cmAll(tid).filter(c=>!c.deleted).length}
function cmScore(c){return c.s+(CMX.votes[c.id]||0)+(c.me?0:0)}
function cmSort(list,sort){
 const best=c=>(c.me&&c.age<30?1e9:0)+(c.pin?2e9:0)+cmScore(c)/Math.pow(c.age/60+2,.35);
 const f=sort==="new"?(a,b)=>(b.pin-a.pin)||a.age-b.age:sort==="top"?(a,b)=>(b.pin-a.pin)||cmScore(b)-cmScore(a):(a,b)=>best(b)-best(a);
 return list.slice().sort(f);
}
const cmUI=tid=>CMX.ui[tid]||(CMX.ui[tid]={sort:"best",shown:5,collapsed:new Set()});

/* ---------- markup ---------- */
function cmWho(c,tid){
 if(c.me)return {n:CMX.name||"You",f:"You",h:"var(--ink)"};
 if(c.author){const s=S[+tid],j=JOUR[s.j];return {n:s.j,f:"Author",h:j.c}}
 if(c.desk)return {n:CM_DESK[0],f:"Bought. Desk",h:CM_DESK[2]};
 const u=cmUser(c.u);return {n:u[0],f:u[1],h:u[2]};
}
function cmHTML(c,kidsOf,tid,depth){
 const ui=cmUI(tid), w=cmWho(c,tid), kids=cmSort(kidsOf[c.id]||[],"best"), col=ui.collapsed.has(c.id), v=CMX.votes[c.id]||0, rep=CMX.reports[c.id];
 const desc=n=>(kidsOf[n.id]||[]).reduce((a,k)=>a+1+desc(k),0), nk=desc(c);
 const badge=c.author||c.desk||c.me?`<span class="cm-badge${c.me?" me":""}">${c.author?"Author":c.desk?"Editor":"You"}</span>`:`<span class="cm-fl">${esc(w.f)}</span>`;
 const body=c.deleted?`<p class="cm-gone">Comment deleted.</p>`:rep?`<p class="cm-gone">You reported this comment. A moderator will review it. <button type="button" class="linkbtn" data-cunreport="${c.id}">Undo</button></p>`:`<p>${esc(c.b||c.body)}</p>${c.edited?'<small class="cm-ed">edited</small>':""}`;
 return `<li class="cm${col?" collapsed":""}${c.me?" mine":""}${c.author||c.desk?" staff":""}${c.pin?" pinned":""}" id="cm-${c.id}" data-cid="${c.id}" style="--uc:${w.h}">
  <button type="button" class="cm-rail" data-ccollapse="${c.id}" aria-label="${col?"Expand":"Collapse"} thread"></button>
  <div class="cm-main">
   <div class="cm-h"><span class="cm-av" aria-hidden="true">${esc(w.n[0].toUpperCase())}</span><b class="cm-n">${esc(w.n)}</b>${badge}<span class="cm-t">${c.pin?"Pinned · ":""}${cmAge(c.age)}</span>${col?`<button type="button" class="cm-more" data-ccollapse="${c.id}">${cmScore(c)} points${nk?` · ${nk} ${nk===1?"reply":"replies"}`:""} · show</button>`:""}</div>
   <div class="cm-b">${body}</div>
   ${c.deleted?"":`<div class="cm-a">
    <span class="cm-v${v>0?" up":v<0?" down":""}"><button type="button" data-cvote="${c.id}:1" aria-label="Upvote" aria-pressed="${v>0}">${ICON_UP}</button><b>${num(cmScore(c))}</b><button type="button" data-cvote="${c.id}:-1" aria-label="Downvote" aria-pressed="${v<0}">${ICON_DOWN}</button></span>
    <button type="button" data-creply="${c.id}">Reply</button>
    <button type="button" data-cshare="${c.id}">Share</button>
    ${c.me?`<button type="button" data-cedit="${c.id}">Edit</button><button type="button" data-cdel="${c.id}">Delete</button>`:rep?"":`<button type="button" data-creport="${c.id}">Report</button>`}
   </div>`}
   <div class="cm-slot"></div>
   ${kids.length?`<ol class="cm-kids">${kids.map(k=>cmHTML(k,kidsOf,tid,depth+1)).join("")}</ol>`:""}
  </div></li>`;
}
const ICON_UP=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3.5 13 9H9.8v3.5H6.2V9H3z"/></svg>`;
const ICON_DOWN=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 12.5 3 7h3.2V3.5h3.6V7H13z"/></svg>`;
const ICON_CM=`<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3.5h10a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H7.5L4.5 14v-2.5H3a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>`;

function composerHTML(tid,parent,val=""){
 const needName=!CMX.name;
 return `<form class="cm-form${parent?" reply":""}" data-ctid="${tid}" data-cparent="${parent||""}" novalidate>
  ${needName?`<label class="cm-name"><span>Name shown with your comment</span><input name="name" maxlength="24" autocomplete="nickname" placeholder="e.g. Utsav S."></label>`:""}
  <label class="vh" for="cmt-${tid}-${parent||"top"}">${parent?"Your reply":"Your comment"}</label>
  <textarea id="cmt-${tid}-${parent||"top"}" name="body" rows="${parent?2:3}" maxlength="1000" placeholder="${parent?"Write a reply":"Add to the discussion"}">${esc(val)}</textarea>
  <div class="cm-ff"><small class="cm-err" role="alert"></small><small class="cm-rule">Be kind. Argue with ideas, not people.</small>${parent?`<button type="button" class="chip-btn" data-ccancel>Cancel</button>`:""}<button type="submit" class="btn sm">${parent?"Reply":"Comment"}</button></div>
 </form>`;
}
function discussHTML(tid,{title}={}){
 const ui=cmUI(tid), all=cmAll(tid), kidsOf={};
 all.forEach(c=>{if(c.parent){(kidsOf[c.parent]=kidsOf[c.parent]||[]).push(c)}});
 const tops=cmSort(all.filter(c=>!c.parent),ui.sort), shown=tops.slice(0,ui.shown), left=tops.length-shown.length, n=all.filter(c=>!c.deleted).length;
 return `<section class="thr" data-thread="${tid}" id="thr-${tid}" aria-label="Discussion">
  <header class="thr-h"><h3>${title||"Discussion"}</h3><span class="thr-n">${n} comments</span>
   <div class="thr-sort" role="group" aria-label="Sort comments">${[["best","Best"],["top","Top"],["new","New"]].map(([k,l])=>`<button type="button" data-csort="${tid}:${k}" aria-pressed="${ui.sort===k}">${l}</button>`).join("")}</div></header>
  ${composerHTML(tid,null)}
  <ol class="cm-list">${shown.map(c=>cmHTML(c,kidsOf,tid,0)).join("")}</ol>
  ${left>0?`<button type="button" class="thr-more" data-cmore="${tid}">Show ${Math.min(5,left)} more of ${left} threads</button>`:""}
 </section>`;
}

/* ---------- actions ---------- */
const Discuss={
 refresh(tid){
  $$(`.thr[data-thread="${tid}"]`).forEach(el=>{
   const opts=el.closest(".page")?{title:"Today's open thread"}:{};
   const drafts=$$("textarea",el).map(t=>[t.closest("form").dataset.cparent,t.value]);
   el.outerHTML=discussHTML(tid,opts);
   const fresh=$(`thr-${tid}`);drafts.forEach(([p,v])=>{if(!p&&v){const t=fresh.querySelector('.cm-form:not(.reply) textarea');if(t)t.value=v}});
  });
  $$(`[data-ccount="${tid}"]`).forEach(b=>{b.querySelector("b").textContent=cmCount(tid)});
  Talk.render();Paper.progress();
 },
 scrollTo(tid,cid){
  const el=cid?$("cm-"+cid):$("thr-"+tid);if(!el)return;
  const box=el.closest("#rdbody");
  if(box){box.scrollTo({top:el.offsetTop-box.offsetTop-12,behavior:reduce?"auto":"smooth"})}else{const r=el.getBoundingClientRect();scrollTo({top:scrollY+r.top-110,behavior:reduce?"auto":"smooth"})}
  if(cid){el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),2000)}
 },
 vote(cid,d){
  const cur=CMX.votes[cid]||0, nv=cur===d?0:d;if(nv)CMX.votes[cid]=nv;else delete CMX.votes[cid];cmSave();
  const tid=cid.split("-")[0];const c=cmAll(tid).find(x=>x.id===cid);
  $$(`[data-cid="${cid}"] > .cm-main > .cm-a .cm-v`).forEach(v=>{v.className="cm-v"+(nv>0?" up":nv<0?" down":"");v.querySelector("b").textContent=num(cmScore(c));v.children[0].setAttribute("aria-pressed",nv>0);v.children[2].setAttribute("aria-pressed",nv<0);v.classList.add("bump");setTimeout(()=>v.classList.remove("bump"),300)});
 },
 submit(form){
  const tid=form.dataset.ctid, parent=form.dataset.cparent||null, err=form.querySelector(".cm-err");
  const body=form.body.value.trim(), nm=form.name?form.name.value.trim():CMX.name;
  const bad=m=>{err.textContent=m;form.classList.add("err");return false};
  if(form.name&&(nm.length<2))return bad("Add the name to show with your comment (2–24 characters).");
  if(body.length<2)return bad("Write a few words first.");
  if(BANNED.test(body))return bad("Comments can't promise guaranteed returns, cures or risk-free results.");
  if(/https?:\/\//i.test(body)&&!(CMX.mine[tid]||[]).length)return bad("Links are allowed after your first comment in a thread.");
  const recent=Object.values(CMX.mine).flat().filter(c=>c.u==null&&now()-c.t<20000).length;
  if(recent>=3)return bad("You're commenting fast. Wait a few seconds and try again.");
  if(form.name){CMX.name=nm;store.set("bought-cm-name",nm)}
  const id=`${tid}-u${Date.now().toString(36)}`;
  (CMX.mine[tid]=CMX.mine[tid]||[]).push({id,parent,body,t:now()});
  CMX.votes[id]=0;delete CMX.votes[id];cmSave();
  const ui=cmUI(tid);if(parent)ui.collapsed.delete(parent);
  Discuss.refresh(tid);requestAnimationFrame(()=>Discuss.scrollTo(tid,id));
  if(!parent)Discuss.simReply(tid,id);
  return true;
 },
 /* someone answers you a little later: the loop closes with a notice that takes you back to the reply */
 simReply(tid,pid){
  setTimeout(()=>{
   const list=CMX.mine[tid]||[], p=list.find(c=>c.id===pid);if(!p||p.deleted)return;
   const isStory=tid!=="issue", r=seeded(hashStr(pid));
   const author=isStory&&r()<.4, u=author?"author":tid==="issue"?24:Math.floor(r()*CM_USERS.length);
   const body=author?"Author here. Thanks for this. Good point, and we'll keep it in mind for the follow-up.":tid==="issue"?"Thanks for writing in. The desk reads every comment in this thread.":CM_REPLY[Math.floor(r()*CM_REPLY.length)];
   const id=`${tid}-u${Date.now().toString(36)}r`;
   list.push({id,parent:pid,body,t:now(),u,author,desk:u===24});cmSave();
   Discuss.refresh(tid);
   const who=author?S[+tid].j:u===24?CM_DESK[0]:CM_USERS[u][0];
   const where=isStory?`"${S[+tid].t}"`:"today's open thread";
   if(!document.getElementById("cm-"+id)||!$("reader").contains(document.getElementById("cm-"+id)))toast(`${who} replied to your comment on ${where}.`,{label:"View",run:()=>Discuss.open(tid,id)});
  },14000);
 },
 open(tid,cid){
  if(tid==="issue"){Reader.close();if(VIEW!=="paper")go("paper");setTimeout(()=>Discuss.scrollTo("issue",cid),60);return}
  const id=+tid;if(VIEW!=="paper")go("paper");
  if(READER_ID!==id)Reader.open(id);
  requestAnimationFrame(()=>Discuss.scrollTo(tid,cid));
 },
 click(e){
  const t=e.target;
  const ds=t.closest("[data-discuss]");if(ds){e.preventDefault();Discuss.open(ds.dataset.discuss);return true}
  const cv=t.closest("[data-cvote]");if(cv){const[cid,d]=cv.dataset.cvote.split(":");Discuss.vote(cid,+d);return true}
  const so=t.closest("[data-csort]");if(so){const[tid,k]=so.dataset.csort.split(":");cmUI(tid).sort=k;Discuss.refresh(tid);return true}
  const mo=t.closest("[data-cmore]");if(mo){cmUI(mo.dataset.cmore).shown+=5;Discuss.refresh(mo.dataset.cmore);return true}
  const co=t.closest("[data-ccollapse]");if(co){const cid=co.dataset.ccollapse,tid=cid.split("-")[0],ui=cmUI(tid);ui.collapsed.has(cid)?ui.collapsed.delete(cid):ui.collapsed.add(cid);Discuss.refresh(tid);return true}
  const rp=t.closest("[data-creply]");if(rp){const li=rp.closest(".cm"),slot=li.querySelector(":scope > .cm-main > .cm-slot");if(slot.firstChild){slot.innerHTML="";return true}const tid=li.closest(".thr").dataset.thread;slot.innerHTML=composerHTML(tid,li.dataset.cid);slot.querySelector("textarea").focus({preventScroll:false});return true}
  const cc=t.closest("[data-ccancel]");if(cc){cc.closest(".cm-slot").innerHTML="";return true}
  const sh=t.closest("[data-cshare]");if(sh){const url=location.href.split("#")[0]+"#paper/c/"+sh.dataset.cshare;try{navigator.clipboard&&navigator.clipboard.writeText(url).catch(()=>{})}catch{}toast("Link to this comment copied.");return true}
  const rpt=t.closest("[data-creport]");if(rpt){const cid=rpt.dataset.creport;CMX.reports[cid]=true;cmSave();Discuss.refresh(cid.split("-")[0]);return true}
  const ur=t.closest("[data-cunreport]");if(ur){const cid=ur.dataset.cunreport;delete CMX.reports[cid];cmSave();Discuss.refresh(cid.split("-")[0]);return true}
  const dl=t.closest("[data-cdel]");if(dl){const cid=dl.dataset.cdel,tid=cid.split("-")[0],c=(CMX.mine[tid]||[]).find(x=>x.id===cid);if(c){c.deleted=true;cmSave();Discuss.refresh(tid);toast("Comment deleted.",{label:"Undo",run:()=>{c.deleted=false;cmSave();Discuss.refresh(tid)}})}return true}
  const ed=t.closest("[data-cedit]");if(ed){const cid=ed.dataset.cedit,tid=cid.split("-")[0],c=(CMX.mine[tid]||[]).find(x=>x.id===cid);const li=$("cm-"+cid),b=li.querySelector(":scope > .cm-main > .cm-b");
   b.innerHTML=`<form class="cm-form edit" data-cedit-form="${cid}" novalidate><textarea name="body" rows="3" maxlength="1000">${esc(c.body)}</textarea><div class="cm-ff"><small class="cm-err" role="alert"></small><button type="button" class="chip-btn" data-cedit-cancel="${tid}">Cancel</button><button type="submit" class="btn sm">Save</button></div></form>`;b.querySelector("textarea").focus();return true}
  const ec=t.closest("[data-cedit-cancel]");if(ec){Discuss.refresh(ec.dataset.ceditCancel);return true}
  return false;
 }
};
document.addEventListener("submit",e=>{
 const f=e.target.closest(".cm-form");if(!f)return;e.preventDefault();
 if(f.dataset.ceditForm){const cid=f.dataset.ceditForm,tid=cid.split("-")[0],c=(CMX.mine[tid]||[]).find(x=>x.id===cid),v=f.body.value.trim();if(v.length<2){f.querySelector(".cm-err").textContent="Write a few words first.";return}c.body=v;c.edited=true;cmSave();Discuss.refresh(tid);return}
 Discuss.submit(f);
});
document.addEventListener("input",e=>{const f=e.target.closest&&e.target.closest(".cm-form.err");if(f){f.classList.remove("err");f.querySelector(".cm-err").textContent=""}});
document.addEventListener("keydown",e=>{if((e.metaKey||e.ctrlKey)&&e.key==="Enter"){const f=e.target.closest&&e.target.closest(".cm-form");if(f){e.preventDefault();f.requestSubmit()}}});

/* ---------- front page: most discussed today ---------- */
const Talk={
 render(){
  const el=$("talk");if(!el)return;
  const top=S.map(s=>({s,n:cmCount(s.id)})).sort((a,b)=>b.n-a.n).slice(0,3);
  el.innerHTML=`<div class="talk-h"><span>Most discussed</span><button type="button" class="linkbtn" data-page-go="7">Today's open thread · ${cmCount("issue")}</button></div>
  <ol>${top.map(({s,n},i)=>{const best=cmSort(cmAll(s.id).filter(c=>!c.parent&&!c.deleted),"top")[0],w=best?cmWho(best,s.id):null;
   return `<li style="--c:${catColor(s.cat)}"><button type="button" data-discuss="${s.id}"><span class="talk-r">${i+1}</span><span class="talk-t"><b>${esc(s.t)}</b>${best?`<q>${esc((best.b||best.body).length>110?(best.b||best.body).slice(0,108).replace(/\s+\S*$/,"")+"…":(best.b||best.body))}</q><small>${esc(w.n)} · ${num(cmScore(best))} points</small>`:""}</span><span class="talk-n">${ICON_CM}${n}</span></button></li>`}).join("")}</ol>`;
 }
};
