# Changelog

## v1.1.0

- React 19 updates for Grafana 13 (@jackw)
- Updated provisioning samples

*Dropped support for Grafana 10*

## v1.0.9

### Features

- Themes can now be configured per-panel, rather than just globally
- Unix file path linkification in ANSI output
- Copy-on-click for style-delimited tokens in ANSI mode

### Fixes

- Fix hover buttons on titleless Grafana panels covering panel buttons
- Fix default panel theme not getting used
- Fix theme selector styling in panel settings
- Fix JSON scroll jank in nowrap mode
- Fix JSON copying
- Fix linkification edge cases

### Internals / tooling

- Cleaned up ANSI → HTML conversion code
- Added signed-release verification script
- Release build now produces signed artifacts
- Anonymization template script for sample contributions
- Updated provisioning samples

## v1.0.8

- Remove all logging in production builds
- Switch to jexl library for JSON log filtering
- Fix line wrap rendering bug

## v1.0.7

Initial public release. See README for overview of the project.
