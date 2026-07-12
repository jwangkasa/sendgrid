import type {
  TemplateState,
  CanvasElement,
  TextElement,
  ImageElement,
  ButtonElement,
  DividerElement,
  TableElement,
  TrackingScript,
} from './types';

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
    'border-collapse:collapse',
    'width:100%',
    'font-family:Arial,Helvetica,sans-serif',
    `font-size:${el.fontSize}px`,
  ].join(';');
  const pad = el.cellPadding ?? 6;
  const baseCellStyle = `border:${el.borderWidth}px solid ${el.borderColor};padding:${pad}px ${pad + 2}px;`;
  let rows = '';
  for (let r = 0; r < el.rows; r++) {
    const isHeader = r === 0 && !!el.headerBgColor;
    let cells = '';
    for (let c = 0; c < el.cols; c++) {
      const content = el.cells[r]?.[c] ?? '';
      const cellStyle = isHeader
        ? `${baseCellStyle}background-color:${el.headerBgColor};font-weight:bold;`
        : baseCellStyle;
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

function buildTrackingHead(scripts: TrackingScript[]): string {
  return scripts
    .filter((s) => s.enabled)
    .map((s) => {
      if (s.type === 'ga4') {
        return `<!-- Google Analytics 4: ${escapeHtml(s.name)} -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${escapeHtml(s.value)}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${escapeHtml(s.value)}');
</script>`;
      }
      if (s.type === 'gtm') {
        return `<!-- Google Tag Manager: ${escapeHtml(s.name)} -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';
j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${escapeHtml(s.value)}');</script>`;
      }
      if (s.type === 'fb_pixel') {
        return `<!-- Meta Pixel: ${escapeHtml(s.name)} -->
<script>
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${escapeHtml(s.value)}');
fbq('track', 'PageView');
</script>`;
      }
      if (s.type === 'custom') {
        return `<!-- ${escapeHtml(s.name)} -->\n${s.value}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n');
}

function buildGtmNoscript(scripts: TrackingScript[]): string {
  return scripts
    .filter((s) => s.enabled && s.type === 'gtm')
    .map((s) => `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${escapeHtml(s.value)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`)
    .join('\n');
}

export function exportHtml(state: TemplateState): string {
  const w = state.canvasWidth ?? 600;
  const sorted = [...state.elements].sort((a, b) => a.y - b.y);
  const rows = sorted.map(renderElement).join('\n');
  const trackingHead = buildTrackingHead(state.trackingScripts ?? []);
  const gtmNoscript = buildGtmNoscript(state.trackingScripts ?? []);
  const bodyBgStyle = state.backgroundImage
    ? `background-image:url(${state.backgroundImage});background-size:cover;background-position:center;`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
${trackingHead ? trackingHead + '\n' : ''}</head>
<body style="margin:0;padding:0;background:#f4f4f5;${bodyBgStyle}">
${gtmNoscript ? gtmNoscript + '\n' : ''}  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f4f5;${bodyBgStyle}">
    <tr>
      <td align="center" style="padding:24px 0;">
        <table width="${w}" cellpadding="0" cellspacing="0" border="0"
               style="width:${w}px;background:${state.canvasBackground};border-radius:6px;overflow:hidden;">
          ${rows}
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
