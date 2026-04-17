# Contributing to Pyris

## Development Setup

Boilerplate was created using `npx @grafana/create-plugin@latest`.

```bash
npm install
npm exec playwright install chromium
npm run dev
docker compose up
```

App will then be accessible at http://localhost:3000 with live reloading.

## Running Tests

### Jest Tests

```bash
npm run test:ci
# with live reloading
npm run test
```

### E2E Tests

```bash
# Spins up a Grafana instance first that we test against
npm run server
# Optionally specify specific grafana version
GRAFANA_VERSION=11.3.0 npm run server

# Starts the tests
npm run e2e
```

## Samples

Test fixtures live in `samples/` (e.g. `A.txt`, `B.txt`, `C.txt`). After
editing a sample:

```bash
npm run provision-samples
docker compose restart   # pick up the regenerated provisioning files
```

`provision-samples` runs `convert-samples` (rewrites TestData fixtures) then
`update-dashboard` (refreshes the dashboard JSON). If you add a brand-new
sample file, wire it into `SAMPLE_FILES` in `scripts/convert-samples.js` and
into `SAMPLES` in `scripts/update-dashboard.js` — otherwise the script will
silently skip it and the on-disk JSON goes stale.

## Linting

```bash
npm run lint
# apply fixes
npm run lint:fix
```

## Distributing

- Create Grafana account: https://grafana.com/signup
- Make sure that the first part of the plugin ID matches the slug of your Grafana Cloud account
- Initial build you won't have a signing key until approved
- A draft release is created. Follow instructions there to submit for approval

Tag for release

1. Run `npm version <major|minor|patch>`
2. Run `git push origin master --follow-tags`

Create secret for signing:

1. At https://grafana.com/profile/access-policies, create an access policy with
   scope `plugins:write` (realm = your Grafana Cloud org/user), then generate a
   token from it.
2. In the repo, go to "Settings > Secrets and variables > Actions" and add a
   new repository secret named `GRAFANA_ACCESS_POLICY_TOKEN` with that token.
3. Uncomment the `policy_token` / `attestation` block in
   `.github/workflows/release.yml` once the plugin has been approved at the
   desired signature level (private/community/commercial).

The first part of the plugin ID (`nyrix-` in `nyrix-pyris-panel`) must match
the slug of the Grafana Cloud account that owns the access policy, or signing
will be rejected.

## Docs

- [plugin publishing and signing criteria](https://grafana.com/legal/plugins/#plugin-publishing-and-signing-criteria)
- [plugin signature levels](https://grafana.com/legal/plugins/#what-are-the-different-classifications-of-plugins)
- [Basic panel plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/panel-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-json)
- [How to sign a plugin?](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#sign-a-public-plugin)
