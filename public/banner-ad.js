// Sponsored banner under the section heading, ported from the Bought. Daily design ("Top banner": first screen on every device).
// The advertiser, line, price and script below are SAMPLE content; in production they come from the ad auction (winner of the top spot).
(() => {
  const root = document.querySelector('.prime-section');
  if (!root || document.querySelector('.adbar')) return;
  let SVGN = 0;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  // Illustrated presenter (mock): replaced by the advertiser's own video in production.
  function shade(h,a){const n=parseInt(h.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;const f=a<0?0:255,t=Math.abs(a);r=Math.round((f-r)*t+r);g=Math.round((f-g)*t+g);b=Math.round((f-b)*t+b);return `rgb(${r},${g},${b})`}
  function personSVG(p,shape){
    const i="ps"+(++SVGN), cx=shape==="vert"||shape==="av"?80:106, vb=shape==="av"?"63 25 34 34":"0 0 160 90";
    const sk=p.skin, hr=p.hair, sh=p.shirt, bg=p.bg;
    const books=[["#8a5a44",5],["#4d6a7a",4],["#c9a66b",6],["#5b4b6e",4],["#7a8a5a",5]];
    let bx=cx-94, bk="";books.forEach(([c,w],j)=>{bk+=`<rect x="${bx}" y="${j%2?17:16}" width="${w}" height="${j%2?13:14}" fill="${c}"/>`;bk+=`<rect x="${bx+1}" y="${j%2?37:36}" width="${w-1}" height="${j%2?13:14}" fill="${books[(j+2)%5][0]}"/>`;bx+=w+1});
    const face=`M${cx-12} 40 C${cx-12} 26 ${cx+12} 26 ${cx+12} 40 C${cx+12} 50 ${cx+7} 57.5 ${cx} 58 C${cx-7} 57.5 ${cx-12} 50 ${cx-12} 40Z`;
    const hairTop={
      short:`M${cx-12.6} 41 C${cx-14} 27 ${cx-6} 23.4 ${cx} 23.7 C${cx+8} 23.5 ${cx+14} 28 ${cx+12.6} 41 C${cx+11.6} 35 ${cx+9} 31.4 ${cx+3} 31 C${cx-3} 31.3 ${cx-9} 33 ${cx-12.6} 41Z`,
      long:`M${cx-13} 45 C${cx-15} 27 ${cx-5} 22.8 ${cx+1} 23.3 C${cx+10} 23.8 ${cx+15} 30 ${cx+13} 45 C${cx+12} 36 ${cx+8} 31 ${cx+1.5} 30.4 C${cx-5} 32 ${cx-10} 36 ${cx-13} 45Z`,
      bun:`M${cx-12.4} 40 C${cx-13.5} 28 ${cx-6} 24.2 ${cx} 24.4 C${cx+6} 24.2 ${cx+13.5} 28 ${cx+12.4} 40 C${cx+11} 33 ${cx+6} 30.2 ${cx} 30.2 C${cx-6} 30.2 ${cx-11} 33 ${cx-12.4} 40Z`
    }[p.style];
    const back=p.style==="long"?`<path d="M${cx-14} 38 C${cx-17} 22 ${cx+17} 22 ${cx+14} 38 L${cx+15.5} 63 C${cx+10} 67 ${cx-10} 67 ${cx-15.5} 63Z" fill="url(#${i}hr)"/>`:"";
    const bun=p.style==="bun"?`<circle cx="${cx}" cy="22" r="6.2" fill="url(#${i}hr)"/>`:"";
    const eye=(x)=>`<ellipse cx="${x}" cy="41.6" rx="2.1" ry="1.15" fill="#f3eee8"/><circle cx="${x}" cy="41.7" r=".95" fill="#2b1d16"/><circle cx="${x+.35}" cy="41.35" r=".3" fill="#fff"/><path d="M${x-2.2} 41.3 Q${x} 40 ${x+2.2} 41.3" stroke="${shade(sk,-.5)}" stroke-width=".55" fill="none"/>`;
    const beard=p.beard?`<path d="M${cx-11.5} 46 C${cx-10} 55 ${cx-6} 58.6 ${cx} 58.8 C${cx+6} 58.6 ${cx+10} 55 ${cx+11.5} 46 C${cx+9} 52 ${cx+5} 53.5 ${cx} 53.6 C${cx-5} 53.5 ${cx-9} 52 ${cx-11.5} 46Z" fill="${hr}" opacity=".42" filter="url(#${i}sf)"/>`:"";
    const glasses=p.glasses?`<g fill="none" stroke="#1d1a18" stroke-width=".7"><rect x="${cx-8.4}" y="39.4" width="6.6" height="4.6" rx="1.8"/><rect x="${cx+1.8}" y="39.4" width="6.6" height="4.6" rx="1.8"/><path d="M${cx-1.8} 41 Q${cx} 40.2 ${cx+1.8} 41"/></g>`:"";
    return `<svg class="ps" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs>
     <linearGradient id="${i}bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(bg,.18)}"/><stop offset="1" stop-color="${shade(bg,-.22)}"/></linearGradient>
     <radialGradient id="${i}sk" cx=".4" cy=".36" r=".78"><stop offset="0" stop-color="${shade(sk,.2)}"/><stop offset=".58" stop-color="${sk}"/><stop offset="1" stop-color="${shade(sk,-.3)}"/></radialGradient>
     <linearGradient id="${i}sh" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="${shade(sh,.16)}"/><stop offset="1" stop-color="${shade(sh,-.4)}"/></linearGradient>
     <linearGradient id="${i}hr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${shade(hr,.28)}"/><stop offset="1" stop-color="${hr}"/></linearGradient>
     <radialGradient id="${i}vg" cx=".55" cy=".45" r=".8"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".32"/></radialGradient>
     <radialGradient id="${i}kl" cx=".2" cy=".1" r=".9"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset=".6" stop-color="#fff" stop-opacity="0"/></radialGradient>
     <filter id="${i}bl" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.3"/></filter>
     <filter id="${i}sf"><feGaussianBlur stdDeviation=".4"/></filter></defs>
     <rect x="-40" y="-10" width="240" height="110" fill="url(#${i}bg)"/>
     <g filter="url(#${i}bl)">
      <rect x="${cx-97}" y="10" width="40" height="66" fill="${shade(bg,-.32)}"/><rect x="${cx-97}" y="31" width="40" height="2" fill="${shade(bg,-.5)}"/><rect x="${cx-97}" y="51" width="40" height="2" fill="${shade(bg,-.5)}"/>${bk}
      <rect x="${cx-52}" y="60" width="9" height="12" fill="#a0744f"/><ellipse cx="${cx-47.5}" cy="54" rx="9" ry="11" fill="#5e7c55"/><ellipse cx="${cx-52}" cy="50" rx="5" ry="7" fill="#6f8f62"/>
      <rect x="${cx+30}" y="3" width="46" height="48" fill="#fff" opacity=".6"/><rect x="${cx+52}" y="3" width="1.6" height="48" fill="${shade(bg,-.2)}"/>
      <circle cx="${cx+48}" cy="64" r="7" fill="#ffd9a0" opacity=".85"/><circle cx="${cx-22}" cy="14" r="3" fill="#fff" opacity=".35"/><circle cx="${cx+24}" cy="70" r="4" fill="#fff" opacity=".22"/>
     </g>
     <ellipse cx="${cx+5}" cy="72" rx="36" ry="30" fill="#000" opacity=".14" filter="url(#${i}bl)"/>
     <g class="hd">
      <path d="M${cx-37} 92 C${cx-35} 72 ${cx-21} 66 ${cx} 65 C${cx+21} 66 ${cx+35} 72 ${cx+37} 92Z" fill="url(#${i}sh)"/>
      <path d="M${cx-20} 70 C${cx-22} 78 ${cx-23} 85 ${cx-22} 92 M${cx+20} 70 C${cx+22} 78 ${cx+23} 85 ${cx+22} 92" stroke="${shade(sh,-.3)}" stroke-width=".7" fill="none" opacity=".6"/>
      ${back}
      <path d="M${cx-5.6} 51 L${cx-6.2} 66 C${cx-3} 69.5 ${cx+3} 69.5 ${cx+6.2} 66 L${cx+5.6} 51Z" fill="url(#${i}sk)"/>
      <ellipse cx="${cx}" cy="57.5" rx="6.4" ry="3.2" fill="${shade(sk,-.4)}" opacity=".45" filter="url(#${i}sf)"/>
      <path d="M${cx-9.5} 66 L${cx} 75.5 L${cx+9.5} 66 C${cx+5} 64.8 ${cx-5} 64.8 ${cx-9.5} 66Z" fill="${shade(sh,-.5)}"/>
      <ellipse cx="${cx-12.2}" cy="43.5" rx="2" ry="3.4" fill="${shade(sk,-.1)}"/><ellipse cx="${cx+12.2}" cy="43.5" rx="2" ry="3.4" fill="${shade(sk,-.18)}"/>
      ${bun}
      <path d="${face}" fill="url(#${i}sk)"/>
      <ellipse cx="${cx-6.6}" cy="48" rx="2.7" ry="1.5" fill="#d0645a" opacity=".13"/><ellipse cx="${cx+6.6}" cy="48" rx="2.7" ry="1.5" fill="#d0645a" opacity=".13"/>
      <path d="M${cx-8} 37.6 Q${cx-5} 36.1 ${cx-2.2} 37.3 M${cx+2.2} 37.3 Q${cx+5} 36.1 ${cx+8} 37.6" stroke="${shade(hr,.06)}" stroke-width="1.1" stroke-linecap="round" fill="none"/>
      ${eye(cx-4.8)}${eye(cx+4.8)}
      <path d="M${cx-.3} 42 Q${cx-1.7} 47.4 ${cx-1.9} 47.9 Q${cx} 49.3 ${cx+1.9} 47.9" stroke="${shade(sk,-.38)}" stroke-width=".6" fill="none" opacity=".75"/>
      <g class="mouth"><path d="M${cx-3.7} 52 Q${cx-1.5} 50.9 ${cx} 51.5 Q${cx+1.5} 50.9 ${cx+3.7} 52 Q${cx} 52.9 ${cx-3.7} 52Z" fill="${shade(sk,-.42)}"/><path d="M${cx-3.4} 52.1 Q${cx} 54.6 ${cx+3.4} 52.1 Q${cx} 52.9 ${cx-3.4} 52.1Z" fill="${shade(sk,-.26)}"/></g>
      ${beard}
      <path d="${hairTop}" fill="url(#${i}hr)"/>
      <path d="M${cx-7} 27.5 Q${cx-1} 25.5 ${cx+6} 27.5" stroke="${shade(hr,.5)}" stroke-width=".55" fill="none" opacity=".4"/>
      ${glasses}
      <circle cx="${cx+9.5}" cy="74" r="1.3" fill="#1b1b1b"/>
     </g>
     <rect x="-40" y="-10" width="240" height="110" fill="url(#${i}kl)"/><rect x="-40" y="-10" width="240" height="110" fill="url(#${i}vg)"/>
    </svg>`;
  }

  const AD = {
    adv: 'Kilnworks Compute', who: 'Arjun Rao, CTO of Kilnworks', line: 'H200 hours, billed by the minute.', price: '$2,150',
    thumb: ['GPUs by', 'the minute'], len: '0:41',
    person: { skin: '#a86c46', hair: '#141010', shirt: '#22304d', bg: '#d9dde6', style: 'short', beard: true },
    script: ['I’m Arjun from Kilnworks.', 'Most GPU clouds want a year-long contract.', 'We bill H200 hours by the minute.', 'Spin one up in Mumbai, Frankfurt or Virginia today.'],
  };
  const title = `<b>${esc(AD.thumb[0])} <mark>${esc(AD.thumb[1])}</mark></b>`;
  const bar = document.createElement('aside');
  bar.className = 'adbar';
  bar.setAttribute('aria-label', 'Sponsored');
  bar.innerHTML = `
    <button class="adbar-thumb" type="button" aria-label="Play ad from ${esc(AD.adv)}">${personSVG(AD.person, 'std')}<span class="adbar-tt">${title}</span><span class="adbar-play"><i></i></span></button>
    <div class="adbar-txt"><div class="adbar-meta"><span class="adbar-l"><i></i>Sponsored</span><span class="adbar-adv">${esc(AD.adv)}</span></div><b class="adbar-hl">${esc(AD.line)}</b></div>
    <div class="adbar-side"><span class="adbar-price">Won at ${esc(AD.price)}</span><button class="adbar-bid" type="button">Bid for this spot</button></div>`;
  root.querySelector('.section-marker').after(bar);

  // "Bid for this spot" goes to the auction at the end of the issue and opens it.
  const bid = () => {
    const body = document.getElementById('end-auction-body');
    const toggle = document.querySelector('[aria-controls="end-auction-body"]');
    if (body && body.hidden && toggle) toggle.click();
    (document.querySelector('.end-auction') || body)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  };

  // Player: the bar itself grows and the presenter "speaks" the script with captions (simulated, like the Bought. Daily prototype).
  let timer = 0, player = null;
  const closeAd = () => { if (!player) return; clearInterval(timer); player.remove(); player = null; bar.classList.remove('is-open'); bar.querySelector('.adbar-thumb').setAttribute('aria-expanded', 'false'); };
  const openAd = () => {
    player = document.createElement('div');
    player.className = 'adbar-player';
    player.innerHTML = `<div class="adbar-stage is-talking">${personSVG(AD.person, 'std')}<span class="adbar-tag">Ad · ${AD.len}</span><div class="adbar-cc"><span>${esc(AD.script[0])}</span></div><button class="adbar-ov-close" type="button" aria-label="Close ad">×</button></div>`;
    bar.append(player);
    bar.classList.add('is-open');
    bar.querySelector('.adbar-thumb').setAttribute('aria-expanded', 'true');
    const cc = player.querySelector('.adbar-cc span'); let i = 0;
    timer = setInterval(() => { i = (i + 1) % AD.script.length; cc.textContent = AD.script[i]; }, 2600);
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) player.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  bar.addEventListener('click', (e) => {
    if (e.target.closest('.adbar-bid')) { bid(); return; }
    if (e.target.closest('.adbar-ov-close') || bar.classList.contains('is-open')) { closeAd(); return; }
    openAd();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeAd(); });
})();
