/* The document around the page: the same <head> and <body class="booting"> as public/index.html. Nothing here runs in the
   browser; the page ships with no framework JavaScript (pages/index.tsx sets unstable_runtimeJS: false). */
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta name="description" content="Tech, AI and business, made simple. The day's news as a newspaper, short videos and one audio brief." />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Bought." />
        <meta property="og:title" content="Bought. Daily" />
        <meta property="og:description" content="Tech, AI and business, made simple. The day's news as a newspaper, short videos and one audio brief." />
        <noscript><style>{"body.booting main{visibility:visible}"}</style></noscript>
        <meta name="claude:viewport-fit-sides" content="cover" />
        <meta name="theme-color" content="#f3eee4" />
      </Head>
      <body className="booting">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
