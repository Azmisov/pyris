import React, { memo, useState, useEffect, useRef, useCallback } from 'react';

/**
 * JSON rendering components for the logs viewer.
 * Lightweight React components that replace HTML string generation.
 */

/**
 * Custom hook for managing collapse/expand state and flash animation
 */
function useJsonCollapse(
  depth: number,
  path: string[],
  rowIndex: number,
  expandedPaths: Set<string>,
  onToggleExpand: (path: string) => void
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
    onToggleExpand(pathString);
  }, [onToggleExpand, pathString]);

  return { pathString, shouldCollapse, isExpanded, shouldFlash, handleClick };
}

// Shared types
interface BaseJsonProps {
  depth: number;
  path: string[];
  rowIndex: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  indentSize: number;
}

interface JsonValueProps {
  value: any;
  depth: number;
  path: string[];
  rowIndex: number;
  expandedPaths: Set<string>;
  onToggleExpand: (path: string) => void;
  indentSize: number;
  hasComma?: boolean;
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
      <>
        <span
          className="json-ellipsis"
          data-path={pathString}
          onClick={handleClick}
        >
          {ellipsis}
        </span>
        {hasComma && ','}
      </>
    );
  }

  // Expanded state - show contents with indentation
  return (
    <span>
      <span
        className='json-collapse'
        data-path={pathString}
        title="Click to collapse"
        onClick={handleClick}
      >
        {openBracket}
      </span>
      <span className={`json-indent${shouldFlash ? ' json-expanded-flash' : ''}`}>
        {children}
      </span>
      {closeBracket}{hasComma && ','}
    </span>
  );
});

JsonContainer.displayName = 'JsonContainer';

/**
 * Primitive value component (string, number, boolean, null)
 */
export const JsonPrimitive = memo<{ value: any; hasComma?: boolean }>(({ value, hasComma }) => {
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
      return <span className="ansi-fg-2">{JSON.stringify(value)}</span>;
    }

    // Fallback for undefined, functions, etc.
    return <span className="ansi-fg-8">{String(value)}</span>;
  })();

  return (
    <>
      {content}
      {hasComma && ','}
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
}) => {
  const entries = Object.entries(obj);

  if (entries.length === 0) {
    return (
      <>
        <span>&#123;&#125;</span>
        {hasComma && ','}
      </>
    );
  }

  const { pathString, shouldCollapse, shouldFlash, handleClick } = useJsonCollapse(
    depth,
    path,
    rowIndex,
    expandedPaths,
    onToggleExpand
  );

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
      {entries.map(([key, val], i) => (
        <span key={key}>
          <span className="ansi-dim ansi-italic">{key}</span>
          {': '}
          <JsonValue
            value={val}
            depth={depth + 1}
            path={[...path, key]}
            rowIndex={rowIndex}
            expandedPaths={expandedPaths}
            onToggleExpand={onToggleExpand}
            indentSize={indentSize}
            hasComma={i < entries.length - 1}
          />
        </span>
      ))}
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
}) => {
  if (arr.length === 0) {
    return (
      <>
        <span>&#91;&#93;</span>
        {hasComma && ','}
      </>
    );
  }

  const { pathString, shouldCollapse, shouldFlash, handleClick } = useJsonCollapse(
    depth,
    path,
    rowIndex,
    expandedPaths,
    onToggleExpand
  );

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
}) => {
  // Check type and route to appropriate component
  if (value === null || typeof value !== 'object') {
    return <JsonPrimitive value={value} hasComma={hasComma} />;
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
    />
  );
});

JsonValue.displayName = 'JsonValue';
