/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { GameTheme, BirdSkin, DifficultyLevel, DifficultyConfig } from './types';

export const THEMES: GameTheme[] = [
  {
    id: 'RETRO_DAY',
    name: 'Daytime Meadow',
    skyColor: '#70c5cf', // light blue
    groundColor: '#ded895', // light sand
    groundGrassColor: '#73bf2e', // grass green
    pipeColor: '#73bf2e', // green pipe
    pipeLipColor: '#53a018', // darker green
    cloudColor: '#ffffff',
    particleColor: '#f1f5f9',
    textColor: '#4b5563',
  },
  {
    id: 'RETRO_NIGHT',
    name: 'Midnight Starfield',
    skyColor: '#1e1b4b', // deep indigo
    groundColor: '#312e81', // dark slate indigo
    groundGrassColor: '#4f46e5', // neon indigo
    pipeColor: '#10b981', // emerald pipe
    pipeLipColor: '#047857', // forest green
    cloudColor: '#312e81', // subtle clouds
    particleColor: '#fef08a', // star particles
    textColor: '#cbd5e1',
    starry: true,
  },
  {
    id: 'NEON_CITY',
    name: 'Synthwave City',
    skyColor: '#09090b', // zinc 950
    groundColor: '#18181b', // zinc 900
    groundGrassColor: '#ec4899', // hot pink
    pipeColor: '#06b6d4', // neon cyan
    pipeLipColor: '#0891b2', // darker cyan
    cloudColor: '#27272a',
    particleColor: '#f472b6', // hot pink particles
    textColor: '#f43f5e',
    gridColor: '#1e1b4b',
    neonGlow: 'rgba(6, 182, 212, 0.4)',
  },
  {
    id: 'CUTE_GARDEN',
    name: 'Cherry Blossom Bloom',
    skyColor: '#fdf2f8', // rose 50
    groundColor: '#fbcfe8', // pink sand
    groundGrassColor: '#f43f5e', // rose grass
    pipeColor: '#d97706', // dark wood color
    pipeLipColor: '#b45309', // wooden bark edge
    cloudColor: '#fecdd3', // pastel pink clouds
    particleColor: '#fecdd3', // leaf pink particles
    textColor: '#881337',
  }
];

export const SKINS: BirdSkin[] = [
  {
    id: 'CLASSIC_YEL',
    name: 'Classic Chick',
    bodyColor: '#fbbf24', // golden yellow
    wingColor: '#f59e0b', // orange wings
    beakColor: '#ea580c', // orange beak
    eyeColor: '#ffffff',
    accentColor: '#1e293b', // pupil
    emoji: '🐤'
  },
  {
    id: 'STARRY_BLUE',
    name: 'Cosmic Bluebird',
    bodyColor: '#38bdf8', // sky blue
    wingColor: '#3b82f6', // indigo-blue wing
    beakColor: '#f43f5e', // bright rose beak
    eyeColor: '#ffffff',
    accentColor: '#0369a1',
    emoji: '🐦'
  },
  {
    id: 'NEON_PINK',
    name: 'Cyber Sparrow',
    bodyColor: '#ec4899', // pink
    wingColor: '#06b6d4', // cyan wing
    beakColor: '#eab308', // cyber yellow beak
    eyeColor: '#ffffff',
    accentColor: '#09090b',
    emoji: '🦜'
  },
  {
    id: 'BAT_DRAC',
    name: 'Pixel Vampire Bat',
    bodyColor: '#3f3f46', // slate gray
    wingColor: '#1c1917', // dark brown-gray wings
    beakColor: '#ef4444', // blood red fangs/beak
    eyeColor: '#fca5a5', // glowing red eye
    accentColor: '#7f1d1d',
    emoji: '🦇'
  }
];

export const DIFFICULTY_PRESETS: Record<DifficultyLevel, DifficultyConfig> = {
  EASY: {
    gravity: 0.38,
    jumpForce: -6.2,
    pipeSpeed: 2.4,
    pipeSpawnInterval: 105, // frame count interval
    pipeGap: 160,          // generous vertical gap in px
  },
  NORMAL: {
    gravity: 0.48,
    jumpForce: -7.4,
    pipeSpeed: 3.2,
    pipeSpawnInterval: 80,
    pipeGap: 135,          // standard gap
  },
  HARDCORE: {
    gravity: 0.60,
    jumpForce: -8.8,
    pipeSpeed: 4.2,
    pipeSpawnInterval: 65,
    pipeGap: 110,          // ultra tight/narrow gap
  },
};
