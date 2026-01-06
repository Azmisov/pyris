- bugs:
  - click timeline should scroll to position
- test:
  - add e2e tests (scaffold tests removed, CI pipeline disabled currently)
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
- future version or needs more thought:
  - new features:
    - save search expression in local storage
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
    - breakout log count by log level
    - showing json + ansi combined histogram in the timeline
  - change behavior:
    - aligning histogram bins to grid lines instead of being a fixed division of full range
    - have count of all records be the limit for histogram scaling, rather than view dependent?
  - issues:
    - JSON clickable container, e.g. { bracket, has some bottom clipping for certain font sizes.
      Initial investigation don't think there's anything to do without ruining box drawing fidelity
  - optimization:
    - check if virtuoso there is a way to do fixed height for json but only non-selected rows? then
      it only needs to compute one height
    - build size:
      - I investigated, but not much to do: big dependencies radix ui, virtuoso, and gogh themes
        can't really be removed without removing some functionality or styling
    - Virtuoso `overscan` prop is disabled because it breaks `rangeChanged` reporting, which scroll
      preservation relies on. This means slightly more re-renders during scroll, but scroll position
      is preserved correctly when toggling sort order/word wrap after view mode switch. See:
      https://github.com/petyosi/react-virtuoso/issues/118. May need to compute our own "range visible"
      event and scroll to behavior, using calculated offsets?
    - remove debug logging: I've kept them in for now, but prod builds will strip them