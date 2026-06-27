# Deploying Warlock on a single VPS

This deploys both pieces on one Linux box:

- **Client** — static files from `dist/`, served by **nginx**.
- **Server** — the Node WebSocket game server (`server/index.ts`), run by **systemd**.

Solo play is pure client-side; only multiplayer talks to the server.

## 0. Server requirements

- Any small Linux VPS: **1 vCPU / 1 GB RAM** is plenty to start (Ubuntu 22.04+ assumed below).
- Open inbound ports: **80** (HTTP). Add **443** later when you attach a domain + TLS.
- Software: `node` (v20+), `nginx`. (No global `tsx` needed — it comes from `node_modules`.)

```bash
sudo apt update && sudo apt install -y nginx
# Node 20 via NodeSource, or nvm — your choice.
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 1. Get the code onto the box

```bash
sudo useradd --system --create-home --home-dir /opt/warlock warlock   # service user
sudo git clone <YOUR_REPO_URL> /opt/warlock
cd /opt/warlock
sudo chown -R warlock:warlock /opt/warlock
sudo -u warlock npm ci
```

## 2. Build the client

The client needs to know how to reach the server. **Two options:**

### Option A — proxy WebSocket through nginx on port 80 (recommended)

The provided `nginx.conf` proxies `ws(s)://<host>/ws/` → the Node server. Build with:

```bash
sudo -u warlock VITE_SERVER_URL="ws://<YOUR_SERVER_IP>/ws" npm run build
```

When you later add a domain + TLS, rebuild with `wss://yourdomain.com/ws`.

### Option B — connect directly to port 8787 (simpler, no proxy needed for WS)

Skip `VITE_SERVER_URL` entirely and just open port **8787** on the firewall. The
client auto-derives `ws://<page-host>:8787`. Simplest for an IP-only test box, but
won't upgrade to `wss://` cleanly once you add HTTPS.

```bash
sudo -u warlock npm run build
sudo ufw allow 8787
```

> This guide uses **Option A** from here on.

## 3. Run the server (systemd)

```bash
sudo cp deploy/warlock-server.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now warlock-server
journalctl -u warlock-server -f      # should print "Warlock server listening..."
```

## 4. Serve the client (nginx)

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/warlock
sudo ln -s /etc/nginx/sites-available/warlock /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default      # drop the welcome page
sudo nginx -t && sudo systemctl reload nginx
```

Visit `http://<YOUR_SERVER_IP>/` — Solo works immediately; open two tabs and use the
**Multiplayer** tab to verify the server connection.

## 5. Later: add a domain + HTTPS

1. Point an A record at the VPS IP.
2. `sudo certbot --nginx -d yourdomain.com` (installs TLS, rewrites nginx to 443).
3. Rebuild the client: `VITE_SERVER_URL="wss://yourdomain.com/ws" npm run build`.

## Updating after a code change

```bash
cd /opt/warlock && sudo -u warlock git pull && sudo -u warlock npm ci
sudo -u warlock VITE_SERVER_URL="ws://<IP-or-domain>/ws" npm run build
sudo systemctl restart warlock-server
```
(nginx serves the new `dist/` automatically; no reload needed unless config changed.)
