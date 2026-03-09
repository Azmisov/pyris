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

Create secret for private signing (need approval to generate community signing key):

1. Navigate to "settings > secrets > actions" within your repo to create secrets.
2. Click "New repository secret"
3. Name the secret "GRAFANA_API_KEY"
4. Paste your Grafana Cloud API key in the Secret field
5. Click "Add secret"

## Docs

- [plugin publishing and signing criteria](https://grafana.com/legal/plugins/#plugin-publishing-and-signing-criteria)
- [plugin signature levels](https://grafana.com/legal/plugins/#what-are-the-different-classifications-of-plugins)
- [Basic panel plugin example](https://github.com/grafana/grafana-plugin-examples/tree/master/examples/panel-basic#readme)
- [`plugin.json` documentation](https://grafana.com/developers/plugin-tools/reference/plugin-json)
- [How to sign a plugin?](https://grafana.com/developers/plugin-tools/publish-a-plugin/sign-a-plugin#sign-a-public-plugin)
