/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type GameState = 'START' | 'PLAYING' | 'GAMEOVER' | 'PAUSED';

export type DifficultyLevel = 'EASY' | 'NORMAL' | 'HARDCORE';

export type ThemeId = 'RETRO_DAY' | 'RETRO_NIGHT' | 'NEON_CITY' | 'CUTE_GARDEN' | 'DYNAMIC_CYCLE';

export type BirdSkinId = 'CLASSIC_YEL' | 'STARRY_BLUE' | 'NEON_PINK' | 'BAT_DRAC';

export interface GameTheme {
  id: ThemeId;
  name: string;
  skyColor: string;
  groundColor: string;
  groundGrassColor: string;
  pipeColor: string;
  pipeLipColor: string;
  cloudColor: string;
  particleColor: string;
  textColor: string;
  gridColor?: string;
  starry?: boolean;
  neonGlow?: string;
}

export interface BirdSkin {
  id: BirdSkinId;
  name: string;
  bodyColor: string;
  wingColor: string;
  beakColor: string;
  eyeColor: string;
  accentColor: string;
  emoji: string; // fallback or UI indicator
}

export interface DifficultyConfig {
  gravity: number;
  jumpForce: number;
  pipeSpeed: number;
  pipeSpawnInterval: number; // millseconds or frames
  pipeGap: number;
}

export interface ScoreRecord {
  score: number;
  date: string;
  difficulty: DifficultyLevel;
  skin: string;
}
