/**
 * Time-of-day skies (OKLCH). Shared by the WebGL sky shader, CSS backgrounds and the web
 * instrument (whose sky follows the mood of the chosen scale).
 */
import type { SkyId } from '../seq/scales';

export interface SkyDef {
  id: SkyId;
  label: string;
  clock: string;
  /** zenith, middle, horizon */
  top: [number, number, number];
  mid: [number, number, number];
  bottom: [number, number, number];
  /** Sun elevation (−1 below horizon … 1 overhead) and colour. */
  sunElevation: number;
  sun: [number, number, number];
  /** 0 = day text (ink), 1 = night text (starlight). */
  dark: number;
  stars: number;
  clouds: number;
}

export const SKIES: Record<SkyId, SkyDef> = {
  dawn: {
    id: 'dawn',
    label: 'Dawn',
    clock: '06:10',
    top: [0.46, 0.08, 268],
    mid: [0.66, 0.07, 305],
    bottom: [0.86, 0.07, 45],
    sunElevation: 0.02,
    sun: [0.9, 0.12, 60],
    dark: 0,
    stars: 0.15,
    clouds: 0.55,
  },
  morning: {
    id: 'morning',
    label: 'Morning',
    clock: '08:40',
    top: [0.64, 0.12, 244],
    mid: [0.79, 0.08, 236],
    bottom: [0.93, 0.03, 215],
    sunElevation: 0.35,
    sun: [0.97, 0.06, 95],
    dark: 0,
    stars: 0,
    clouds: 0.9,
  },
  noon: {
    id: 'noon',
    label: 'Noon',
    clock: '12:30',
    top: [0.57, 0.15, 250],
    mid: [0.7, 0.12, 240],
    bottom: [0.86, 0.07, 228],
    sunElevation: 0.95,
    sun: [0.99, 0.03, 95],
    dark: 0,
    stars: 0,
    clouds: 1,
  },
  afternoon: {
    id: 'afternoon',
    label: 'Afternoon',
    clock: '15:20',
    top: [0.6, 0.13, 247],
    mid: [0.74, 0.1, 236],
    bottom: [0.9, 0.05, 210],
    sunElevation: 0.6,
    sun: [0.98, 0.05, 90],
    dark: 0,
    stars: 0,
    clouds: 0.85,
  },
  golden: {
    id: 'golden',
    label: 'Golden hour',
    clock: '18:05',
    top: [0.55, 0.1, 258],
    mid: [0.72, 0.09, 300],
    bottom: [0.86, 0.12, 72],
    sunElevation: 0.12,
    sun: [0.92, 0.15, 70],
    dark: 0,
    stars: 0,
    clouds: 0.7,
  },
  dusk: {
    id: 'dusk',
    label: 'Dusk',
    clock: '19:40',
    top: [0.3, 0.09, 280],
    mid: [0.48, 0.11, 320],
    bottom: [0.72, 0.15, 40],
    sunElevation: -0.05,
    sun: [0.75, 0.17, 35],
    dark: 1,
    stars: 0.35,
    clouds: 0.45,
  },
  evening: {
    id: 'evening',
    label: 'Evening',
    clock: '21:15',
    top: [0.19, 0.06, 272],
    mid: [0.28, 0.08, 285],
    bottom: [0.42, 0.1, 305],
    sunElevation: -0.3,
    sun: [0.6, 0.12, 320],
    dark: 1,
    stars: 0.75,
    clouds: 0.2,
  },
  night: {
    id: 'night',
    label: 'Night',
    clock: '23:50',
    top: [0.11, 0.03, 266],
    mid: [0.15, 0.04, 262],
    bottom: [0.23, 0.05, 256],
    sunElevation: -0.8,
    sun: [0.5, 0.05, 260],
    dark: 1,
    stars: 1,
    clouds: 0.05,
  },
};

export const SKY_ORDER: SkyId[] = ['dawn', 'morning', 'noon', 'afternoon', 'golden', 'dusk', 'evening', 'night'];

export const cssOklch = ([l, c, h]: [number, number, number]) => `oklch(${l} ${c} ${h})`;
