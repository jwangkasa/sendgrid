import type {
  TemplateState,
  CanvasElement,
  TextElement,
  ImageElement,
  ButtonElement,
  DividerElement,
  TableElement,
} from './types';

const CANVAS_WIDTH = 600;

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderText(el: TextElement): string {
  const style = [
    `font-size:${el.fontSize}px`,
    `color:${el.fontColor}`,
    `font-weight:${el.fontWeight}`,
    `font-style:${el.fontStyle}`,
    `text-align:${el.align}`,
    `padding:${el.padding}px`,
    'font-family:Arial,Helvetica,sans-serif',
    'line-height:1.5',
  ].join(';');
  return `<tr><td style="${style}">${el.content.replace(/\n/g, '<br/>')}</td></tr>`;
}

function renderImage(el: ImageElement): string {
  if (!el.src) return '';
  return `<tr><td style="text-align:center;padding:4px 0;">
  <img src="${el.src}" alt="${escapeHtml(el.alt)}" width="${el.width}" style="max-width:100%;display:block;margin:0 auto;" />
</td></tr>`;
}

function renderButton(el: ButtonElement): string {
  const linkStyle = [
    `background-color:${el.bgColor}`,
    `color:${el.textColor}`,
    `font-size:${el.fontSize}px`,
    `border-radius:${el.borderRadius}px`,
    'display:inline-block',
    'padding:10px 24px',
    'text-decoration:none',
    'font-family:Arial,Helvetica,sans-serif',
    'font-weight:bold',
  ].join(';');
  return `<tr><td style="text-align:center;padding:8px 0;">
  <a href="${escapeHtml(el.href)}" style="${linkStyle}">${escapeHtml(el.label)}</a>
</td></tr>`;
}

function renderDivider(el: DividerElement): string {
  return `<tr><td style="padding:8px 0;">
  <hr style="border:none;border-top:${el.thickness}px solid ${el.color};margin:0;" />
</td></tr>`;
}

function renderTable(el: TableElement): string {
  const tableStyle = [
    `border-collapse:collapse`,
    `width:100%`,
    `font-family:Arial,Helvetica,sans-serif`,
    `font-size:${el.fontSize}px`,
  ].join(';');
  const cellStyle = `border:${el.borderWidth}px solid ${el.borderColor};padding:6px 10px;`;
  let rows = '';
  for (let r = 0; r < el.rows; r++) {
    let cells = '';
    for (let c = 0; c < el.cols; c++) {
      const content = el.cells[r]?.[c] ?? '';
      cells += `<td style="${cellStyle}">${escapeHtml(content)}</td>`;
    }
    rows += `<tr>${cells}</tr>`;
  }
  return `<tr><td style="padding:8px 0;">
  <table style="${tableStyle}">${rows}</table>
</td></tr>`;
}

function renderSpacer(el: CanvasElement): string {
  return `<tr><td style="height:${el.height}px;line-height:${el.height}px;">&nbsp;</td></tr>`;
}

function renderElement(el: CanvasElement): string {
  switch (el.type) {
    case 'text':    return renderText(el as TextElement);
    case 'image':   return renderImage(el as ImageElement);
    case 'button':  return renderButton(el as ButtonElement);
    case 'divider': return renderDivider(el as DividerElement);
    case 'table':   return renderTable(el as TableElement);
    case 'spacer':  return renderSpacer(el);
    default:        return '';
  }
}

export function exportHtml(state: TemplateState): string {
  const sorted = [...state.elements].sort((a, b) => a.y - b.y);
  const rows = sorted.map(renderElement).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
</head>
<body style="margin:0;padding:0;background:#f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table width="${CANVAS_WIDTH}" cellpadding="0" cellspacing="0" border="0"
               style="width:${CANVAS_WIDTH}px;background:${state.canvasBackground};border-radius:6px;overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
