import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { useCopyToast, formatValueForCopy } from '../components/CopyableValue';
import styles from './JsonRow.module.css';
import copyStyles from '../components/Copyable.module.css';

/**
 * JSON rendering components for the logs viewer.
 * Lightweight React components that replace HTML string generation.
 */

/**
 * Recursively gather all nested paths in a JSON structure
 */
function gatherNestedPaths(
  value: any,
  currentPath: string[],
  rowIndex: number,
  depth: number,
  paths: string[]
): void {
  if (value === null || typeof value !== 'object') {
    return;
  }

  const pathString = `${rowIndex}:${currentPath.join('.')}`;

  // Only add paths for depth >= 2 (where collapse/expand is applicable)
  if (depth >= 2) {
    paths.push(pathString);
  }

  if (Array.isArray(value)) {
    value.forEach((item, i) => {
      gatherNestedPaths(item, [...currentPath, String(i)], rowIndex, depth + 1, paths);
    });
  } else {
    Object.keys(value).forEach(key => {
      gatherNestedPaths(value[key], [...currentPath, key], rowIndex, depth + 1, paths);
    });
  }
}

/**
 * Custom hook for managing collapse/expand state and flash animation
 */
function useJsonCollapse(
  depth: number,
  path: string[],
  rowIndex: number,
  expandedPaths: Set<string>,
  onToggleExpand: (path: string | string[]) => void,
  value?: any
) {
  const pathString = `${rowIndex}:${path.join('.')}`;
  const isInSet = expandedPaths.has(pathString);

  // Depth < 2: expanded by default, set entry means manually collapsed
  // Depth >= 2: collapsed by default, set entry means manually expanded
  const shouldCollapse = depth < 2 ? isInSet : !isInSet;
  const isExpanded = !shouldCollapse;

  // Track if this was just expanded for flash animation
  const [shouldFlash, setShouldFlash] = useState(false);
  const prevExpandedRef = useRef(isExpanded);

  useEffect(() => {
    // Only flash when transitioning from collapsed to expanded
    if (isExpanded && !prevExpandedRef.current) {
      setShouldFlash(true);
      const timer = setTimeout(() => setShouldFlash(false), 600);
      prevExpandedRef.current = isExpanded;
      return () => clearTimeout(timer);
    }
    prevExpandedRef.current = isExpanded;
    return undefined;
  }, [isExpanded]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    // Shift+click for recursive expand/collapse
    if (e.shiftKey && value) {
      const allPaths: string[] = [pathString];
      gatherNestedPaths(value, path, rowIndex, depth, allPaths);

      // Pass all paths at once for batch toggle
      onToggleExpand(allPaths);
    } else {
      onToggleExpand(pathString);
    }
  }, [onToggleExpand, pathString, value, path, rowIndex, depth]);

  return { pathString, shouldCollapse, isExpanded, shouldFlash, handleClick };
}

// Shared types
interface BaseJsonProps {
  depth: number;
  path: string[];
  rowIndex: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string | string[]) => void;
  indentSize: number;
  copyEnabled?: boolean;
}

interface JsonValueProps {
  value: any;
  depth: number;
  path: string[];
  rowIndex: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string | string[]) => void;
  indentSize: number;
  hasComma?: boolean;
  copyEnabled?: boolean;
  levelHint?: boolean;
}

/**
 * Helper component for rendering collapsed/expanded JSON structures
 */
interface JsonContainerProps {
  shouldCollapse: boolean;
  pathString: string;
  handleClick: (e: React.MouseEvent) => void;
  shouldFlash: boolean;
  openBracket: string;
  closeBracket: string;
  ellipsis: string;
  hasComma?: boolean;
  children: React.ReactNode;
}

const JsonContainer = memo<JsonContainerProps>(({
  shouldCollapse,
  pathString,
  handleClick,
  shouldFlash,
  openBracket,
  closeBracket,
  ellipsis,
  hasComma,
  children
}) => {
  // Collapsed state - show ellipsis
  if (shouldCollapse) {
    return (
      <span>
        <span
          className={`${styles.jsonEllipsis} ansi-fg-14`}
          data-path={pathString}
          title="Click to expand (Shift+Click for recursive)"
          onClick={handleClick}
        >
          {ellipsis}
        </span>
        {hasComma && <span className="ansi-faint ansi-fg-5">, </span>}
      </span>
    );
  }

  // Expanded state - show contents with indentation
  return (
    <span>
      <span
        className={`${styles.jsonCollapse} ansi-fg-14`}
        data-path={pathString}
        title="Click to collapse (Shift+Click for recursive)"
        onClick={handleClick}
      >
        {openBracket}
      </span>
      <span className={`${styles.jsonIndent}${shouldFlash ? ` ${styles.jsonExpandedFlash}` : ''}`}>
        {children}
      </span>
      <span className="ansi-fg-14">
        {closeBracket}
        {hasComma && <span className="ansi-faint ansi-fg-5">, </span>}
      </span>
    </span>
  );
});

JsonContainer.displayName = 'JsonContainer';

/**
 * Primitive value component (string, number, boolean, null)
 */
export const JsonPrimitive = memo<{ value: any; hasComma?: boolean; copyEnabled?: boolean; levelHint?: boolean }>(({ value, hasComma, copyEnabled = false, levelHint = false }) => {
  const { copyWithToast, Toast } = useCopyToast();

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!copyEnabled) {
      return;
    }

    e.stopPropagation();
    const copyText = formatValueForCopy(value);
    copyWithToast(copyText, e);
  }, [value, copyEnabled, copyWithToast]);

  const content = (() => {
    if (value === null) {
      return <span className="ansi-fg-8">null</span>;
    }

    const type = typeof value;

    if (type === 'boolean') {
      return <span className="ansi-fg-3">{String(value)}</span>;
    }

    if (type === 'number') {
      return <span className="ansi-fg-6">{String(value)}</span>;
    }

    if (type === 'string') {
      let className: string;

      if (levelHint) {
        // Determine color based on level string content
        const lowerValue = value.toLowerCase();

        if (/inf/.test(lowerValue)) {
          className = "ansi-fg-2 ansi-bold"; // info: green
        } else if (/err/.test(lowerValue)) {
          className = "ansi-fg-1 ansi-bold"; // error: red
        } else if (/ftl|crit|crt|fat/.test(lowerValue)) {
          className = "ansi-fg-5 ansi-bold"; // fatal/critical: magenta
        } else if (/dbg|debug/.test(lowerValue)) {
          className = "ansi-fg-6 ansi-bold"; // debug: cyan
        } else if (/wrn|warn/.test(lowerValue)) {
          className = "ansi-fg-3 ansi-bold"; // warning: yellow
        } else {
          className = "ansi-faint ansi-bold"; // default: dim
        }
      } else {
        className = "";
      }

      return <span className={className}>{JSON.stringify(value)}</span>;
    }

    // Fallback for undefined, functions, etc.
    return <span className="ansi-fg-8">{String(value)}</span>;
  })();

  return (
    <>
      <span
        className={copyEnabled ? copyStyles.copyable : ''}
        onClick={copyEnabled ? handleClick : undefined}
        title={copyEnabled ? "Click to copy" : undefined}
      >
        {content}
        {hasComma && <span className="ansi-faint ansi-fg-5">, </span>}
      </span>
      {Toast}
    </>
  );
});

JsonPrimitive.displayName = 'JsonPrimitive';

/**
 * JSON Object component with collapse/expand functionality
 */
export const JsonObject = memo<BaseJsonProps & { obj: Record<string, any>; hasComma?: boolean }>(({
  obj,
  depth,
  path,
  rowIndex,
  expandedPaths,
  onToggleExpand,
  indentSize,
  hasComma,
  copyEnabled,
}) => {
  const entries = Object.entries(obj);

  // Hook must be called unconditionally (before any early returns)
  const { pathString, shouldCollapse, shouldFlash, handleClick } = useJsonCollapse(
    depth,
    path,
    rowIndex,
    expandedPaths,
    onToggleExpand,
    obj
  );

  if (entries.length === 0) {
    return (
      <span className="ansi-fg-14">
        &#123;&#125;
        {hasComma && <span className="ansi-faint ansi-fg-5">, </span>}
      </span>
    );
  }

  return (
    <JsonContainer
      shouldCollapse={shouldCollapse}
      pathString={pathString}
      handleClick={handleClick}
      shouldFlash={shouldFlash}
      openBracket="&#123;"
      closeBracket="&#125;"
      ellipsis="&#123;…&#125;"
      hasComma={hasComma}
    >
      {entries.map(([key, val], i) => {
        // Check if key contains "lvl" or "level" case-insensitively
        const isLevelKey = /lvl|level/i.test(key);

        return (
          <span key={key}>
            <span className="ansi-faint ansi-italic">{key}</span>
            <span className="ansi-faint ansi-fg-5">: </span>
            <JsonValue
              value={val}
              depth={depth + 1}
              path={[...path, key]}
              rowIndex={rowIndex}
              expandedPaths={expandedPaths}
              onToggleExpand={onToggleExpand}
              indentSize={indentSize}
              hasComma={i < entries.length - 1}
              copyEnabled={copyEnabled}
              levelHint={isLevelKey}
            />
          </span>
        );
      })}
    </JsonContainer>
  );
});

JsonObject.displayName = 'JsonObject';

/**
 * JSON Array component with collapse/expand functionality
 */
export const JsonArray = memo<BaseJsonProps & { arr: any[]; hasComma?: boolean }>(({
  arr,
  depth,
  path,
  rowIndex,
  expandedPaths,
  onToggleExpand,
  indentSize,
  hasComma,
  copyEnabled,
}) => {
  // Hook must be called unconditionally (before any early returns)
  const { pathString, shouldCollapse, shouldFlash, handleClick } = useJsonCollapse(
    depth,
    path,
    rowIndex,
    expandedPaths,
    onToggleExpand,
    arr
  );

  if (arr.length === 0) {
    return (
      <span className="ansi-fg-14">
        &#91;&#93;
        {hasComma && <span className="ansi-faint ansi-fg-5">, </span>}
      </span>
    );
  }

  return (
    <JsonContainer
      shouldCollapse={shouldCollapse}
      pathString={pathString}
      handleClick={handleClick}
      shouldFlash={shouldFlash}
      openBracket="&#91;"
      closeBracket="&#93;"
      ellipsis="&#91;…&#93;"
      hasComma={hasComma}
    >
      {arr.map((item, i) => (
        <span key={i}>
          <JsonValue
            value={item}
            depth={depth + 1}
            path={[...path, String(i)]}
            rowIndex={rowIndex}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
            indentSize={indentSize}
            hasComma={i < arr.length - 1}
            copyEnabled={copyEnabled}
          />
        </span>
      ))}
    </JsonContainer>
  );
});

JsonArray.displayName = 'JsonArray';

/**
 * Main JSON value router - delegates to appropriate component
 */
export const JsonValue = memo<JsonValueProps>(({
  value,
  depth,
  path,
  rowIndex,
  expandedPaths,
  onToggleExpand,
  indentSize,
  hasComma,
  copyEnabled,
  levelHint,
}) => {
  // Check type and route to appropriate component
  if (value === null || typeof value !== 'object') {
    return <JsonPrimitive value={value} hasComma={hasComma} copyEnabled={copyEnabled} levelHint={levelHint} />;
  }

  if (Array.isArray(value)) {
    return (
      <JsonArray
        arr={value}
        depth={depth}
        path={path}
        rowIndex={rowIndex}
        expandedPaths={expandedPaths}
        onToggleExpand={onToggleExpand}
        indentSize={indentSize}
        hasComma={hasComma}
        copyEnabled={copyEnabled}
      />
    );
  }

  return (
    <JsonObject
      obj={value}
      depth={depth}
      path={path}
      rowIndex={rowIndex}
      expandedPaths={expandedPaths}
      onToggleExpand={onToggleExpand}
      indentSize={indentSize}
      hasComma={hasComma}
      copyEnabled={copyEnabled}
    />
  );
});

JsonValue.displayName = 'JsonValue';
