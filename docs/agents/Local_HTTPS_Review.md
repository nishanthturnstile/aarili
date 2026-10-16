# Temporary synthetic HTTPS review

Issue #60 / J7. This is a disposable test host, separate from normal app routes.
It creates a new synthetic owner, PostgreSQL database, private Garage bucket and
one immutable Tamil PDF; only that document's status/file/retry/history routes
are bridged to its synthetic owner. No real customer information belongs here.
The ordinary application retains its empty/default-deny document registry.

Physical-device and fluent Tamil review are deferred by the owner. The command
below is preparation for that later session; browser emulation is not J8 evidence.
Do not send the test text or PDF to a real recipient: the host displays a synthetic
placeholder phone. Review the intended recipient before any manual action.

## Loopback check

Prerequisites: repository-pinned Node/pnpm, Docker Desktop and installed Chromium
from the existing verification setup. The script uses Git for Windows' bundled
OpenSSL when available, otherwise an already installed `openssl`. It installs no
tool, trust certificate, firewall rule or hosted tunnel.

```powershell
pnpm build:packages
node scripts/review-document-sharing.mjs --address 127.0.0.1 --smoke
```

This starts HTTPS on port 3443, validates the local certificate during readiness,
then tears down. Without `--smoke`, Ctrl+C finishes the review. Certificate/private
key files use a unique ignored `.scratch/document-review-tls-*` directory and are
removed in `finally`. Trust stores are never changed by the script.

## Nearby reference phone (later, supervised)

Use a trusted private Wi-Fi network. Identify the laptop's **specific local IPv4**
and the phone's IPv4, keeping both stable during the session. Do not bind
`0.0.0.0`, expose a public interface, enable a hosted tunnel or broaden an existing
Node firewall exception. On Windows, ensure no pre-existing broad Node/3443 allow
rule bypasses this restriction; disable it deliberately for the session if needed.

Example addresses below must be replaced with the observed local addresses. In
an elevated PowerShell, create one named inbound rule restricted to the phone:

```powershell
$reviewLaptopIp = '192.168.1.20'
$reviewPhoneIp = '192.168.1.21'
New-NetFirewallRule -Name 'AariliSyntheticPdfReview' -DisplayName 'Aarili synthetic PDF review' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3443 -LocalAddress $reviewLaptopIp -RemoteAddress $reviewPhoneIp -Profile Private
```

In a normal repository terminal:

```powershell
pnpm build:packages
node scripts/review-document-sharing.mjs --address 192.168.1.20 --lan-firewall-ready
```

The script accepts only a current local interface address and prints the exact
HTTPS origin plus `phone-ca.cer` path. Transfer **only that certificate** over a
local trusted channel. Compare its fingerprint before installing it as temporary
user CA trust on the test phone; use the phone's security/certificate settings,
whose labels vary by Android version. Do not transfer `key.pem`, commit the files,
disable browser certificate verification or treat a warning bypass as a secure
Web Share context. Open the printed HTTPS origin in Chrome and confirm a trusted
connection and `isSecureContext` before testing native sharing.

The page is intentionally a synthetic PDF fixture, not the installed normal PWA
or a complete media/IME workflow. Those J8 observations need their respective
isolated workflow hosts and an actual device in the later review session.

## Teardown and evidence

1. Ctrl+C and wait for disposable Next/bridge/renderer/DB/bucket cleanup. Closing
   a terminal forcibly can skip `finally`; identify remaining processes/containers
   by that session before stopping them. Never stop unrelated development work.
2. Remove the named rule in elevated PowerShell:
   `Remove-NetFirewallRule -Name 'AariliSyntheticPdfReview'`. Restore any prior
   firewall configuration deliberately changed for this session.
3. Remove the temporary Aarili CA from the phone's user certificate store and
   delete its transferred certificate, downloaded PDFs and review-only messages.
   The script cannot remove trust installed on a phone or revoke downloaded files.
4. Confirm the printed TLS directory is gone and no process listens on 3443.
   If forced shutdown left a folder, inspect its resolved path under this repo's
   `.scratch` before removing **that specific directory**.
5. Record real model/RAM/Android/Chrome versions, trust and firewall teardown,
   PDF/font readability, actual file-share/text/cancel/fallback observations and
   remaining fluent Tamil findings. Never substitute automated stubs or viewport
   screenshots for these manual gates.

References: [Next.js HTTPS CLI](https://nextjs.org/docs/app/api-reference/cli/next#using-https-during-development),
[Web Share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share),
[file capability detection](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/canShare).
