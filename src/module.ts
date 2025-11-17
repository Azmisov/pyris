import { PanelPlugin } from '@grafana/data';
import { AnsiLogsPanelOptions, defaultOptions } from './types';
import { SimplePanel } from './components/SimplePanel';
import {
  getDarkColorSchemeOptions,
  getLightColorSchemeOptions,
} from './theme/colorSchemes';

// Import CSS styles
import './styles.css';

export const plugin = new PanelPlugin<AnsiLogsPanelOptions>(SimplePanel).setPanelOptions((builder) => {
  return builder
    .addSelect({
      path: 'darkTheme',
      name: 'Default Dark Theme',
      description: 'Color scheme to use when system or panel is in dark mode',
      defaultValue: defaultOptions.darkTheme,
      settings: {
        options: getDarkColorSchemeOptions(),
      },
    })
    .addSelect({
      path: 'lightTheme',
      name: 'Default Light Theme',
      description: 'Color scheme to use when system or panel is in light mode',
      defaultValue: defaultOptions.lightTheme,
      settings: {
        options: getLightColorSchemeOptions(),
      },
    })
    .addTextInput({
      path: 'fontFamily',
      name: 'Font Family',
      description: 'Monospace font family for log display',
      defaultValue: defaultOptions.fontFamily,
      settings: {
        placeholder: 'JetBrains Mono, Consolas, monospace',
      },
    })
    .addBooleanSwitch({
      path: 'showLabels',
      name: 'Show Labels',
      description: 'Display log labels as badges',
      defaultValue: defaultOptions.showLabels,
    })
  .addNumberInput({
      path: 'maxLineLength',
      name: 'Max Line Length',
      description: 'Maximum characters per line before truncation',
      defaultValue: defaultOptions.maxLineLength,
      settings: {
        min: 100,
        max: 10000,
        step: 100,
      },
    })
    .addNumberInput({
      path: 'maxRenderableRows',
      name: 'Max Renderable Rows',
      description: 'Maximum number of rows to render (performance limit)',
      defaultValue: defaultOptions.maxRenderableRows,
      settings: {
        min: 1000,
        max: 100000,
        step: 1000,
      },
    });
});

// Validate panel options
export function validateOptions(options: AnsiLogsPanelOptions): AnsiLogsPanelOptions {
  return {
    ...options,
    maxLineLength: Math.max(100, Math.min(10000, options.maxLineLength)),
    maxRenderableRows: Math.max(1000, Math.min(100000, options.maxRenderableRows)),
  };
}