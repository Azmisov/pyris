import { convertAnsiToHtml } from './ansi';

describe('ANSI to HTML Converter', () => {
  describe('RGB Truecolor (38;2;r;g;b)', () => {
    test('Red RGB (255,0,0)', () => {
      const input = '\x1b[38;2;255;0;0mRed RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(255,0,0)');
      expect(html).toContain('Red RGB');
    });

    test('Green RGB (0,255,0)', () => {
      const input = '\x1b[38;2;0;255;0mGreen RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(0,255,0)');
      expect(html).toContain('Green RGB');
    });

    test('Blue RGB (0,0,255)', () => {
      const input = '\x1b[38;2;0;0;255mBlue RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(0,0,255)');
      expect(html).toContain('Blue RGB');
    });

    test('Orange RGB (255,128,0)', () => {
      const input = '\x1b[38;2;255;128;0mOrange RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(255,128,0)');
      expect(html).toContain('Orange RGB');
    });

    test('Purple RGB (128,0,128)', () => {
      const input = '\x1b[38;2;128;0;128mPurple RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(128,0,128)');
      expect(html).toContain('Purple RGB');
    });

    test('Multiple RGB colors in sequence', () => {
      const input = '\x1b[38;2;255;0;0mRed RGB\x1b[0m \x1b[38;2;0;255;0mGreen RGB\x1b[0m \x1b[38;2;0;0;255mBlue RGB\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('rgb(255,0,0)');
      expect(html).toContain('rgb(0,255,0)');
      expect(html).toContain('rgb(0,0,255)');
      expect(html).toContain('Red RGB');
      expect(html).toContain('Green RGB');
      expect(html).toContain('Blue RGB');
    });
  });

  describe('RGB Background Color (48;2;r;g;b)', () => {
    test('Red background RGB', () => {
      const input = '\x1b[48;2;255;0;0mRed BG\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('background-color:rgb(255,0,0)');
      expect(html).toContain('Red BG');
    });
  });

  describe('RGB Underline Color (58;2;r;g;b)', () => {
    test('Magenta underline RGB', () => {
      const input = '\x1b[4;58;2;255;0;255mMagenta underline\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('text-decoration-color:rgb(255,0,255)');
      expect(html).toContain('Magenta underline');
    });
  });

  describe('256 Colors (38;5;n)', () => {
    test('256-color foreground', () => {
      const input = '\x1b[38;5;196mRed 256\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('ansi-fg-196');
      expect(html).toContain('Red 256');
    });
  });

  describe('Basic ANSI colors', () => {
    test('Basic red (31)', () => {
      const input = '\x1b[31mRed\x1b[0m';
      const { html } = convertAnsiToHtml(input);
      expect(html).toContain('ansi-fg-1');
      expect(html).toContain('Red');
    });
  });
});
