import type { Category } from './types';

export interface CategoryInfo {
  label: string;
  /** Tint used in the plan / 3D views. */
  tint: string;
}

export const CATEGORY_INFO: Record<Category, CategoryInfo> = {
  monitor: { label: 'Monitor', tint: '#6ea8fe' },
  speaker: { label: 'Speaker', tint: '#f0a35e' },
  light: { label: 'Light', tint: '#f5d76e' },
  keyboard: { label: 'Keyboard', tint: '#9ad0a4' },
  mouse: { label: 'Mouse', tint: '#7fd1c7' },
  mat: { label: 'Desk mat', tint: '#8a93a6' },
  laptop: { label: 'Laptop', tint: '#b79cf2' },
  pc: { label: 'PC', tint: '#c98bb9' },
  'audio-interface': { label: 'Audio interface', tint: '#e58f8f' },
  other: { label: 'Other', tint: '#a7b0bd' },
};
