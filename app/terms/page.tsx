import type { Metadata } from 'next';
import Link from 'next/link';

import { MarketFooter } from '@/components/market-chrome';
import { MarketTopbar } from '@/components/market-topbar';

export const metadata: Metadata = {
  title: 'Terms of Service — BOUGHT',
  description: 'The terms that govern using BOUGHT, publishing broadcasts, and participating in the daily market.',
};

const sections = [
  ['service', 'The BOUGHT service'],
  ['accounts', 'Accounts and eligibility'],
  ['auction', 'Bids, auctions, and ranking'],
  ['payments', 'Payments and refunds'],
  ['content', 'Broadcasts and moderation'],
  ['rights', 'Your content and our license'],
  ['conduct', 'Acceptable use'],
  ['availability', 'Availability and third parties'],
  ['liability', 'Disclaimers and liability'],
  ['general', 'Changes and general terms'],
];

export default function TermsPage() {
  return (
    <main className="market-shell dashboard-shell legal-shell">
      <MarketTopbar active="terms" />
      <div className="legal-page">
        <header className="legal-hero">
          <div>
            <span className="legal-eyebrow"><i /> BOUGHT / LEGAL</span>
            <h1>Terms of Service<span>.</span></h1>
            <p>
              The rules for using BOUGHT, publishing a broadcast, and taking a
              position in the daily market.
            </p>
          </div>
          <div className="legal-meta">
            <span>Effective</span>
            <strong>September 8, 2026</strong>
            <span>Last updated</span>
            <strong>September 8, 2026</strong>
          </div>
        </header>

        <div className="legal-layout">
          <aside className="legal-index" aria-label="On this page">
            <span className="legal-index-label">ON THIS PAGE</span>
            <nav>
              {sections.map(([id, label], index) => (
                <a href={`#${id}`} key={id}>
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  {label}
                </a>
              ))}
            </nav>
          </aside>

          <article className="legal-document">
            <p className="legal-lead">
              These Terms of Service (the “Terms”) govern access to and use of
              BOUGHT (the “Service”), including the public floor,
              broadcast recording and publishing flow, profiles, watchlists,
              magazine, and checkout. By accessing BOUGHT, creating an account,
              submitting a broadcast, or completing a payment, you agree to these
              Terms.
            </p>
            <p>
              If you do not agree, do not use the Service or submit a broadcast.
              These Terms apply together with any rules shown in the BOUGHT
              product flow. If the two conflict, these Terms control unless the
              product flow states a more specific requirement for a particular
              auction.
            </p>

            <section id="service">
              <h2>01 / The BOUGHT service</h2>
              <p>
                BOUGHT is a paid broadcast platform. You choose a category,
                record a short video, and attach a bid to reserve a place in the
                next auction. Approved broadcasts appear on the public floor,
                where higher paid bids rank above lower paid bids.
              </p>
              <p>
                BOUGHT is not an editorial publication, investment product,
                endorsement, certification, or promise of audience, customers,
                revenue, or any particular outcome. A payment buys a place in the
                BOUGHT auction process, not guaranteed attention or a permanent
                position.
              </p>
            </section>

            <section id="accounts">
              <h2>02 / Accounts and eligibility</h2>
              <ul>
                <li>You must be old enough to enter a binding contract where you live.</li>
                <li>You are responsible for the email address and account you use to access BOUGHT.</li>
                <li>You may not impersonate another person, company, or creator.</li>
                <li>If you use BOUGHT for a company or project, you confirm that you have authority to do so.</li>
                <li>You must keep the information you submit accurate and up to date.</li>
              </ul>
              <p>
                We may suspend or close an account when we reasonably believe it
                is being used to break these Terms, deceive people, interfere
                with the Service, or create legal, security, or reputational risk.
              </p>
            </section>

            <section id="auction">
              <h2>03 / Bids, auctions, and ranking</h2>
              <p>
                Bidding runs from 00:00 to 12:00 UTC. During that window,
                published bids can move as other participants enter the market.
                At 12:00 UTC, the current order is frozen for the exposure period,
                which ends at 00:00 UTC.
              </p>
              <p>
                Higher paid bids rank first. When bids are equal, the earlier
                server-side payment confirmation ranks first; if that is also
                equal, BOUGHT uses the broadcast identifier as a final
                tiebreaker. The database clock controls auction transitions, not
                the clock on your device.
              </p>
              <p>
                A payment reserves an entry and does not guarantee a specific
                rank. A broadcast that finishes upload or review after the
                cutoff may move to the next auction without an additional payment.
              </p>
            </section>

            <section id="payments">
              <h2>04 / Payments and refunds</h2>
              <p>
                Bids are charged in US dollars. Checkout is handled by the
                payment provider shown to you at checkout, such as Stripe or
                Razorpay. BOUGHT does not receive or store your full payment-card
                number. The provider’s own terms and privacy notice also apply to
                the payment transaction.
              </p>
              <p>
                A payment is considered confirmed only after BOUGHT receives and
                verifies the provider’s server-side confirmation. A browser
                callback or a closed checkout window is not, by itself, proof of
                payment. Do not pay twice if a checkout appears delayed; resume
                the saved broadcast or contact support through the channel shown
                in your receipt.
              </p>
              <p>
                Unless mandatory law requires otherwise, payments are final once
                payment is confirmed and the paid broadcast flow has started.
                Being outranked, receiving fewer views than expected, missing an
                auction cutoff, a rejected broadcast, or a later removal for
                breaking these Terms does not create a refund right. We honor any
                non-waivable consumer rights that apply to you.
              </p>
              <p>
                A refund, reversed payment, or payment dispute may remove the
                associated broadcast from the public floor. Unjustified
                chargebacks and payment abuse may lead to account restrictions.
              </p>
            </section>

            <section id="content">
              <h2>05 / Broadcasts and moderation</h2>
              <p>
                Broadcasts can be up to two minutes long and must include usable
                video and audio. You may choose a frame from the recording or
                upload a supported thumbnail. A moderator checks the broadcast,
                audio, thumbnail, and content before publication. We may request
                a retake or decline to publish a submission.
              </p>
              <p>
                A rejected broadcast may be recorded again when the product flow
                allows it. Review is a publication decision, not a statement that
                BOUGHT agrees with, verifies, or guarantees what you say.
              </p>
              <p>
                We may refuse, delay, edit for display, recategorize, hide, or
                remove a broadcast, title, thumbnail, profile, or published entry
                when we believe it violates these Terms, the law, another
                person’s rights, or the safety of the Service. Removal does not
                undo a completed payment unless required by law.
              </p>
            </section>

            <section id="rights">
              <h2>06 / Your content and our license</h2>
              <p>
                You keep ownership of the broadcast, thumbnail, title, profile
                information, and other material you submit. You give BOUGHT a
                worldwide, non-exclusive, royalty-free license to host, store,
                process, transcode, create thumbnails, display, and distribute
                that material as needed to operate, moderate, improve, and
                promote the Service.
              </p>
              <p>
                This license continues for as long as the material is needed for
                the Service or its records. You confirm that you have the rights
                and permissions needed to submit the material and to let BOUGHT
                use it in these ways.
              </p>
              <p>
                Public broadcasts may show your title, category,
                bid, rank, publication time, thumbnail, and the broadcast itself.
                Payment references and private account identifiers are not part of
                the public listing.
              </p>
            </section>

            <section id="conduct">
              <h2>07 / Acceptable use</h2>
              <p>You may not use BOUGHT to:</p>
              <ul>
                <li>break the law, defame, harass, threaten, exploit, or target people with hateful or violent content;</li>
                <li>publish sexual exploitation, non-consensual intimate material, or content involving children in a sexual context;</li>
                <li>infringe copyright, trademark, privacy, publicity, or other rights;</li>
                <li>promote fraud, phishing, malware, counterfeit goods, or deceptive schemes;</li>
                <li>make regulated offers that require a license you do not have, including certain financial, medical, gambling, or weapons-related offers;</li>
                <li>scrape the Service beyond ordinary browsing, manipulate views or rankings, bypass rate limits, or probe, reverse engineer, or disrupt the Service except where mandatory law permits it;</li>
                <li>upload content that contains malicious code or another person’s private information without a lawful basis.</li>
              </ul>
            </section>

            <section id="availability">
              <h2>08 / Availability and third parties</h2>
              <p>
                BOUGHT may be unavailable, delayed, or inaccurate. Auction state,
                ranks, view counts, playback, email delivery, and account access
                may change as the Service is updated or as providers recover from
                outages. We may change, pause, or discontinue any feature,
                category, auction rule, or part of the Service.
              </p>
              <p>
                BOUGHT relies on third-party services for authentication,
                payments, video processing, storage, analytics, and hosting. Those
                services have their own terms and availability. We are not
                responsible for a third party’s acts or omissions outside our
                reasonable control.
              </p>
            </section>

            <section id="liability">
              <h2>09 / Disclaimers and liability</h2>
              <p>
                To the fullest extent permitted by law, BOUGHT is provided “as
                is” and “as available.” We do not promise that it will be
                uninterrupted, secure, error-free, or that any broadcast will
                receive a particular number of views or produce any result.
              </p>
              <p>
                We are not responsible for indirect, incidental, special,
                consequential, or punitive losses, or for lost profits, data,
                goodwill, or substitute services, to the extent the law allows
                that exclusion. Nothing in these Terms excludes liability that
                cannot legally be excluded, including liability for fraud, wilful
                misconduct, or injury caused by negligence where applicable law
                does not permit the limitation.
              </p>
              <p>
                You agree to reimburse BOUGHT and the people who operate it for
                reasonable claims, losses, and costs arising from your content,
                your use of the Service, your breach of these Terms, or your
                infringement of another person’s rights.
              </p>
            </section>

            <section id="general">
              <h2>10 / Changes and general terms</h2>
              <p>
                We may update these Terms. When we make a material change, we
                will update the date at the top of this page. Your continued use
                of BOUGHT after an update means you accept the revised Terms.
                The version in effect when a payment is confirmed applies to that
                payment, except where a change is required by law or needed to
                address a security or legal risk.
              </p>
              <p>
                If part of these Terms cannot be enforced, the rest remains in
                effect. Our failure to enforce a provision is not a waiver. You
                may not transfer your rights under these Terms without our
                consent; we may transfer them as part of a merger, sale, or
                transfer of the Service.
              </p>
              <p>
                Questions about these Terms, a broadcast, or a payment should be
                sent through the support contact provided by BOUGHT in your
                account or payment receipt. If mandatory consumer law gives you
                rights that these Terms cannot remove, those rights still apply.
              </p>
            </section>

            <div className="legal-next-step">
              <span className="legal-eyebrow"><i /> READY TO TAKE THE FLOOR?</span>
              <p>Read how the BOUGHT auction moves before you publish.</p>
              <Link href="/how-it-works">HOW IT WORKS <span>↗</span></Link>
            </div>
          </article>
        </div>

        <MarketFooter />
      </div>
    </main>
  );
}
