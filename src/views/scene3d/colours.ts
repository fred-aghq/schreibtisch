import type { Theme } from '../../store/store';

/** Scene colours that can't come from CSS variables (WebGL materials). */
export interface SceneColours {
  floor: string;
  floorGrid: string;
  floorGridMajor: string;
  wall: string;
  legs: string;
  listener: string;
  accent: string;
  screen: string;
  driver: string;
  danger: string;
}

export const SCENE_COLOURS: Record<Theme, SceneColours> = {
  dark: {
    floor: '#151a20',
    floorGrid: '#232a33',
    floorGridMajor: '#2e3742',
    wall: '#3a4250',
    legs: '#2b3038',
    listener: '#aeb7c4',
    accent: '#6ea8fe',
    screen: '#0b0d10',
    driver: '#1a1c20',
    danger: '#f07178',
  },
  light: {
    floor: '#dfe3e8',
    floorGrid: '#cdd3da',
    floorGridMajor: '#b9c1cb',
    wall: '#c9cfd8',
    legs: '#59606b',
    listener: '#6b7380',
    accent: '#2f6fde',
    screen: '#14171c',
    driver: '#22252a',
    danger: '#d6454f',
  },
};
