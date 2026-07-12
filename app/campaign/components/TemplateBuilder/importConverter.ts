import type { TemplateState, CanvasElement, TextElement, ImageElement, ButtonElement, DividerElement } from './types';

// ── Legacy schema (sample_sapphire.json style) ───────────────────────────────

interface LegacyButton {
  id?: string;
  label: string;
  url: string;
  bgColor: string;
  textColor: string;
}

interface LegacySchema {
  logo?:        { dataUri?: string | null; altText?: string; width?: number; align?: string };
  headerImage?: { dataUri?: string | null; altText?: string };
  headerText?:  { content?: string; color?: string; fontSize?: number; fontWeight?: string; align?: string };
  headline?:    { label?: string; labelSize?: number; labelColor?: string; labelStyle?: string; text?: string; textSize?: number; textColor?: string; textStyle?: string; subtext?: string; subtextSize?: number; subtextColor?: string };
  body?:        { html?: string; raw?: string; fontSize?: number };
  buttons?:     LegacyButton[];
  ctaAlign?:    string;
  footer?:      { raw?: string; html?: string };
  layout?:      { contentWidth?: number; paddingLeft?: number; paddingRight?: number };
  theme?:       { accentColor?: string; bodyBgColor?: string; contentBgColor?: string; fontFamily?: string };
}

function isLegacySchema(obj: unknown): obj is LegacySchema {
  if (!obj || typeof obj !== 'object') return false;
  const o = obj as Record<string, unknown>;
  // Legacy schema has none of the native TemplateState keys but has at least one legacy key
  const nativeKeys = ['elements', 'canvasBackground', 'canvasWidth', 'showGrid', 'gridSize'];
  const legacyKeys = ['logo', 'headline', 'body', 'buttons', 'footer', 'layout', 'theme', 'headerImage', 'headerText'];
  const hasNative = nativeKeys.some((k) => k in o);
  const hasLegacy = legacyKeys.some((k) => k in o);
  return !hasNative && hasLegacy;
}

// Strip HTML tags, keeping inner text only — used for plain-text fallback
function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
}

function convertLegacyToTemplateState(raw: LegacySchema): TemplateState {
  const canvasWidth = raw.layout?.contentWidth ?? 600;
  const padH = raw.layout?.paddingLeft ?? 20;
  const innerWidth = canvasWidth - padH * 2;
  const elements: CanvasElement[] = [];
  let y = 20;
  const id = () => `el-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  // ── Logo ────────────────────────────────────────────────────────────────────
  if (raw.logo?.dataUri) {
    const logoW = raw.logo.width ?? 120;
    let logoX = padH;
    if (raw.logo.align === 'center') logoX = (canvasWidth - logoW) / 2;
    if (raw.logo.align === 'right')  logoX = canvasWidth - padH - logoW;
    const logoEl: ImageElement = {
      id: id(), type: 'image',
      x: logoX, y, width: logoW, height: Math.round(logoW * 0.4),
      src: raw.logo.dataUri, alt: raw.logo.altText ?? 'Logo',
    };
    elements.push(logoEl);
    y += logoEl.height + 16;
  }

  // ── Header image ────────────────────────────────────────────────────────────
  if (raw.headerImage?.dataUri) {
    const hImg: ImageElement = {
      id: id(), type: 'image',
      x: padH, y, width: innerWidth, height: 160,
      src: raw.headerImage.dataUri, alt: raw.headerImage.altText ?? 'Header',
    };
    elements.push(hImg);
    y += hImg.height + 12;
  }

  // ── Header text ─────────────────────────────────────────────────────────────
  if (raw.headerText?.content && raw.headerText.content.trim()) {
    const ht: TextElement = {
      id: id(), type: 'text',
      x: padH, y, width: innerWidth, height: 56,
      content: raw.headerText.content,
      fontSize:   raw.headerText.fontSize   ?? 28,
      fontColor:  raw.headerText.color       ?? '#ffffff',
      fontWeight: (raw.headerText.fontWeight === 'bold' ? 'bold' : 'normal'),
      fontStyle:  'normal',
      align:      (raw.headerText.align as 'left' | 'center' | 'right') ?? 'center',
      padding: 8,
    };
    elements.push(ht);
    y += ht.height + 8;
  }

  // ── Label (small eyebrow text above headline) ───────────────────────────────
  if (raw.headline?.label && raw.headline.label.trim()) {
    const labelEl: TextElement = {
      id: id(), type: 'text',
      x: padH, y, width: innerWidth, height: 28,
      content: raw.headline.label,
      fontSize:   raw.headline.labelSize  ?? 11,
      fontColor:  raw.headline.labelColor ?? '#555555',
      fontWeight: 'normal',
      fontStyle:  (raw.headline.labelStyle === 'italic' ? 'italic' : 'normal') as 'normal' | 'italic',
      align: 'left',
      padding: 4,
    };
    elements.push(labelEl);
    y += labelEl.height + 4;
  }

  // ── Headline ────────────────────────────────────────────────────────────────
  if (raw.headline?.text && raw.headline.text.trim()) {
    const lineCount = Math.ceil(raw.headline.text.length / 40);
    const headlineH = Math.max(44, lineCount * ((raw.headline.textSize ?? 18) + 10));
    const headlineEl: TextElement = {
      id: id(), type: 'text',
      x: padH, y, width: innerWidth, height: headlineH,
      content: raw.headline.text,
      fontSize:   raw.headline.textSize  ?? 18,
      fontColor:  raw.headline.textColor ?? '#000000',
      fontWeight: (raw.headline.textStyle === 'bold' ? 'bold' : 'normal'),
      fontStyle:  'normal',
      align: 'left',
      padding: 6,
    };
    elements.push(headlineEl);
    y += headlineEl.height + 6;
  }

  // ── Subtext ─────────────────────────────────────────────────────────────────
  if (raw.headline?.subtext && raw.headline.subtext.trim()) {
    const sub: TextElement = {
      id: id(), type: 'text',
      x: padH, y, width: innerWidth, height: 36,
      content: raw.headline.subtext,
      fontSize:   raw.headline.subtextSize  ?? 14,
      fontColor:  raw.headline.subtextColor ?? '#444444',
      fontWeight: 'normal',
      fontStyle:  'normal',
      align: 'left',
      padding: 4,
    };
    elements.push(sub);
    y += sub.height + 12;
  }

  // ── Divider after headline block ─────────────────────────────────────────────
  if (raw.headline?.text) {
    const div: DividerElement = {
      id: id(), type: 'divider',
      x: padH, y, width: innerWidth, height: 16,
      color: '#e5e7eb', thickness: 1,
    };
    elements.push(div);
    y += div.height + 12;
  }

  // ── Body ────────────────────────────────────────────────────────────────────
  const bodyContent = raw.body?.raw?.trim() || (raw.body?.html ? stripHtml(raw.body.html) : '');
  if (bodyContent) {
    // Estimate height from content length
    const charsPerLine = Math.floor(innerWidth / ((raw.body?.fontSize ?? 14) * 0.55));
    const lines = bodyContent.split('\n').reduce((acc, line) => acc + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
    const bodyH = Math.max(60, lines * ((raw.body?.fontSize ?? 14) * 1.7) + 16);
    const bodyEl: TextElement = {
      id: id(), type: 'text',
      x: padH, y, width: innerWidth, height: bodyH,
      content: bodyContent,
      fontSize:   raw.body?.fontSize ?? 14,
      fontColor:  '#333333',
      fontWeight: 'normal',
      fontStyle:  'normal',
      align: 'left',
      padding: 8,
    };
    elements.push(bodyEl);
    y += bodyEl.height + 16;
  }

  // ── CTA Buttons ─────────────────────────────────────────────────────────────
  if (raw.buttons && raw.buttons.length > 0) {
    const align = raw.ctaAlign ?? 'center';
    const btnW = 160;
    const spacing = 12;
    const totalW = raw.buttons.length * btnW + (raw.buttons.length - 1) * spacing;
    let btnX = align === 'center' ? (canvasWidth - totalW) / 2
             : align === 'right'  ? canvasWidth - padH - totalW
             : padH;

    for (const btn of raw.buttons) {
      const btnEl: ButtonElement = {
        id: id(), type: 'button',
        x: btnX, y, width: btnW, height: 44,
        label: btn.label,
        href: btn.url ?? '#',
        bgColor: btn.bgColor ?? '#0066cc',
        textColor: btn.textColor ?? '#ffffff',
        borderRadius: 4,
        fontSize: 14,
      };
      elements.push(btnEl);
      btnX += btnW + spacing;
    }
    y += 44 + 20;
  }

  // ── Divider before footer ────────────────────────────────────────────────────
  if (raw.footer?.raw || raw.footer?.html) {
    const div: DividerElement = {
      id: id(), type: 'divider',
      x: padH, y, width: innerWidth, height: 16,
      color: '#e5e7eb', thickness: 1,
    };
    elements.push(div);
    y += div.height + 8;

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerContent = raw.footer.raw?.trim() || (raw.footer.html ? stripHtml(raw.footer.html) : '');
    if (footerContent) {
      const footerEl: TextElement = {
        id: id(), type: 'text',
        x: padH, y, width: innerWidth, height: 80,
        content: footerContent,
        fontSize: 11,
        fontColor: '#888888',
        fontWeight: 'normal',
        fontStyle: 'normal',
        align: 'center',
        padding: 8,
      };
      elements.push(footerEl);
    }
  }

  return {
    elements,
    canvasBackground: raw.theme?.contentBgColor ?? '#ffffff',
    canvasWidth,
    showGrid: false,
    gridSize: 20,
    trackingScripts: [],
    backgroundImage: '',
  };
}

// ── Public entry point ────────────────────────────────────────────────────────

export function parseAndConvertJson(text: string): TemplateState {
  const parsed: unknown = JSON.parse(text); // throws on invalid JSON — caller handles
  if (isLegacySchema(parsed)) {
    return convertLegacyToTemplateState(parsed as LegacySchema);
  }
  // Already native TemplateState — normalize and return
  const obj = parsed as Record<string, unknown>;
  return {
    elements:        Array.isArray(obj.elements)        ? obj.elements as CanvasElement[]  : [],
    trackingScripts: Array.isArray(obj.trackingScripts) ? obj.trackingScripts              : [],
    canvasWidth:     typeof obj.canvasWidth === 'number' && obj.canvasWidth > 0 ? obj.canvasWidth : 600,
    canvasBackground: typeof obj.canvasBackground === 'string' ? obj.canvasBackground      : '#ffffff',
    showGrid:        typeof obj.showGrid === 'boolean' ? obj.showGrid                      : false,
    gridSize:        typeof obj.gridSize  === 'number' ? obj.gridSize                      : 20,
    backgroundImage: typeof obj.backgroundImage === 'string' ? obj.backgroundImage         : '',
  } as TemplateState;
}
