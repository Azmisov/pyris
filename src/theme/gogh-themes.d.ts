declare module './gogh-themes.json' {
  interface GoghTheme {
    name: string;
    colors: string[];
    dark: boolean;
  }

  const themes: Record<string, GoghTheme>;
  export default themes;
}
