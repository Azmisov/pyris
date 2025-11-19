- json logs:
  - display:
    - JSON is syntax highlighted using ANSI colors and CSI styles like dim/italic/bold
    - Nested arrays/objects which are non-empty and whose children are >= N layers deep
      (magic constant) are collapsed and show an ellipsis as their contents.
    - When JSON row is selected, it expands so that objects/array contents have block display,
      instead of inline display. Nested arrays/objects remain showing an elipses as their contents.
      The ellipsis is clickable, and it expands one level of contents.
    - Likely we want a tree level structure of components to handle the nested display.
  - search:
    - case sensitive / regex buttons disabled
    - placeholder says "Expression: l => ..."
    - expression is converted to javascript via Function
    - expression is used for filtering rows
    - if expression is invalid JSON, or the filtering raises an error, add error class to search
      group, which adds a --ansi-color-1 (red) border
  - navigation:
    - the toggle in the header switches between showing ANSI vs JSON logs
    - when switching between ANSI and JSON logs, we sync the viewport display and selection; these
      only need to be synced lazily when switching
      - viewport display: get first visible row; find match; scroll into view instantaneously with
        alignment top
      - selection: get selected row; find match; set as selected
    - matching algorithm: Global magic constant gives timestamp buffer about the source's timestamp.
      Use binary search to find timestamps within that buffer range. Among those rows, find the
      longest common substring length among rows. Use an existing npm lib for longest substring
      algorithm. The one with longest common substring is the match.


- changes needed:
No log data should show in the logs viewer panel, the header and timeline should still be visible.
The timeline should still show range vertical indicators, but no visible, selected, or hover indicators.


- timeline view:
  - show log count as bars; vertical gap between zero and one is stretched to make it more evident
    that that time bin has logs present
    - could breakout log count by log level; something for the future
  - histogram needs to be better
  - show separate histogram for filtered content
- bugs:
  - weird character by []Text link; still there, just not visible anymore
  - changing font size should snap to top visible line
  - wordwrap broken, probably because of the added override styles
- features:
  - warning message if series errors
  - show log labels
  - warning if line is truncated
  - warning if line count is truncated
  - shift/ctrl select to extend line selection
  - show dates in timeline axis?
  - showing json + ansi in the timeline?
- styling tweaks:
  - tweak modal colors
  - timeline should use the main font, I think its defaulting to plain monospace
  - timeline axis labels: too squashed when get to microsecond level
- cleanup:
  - styles are scoped; simplify naming
  - use different prefix for global styles
  - are there unused CSS classes
  - test maxLineLength, maxRenderableRows; seems like max line length is truncating when there is
    several OSC8 urls
  - finalize name and logo

- needs more thought:
  - autoconvert first datetime format to the user's timezone? will be finicky

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