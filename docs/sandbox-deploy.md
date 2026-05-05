# csmp_v2 — Sandbox/Demo Deployment Runbook

This runbook deploys an invite-only demo of csmp_v2 to
`demo.csmp.marekmalczewski.pl` on the same OVH VPS that runs production.
**Production is not modified.** The sandbox stack uses different container
names, different Postgres volume names, different host ports, a different
JWT secret, and a separate nginx vhost.

## Prerequisites on the VPS (`146.59.33.182`)

- Docker + docker compose (already present from the prod deploy)
- nginx + certbot (already present)
- The `csmp_v2` repo at `/opt/csmp-v2-sandbox/` (NOT `/opt/csmp-v2/` — that's prod)

## 1. Clone the repo into a sandbox-only directory

From your laptop:

```bash
tar --exclude='**/node_modules' --exclude='**/dist' --exclude='**/.env*' \
    -czf /tmp/csmp-v2-sandbox.tgz .
scp -i ~/.ssh/id_ed25519_ovh /tmp/csmp-v2-sandbox.tgz \
    ubuntu@146.59.33.182:/tmp/

ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo mkdir -p /opt/csmp-v2-sandbox && \
   sudo tar -xzf /tmp/csmp-v2-sandbox.tgz -C /opt/csmp-v2-sandbox && \
   sudo chown -R ubuntu:ubuntu /opt/csmp-v2-sandbox'
```

## 2. Write the sandbox env file

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'cp /opt/csmp-v2-sandbox/docker/.env.sandbox.example \
      /opt/csmp-v2-sandbox/docker/.env.sandbox && \
   chmod 600 /opt/csmp-v2-sandbox/docker/.env.sandbox'
```

Then edit `/opt/csmp-v2-sandbox/docker/.env.sandbox` and replace every
placeholder. **The JWT_SECRET MUST differ from production's**:

```bash
openssl rand -hex 32   # for JWT_SECRET
openssl rand -hex 32   # for OWNER_TOKEN
openssl rand -base64 24 # for both Postgres passwords (use distinct ones)
```

## 3. CRITICAL: verify the volume name override before the first `up`

The production compose hardcodes `name: csmp-v2-postgres-data`. If the
sandbox compose layering doesn't override it, the sandbox stack would mount
the production data volume and overwrite production data on first seed.

**Run this dry-run check** and confirm the rendered volume names are the
sandbox-prefixed ones, not the production ones:

```bash
cd /opt/csmp-v2-sandbox
docker compose -p csmp-v2-sandbox \
  -f docker/docker-compose.yml \
  -f docker/docker-compose.sandbox.yml \
  --env-file docker/.env.sandbox \
  config | grep -A2 'name:'
```

You MUST see:

```
    name: csmp-v2-sandbox-postgres-data
    name: csmp-v2-sandbox-feedback-postgres-data
    name: csmp-v2-sandbox-reset-state
```

If you see `csmp-v2-postgres-data` instead, **stop**. The override file is
not being applied. Do not bring the stack up.

## 4. DNS

DNS A record `demo.csmp.marekmalczewski.pl → 146.59.33.182`. Use the
existing `ovh_dns.py` automation in the sibling workspace:

```bash
python "C:\Users\marek\Documents\Claude\Projects\Physical Security Risk Assesment app - CSMP Compliant\scripts\ovh_dns.py" \
  upsert demo.csmp.marekmalczewski.pl 146.59.33.182
```

Confirm:

```bash
dig demo.csmp.marekmalczewski.pl +short
# → 146.59.33.182
```

## 5. Bring up the stack

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'cd /opt/csmp-v2-sandbox && \
   sudo docker compose -p csmp-v2-sandbox \
     -f docker/docker-compose.yml \
     -f docker/docker-compose.sandbox.yml \
     --env-file docker/.env.sandbox \
     up -d --build'
```

Wait ~30 s for the API to seed. Verify:

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo docker logs csmp-v2-sandbox-api 2>&1 | tail -30'
# → "[maybe-seed] empty DB — running seed.ts"
# → "[maybe-seed] seed complete"
# → "SANDBOX_MODE active — guards/helmet enabled, register/users/swagger disabled"
# → server listening on :3001

curl -s http://127.0.0.1:8081/healthz   # via the in-container nginx (host port)
# → ok
```

## 6. nginx vhost + TLS

Create `/etc/nginx/sites-available/demo.csmp.marekmalczewski.pl`:

```nginx
server {
    server_name demo.csmp.marekmalczewski.pl;
    listen 80;

    # Hide from search engines and crawlers (sandbox-only).
    add_header X-Robots-Tag "noindex, nofollow, noarchive" always;

    # Owner-only admin endpoints get a second auth layer at the edge.
    location /admin/ {
        auth_basic "csmp owner";
        auth_basic_user_file /etc/nginx/.htpasswd-csmp-admin;
        proxy_pass http://127.0.0.1:8081;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://127.0.0.1:8081;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set up the htpasswd for the owner Basic-Auth layer (use a different password
from `OWNER_TOKEN` — Basic Auth and the API token are independent):

```bash
sudo apt install -y apache2-utils  # if not already
sudo htpasswd -c /etc/nginx/.htpasswd-csmp-admin owner
sudo chmod 640 /etc/nginx/.htpasswd-csmp-admin
sudo chown root:www-data /etc/nginx/.htpasswd-csmp-admin
```

Enable + reload:

```bash
sudo ln -s /etc/nginx/sites-available/demo.csmp.marekmalczewski.pl \
           /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Get the TLS cert:

```bash
sudo certbot --nginx -n --agree-tos --redirect \
  --email mac.damian@gmail.com -d demo.csmp.marekmalczewski.pl
```

## 7. Snapshot the seeded DB so resets have a baseline

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo /opt/csmp-v2-sandbox/scripts/sandbox/snapshot.sh'
# → "snapshot complete — 'csmp_demo_template' is now the reset baseline"
```

## 8. Install the 48-h reset cron

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo chmod +x /opt/csmp-v2-sandbox/scripts/sandbox/*.sh && \
   sudo /opt/csmp-v2-sandbox/scripts/sandbox/install-cron.sh'
# → "installed: 0 4 */2 * * /opt/csmp-v2-sandbox/scripts/sandbox/reset.sh"

sudo crontab -l | grep csmp-sandbox
```

Optional — manually trigger a reset to verify the cycle end-to-end:

```bash
sudo /opt/csmp-v2-sandbox/scripts/sandbox/reset.sh
sudo tail /var/log/csmp-sandbox-reset.log
```

## 9. Mint your first reviewer invite

```bash
export SANDBOX_BASE_URL=https://demo.csmp.marekmalczewski.pl
export OWNER_TOKEN=…the value you put in .env.sandbox…

scripts/sandbox/create-invite.sh "Smoke-test reviewer" me@example.com 30
# → Invite created: <uuid>
# → Reviewer link:  https://demo.csmp.marekmalczewski.pl/?invite=<token>
```

Open the link in an incognito window. You should land in the demo app as
ADMIN, see the "DEMO" banner with a countdown, the role switcher in the
top-right, and a feedback button. Submit a test feedback message and confirm
it arrives via email + in `/admin/feedback`.

## 10. Smoke tests

Run from your laptop:

```bash
URL=https://demo.csmp.marekmalczewski.pl

# Security headers in place
curl -sI "$URL" | grep -iE 'x-frame|x-content|x-robots|strict-transport'

# Production-only routes are gone
curl -s "$URL/api/auth/register" -o /dev/null -w '%{http_code}\n'   # 404
curl -s "$URL/api/users"          -o /dev/null -w '%{http_code}\n'  # 404
curl -s "$URL/api/docs"           -o /dev/null -w '%{http_code}\n'  # 404

# Public sandbox endpoints
curl -s "$URL/api/sandbox/status" | jq .

# Login-as without an invite is rejected
curl -s -X POST "$URL/api/sandbox/login-as" \
  -H 'Content-Type: application/json' \
  -d '{"role":"ADMIN","invite":"bogus-bogus-bogus"}' | jq .

# Owner endpoints require both Basic Auth and X-Admin-Token
curl -s "$URL/admin/feedback" -o /dev/null -w '%{http_code}\n'   # 401 (Basic)
curl -s -u owner:<htpasswd-pass> "$URL/admin/feedback" \
  -o /dev/null -w '%{http_code}\n'                               # 401 (X-Admin-Token)
curl -s -u owner:<htpasswd-pass> -H "X-Admin-Token: $OWNER_TOKEN" \
  "$URL/admin/feedback" | jq .                                   # 200
```

## 11. Keep production untouched

```bash
ssh -i ~/.ssh/id_ed25519_ovh ubuntu@146.59.33.182 \
  'sudo docker volume ls | grep csmp'
# Confirm both exist and are distinct:
#   csmp-v2-postgres-data            (prod — DO NOT TOUCH)
#   csmp-v2-sandbox-postgres-data    (demo)
#   csmp-v2-sandbox-feedback-postgres-data (demo, never reset)

curl -sI https://react.csmp.marekmalczewski.pl/   # prod still 200
```

## When SSH/HTTPS to the VPS stops responding (fail2ban escalation)

Same recovery flow as the prod deploy — see `csmp_v2/CLAUDE.md`:

```bash
python scripts/ovh-vps-reboot.py reboot
```

## Operational tasks

- **Rotate OWNER_TOKEN**: edit `.env.sandbox`, then `docker compose -p csmp-v2-sandbox … up -d` (api restart picks up new env). Old invites still work — the token only authenticates `/admin/*`.
- **Revoke an invite**: `curl -u owner:… -H "X-Admin-Token: $OWNER_TOKEN" -X DELETE $URL/admin/invites/<id>`. The reviewer's stored invite-token will fail next API call, which forces them back to the invite-gate landing.
- **Export feedback**: `sudo /opt/csmp-v2-sandbox/scripts/sandbox/feedback-export.sh ~/feedback-$(date +%F).csv`.
- **Force a reset**: `sudo /opt/csmp-v2-sandbox/scripts/sandbox/reset.sh`.
- **Tear down**: `sudo docker compose -p csmp-v2-sandbox … down`. Volumes survive. Add `-v` only if you want to wipe seeded data + reviewer invites + feedback.
