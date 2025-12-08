- json logs:
  - clicking elipsis when row is still collapsed should format the full row + expand that elipses
  - navigation:
    - when switching between ANSI and JSON logs, we sync the viewport display and selection; these
      only need to be synced lazily when switching
      - viewport display: get first visible row; find match; scroll into view instantaneously with
        alignment top
      - selection: get selected row; find match; set as selected
    - matching algorithm: Global magic constant gives timestamp buffer about the source's timestamp.
      Use binary search to find timestamps within that buffer range. Among those rows, find the
      longest common substring length among rows. Use an existing npm lib for longest substring
      algorithm. The one with longest common substring is the match.

- timeline view:
  - show log count as bars; vertical gap between zero and one is stretched to make it more evident
    that that time bin has logs present
    - could breakout log count by log level; something for the future
  - change color
  - separate histogram for filtered content
  - log scale for > 1; maybe have count of all records be the limit? or could have it dynamic for
    the view, which adjusts automatically (can be both positive and negative)
- bugs:
  - weird character by []Text link; still there, just not visible anymore
  - changing font size should snap to top visible line
- features:
  - warning message if series errors
  - show log labels
  - warning if line is truncated
  - warning if line count is truncated
  - shift/ctrl select to extend line selection
  - show dates in timeline axis?
  - showing json + ansi in the timeline?
- styling tweaks:
  - don't show back color when json selected
  - tweak modal colors (double check, might be complete)
  - select line covers up previous line slightly, like underscores from prev line
- cleanup:
  - styles are scoped; simplify naming
  - use different prefix for global styles
  - are there unused CSS classes
  - test maxLineLength, maxRenderableRows; seems like max line length is truncating when there is
    several OSC8 urls
  - finalize name and logo
- needs more thought:
  - reset localStorage settings; or maybe just remove the defaults?
  - autoconvert first datetime format to the user's timezone? will be finicky
  - aligning histogram bins to grid lines

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