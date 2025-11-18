import { PanelPlugin } from '@grafana/data';
import { LogsPanelOptions, defaultOptions } from './types';
import { LogsPanel } from './components/LogsPanel';
import { ThemeSelectEditor } from './components/ThemeSelectEditor';

// Import CSS styles
import './styles.css';

export const plugin = new PanelPlugin<LogsPanelOptions>(LogsPanel).setPanelOptions((builder) => {
  return builder
    .addCustomEditor({
      id: 'darkTheme',
      path: 'darkTheme',
      name: 'Default Dark Theme',
      description: 'Default color scheme to use when panel is in dark mode',
      defaultValue: defaultOptions.darkTheme,
      editor: ThemeSelectEditor,
      settings: {
        themeMode: 'dark',
      },
    })
    .addCustomEditor({
      id: 'lightTheme',
      path: 'lightTheme',
      name: 'Default Light Theme',
      description: 'Default color scheme to use when panel is in light mode',
      defaultValue: defaultOptions.lightTheme,
      editor: ThemeSelectEditor,
      settings: {
        themeMode: 'light',
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

// Make panel edge-to-edge, looks better IMO when we have our custom color schemes
plugin.setNoPadding()

// Validate panel options
export function validateOptions(options: LogsPanelOptions): LogsPanelOptions {
  return {
    ...options,
    maxLineLength: Math.max(100, Math.min(10000, options.maxLineLength)),
    maxRenderableRows: Math.max(1000, Math.min(100000, options.maxRenderableRows)),
  };
}