- show log labels
- timeline view:
  - show log count as bars; vertical gap between zero and one is stretched to make it more evident
    that that time bin has logs present
    - could breakout log count by log level; something for the future
  - initial time range of the timeline is the panel's input range
  - recenter button after navigating, which centers about the panel's input range
  - button which change's the dashboard time range to match navigated view
- search bar buttons too big
- color scheme dropdown is overflowing
- autoconvert first datetime format to the user's timezone? will be finicky
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

- recenter timeline view:
  - brackets-curly
  - anchor
  - home/home-alt

- warning about errors for some series:
  - exclamation-triangle