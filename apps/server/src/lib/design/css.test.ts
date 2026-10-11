import { describe, expect, it } from 'vitest';

import { samplePayload } from '@/lib/providers/sample';
import { deviceUrls, renderKioskDocument } from '@/lib/render/document';

// Unmocked on purpose: exercises the real theme.ts <-> css.ts import cycle and the document shell.
import { designCss } from './css';
import { resetTheme, themeCss, updateTheme } from './theme';
import { DEFAULT_THEME } from './tokens';

const boot = {
  deviceId: 'd',
  screenId: 's',
  viewer: 'device' as const,
  refreshSeconds: 60,
  serverTime: 0,
  urls: deviceUrls('d'),
  data: samplePayload(),
};

describe('designCss', () => {
  it('is the default theme when nothing is customised', () => {
    resetTheme();
    expect(designCss()).toBe(themeCss(DEFAULT_THEME));
    expect(designCss()).toContain('--sr-accent:#6136f5;');
  });

  it('follows theme changes and lands after the base CSS in the kiosk document', () => {
    updateTheme({ colors: { accent: '#FF0000' } });
    const css = designCss();
    expect(css).toContain('--sr-accent:#ff0000;');
    const html = renderKioskDocument({ title: 't', body: '<p></p>', boot, designCss: css });
    const style = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
    expect(style.indexOf('background:#000;color:#fff')).toBeGreaterThan(-1);
    expect(style.indexOf(':root{--sr-bg')).toBeGreaterThan(style.indexOf('color:#fff'));
    resetTheme();
  });
});
