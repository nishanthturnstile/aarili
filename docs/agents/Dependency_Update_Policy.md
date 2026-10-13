# Dependency updates and advisory response

This policy implements issue #6 / slice 0.1.2b, architecture §§5.3, 11.4 and
12.4. It does not change the approved package or release baselines.

## Regular updates

`renovate.json` keeps exact package versions, lockfile updates and image/action
digests under review. Compatible minor/patch/pin/digest updates are grouped in
one weekly review window: Monday 00:00–06:00 Asia/Kolkata. Lockfile maintenance
uses the same window. This is a bot scheduling window, not a promise that an
uninstalled or inactive App will run.

All update PRs require the actual scaffold, browser/accessibility and dependency
audit checks and deliberate owner review. Automerge is disabled in repository
settings and Renovate config. Major versions require explicit Dependency
Dashboard approval before Renovate creates their update branches; the owner
still evaluates architecture compatibility, product scope and migration risks.
Do not adopt release candidates or future-phase packages simply because an
upstream latest tag or bot proposes them.

Keep Node 24 LTS, `.node-version`, package engines, Docker Node tags/digests,
pnpm `packageManager`, exact dependencies and `pnpm-lock.yaml` coherent in each
runtime update. Keep GitHub Actions on full commit SHAs. The frozen install and
runtime engine gate must pass; never loosen pins or disable checks to make a
bot PR green. Biome remains the supported-language formatter/linter.

Renovate is configured as the dependency PR writer; Dependabot security PRs
remain disabled to avoid competing writers. GitHub dependency/vulnerability
alerts are enabled independently. New access to the repository is limited to
the selected Aarili repository when installing the hosted Renovate App.

## Security updates

Renovate vulnerability fixes are ungrouped and created immediately when its
installed App processes GitHub vulnerability alerts. They bypass weekly
scheduling, age delays, major approval and concurrency limits, while retaining
manual review and no automerge. The configuration uses current Renovate
vulnerability-alert semantics; "immediate" describes processing policy, not a
guaranteed service notification latency.

The dependency audit checks **runtime and development** lockfile dependencies
at all severities (`pnpm audit --audit-level low`) on every branch push and PR.
It also runs daily on main at 02:17 UTC (07:47 IST) after this workflow merges.
An advisory or registry error fails the check; nothing is hidden by
`continue-on-error`, an allowlist or a skipped audit. GitHub sends advisory
notifications according to the owner's GitHub notification settings; the owner
must keep those subscriptions active.

The owner triages alerts promptly, especially Next.js, React and later
Better Auth/`@better-auth/*`. Critical advisories must be patched within
**48 hours**, as architecture §11.4 requires. Assess the affected installed
version/runtime path, fetch current primary documentation, choose a supported
patched exact version, update the lockfile, verify the relevant failure path
and run all required checks. Keep updates through a PR and owner review.
Application/deployment promotion remains manual and separately authorized.

If no supported fix exists, document the affected path, mitigation, responsible
owner and next review on the PR/issue. A red audit is a genuine blocker; do not
silently suppress it or weaken main protection. Schema/money changes still need
reviewed migrations, backups and compatible rollback under architecture §12.4.

## Activation and verification

Use the hosted [Renovate GitHub App](https://github.com/apps/renovate) with access
to `nishanthturnstile/aarili` only. After the owner installs or confirms that
repository selection, verify the bot's onboarding/configuration and a real
Dependency Dashboard or update run. No bot token belongs in application env
files or PR workflows.

The existing `gh` OAuth token can manage this repository but cannot list GitHub
App installations: `/user/installations` returns 403 requiring a GitHub App
user token. Therefore this implementation cannot claim that Renovate has
repository access or is running. The remaining activation step is owner
confirmation/selection of Aarili in Renovate's installation, followed by a real
bot run after the configuration merges. This is explicitly separate from the
verified CI and enabled GitHub vulnerability alerts.

Configuration validation uses a pinned, disposable upstream validator, not a
new application dependency:

~~~powershell
npx --yes --package=renovate@44.155.1 renovate-config-validator --strict --no-global renovate.json
pnpm audit --audit-level low
~~~

`--no-global` validates repository policy; passing a filename without it in
Renovate 44 validates a self-hosted global configuration instead. Version
44.155.1's Node `^24.11.0` engine is satisfied by the repository Node 24.21.0.
The validator does not authorize, install or run the hosted App.

Current documentation: [Renovate scheduling](https://docs.renovatebot.com/configuration-options/#schedule),
[vulnerability alerts](https://docs.renovatebot.com/configuration-options/#vulnerabilityalerts)
and [GitHub vulnerability-alert API](https://docs.github.com/en/rest/repos/repos#enable-vulnerability-alerts).
