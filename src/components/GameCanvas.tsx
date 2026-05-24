/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Play, Home } from 'lucide-react';
import { GameState, DifficultyLevel, ThemeId, BirdSkinId } from '../types';
import { THEMES, SKINS, DIFFICULTY_PRESETS } from '../constants';
import { sfx } from '../audio';

interface GameCanvasProps {
  gameState: GameState;
  difficulty: DifficultyLevel;
  themeId: ThemeId;
  skinId: BirdSkinId;
  onScoreChange: (score: number) => void;
  onGameOver: (finalScore: number) => void;
  onGameStart: () => void;
  onResume?: () => void;
  soundEnabled: boolean;
  score: number;
  highScore: number;
  isNewHighScore: boolean;
  onResetToStart: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
  type: 'feather' | 'star' | 'dust';
  angle?: number;
  spinSpeed?: number;
}

interface WeatherParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  type: 'snow' | 'rain' | 'cherry' | 'cyber';
  wobble: number;
  wobbleSpeed: number;
}

interface Cloud {
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  depth: number;
}

interface Star {
  x: number;
  y: number;
  size: number;
  alpha: number;
  speed: number;
}

interface Pipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  passed: boolean;
  width: number;
}

function interpolateColor(color1: string, color2: string, factor: number): string {
  const parseHex = (hex: string) => {
    let clean = hex.startsWith('#') ? hex.slice(1) : hex;
    if (clean.length === 3) {
      clean = clean.split('').map(char => char + char).join('');
    }
    const val = parseInt(clean, 16);
    return {
      r: (val >> 16) & 255,
      g: (val >> 8) & 255,
      b: val & 255
    };
  };

  try {
    const rgb1 = parseHex(color1);
    const rgb2 = parseHex(color2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * factor);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * factor);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * factor);

    return `rgb(${r}, ${g}, ${b})`;
  } catch (e) {
    return color1;
  }
}

export default function GameCanvas({
  gameState,
  difficulty,
  themeId,
  skinId,
  onScoreChange,
  onGameOver,
  onGameStart,
  onResume,
  soundEnabled,
  score,
  highScore,
  isNewHighScore,
  onResetToStart,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastFlapTime = useRef<number>(0);
  const [hasStartedFlying, setHasStartedFlying] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({
    logicalWidth: 480,
    logicalHeight: 640,
  });

  // Game states referenced in the render/update loop
  const stateRef = useRef({
    gameState,
    difficulty,
    themeId,
    skinId,
    highScore,
    score: 0,
    birdY: 250,
    birdVelocity: 0,
    birdRotation: 0,
    ticks: 0,
    pipes: [] as Pipe[],
    particles: [] as Particle[],
    clouds: [] as Cloud[],
    stars: [] as Star[],
    weatherParticles: [] as WeatherParticle[],
    groundX: 0,
    pipeTimer: 0,
    flashOpaque: 0, // screenshake or crash flash
    screenShake: 0, // screenshake duration
    hasStartedFlying: false,
    logicalWidth: 480,
    logicalHeight: 640,
  });

  // Keep ref game settings in sync with props
  useEffect(() => {
    const prevThemeId = stateRef.current.themeId;
    const prevGameState = stateRef.current.gameState;
    
    stateRef.current.gameState = gameState;
    stateRef.current.difficulty = difficulty;
    stateRef.current.themeId = themeId;
    stateRef.current.skinId = skinId;
    stateRef.current.highScore = highScore;
    
    sfx.setSoundEnabled(soundEnabled);

    // Clear weather particles instantly if we shift themes
    if (prevThemeId !== themeId) {
      stateRef.current.weatherParticles = [];
    }

    // Reset game logic context ONLY on starting a fresh run:
    // 1. If we enter 'START' (Start menu/reset to menu)
    // 2. If we start a fresh game from 'GAMEOVER' to 'PLAYING'
    // 3. Or if we start a fresh game from 'START' to 'PLAYING'
    // But we MUST NOT reset if we are resuming from 'PAUSED' to 'PLAYING'!
    const isRestarting = 
      gameState === 'START' || 
      (gameState === 'PLAYING' && prevGameState === 'GAMEOVER') ||
      (gameState === 'PLAYING' && prevGameState === 'START');

    if (isRestarting) {
      stateRef.current.score = 0;
      stateRef.current.birdY = 250;
      stateRef.current.birdVelocity = 0;
      stateRef.current.birdRotation = 0;
      stateRef.current.pipes = [];
      stateRef.current.particles = [];
      stateRef.current.pipeTimer = 0;
      stateRef.current.hasStartedFlying = false;
      setHasStartedFlying(false);
    }
  }, [gameState, difficulty, themeId, skinId, soundEnabled, highScore]);

  // Synchronize canvas proportions to container size on screen dynamically
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        let { width, height } = entry.contentRect;
        // fallback measurement if contentRect is zero
        if (width === 0 || height === 0) {
          const rect = container.getBoundingClientRect();
          width = rect.width;
          height = rect.height;
        }
        if (width > 0 && height > 0) {
          const aspect = width / height;
          // Standard base vertical coordinate logic is balanced at height=640
          const logicalHeight = 640;
          const logicalWidth = Math.round(640 * aspect);
          setDimensions({ logicalWidth, logicalHeight });
          stateRef.current.logicalWidth = logicalWidth;
          stateRef.current.logicalHeight = logicalHeight;
        }
      }
    });

    resizeObserver.observe(container);
    
    const handleResize = () => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        const aspect = rect.width / rect.height;
        const logicalHeight = 640;
        const logicalWidth = Math.round(640 * aspect);
        setDimensions({ logicalWidth, logicalHeight });
        stateRef.current.logicalWidth = logicalWidth;
        stateRef.current.logicalHeight = logicalHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    // Initial check
    handleResize();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Dimension parameters
  const LOGICAL_WIDTH = 480;
  const LOGICAL_HEIGHT = 640;
  const GROUND_LEVEL = 560;
  const BIRD_X = 120;
  const BIRD_RADIUS = 16;
  const PIPE_WIDTH = 70;

  // Initialize background decorators
  useEffect(() => {
    // Generate initial clouds
    const clouds: Cloud[] = [];
    for (let i = 0; i < 6; i++) {
      // depth from 0.4 (back) to 1.0 (front)
      const depth = 0.4 + (i / 5) * 0.6;
      // Slightly randomized depth for realistic variance
      const cloudDepth = Math.max(0.3, Math.min(1.0, depth + (Math.random() - 0.5) * 0.12));
      const width = (55 + Math.random() * 45) * cloudDepth;
      const height = (22 + Math.random() * 12) * cloudDepth;
      // speed scales with depth (slower in back, faster in front)
      const speed = (0.08 + cloudDepth * 0.35) * (0.95 + Math.random() * 0.1);

      clouds.push({
        x: Math.random() * LOGICAL_WIDTH + i * 110,
        y: 35 + Math.random() * 130,
        width,
        height,
        speed,
        depth: cloudDepth,
      });
    }
    // Sort clouds by depth ascending (back clouds first in array)
    clouds.sort((a, b) => a.depth - b.depth);
    stateRef.current.clouds = clouds;

    // Generate starry particles if night theme
    const stars: Star[] = [];
    for (let i = 0; i < 30; i++) {
      stars.push({
        x: Math.random() * LOGICAL_WIDTH,
        y: Math.random() * 380,
        size: 1 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.7,
        speed: 0.05 + Math.random() * 0.08,
      });
    }
    stateRef.current.stars = stars;
  }, []);

  // Handle Action (Flap Bird)
  const handleFlap = () => {
    if (stateRef.current.gameState === 'START') {
      onGameStart();
      stateRef.current.hasStartedFlying = true;
      setHasStartedFlying(true);
      triggerJump();
    } else if (stateRef.current.gameState === 'PLAYING') {
      if (!stateRef.current.hasStartedFlying) {
        stateRef.current.hasStartedFlying = true;
        setHasStartedFlying(true);
      }
      triggerJump();
    } else if (stateRef.current.gameState === 'PAUSED') {
      onResume?.();
    } else if (stateRef.current.gameState === 'GAMEOVER') {
      onGameStart();
      stateRef.current.hasStartedFlying = true;
      setHasStartedFlying(true);
      triggerJump();
    }
  };

  const triggerJump = () => {
    const config = DIFFICULTY_PRESETS[stateRef.current.difficulty];
    stateRef.current.birdVelocity = config.jumpForce;
    sfx.playJump();

    // Spawn wing particles
    const skin = SKINS.find(s => s.id === stateRef.current.skinId) || SKINS[0];
    const theme = THEMES.find(t => t.id === stateRef.current.themeId) || THEMES[0];
    for (let i = 0; i < 5; i++) {
      stateRef.current.particles.push({
        x: BIRD_X - 10,
        y: stateRef.current.birdY,
        vx: -1.5 - Math.random() * 2.0,
        vy: -1.0 + Math.random() * 2.0,
        size: 3 + Math.random() * 4,
        color: Math.random() > 0.5 ? skin.wingColor : theme.particleColor,
        alpha: 1.0,
        life: 0,
        maxLife: 20 + Math.random() * 15,
        type: 'feather',
      });
    }
  };

  // Keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
        e.preventDefault();
        handleFlap();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Mobile Touch Controls anywhere on viewport for seamless gameplay feel
  useEffect(() => {
    if (gameState !== 'PLAYING' && gameState !== 'START') return;

    const handleWindowTouch = (e: TouchEvent | PointerEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      // Ignore touches on interface buttons so user can interact with menus
      if (
        target.closest('button') ||
        target.closest('#play-again-btn') ||
        target.closest('#home-btn') ||
        target.closest('#header-sound-btn') ||
        target.closest('#header-score-board-btn') ||
        target.closest('#pause-game-btn') ||
        target.closest('#resume-game-btn')
      ) {
        return;
      }

      // If it's a touch event, call preventDefault to stop click/mouse delays & page zooming
      if (e.type === 'touchstart') {
        e.preventDefault();
      }

      const now = Date.now();
      if (now - lastFlapTime.current < 45) return;
      lastFlapTime.current = now;

      handleFlap();
    };

    window.addEventListener('touchstart', handleWindowTouch, { passive: false });
    window.addEventListener('pointerdown', handleWindowTouch);

    return () => {
      window.removeEventListener('touchstart', handleWindowTouch);
      window.removeEventListener('pointerdown', handleWindowTouch);
    };
  }, [gameState]);

  // Main Loop logic using standard animation frame
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const updateAndRender = (currentTime: number) => {
      // Compute delta time (normalized to 60fps)
      let dt = (currentTime - lastTime) / 16.666;
      if (dt > 3) dt = 3; // cap simulation steps to avoid giant teleports on focus-loss
      lastTime = currentTime;

      const state = stateRef.current;
      const LOGICAL_WIDTH = state.logicalWidth;
      const LOGICAL_HEIGHT = state.logicalHeight;
      const theme = THEMES.find(t => t.id === state.themeId) || THEMES[0];
      const skin = SKINS.find(s => s.id === state.skinId) || SKINS[0];
      const config = DIFFICULTY_PRESETS[state.difficulty];
      const densityFactor = 0.6 + 0.4 * Math.sin(state.ticks * 0.0012);

      // Cloud wind speed and density/thickness dynamic adjustments based on DifficultyLevel
      let cloudSpeedMul = 1.0;
      let cloudDensityMul = 1.0;
      if (state.difficulty === 'EASY') {
        cloudSpeedMul = 0.55;
        cloudDensityMul = 0.6;
      } else if (state.difficulty === 'HARDCORE') {
        cloudSpeedMul = 2.5;
        cloudDensityMul = 1.6;
      }

      canvasRef.current;
      const canvas = canvasRef.current;
      if (!canvas) {
        animationFrameId = requestAnimationFrame(updateAndRender);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animationFrameId = requestAnimationFrame(updateAndRender);
        return;
      }

      // Increment timers
      state.ticks++;

      // Apply screen shake cooling
      if (state.screenShake > 0) {
        state.screenShake -= dt;
      }

      // Apply flash cooling
      if (state.flashOpaque > 0) {
        state.flashOpaque = Math.max(0, state.flashOpaque - 0.08 * dt);
      }

      // --- PHYSICS & MOVEMENTS (ONLY WHEN PLAYING & FLYING) ---
      if (state.gameState === 'PLAYING' && state.hasStartedFlying) {
        // Gravity & Vertical Motion
        state.birdVelocity += config.gravity * dt;
        state.birdY += state.birdVelocity * dt;

        // Cap upper bounds
        if (state.birdY < BIRD_RADIUS) {
          state.birdY = BIRD_RADIUS;
          state.birdVelocity = 0;
        }

        // Tilt calculation
        // Smoothly angle down when falling, angle up when jumping
        const targetRotation = Math.min(Math.PI / 2.5, Math.max(-Math.PI / 8, state.birdVelocity * 0.07));
        state.birdRotation += (targetRotation - state.birdRotation) * 0.25 * dt;

        // Ground scroll
        state.groundX = (state.groundX - config.pipeSpeed * dt) % 24;

        // Spawn Pipes
        state.pipeTimer += dt;
        // Interval configured dynamically
        if (state.pipeTimer >= config.pipeSpawnInterval) {
          state.pipeTimer = 0;
          
          // Random vertical center
          const gapSize = config.pipeGap;
          const minPipeHeight = 60;
          const maxPipeHeight = GROUND_LEVEL - gapSize - minPipeHeight;
          const topHeight = minPipeHeight + Math.random() * (maxPipeHeight - minPipeHeight);
          const bottomHeight = GROUND_LEVEL - gapSize - topHeight;

          state.pipes.push({
            x: LOGICAL_WIDTH,
            topHeight,
            bottomHeight,
            passed: false,
            width: PIPE_WIDTH,
          });
        }

        // Update Pipes
        const pipesToRemove: number[] = [];
        state.pipes.forEach((pipe, index) => {
          pipe.x -= config.pipeSpeed * dt;

          // Check if passed for score
          if (!pipe.passed && pipe.x + pipe.width / 2 < BIRD_X) {
            pipe.passed = true;
            state.score += 1;
            onScoreChange(state.score);
            
            // Play sweet notification sound
            if (state.score % 10 === 0 && state.score > 0) {
              sfx.playScoreMilestone();
            } else {
              sfx.playPoint();
            }

            // High praise confetti
            for (let i = 0; i < 12; i++) {
              state.particles.push({
                x: pipe.x + pipe.width / 2,
                y: LOGICAL_HEIGHT / 2 + (Math.random() - 0.5) * 150,
                vx: -1 + Math.random() * 2,
                vy: -3 - Math.random() * 3,
                size: 2 + Math.random() * 4,
                color: theme.particleColor,
                alpha: 1.0,
                life: 0,
                maxLife: 35 + Math.random() * 20,
                type: 'star',
              });
            }
          }

          // Mark out of screen
          if (pipe.x < -pipe.width) {
            pipesToRemove.push(index);
          }

          // COLLISION DETECTION (Slightly smaller hitbox for fairness)
          const birdCollideRadius = BIRD_RADIUS * 0.85;

          // Top pipe collision
          const inPipeRangeX = BIRD_X + birdCollideRadius > pipe.x && BIRD_X - birdCollideRadius < pipe.x + pipe.width;
          const hitTopPipe = inPipeRangeX && (state.birdY - birdCollideRadius < pipe.topHeight);
          const hitBottomPipe = inPipeRangeX && (state.birdY + birdCollideRadius > GROUND_LEVEL - pipe.bottomHeight);

          if (hitTopPipe || hitBottomPipe) {
            triggerCrash();
          }
        });

        // Remove out-of-bounds pipes
        state.pipes = state.pipes.filter((_, i) => !pipesToRemove.includes(i));

        // Ground Collision
        if (state.birdY + BIRD_RADIUS >= GROUND_LEVEL) {
          state.birdY = GROUND_LEVEL - BIRD_RADIUS;
          triggerCrash();
        }
      }

      // --- BOBBING & GROUND SCROLL FOR START & PRE-FLIGHT ---
      if (state.gameState === 'START' || (state.gameState === 'PLAYING' && !state.hasStartedFlying)) {
        // Bobbing motion for the bird
        state.birdY = 250 + Math.sin(state.ticks * 0.08) * 8;
        state.birdVelocity = 0;
        state.birdRotation = 0;

        // Ground scroll
        state.groundX = (state.groundX - config.pipeSpeed * dt) % 24;
      }

      // --- PHYSICS & MOVEMENTS (GAMEOVER DISSOLVE & SPINNING FALL) ---
      if (state.gameState === 'GAMEOVER') {
        if (state.birdY + BIRD_RADIUS < GROUND_LEVEL) {
          // Continue falling straight down to the ground
          state.birdVelocity += config.gravity * dt;
          state.birdY += state.birdVelocity * dt;

          // Cap at ground landing
          if (state.birdY + BIRD_RADIUS >= GROUND_LEVEL) {
            state.birdY = GROUND_LEVEL - BIRD_RADIUS;
            state.birdVelocity = 0;

            // Small ground collision impact dust puff on crash landing
            for (let i = 0; i < 8; i++) {
              state.particles.push({
                x: BIRD_X + (Math.random() - 0.5) * 20,
                y: GROUND_LEVEL,
                vx: (Math.random() - 0.5) * 3,
                vy: -Math.random() * 2,
                size: 2 + Math.random() * 3,
                color: theme.id === 'NEON_CITY' ? '#ec4899' : '#eab308',
                alpha: 0.8,
                life: 0,
                maxLife: 15 + Math.random() * 10,
                type: 'dust',
              });
            }
          }

          // specific spin animation when falling before it falls to the ground
          state.birdRotation += 0.35 * dt; // rapid spinning animation
        } else {
          // Keep bird face down once fully landed
          state.birdRotation = Math.PI / 2;
        }
      }

      function triggerCrash() {
        state.gameState = 'GAMEOVER';
        state.screenShake = 15;
        state.flashOpaque = 0.8;
        sfx.playHit();
        setTimeout(() => sfx.playFall(), 180);

        // Highly dramatic, chaotic explosion of feather particles centered on the bird
        const featherCount = 65;
        for (let i = 0; i < featherCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          // Chaotic, wide distribution of velocities
          const spd = 1.0 + Math.random() * 8.0;
          
          let featherColor = skin.bodyColor;
          const colorSelector = Math.random();
          if (colorSelector > 0.65) {
            featherColor = skin.wingColor;
          } else if (colorSelector > 0.85) {
            featherColor = skin.beakColor;
          }

          state.particles.push({
            x: BIRD_X,
            y: state.birdY,
            vx: Math.cos(angle) * spd + (Math.random() - 0.5) * 2.0,
            vy: Math.sin(angle) * spd - 2 - Math.random() * 2.5, // distribute splatter upward and outward
            size: 2.5 + Math.random() * 6.0,
            color: featherColor,
            alpha: 1.0,
            life: 0,
            maxLife: 25 + Math.random() * 50,
            type: 'feather',
            angle: Math.random() * Math.PI * 2,
            spinSpeed: (Math.random() - 0.5) * 0.5, // chaotic mid-air pinwheeling
          });
        }

        onGameOver(state.score);
      }

      // --- DECORATIVE LAYERS (Always update slowly even if not playing) ---
      // Update Clouds (incorporating dynamic speed multipliers based on difficulty level)
      state.clouds.forEach(cloud => {
        cloud.x -= cloud.speed * cloudSpeedMul * dt;
        if (cloud.x < -cloud.width) {
          cloud.x = LOGICAL_WIDTH + 30;
          cloud.y = 35 + Math.random() * 130;
        }
      });

      // Update Stars
      if (theme.starry) {
        state.stars.forEach(star => {
          star.x -= star.speed * dt;
          if (star.x < -10) {
            star.x = LOGICAL_WIDTH + 10;
            star.y = Math.random() * 380;
          }
          star.alpha = 0.3 + Math.abs(Math.sin((state.ticks + star.x) * 0.02)) * 0.7;
        });
      }

      // --- WEATHER EFFECTS & PARTICLES (Toggled based on Theme) ---
      let weatherType: 'rain' | 'snow' | 'cherry' | 'cyber' | null = null;
      let targetWeatherColor = '#ffffff';
      let maxWeatherParticles = 0;

      if (theme.id === 'RETRO_DAY') {
        weatherType = 'rain';
        targetWeatherColor = 'rgba(156, 204, 219, 0.48)';
        maxWeatherParticles = Math.floor(65 * densityFactor);
      } else if (theme.id === 'RETRO_NIGHT') {
        weatherType = 'snow';
        targetWeatherColor = 'rgba(255, 255, 255, 0.8)';
        maxWeatherParticles = Math.floor(55 * densityFactor);
      } else if (theme.id === 'CUTE_GARDEN') {
        weatherType = 'cherry';
        targetWeatherColor = 'rgba(251, 182, 211, 0.75)';
        maxWeatherParticles = Math.floor(45 * densityFactor);
      } else if (theme.id === 'NEON_CITY') {
        weatherType = 'cyber';
        targetWeatherColor = 'rgba(6, 182, 212, 0.65)';
        maxWeatherParticles = Math.floor(40 * densityFactor);
      }

      // Pre-populate if empty or insufficient (e.g. initial start)
      if (weatherType && state.weatherParticles.length === 0) {
        for (let i = 0; i < maxWeatherParticles; i++) {
          const rx = Math.random() * LOGICAL_WIDTH;
          const ry = Math.random() * GROUND_LEVEL;
          let vx = 0;
          let vy = 0;
          let sz = 1.5;
          if (weatherType === 'rain') {
            vx = -1.5 - Math.random() * 0.5;
            vy = 5.5 + Math.random() * 2.5;
            sz = 1.2 + Math.random() * 0.8;
          } else if (weatherType === 'snow') {
            vx = -0.4 - Math.random() * 0.4;
            vy = 1.0 + Math.random() * 0.8;
            sz = 1.5 + Math.random() * 2.2;
          } else if (weatherType === 'cherry') {
            vx = -1.0 - Math.random() * 1.0;
            vy = 1.2 + Math.random() * 1.0;
            sz = 2.5 + Math.random() * 3.0;
          } else if (weatherType === 'cyber') {
            vx = -0.3 + Math.random() * 0.6;
            vy = -0.5 - Math.random() * 0.6;
            sz = 1.5 + Math.random() * 2.0;
          }

          state.weatherParticles.push({
            x: rx,
            y: ry,
            vx,
            vy,
            size: sz,
            color: weatherType === 'cyber' && Math.random() > 0.5 ? 'rgba(236, 72, 153, 0.65)' : targetWeatherColor,
            alpha: 0.3 + Math.random() * 0.6,
            type: weatherType,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.03 + Math.random() * 0.05,
          });
        }
      }

      // Maintain spawning over time if active and under maximum limit
      if (weatherType && state.weatherParticles.length < maxWeatherParticles && state.ticks % 2 === 0) {
        const spawnCount = Math.min(3, maxWeatherParticles - state.weatherParticles.length);
        for (let s = 0; s < spawnCount; s++) {
          const fromRight = Math.random() > 0.7;
          const rx = fromRight ? LOGICAL_WIDTH + 10 : Math.random() * LOGICAL_WIDTH;
          const ry = fromRight ? Math.random() * GROUND_LEVEL : -15;

          let vx = 0;
          let vy = 0;
          let sz = 1.5;
          if (weatherType === 'rain') {
            vx = -1.5 - Math.random() * 0.5;
            vy = 5.5 + Math.random() * 2.5;
            sz = 1.2 + Math.random() * 0.8;
          } else if (weatherType === 'snow') {
            vx = -0.4 - Math.random() * 0.4;
            vy = 1.0 + Math.random() * 0.8;
            sz = 1.5 + Math.random() * 2.2;
          } else if (weatherType === 'cherry') {
            vx = -1.0 - Math.random() * 1.0;
            vy = 1.2 + Math.random() * 1.0;
            sz = 2.5 + Math.random() * 3.0;
          } else if (weatherType === 'cyber') {
            vx = -0.3 + Math.random() * 0.6;
            vy = -0.5 - Math.random() * 0.6;
            sz = 1.5 + Math.random() * 2.0;
          }

          state.weatherParticles.push({
            x: rx,
            y: weatherType === 'cyber' ? GROUND_LEVEL + Math.random() * 20 : ry,
            vx,
            vy,
            size: sz,
            color: weatherType === 'cyber' && Math.random() > 0.5 ? 'rgba(236, 72, 153, 0.65)' : targetWeatherColor,
            alpha: 0.3 + Math.random() * 0.6,
            type: weatherType,
            wobble: Math.random() * Math.PI * 2,
            wobbleSpeed: 0.03 + Math.random() * 0.05,
          });
        }
      }

      if (state.weatherParticles.length > maxWeatherParticles + 15) {
        state.weatherParticles.splice(maxWeatherParticles);
      }

      // Update Weather Particles
      const deadWeather: number[] = [];
      state.weatherParticles.forEach((p, idx) => {
        p.wobble += p.wobbleSpeed * dt;

        if (p.type === 'snow') {
          p.x += (p.vx + Math.sin(p.wobble) * 0.35) * dt;
          p.y += p.vy * dt;
        } else if (p.type === 'cherry') {
          p.x += (p.vx + Math.cos(p.wobble) * 0.5) * dt;
          p.y += (p.vy + Math.sin(p.wobble * 0.5) * 0.1) * dt;
        } else if (p.type === 'cyber') {
          p.x += (p.vx + Math.sin(p.wobble) * 0.1) * dt;
          p.y += p.vy * dt;
          p.alpha = Math.max(0, p.alpha - 0.003 * dt);
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }

        if (p.type === 'cyber') {
          if (p.y < 80 || p.x < -20 || p.x > LOGICAL_WIDTH + 20 || p.alpha <= 0) {
            deadWeather.push(idx);
          }
        } else {
          if (p.y > GROUND_LEVEL || p.x < -20 || p.x > LOGICAL_WIDTH + 20) {
            if (p.y >= GROUND_LEVEL && p.x >= 0 && p.x <= LOGICAL_WIDTH) {
              if (p.type === 'rain' && state.particles.length < 80) {
                state.particles.push({
                  x: p.x,
                  y: GROUND_LEVEL,
                  vx: (Math.random() - 0.5) * 1.5,
                  vy: -1.0 - Math.random() * 1.2,
                  size: 1 + Math.random() * 1.5,
                  color: 'rgba(156, 204, 219, 0.6)',
                  alpha: 0.8,
                  life: 0,
                  maxLife: 8 + Math.random() * 6,
                  type: 'dust',
                });
              } else if (p.type === 'cherry' && state.particles.length < 80) {
                state.particles.push({
                  x: p.x,
                  y: GROUND_LEVEL,
                  vx: -0.2 - Math.random() * 0.4,
                  vy: -0.1,
                  size: p.size * 0.7,
                  color: 'rgba(244, 114, 182, 0.45)',
                  alpha: 0.6,
                  life: 0,
                  maxLife: 25 + Math.random() * 20,
                  type: 'dust',
                });
              }
            }
            deadWeather.push(idx);
          }
        }
      });
      state.weatherParticles = state.weatherParticles.filter((_, i) => !deadWeather.includes(i));

      // Update Particles
      const deadParticles: number[] = [];
      state.particles.forEach((part, idx) => {
        part.life += dt;
        part.x += part.vx * dt;
        part.y += part.vy * dt;
        // Apply micro gravity to feathers
        if (part.type === 'feather') {
          part.vy += 0.08 * dt;
          part.vx *= Math.pow(0.98, dt);
          if (part.angle !== undefined && part.spinSpeed !== undefined) {
            part.angle += part.spinSpeed * dt;
          }
        }
        part.alpha = 1 - (part.life / part.maxLife);

        if (part.life >= part.maxLife) {
          deadParticles.push(idx);
        }
      });
      state.particles = state.particles.filter((_, i) => !deadParticles.includes(i));

      // Emit continuous small cosmetic trail when playing
      if (state.gameState === 'PLAYING' && state.ticks % 3 === 0) {
        state.particles.push({
          x: BIRD_X - 6,
          y: state.birdY + (Math.random() - 0.5) * 6,
          vx: -1.2,
          vy: (Math.random() - 0.5) * 0.5,
          size: 2 + Math.random() * 3,
          color: theme.particleColor,
          alpha: 0.8,
          life: 0,
          maxLife: 15 + Math.random() * 10,
          type: 'dust',
        });
      }

      // --- DRAWN RENDERING (CANVAS COMPOSER) ---
      ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Camera shake transformation
      ctx.save();
      if (state.screenShake > 0) {
        const dx = (Math.random() - 0.5) * 8;
        const dy = (Math.random() - 0.5) * 8;
        ctx.translate(dx, dy);
      }

      // 1. SKY / BACKGROUND
      ctx.fillStyle = theme.skyColor;
      ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);

      // Night Stars
      if (theme.starry) {
        ctx.fillStyle = '#ffffff';
        state.stars.forEach(star => {
          ctx.save();
          ctx.globalAlpha = star.alpha;
          ctx.fillRect(star.x, star.y, star.size, star.size);
          ctx.restore();
        });

        // Draw a scenic crescent Moon
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(380, 80, 24, 0, Math.PI * 2);
        ctx.fill();
        // subtraction circle for shadow cutout
        ctx.fillStyle = theme.skyColor;
        ctx.beginPath();
        ctx.arc(368, 76, 24, 0, Math.PI * 2);
        ctx.fill();
      }

      // Sun (if Daytime theme)
      if (theme.id === 'RETRO_DAY') {
        const radGrd = ctx.createRadialGradient(400, 80, 5, 400, 80, 40);
        radGrd.addColorStop(0, '#fef08a');
        radGrd.addColorStop(0.3, '#fef08a');
        radGrd.addColorStop(1, 'rgba(253, 242, 203, 0)');
        ctx.fillStyle = radGrd;
        ctx.beginPath();
        ctx.arc(400, 80, 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Synthwave Sun and grid
      if (theme.id === 'NEON_CITY') {
        // Neon grid floor lines
        ctx.strokeStyle = '#311042';
        ctx.lineWidth = 1;
        const gridHorizon = 320;
        for (let x = -100; x < LOGICAL_WIDTH + 100; x += 40) {
          ctx.beginPath();
          ctx.moveTo(LOGICAL_WIDTH / 2, gridHorizon);
          ctx.lineTo(x, GROUND_LEVEL);
          ctx.stroke();
        }
        for (let y = gridHorizon; y < GROUND_LEVEL; y += 30) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(LOGICAL_WIDTH, y);
          ctx.stroke();
        }

        // Draw neon synthwave hot sun
        const sunRadius = 70;
        const sunX = LOGICAL_WIDTH / 2;
        const sunY = 220;
        const grad = ctx.createLinearGradient(0, sunY - sunRadius, 0, sunY + sunRadius);
        grad.addColorStop(0, '#f43f5e'); // rose 500
        grad.addColorStop(0.5, '#ec4899'); // pink-500
        grad.addColorStop(1, '#eab308'); // yellow 500
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
        ctx.fill();

        // Slice horizontal lines into the synthwave sun
        ctx.fillStyle = theme.skyColor;
        for (let i = sunY - 20; i < sunY + sunRadius; i += 12) {
          const sliceHeight = 1 + (i - sunY) * 0.05;
          ctx.fillRect(sunX - sunRadius - 10, i, (sunRadius + 10) * 2, sliceHeight);
        }
      }

      // 2. CLOUDS
      ctx.fillStyle = theme.cloudColor;
      
      // Sort clouds by depth to ensure back clouds are drawn before front clouds
      const sortedClouds = [...state.clouds].sort((a, b) => a.depth - b.depth);
      
      sortedClouds.forEach(cloud => {
        ctx.save();
        // Fainter/softer in the back (atmospheric haze perspective effect)
        const maxAlpha = theme.id === 'RETRO_NIGHT' ? 0.35 : 0.85;
        // Varying cloud density by scaling transparency based on densityFactor & difficulty
        ctx.globalAlpha = Math.min(0.98, (0.25 + cloud.depth * 0.75) * maxAlpha * (0.3 + densityFactor * 0.7) * cloudDensityMul);
        
        // Sizing of clouds shifts slightly over time with density factor & difficulty scaling
        const difficultyScale = 0.75 + 0.25 * cloudDensityMul; // Sparser/smaller on EASY, thicker/larger on HARDCORE
        const weatherScale = (0.8 + 0.3 * densityFactor) * difficultyScale;
        const w = cloud.width * weatherScale;
        const h = cloud.height * weatherScale;

        // Cute multi-circle vector cloud
        ctx.beginPath();
        ctx.arc(cloud.x, cloud.y, h * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x + w * 0.3, cloud.y - h * 0.2, h, 0, Math.PI * 2);
        ctx.arc(cloud.x + w * 0.65, cloud.y + h * 0.1, h * 0.8, 0, Math.PI * 2);
        ctx.arc(cloud.x + w * 0.35, cloud.y + h * 0.4, h * 0.7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // 3. PIPES
      state.pipes.forEach(pipe => {
        // --- Render Top Pipe ---
        drawCylinder(ctx, pipe.x, 0, pipe.width, pipe.topHeight, true, theme);

        // --- Render Bottom Pipe ---
        const bY = GROUND_LEVEL - pipe.bottomHeight;
        drawCylinder(ctx, pipe.x, bY, pipe.width, pipe.bottomHeight, false, theme);
      });

      // 4. PARTICLES TRAIL
      state.particles.forEach(part => {
        ctx.save();
        ctx.globalAlpha = part.alpha;
        ctx.fillStyle = part.color;

        if (part.type === 'feather') {
          // Draw a little feather teardrop/oval
          ctx.beginPath();
          const angle = part.angle !== undefined ? part.angle : Math.atan2(part.vy, part.vx);
          ctx.ellipse(part.x, part.y, part.size, part.size * 0.5, angle, 0, Math.PI * 2);
          ctx.fill();
        } else if (part.type === 'star') {
          // Sparkle star
          ctx.beginPath();
          ctx.moveTo(part.x, part.y - part.size);
          ctx.lineTo(part.x + part.size * 0.4, part.y - part.size * 0.4);
          ctx.lineTo(part.x + part.size, part.y);
          ctx.lineTo(part.x + part.size * 0.4, part.y + part.size * 0.4);
          ctx.lineTo(part.x, part.y + part.size);
          ctx.lineTo(part.x - part.size * 0.4, part.y + part.size * 0.4);
          ctx.lineTo(part.x - part.size, part.y);
          ctx.lineTo(part.x - part.size * 0.4, part.y - part.size * 0.4);
          ctx.closePath();
          ctx.fill();
        } else {
          // Dust bubble
          ctx.beginPath();
          ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      // 5. BIRD (THE PROTAGONIST)
      ctx.save();
      ctx.translate(BIRD_X, state.birdY);
      ctx.rotate(state.birdRotation);

      // Procedural Birds drawing
      // Draw Body
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#1e293b'; // general dark border
      ctx.fillStyle = skin.bodyColor;
      ctx.beginPath();
      ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Wing (Flapping motion based on ticks, enhanced with dynamic jump physics and rotation)
      ctx.save();
      
      // Move to wing's attachment joint pivot on the bird's body
      const wingPivotX = -5;
      const wingPivotY = 1;
      ctx.translate(wingPivotX, wingPivotY);

      // Determine key variables based on game state and physical vertical velocity
      let flapOffset = 0;
      let wingRotation = -Math.PI / 12; // Default base wing angle
      let wingScaleY = 1.0;

      const activeConfig = DIFFICULTY_PRESETS[state.difficulty] || DIFFICULTY_PRESETS.NORMAL;
      const velocity = state.birdVelocity;

      // Calculate jump intensity based on active upward flight progression
      const maxJumpForce = Math.abs(activeConfig.jumpForce || 7.5);
      const jumpIntensity = (state.gameState === 'PLAYING' && velocity < 0)
        ? Math.min(1.0, Math.max(0, -velocity / maxJumpForce))
        : 0;

      if (state.gameState === 'PLAYING') {
        if (jumpIntensity > 0) {
          // Pronounced rapid wing flap cycle during jump ascent
          const freq = 0.55; // Much faster flapping frequency when thrusting
          flapOffset = Math.sin(state.ticks * freq) * (6 + jumpIntensity * 10);

          // Slight rotation change for the wing object itself during jumps
          // Create an active tilting motion to mimic air pressure resistance pushing up/down on the feathers
          wingRotation = -Math.PI / 8 - (jumpIntensity * Math.PI / 3) * Math.sin(state.ticks * freq * 1.5);
          
          // Physical thickness scaling for a cartoonish stretch-and-squash aerodynamic shape
          wingScaleY = 1.0 + Math.abs(flapOffset) * 0.04;
        } else {
          // Standard relaxed cruising flap
          const freq = 0.3;
          flapOffset = Math.sin(state.ticks * freq) * 6;
          // Gentle tilt as it glides/cruises
          wingRotation = -Math.PI / 12 + Math.sin(state.ticks * freq) * 0.15;
          wingScaleY = 1.0 + Math.abs(flapOffset) * 0.02;
        }
      } else {
        // Slow gentle idling flap on start menu
        flapOffset = Math.sin(state.ticks * 0.08) * 3;
        wingRotation = -Math.PI / 12;
      }

      // Apply the rotation directly to the wing object at its pivot
      ctx.rotate(wingRotation);

      ctx.fillStyle = skin.wingColor;
      ctx.beginPath();
      
      // Render the custom dynamic oval wing silhouette
      const wingWidth = BIRD_RADIUS * 0.72;
      const wingHeight = (BIRD_RADIUS * 0.42 + Math.abs(flapOffset) * 0.18) * wingScaleY;

      ctx.ellipse(
        0, 
        flapOffset * 0.3, 
        wingWidth, 
        wingHeight, 
        0, 
        0, 
        Math.PI * 2
      );
      
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // Beak
      ctx.fillStyle = skin.beakColor;
      ctx.beginPath();
      // Top beak
      ctx.moveTo(BIRD_RADIUS - 2, -4);
      ctx.lineTo(BIRD_RADIUS + 9, 0);
      ctx.lineTo(BIRD_RADIUS - 1, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      // Bottom beak
      ctx.moveTo(BIRD_RADIUS - 3, 0);
      ctx.lineTo(BIRD_RADIUS + 5, 2);
      ctx.lineTo(BIRD_RADIUS - 2, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Large Eye
      ctx.fillStyle = skin.eyeColor;
      ctx.beginPath();
      ctx.arc(5, -4, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (state.gameState === 'GAMEOVER') {
        // Red dead 'X' with black outlines for maximum clarity & aesthetic polish
        const centerX = 5;
        const centerY = -4;
        const size = 3;

        // Black outer backing shadow line for high contrast
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3.0;
        ctx.lineCap = 'round';
        
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.moveTo(centerX + size, centerY - size);
        ctx.lineTo(centerX - size, centerY + size);
        ctx.stroke();

        // Crimson red foreground 'X' line
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.6;
        
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.moveTo(centerX + size, centerY - size);
        ctx.lineTo(centerX - size, centerY + size);
        ctx.stroke();
      } else {
        // Pupil
        ctx.fillStyle = skin.accentColor;
        ctx.beginPath();
        // Looks forward
        ctx.arc(6.5, -4, 2.2, 0, Math.PI * 2);
        ctx.fill();

        // Tiny white eye reflection sparkle
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(5.5, -5.2, 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      // Extra skins flavor:
      // Dracula bat ears or mini-crown
      if (skin.id === 'BAT_DRAC') {
        // draw vampire bat ears
        ctx.fillStyle = '#1e1917';
        // Left Ear
        ctx.beginPath();
        ctx.moveTo(-10, -12);
        ctx.lineTo(-4, -22);
        ctx.lineTo(-1, -14);
        ctx.fill();
        ctx.stroke();
        // Right Ear
        ctx.beginPath();
        ctx.moveTo(-5, -13);
        ctx.lineTo(1, -21);
        ctx.lineTo(3, -13);
        ctx.fill();
        ctx.stroke();
      }

      ctx.restore();

      // --- DRAW WEATHER PARTICLES ---
      state.weatherParticles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;

        if (p.type === 'rain') {
          // Wet aesthetic slanted streak
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          // slant raindrop streak in movement direction
          ctx.lineTo(p.x + p.vx * 1.5, p.y + p.vy * 1.5);
          ctx.stroke();
        } else if (p.type === 'snow') {
          // Fluffy snowing circles
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'cherry') {
          // Petal with dynamic rotation
          ctx.fillStyle = p.color;
          ctx.translate(p.x, p.y);
          ctx.rotate(p.wobble * 0.7);
          ctx.beginPath();
          // oval petal
          ctx.ellipse(0, 0, p.size, p.size * 0.52, 0, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.type === 'cyber') {
          // Glow cyber sparks
          ctx.fillStyle = p.color;
          ctx.shadowColor = p.color;
          ctx.shadowBlur = 6;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
        }

        ctx.restore();
      });

      // 6. SCROLLING GROUND FLOOR
      // Draw underground
      ctx.fillStyle = theme.groundColor;
      ctx.fillRect(0, GROUND_LEVEL, LOGICAL_WIDTH, LOGICAL_HEIGHT - GROUND_LEVEL);

      // Draw top grass layer
      ctx.fillStyle = theme.groundGrassColor;
      ctx.fillRect(0, GROUND_LEVEL, LOGICAL_WIDTH, 14);

      // Draw soil detail lines or checkered stripes that scroll
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      const stripWidth = 12;
      for (let x = state.groundX - stripWidth; x < LOGICAL_WIDTH + stripWidth * 2; x += stripWidth * 2) {
        ctx.beginPath();
        ctx.moveTo(x, GROUND_LEVEL + 14);
        ctx.lineTo(x - 8, GROUND_LEVEL + 40);
        ctx.stroke();
      }

      // Nice crisp border parting ground and sky
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, GROUND_LEVEL);
      ctx.lineTo(LOGICAL_WIDTH, GROUND_LEVEL);
      ctx.stroke();

      // 7. FLASH IMPACT OVERLAY
      if (state.flashOpaque > 0) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${state.flashOpaque})`;
        ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
        ctx.restore();
      }

      ctx.restore(); // Camera shake save-point restor

      // Continue update and render recursively
      animationFrameId = requestAnimationFrame(updateAndRender);
    };

    // Helper drawing routine for columns/pipes
    function drawCylinder(
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      isTop: boolean,
      theme: typeof THEMES[0]
    ) {
      ctx.save();
      
      // Neon glow shadow backer if configured
      if (theme.neonGlow) {
        ctx.shadowColor = theme.pipeColor;
        ctx.shadowBlur = 15;
      }

      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#1e293b'; // black border outline

      // Fill main pipe barrel
      ctx.fillStyle = theme.pipeColor;
      ctx.fillRect(x, y, width, height);

      // Create highlight gradient across x-axis to make it look 3D cylindrical!
      const lightGrad = ctx.createLinearGradient(x, 0, x + width, 0);
      lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      lightGrad.addColorStop(0.15, 'rgba(255, 255, 255, 0.35)'); // shine
      lightGrad.addColorStop(0.3, 'rgba(255, 255, 255, 0.1)');
      lightGrad.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      lightGrad.addColorStop(0.9, 'rgba(0, 0, 0, 0.35)'); // shadow
      ctx.fillStyle = lightGrad;
      ctx.fillRect(x, y, width, height);

      // Draw cylinder border lines on left and right borders of barrel
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + height);
      ctx.moveTo(x + width, y);
      ctx.lineTo(x + width, y + height);
      ctx.stroke();

      // Draw secondary vertical texture stripes of classic pipe Look
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + width * 0.1, y);
      ctx.lineTo(x + width * 0.1, y + height);
      ctx.moveTo(x + width * 0.85, y);
      ctx.lineTo(x + width * 0.85, y + height);
      ctx.stroke();

      // --- Draw Pipe Lip Cap (Lip is slightly wider than column) ---
      const lipHeight = 28;
      const lipOvershoot = 5;
      const lipX = x - lipOvershoot;
      const lipWidth = width + lipOvershoot * 2;
      
      // Lip Y coordinate is on the border edge
      const lipY = isTop ? (y + height - lipHeight) : y;

      ctx.shadowBlur = 0; // reset shadow for flat border look
      ctx.lineWidth = 2.8;
      ctx.strokeStyle = '#1e293b';
      ctx.fillStyle = theme.pipeColor;
      ctx.fillRect(lipX, lipY, lipWidth, lipHeight);

      // 3D Highlight on Pipe Lip
      const lipLightGrad = ctx.createLinearGradient(lipX, 0, lipX + lipWidth, 0);
      lipLightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
      lipLightGrad.addColorStop(0.18, 'rgba(255, 255, 255, 0.45)'); // shine
      lipLightGrad.addColorStop(0.35, 'rgba(255, 255, 255, 0.12)');
      lipLightGrad.addColorStop(0.75, 'rgba(0, 0, 0, 0)');
      lipLightGrad.addColorStop(0.92, 'rgba(0, 0, 0, 0.4)'); // shadow
      ctx.fillStyle = lipLightGrad;
      ctx.fillRect(lipX, lipY, lipWidth, lipHeight);

      // Draw border outline around Lip rect
      ctx.fillStyle = theme.pipeLipColor;
      // top or bottom lip ring detail
      if (isTop) {
        ctx.fillRect(lipX, lipY + lipHeight - 5, lipWidth, 5); // bottom lip dark divider
      } else {
        ctx.fillRect(lipX, lipY, lipWidth, 5); // top lip dark divider
      }

      ctx.strokeRect(lipX, lipY, lipWidth, lipHeight);

      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(updateAndRender);
    return () => cancelAnimationFrame(animationFrameId);
  }, [onScoreChange, onGameOver, onGameStart]);

  // Unified pointer/touch interaction handler
  const handleInteraction = (e: React.SyntheticEvent) => {
    if (e.type === 'touchstart') {
      e.preventDefault();
    }
    e.stopPropagation();
    const now = Date.now();
    if (now - lastFlapTime.current < 45) return;
    lastFlapTime.current = now;
    handleFlap();
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center">
      {/* Tap / Click Area container */}
      <div 
        id="game-clickbar"
        ref={containerRef}
        onPointerDown={handleInteraction}
        onTouchStart={handleInteraction}
        className="relative overflow-hidden bg-slate-950 cursor-pointer select-none transition-all duration-300 w-full max-w-[100vw] sm:max-w-[440px] aspect-[3/4] h-auto max-h-[72vh] sm:max-h-[78vh] md:max-h-[82vh] rounded-2xl border-4 border-white/50 shadow-2xl mx-auto shadow-black/45 touch-none flex flex-col justify-center items-center landscape:max-h-none landscape:h-full landscape:w-full landscape:max-w-none landscape:aspect-auto landscape:rounded-none landscape:border-0"
      >
        <canvas
          ref={canvasRef}
          width={dimensions.logicalWidth}
          height={dimensions.logicalHeight}
          className="w-full h-full block flex-1"
          style={{ imageRendering: 'pixelated', objectFit: 'fill' }}
        />

        {/* Start Game Instructions overlay - sits nicely over static canvas */}
        {(gameState === 'START' || (gameState === 'PLAYING' && !hasStartedFlying)) && (
          <div className="absolute inset-0 bg-black/15 flex flex-col items-center justify-end pb-12 pointer-events-none select-none animate-pulse">
            <div className="text-white text-center drop-shadow-[0_2.5px_4px_rgba(0,0,0,0.85)] font-sans px-4">
              <span className="bg-white/40 backdrop-blur-md px-6 py-2.5 rounded-full text-xs font-black tracking-widest border border-white/55 uppercase text-slate-950 shadow-md">
                Tap anywhere to fly!
              </span>
              <p className="text-slate-950 font-black text-xs mt-3.5 font-mono drop-shadow-[0_1.2px_1px_rgba(255,255,255,0.8)]">
                Press Space / arrow-Up on Desktop
              </p>
            </div>
          </div>
        )}

        {/* Pause HUD Indicator */}
        {gameState === 'PAUSED' && (
          <div className="absolute inset-0 bg-white/20 backdrop-blur-md flex flex-col items-center justify-center pointer-events-auto">
            <span className="text-slate-950 text-3xl font-black tracking-widest font-sans animate-bounce drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)]">
              PAUSED
            </span>
            <p className="text-slate-900 font-extrabold text-xs mt-2 font-mono">
              Tap screen to resume action
            </p>
          </div>
        )}

        {/* Game Over elegant glass HUD overlay */}
        {gameState === 'GAMEOVER' && (
          <div 
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-xs flex flex-col items-center justify-between p-5 landscape:p-2 select-none z-30"
          >
            {/* Header section with collision badge */}
            <div className="text-center space-y-1 landscape:space-y-0 mt-1 landscape:mt-0 shrink-0">
              <span className="inline-block bg-rose-500/25 border border-rose-500/40 text-rose-200 px-3 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest font-mono landscape:text-[7.5px] landscape:py-0">
                Grounded!
              </span>
              <h2 className="text-2.5xl landscape:text-lg font-black text-rose-400 drop-shadow-[0_2px_3px_rgba(0,0,0,0.85)] uppercase tracking-wide leading-tight">
                Flight Over
              </h2>
            </div>

            {/* Content box showing Score achievements & Medals */}
            <div className="w-full max-w-[270px] bg-white/20 backdrop-blur-md border border-white/25 rounded-2xl p-3.5 landscape:p-2 landscape:rounded-xl flex flex-col gap-2.5 landscape:gap-1 shadow-lg">
              <div className="grid grid-cols-2 gap-2 landscape:gap-1 text-center">
                <div className="bg-black/25 p-1.5 landscape:p-1 rounded-xl landscape:rounded-md border border-white/10">
                  <p className="text-[8.5px] landscape:text-[7px] uppercase tracking-wider text-slate-300 font-bold font-mono">Score</p>
                  <p className="text-xl landscape:text-sm font-black font-mono text-white">{score}</p>
                </div>
                <div className="bg-black/25 p-1.5 landscape:p-1 rounded-xl landscape:rounded-md border border-white/10 relative overflow-hidden">
                  <p className="text-[8.5px] landscape:text-[7px] uppercase tracking-wider text-slate-300 font-bold font-mono">Best</p>
                  <p className="text-xl landscape:text-sm font-black font-mono text-white">{highScore}</p>
                  {isNewHighScore && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </div>
              </div>

              {/* Medal award system display */}
              {(() => {
                const getMedalSec = (pts: number) => {
                  if (pts >= 100) return { name: 'Platinum', symbol: '🏆' };
                  if (pts >= 50) return { name: 'Gold', symbol: '🥇' };
                  if (pts >= 25) return { name: 'Silver', symbol: '🥈' };
                  if (pts >= 10) return { name: 'Bronze', symbol: '🥉' };
                  return null;
                };
                const medalVal = getMedalSec(score);
                if (medalVal) {
                  return (
                    <div className="bg-black/20 p-2 landscape:p-1 rounded-xl landscape:rounded-md border border-white/10 flex items-center justify-center gap-1.5">
                      <span className="text-xl landscape:text-base animate-bounce">{medalVal.symbol}</span>
                      <div className="text-left font-sans">
                        <p className="text-[7.5px] landscape:text-[6px] font-mono text-slate-300 uppercase leading-none font-black">Medal Awarded</p>
                        <p className="text-[10px] landscape:text-[8px] font-black text-white leading-none mt-1">{medalVal.name} Medal</p>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-[9px] landscape:text-[7.5px] text-center text-slate-200 font-medium font-sans">
                      Reach <span className="font-extrabold text-white">10 score</span> for Bronze Medal!
                    </div>
                  );
                }
              })()}

              {isNewHighScore && (
                <div className="bg-emerald-500/25 border border-emerald-500/35 rounded-lg py-0.5 text-center text-[8.5px] landscape:text-[7px] font-bold font-mono text-emerald-200 tracking-wider">
                  🎉 NEW PERSONAL BEST! 🎉
                </div>
              )}
            </div>

            {/* Clean, translucent CTA light style Buttons matching requirements */}
            <div className="w-full max-w-[270px] flex flex-col gap-2 landscape:gap-1 mb-1.5 landscape:mb-0 font-sans">
              
              {/* BUTTON 1: TRY AGAIN (styled identical to 'Tap anywhere to fly' banner with tap scale animations) */}
              <motion.button
                id="play-again-btn"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onGameStart();
                  sfx.playJump();
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  e.stopPropagation();
                  onGameStart();
                  sfx.playJump();
                }}
                className="w-full py-2.5 landscape:py-1.5 bg-white/45 hover:bg-white/60 text-slate-950 border border-white/60 backdrop-blur-md rounded-full text-[10px] landscape:text-[8.5px] font-black uppercase tracking-widest cursor-pointer shadow-md flex items-center justify-center gap-1.5 outline-none duration-150 transition-colors"
                title="Restart gameplay"
              >
                <Play className="w-3 h-3 fill-slate-950 stroke-slate-950 text-slate-950 animate-pulse" />
                <span>PLAY AGAIN</span>
              </motion.button>

              {/* BUTTON 2: EXIT TO MENU / HOME (styled in premium secondary glass) */}
              <motion.button
                id="home-btn"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.96 }}
                onTouchStart={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onResetToStart();
                  sfx.playPoint();
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  e.stopPropagation();
                  onResetToStart();
                  sfx.playPoint();
                }}
                className="w-full py-2 landscape:py-1 bg-black/35 hover:bg-black/45 text-slate-100 border border-white/20 backdrop-blur-xs rounded-full text-[9px] landscape:text-[8px] font-bold uppercase tracking-widest cursor-pointer shadow-sm flex items-center justify-center gap-1.5 outline-none duration-150 transition-colors"
              >
                <Home className="w-3 h-3 text-slate-200" />
                <span>Home & customize</span>
              </motion.button>

              {/* PULSE TUTORIAL CALLOUT */}
              <p className="text-center text-[8px] text-slate-300 font-bold font-mono tracking-wide mt-1 landscape:mt-0 landscape:hidden uppercase leading-none drop-shadow">
                Tap on the action buttons above
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
