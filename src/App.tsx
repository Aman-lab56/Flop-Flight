/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Volume2, 
  VolumeX, 
  Trophy, 
  Play, 
  RotateCcw, 
  Sparkles, 
  Flame, 
  TrendingUp,
  Award,
  Calendar,
  Gamepad2,
  X,
  Plus,
  Lock
} from 'lucide-react';

import { GameState, DifficultyLevel, ThemeId, BirdSkinId, ScoreRecord } from './types';
import { THEMES, SKINS, DIFFICULTY_PRESETS } from './constants';
import GameCanvas from './components/GameCanvas';
import { sfx } from './audio';

export default function App() {
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('NORMAL');
  const [themeId, setThemeId] = useState<ThemeId>('RETRO_DAY');
  const [skinId, setSkinId] = useState<BirdSkinId>('CLASSIC_YEL');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Audio visual notification/feedback states
  const [rippleCount, setRippleCount] = useState<number>(0);
  const [toastText, setToastText] = useState<string>('');
  const [showToast, setShowToast] = useState<boolean>(false);
  
  // Historical scores
  const [scoreHistory, setScoreHistory] = useState<ScoreRecord[]>([]);
  const [highScore, setHighScore] = useState<number>(0);
  const [isNewHighScore, setIsNewHighScore] = useState<boolean>(false);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Load scores on component mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('flappy_score_history');
      if (stored) {
        const parsed = JSON.parse(stored) as ScoreRecord[];
        setScoreHistory(parsed);
        if (parsed.length > 0) {
          const max = Math.max(...parsed.map(r => r.score));
          setHighScore(max);
        }
      }
    } catch (e) {
      console.error('Failed to load local storage scores', e);
    }
  }, []);

  // Update current sound state
  useEffect(() => {
    sfx.setSoundEnabled(soundEnabled);
  }, [soundEnabled]);

  // Fallback if current theme becomes locked
  useEffect(() => {
    if (themeId === 'NEON_CITY' && highScore < 50) {
      setThemeId('RETRO_DAY');
    } else if (themeId === 'CUTE_GARDEN' && highScore < 100) {
      setThemeId('RETRO_DAY');
    }
  }, [highScore, themeId]);

  const handleGameStart = () => {
    setScore(0);
    setIsNewHighScore(false);
    setGameState('PLAYING');
  };

  const handleScoreChange = (newScore: number) => {
    setScore(newScore);
  };

  const handleGameOver = (finalScore: number) => {
    setGameState('GAMEOVER');

    // Calculate if it's a new personal high score
    const currentHighForDifficulty = scoreHistory
      .filter(r => r.difficulty === difficulty)
      .reduce((max, r) => r.score > max ? r.score : max, 0);

    const isNewBest = finalScore > currentHighForDifficulty || scoreHistory.length === 0;
    setIsNewHighScore(isNewBest);

    // Save score to history
    const record: ScoreRecord = {
      score: finalScore,
      date: new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      difficulty,
      skin: SKINS.find(s => s.id === skinId)?.name || 'Unknown',
    };

    const newHistory = [record, ...scoreHistory].slice(0, 50); // limit to last 50 games
    setScoreHistory(newHistory);
    
    // Global high score
    const overallMax = Math.max(finalScore, highScore);
    setHighScore(overallMax);

    try {
      localStorage.setItem('flappy_score_history', JSON.stringify(newHistory));
    } catch (e) {
      console.warn('Could not store high score record locally', e);
    }
  };

  const handleResetToStart = () => {
    setScore(0);
    setIsNewHighScore(false);
    setGameState('START');
  };

  // Automatically fade out the toast message after 1.2 seconds
  useEffect(() => {
    if (showToast) {
      const timer = setTimeout(() => setShowToast(false), 1200);
      return () => clearTimeout(timer);
    }
  }, [showToast, toastText]);

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent triggering a flap
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    
    // Reset toast state to trigger entry transitions cleanly
    setShowToast(false);
    setTimeout(() => {
      setToastText(nextState ? '🔊 SOUND ON' : '🔇 MUTED');
      setShowToast(true);
    }, 15);

    if (nextState) {
      setRippleCount(prev => prev + 1);
    }
  };

  const getMedal = (pts: number) => {
    if (pts >= 100) return { name: 'Platinum', color: 'from-slate-200 to-indigo-100 border-indigo-300 text-indigo-700', symbol: '🏆', desc: 'Arcade Legend!' };
    if (pts >= 50) return { name: 'Gold', color: 'from-amber-200 to-yellow-100 border-yellow-400 text-amber-800', symbol: '🥇', desc: 'Master Flapper!' };
    if (pts >= 25) return { name: 'Silver', color: 'from-zinc-300 to-slate-100 border-zinc-400 text-zinc-700', symbol: '🥈', desc: 'Expert Aviator!' };
    if (pts >= 10) return { name: 'Bronze', color: 'from-amber-500 to-amber-300 border-amber-600 text-amber-900', symbol: '🥉', desc: 'Skilled Cadet!' };
    return null;
  };

  const currentMedal = getMedal(score);
  const currentTheme = THEMES.find(t => t.id === themeId) || THEMES[0];
  const bodyBgColor = themeId === 'DYNAMIC_CYCLE' ? '#4b578c' : currentTheme.skyColor;

  // Clear history function
  const clearHistory = () => {
    try {
      localStorage.removeItem('flappy_score_history');
      setScoreHistory([]);
      setHighScore(0);
      setThemeId('RETRO_DAY');
      setShowHistoryModal(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div 
      className={`w-full text-slate-900 font-sans flex flex-col justify-between overflow-x-hidden relative transition-colors duration-500 ease-out selection:bg-rose-500 selection:text-white ${
        gameState !== 'START' ? 'h-[100dvh] sm:min-h-screen overflow-hidden' : 'min-h-screen'
      }`}
      style={{ backgroundColor: bodyBgColor }}
    >
      
      {/* Decorative ambient glass background clouds matching design theme */}
      <div className="absolute top-20 left-12 w-32 h-16 bg-white opacity-80 rounded-full blur-md pointer-events-none -z-10 animate-pulse" />
      <div className="absolute top-32 left-[40%] w-48 h-20 bg-white opacity-60 rounded-full blur-lg pointer-events-none -z-10" />
      <div className="absolute top-16 right-16 w-40 h-16 bg-white opacity-70 rounded-full blur-md pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-24 left-[15%] w-36 h-20 bg-white opacity-65 rounded-full blur-lg pointer-events-none -z-10" />
      <div className="absolute bottom-40 right-20 w-44 h-18 bg-white opacity-70 rounded-full blur-md pointer-events-none -z-10" />

      {/* HEADER BAR */}
      <header className={`w-full max-w-7xl mx-auto px-4 py-4 flex items-center justify-between border-b border-white/20 pb-3 z-10 text-slate-950 ${gameState !== 'START' ? 'hidden sm:flex' : 'flex'}`}>
        <div className="flex items-center gap-2">
          <Gamepad2 className="w-5 h-5 text-slate-950" />
          <span className="font-mono font-black text-base tracking-wider text-slate-950">
            FLOP<span className="text-white drop-shadow-[0_1.5px_1px_rgba(0,0,0,0.35)]">FLIGHT</span>
          </span>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.button
            id="header-score-board-btn"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHistoryModal(true)}
            className="px-4 py-1.5 rounded-full bg-white/30 backdrop-blur-md border border-white/40 shadow-xs hover:bg-white/50 text-slate-950 font-bold uppercase tracking-widest text-[10px] font-mono flex items-center gap-1 transition-all cursor-pointer outline-none"
            title="View Score Board"
          >
            <Trophy className="w-3.5 h-3.5 text-amber-900/85" />
            <span>Score Board</span>
          </motion.button>

          <div className="relative flex items-center justify-center">
            {/* Concentric ripple wave effects on unmuter toggle */}
            <AnimatePresence>
              {soundEnabled && rippleCount > 0 && (
                <motion.div
                  key={`wave-1-${rippleCount}`}
                  initial={{ scale: 0.8, opacity: 0.9 }}
                  animate={{ scale: 2.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  className="absolute inset-0 rounded-full border border-blue-400/80 bg-blue-300/15 pointer-events-none z-0"
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {soundEnabled && rippleCount > 0 && (
                <motion.div
                  key={`wave-2-${rippleCount}`}
                  initial={{ scale: 0.8, opacity: 0.7 }}
                  animate={{ scale: 3.5, opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.85, ease: 'easeOut', delay: 0.08 }}
                  className="absolute inset-0 rounded-full border border-cyan-400/60 bg-cyan-200/5 pointer-events-none z-0"
                />
              )}
            </AnimatePresence>

            {/* Float visual toast indicator feedback */}
            <AnimatePresence>
              {showToast && (
                <motion.div
                  key={toastText}
                  initial={{ opacity: 0, y: 15, scale: 0.85 }}
                  animate={{ opacity: 1, y: -28, scale: 1 }}
                  exit={{ opacity: 0, y: -42, scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 20 }}
                  className="absolute whitespace-nowrap bg-slate-900 shadow-md text-white font-mono font-bold text-[9px] tracking-wider px-2 py-0.5 rounded pointer-events-none z-50 shadow-black/20"
                >
                  {toastText}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button
              id="header-sound-btn"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleSound}
              className={`p-1.5 rounded-full border shadow-xs transition-all cursor-pointer outline-none relative z-10 ${
                soundEnabled 
                  ? 'bg-white/40 border-white/40 text-slate-950 hover:bg-white/60' 
                  : 'bg-white/15 border-white/20 text-slate-500 hover:bg-white/25'
              }`}
              title={soundEnabled ? 'Mute Sounds' : 'Unmute Sounds'}
            >
              <AnimatePresence mode="wait">
                {soundEnabled ? (
                  <motion.div
                    key="sound-on"
                    initial={{ scale: 0.7, rotate: -15, opacity: 0 }}
                    animate={{ scale: 1, rotate: 0, opacity: 1 }}
                    exit={{ scale: 0.7, rotate: 15, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <Volume2 className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <motion.div
                    key="sound-off"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ 
                      scale: [1, 1.25, 0.9, 1.1, 1],
                      x: [0, -3.5, 3.5, -2, 2, 0],
                      opacity: 1
                    }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                  >
                    <VolumeX className="w-4 h-4 text-rose-500" />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </header>

      {/* PORTRAIT SCREEN BOARD - IMMERSIVE FULL VIEWPORT PRESENTATION */}
      <main className={`flex-1 w-full max-w-7xl mx-auto flex flex-col items-center justify-center relative z-10 ${gameState !== 'START' ? 'p-0 sm:p-4 h-full sm:h-auto' : 'px-4 py-4'}`}>
        
        {/* Core Center Frame Board (Positions canvas portrait panel) */}
        <div className={`w-full flex flex-col items-center justify-center relative ${gameState !== 'START' ? 'max-w-full sm:max-w-[440px] h-full sm:h-auto' : 'max-w-[440px]'}`}>
          
          {/* Active stats bar sitting directly on top of screen container */}
          <div className={`w-full flex items-center justify-between px-4 py-2 bg-white/25 font-mono text-xs text-slate-900 z-10 select-none ${gameState !== 'START' ? 'rounded-none sm:rounded-t-2xl border-b sm:border-x sm:border-t border-white/35' : 'border-x border-t border-white/35 rounded-t-2xl'}`}>
            <div className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${gameState === 'PLAYING' ? 'bg-emerald-600 animate-pulse' : 'bg-amber-600'}`} />
              <span className="text-[10px] tracking-wide font-black uppercase shrink-0">
                {gameState === 'START' && 'PRE-FLIGHT'}
                {gameState === 'PLAYING' && 'FLYING'}
                {gameState === 'PAUSED' && 'HOLD'}
                {gameState === 'GAMEOVER' && 'GROUNDED'}
              </span>
            </div>

            {/* In-game live score indicator banner */}
            {(gameState === 'PLAYING' || gameState === 'PAUSED' || gameState === 'GAMEOVER') && (
              <span className="font-bold text-slate-950 text-xs tracking-wider bg-white/45 px-2.5 py-0.5 rounded border border-white/50 shadow-xs">
                SCORE: {score}
              </span>
            )}
          </div>

          {/* Canvas Wrapper Component */}
          <div className="w-full relative flex-1 sm:flex-initial flex flex-col justify-center">
            <GameCanvas
              gameState={gameState}
              difficulty={difficulty}
              themeId={themeId}
              skinId={skinId}
              onScoreChange={handleScoreChange}
              onGameOver={handleGameOver}
              onGameStart={handleGameStart}
              onResume={() => setGameState('PLAYING')}
              onResetToStart={handleResetToStart}
              score={score}
              highScore={highScore}
              isNewHighScore={isNewHighScore}
              soundEnabled={soundEnabled}
            />

            {/* Quick in-game action panels for restart/pause on the screen side */}
            {gameState === 'PLAYING' && (
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                <button
                  id="pause-game-btn"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGameState('PAUSED');
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') return;
                    e.stopPropagation();
                    setGameState('PAUSED');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGameState('PAUSED');
                  }}
                  className="p-1 px-2.5 rounded bg-white/40 hover:bg-white/60 hover:text-slate-950 transition-all border border-white/45 text-[10px] font-mono text-slate-900 font-bold uppercase tracking-wider shadow cursor-pointer"
                  title="Pause gameplay"
                >
                  Pause
                </button>
              </div>
            )}

            {gameState === 'PAUSED' && (
              <div className="absolute top-4 left-4 flex gap-2 z-20">
                <button
                  id="resume-game-btn"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setGameState('PLAYING');
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') return;
                    e.stopPropagation();
                    setGameState('PLAYING');
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGameState('PLAYING');
                  }}
                  className="p-1 px-2.5 rounded bg-white/40 hover:bg-white/60 hover:text-slate-950 transition-all border border-white/45 text-[10px] font-mono text-slate-900 font-bold uppercase tracking-wider shadow cursor-pointer"
                  title="Resume gameplay"
                >
                  Resume
                </button>
              </div>
            )}

            {/* In-game instant reset shortcut button top-right */}
            {(gameState === 'PLAYING' || gameState === 'PAUSED') && (
              <div className="absolute top-4 right-4 z-20">
                <button
                  id="exit-game-btn"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleResetToStart();
                  }}
                  onPointerDown={(e) => {
                    if (e.pointerType === 'touch') return;
                    e.stopPropagation();
                    handleResetToStart();
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleResetToStart();
                  }}
                  className="p-1.5 rounded-md bg-white/40 hover:bg-white/60 text-slate-900 hover:text-rose-750 border border-white/45 transition-all cursor-pointer"
                  title="Exit to menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

      </main>

      {/* DEDICATED FLIGHT TERMINAL MENU (START SCREEN) */}
      <AnimatePresence>
        {gameState === 'START' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-md flex items-center justify-center p-4 z-40 overflow-y-auto"
          >
            <motion.div
              initial={{ scale: 0.93, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.93, y: 30 }}
              transition={{ type: 'spring', damping: 22, stiffness: 160 }}
              className="bg-white/75 backdrop-blur-2xl border border-white/40 shadow-2xl rounded-[32px] w-full max-w-xl p-5 md:p-7 flex flex-col space-y-5 text-slate-900 max-h-[92vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-300"
              onClick={(e) => {
                e.stopPropagation(); // absorbs standard clicks to prevent screen double flappings!
              }}
              onTouchStart={(e) => {
                e.stopPropagation(); // absorbs double fingers touches!
              }}
            >
              
              {/* Header Title / State representation */}
              <div className="text-center space-y-1">
                <div className="inline-flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 text-indigo-800 px-3.5 py-1 rounded-full text-[10px] font-mono font-black uppercase tracking-wider mx-auto">
                  <Sparkles className="w-3.5 h-3.5 animate-spin text-indigo-700" />
                  Frosted Aviation Terminal
                </div>
                <h1 className="text-3xl md:text-3xl font-black tracking-tight text-slate-950 leading-none">
                  FLOP<span className="text-blue-600 drop-shadow-[0_1px_1px_rgba(255,255,255,0.7)]">FLIGHT</span>
                </h1>
                <p className="text-slate-800 font-semibold text-[11px] max-w-sm mx-auto leading-relaxed">
                  Select your custom avian pilot, pick dynamic environment skies, calibrate the flight difficulty speed, and take to the skies!
                </p>
              </div>

              {/* 1. SELECT AVIAN PILOT SKIN GRID */}
              <div className="space-y-1.5">
                <h3 className="text-[10px] uppercase tracking-widest text-slate-950 font-mono font-black flex items-center gap-1.5">
                  <span>1. Select Avian Pilot Customisation</span>
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {SKINS.map((skin) => (
                    <motion.button
                      id={`skin-btn-${skin.id}`}
                      key={skin.id}
                      whileHover={{ scale: 1.02, y: -1 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => {
                        setSkinId(skin.id);
                        sfx.playJump();
                      }}
                      className={`relative p-2 rounded-xl border text-left flex flex-col justify-between h-20 transition-all cursor-pointer group select-none outline-none ${
                        skinId === skin.id
                          ? 'bg-white border-slate-950 shadow-md text-slate-940 scale-[1.01]'
                          : 'bg-white/30 border-white/20 hover:border-white/40 hover:bg-white/40 text-slate-800'
                      }`}
                    >
                      <span className="text-xl group-hover:scale-110 transition-transform">{skin.emoji}</span>
                      <div className="mt-1">
                        <p className="text-[9px] font-black text-slate-900 leading-none truncate">{skin.name}</p>
                        <div className="flex gap-1 mt-1 leading-none">
                          <span 
                            className="w-1.5 h-1.5 rounded-full inline-block border border-black/10"
                            style={{ backgroundColor: skin.bodyColor }}
                          />
                          <span 
                            className="w-1.5 h-1.5 rounded-full inline-block border border-black/10"
                            style={{ backgroundColor: skin.wingColor }}
                          />
                        </div>
                      </div>

                      {skinId === skin.id && (
                        <div className="absolute top-1 right-1 w-3.5 h-3.5 bg-slate-900 rounded-full flex items-center justify-center text-[8px] text-white font-bold font-mono shadow">
                          ✓
                        </div>
                      )}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* 2. SELECT ENVIRONMENT SKIES THEME */}
              <div className="space-y-1.5">
                <h3 className="text-[10px] uppercase tracking-widest text-slate-950 font-mono font-black">
                  2. Select Environment Skies Theme
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {/* Dynamic Day-Night Cycle Option */}
                  <motion.button
                    id="theme-btn-dynamic"
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setThemeId('DYNAMIC_CYCLE');
                      sfx.playPoint();
                    }}
                    className={`col-span-2 relative p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 select-none outline-none overflow-hidden ${
                      themeId === 'DYNAMIC_CYCLE'
                        ? 'bg-gradient-to-r from-sky-100 via-rose-100 to-indigo-150 border-slate-950 shadow-md text-slate-950 scale-[1.01] cursor-pointer font-bold'
                        : 'bg-white/30 border-white/20 hover:border-white/40 hover:bg-white/40 text-slate-800 cursor-pointer'
                    }`}
                  >
                    {/* Visual Animated Sunrise/Sunset Radial/Gradient Icon */}
                    <div className="w-6.5 h-6.5 rounded bg-gradient-to-tr from-cyan-400 via-pink-400 to-indigo-600 relative overflow-hidden shrink-0 border border-slate-350/20 shadow-xs flex items-center justify-center">
                      <div className="absolute inset-0 bg-black/10 animate-pulse duration-1000" />
                      {/* Sun/Moon overlapping visual ornament inside the icon */}
                      <div className="w-3 h-3 rounded-full bg-yellow-250 shadow-sm relative z-10" />
                      <div className="absolute right-0.5 bottom-0.5 text-white/40 font-bold font-mono text-[7px]">🕒</div>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-black text-slate-900 flex items-center gap-1.5 leading-none">
                        <span>Dynamic Day-Night Cycle</span>
                        <span className="bg-amber-100 border border-amber-300 text-amber-800 text-[6.5px] font-black px-1.5 py-0.2 rounded-sm font-mono tracking-wide uppercase">DYNAMIC</span>
                      </p>
                      <p className="text-[8.5px] font-mono text-slate-700 leading-tight mt-0.5">
                        Fades smoothly between Meadow Day, Blossom Sunset, Midnight Stars & Synth City!
                      </p>
                    </div>

                    {themeId === 'DYNAMIC_CYCLE' && (
                      <div className="ml-auto w-4 h-4 bg-slate-900 rounded-full flex items-center justify-center text-[8px] text-white font-bold font-mono shrink-0 shadow animate-bounce">
                        ✓
                      </div>
                    )}
                  </motion.button>

                  {THEMES.map((theme) => {
                    const isLocked = (theme.id === 'NEON_CITY' && highScore < 50) || 
                                     (theme.id === 'CUTE_GARDEN' && highScore < 100);
                    const unlockScore = theme.id === 'NEON_CITY' ? 50 : theme.id === 'CUTE_GARDEN' ? 100 : 0;

                    return (
                      <motion.button
                        id={`theme-btn-${theme.id}`}
                        key={theme.id}
                        whileHover={{ scale: isLocked ? 1.0 : 1.02 }}
                        whileTap={{ scale: isLocked ? 1.0 : 0.96 }}
                        onClick={() => {
                          if (isLocked) return;
                          setThemeId(theme.id);
                          sfx.playPoint();
                        }}
                        className={`relative p-2 rounded-xl border text-left transition-all flex items-center gap-2.5 select-none outline-none ${
                          themeId === theme.id
                            ? 'bg-white border-slate-950 shadow-md text-slate-940 scale-[1.01] cursor-pointer'
                            : isLocked
                              ? 'bg-slate-100/40 border-slate-200/20 text-slate-400 opacity-60 cursor-not-allowed'
                              : 'bg-white/30 border-white/20 hover:border-white/40 hover:bg-white/40 text-slate-800 cursor-pointer'
                        }`}
                        disabled={isLocked}
                      >
                        <div 
                          className="w-6 h-6 rounded border border-slate-350/30 overflow-hidden relative shrink-0"
                          style={{ backgroundColor: theme.skyColor }}
                        >
                          <div 
                            className="absolute bottom-0 inset-x-0 h-1.5" 
                            style={{ backgroundColor: theme.groundGrassColor }} 
                          />
                          {isLocked && (
                            <div className="absolute inset-0 bg-slate-950/60 flex items-center justify-center">
                              <Lock className="w-3.5 h-3.5 text-white/90" />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`text-[9px] font-black truncate ${isLocked ? 'text-slate-500 line-through' : 'text-slate-900'}`}>{theme.name}</p>
                          <p className="text-[8px] font-mono truncate">
                            {isLocked ? (
                              <span className="text-amber-700 font-bold">Unlocks @ {unlockScore} pts</span>
                            ) : (
                              <span className="text-slate-600">
                                {theme.id === 'RETRO_DAY' && 'Sunny meadow field'}
                                {theme.id === 'RETRO_NIGHT' && 'Luminous starry cosmos'}
                                {theme.id === 'NEON_CITY' && 'Futuristic cyberspace grid'}
                                {theme.id === 'CUTE_GARDEN' && 'Cherry blossoming sky'}
                              </span>
                            )}
                          </p>
                        </div>

                        {themeId === theme.id && !isLocked && (
                          <div className="ml-auto w-3.5 h-3.5 bg-slate-900 rounded-full flex items-center justify-center text-[8px] text-white font-bold font-mono shrink-0 shadow animate-pulse">
                            ✓
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* 3. SELECT PACE & DIFFICULTY CHOOSER */}
              <div className="space-y-1.5">
                <h3 className="text-[10px] uppercase tracking-widest text-slate-950 font-mono font-black">
                  3. Select Difficulty & Velocity
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {(['EASY', 'NORMAL', 'HARDCORE'] as DifficultyLevel[]).map((level) => {
                    const active = difficulty === level;
                    
                    let colorClass = 'border-white/20 bg-white/20 text-slate-700 hover:bg-white/30';
                    if (active) {
                      if (level === 'EASY') colorClass = 'bg-white border-slate-950 text-emerald-800 shadow font-extrabold scale-[1.01]';
                      if (level === 'NORMAL') colorClass = 'bg-white border-slate-950 text-cyan-800 shadow font-extrabold scale-[1.01]';
                      if (level === 'HARDCORE') colorClass = 'bg-white border-slate-950 text-rose-800 shadow font-extrabold scale-[1.01] animate-pulse';
                    }

                    return (
                      <motion.button
                        id={`difficulty-btn-${level}`}
                        key={level}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => {
                          setDifficulty(level);
                          sfx.playJump();
                        }}
                        className={`p-1.5 rounded-xl border text-center transition-all cursor-pointer select-none outline-none ${colorClass}`}
                      >
                        <p className="text-[9px] font-black font-mono tracking-wide">{level}</p>
                        <p className="text-[8px] text-slate-600 font-semibold mt-0.5">
                          {level === 'EASY' && 'Wide Gaps'}
                          {level === 'NORMAL' && 'Medium sync'}
                          {level === 'HARDCORE' && 'Ultra Tight'}
                        </p>
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* CORE CTA GAMEPLAY DEPARTURE BUTTON (styled identical to 'Tap anywhere to fly' banner with tap scale animations) */}
              <div className="pt-1.5">
                <motion.button
                  id="take-departure-btn"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handleGameStart}
                  className="w-full py-4 bg-white/45 hover:bg-white/60 border border-white/60 backdrop-blur-md rounded-2xl text-xs font-black text-slate-950 uppercase tracking-widest cursor-pointer shadow-lg transition-all flex items-center justify-center gap-2.5 outline-none"
                >
                  <Play className="w-4 h-4 fill-slate-950 stroke-slate-950 text-slate-950 animate-pulse" />
                  <span>TAKE DEPARTURE</span>
                </motion.button>
              </div>

            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* MODAL WINDOWS - HISTORICAL LEADERBOARD CHANNELS */}
      <AnimatePresence>
        {showHistoryModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center p-4 z-50 selection:bg-rose-500 selection:text-white"
            onClick={() => setShowHistoryModal(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.92, y: 12 }}
              className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl w-full max-w-md p-6 relative overflow-hidden shadow-2xl text-slate-900"
              onClick={(e) => e.stopPropagation()} // prevent double closes
            >
              <div className="flex items-center justify-between border-b border-white/30 pb-3 mb-4">
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-5 h-5 text-yellow-600 animate-bounce" />
                  <h3 className="font-black text-slate-900 text-lg">Score Ledger</h3>
                </div>
                <motion.button
                  id="modal-close-btn"
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() => setShowHistoryModal(false)}
                  className="p-1.5 rounded-lg hover:bg-white/40 text-slate-600 hover:text-slate-900 transition-all cursor-pointer outline-none"
                >
                  <X className="w-4.5 h-4.5" />
                </motion.button>
              </div>

              {scoreHistory.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <Flame className="w-10 h-10 text-slate-400 mx-auto" />
                  <p className="text-sm font-semibold text-slate-700">Ledger is empty</p>
                  <p className="text-xs text-slate-500">Your runs will appear here as you log flights!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="max-h-[260px] overflow-y-auto space-y-2 pr-1.5 scrollbar-thin scrollbar-thumb-slate-300">
                    {scoreHistory.map((run, i) => (
                      <div 
                        key={i} 
                        className={`p-2.5 rounded-xl border text-xs flex justify-between items-center ${
                          i === 0 
                            ? 'bg-white/50 border-white' 
                            : 'bg-white/20 border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-[10px] text-slate-500 min-w-[14px]">
                            #{i + 1}
                          </span>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-black text-slate-900 font-mono">{run.score} pts</span>
                              <span className={`px-1 rounded-[3px] text-[8px] font-bold font-mono tracking-wide ${
                                run.difficulty === 'EASY' ? 'bg-emerald-500/10 text-emerald-700' :
                                run.difficulty === 'NORMAL' ? 'bg-cyan-500/10 text-cyan-700' : 'bg-pink-500/10 text-pink-700'
                              }`}>
                                {run.difficulty}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-600 mt-0.5 font-medium">
                              <span>{run.skin}</span>
                              <span>•</span>
                              <span className="flex items-center gap-0.5">
                                <Calendar className="w-2.5 h-2.5" />
                                {run.date}
                              </span>
                            </div>
                          </div>
                        </div>

                        {getMedal(run.score) && (
                          <span className="text-lg" title={`${getMedal(run.score)?.name} Medal`}>
                            {getMedal(run.score)?.symbol}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-t border-white/30 pt-3 mt-1.5 flex justify-between items-center gap-3">
                    <motion.button
                      id="clear-all-records-btn"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={clearHistory}
                      className="text-xs font-mono font-bold text-rose-700 hover:text-rose-600 p-2 rounded hover:bg-rose-500/10 transition-all cursor-pointer outline-none"
                    >
                      Clear All Records
                    </motion.button>
                    <motion.button
                      id="modal-close-window-btn"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => setShowHistoryModal(false)}
                      className="px-4 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-xl text-xs font-bold font-mono transition-all cursor-pointer outline-none"
                    >
                      Close Window
                    </motion.button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FOOTER BAR */}
      <footer className={`w-full max-w-7xl mx-auto px-4 py-4 border-t border-white/20 text-slate-700 text-center font-mono text-[10px] select-none selection:bg-rose-500 selection:text-white ${gameState !== 'START' ? 'hidden sm:block' : 'block'}`}>
        <p className="font-bold">© 2026 Flop Flight Arcade. Designed 100% bug-free for all high-definition displays.</p>
        <p className="mt-1 text-slate-600 font-semibold">Powered by Canvas Rendering Engines & Dynamic Web Audio Synthesizers.</p>
      </footer>
    </div>
  );
}
