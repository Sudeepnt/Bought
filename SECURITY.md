# Security

What protects Bought, layer by layer. Nothing here relies on a secret address: everything below assumes an attacker knows every path and has every tool.

## 1. The desk (admin) is not on the internet

- The public server (`PublicHandler` in `pipeline/server.py`) has no admin code paths. `/admin/*` on the public address is a missing file, for GET, POST and HEAD.
- The desk is a second listener on 127.0.0.1:8100. The firewall doesn't open it and Caddy doesn't route to it. You reach it through an SSH tunnel (your SSH key) or Tailscale (your devices only).
- Sign-in needs the password (24 random characters) **and** a one-time code from an authenticator app (RFC 6238; each code works once). Five tries per 15 minutes.
- The desk answers only to its own host names (`localhost:8100`, `127.0.0.1:8100`, `BOUGHT_DESK_HOSTNAMES`). A web page that points its own domain at 127.0.0.1 (DNS rebinding) is refused, so a malicious site open in your browser can't reach it.
- Every desk form checks the request came from the desk itself (Origin), and the session cookie is HttpOnly and SameSite=Strict.
- The desk's pages run only their own script (a CSP that names its hash) and can't be framed.

## 2. The public surface is small

Readers and the internet reach only: the site's files; `/api/subscribe`; `/api/hit` (reader counts, below); `/confirm` and `/unsubscribe` (mail links with random tokens); `/api/bought/*` (the ads API); `/healthz` (says only `{"ok": true}`).

- The ads API's `admin` and `cron` paths are refused at the proxy, and need a 32-byte secret at the backend as well. The backend itself listens only on 127.0.0.1.
- Advertisers sign in through Supabase Auth (email code, or Google). Every ad action needs a confirmed email, the site's own Origin, and passes a rate limit that fails closed.
- Webhooks (Mux, Stripe, Razorpay) are accepted only with a valid signature, and amounts and currencies are checked.
- No software or version names in responses (`Server: Bought`), and no folder listings.
- Reader counts (`/api/hit`, `pipeline/analytics.py`) store nothing that identifies a reader: no cookie, no id, no IP address, no browser string. A visitor is counted once a day by a hash of that day's random salt, the IP and the browser; the salt and the hashes are deleted the day after. Only known fields in known shapes are kept (a referrer becomes a bare site name), bots and headless browsers are skipped, one address gets at most 300 hits a minute, and hits wait in a bounded queue written every 5 seconds, so a flood can't fill memory or the disk.

## 3. The browser runs only our code

The page has a strict Content-Security-Policy: scripts only from the site itself (plus Razorpay's checkout), no `eval`, no inline scripts (share pages may run exactly their one-line redirect, by hash), no plugins, no framing by other sites. Connections are limited to the site, the Supabase project, Mux, and Razorpay. Other headers: HSTS (2 years, preload), nosniff, a strict Referrer-Policy, and a Permissions-Policy that allows the camera and microphone only for the site itself.

## 4. The server

`deploy/setup.sh`:
- Firewall: only 80 and 443 in; SSH rate-limited; fail2ban.
- SSH: keys only, no passwords, root only with a key, local tunnels only (no agent or X11 forwarding).
- Security updates install themselves every day.
- The service runs as its own user in a systemd sandbox: it can write only `/srv/bought`, has no capabilities, can't gain privileges, and sees no other users, devices or kernel settings.
- Keys live in `/etc/bought/bought.env`, readable by root only (systemd hands them to the service). The databases and backups are readable by the service user only. Caddy can read the site's files and nothing else.
- Background jobs run at the lowest priority, so a heavy job can't take the site down.

## 5. Self-hosting Supabase later

If Supabase moves onto this server, treat its dashboard (Studio) and its admin API like the desk: bind them to 127.0.0.1, reach them through the tunnel, and expose only the Auth and REST endpoints the browser needs, through Caddy.

## Reporting

Tell the maintainers privately; don't open a public issue.
