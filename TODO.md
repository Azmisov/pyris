- navigation syncing: test with filtering
- bugs:
  - select snapping to nearest log should respect filtering
- features:
  - adjust positioning when filtering is toggled somehow; e.g. center the selected line I guess?
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
  - tweak modal colors (double check, might be complete)
  - select line covers up previous line slightly, like underscores from prev line; maybe measure bottom underscore height?
- cleanup:
  - remove debug logging
  - use different prefix for global styles
  - are there unused CSS classes
  - test maxLineLength, maxRenderableRows; seems like max line length is truncating when there is
    several OSC8 urls
  - finalize name and logo
- future version or needs more thought:
  - slow JSON rendering when scrolling
  - save search expression in local storage
  - have count of all records be the limit for histogram scaling, rather than view dependent?
  - special JSON styling:
    - when you hover over timestamp/datetime looking value in JSON, show tooltip with conversions
  - ability to copy values in ANSI logs, delimited by stripped ansi colored elements; don't enable
    copy if only contains punctuation characters
  - detect timestamps within ANSI styled elements; do the tooltip conversion thing for ANSI too
  - autodetect timezone offset for ANSI/JSON logs, by comparing seen timestamp to the log record
    timestamp from the dataframe
  - shift/ctrl select to extend line selection
  - reset localStorage settings; or maybe just remove the defaults?
  - autoconvert first datetime format to the user's timezone? will be finicky
  - aligning histogram bins to grid lines instead of being a fixed division of full range
  - breakout log count by log level
  - showing json + ansi combined histogram in the timeline