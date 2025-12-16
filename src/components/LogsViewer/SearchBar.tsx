import React from 'react';
import { Icon } from '@grafana/ui';
import SearchIcon from '../../icons/search.svg';
import RegexIcon from '../../icons/regex.svg';
import styles from './SearchBar.module.css';
import toolbarStyles from '../toolbar.module.css';

interface SearchBarProps {
  searchTerm: string;
  onSearchChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  caseSensitive: boolean;
  onCaseSensitiveToggle: () => void;
  useRegex: boolean;
  onRegexToggle: () => void;
  hasFilter: boolean;
  onClearSearch: () => void;
  searchExpanded: boolean;
  onToggleSearch: () => void;
  expressionError?: string | null;
  isExpressionMode?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  searchTerm,
  onSearchChange,
  caseSensitive,
  onCaseSensitiveToggle,
  useRegex,
  onRegexToggle,
  hasFilter,
  onClearSearch,
  searchExpanded,
  onToggleSearch,
  expressionError,
  isExpressionMode,
}) => {
  // Debug logging
  const errorClass = expressionError ? styles.error : '';
  const expandedClass = searchExpanded ? styles.expanded : '';
  const combinedClasses = `${styles.group} ${expandedClass} ${errorClass}`;

  if (expressionError) {
    console.log('[SearchBar] Received expressionError:', expressionError);
    console.log('[SearchBar] Error class:', styles.error);
    console.log('[SearchBar] Combined classes:', combinedClasses);
  }

  return (
    <div className={combinedClasses}>
      <button
        onClick={onToggleSearch}
        className={`${toolbarStyles.button} ${styles.toggleBtn} ${searchExpanded ? toolbarStyles.active : ''}`}
        title={searchExpanded ? 'Hide Search' : 'Show Search'}
        aria-label="Toggle Search"
      >
        <SearchIcon />
      </button>

      {searchExpanded && (
        <div className={styles.container}>
          <div className={styles.inputWrapper}>
            {isExpressionMode && (
              <span
                className={styles.expressionPrefix}
                title="Variable 'r' represents the parsed JSON data (record) for each log row"
              >
                r =&gt;
              </span>
            )}
            <input
              type="text"
              placeholder={isExpressionMode ? "JavaScript expression…" : "Search phrase…"}
              value={searchTerm}
              onChange={onSearchChange}
              className={styles.input}
              autoFocus
            />
            <div className={styles.buttons}>
              {!isExpressionMode && (
                <>
                  <button
                    onClick={onCaseSensitiveToggle}
                    className={`${styles.toggle} ${caseSensitive ? styles.active : ''}`}
                    title="Match Case"
                    aria-label="Match Case"
                  >
                    <svg width="14" height="14" viewBox="1.5 3.5 12.5 8.5" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
                      <path d="M8.85352 11.7021H7.85449L7.03809 9.54297H3.77246L3.00439 11.7021H2L4.9541 4H5.88867L8.85352 11.7021ZM6.74268 8.73193L5.53418 5.4502C5.49479 5.34277 5.4554 5.1709 5.41602 4.93457H5.39453C5.35872 5.15299 5.31755 5.32487 5.271 5.4502L4.07324 8.73193H6.74268Z"/>
                      <path d="M13.756 11.7021H12.8752V10.8428H12.8537C12.4706 11.5016 11.9066 11.8311 11.1618 11.8311C10.6139 11.8311 10.1843 11.686 9.87273 11.396C9.56479 11.106 9.41082 10.721 9.41082 10.2412C9.41082 9.21354 10.016 8.61556 11.2262 8.44727L12.8752 8.21631C12.8752 7.28174 12.4974 6.81445 11.7419 6.81445C11.0794 6.81445 10.4815 7.04004 9.94793 7.49121V6.58887C10.4886 6.24512 11.1117 6.07324 11.8171 6.07324C13.1097 6.07324 13.756 6.75716 13.756 8.125V11.7021ZM12.8752 8.91992L11.5485 9.10254C11.1403 9.15983 10.8324 9.26188 10.6247 9.40869C10.417 9.55192 10.3132 9.80794 10.3132 10.1768C10.3132 10.4453 10.4081 10.6655 10.5978 10.8374C10.7912 11.0057 11.0472 11.0898 11.3659 11.0898C11.8027 11.0898 12.1626 10.9377 12.4455 10.6333C12.7319 10.3254 12.8752 9.93685 12.8752 9.46777V8.91992Z"/>
                    </svg>
                  </button>
                  <button
                    onClick={onRegexToggle}
                    className={`${styles.toggle} ${useRegex ? styles.active : ''}`}
                    title="Use Regular Expression"
                    aria-label="Use Regular Expression"
                  >
                    <RegexIcon />
                  </button>
                </>
              )}
              {searchTerm && (
                <button
                  onClick={onClearSearch}
                  className={styles.toggle}
                  title="Clear Search"
                  aria-label="Clear Search"
                >
                  <Icon name="trash-alt" />
                </button>
              )}
            </div>
          </div>
          {expressionError && (
            <div className={styles.expressionError}>
              {expressionError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
