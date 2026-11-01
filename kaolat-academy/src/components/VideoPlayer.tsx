import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Sliders,
  Settings,
  Tv,
  Film,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

export interface VideoPlayerRef {
  seekTo: (seconds: number) => void;
  play: () => void;
  pause: () => void;
  getCurrentTime: () => number;
}

interface VideoPlayerProps {
  src: string;
  title: string;
  epNumber: number;
  durationString?: string;
  onEnded?: () => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  isTheaterMode?: boolean;
  onToggleTheaterMode?: () => void;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(({
  src,
  title,
  epNumber,
  durationString,
  onEnded,
  onTimeUpdate,
  isTheaterMode,
  onToggleTheaterMode,
}, ref) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const controlsTimeoutRef = useRef<number | null>(null);

  useImperativeHandle(ref, () => ({
    seekTo: (seconds: number) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, Math.min(seconds, duration || 9999));
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    },
    play: () => {
      videoRef.current?.play();
      setIsPlaying(true);
    },
    pause: () => {
      videoRef.current?.pause();
      setIsPlaying(false);
    },
    getCurrentTime: () => videoRef.current?.currentTime || 0,
  }));

  // Reset state when src changes
  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setHasError(false);
    setIsLoading(true);
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [src]);

  // Handle auto-hiding controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      window.clearTimeout(controlsTimeoutRef.current);
    }
    controlsTimeoutRef.current = window.setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
        setShowSpeedMenu(false);
      }
    }, 2800);
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused || videoRef.current.ended) {
      videoRef.current.play().catch((err) => {
        console.warn('Playback blocked or failed:', err);
      });
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const curr = videoRef.current.currentTime;
    const dur = videoRef.current.duration || 0;
    setCurrentTime(curr);
    if (dur && !isNaN(dur)) setDuration(dur);
    onTimeUpdate?.(curr, dur);
  };

  const handleLoadedMetadata = () => {
    if (!videoRef.current) return;
    setIsLoading(false);
    setDuration(videoRef.current.duration);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuted = !isMuted;
    videoRef.current.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
    setShowSpeedMenu(false);
  };

  const skipSeconds = (seconds: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = Math.max(0, Math.min(videoRef.current.currentTime + seconds, duration));
  };

  const toggleFullscreen = async () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden shadow-2xl group select-none border border-slate-800"
    >
      {/* HTML5 Video Element */}
      <video
        ref={videoRef}
        src={src}
        className="w-full h-full object-contain cursor-pointer"
        onClick={togglePlay}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onWaiting={() => setIsLoading(true)}
        onPlaying={() => {
          setIsLoading(false);
          setIsPlaying(true);
        }}
        onEnded={() => {
          setIsPlaying(false);
          onEnded?.();
        }}
        onError={() => {
          setHasError(true);
          setIsLoading(false);
        }}
        playsInline
      />

      {/* Loading Spinner */}
      {isLoading && !hasError && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/40 pointer-events-none">
          <div className="w-12 h-12 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Error Fallback */}
      {hasError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-400 mb-2" />
          <h4 className="text-base font-semibold text-white mb-1">ไม่สามารถโหลดวิดีโอนี้ได้</h4>
          <p className="text-xs text-slate-400 max-w-md mb-4">
            หากคุณเป็นแอดมิน สามารถกดปุ่ม <strong>"อัปโหลดคลิป EP"</strong> ด้านบนเพื่อเลือกไฟล์วิดีโอจากเครื่องคอมพิวเตอร์ของคุณมาใส่แทนได้ทันที
          </p>
          <button
            onClick={() => {
              setHasError(false);
              videoRef.current?.load();
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>ลองโหลดใหม่อีกครั้ง</span>
          </button>
        </div>
      )}

      {/* Big Center Play/Pause button on Hover if paused */}
      {!isPlaying && !hasError && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
        >
          <div className="w-16 h-16 rounded-full bg-amber-400/90 hover:bg-amber-400 text-slate-950 flex items-center justify-center shadow-xl shadow-amber-500/30 transform hover:scale-105 transition-all">
            <Play className="w-7 h-7 ml-1 fill-current" />
          </div>
        </div>
      )}

      {/* Top Overlay Badge */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent transition-opacity duration-300 pointer-events-none ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div className="flex items-center justify-between text-xs text-white drop-shadow">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-amber-400">EP {epNumber}</span>
            <span>·</span>
            <span className="truncate font-medium">{title}</span>
          </div>
          <span className="font-mono text-slate-300 shrink-0">
            {formatTime(currentTime)} / {duration ? formatTime(duration) : durationString || '15:00'}
          </span>
        </div>
      </div>

      {/* Bottom Controls Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-3 sm:p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent transition-opacity duration-300 ${
          showControls ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Interactive Timeline Scrubbing Bar */}
        <div className="relative group/timeline mb-2.5 flex items-center">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-1.5 hover:h-2.5 bg-slate-700/70 rounded-lg appearance-none cursor-pointer accent-amber-400 transition-all"
          />
        </div>

        {/* Buttons Row */}
        <div className="flex items-center justify-between gap-2 text-white">
          {/* Left Controls: Play, Rewind 10, FastForward 10, Volume, Time */}
          <div className="flex items-center gap-3">
            <button
              onClick={togglePlay}
              className="p-1.5 hover:text-amber-400 transition-colors cursor-pointer"
              title={isPlaying ? 'หยุดชั่วคราว (Space)' : 'เล่น (Space)'}
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
            </button>

            <button
              onClick={() => skipSeconds(-10)}
              className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="ย้อนหลัง 10 วินาที"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              onClick={() => skipSeconds(10)}
              className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="ไปข้างหน้า 10 วินาที"
            >
              <RotateCw className="w-4 h-4" />
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                onClick={toggleMute}
                className="p-1.5 text-slate-300 hover:text-white cursor-pointer"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-14 sm:w-18 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            {/* Time Stamp */}
            <div className="text-xs font-mono text-slate-300 hidden sm:inline">
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500 mx-1">/</span>
              <span>{duration ? formatTime(duration) : durationString || '15:00'}</span>
            </div>
          </div>

          {/* Right Controls: Speed, Theater, Fullscreen */}
          <div className="flex items-center gap-2">
            {/* Speed Selector Menu */}
            <div className="relative">
              <button
                onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                className="px-2 py-1 text-xs font-semibold rounded hover:bg-white/10 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer flex items-center gap-1"
                title="ความเร็วในการเล่น"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>{playbackRate}x</span>
              </button>

              {showSpeedMenu && (
                <div className="absolute bottom-full right-0 mb-2 w-28 bg-slate-900 border border-slate-700 rounded-xl p-1 shadow-2xl z-30">
                  <div className="text-[10px] uppercase font-semibold text-slate-400 px-2 py-1">
                    ความเร็ว
                  </div>
                  {[0.75, 1, 1.25, 1.5, 1.75, 2].map((rate) => (
                    <button
                      key={rate}
                      onClick={() => handleSpeedChange(rate)}
                      className={`w-full text-left px-2.5 py-1 text-xs rounded-lg transition-colors cursor-pointer flex items-center justify-between ${
                        playbackRate === rate
                          ? 'bg-amber-400/20 text-amber-400 font-bold'
                          : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <span>{rate}x</span>
                      {rate === 1 && <span className="text-[10px] text-slate-400">ปกติ</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Theater Mode Toggle */}
            {onToggleTheaterMode && (
              <button
                onClick={onToggleTheaterMode}
                className={`p-1.5 transition-colors cursor-pointer ${
                  isTheaterMode ? 'text-amber-400' : 'text-slate-300 hover:text-white'
                }`}
                title="โหมดโรงภาพยนตร์ (Theater Mode)"
              >
                <Tv className="w-4 h-4" />
              </button>
            )}

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="เต็มจอ (Fullscreen)"
            >
              {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

VideoPlayer.displayName = 'VideoPlayer';
