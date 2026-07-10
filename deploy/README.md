# Deployment — cPanel origin + Cloudflare

The site is a **fully static** Astro build (`dist/`, plain HTML/CSS/JS — no server
runtime). Production is hosted on **cPanel** (Apache/LiteSpeed) and fronted by
**Cloudflare**. Pushing to `main` triggers `.github/workflows/deploy.yml`, which
builds and uploads `dist/` to the cPanel account over SSH, then purges Cloudflare.

```
GitHub push → Actions (npm ci → npm run build) → rsync dist/ → cPanel public_html → Cloudflare edge → visitors
```

Security headers, CSP and caching are served by **`public/.htaccess`** (ported from
the old netlify.toml). It lives in `public/`, so it ships inside `dist/` on every
build — nothing to configure on the server. (`deploy/nginx.conf` is only for a
plain nginx/root server, not cPanel.)

---

## 1. cPanel account (one-time)

You only need access to **your cPanel account** — not root. From the host, get:
your cPanel **username**, the **server hostname/IP** (`51.38.53.67`), and **SSH
enabled** for the account (ask the host if "Terminal"/SSH isn't already on).

- **Docroot:** the main domain serves from `~/public_html`. (If you'd rather serve
  from a subdomain or addon domain, note that domain's document root instead.)
- **SSH key for CI:** in cPanel → **SSH Access → Manage SSH Keys → Generate**, then
  **Authorize** the public key. Download the **private** key for the GitHub secret.
  (Or generate a keypair locally and paste the public key into Authorized Keys.)

## 2. GitHub Actions secrets

Repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `SSH_HOST` | `51.38.53.67` |
| `SSH_USER` | your cPanel username |
| `SSH_PORT` | cPanel SSH port (often `22`; some hosts use a custom port) |
| `SSH_PRIVATE_KEY` | the private key authorized in step 1 |
| `DEPLOY_PATH` | `/home/<cpanel-user>/public_html` |
| `CLOUDFLARE_ZONE_ID` | *(optional)* zone id for `pratenici.mk` |
| `CLOUDFLARE_API_TOKEN` | *(optional)* token with `Zone → Cache Purge` |

Until `SSH_HOST` is set the workflow still builds — it just skips the upload, so
pushes won't fail before cutover.

## 3. Cloudflare

1. **Add the site** at dash.cloudflare.com → *Add a site* → `pratenici.mk`. Cloudflare
   gives you **two nameservers**.
2. At the **.mk registrar**, change the domain's nameservers to those two. (This is
   what actually puts Cloudflare in front — an A record alone at the registrar does
   not. Give it time to propagate.)
3. In Cloudflare **DNS**: `A  pratenici.mk → 51.38.53.67` **Proxied** (orange cloud);
   `CNAME www → pratenici.mk` Proxied.
4. **SSL/TLS → Overview → Full (Strict)**. Install a cert on the origin: easiest is
   cPanel's free **AutoSSL** (Let's Encrypt) for `pratenici.mk`; Full (Strict) will
   validate it. (Alternatively a Cloudflare Origin Certificate in cPanel → SSL/TLS.)
5. **SSL/TLS → Edge Certificates → Always Use HTTPS: On**.
6. **Speed → Optimization:** Brotli on; leave JS/CSS minify off (Astro already minifies).

## 4. First deploy + cutover

1. Confirm nameservers have moved to Cloudflare and `pratenici.mk` resolves to the
   proxied A record.
2. Set the GitHub secrets (step 2).
3. Push to `main` (or **Actions → Deploy → Run workflow**) to build and upload.
4. Load `https://pratenici.mk`, then verify headers, e.g.:
   `curl -sI https://pratenici.mk | grep -i -E 'content-security-policy|strict-transport'`

> The old `netlify.toml` is kept only as reference / optional staging.
