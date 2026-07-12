export type ElementType = 'text' | 'image' | 'button' | 'divider' | 'table' | 'spacer';

interface BaseElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
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

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: string[][];
  borderColor: string;
  borderWidth: number;
  fontSize: number;
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

export interface TemplateState {
  elements: CanvasElement[];
  canvasBackground: string;
}

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';
