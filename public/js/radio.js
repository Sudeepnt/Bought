/* Bought. Daily — Listen view: the issue read aloud as one episode (the funnel's podcast step), with a mini player that follows you back to the paper. */

const Radio={
 total:0,t:0,rate:1,audio:null,chapters:[],
 init(){
  const N=48;
  $("wave").innerHTML=Array.from({length:N},(_,i)=>`<i style="--h:${18+Math.round(Math.abs(Math.sin(i*1.7)*60+Math.sin(i*.4)*22))};--d:${(i*37%10)/10}"></i>`).join("");
  const a=Radio.audio=new Audio();a.preload="none";
  a.addEventListener("timeupdate",()=>{Radio.t=a.currentTime;Radio.tick()});
  a.addEventListener("play",()=>Radio.tick());a.addEventListener("pause",()=>Radio.tick());
  a.addEventListener("ended",()=>{Radio.t=Radio.total;Radio.tick()});
  $("achapters").onclick=e=>{const li=e.target.closest("li");if(li&&Radio.total){Radio.seek(Radio.chapters[+li.dataset.i].start);Radio.play()}};
  $("abar").onclick=e=>{const r=$("abar").getBoundingClientRect();Radio.seek((e.clientX-r.left)/r.width*Radio.total)};
  $("aplay").onclick=()=>Radio.toggle();$("aback").onclick=()=>Radio.seek(Radio.t-15);$("afwd").onclick=()=>Radio.seek(Radio.t+15);
  $("aspeed").onclick=()=>{Radio.rate=Radio.rate===1?1.5:Radio.rate===1.5?2:1;a.playbackRate=Radio.rate;$("aspeed").textContent=Radio.rate+"×"};
  $("mini-p").onclick=()=>Radio.toggle();$("mini-o").onclick=()=>go("radio");
  Radio.load();
 },
 /* the episode of the issue on screen; before it is ready the lineup still shows, with play switched off */
 load(){
  const a=Radio.audio;if(!a)return;
  const byUid=Object.fromEntries(S.map(s=>[s.uid,s]));
  const wanted=PODCAST?PODCAST.audio_url:"";
  if(a.dataset.src!==wanted){a.pause();a.dataset.src=wanted;if(wanted)a.src=wanted;else a.removeAttribute("src");Radio.t=0}
  Radio.total=PODCAST?PODCAST.duration_s:0;
  Radio.chapters=PODCAST?PODCAST.chapters.filter(c=>byUid[c.id]).map(c=>({s:byUid[c.id],start:c.start})):ORDER.map(id=>({s:S[id],start:0}));
  $("achapters").innerHTML=Radio.chapters.map((c,i)=>`<li data-i="${i}"><span>${PODCAST?fmt(c.start):""}</span>${esc(c.s.t)}<em class="ch-pg">p.${pageOfStory(c.s.id)+1}</em></li>`).join("");
  const mins=Math.max(1,Math.round(Radio.total/60));
  $("pod-sub").textContent=!S.length?"Today's issue isn't out yet.":PODCAST?`${S.length} stories in ${mins} minutes. Press play and go about your morning.`:`${S.length} stories. Today's audio is still being made.`;
  $("st-n").textContent=S.length;$("r-issue").textContent="Issue "+issueNo(ISSUE_DAY);$("ach").textContent=S.length+" stories";
  $("atotal").textContent=fmt(Radio.total);$("st-min").textContent=PODCAST?mins+" min":"–";
  $("aplay").disabled=!PODCAST;
  Radio.tick();
 },
 tick(){
  const a=Radio.audio, t=Radio.t, on=!!a&&!a.paused&&!a.ended, f=Radio.total?t/Radio.total:0, N=48;
  $("afill").style.width=(f*100)+"%";$("acur").textContent=fmt(t);
  let c=0;Radio.chapters.forEach((x,i)=>{if(x.start<=t)c=i});
  [...$("achapters").children].forEach((li,i)=>li.classList.toggle("now",!!PODCAST&&i===c));
  $("aplay").textContent=on?"❚❚":"▶";$("aplay").setAttribute("aria-label",on?"Pause":"Play");
  $("disc").classList.toggle("spin",on);$("wave").classList.toggle("on",on);
  [...$("wave").children].forEach((b,i)=>b.classList.toggle("past",i/N<f));
  const cur=Radio.chapters[c];$("mini-t").textContent=cur?cur.s.t:"";$("mini-p").textContent=on?"❚❚":"▶";$("mini-p").setAttribute("aria-label",on?"Pause":"Play");
  $$(".eq").forEach(e=>e.classList.toggle("on",on));
  Radio.miniVis();
 },
 miniVis(){const a=Radio.audio,show=VIEW!=="radio"&&!!PODCAST&&a&&(!a.paused||Radio.t>0)&&Radio.t<Radio.total;if($("mini").hidden===!!show){$("mini").hidden=!show;Toasts.place()}},
 seek(x){if(!Radio.total)return;Radio.t=Math.max(0,Math.min(Radio.total,x));Radio.audio.currentTime=Radio.t;Radio.tick()},
 /* the episode and a video with sound never talk over each other */
 toggle(){const a=Radio.audio;if(!PODCAST)return;if(a.paused){$$("#reader .vid.playing,#ov .vid.playing").forEach(el=>{vs(el.dataset.key).playing=false;updVid(el)});a.play().catch(()=>{})}else a.pause();Radio.tick()},
 play(){if(Radio.audio.paused)Radio.toggle()},
 pause(){if(Radio.audio&&!Radio.audio.paused){Radio.audio.pause();Radio.tick()}},
 listenTo(id){
  if(!PODCAST){toast("Today's audio is still being made.");return}
  const c=Radio.chapters.find(x=>x.s.id===id);Reader.close();go("radio");if(c)Radio.seek(c.start);Radio.play();
 }
};
VIEW_HOOKS.radio={enter(){Vids.stop();stopAds();Radio.miniVis()},leave(){Radio.miniVis()}};
