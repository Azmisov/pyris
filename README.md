# <img src="src/icons/logo.svg" alt="Pyris Logo" width="32" height="32"> Pyris

![Grafana 10.4+](https://img.shields.io/badge/Grafana-10.4%2B-orange)
![License](https://img.shields.io/badge/license-LGPL--3.0-blue)

A log viewer panel for Grafana with JSON and ANSI styling support.

- Full styling and link support for ANSI messages
- Syntax highlighting and collapsible nesting for JSON messages
- Match log styling of your favorite terminal emulator or IDE with 300+ built-in color themes from [Gogh](https://gogh-co.github.io/Gogh/), plus two custom Grafana light/dark themes
- Easily navigate with a timeline chart of log records
- Virtual scrolling for handling large log volumes


## Screenshots

<table>
  <tr>
    <td><img src="src/img/screenshot1.png" alt="ANSI view with dark theme"></td>
    <td><img src="src/img/screenshot2.png" alt="Settings dropdown with theme selection"></td>
  </tr>
  <tr>
    <td><img src="src/img/screenshot3.png" alt="Link navigation in ANSI logs"></td>
    <td><img src="src/img/screenshot4.png" alt="JSON view with light theme"></td>
  </tr>
</table>

## Installation

*Pending approval from Grafana to be included in the Grafana Catalog*

### Manual Installation

1. Download the latest release from the [releases page](https://github.com/Azmisov/pyris/releases)
2. Extract to your Grafana plugins directory (e.g., `/var/lib/grafana/plugins/`)
3. Restart Grafana

## Usage

### Panel layout

**Settings:** At the top of the panel is a header bar with various toggles and settings. On the left
you'll see settings like theme, font size, or word-wrap.

**Timeline:** Next to settings is a toggle for the timeline chart. When shown, you'll see a bar
chart with log records by time. Scroll to zoom, drag to pan. You can click a point on the timeline
to find and scroll to the nearest record. You'll see other clickable elements like buttons to center
the view, extend the view, or sync the dashboard's range. Vertical indicators show you your current
selection, view, and dashboard range.

**Search:** Next to the timeline toggle is a search bar. Toggle this to enable/disable filtering.
For ANSI log records, it searches by substring, optionally case sensitive or a regular expression.
For JSON log records, you define a JavaScript lambda expression for filtering.

**View:** In the center you can toggle between viewing ANSI vs JSON logs. JSON logs are autodetected
from records that look like JSON objects: a message enclosed in `{}` characters. When toggling
between them, it will try to find a matching record based on keywords and sync the current scroll
position. If a selected row is currently in view, it centers on a matching record instead.

**Actions:** On the right are actions like viewing record labels or copying.

### Panel Options

Most relevant settings can be updated from the panel header. Remaining options are configured
for the panel in edit mode:

- set a default theme choice, which can be overridden by the user in the panel header
- set the font family, to add additional fallback fonts
- toggle display of log labels as inline badges
- set line and row length for performance limits

### Data Source

This panel works with any data source that returns log-like data. You can include multiple series. Each series should have these fields:

- **Time**: Prefers a field named `time`, or `ts`. Otherwise it picks the first time field.
  Otherwise it looks for the first UNIX timestamp-like field.
- **Message**: Prefers a field named `message`, `msg`, `log`, `line`, `content`, or `text`. If
  not found, it picks the first string field. Otherwise it uses the field immediately after the time
  field.
- **Labels** (optional): Prefers a JSON encoded string field named `labels`, `tags`, `metadata`, or
  `fields`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and guidelines.

## License

LGPL-3.0 - see [LICENSE](LICENSE) for details.
