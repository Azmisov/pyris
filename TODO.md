- test:
  - implement proper e2e tests (scaffold tests removed, CI pipeline disabled)
  - navigation syncing: test with filtering
  - truncated line/rows works with selection sync, filtering, etc sensibly
  - select snapping to nearest log should respect filtering?
- features:
  - adjust positioning when filtering is toggled somehow; e.g. center the selected line I guess?
  - computing new zoom when setData is called should try and preserve current zoom; e.g. for auto-
    updating dashboard, it should try and preserve the current view so you don't lose your place
    each refresh
    - if selected line, find a match (exact match?)
    - preserve visible window and zoom
    - if visible start/end, assume selection is relative to start/end
- cleanup:
  - remove debug logging
  - finalize logo
- known issues / tech debt:
  - Virtuoso `overscan` prop is disabled because it breaks `rangeChanged` reporting, which scroll
    preservation relies on. This means slightly more re-renders during scroll, but scroll position
    is preserved correctly when toggling sort order/word wrap after view mode switch. See:
    https://github.com/petyosi/react-virtuoso/issues/118
- future version or needs more thought:
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
  - optimize build size:
    - I investigated, but not much to do: big dependencies radix ui, virtuoso, and gogh themes
      can't really be removed without removing some functionality or styling
  - JSON clickable container, e.g. { bracket, has some bottom clipping for certain font sizes.
    Initial investigation don't think there's anything to do without ruining box drawing fidelity