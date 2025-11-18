- port old code to new repo
x osc8 parsing should use ansi-tools instead of custom regex
- show log labels
x strip ansi codes should use the actual parser
x timeline view:
  - Full width, short height; between the header and log contents
  - It shows plot, drawn with canvas
  - Vertical bars delineate time slices, like 30min, 1hr, etc
  - Drag/scroll to navigate
  - show log count as bars; vertical gap between zero and one is stretched to make it more evident
    that that time bin has logs present
    - could breakout log count by log level; something for the future
  - show grayed out area on left/right where no log records found, e.g. which helps warn about
    truncation
  - initial time range of the timeline is the panel's input range
  - recenter button after navigating, which centers about the panel's input range
  - button which change's the dashboard time range to match navigated view
  - Port classes from /home/isaac/Programming/Work/Iteris/clearguide/redshift-profiler/src/public/timeseries/ as a starting point for the code.
- autoconvert first datetime format to the user's timezone
- test maxLineLength, maxRenderableRows
- is applyFontSizeVars using the correct font?
- are there unused CSS classes

possible icon replacements:
https://developers.grafana.com/ui/latest/index.html?path=/story/iconography-icon--icons-overview
- filter
- graph-bar
- minus
- plus
- search
- sliders-v-alt,
- sort-amount-down/up
- wrench
- wrap-text
- cog
- clock-nine
- flip
- home
- home-alt
- graph-bar
- sort-amount-up/down