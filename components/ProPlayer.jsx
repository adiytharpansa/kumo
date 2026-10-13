'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play, Pause, Volume2, Volume1, VolumeX, Maximize, Minimize,
  Settings, RotateCcw, RotateCw, PictureInPicture, Subtitles,
  Check, ChevronRight, Layers, FastForward,
} from 'lucide-react';

// Pemutar kustom dari berkas kiriman pengguna, disesuaikan ke Kumo:
// - Stream HLS (.m3u8) dimuat lewat hls.js (bukan src MP4 langsung).
// - Menu Quality berisi level RESOLUSI ASLI dari manifest (Auto +
//   tiap level), bukan daftar contoh.
// - Subtitle memakai trek .vtt asli (Inggris) bila tersedia; bawaan
//   menyala. Pilihan Off/Inggris di menu Subtitles.
// - Aksen mengikuti gradasi merek Kumo (var(--gr)).
// - Bilah progres memakai Pointer Events agar bisa digeser dengan
//   sentuhan di HP; pintasan keyboard dibatasi di area pemutar.
// - Elemen dekoratif tanpa data asli pada contoh (lencana "4K",
//   tombol "Pro Stream") tidak dipasang.
// Galat fatal HLS -> onFatal() agar pemanggil jatuh ke embed iframe.
const SPEED_OPTIONS = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

export default function ProPlayer({ src, subtitleUrl = null, title = '', episodeLabel = '', onFatal }) {
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const hideTimerRef = useRef(null);
  const progressBarRef = useRef(null);
  const hlsRef = useRef(null);
  const fatalRef = useRef({ network: 0, media: 0 });
  const scrubbingRef = useRef(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTab, setActiveTab] = useState(null); // 'menu' | 'quality' | 'speed' | 'subtitles'

  // Kualitas asli dari manifest: [{ label, value }] value = indeks
  // level hls.js, -1 = Auto.
  const [qualities, setQualities] = useState([{ label: 'Auto', value: -1 }]);
  const [selectedQuality, setSelectedQuality] = useState(-1);
  const [autoLabel, setAutoLabel] = useState('Auto');
  const [selectedSpeed, setSelectedSpeed] = useState(1.0);
  const [selectedSubtitle, setSelectedSubtitle] = useState(subtitleUrl ? 'en' : 'off');

  const [hoverTime, setHoverTime] = useState(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [isHoveringBar, setIsHoveringBar] = useState(false);

  const [ripple, setRipple] = useState(null);

  // ---- muat stream ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    fatalRef.current = { network: 0, media: 0 };
    setQualities([{ label: 'Auto', value: -1 }]);
    setSelectedQuality(-1);
    let hls = null;

    if (Hls.isSupported()) {
      hls = new Hls({ capLevelToPlayerSize: false });
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        const levels = Array.isArray(hls.levels) ? hls.levels : [];
        const seen = new Map();
        levels.forEach((lv, i) => {
          if (lv && lv.height && !seen.has(lv.height)) seen.set(lv.height, i);
        });
        const opts = [{ label: 'Auto', value: -1 }];
        [...seen.entries()]
          .sort((a, b) => b[0] - a[0])
          .forEach(([h, i]) => opts.push({ label: `${h}p`, value: i }));
        setQualities(opts);
      });
      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
        const lv = hls.levels && hls.levels[data.level];
        if (lv && lv.height) setAutoLabel(`Auto (${lv.height}p)`);
      });
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (!data || !data.fatal) return;
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR && fatalRef.current.network < 2) {
          fatalRef.current.network += 1;
          try { hls.startLoad(); } catch (err) {}
          return;
        }
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR && fatalRef.current.media < 1) {
          fatalRef.current.media += 1;
          try { hls.recoverMediaError(); } catch (err) {}
          return;
        }
        if (onFatal) onFatal();
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src;
    } else {
      if (onFatal) onFatal();
    }

    return () => {
      if (hls) {
        try { hls.destroy(); } catch (e) {}
      }
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // ---- subtitle: mode trek teks mengikuti pilihan ----
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const apply = () => {
      const tracks = video.textTracks;
      if (!tracks || !tracks.length) return;
      tracks[0].mode = selectedSubtitle === 'en' ? 'showing' : 'disabled';
    };
    apply();
    const t = setTimeout(apply, 600);
    return () => clearTimeout(t);
  }, [selectedSubtitle, subtitleUrl, src]);

  const triggerUserActivity = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
      setActiveTab(null);
    }, 3000);
  }, []);

  const triggerRipple = (type) => {
    setRipple(type);
    setTimeout(() => setRipple(null), 600);
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      triggerRipple('play');
    } else {
      video.pause();
      triggerRipple('pause');
    }
    triggerUserActivity();
  }, [triggerUserActivity]);

  const skipTime = useCallback(
    (seconds) => {
      const video = videoRef.current;
      if (!video) return;
      video.currentTime = Math.min(Math.max(video.currentTime + seconds, 0), duration || 0);
      triggerRipple(seconds > 0 ? 'forward' : 'rewind');
      triggerUserActivity();
    },
    [duration, triggerUserActivity]
  );

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (isMuted) {
      video.volume = volume || 0.8;
      video.muted = false;
      setIsMuted(false);
    } else {
      video.muted = true;
      setIsMuted(true);
    }
    triggerUserActivity();
  }, [isMuted, volume, triggerUserActivity]);

  const toggleFullscreen = useCallback(() => {
    if (!playerRef.current) return;
    if (!document.fullscreenElement) {
      playerRef.current.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);

  const togglePiP = useCallback(async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled && videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const handleKeyDown = (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    switch (e.code) {
      case 'Space':
      case 'KeyK':
        togglePlay();
        break;
      case 'KeyF':
        toggleFullscreen();
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'ArrowLeft':
        skipTime(-5);
        break;
      case 'ArrowRight':
        skipTime(5);
        break;
      case 'ArrowUp':
        setVolume((prev) => {
          const next = Math.min(prev + 0.1, 1);
          if (videoRef.current) {
            videoRef.current.volume = next;
            videoRef.current.muted = next === 0;
          }
          setIsMuted(next === 0);
          return next;
        });
        break;
      case 'ArrowDown':
        setVolume((prev) => {
          const next = Math.max(prev - 0.1, 0);
          if (videoRef.current) {
            videoRef.current.volume = next;
            videoRef.current.muted = next === 0;
          }
          setIsMuted(next === 0);
          return next;
        });
        break;
      default:
        break;
    }
    triggerUserActivity();
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.buffered.length > 0) {
        try { setBuffered(video.buffered.end(video.buffered.length - 1)); } catch (e) {}
      }
    };
    const onLoadedMetadata = () => setDuration(video.duration || 0);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => { setIsBuffering(false); setIsPlaying(true); };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => setIsPlaying(false);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
    };
  }, []);

  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const seekFromClientX = (clientX) => {
    const bar = progressBarRef.current;
    const video = videoRef.current;
    if (!bar || !video || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(clientX - rect.left, rect.width)) / rect.width;
    video.currentTime = pct * duration;
    setCurrentTime(pct * duration);
  };

  const handleBarPointerDown = (e) => {
    scrubbingRef.current = true;
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch (err) {}
    seekFromClientX(e.clientX);
    triggerUserActivity();
  };
  const handleBarPointerMove = (e) => {
    const bar = progressBarRef.current;
    if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pos = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
    setHoverPosition(pos);
    setHoverTime((pos / rect.width) * duration);
    if (scrubbingRef.current) seekFromClientX(e.clientX);
  };
  const handleBarPointerUp = () => {
    scrubbingRef.current = false;
  };

  const handleSpeedChange = (speed) => {
    setSelectedSpeed(speed);
    if (videoRef.current) videoRef.current.playbackRate = speed;
    setActiveTab(null);
    triggerUserActivity();
  };

  const handleQualityChange = (q) => {
    setSelectedQuality(q.value);
    if (hlsRef.current) {
      hlsRef.current.currentLevel = q.value; // -1 = Auto
    }
    setActiveTab(null);
    triggerUserActivity();
  };

  const qualityDisplay =
    selectedQuality === -1 ? autoLabel : (qualities.find((q) => q.value === selectedQuality) || {}).label || 'Auto';

  return (
    <div
      ref={playerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseMove={triggerUserActivity}
      onTouchStart={triggerUserActivity}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="group relative aspect-video w-full select-none overflow-hidden bg-black font-sans outline-none"
    >
      <video
        ref={videoRef}
        onClick={togglePlay}
        className="h-full w-full cursor-pointer object-contain"
        playsInline
        crossOrigin={subtitleUrl ? 'anonymous' : undefined}
      >
        {subtitleUrl ? (
          <track
            key={subtitleUrl}
            kind="subtitles"
            src={subtitleUrl}
            srcLang="en"
            label="English"
            default={selectedSubtitle === 'en'}
          />
        ) : null}
      </video>

      {/* Animasi riak putar/jeda/lompat */}
      {ripple && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white/20 backdrop-blur-md animate-ping">
            {ripple === 'play' && <Play className="ml-1 h-10 w-10 fill-current text-white" />}
            {ripple === 'pause' && <Pause className="h-10 w-10 text-white" />}
            {ripple === 'forward' && <RotateCw className="h-10 w-10 text-white" />}
            {ripple === 'rewind' && <RotateCcw className="h-10 w-10 text-white" />}
          </div>
        </div>
      )}

      {/* Pemintal buffering */}
      {isBuffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
          <div
            className="h-14 w-14 animate-spin rounded-full border-4 border-t-transparent"
            style={{ borderColor: 'var(--ac)', borderTopColor: 'transparent' }}
          />
        </div>
      )}

      {/* Tombol putar besar saat jeda */}
      {!isPlaying && !isBuffering && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/40 transition-all duration-300"
        >
          <button
            type="button"
            aria-label="Putar"
            className="flex h-20 w-20 transform items-center justify-center rounded-full text-white shadow-2xl transition-all hover:scale-110"
            style={{ background: 'var(--gr)', boxShadow: '0 18px 40px -12px rgba(240,69,122,.55)' }}
          >
            <Play className="ml-1 h-9 w-9 fill-current" />
          </button>
        </div>
      )}

      {/* Bar atas: judul */}
      <div
        className={`absolute left-0 right-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/90 via-black/40 to-transparent p-4 transition-all duration-300 sm:p-5 ${
          showControls ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-4 opacity-0'
        }`}
      >
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold tracking-wide text-white sm:text-lg">{title}</h1>
          {episodeLabel ? <p className="mt-0.5 text-xs text-neutral-400">{episodeLabel}</p> : null}
        </div>
      </div>

      {/* Bar kontrol bawah */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 transition-all duration-300 sm:p-5 ${
          showControls ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0'
        }`}
      >
        {/* Bilah progres */}
        <div
          ref={progressBarRef}
          onPointerDown={handleBarPointerDown}
          onPointerMove={handleBarPointerMove}
          onPointerUp={handleBarPointerUp}
          onPointerEnter={() => setIsHoveringBar(true)}
          onPointerLeave={() => { setIsHoveringBar(false); scrubbingRef.current = false; }}
          className="group/bar relative mb-3 flex h-4 cursor-pointer touch-none items-center"
        >
          {isHoveringBar && hoverTime !== null && (
            <div
              style={{ left: `${hoverPosition}px` }}
              className="pointer-events-none absolute -top-9 -translate-x-1/2 whitespace-nowrap rounded-md border border-neutral-700 bg-neutral-900/95 px-2.5 py-1 font-mono text-xs text-white shadow-xl"
            >
              {formatTime(hoverTime)}
            </div>
          )}
          <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20 transition-all group-hover/bar:h-2">
            <div
              style={{ width: `${(buffered / (duration || 1)) * 100}%` }}
              className="h-full bg-white/30 transition-all duration-300"
            />
            <div
              style={{ width: `${(currentTime / (duration || 1)) * 100}%`, background: 'var(--gr)' }}
              className="absolute left-0 top-0 h-full"
            />
          </div>
          <div
            style={{ left: `${(currentTime / (duration || 1)) * 100}%` }}
            className="absolute h-3.5 w-3.5 -translate-x-1/2 scale-110 rounded-full bg-white opacity-0 shadow-lg transition-opacity group-hover/bar:opacity-100"
          />
        </div>

        <div className="flex items-center justify-between text-white">
          {/* Kiri: putar, lompat, volume, waktu */}
          <div className="flex items-center space-x-1 sm:space-x-2">
            <button type="button" onClick={togglePlay} aria-label={isPlaying ? 'Jeda' : 'Putar'} className="rounded-full p-2 transition-colors hover:bg-white/10 focus:outline-none">
              {isPlaying ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6 fill-current" />}
            </button>
            <button type="button" onClick={() => skipTime(-10)} className="rounded-full p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white" title="Mundur 10 detik">
              <RotateCcw className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => skipTime(10)} className="rounded-full p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white" title="Maju 10 detik">
              <RotateCw className="h-5 w-5" />
            </button>
            <div className="group/vol flex items-center space-x-1 pl-1">
              <button type="button" onClick={toggleMute} aria-label="Bisukan" className="rounded-full p-2 transition-colors hover:bg-white/10">
                {isMuted || volume === 0 ? (
                  <VolumeX className="h-5 w-5 text-red-400" />
                ) : volume < 0.5 ? (
                  <Volume1 className="h-5 w-5" />
                ) : (
                  <Volume2 className="h-5 w-5" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setVolume(val);
                  setIsMuted(val === 0);
                  if (videoRef.current) {
                    videoRef.current.volume = val;
                    videoRef.current.muted = val === 0;
                  }
                }}
                className="h-1 w-0 cursor-pointer appearance-none rounded-lg bg-white/30 transition-all duration-300 group-hover/vol:w-16 sm:group-hover/vol:w-20"
                style={{ accentColor: 'var(--ac)' }}
              />
            </div>
            <div className="pl-1 font-mono text-[11px] text-neutral-300 sm:text-xs">
              <span>{formatTime(currentTime)}</span>
              <span className="mx-1 text-neutral-500">/</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Kanan: pengaturan, PiP, layar penuh */}
          <div className="relative flex items-center space-x-1 sm:space-x-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => { setActiveTab(activeTab ? null : 'menu'); triggerUserActivity(); }}
                className={`rounded-full p-2 transition-all ${activeTab ? 'bg-white/20 text-white' : 'text-neutral-300 hover:bg-white/10'}`}
                title="Pengaturan"
              >
                <Settings className={`h-5 w-5 transition-transform duration-300 ${activeTab ? 'rotate-90' : ''}`} />
              </button>

              {activeTab && (
                <div className="absolute bottom-12 right-0 z-30 w-60 rounded-2xl border border-neutral-800 bg-neutral-900/95 p-2 text-xs shadow-2xl backdrop-blur-xl sm:w-64">
                  {activeTab === 'menu' && (
                    <div className="space-y-1">
                      <button type="button" onClick={() => setActiveTab('quality')} className="flex w-full items-center justify-between rounded-xl p-2.5 text-neutral-200 transition-colors hover:bg-white/10">
                        <span className="flex items-center space-x-2">
                          <Layers className="h-4 w-4" style={{ color: 'var(--ac2)' }} />
                          <span>Kualitas</span>
                        </span>
                        <span className="flex items-center space-x-1 text-neutral-400">
                          <span>{qualityDisplay}</span>
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </button>
                      <button type="button" onClick={() => setActiveTab('speed')} className="flex w-full items-center justify-between rounded-xl p-2.5 text-neutral-200 transition-colors hover:bg-white/10">
                        <span className="flex items-center space-x-2">
                          <FastForward className="h-4 w-4" style={{ color: 'var(--ac2)' }} />
                          <span>Kecepatan</span>
                        </span>
                        <span className="flex items-center space-x-1 text-neutral-400">
                          <span>{selectedSpeed === 1 ? 'Normal' : `${selectedSpeed}x`}</span>
                          <ChevronRight className="h-4 w-4" />
                        </span>
                      </button>
                      {subtitleUrl ? (
                        <button type="button" onClick={() => setActiveTab('subtitles')} className="flex w-full items-center justify-between rounded-xl p-2.5 text-neutral-200 transition-colors hover:bg-white/10">
                          <span className="flex items-center space-x-2">
                            <Subtitles className="h-4 w-4" style={{ color: 'var(--ac2)' }} />
                            <span>Subtitle</span>
                          </span>
                          <span className="flex items-center space-x-1 text-neutral-400">
                            <span>{selectedSubtitle === 'en' ? 'Inggris' : 'Mati'}</span>
                            <ChevronRight className="h-4 w-4" />
                          </span>
                        </button>
                      ) : null}
                    </div>
                  )}

                  {activeTab === 'quality' && (
                    <div className="space-y-1">
                      <div className="border-b border-neutral-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Pilih Resolusi
                      </div>
                      {qualities.map((q) => (
                        <button
                          type="button"
                          key={q.value}
                          onClick={() => handleQualityChange(q)}
                          className={`flex w-full items-center justify-between rounded-xl p-2.5 transition-colors ${
                            selectedQuality === q.value ? 'bg-white/10 font-semibold text-white' : 'text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          <span>{q.value === -1 ? autoLabel : q.label}</span>
                          {selectedQuality === q.value && <Check className="h-4 w-4" style={{ color: 'var(--ac)' }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeTab === 'speed' && (
                    <div className="space-y-1">
                      <div className="border-b border-neutral-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Kecepatan Putar
                      </div>
                      {SPEED_OPTIONS.map((speed) => (
                        <button
                          type="button"
                          key={speed}
                          onClick={() => handleSpeedChange(speed)}
                          className={`flex w-full items-center justify-between rounded-xl p-2.5 transition-colors ${
                            selectedSpeed === speed ? 'bg-white/10 font-semibold text-white' : 'text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          <span>{speed === 1.0 ? '1.0x (Normal)' : `${speed}x`}</span>
                          {selectedSpeed === speed && <Check className="h-4 w-4" style={{ color: 'var(--ac)' }} />}
                        </button>
                      ))}
                    </div>
                  )}

                  {activeTab === 'subtitles' && (
                    <div className="space-y-1">
                      <div className="border-b border-neutral-800 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-neutral-400">
                        Subtitle
                      </div>
                      {[
                        { label: 'Mati', value: 'off' },
                        { label: 'Inggris', value: 'en' },
                      ].map((sub) => (
                        <button
                          type="button"
                          key={sub.value}
                          onClick={() => { setSelectedSubtitle(sub.value); setActiveTab(null); triggerUserActivity(); }}
                          className={`flex w-full items-center justify-between rounded-xl p-2.5 transition-colors ${
                            selectedSubtitle === sub.value ? 'bg-white/10 font-semibold text-white' : 'text-neutral-300 hover:bg-white/10'
                          }`}
                        >
                          <span>{sub.label}</span>
                          {selectedSubtitle === sub.value && <Check className="h-4 w-4" style={{ color: 'var(--ac)' }} />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button type="button" onClick={togglePiP} className="hidden rounded-full p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white sm:block" title="Gambar-dalam-gambar">
              <PictureInPicture className="h-5 w-5" />
            </button>
            <button type="button" onClick={toggleFullscreen} className="rounded-full p-2 text-neutral-300 transition-colors hover:bg-white/10 hover:text-white" title="Layar penuh (F)">
              {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
