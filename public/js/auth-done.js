/* Google sends the sign-in back here. Store it, then close this window (or go back to Advertise when there was no window). */
const msg=document.getElementById("auth-msg");
(async()=>{
 const back=new URLSearchParams(location.search).has("back");
 try{
  const cfg=await (await fetch("/api/bought/config")).json();
  if(!cfg.live)throw new Error("off");
  const lib=await import("./live/client.js?v=11");
  const ok=await lib.finishSignIn(cfg.supabaseUrl,cfg.supabaseKey);
  if(!ok)throw new Error("no session");
  if(back){location.replace("/#advertise");return}
  new BroadcastChannel("bought-auth").postMessage("signed-in");     // the bid sheet carries on
  msg.textContent="You're signed in. You can close this window.";
  window.close();
 }catch{
  msg.textContent="That didn't work. Close this window and try again, or use your email instead.";
 }
})();
