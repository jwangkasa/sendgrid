export type ElementType = 'text' | 'image' | 'button' | 'divider' | 'table' | 'spacer';

interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  locked?: boolean;
}

export interface TextElement extends BaseElement {
  type: 'text';
  content: string;
  fontSize: number;
  fontColor: string;
  fontWeight: 'normal' | 'bold';
  fontStyle: 'normal' | 'italic';
  align: 'left' | 'center' | 'right';
  padding: number;
}

export interface ImageElement extends BaseElement {
  type: 'image';
  src: string;
  alt: string;
  label?: string;
}

export interface ButtonElement extends BaseElement {
  type: 'button';
  label: string;
  href: string;
  bgColor: string;
  textColor: string;
  borderRadius: number;
  fontSize: number;
}

export interface DividerElement extends BaseElement {
  type: 'divider';
  color: string;
  thickness: number;
}

export type BorderStyle = 'solid' | 'dashed' | 'dotted' | 'double' | 'none';
export type VerticalAlign = 'top' | 'middle' | 'bottom';

export interface CellStyle {
  bgColor?: string;
  textColor?: string;
  align?: 'left' | 'center' | 'right';
  verticalAlign?: VerticalAlign;
  borderStyle?: BorderStyle;
  borderWidth?: number;
  borderColor?: string;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][];
  cellStyles?: CellStyle[][];   // per-cell overrides [row][col]
  borderColor: string;
  borderWidth: number;
  borderStyle?: BorderStyle;
  fontSize: number;
  cellPadding?: number;
  headerBgColor?: string;
}

export interface SpacerElement extends BaseElement {
  type: 'spacer';
}

export type CanvasElement =
  | TextElement
  | ImageElement
  | ButtonElement
  | DividerElement
  | TableElement
  | SpacerElement;

export type ScriptType = 'ga4' | 'gtm' | 'fb_pixel' | 'custom';

export interface TrackingScript {
  id: string;
  name: string;
  type: ScriptType;
  value: string;
  enabled: boolean;
}

export interface TemplateState {
  elements: CanvasElement[];
  canvasBackground: string;
  canvasWidth: number;
  showGrid: boolean;
  gridSize: number;
  trackingScripts: TrackingScript[];
  backgroundImage: string;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
