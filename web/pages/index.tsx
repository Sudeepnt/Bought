/* Bought. Daily: the newspaper, server-rendered. The markup is public/index.html's, element for element; the browser runs
   the same scripts in the same order (public/js/), and they find the issue and the ads config already in the page
   (#boot-data) instead of fetching them one after another before the first paint. */
import Head from "next/head";
import type { GetServerSideProps } from "next";
import type { CSSProperties } from "react";
import { assets, boot, scriptJSON, type Assets } from "../lib/boot";

/* no React or Next.js in the browser: the page is plain HTML plus public/js, so nothing hydrates over what the scripts draw */
export const config = { unstable_runtimeJS: false };

type Props = { data: string; modules: string[]; preconnect: string | null; assets: Assets };

export const getServerSideProps: GetServerSideProps<Props> = async ({ res }) => {
  const a = assets(), b = await boot();
  res.setHeader("Cache-Control", "no-cache");       // always checked: a new issue shows the moment it is published
  return { props: { data: scriptJSON(b.data), modules: b.modules, preconnect: b.preconnect, assets: a } };
};

const v = (c: string) => ({ "--c": c }) as CSSProperties;

function AppBar() {
  return (
    <header className="appbar" id="appbar">
      <div className="ab-in">
        <button className="ab-brand" type="button" data-go="paper" aria-label="Bought. — today's issue">Bought<span>.</span></button>
        <nav className="ab-nav" aria-label="Main">
          <button type="button" data-go="paper">Today</button>
          <button type="button" data-go="radio">Listen<span className="eq" aria-hidden="true"><i></i><i></i><i></i></span></button>
          <button type="button" data-go="advertise">Advertise<span className="nb" aria-hidden="true"></span></button>
        </nav>
        <div className="ab-right">
          <span className="ab-status" id="ab-status"></span>
          <button className="themebtn" id="themebtn" type="button" aria-label="Switch theme">
            <svg className="i-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" /></svg>
            <svg className="i-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
          </button>
          <button className="ab-me" id="ab-me" type="button" aria-label="Sign in" data-me=""><img src="img/avatar.webp?v=1" alt="" width="36" height="36" decoding="async" /></button>
        </div>
      </div>
      <div className="ab-pages"><div className="abp-in">
        <button className="abp-arrow" type="button" data-turn="prev" aria-label="Previous page">‹</button>
        <nav className="abp-tabs" id="abp-tabs" aria-label="Pages"></nav>
        <button className="abp-arrow" type="button" data-turn="next" aria-label="Next page">›</button>
        <label className="abp-filter"><span className="vh">Show</span><select id="pfilter"><option value="all">All stories</option><option value="video">Video</option><option value="quick">2-min reads</option><option value="say">Have your say</option></select></label>
      </div></div>
      <div className="ab-progress" aria-hidden="true"><i id="readline"></i></div>
    </header>
  );
}

function Today() {
  return (
    <section className="view" id="v-paper" aria-label="Today's issue">
      <div className="pages" id="pages">
        {/* page 1: the front page */}
        <article className="page front" data-page="0" aria-label="Page 1, front page" style={v("var(--theme)")}>
          <header className="mast">
            <div className="arch" id="arch" hidden></div>
            <div className="mast-top"><div className="mt-l"><span id="m-date"></span><span className="ed-name" id="m-edition"></span></div>
              <nav className="inav" aria-label="Issues">
                <button type="button" className="inav-b" data-issue-step="-1" aria-label="Previous issue"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
                <button type="button" className="inav-cal" data-cal="" aria-label="Open the archive"><svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="1.3" /><path d="M2 6.5h12M5.5 1.8v2.6M10.5 1.8v2.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /></svg><span id="inav-lab">Today</span></button>
                <button type="button" className="inav-b" data-issue-step="1" aria-label="Next issue"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button>
              </nav></div>
            <h1 className="mast-word" id="mastword">Bought<span>.</span></h1>
            <p className="mast-tag"><span>Tech, AI and business, made simple</span></p>
            <div className="dateline"><span>Bengaluru · Global</span><span id="m-issue"></span><span><label htmlFor="lang" className="vh">Language</label><select id="lang"><option>English</option><option>हिन्दी</option><option>ಕನ್ನಡ</option></select></span></div>
          </header>
          <div id="top-spot"></div>
          <section className="lead" id="lead"></section>
          <section className="brief30 rv" aria-label="Today in 30 seconds"><span className="stamp">Today in 30 seconds</span><ol id="brief"></ol></section>
          <section className="tops" id="tops" aria-label="Top stories"></section>
          <section className="pulse rv" id="pulse" aria-label="The Pulse"></section>
          <div className="nums-h rv"><span>The day in numbers</span><small>tap a number for the story</small></div>
          <div className="nums rv" id="nums"></div>
          <section className="talk rv" id="talk" aria-label="Most discussed"></section>
          <div id="front-spot"></div>
          <section className="pindex rv" aria-label="In this issue"><h2>In this issue</h2><ol id="pindex"></ol></section>
          <span className="fold" aria-hidden="true"></span>
        </article>
        {/* pages 2–7: one section per page */}
        <div id="sections" className="pages-mid"></div>
        {/* page 8: clips, classifieds, back page */}
        <article className="page back" data-page="7" aria-label="Page 8, back page" style={v("var(--ink-2)")}>
          <div className="rh-slot" data-rh="7"></div>
          <section className="sec" id="sec-clips"><div className="pagehead rv"><span className="pg">8</span><div><h2>Clips</h2><p className="ph-index">Today's biggest stories, about a minute each</p></div></div><div className="clips" id="clips"></div></section>
          <div id="issue-thread"></div>
          <div id="cls-end"></div>
          <div className="subrow rv"><p>Get the next issue at <span data-next-time="">06:00 UTC</span>.</p><form id="subform" noValidate><label htmlFor="email" className="vh">Email address</label><input id="email" type="email" placeholder="you@company.com" autoComplete="email" /><button className="btn" type="submit">Subscribe</button></form><p className="toast-sub" id="toast-sub" hidden></p></div>
          <div className="done" id="done" hidden><div className="seal">ALL<br />READ</div><h2>You're up to date.</h2><p>Next issue at <span data-next-time="">06:00 UTC</span>.</p></div>
          <section className="engine rv" id="engine" aria-label="How this issue was made"></section>
          <footer className="foot"><span>© 2026 Bought. Stories link to their original sources. Comments, votes, advertisers and bids are sample data for now.</span><nav><button type="button" className="linkbtn" data-go="advertise">Advertise</button><button type="button" className="linkbtn" data-go="spec">For developers</button></nav></footer>
        </article>
      </div>
    </section>
  );
}

function Listen() {
  return (
    <section className="view" id="v-radio" hidden aria-label="Listen">
      <section className="stage">
        <div className="booth"><div className="disc" id="disc"></div><div><div className="label">The daily brief · <span id="r-issue"></span></div><h2>Today's Bought. Brief</h2><p id="pod-sub"></p></div></div>
        <div className="wave" id="wave" aria-hidden="true"></div>
        <div className="pbar" id="abar"><i id="afill"></i></div>
        <div className="times"><span id="acur">0:00</span><span id="atotal">0:00</span></div>
        <div className="rcontrols"><button className="rctl" id="aback" type="button" aria-label="Back 15 seconds">−15</button><button className="rplay" id="aplay" type="button" aria-label="Play">▶</button><button className="rctl" id="afwd" type="button" aria-label="Forward 15 seconds">+15</button><button className="rctl" id="aspeed" type="button" aria-label="Playback speed">1×</button></div>
        <div className="rstats"><div><b id="st-n"></b>Stories</div><div><b id="st-min">–</b>Listen time</div><div><b>6</b>Sections</div></div>
        <div className="st-h"><h3>Today's lineup</h3><span id="ach"></span></div>
        <ol className="chapters" id="achapters"></ol>
      </section>
      <p className="note">Keeps playing when you go back to the paper.</p>
    </section>
  );
}

function TabBar() {
  return (
    <nav className="tabbar" aria-label="Main">
      <button type="button" data-go="paper"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h12v14H6a2 2 0 0 1-2-2zM16 9h4v8a2 2 0 0 1-2 2h-2M7 9h6M7 13h6" /></svg>Today</button>
      <button type="button" data-go="radio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 14v-2a8 8 0 0 1 16 0v2" /><rect x="3" y="14" width="4" height="6" rx="1" /><rect x="17" y="14" width="4" height="6" rx="1" /></svg>Listen</button>
      <button type="button" data-go="advertise"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M5 20V10M12 20V4M19 20v-7" /></svg>Advertise<span className="nb" aria-hidden="true"></span></button>
    </nav>
  );
}

function Overlays() {
  return (
    <>
      <div className="mini" id="mini" hidden><span className="mdisc"></span><div><small>Bought. Radio · now playing</small><b id="mini-t"></b></div><button className="mp" id="mini-p" type="button" aria-label="Pause">❚❚</button><button className="mo" id="mini-o" type="button">Open</button></div>
      <div className="scrim" id="rdscrim" hidden></div>
      <article className="reader" id="reader" hidden role="dialog" aria-modal="true" aria-label="Story"></article>
      <div className="sheetwrap" id="sheetwrap" hidden><div className="sheet" id="sheet" role="dialog" aria-modal="true"></div></div>
      <div className="ov" id="ov" hidden><button className="close" id="ovx" type="button">Close</button><div className="vbox" id="ovbox"></div></div>
      <div className="toasts" id="toasts" aria-live="polite"></div>
    </>
  );
}

export default function Paper({ data, modules, preconnect, assets }: Props) {
  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover" />
        <title>Bought. Daily</title>
        {assets.fonts.map(f => <link key={f} rel="preload" href={f} as="font" type="font/woff2" crossOrigin="" />)}
        {assets.styles.map(c => <link key={c} rel="stylesheet" href={c} />)}
        {preconnect && <link rel="preconnect" href={preconnect} crossOrigin="" />}
        {modules.map(m => <link key={m} rel="modulepreload" href={m} />)}
      </Head>
      <AppBar />
      <main className="wrap">
        <Today />
        <Listen />
        <section className="view" id="v-advertise" hidden aria-label="Advertise"><div id="adv"></div></section>
        <section className="view" id="v-spec" hidden aria-label="For developers"><div id="spec"></div></section>
      </main>
      <TabBar />
      <Overlays />
      <script type="application/json" id="boot-data" dangerouslySetInnerHTML={{ __html: data }} />
      {assets.scripts.map(s => <script key={s} src={s}></script>)}
    </>
  );
}
