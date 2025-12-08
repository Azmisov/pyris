- json logs:
  - word wrap not working
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
  - change color
  - separate histogram for filtered content
  - end bound for log counts (in tooltips) and snapping seem to be off; need to investigate
  - test:
    - show log count as bars; vertical gap between zero and one is stretched to make it more evident
      that that time bin has logs present
    - log scale for > 1; maybe have count of all records be the limit? or could have it dynamic for
      the view, which adjusts automatically (can be both positive and negative)
- bugs:
  - copy selected log should be hidden if no selected?
  - weird character by []Text link; still there, just not visible anymore
  - changing font size should snap to top visible line
  - vitrius logs the colon for line number might need escaping in osc8 link; its not working
- features:
  - computing new zoom when setData is called should try and preserve current zoom; e.g. for auto-
    updating dashboard, it should try and preserve the current view so you don't lose your place
    each refresh
    - if selected line, find a match (exact match?)
    - preserve visible window and zoom
    - if visible start/end, assume selection is relative to start/end
  - show log labels
  - warning message if series errors
  - warning if line is truncated
  - warning if line count is truncated
- styling tweaks:
  - if time is beyond zoom range either hide tooltip or switch to a tooltip with left/right arrow
  - don't show back color when json selected
  - tweak modal colors (double check, might be complete)
  - select line covers up previous line slightly, like underscores from prev line
- cleanup:
  - styles are scoped; simplify naming; move inline styles to css modules as necessary
  - use different prefix for global styles
  - are there unused CSS classes
  - test maxLineLength, maxRenderableRows; seems like max line length is truncating when there is
    several OSC8 urls
  - finalize name and logo
- future version or needs more thought:
  - shift/ctrl select to extend line selection
  - reset localStorage settings; or maybe just remove the defaults?
  - autoconvert first datetime format to the user's timezone? will be finicky
  - aligning histogram bins to grid lines instead of being a fixed division of full range
  - breakout log count by log level
  - showing json + ansi combined histogram in the timeline

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