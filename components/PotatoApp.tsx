"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  COUNTRY_OPTIONS,
  detectCountry,
  flagUrl,
  normalizeCountry,
} from "@/lib/flags";
import { randomClientId, randomNickname } from "@/lib/nickname";
import { LeaderboardBars, PotatoMark } from "@/components/BrandIcons";

type Theme = "cream" | "night" | "forest" | "mist";
type Mode = "focus" | "short" | "long";
type Track = { label: string; src: string };
type GeoResponse = { country?: string | null };
type AudioContextConstructor = new () => AudioContext;
type AudioWindow = Window & { webkitAudioContext?: AudioContextConstructor };

const DURATIONS: Record<Mode, number> = {
  focus: 25 * 60,
  short: 5 * 60,
  long: 15 * 60,
};

const PHASE_LABELS: Record<Mode, string> = {
  focus: "Focus session",
  short: "Short break",
  long: "Long break",
};

const THEMES: { key: Theme; swatch: string }[] = [
  { key: "cream", swatch: "#b85a30" },
  { key: "night", swatch: "#10161d" },
  { key: "forest", swatch: "#a8d4b1" },
  { key: "mist", swatch: "#3f6685" },
];

const TRACKS: Track[] = [
  { label: "Lo-fi café", src: "/audio/lofi-cafe.ogg" },
  { label: "Rain", src: "/audio/rain.ogg" },
  { label: "Forest", src: "/audio/forest.ogg" },
  { label: "White noise", src: "/audio/white-noise.ogg" },
  { label: "Fireplace", src: "/audio/fireplace.ogg" },
  { label: "Ambient piano", src: "/audio/ambient-piano.flac" },
  { label: "Firmament", src: "/audio/firmament.ogg" },
  { label: "Resort breeze", src: "/audio/resort-breeze.ogg" },
];

const BRAND_LINKS = [
  { label: "Contact", href: "mailto:hello@potato.studywithme.app", icon: "ti ti-mail" },
  { label: "GitHub", href: "https://github.com/", icon: "ti ti-brand-github" },
  { label: "Twitter", href: "https://x.com/", icon: "ti ti-brand-x" },
];

type Row = {
  rank: number;
  nickname: string;
  country: string;
  count: number;
  me?: boolean;
};

const todayUtc = () => new Date().toISOString().slice(0, 10);

function format(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function PotatoApp() {
  const [theme, setTheme] = useState<Theme>("cream");
  const [mode, setMode] = useState<Mode>("focus");
  const [remaining, setRemaining] = useState<number>(DURATIONS.focus);
  const [running, setRunning] = useState(false);
  const [todayCount, setTodayCount] = useState(0);
  const [todayDate, setTodayDate] = useState(todayUtc());

  const [nickname, setNickname] = useState("");
  const [country, setCountry] = useState("us");
  const [clientId, setClientId] = useState("");

  const [boardOpen, setBoardOpen] = useState(false);
  const [flagMenuOpen, setFlagMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [online, setOnline] = useState(0);

  const [muted, setMuted] = useState(true);
  const [track, setTrack] = useState(TRACKS[0].label);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const alarmContextRef = useRef<AudioContext | null>(null);
  const flagMenuRef = useRef<HTMLDivElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);
  const endAtRef = useRef<number | null>(null);
  const modeRef = useRef<Mode>(mode);
  modeRef.current = mode;

  const currentTrack = useMemo(
    () => TRACKS.find((item) => item.label === track) ?? TRACKS[0],
    [track],
  );

  const playAudio = useCallback((src?: string) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (src && audio.src !== new URL(src, window.location.href).href) {
      audio.src = src;
      audio.load();
    }

    audio.volume = 0.35;
    void audio.play().catch(() => {
      // Keep the user's on/off preference intact if the browser delays playback.
    });
  }, []);

  const unlockAlarm = useCallback(() => {
    const audioWindow = window as AudioWindow;
    const AudioContextClass =
      window.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextClass) return null;

    if (!alarmContextRef.current) {
      alarmContextRef.current = new AudioContextClass();
    }

    if (alarmContextRef.current.state === "suspended") {
      void alarmContextRef.current.resume();
    }

    return alarmContextRef.current;
  }, []);

  const playAlarm = useCallback(() => {
    audioRef.current?.pause();
    setMuted(true);
    localStorage.setItem("musicMuted", "true");

    const context = unlockAlarm();
    if (!context) return;

    const startAt = context.currentTime + 0.04;
    [0, 0.42, 0.84, 1.26].forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const t = startAt + offset;

      oscillator.type = "square";
      oscillator.frequency.setValueAtTime(index % 2 === 0 ? 880 : 660, t);
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.03);
      gain.gain.setValueAtTime(0.18, t + 0.22);
      gain.gain.linearRampToValueAtTime(0, t + 0.3);

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(t);
      oscillator.stop(t + 0.32);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  }, [unlockAlarm]);

  // Hydrate from localStorage
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage : null;
    if (!stored) return;

    const t = (stored.getItem("theme") as Theme) || "cream";
    setTheme(t);
    document.documentElement.dataset.theme = t;

    let nn = stored.getItem("nickname");
    if (!nn) {
      nn = randomNickname();
      stored.setItem("nickname", nn);
    }
    setNickname(nn);

    const countrySource = stored.getItem("countrySource");
    const savedCountry = stored.getItem("country");
    const fallbackCountry = savedCountry
      ? normalizeCountry(savedCountry)
      : detectCountry();
    setCountry(fallbackCountry);
    stored.setItem("country", fallbackCountry);

    if (countrySource !== "manual") {
      void fetch("/api/geo", { cache: "no-store" })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: GeoResponse | null) => {
          if (!data?.country) return;
          const geoCountry = normalizeCountry(data.country);
          setCountry(geoCountry);
          stored.setItem("country", geoCountry);
          stored.setItem("countrySource", "ip");
        })
        .catch(() => {
          // Browser language fallback remains in place.
        });
    }

    let id = stored.getItem("clientId");
    if (!id) {
      id = randomClientId();
      stored.setItem("clientId", id);
    }
    setClientId(id);

    const savedTrack = stored.getItem("musicTrack");
    if (savedTrack && TRACKS.some((item) => item.label === savedTrack)) {
      setTrack(savedTrack);
    }

    const savedMuted = stored.getItem("musicMuted");
    if (savedMuted) {
      setMuted(savedMuted === "true");
    }

    const date = stored.getItem("todayDate");
    const count = Number(stored.getItem("todayCount") || "0");
    if (date === todayUtc()) {
      setTodayCount(count);
    } else {
      stored.setItem("todayDate", todayUtc());
      stored.setItem("todayCount", "0");
    }
    setTodayDate(todayUtc());
  }, []);

  const changeTheme = useCallback((t: Theme) => {
    setTheme(t);
    document.documentElement.dataset.theme = t;
    localStorage.setItem("theme", t);
  }, []);

  useEffect(() => {
    if (!nickname) return;
    localStorage.setItem("nickname", nickname);
  }, [nickname]);

  useEffect(() => {
    if (!country) return;
    localStorage.setItem("country", normalizeCountry(country));
  }, [country]);

  useEffect(() => {
    if (!flagMenuOpen && !moreOpen) return;
    const closeOnOutside = (event: Event) => {
      if (!(event.target instanceof Node)) return;
      if (flagMenuOpen && !flagMenuRef.current?.contains(event.target)) {
        setFlagMenuOpen(false);
      }
      if (moreOpen && !moreMenuRef.current?.contains(event.target)) {
        setMoreOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setFlagMenuOpen(false);
        setMoreOpen(false);
      }
    };
    document.addEventListener("pointerdown", closeOnOutside, true);
    document.addEventListener("focusin", closeOnOutside, true);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside, true);
      document.removeEventListener("focusin", closeOnOutside, true);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [flagMenuOpen, moreOpen]);

  useEffect(() => {
    localStorage.setItem("todayCount", String(todayCount));
    localStorage.setItem("todayDate", todayDate);
  }, [todayCount, todayDate]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = 0.35;
    if (muted) {
      audio.pause();
      return;
    }

    playAudio(currentTrack.src);
  }, [currentTrack.src, muted, playAudio]);

  // Drift-resistant timer
  useEffect(() => {
    if (!running) return;
    if (endAtRef.current == null) {
      endAtRef.current = Date.now() + remaining * 1000;
    }
    const tick = () => {
      const end = endAtRef.current;
      if (end == null) return;
      const left = Math.max(0, Math.round((end - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) {
        setRunning(false);
        endAtRef.current = null;
        handleComplete();
      }
    };
    tick();
    const iv = window.setInterval(tick, 250);
    return () => window.clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const handleComplete = useCallback(async () => {
    playAlarm();

    if (modeRef.current !== "focus") {
      setMode("focus");
      setRemaining(DURATIONS.focus);
      return;
    }
    const next = todayCount + 1;
    setTodayCount(next);
    setMode("short");
    setRemaining(DURATIONS.short);

    if (!clientId) return;
    try {
      await fetch("/api/pomodoro/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, nickname, country }),
      });
      void loadBoard();
    } catch {
      // silent
    }
  }, [clientId, country, nickname, playAlarm, todayCount]);

  const toggleTimer = () => {
    if (running) {
      setRunning(false);
      endAtRef.current = null;
      return;
    }
    unlockAlarm();
    endAtRef.current = Date.now() + remaining * 1000;
    setRunning(true);
  };

  const resetTimer = () => {
    setRunning(false);
    endAtRef.current = null;
    setRemaining(DURATIONS[mode]);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setRunning(false);
    endAtRef.current = null;
    setRemaining(DURATIONS[m]);
  };

  const loadBoard = useCallback(async () => {
    try {
      const r = await fetch("/api/leaderboard/today", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { online: number; rows: Row[] };
      setRows(data.rows);
      setOnline(data.online);
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    void loadBoard();
    const iv = setInterval(loadBoard, 30_000);
    return () => clearInterval(iv);
  }, [loadBoard]);

  const displayRows = useMemo<Row[]>(() => {
    const meIn = rows.find((r) => r.nickname === nickname);
    const base: Row[] = meIn
      ? rows.map((r) =>
          r.nickname === nickname ? { ...r, me: true, country } : r,
        )
      : [
          ...rows,
          {
            rank: rows.length + 1,
            nickname: nickname || "you",
            country,
            count: todayCount,
            me: true,
          },
        ];
    return [...base]
      .sort((a, b) => b.count - a.count)
      .map((r, i) => ({ ...r, rank: i + 1 }));
  }, [rows, nickname, country, todayCount]);

  const selectCountry = (next: string) => {
    setCountry(normalizeCountry(next));
    localStorage.setItem("countrySource", "manual");
    setFlagMenuOpen(false);
  };

  const toggleMusic = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("musicMuted", String(next));

    if (next) {
      audioRef.current?.pause();
      return;
    }

    playAudio(currentTrack.src);
  };

  const changeTrack = (next: string) => {
    const nextTrack = TRACKS.find((item) => item.label === next);
    const shouldStayMuted = muted;

    setTrack(next);
    localStorage.setItem("musicTrack", next);
    localStorage.setItem("musicMuted", String(shouldStayMuted));

    if (shouldStayMuted) {
      audioRef.current?.pause();
      return;
    }

    setMuted(false);
    if (nextTrack) {
      playAudio(nextTrack.src);
    }
  };

  const target = 16;

  return (
    <main className="site">
      <div className="bar">
        <div className="brand">
          <span className="brand-mark" aria-hidden>
            <PotatoMark size={22} />
          </span>
          potato
        </div>
        <div className="bar-actions">
          <button
            className="bar-btn"
            onClick={() => {
              setMoreOpen(false);
              setFlagMenuOpen(false);
              setBoardOpen(true);
            }}
          >
            <LeaderboardBars size={14} />
            Leaderboard
          </button>
          <div className="more-wrap" ref={moreMenuRef}>
            <button
              className="icon-btn"
              onClick={() => {
                setFlagMenuOpen(false);
                setMoreOpen((open) => !open);
              }}
              aria-label="Open menu"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              type="button"
            >
              <i className="ti ti-dots" aria-hidden />
            </button>
            {moreOpen && (
              <div className="more-menu" role="menu" aria-label="Potato links">
                {BRAND_LINKS.map((link) => (
                  <a
                    key={link.label}
                    className="more-link"
                    href={link.href}
                    target={link.href.startsWith("http") ? "_blank" : undefined}
                    rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                    role="menuitem"
                    onClick={() => setMoreOpen(false)}
                  >
                    <i className={link.icon} aria-hidden />
                    {link.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="stage">
        <div className="modes">
          {(["focus", "short", "long"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => switchMode(m)}
              className={`mode${mode === m ? " on" : ""}`}
            >
              {m === "focus" ? "Focus" : m === "short" ? "Short break" : "Long break"}
            </button>
          ))}
        </div>

        <div className="time">{format(remaining)}</div>
        <div className="phase">{PHASE_LABELS[mode]}</div>

        <div className="controls">
          <button className="btn-primary" onClick={toggleTimer}>
            {running ? "Pause" : "Start"}
          </button>
          <button className="btn-ghost" onClick={resetTimer}>
            Reset
          </button>
        </div>

        <div className="tally">
          <span>Today</span>
          <div className="dots">
            {Array.from({ length: target }).map((_, i) => (
              <span key={i} className={`seed${i < todayCount ? " done" : ""}`} />
            ))}
          </div>
          <span>
            {todayCount} / {target}
          </span>
        </div>
      </div>

      <div className="themes">
        <span className="themes-label">Theme</span>
        {THEMES.map((t) => (
          <button
            key={t.key}
            className={`swatch${theme === t.key ? " on" : ""}`}
            style={{ background: t.swatch }}
            onClick={() => changeTheme(t.key)}
            aria-label={t.key}
          />
        ))}
      </div>

      <div className="music">
        <audio ref={audioRef} src={currentTrack.src} loop preload="auto" />
        <button className="mute" onClick={toggleMusic} aria-label="Toggle music">
          <i className={muted ? "ti ti-volume-off" : "ti ti-volume"} aria-hidden />
        </button>
        <select value={track} onChange={(e) => changeTrack(e.target.value)} aria-label="Ambient track">
          {TRACKS.map((t) => (
            <option key={t.label} value={t.label}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <aside className={`board${boardOpen ? " open" : ""}`}>
        <div className="board-head">
          <div>
            <h2>Global today</h2>
            <p className="board-sub">
              Resets 00:00 UTC · {online.toLocaleString()} online
            </p>
          </div>
          <button className="close" onClick={() => setBoardOpen(false)} aria-label="Close">
            ×
          </button>
        </div>

        <div className="name-card">
          <label>Your nickname</label>
          <div className="name-row">
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value.slice(0, 14))}
              maxLength={14}
            />
            <div className="flag-select" ref={flagMenuRef}>
              <button
                className="flag-pick"
                onClick={() => {
                  setMoreOpen(false);
                  setFlagMenuOpen((open) => !open);
                }}
                aria-label="Select country"
                aria-haspopup="listbox"
                aria-expanded={flagMenuOpen}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="flag" src={flagUrl(country)} alt={country.toUpperCase()} />
                <i className="ti ti-chevron-down" aria-hidden />
              </button>
              {flagMenuOpen && (
                <div className="flag-menu" role="listbox" aria-label="Countries">
                  {COUNTRY_OPTIONS.map((option) => (
                    <button
                      key={option.code}
                      className={`flag-option${option.code === country ? " selected" : ""}`}
                      onClick={() => selectCountry(option.code)}
                      role="option"
                      aria-selected={option.code === country}
                      type="button"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        className="flag"
                        src={flagUrl(option.code)}
                        alt={option.code.toUpperCase()}
                      />
                      <span>{option.name}</span>
                      <span className="country-code">{option.code.toUpperCase()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          {displayRows.map((r) => (
            <div key={r.nickname + r.rank} className={`row${r.me ? " me" : ""}`}>
              <span className="rank">{r.rank}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="flag" src={flagUrl(r.country)} alt={r.country.toUpperCase()} />
              <span className="name">
                {r.nickname}
                {r.me && <span className="you-tag">you</span>}
              </span>
              <span className="count">{r.count}</span>
            </div>
          ))}
        </div>
      </aside>
    </main>
  );
}
