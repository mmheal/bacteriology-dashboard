import { useState, useMemo, useEffect, useRef } from "react";
import confetti from "canvas-confetti";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine
} from "recharts";
import { 
  Search, 
  Filter, 
  Award, 
  Trophy, 
  RefreshCw, 
  BookOpen, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Globe, 
  ExternalLink,
  Layers,
  FlaskConical,
  Sparkles,
  Database,
  Info,
  Dna,
  FileText,
  Github,
  Mail,
  Volume2,
  VolumeX,
  History,
  Calendar,
  Timer
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { bacteriaData, Bacterium } from "./data/bacteria";
import { translations, getGramConfig, translateOxygen, translateCatalase } from "./utils/translate";
import { generateQuiz, Question, QuizDifficulty, QuizHistoryItem } from "./utils/quiz";

// Synthesized audio feedback engine using Web Audio API
const playQuizSoundEffect = (type: "click" | "success" | "fail") => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    if (type === "click") {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.08);
      
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "success") {
      // Pleasant double-ding success chime
      const playNote = (freq: number, start: number, duration: number) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, start);
        
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + duration);
      };
      
      playNote(523.25, now, 0.12);     // C5
      playNote(659.25, now + 0.06, 0.12); // E5
      playNote(783.99, now + 0.12, 0.15); // G5
      playNote(1046.50, now + 0.18, 0.3); // C6
    } else if (type === "fail") {
      // Disappointing sad interval
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = "triangle";
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.35);
      
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  } catch (e) {
    console.warn("Web Audio API is not supported or blocked in this context", e);
  }
};

const getTimerDuration = (diff: QuizDifficulty): number => {
  if (diff === "easy") return 10;
  if (diff === "medium") return 20;
  return 30; // Hard mode has 30 seconds per question
};

const getTimerColorClasses = (ratio: number) => {
  if (ratio > 0.5) {
    return {
      stroke: "#10b981", // emerald-500
      text: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20",
      glow: "shadow-[0_0_15px_rgba(16,185,129,0.25)]",
    };
  }
  if (ratio > 0.201) {
    return {
      stroke: "#f59e0b", // amber-500
      text: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20",
      glow: "shadow-[0_0_15px_rgba(245,158,11,0.25)]",
    };
  }
  return {
    stroke: "#f43f5e", // rose-500
    text: "text-rose-500 animate-pulse",
    bg: "bg-rose-500/10 border-rose-500/20",
    glow: "shadow-[0_0_15px_rgba(244,63,94,0.35)]",
  };
};

const CustomTrendTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-[#0b0f19] border border-indigo-500/30 p-3 rounded-lg shadow-2xl text-xs space-y-1 relative z-50">
        <p className="text-slate-400 font-mono text-[9.5px] mb-1">{data.date}</p>
        <div className="flex items-center gap-1.5">
          <span className="text-slate-300 font-bold">Score:</span>
          <span className="text-teal-400 font-black text-sm">{data.score} / {data.total}</span>
          <span className="text-slate-400">({data.percentage}%)</span>
        </div>
        <p className="text-[10px] text-slate-400">
          Level: <strong className={data.difficulty === "Easy" ? "text-emerald-400" : data.difficulty === "Medium" ? "text-amber-400" : "text-rose-400"}>{data.difficulty}</strong>
        </p>
      </div>
    );
  }
  return null;
};

export default function App() {
  // Navigation & Filtering Tabs
  const [activeTab, setActiveTab] = useState<"dashboard" | "quiz" | "stats">("dashboard");
  
  // Filtering States
  const [searchTerm, setSearchTerm] = useState("");
  const [gramFilter, setGramFilter] = useState<"all" | "gpos" | "gneg">("all");
  const [catalaseFilter, setCatalaseFilter] = useState<"all" | "positive" | "negative">("all");
  const [oxygenFilter, setOxygenFilter] = useState<string>("all");

  // Selected Bacterium for detailed modal
  const [selectedBacterium, setSelectedBacterium] = useState<Bacterium | null>(null);

  // Personal study notes state for the currently selected bacterium
  const [personalNotes, setPersonalNotes] = useState<string>("");
  const [isNotesSaved, setIsNotesSaved] = useState<boolean>(true);
  const [showSavedAnimation, setShowSavedAnimation] = useState<boolean>(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sync personal notes when selectedBacterium changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (selectedBacterium) {
      try {
        const savedNote = localStorage.getItem(`bacterium_notes_${selectedBacterium.id}`) || "";
        setPersonalNotes(savedNote);
        setIsNotesSaved(true);
        setShowSavedAnimation(false);
      } catch (e) {
        console.error("Failed to load notes", e);
        setPersonalNotes("");
        setIsNotesSaved(true);
        setShowSavedAnimation(false);
      }
    }
  }, [selectedBacterium]);

  const handleNotesChange = (text: string) => {
    setPersonalNotes(text);
    setIsNotesSaved(false);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (selectedBacterium) {
      debounceTimerRef.current = setTimeout(() => {
        try {
          localStorage.setItem(`bacterium_notes_${selectedBacterium.id}`, text);
          setIsNotesSaved(true);
          setShowSavedAnimation(true);
          // Hide saved overlay after 1.5 seconds
          setTimeout(() => {
            setShowSavedAnimation(false);
          }, 1500);
        } catch (e) {
          console.error("Failed to save notes", e);
        }
      }, 750); // 750ms debounce
    }
  };

  // Sound feedback states
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("bacteria_quiz_sound") !== "false";
    } catch {
      return true;
    }
  });

  const triggerSound = (type: "click" | "success" | "fail") => {
    if (soundEnabled) {
      playQuizSoundEffect(type);
    }
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem("bacteria_quiz_sound", String(next));
      } catch (e) {
        console.error("Local storage sound toggle error", e);
      }
      if (next) {
        setTimeout(() => playQuizSoundEffect("click"), 30);
      }
      return next;
    });
  };

  // Quiz States
  const [quizQuestions, setQuizQuestions] = useState<Question[]>([]);
  const [currentQuestionIdx, setCurrentQuestionIdx] = useState(0);
  const [quizScore, setQuizScore] = useState(0);
  const [quizStreak, setQuizStreak] = useState(0);
  const [selectedAnswerIdx, setSelectedAnswerIdx] = useState<number | null>(null);
  const [quizAnswered, setQuizAnswered] = useState(false);
  const [quizFinished, setQuizFinished] = useState(false);
  const [showingExplanation, setShowingExplanation] = useState(false);
  const [highScore, setHighScore] = useState<number>(() => {
    try {
      return Number(localStorage.getItem("bacteria_quiz_high_score") || "0");
    } catch {
      return 0;
    }
  });

  const [quizDifficulty, setQuizDifficulty] = useState<QuizDifficulty>(() => {
    try {
      return (localStorage.getItem("bacteria_quiz_difficulty") as QuizDifficulty) || "medium";
    } catch {
      return "medium";
    }
  });

  const [timedModeEnabled, setTimedModeEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem("bacteria_quiz_timed_mode") === "true";
    } catch {
      return false;
    }
  });

  const [timeLeft, setTimeLeft] = useState<number>(() => getTimerDuration(quizDifficulty));

  const handleTimeout = () => {
    if (quizAnswered) return;
    setSelectedAnswerIdx(-1); // -1 signifies timed out / no selection made
    setQuizAnswered(true);
    triggerSound("fail");
    setQuizStreak(0);
  };

  // Countdown timer for Timed Mode
  useEffect(() => {
    if (!timedModeEnabled || quizFinished || quizAnswered || activeTab !== "quiz" || quizQuestions.length === 0) {
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // Run timeout handling in a deferred execution or just immediately.
          // React state updates during rendering can be tricky, so let's call handleTimeout.
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timedModeEnabled, quizFinished, quizAnswered, activeTab, quizQuestions.length, currentQuestionIdx]);

  // Celebrate high-score quiz achievements with canvas-confetti bursts!
  useEffect(() => {
    if (quizFinished && quizQuestions.length > 0) {
      const percentage = (quizScore / quizQuestions.length) * 100;
      if (percentage >= 80) {
        try {
          const duration = 2.5 * 1000;
          const animationEnd = Date.now() + duration;
          const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1000 };

          const randomInRange = (min: number, max: number) => {
            return Math.random() * (max - min) + min;
          };

          // Primary centered celebration burst
          confetti({
            particleCount: 150,
            spread: 85,
            origin: { y: 0.6 }
          });

          // Follow-up celebratory side fountains
          const interval = setInterval(() => {
            const timeLeftRemaining = animationEnd - Date.now();

            if (timeLeftRemaining <= 0) {
              return clearInterval(interval);
            }

            const particleCount = 45 * (timeLeftRemaining / duration);
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
            confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
          }, 250);
        } catch (e) {
          console.error("Confetti particle trigger failed", e);
        }
      }
    }
  }, [quizFinished, quizScore, quizQuestions.length]);

  const [quizHistory, setQuizHistory] = useState<QuizHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem("bacteria_quiz_history");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const trendData = useMemo(() => {
    return quizHistory
      .slice(0, 10)
      .reverse()
      .map((item, index) => ({
        name: `#${index + 1}`,
        date: item.date,
        score: item.score,
        total: item.total,
        percentage: Math.round((item.score / item.total) * 100),
        difficulty: item.difficulty.charAt(0).toUpperCase() + item.difficulty.slice(1)
      }));
  }, [quizHistory]);

  const addQuizToHistory = (score: number, total: number, difficulty: QuizDifficulty) => {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const day = String(now.getDate()).padStart(2, '0');
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const formattedDate = `${year}/${month}/${day} ${hours}:${minutes}`;

      const newHistoryItem: QuizHistoryItem = {
        id: Math.random().toString(36).substring(2, 11),
        date: formattedDate,
        score,
        total,
        difficulty
      };

      setQuizHistory(prev => {
        const next = [newHistoryItem, ...prev].slice(0, 50);
        try {
          localStorage.setItem("bacteria_quiz_history", JSON.stringify(next));
        } catch (e) {
          console.error("Local storage error saving history", e);
        }
        return next;
      });
    } catch (e) {
      console.error("Error adding quiz to history", e);
    }
  };

  // Handle Quiz Generation
  const startNewQuiz = (diff: QuizDifficulty = quizDifficulty) => {
    const qList = generateQuiz(bacteriaData, diff);
    setQuizQuestions(qList);
    setCurrentQuestionIdx(0);
    setQuizScore(0);
    setQuizStreak(0);
    setSelectedAnswerIdx(null);
    setQuizAnswered(false);
    setQuizFinished(false);
    setShowingExplanation(false);
    setTimeLeft(getTimerDuration(diff));
  };

  const handleDifficultyChange = (newDiff: QuizDifficulty) => {
    setQuizDifficulty(newDiff);
    try {
      localStorage.setItem("bacteria_quiz_difficulty", newDiff);
    } catch (e) {
      console.error(e);
    }
    startNewQuiz(newDiff);
  };

  const toggleTimedMode = () => {
    setTimedModeEnabled(prev => {
      const next = !prev;
      try {
        localStorage.setItem("bacteria_quiz_timed_mode", next ? "true" : "false");
      } catch (e) {
        console.error(e);
      }
      return next;
    });
    triggerSound("click");
    setTimeLeft(getTimerDuration(quizDifficulty));
  };

  useEffect(() => {
    startNewQuiz(quizDifficulty);
  }, []);

  // Filter bacterial data dynamically
  const filteredBacteria = useMemo(() => {
    return bacteriaData.filter((b) => {
      const matchSearch = 
        searchTerm === "" ||
        b.faName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.latinName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.diseases.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.treatment.toLowerCase().includes(searchTerm.toLowerCase()) ||
        b.shape.toLowerCase().includes(searchTerm.toLowerCase());

      const matchGram = gramFilter === "all" || b.gram === gramFilter;
      const matchCatalase = catalaseFilter === "all" || b.catalase === catalaseFilter;
      const matchOxygen = oxygenFilter === "all" || b.oxygen === oxygenFilter;

      return matchSearch && matchGram && matchCatalase && matchOxygen;
    });
  }, [searchTerm, gramFilter, catalaseFilter, oxygenFilter]);

  // General counts for quick summary boxes
  const statsSummary = useMemo(() => {
    const total = bacteriaData.length;
    const gpos = bacteriaData.filter(b => b.gram === "gpos").length;
    const gneg = bacteriaData.filter(b => b.gram === "gneg").length;
    const catPos = bacteriaData.filter(b => b.catalase === "positive").length;
    const catNeg = bacteriaData.filter(b => b.catalase === "negative").length;
    
    // oxygen requirements
    const aerobic = bacteriaData.filter(b => b.oxygen === "aerobic").length;
    const anaerobic = bacteriaData.filter(b => b.oxygen === "anaerobic").length;
    const facultative = bacteriaData.filter(b => b.oxygen === "facultative").length;
    const microaerophilic = bacteriaData.filter(b => b.oxygen === "microaerophilic").length;

    return { total, gpos, gneg, catPos, catNeg, aerobic, anaerobic, facultative, microaerophilic };
  }, []);

  // Quiz response logic
  const handleAnswerSubmit = (optionIdx: number) => {
    if (quizAnswered) return;
    setSelectedAnswerIdx(optionIdx);
    setQuizAnswered(true);

    const currentQuestion = quizQuestions[currentQuestionIdx];
    if (optionIdx === currentQuestion.correctAnswerIndex) {
      triggerSound("success");
      setQuizScore(prev => prev + 1);
      setQuizStreak(prev => {
        const next = prev + 1;
        if (next > highScore) {
          // New high score can be calculated either by strict streak or score. Let's do score!
        }
        return next;
      });
    } else {
      triggerSound("fail");
      setQuizStreak(0);
    }
  };

  const handleNextQuestion = () => {
    triggerSound("click");
    if (currentQuestionIdx + 1 < quizQuestions.length) {
      setCurrentQuestionIdx(prev => prev + 1);
      setSelectedAnswerIdx(null);
      setQuizAnswered(false);
      setShowingExplanation(false);
      setTimeLeft(getTimerDuration(quizDifficulty));
    } else {
      setQuizFinished(true);
      addQuizToHistory(quizScore, quizQuestions.length, quizDifficulty);
      if (quizScore > highScore) {
        setHighScore(quizScore);
        try {
          localStorage.setItem("bacteria_quiz_high_score", String(quizScore));
        } catch (e) {
          console.error("Local storage error", e);
        }
      }
    }
  };

  const downloadOfflineHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>دانش‌نامه آفلاین باکتری‌شناسی پزشکی</title>
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Vazirmatn:wght@300;400;500;700;900&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
    <!-- Tailwind CSS CDN -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Vazirmatn', 'ui-sans-serif', 'system-ui', 'sans-serif'],
                        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #0b0f19;
            font-family: 'Vazirmatn', sans-serif;
            margin: 0;
            color: #e6edf3;
        }
        .mesh-bg {
            background: radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.15) 0, transparent 55%),
                        radial-gradient(at 100% 100%, rgba(244, 63, 94, 0.12) 0, transparent 55%),
                        radial-gradient(at 50% 50%, rgba(15, 23, 42, 1) 0, transparent 100%);
            background-color: #0d1117;
            min-height: 100vh;
        }
        .glass {
            background: rgba(255, 255, 255, 0.03);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .glass-heavy {
            background: rgba(10, 14, 22, 0.75);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.12);
        }
    </style>
</head>
<body class="mesh-bg min-h-screen text-[#e6edf3] font-sans antialiased selection:bg-purple-600 selection:text-white pb-12">
    <!-- BACKGROUND GLOWS -->
    <div class="fixed top-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none z-0"></div>
    <div class="fixed top-1/3 right-1/4 w-[400px] h-[400px] bg-rose-900/10 rounded-full blur-3xl pointer-events-none z-0"></div>

    <div class="relative z-10">
        <!-- MAIN STICKY HEADER -->
        <header class="sticky top-0 z-40 glass-heavy border-b border-white/10 transition-all duration-300 shadow-xl">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <span class="text-3xl sm:text-4xl animate-pulse">🦠</span>
                    <div>
                        <h1 class="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-400 via-teal-300 to-rose-400 bg-clip-text text-transparent">
                            دانش‌نامه باکتری‌شناسی پزشکی (نسخه آفلاین)
                        </h1>
                        <p class="text-xs text-[#8b949e] font-medium mt-1">
                            سیستم تک‌فایله قابل حمل و بی‌نیاز به اینترنت - بانک جامع میکروب‌شناسی
                        </p>
                    </div>
                </div>

                <!-- Navigation Tabs -->
                <div class="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
                    <button onclick="switchTab('dashboard')" id="tab-dashboard" class="tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 bg-white/10 text-teal-300 border border-white/5 shadow-inner">
                        <span>بانک اطلاعاتی باکتری‌ها</span>
                    </button>
                    <button onclick="switchTab('quiz')" id="tab-quiz" class="tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5">
                        <span>Test</span>
                        <span class="bg-purple-900/40 text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-700/30">کوییز</span>
                    </button>
                    <button onclick="switchTab('stats')" id="tab-stats" class="tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5">
                        <span>تحلیل و آمار بیولوژی</span>
                    </button>
                </div>
            </div>
        </header>

        <!-- LEGEND & INFORMATIONAL BAR -->
        <div class="glass border-t-0 border-r-0 border-l-0 border-b border-white/5 py-2 px-4 text-xs">
            <div class="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
                <div class="flex flex-wrap items-center gap-4 text-[#8b949e]">
                    <span class="flex items-center gap-1.5 font-medium">
                        <span class="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
                        گرم‌مثبت (G+)
                    </span>
                    <span class="flex items-center gap-1.5 font-medium">
                        <span class="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
                        گرم‌منفی (G-)
                    </span>
                    <span class="flex items-center gap-1.5 font-medium">
                        <span class="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                        کاتالاز مثبت (Cat+)
                    </span>
                    <span class="flex items-center gap-1.5 font-medium">
                        <span class="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
                        کاتالاز منفی (Cat-)
                    </span>
                </div>
                <div class="text-[#8b949e] flex items-center gap-1">
                    <span class="text-teal-400 font-bold">⚡ نسخه آفلاین مجهز به کلیه اطلاعات و محاسبات خودکار</span>
                </div>
            </div>
        </div>

        <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            
            <!-- SECTION 1: DASHBOARD -->
            <section id="sect-dashboard" class="space-y-6">
                <!-- Advanced Stats Highlights -->
                <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div class="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg">
                        <div class="p-2.5 bg-teal-950/60 border border-teal-800/50 rounded-xl text-teal-400">
                            📊
                        </div>
                        <div>
                            <span class="text-[10px] text-[#8b949e] block font-medium">کل ارگانیسم‌ها</span>
                            <strong id="badge-total" class="text-lg text-white font-extrabold">-</strong>
                        </div>
                    </div>
                    <div class="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg">
                        <div class="p-2.5 bg-purple-950/60 border border-purple-800/50 rounded-xl text-purple-400">
                            <span class="text-sm font-bold">G+</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-[#8b949e] block font-medium">باکتری‌های گرم‌مثبت</span>
                            <strong id="badge-gpos" class="text-lg text-purple-300 font-extrabold">-</strong>
                        </div>
                    </div>
                    <div class="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg">
                        <div class="p-2.5 bg-rose-950/60 border border-rose-800/50 rounded-xl text-rose-400">
                            <span class="text-sm font-bold">G-</span>
                        </div>
                        <div>
                            <span class="text-[10px] text-[#8b949e] block font-medium">باکتری‌های گرم‌منفی</span>
                            <strong id="badge-gneg" class="text-lg text-rose-300 font-extrabold">-</strong>
                        </div>
                    </div>
                    <div class="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg">
                        <div class="p-2.5 bg-amber-950/60 border border-amber-800/50 rounded-xl text-amber-400">
                            🧪
                        </div>
                        <div>
                            <span class="text-[10px] text-[#8b949e] block font-medium">کاتالاز مثبت</span>
                            <strong id="badge-cat" class="text-lg text-amber-300 font-extrabold">-</strong>
                        </div>
                    </div>
                </div>

                <!-- Filters panel -->
                <div class="glass rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
                    <div class="flex flex-col lg:flex-row items-center gap-4">
                        <div class="relative w-full lg:flex-1">
                            <input
                                type="text"
                                id="search-input"
                                oninput="onFilterChange()"
                                placeholder="🔍  جستجوی نام باکتری، بیماری، درمان یا کلمه کلیدی…"
                                class="w-full pr-11 pl-4 py-2.5 bg-black/35 border border-white/10 rounded-xl text-[#e6edf3] text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 focus:bg-black/50 transition-all placeholder:text-[#586069]"
                            />
                        </div>
                        <!-- Filters Selects -->
                        <div class="flex flex-wrap items-center justify-end gap-3 w-full lg:w-auto">
                            <div class="flex items-center gap-1.5 font-sans">
                                <span class="text-[11px] text-[#8b949e] font-bold">رنگ‌آمیزی:</span>
                                <select id="filter-gram" onchange="onFilterChange()" class="bg-[#12161f] border border-white/10 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]">
                                    <option value="all">همه</option>
                                    <option value="gpos">گرم‌مثبت (G+)</option>
                                    <option value="gneg">گرم‌منفی (G-)</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-1.5 font-sans">
                                <span class="text-[11px] text-[#8b949e] font-bold">کاتالاز:</span>
                                <select id="filter-catalase" onchange="onFilterChange()" class="bg-[#12161f] border border-white/10 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]">
                                    <option value="all">همه</option>
                                    <option value="positive">کاتالاز مثبت</option>
                                    <option value="negative">کاتالاز منفی</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-1.5 font-sans">
                                <span class="text-[11px] text-[#8b949e] font-bold">شرایط اکسیژن:</span>
                                <select id="filter-oxygen" onchange="onFilterChange()" class="bg-[#12161f] border border-white/15 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]">
                                    <option value="all">همه</option>
                                    <option value="aerobic">هوازی اجباری</option>
                                    <option value="anaerobic">بی‌هوازی اجباری</option>
                                    <option value="facultative">بی‌هوازی اختیاری</option>
                                    <option value="microaerophilic">میکروآئروفیلیک</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Cards Grid -->
                <div id="grid-bacteria" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <!-- Cards injected live by JS -->
                </div>

                <div id="no-results" class="hidden col-span-full py-16 text-center glass rounded-2xl">
                    <span class="text-4xl block mb-3">🔬</span>
                    <h4 class="text-lg font-bold text-[#e6edf3]">هیچ باکتری با مقادیر جستجوشده یافت نشد!</h4>
                    <p class="text-xs text-[#8b949e] mt-1.5 max-w-md mx-auto leading-relaxed">
                        لطفاً دیکته واژگان یا فیلترهای بالا را بازنگری و مجدداً امتحان کنید.
                    </p>
                </div>
            </section>

            <!-- SECTION 2: QUIZ (TEST) -->
            <section id="sect-quiz" class="hidden max-w-2xl mx-auto space-y-6">
                <div class="glass bg-purple-950/20 border border-purple-800/35 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 shadow-xl">
                    <div class="w-14 h-14 rounded-2xl bg-purple-900/50 flex items-center justify-center border border-purple-700 shrink-0">
                        🏆
                    </div>
                    <div class="space-y-1 text-center sm:text-right">
                        <h3 class="text-sm sm:text-base font-extrabold text-white">آزمون جامع باکتری‌شناسی پزشکی</h3>
                        <p class="text-[11px] text-[#8b949e] leading-relaxed">
                            سطح فنوتیپی، محیط کشت‌های متمایز، رنگ آمیزی گرم، کاتالاز و عفونت زایی خود را آزمایش نمایید.
                        </p>
                    </div>
                </div>

                <!-- Quiz Main Game Panel -->
                <div id="quiz-game-panel" class="glass rounded-2xl overflow-hidden shadow-2xl">
                    <div class="px-5 py-4 bg-black/35 border-b border-white/5 flex items-center justify-between text-xs">
                        <span class="text-[#8b949e]">
                            سوال <strong id="quiz-curr-idx" class="text-[#e6edf3]">-</strong> از <strong class="text-[#e6edf3]">۱۰</strong>
                        </span>
                        <div class="flex items-center gap-4 text-[11px]">
                            <span class="text-amber-400 font-bold" id="quiz-display-streak">زنجیره پاسخ: ۰</span>
                            <span class="text-emerald-400 font-black" id="quiz-display-score">امتیاز: ۰</span>
                        </div>
                    </div>

                    <!-- Progress bar -->
                    <div class="w-full bg-[#0a0d16]/40 h-1.5">
                        <div id="quiz-progress-bar" class="bg-gradient-to-r from-purple-500 to-teal-400 h-full transition-all duration-300" style="width: 10%"></div>
                    </div>

                    <!-- Main Question and Choices -->
                    <div class="p-5 sm:p-6 space-y-6">
                        <h4 id="quiz-question-text" class="text-sm sm:text-base font-bold text-white leading-relaxed">سوال نمونه؟</h4>
                        <div id="quiz-options-container" class="grid grid-cols-1 gap-3">
                            <!-- Injected button options -->
                        </div>

                        <!-- Feedback Panel -->
                        <div id="quiz-feedback-panel" class="hidden p-4 rounded-xl space-y-2">
                            <div class="flex items-center gap-2 font-bold" id="quiz-feedback-title"></div>
                            <p id="quiz-feedback-explanation" class="text-[11px] text-[#8b949e] font-mono leading-relaxed p-2 bg-black/40 rounded-md border border-white/5"></p>
                        </div>
                    </div>

                    <!-- Actions footer -->
                    <div id="quiz-actions" class="hidden px-5 py-4 bg-black/30 border-t border-white/5 flex justify-end">
                        <button onclick="nextQuestion()" class="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-purple-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:scale-[1.02] transition-transform">
                            <span>سوال بعدی ⬅️</span>
                        </button>
                    </div>
                </div>

                <!-- Quiz Scoreboard Result Screen -->
                <div id="quiz-result-panel" class="hidden glass rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl">
                    <span class="text-5xl block animate-bounce">🎓</span>
                    <div class="space-y-2">
                        <h4 class="text-xl font-black text-white">آزمون به پایان رسید!</h4>
                        <p class="text-xs text-[#8b949e]">نتایج کسب شده در این دوره آزمون:</p>
                    </div>

                    <div class="inline-grid grid-cols-2 gap-4 max-w-xs mx-auto text-right w-full">
                        <div class="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                            <span class="text-[10px] text-[#484f58] block">بالاترین امتیاز آزمون</span>
                            <strong id="quiz-result-high" class="text-lg text-amber-300 font-extrabold">۰ از ۱۰</strong>
                        </div>
                        <div class="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                            <span class="text-[10px] text-[#484f58] block">درصد پاسخ صحیح</span>
                            <strong id="quiz-result-percent" class="text-lg text-purple-300 font-extrabold">۰٪</strong>
                        </div>
                    </div>

                    <div class="flex justify-center gap-3">
                        <button onclick="startNewQuiz()" class="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 text-[#e6edf3] font-bold rounded-xl text-xs sm:text-sm transition-all shadow-md">
                            <span>شروع آزمون مجدد 🔄</span>
                        </button>
                    </div>
                </div>
            </section>

            <!-- SECTION 3: STATISTICS -->
            <section id="sect-stats" class="hidden space-y-6">
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="glass rounded-2xl p-5 space-y-4 shadow-xl">
                        <div class="flex items-center gap-2 text-purple-400">
                            🧬
                            <h4 class="font-bold text-sm sm:text-base text-[#e6edf3]">توزیع رنگ‌آمیزی گرم</h4>
                        </div>
                        <p class="text-xs text-[#8b949e] leading-relaxed">
                            درصد کلی باکتری‌های گرم مثبت در باز و بسته شدن منافذ با رنگ‌آمیزی بنفش کریستال ویوله در مقایسه با ارگانیسم‌های گرم منفی.
                        </p>
                        <div class="space-y-3.5 text-xs text-[#e6edf3]">
                            <div>
                                <div class="flex justify-between font-medium mb-1">
                                    <span class="font-bold text-purple-300">گرم مثبت</span>
                                    <span id="stat-gpos" class="text-[#8b949e]">-</span>
                                </div>
                                <div class="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                                    <div id="stat-gpos-progress" class="h-full bg-purple-500 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between font-medium mb-1">
                                    <span class="font-bold text-rose-300">گرم منفی</span>
                                    <span id="stat-gneg" class="text-[#8b949e]">-</span>
                                </div>
                                <div class="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                                    <div id="stat-gneg-progress" class="h-full bg-rose-500 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass rounded-2xl p-5 space-y-4 shadow-xl">
                        <div class="flex items-center gap-2 text-amber-400">
                            🧪
                            <h4 class="font-bold text-sm sm:text-base text-[#e6edf3]">تست آنزیم کاتالاز</h4>
                        </div>
                        <p class="text-xs text-[#8b949e] leading-relaxed">
                            تجزیه هیدروژن پراکسید (H2O2) به آب و اکسیژن که حباب‌های مشخص ایجاد می‌کند. تستی حیاتی برای تفکیک کوکسی‌های گرم مثبت.
                        </p>
                        <div class="space-y-3.5 text-xs text-[#e6edf3]">
                            <div>
                                <div class="flex justify-between font-medium mb-1">
                                    <span class="font-bold text-amber-300">کاتالاز مثبت</span>
                                    <span id="stat-cat-pos" class="text-[#8b949e]">-</span>
                                </div>
                                <div class="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                                    <div id="stat-cat-pos-progress" class="h-full bg-amber-400 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                            <div>
                                <div class="flex justify-between font-medium mb-1">
                                    <span class="font-bold text-slate-400">کاتالاز منفی</span>
                                    <span id="stat-cat-neg" class="text-[#8b949e]">-</span>
                                </div>
                                <div class="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                                    <div id="stat-cat-neg-progress" class="h-full bg-slate-500 rounded-full" style="width: 0%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="glass rounded-2xl p-5 space-y-4 shadow-xl">
                        <div class="flex items-center gap-2 text-teal-400">
                            🌍
                            <h4 class="font-bold text-sm sm:text-base text-[#e6edf3]">سازگاری با اکسیژن</h4>
                        </div>
                        <p class="text-xs text-[#8b949e] leading-relaxed">
                            میزان پراکندگی انواع باکتری‌ها از نظر نیاز تنفسی بیوشیمیایی در اتمسفرهای گوناگون رشد.
                        </p>
                        <div class="space-y-2.5 text-xs">
                            <div class="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                                <span class="text-teal-300 font-bold">بی‌هوازی اختیاری</span>
                                <strong id="stat-ox-fac" class="text-white">-</strong>
                            </div>
                            <div class="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                                <span class="text-rose-400 font-bold">بی‌هوازی اجباری</span>
                                <strong id="stat-ox-ana" class="text-white">-</strong>
                            </div>
                            <div class="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                                <span class="text-blue-300 font-bold">هوازی</span>
                                <strong id="stat-ox-aer" class="text-white">-</strong>
                            </div>
                            <div class="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                                <span class="text-purple-300 font-bold">میکروآئروفیلیک</span>
                                <strong id="stat-ox-mic" class="text-white">-</strong>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="glass rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
                    <div class="flex items-center gap-2 text-indigo-400">
                        📄
                        <h4 class="font-bold text-[#e6edf3]">راهنمای تست‌های بیوشیمیایی و محیط کشت انتخابی</h4>
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                        <div class="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                            <h5 class="font-bold text-teal-400 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                                محیط مانیتول سالت آگار (MSA)
                            </h5>
                            <p class="text-[#8b949e] leading-relaxed">
                                محیطی انتخابی و متمایزکننده غنی از نمک (7.5% NaCl) برای جداسازی استافیلوکوکوس‌ها. تخمیر کننده مانیتول مسبب تغییر رنگ محیط به زرد می‌شود.
                            </p>
                        </div>
                        <div class="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                            <h5 class="font-bold text-purple-400 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                                محیط مک‌کانکی آگار (MacConkey)
                            </h5>
                            <p class="text-[#8b949e] leading-relaxed">
                                برای جداسازی باسیل‌های گرم‌منفی براساس تخمیر قند لاکتوز. ارگانیسم‌های تخمیر کننده لاکتوز روی آن کلونی ارغوانی/صورتی تولید می‌کنند.
                            </p>
                        </div>
                        <div class="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                            <h5 class="font-bold text-rose-400 flex items-center gap-1.5">
                                <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                تست همولیز بلاد آگار (Blood Agar)
                            </h5>
                            <p class="text-[#8b949e] leading-relaxed">
                                تفکیک استرپتوکوکوس‌ها براساس قدرت تخریب هموگلوبین: آلفا (همولیز ناقص و سبز رنگ)، بتا (همولیز کامل شفاف)، گاما (فقدان همولیز).
                            </p>
                        </div>
                    </div>
                </div>
            </section>
        </main>

        <!-- FOOTER -->
        <footer class="mt-12 glass border-r-0 border-l-0 border-b-0 border-t border-white/5 py-8 text-center text-xs text-[#8b949e] space-y-2 relative z-10">
            <p class="max-w-md mx-auto leading-relaxed px-4">
                این فایل بطور کاملاً اختصاصی و خودمختار همگام با آخرین سرفصل آزمون بورد باکتری‌شناسی صادر شده است.
            </p>
            <p class="text-[10px] text-[#484f58] font-mono">
                صادر شده بصورت آفلاین با معماری Zero-Dependency
            </p>
        </footer>
    </div>

    <!-- MAIN MODAL POPUP -->
    <div id="bacteria-modal" class="hidden fixed inset-0 z-50 flex items-center justify-center p-4">
        <!-- Backdrop -->
        <div onclick="closeModal()" class="fixed inset-0 bg-[#040609]/75 backdrop-blur-sm"></div>

        <!-- Modal Content Container -->
        <div class="relative w-full max-w-2xl glass-heavy border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 p-0 text-right max-h-[90vh] flex flex-col">
            <!-- Top colors band -->
            <div id="modal-color-strip" class="h-1.5 w-full bg-gradient-to-l from-indigo-500 to-purple-600"></div>

            <!-- Header -->
            <div class="p-5 sm:p-6 bg-black/20 border-b border-white/5 flex items-center justify-between">
                <div class="flex items-center gap-4">
                    <div id="modal-icon" class="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0 leading-none">
                        🦠
                    </div>
                    <div>
                        <h3 id="fa-name" class="text-base sm:text-lg font-black text-white">نام باکتری</h3>
                        <p id="latin-name" class="text-xs text-[#8b949e] italic font-mono font-medium mt-0.5">Latin Name</p>
                    </div>
                </div>
                <button onclick="closeModal()" class="p-2 bg-white/5 hover:bg-white/10 text-[#8b949e] hover:text-[#e6edf3] rounded-lg transition-colors leading-none">
                    ✕
                </button>
            </div>

            <!-- Body (Scrollable) -->
            <div class="p-5 sm:p-6 space-y-6 overflow-y-auto text-xs">
                <!-- Badges block -->
                <div class="flex flex-wrap gap-2" id="modal-badges"></div>

                <!-- Grid specs -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                        <span class="text-xs text-teal-400 font-bold block">🔬 ریخت‌شناسی (شکل)</span>
                        <p id="modal-shape" class="text-[#e6edf3] text-xs leading-relaxed">-</p>
                    </div>
                    <div class="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                        <span class="text-xs text-amber-400 font-bold block">🌍 زیستگاه طبیعی</span>
                        <p id="modal-habitat" class="text-[#e6edf3] text-xs leading-relaxed">-</p>
                    </div>
                    <div id="item-colony" class="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl md:col-span-2">
                        <span class="text-xs text-purple-400 font-bold block">🏘 ویژگی‌های کلونی / تست‌ها</span>
                        <p id="modal-colony" class="text-[#e6edf3] text-xs leading-relaxed">-</p>
                    </div>
                    <div class="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl md:col-span-2">
                        <span class="text-xs text-indigo-400 font-bold block">🧫 محیط کشت انتخابی</span>
                        <p id="modal-medium" class="text-[#e6edf3] text-xs tracking-wide">-</p>
                    </div>
                </div>

                <!-- Medical implications -->
                <div class="space-y-4 pt-2">
                    <div class="p-4 bg-rose-950/20 border border-rose-900/30 rounded-xl space-y-2">
                        <h4 class="font-bold text-[#e6edf3] text-xs flex items-center gap-2 text-rose-300">
                            <span>🦠 بیماری‌های ایجادشده</span>
                        </h4>
                        <p id="modal-diseases" class="text-rose-200/90 leading-relaxed font-sans"></p>
                    </div>
                    <div class="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl space-y-2">
                        <h4 class="font-bold text-[#e6edf3] text-xs flex items-center gap-2 text-emerald-300">
                            <span>💊 آنتی‌بیوتیک / درمان و مقاومت</span>
                        </h4>
                        <p id="modal-treatment" class="text-emerald-200/90 leading-relaxed font-sans"></p>
                    </div>
                </div>

                <!-- Web searches indicators -->
                <div class="flex items-center gap-1.5 pt-2 text-[#8b949e]">
                    <span>مطالعه بیشتر:</span>
                    <a id="wiki-fa" href="#" target="_blank" class="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-[#e6edf3] font-bold decoration-none transition-all">
                        ویکی‌پدیا (FA) 📖
                    </a>
                    <a id="wiki-en" href="#" target="_blank" class="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-[#e6edf3] font-bold decoration-none transition-all">
                        Wikipedia (EN)
                    </a>
                </div>
            </div>

            <!-- Footer actions -->
            <div class="p-4 sm:p-5 bg-black/20 border-t border-white/5 flex items-center justify-between gap-4">
                <button onclick="closeModal()" class="px-5 py-2 bg-white/5 hover:bg-white/10 text-[#8b949e] hover:text-[#e6edf3] text-xs sm:text-sm font-bold rounded-xl transition-all">
                    بستن پنجره
                </button>
            </div>
        </div>
    </div>


    <!-- JAVASCRIPT STATE ENGINE -->
    <script>
        // Inject compiled datasets directly
        const bacteriaData = ${JSON.stringify(bacteriaData)};
        
        let activeTab = 'dashboard';
        let highScore = parseInt(localStorage.getItem('off_highscore') || '0');
        let currentQuizQuestions = [];
        let currentQuizIndex = 0;
        let currentQuizScore = 0;
        let currentQuizStreak = 0;
        let quizAnswered = false;

        // On document load
        window.addEventListener('DOMContentLoaded', () => {
            renderDashboard();
            updateDashboardStats();
            updateQuizHighScoresUI();
        });

        function switchTab(tabId) {
            activeTab = tabId;
            
            // Hide all tabs
            document.getElementById('sect-dashboard').classList.add('hidden');
            document.getElementById('sect-quiz').classList.add('hidden');
            document.getElementById('sect-stats').classList.add('hidden');

            // Deactivate buttons
            document.querySelectorAll('.tab-btn').forEach(btn => {
                btn.className = "tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5";
            });

            // Show active
            document.getElementById('sect-' + tabId).classList.remove('hidden');

            // Style active buttons
            const activeBtn = document.getElementById('tab-' + tabId);
            let themeClass = " bg-white/10 border border-white/5 shadow-inner ";
            if (tabId === 'dashboard') {
                activeBtn.className = "tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200" + themeClass + "text-teal-300";
            } else if (tabId === 'quiz') {
                activeBtn.className = "tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200" + themeClass + "text-purple-300";
                startNewQuiz();
            } else if (tabId === 'stats') {
                activeBtn.className = "tab-btn flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200" + themeClass + "text-rose-300";
                renderStatisticsTab();
            }
        }

        function updateDashboardStats() {
            const stats = calculateStats();
            document.getElementById('badge-total').textContent = stats.total;
            document.getElementById('badge-gpos').textContent = stats.gpos;
            document.getElementById('badge-gneg').textContent = stats.gneg;
            document.getElementById('badge-cat').textContent = stats.catPos;
        }

        function calculateStats() {
            const total = bacteriaData.length;
            const gpos = bacteriaData.filter(b => b.gram === 'gpos').length;
            const gneg = bacteriaData.filter(b => b.gram === 'gneg').length;
            const catPos = bacteriaData.filter(b => b.catalase === 'positive').length;
            const catNeg = bacteriaData.filter(b => b.catalase === 'negative').length;
            const aerobic = bacteriaData.filter(b => b.oxygen === 'aerobic').length;
            const anaerobic = bacteriaData.filter(b => b.oxygen === 'anaerobic').length;
            const facultative = bacteriaData.filter(b => b.oxygen === 'facultative').length;
            const microaerophilic = bacteriaData.filter(b => b.oxygen === 'microaerophilic').length;

            return { total, gpos, gneg, catPos, catNeg, aerobic, anaerobic, facultative, microaerophilic };
        }

        function renderDashboard() {
            const grid = document.getElementById('grid-bacteria');
            grid.innerHTML = '';

            const searchVal = document.getElementById('search-input').value.toLowerCase().trim();
            const gramVal = document.getElementById('filter-gram').value;
            const catalaseVal = document.getElementById('filter-catalase').value;
            const oxygenVal = document.getElementById('filter-oxygen').value;

            // Filter
            const filtered = bacteriaData.filter(b => {
                const matchSearch = searchVal === '' || 
                    b.faName.toLowerCase().includes(searchVal) ||
                    b.latinName.toLowerCase().includes(searchVal) ||
                    b.diseases.toLowerCase().includes(searchVal) ||
                    b.treatment.toLowerCase().includes(searchVal) ||
                    b.shape.toLowerCase().includes(searchVal);

                const matchGram = gramVal === 'all' || b.gram === gramVal;
                const matchCatalase = catalaseVal === 'all' || b.catalase === catalaseVal;
                const matchOxygen = oxygenVal === 'all' || b.oxygen === oxygenVal;

                return matchSearch && matchGram && matchCatalase && matchOxygen;
            });

            if (filtered.length === 0) {
                document.getElementById('no-results').classList.remove('hidden');
                return;
            } else {
                document.getElementById('no-results').classList.add('hidden');
            }

            // Render cards
            filtered.forEach(b => {
                const isGpos = b.gram === 'gpos';
                const gramText = isGpos ? 'Gram-Positive (G+)' : 'Gram-Negative (G-)';
                const badgeStyle = isGpos 
                    ? 'bg-purple-950/40 border-purple-800/60 text-purple-200' 
                    : 'bg-rose-950/40 border-rose-800/60 text-rose-200';
                
                const topBorder = isGpos 
                    ? 'from-purple-600 to-indigo-700' 
                    : 'from-rose-600 to-pink-700';

                const cardHtml = \`
                    <!-- Strip -->
                    <div class="h-1.5 w-full bg-gradient-to-l \${topBorder}"></div>
                    
                    <div class="p-5 flex-1 space-y-4">
                        <!-- Icon & Title -->
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform">
                                \${b.icon}
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="text-xs sm:text-sm font-black text-white truncate">\${b.faName}</h3>
                                <p class="text-[10px] text-[#8b949e] font-mono italic truncate mt-0.5">\${b.latinName}</p>
                            </div>
                            <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border font-extrabold \${badgeStyle}">
                                \${gramText}
                            </span>
                        </div>
                        
                        <!-- Diseases brief -->
                        <div class="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1 text-[11px] overflow-hidden">
                            <span class="text-rose-400 font-bold block">🦠 Diseases & Clinical Details</span>
                            <p class="text-[#8b949e] leading-relaxed truncate">\${b.diseases}</p>
                        </div>
                    </div>

                    <!-- Footer actions -->
                    <div class="px-5 py-3.5 bg-black/30 border-t border-white/5 flex items-center justify-between">
                        <span class="text-[10px] text-[#484f58] font-mono">ID: #\${String(b.id).padStart(2, '0')}</span>
                        <span class="text-[10px] text-teal-400 font-bold flex items-center gap-1">View Details 🗃</span>
                    </div>
                \`;

                const cardDiv = document.createElement('div');
                cardDiv.className = "relative flex flex-col justify-between glass rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 hover:shadow-2xl hover:bg-white/[0.06] group transition-all duration-300";
                cardDiv.innerHTML = cardHtml;
                cardDiv.onclick = function() { openModal(b.id); };
                grid.appendChild(cardDiv);
            });
        }

        function onFilterChange() {
            renderDashboard();
        }

        // Details Modal
        function openModal(id) {
            const b = bacteriaData.find(x => x.id === id);
            if (!b) return;

            document.getElementById('fa-name').textContent = b.faName;
            document.getElementById('latin-name').textContent = b.latinName;
            document.getElementById('modal-icon').textContent = b.icon || '🦠';
            document.getElementById('modal-shape').textContent = b.shape;
            document.getElementById('modal-habitat').textContent = b.habitat;
            document.getElementById('modal-medium').textContent = b.cultureMedium;

            // Colony info check
            if (b.colony) {
                document.getElementById('item-colony').classList.remove('hidden');
                document.getElementById('modal-colony').textContent = b.colony;
            } else {
                document.getElementById('item-colony').classList.add('hidden');
            }

            document.getElementById('modal-diseases').textContent = b.diseases;
            document.getElementById('modal-treatment').textContent = b.treatment;

            // Color Strip custom
            const strip = document.getElementById('modal-color-strip');
            if (b.gram === 'gpos') {
                strip.className = "h-1.5 w-full bg-gradient-to-l from-purple-600 to-indigo-700";
            } else {
                strip.className = "h-1.5 w-full bg-gradient-to-l from-rose-600 to-pink-700";
            }

            // Badges
            const badgesBin = document.getElementById('modal-badges');
            badgesBin.innerHTML = '';

            // Add Gram badge
            const gramBadge = document.createElement('span');
            gramBadge.className = b.gram === 'gpos' 
                ? 'px-2.5 py-1 text-[10px] font-black rounded-lg bg-purple-600 text-white' 
                : 'px-2.5 py-1 text-[10px] font-black rounded-lg bg-rose-600 text-white';
            gramBadge.textContent = b.gram === 'gpos' ? 'Stain: Gram-Positive' : 'Stain: Gram-Negative';
            badgesBin.appendChild(gramBadge);

            // Add Catalase badge
            const catBadge = document.createElement('span');
            catBadge.className = 'px-2.5 py-1 text-[10px] font-bold rounded-lg bg-white/5 border border-white/10';
            catBadge.textContent = 'Catalase: ' + (b.catalase === 'positive' ? 'Positive (+)' : (b.catalase === 'negative' ? 'Negative (-)' : 'None'));
            badgesBin.appendChild(catBadge);

            // Add Oxygen badge
            const oxyMap = {
                aerobic: 'Obligate Aerobe',
                anaerobic: 'Obligate Anaerobe',
                facultative: 'Facultative Anaerobe',
                microaerophilic: 'Microaerophilic'
            };
            if (oxyMap[b.oxygen]) {
                const oxyBadge = document.createElement('span');
                oxyBadge.className = 'px-2.5 py-1 text-[10px] font-bold rounded-lg bg-teal-600/10 border border-teal-500/20 text-teal-300';
                oxyBadge.textContent = 'Oxygen: ' + oxyMap[b.oxygen];
                badgesBin.appendChild(oxyBadge);
            }

            // Additional extraBadges
            if (b.extraBadges) {
                b.extraBadges.forEach(badg => {
                    const extraBg = document.createElement('span');
                    extraBg.className = 'px-2.5 py-1 text-[10px] font-medium rounded-lg bg-white/5 border border-white/5 text-[#8b949e]';
                    extraBg.textContent = badg;
                    badgesBin.appendChild(extraBg);
                });
            }

            // Wiki Links
            document.getElementById('wiki-fa').href = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(b.latinName);
            document.getElementById('wiki-en').href = 'https://en.wikipedia.org/wiki/' + encodeURIComponent(b.latinName);

            // Open Modal
            document.getElementById('bacteria-modal').classList.remove('hidden');
        }

        function closeModal() {
            document.getElementById('bacteria-modal').classList.add('hidden');
        }

        // ============================================
        // QUIZ (TEST) LOGIC
        // ============================================
        function shuffleArray(arr) {
            const cpy = [...arr];
            for (let i = cpy.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [cpy[i], cpy[j]] = [cpy[j], cpy[i]];
            }
            return cpy;
        }

        function generateQuizQuestions() {
            if (bacteriaData.length < 5) return [];
            
            const list = [];
            const shuffled = shuffleArray(bacteriaData);

            for (let i = 0; i < 10; i++) {
                const target = shuffled[i % shuffled.length];
                const questionType = Math.floor(Math.random() * 5); // 0 to 4
                
                let questionText = "";
                let correctAnswer = "";
                let explanation = "";
                let options = [];

                if (questionType === 0) {
                    questionText = \`What is the Gram stain reaction for "\${target.faName} (\${target.latinName})"?\`;
                    correctAnswer = target.gram === 'gpos' ? 'Gram-Positive (Purple/Blue)' : 'Gram-Negative (Pink/Red)';
                    explanation = \`\${target.faName} is classified as a \${target.gram === 'gpos' ? 'Gram-Positive' : 'Gram-Negative'} bacterium.\`;
                    const distractor = target.gram === 'gpos' ? 'Gram-Negative (Pink/Red)' : 'Gram-Positive (Purple/Blue)';
                    options = [correctAnswer, distractor, 'No cell wall', 'Acid-fast'];
                }
                else if (questionType === 1) {
                    const diseasesSplit = target.diseases.split(',');
                    const sampleDisease = diseasesSplit[0].trim();
                    questionText = \`Which organism is primarily responsible for causing "\${sampleDisease}" or related infections?\`;
                    correctAnswer = target.faName;
                    explanation = \`\${target.faName} is a known cause of various conditions, including: "\${target.diseases}".\`;
                    const distractors = shuffled.filter(b => b.id !== target.id).slice(0, 3).map(b => b.faName);
                    options = [correctAnswer, ...distractors];
                }
                else if (questionType === 2) {
                    questionText = \`How is the morphology (microscopic shape/arrangement) of "\${target.faName}" described?\`;
                    correctAnswer = target.shape.split(';')[0].trim();
                    explanation = \`The full cellular format of \${target.faName} is: \${target.shape}\`;
                    const distractors = shuffled.filter(b => b.id !== target.id).map(b => b.shape.split(';')[0].trim()).filter(s => s !== correctAnswer && s.length > 3);
                    const uniqueDistractors = Array.from(new Set(distractors)).slice(0, 3);
                    while (uniqueDistractors.length < 3) {
                        uniqueDistractors.push("Spore-forming chain bacillus", "Encapsulated tetrad coccus", "Safety-pin bipolar bacillus");
                    }
                    options = [correctAnswer, ...uniqueDistractors.slice(0, 3)];
                }
                else if (questionType === 3) {
                    const mediums = target.cultureMedium.split(',');
                    const singleMedium = mediums[0].trim();
                    questionText = \`Which micro-organism is selected or identified using "\${singleMedium}" culture medium?\`;
                    correctAnswer = target.faName;
                    explanation = \`The diagnostic culture medium "\${target.cultureMedium}" is associated with \${target.faName}.\`;
                    const distractors = shuffled.filter(b => b.id !== target.id).slice(0, 3).map(b => b.faName);
                    options = [correctAnswer, ...distractors];
                }
                else {
                    const catalaseFa = target.catalase === 'positive' ? 'Catalase Positive' : (target.catalase === 'negative' ? 'Catalase Negative' : 'No enzyme activity');
                    questionText = \`What is the catalase reaction profile of "\${target.faName}"?\`;
                    correctAnswer = catalaseFa;
                    explanation = \`\${target.faName} shows a \${target.catalase === 'positive' ? 'positive (+)' : 'negative (-)'} catalase test.\`;
                    options = ['Catalase Positive', 'Catalase Negative', 'No enzyme activity/Unknown'];
                }

                // Shuffle options
                const shuffledOpts = shuffleArray(Array.from(new Set(options)));
                const correctIdx = shuffledOpts.indexOf(correctAnswer);

                list.push({
                    id: i + 1,
                    questionText,
                    options: shuffledOpts,
                    correctAnswerIndex: correctIdx !== -1 ? correctIdx : 0,
                    explanation,
                    bacteriumId: target.id
                });
            }
            return list;
        }

        function updateQuizHighScoresUI() {
            document.getElementById('quiz-result-high').textContent = highScore + ' از ۱۰';
        }

        function startNewQuiz() {
            currentQuizQuestions = generateQuizQuestions();
            currentQuizIndex = 0;
            currentQuizScore = 0;
            currentQuizStreak = 0;
            quizAnswered = false;

            // Reset panels layout
            document.getElementById('quiz-game-panel').classList.remove('hidden');
            document.getElementById('quiz-result-panel').classList.add('hidden');
            document.getElementById('quiz-feedback-panel').classList.add('hidden');
            document.getElementById('quiz-actions').classList.add('hidden');

            renderCurrentQuestion();
        }

        function renderCurrentQuestion() {
            if (currentQuizQuestions.length === 0) return;
            const q = currentQuizQuestions[currentQuizIndex];
            quizAnswered = false;

            // UI indexes
            document.getElementById('quiz-curr-idx').textContent = currentQuizIndex + 1;
            document.getElementById('quiz-display-score').textContent = 'Score: ' + currentQuizScore;
            document.getElementById('quiz-display-streak').textContent = 'Streak: ' + currentQuizStreak;

            // Progress bar
            const percentWidth = ((currentQuizIndex + 1) / 10 * 100) + '%';
            document.getElementById('quiz-progress-bar').style.width = percentWidth;

            // Question sentence
            document.getElementById('quiz-question-text').textContent = q.questionText;

            // Choices container
            const container = document.getElementById('quiz-options-container');
            container.innerHTML = '';

            q.options.forEach((opt, idx) => {
                const btn = document.createElement('button');
                btn.className = "flex items-center justify-between px-4 sm:px-5 py-3.5 border border-white/10 bg-black/20 hover:border-teal-500/50 hover:bg-white/5 text-[#e6edf3] font-semibold rounded-xl text-left text-xs sm:text-sm shadow-md transition-all";
                btn.id = "opt-btn-" + idx;
                btn.onclick = () => selectOption(idx);
                
                btn.innerHTML = \`
                    <span>\${opt}</span>
                    <span id="opt-icon-\${idx}" class="text-[#8b949e]">❓</span>
                \`;
                container.appendChild(btn);
            });

            // Hide action controls
            document.getElementById('quiz-feedback-panel').classList.add('hidden');
            document.getElementById('quiz-actions').classList.add('hidden');
        }

        function selectOption(selectedIdx) {
            if (quizAnswered) return;
            quizAnswered = true;

            const q = currentQuizQuestions[currentQuizIndex];
            const isCorrect = selectedIdx === q.correctAnswerIndex;

            if (isCorrect) {
                currentQuizScore++;
                currentQuizStreak++;
            } else {
                currentQuizStreak = 0;
            }

            // Sync scores
            document.getElementById('quiz-display-score').textContent = 'Score: ' + currentQuizScore;
            document.getElementById('quiz-display-streak').textContent = 'Streak: ' + currentQuizStreak;

            // Highlight choice styles
            q.options.forEach((opt, idx) => {
                const btn = document.getElementById('opt-btn-' + idx);
                const iconSpan = document.getElementById('opt-icon-' + idx);
                btn.disabled = true;

                if (idx === q.correctAnswerIndex) {
                    // Correct green
                    btn.className = "flex items-center justify-between px-4 sm:px-5 py-3.5 border-emerald-500 bg-emerald-950/20 text-emerald-200 font-semibold rounded-xl text-left text-xs sm:text-sm shadow-md transition-all";
                    iconSpan.textContent = '✅';
                } else if (idx === selectedIdx && !isCorrect) {
                    // Selected wrong red
                    btn.className = "flex items-center justify-between px-4 sm:px-5 py-3.5 border-rose-500 bg-rose-950/20 text-rose-200 font-semibold rounded-xl text-left text-xs sm:text-sm shadow-md transition-all";
                    iconSpan.textContent = '❌';
                } else {
                    // Unselected dim
                    btn.className = "flex items-center justify-between px-4 sm:px-5 py-3.5 border-white/5 bg-black/10 text-[#8b949e] opacity-60 font-semibold rounded-xl text-left text-xs sm:text-sm shadow-md transition-all";
                    iconSpan.textContent = '◽';
                }
            });

            // Set up Feedback explanations
            const feedbackContainer = document.getElementById('quiz-feedback-panel');
            const feedbackTitle = document.getElementById('quiz-feedback-title');
            const feedbackExpl = document.getElementById('quiz-feedback-explanation');

            feedbackContainer.classList.remove('hidden');

            if (isCorrect) {
                feedbackContainer.className = "p-4 rounded-xl bg-emerald-950/20 border border-emerald-600/35 space-y-2 mt-4 text-emerald-300 text-left";
                feedbackTitle.innerHTML = '<span>🎉</span><span>Correct Answer! Well done!</span>';
            } else {
                feedbackContainer.className = "p-4 rounded-xl bg-rose-950/20 border border-rose-600/35 space-y-2 mt-4 text-rose-300 text-left";
                feedbackTitle.innerHTML = '<span>❌</span><span>Wrong Answer! Try again.</span>';
            }
            feedbackExpl.textContent = q.explanation;

            // Show Next question trigger
            document.getElementById('quiz-actions').classList.remove('hidden');
        }

        function nextQuestion() {
            if (currentQuizIndex + 1 < 10) {
                currentQuizIndex++;
                renderCurrentQuestion();
            } else {
                // Game Finished!
                document.getElementById('quiz-game-panel').classList.add('hidden');
                document.getElementById('quiz-result-panel').classList.remove('hidden');

                // High score calculation
                if (currentQuizScore > highScore) {
                    highScore = currentQuizScore;
                    localStorage.setItem('off_highscore', String(highScore));
                }

                document.getElementById('quiz-result-high').textContent = highScore + ' out of 10';
                document.getElementById('quiz-result-percent').textContent = (currentQuizScore * 10) + '%';
            }
        }

        // ============================================
        // STATISTICS PROJECTION
        // ============================================
        function renderStatisticsTab() {
            const stats = calculateStats();
            const total = stats.total || 1;

            // Gram percents
            const gposPct = Math.round(stats.gpos / total * 100);
            const gnegPct = Math.round(stats.gneg / total * 100);
            document.getElementById('stat-gpos').textContent = stats.gpos + ' species ('+gposPct+'%)';
            document.getElementById('stat-gneg').textContent = stats.gneg + ' species ('+gnegPct+'%)';
            document.getElementById('stat-gpos-progress').style.width = gposPct + '%';
            document.getElementById('stat-gneg-progress').style.width = gnegPct + '%';

            // Catalase percents
            const catPosPct = Math.round(stats.catPos / total * 100);
            const catNegPct = Math.round(stats.catNeg / total * 100);
            document.getElementById('stat-cat-pos').textContent = stats.catPos + ' cases ('+catPosPct+'%)';
            document.getElementById('stat-cat-neg').textContent = stats.catNeg + ' cases ('+catNegPct+'%)';
            document.getElementById('stat-cat-pos-progress').style.width = catPosPct + '%';
            document.getElementById('stat-cat-neg-progress').style.width = catNegPct + '%';

            // Oxygen exacts
            document.getElementById('stat-ox-fac').textContent = stats.facultative + ' species';
            document.getElementById('stat-ox-ana').textContent = stats.anaerobic + ' species';
            document.getElementById('stat-ox-aer').textContent = stats.aerobic + ' species';
            document.getElementById('stat-ox-mic').textContent = stats.microaerophilic + ' species';
        }
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "bacteriology-encyclopedia-offline.html");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="min-h-screen mesh-bg text-[#e6edf3] font-sans antialiased selection:bg-purple-600 selection:text-white" dir="ltr">
      {/* BACKGROUND GLOWS */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-900/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-rose-900/10 rounded-full blur-3xl pointer-events-none"></div>

      {/* STICKY MAIN HEADER */}
      <header className="sticky top-0 z-40 glass-heavy border-b border-white/10 transition-all duration-300 shadow-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl sm:text-4xl animate-pulse relative">
              🦠
              <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
              </span>
            </span>
            <div>
              <h1 className="text-xl sm:text-2xl font-black bg-gradient-to-r from-purple-400 via-teal-300 to-rose-400 bg-clip-text text-transparent">
                {translations.name || "Medical Bacteriology Encyclopedia"}
              </h1>
              <p className="text-xs text-slate-300 font-semibold mt-1">
                Portfolio Showcase by <span className="bg-teal-500/15 text-teal-300 px-2 py-0.5 rounded border border-teal-500/30 font-bold">M. Hemati Alam</span>
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 gap-1">
              <button
                id="tab-dashboard"
                onClick={() => setActiveTab("dashboard")}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === "dashboard"
                    ? "bg-white/10 text-teal-300 border border-white/5 shadow-inner"
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5"
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>{translations.dashboardTab}</span>
              </button>
              <button
                id="tab-quiz"
                onClick={() => {
                  setActiveTab("quiz");
                  startNewQuiz();
                }}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === "quiz"
                    ? "bg-white/10 text-purple-300 border border-white/5 shadow-inner"
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5"
                }`}
              >
                <Trophy className="w-4 h-4" />
                <span>{translations.questionsTab}</span>
                <span className="bg-purple-900/40 text-purple-200 text-[10px] px-1.5 py-0.5 rounded-full border border-purple-700/30">
                  Quiz
                </span>
              </button>
              <button
                id="tab-stats"
                onClick={() => setActiveTab("stats")}
                className={`flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 ${
                  activeTab === "stats"
                    ? "bg-white/10 text-rose-300 border border-white/5 shadow-inner"
                    : "text-[#8b949e] hover:text-[#e6edf3] hover:bg-white/5"
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>{translations.statisticsTab}</span>
              </button>
            </div>
            {/* Removed the selected GitHub and Contact CV elements */}
          </div>
        </div>
      </header>

      {/* QUICK LAB LEGEND */}
      <div className="glass border-t-0 border-r-0 border-l-0 border-b border-white/5 py-2 px-4 text-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap justify-between items-center gap-4">
          <div className="flex flex-wrap items-center gap-4 text-[#8b949e]">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500 inline-block"></span>
              Gram-Positive (G+)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block"></span>
              Gram-Negative (G-)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
              Catalase Positive (Cat+)
            </span>
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 inline-block"></span>
              Catalase Negative (Cat-)
            </span>
          </div>
          <div className="text-[#8b949e] flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
            <span>Comprehensive diagnostic dataset of phenotypic and biochemical bacterial features</span>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* TAB 1: DASHBOARD AND FILTERS */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            
            {/* ADVANCED SECTIONS / STATS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg hover:border-white/20 hover:bg-white/5 transition-all">
                <div className="p-2.5 bg-teal-950/60 border border-teal-800/50 rounded-xl text-teal-400">
                  <Database className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8b949e]">Total Microbes</div>
                  <div className="text-lg font-extrabold text-[#e6edf3]">{statsSummary.total} species</div>
                </div>
              </div>

              <div className="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg hover:border-white/20 hover:bg-white/5 transition-all">
                <div className="p-2.5 bg-purple-950/60 border border-purple-800/50 rounded-xl text-purple-400">
                  <span className="text-sm font-bold">G+</span>
                </div>
                <div>
                  <div className="text-[10px] text-[#8b949e]">Gram-Positive</div>
                  <div className="text-lg font-extrabold text-purple-300">{statsSummary.gpos} species</div>
                </div>
              </div>

              <div className="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg hover:border-white/20 hover:bg-white/5 transition-all">
                <div className="p-2.5 bg-rose-950/60 border border-rose-800/50 rounded-xl text-rose-400">
                  <span className="text-sm font-bold">G-</span>
                </div>
                <div>
                  <div className="text-[10px] text-[#8b949e]">Gram-Negative</div>
                  <div className="text-lg font-extrabold text-rose-300">{statsSummary.gneg} species</div>
                </div>
              </div>

              <div className="glass p-4 flex items-center gap-3 rounded-2xl shadow-lg hover:border-white/20 hover:bg-white/5 transition-all">
                <div className="p-2.5 bg-amber-950/60 border border-amber-800/50 rounded-xl text-amber-400">
                  <FlaskConical className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-[10px] text-[#8b949e]">Active Catalase</div>
                  <div className="text-lg font-extrabold text-amber-300">{statsSummary.catPos} positive</div>
                </div>
              </div>
            </div>

            {/* INTEGRATED FILTERS BAR */}
            <div className="glass rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
              <div className="flex flex-col lg:flex-row items-center gap-4">
                <div className="relative w-full lg:flex-1">
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-[#8b949e]">
                    <Search className="w-5 h-5" />
                  </span>
                  <input
                    type="text"
                    placeholder={translations.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.value || e.target.value)}
                    className="w-full pr-11 pl-4 py-2.5 bg-black/35 border border-white/10 rounded-xl text-[#e6edf3] text-sm focus:outline-none focus:ring-1 focus:ring-teal-400 focus:border-teal-400 focus:bg-black/50 transition-all placeholder:text-[#586069]"
                  />
                  {searchTerm && (
                    <button 
                      onClick={() => setSearchTerm("")}
                      className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-xs text-[#8b949e] hover:text-[#e6edf3]"
                    >
                      Clear
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    <span className="text-xs text-[#8b949e] whitespace-nowrap">{translations.filterGram}</span>
                    <select
                      value={gramFilter}
                      onChange={(e) => setGramFilter(e.target.value as any)}
                      className="bg-[#12161f] border border-white/10 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]"
                    >
                      <option value="all">{translations.all}</option>
                      <option value="gpos">Gram-Positive (G+)</option>
                      <option value="gneg">Gram-Negative (G-)</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    <span className="text-xs text-[#8b949e] whitespace-nowrap">{translations.filterCatalase}</span>
                    <select
                      value={catalaseFilter}
                      onChange={(e) => setCatalaseFilter(e.target.value as any)}
                      className="bg-[#12161f] border border-white/10 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]"
                    >
                      <option value="all">{translations.all}</option>
                      <option value="positive">Catalase Positive</option>
                      <option value="negative">Catalase Negative</option>
                    </select>
                  </div>

                  <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                    <span className="text-xs text-[#8b949e] whitespace-nowrap">{translations.filterOxygen}</span>
                    <select
                      value={oxygenFilter}
                      onChange={(e) => setOxygenFilter(e.target.value)}
                      className="bg-[#12161f] border border-white/15 rounded-lg text-xs py-1.5 px-3 focus:outline-none focus:border-teal-400 text-[#e6edf3]"
                    >
                      <option value="all">{translations.all}</option>
                      <option value="aerobic">Obligate Aerobic</option>
                      <option value="anaerobic">Obligate Anaerobic</option>
                      <option value="facultative">Facultative Anaerobic</option>
                      <option value="microaerophilic">Microaerophilic</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SEARCH STATUS HINT */}
              <div className="flex items-center justify-between text-xs text-[#8b949e] pt-1">
                <span>
                  Showing <strong className="text-teal-400">{filteredBacteria.length}</strong> {translations.totalFound}
                </span>
                {(searchTerm || gramFilter !== "all" || catalaseFilter !== "all" || oxygenFilter !== "all") && (
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setGramFilter("all");
                      setCatalaseFilter("all");
                      setOxygenFilter("all");
                    }}
                    className="flex items-center gap-1 text-teal-400 hover:text-teal-300 hover:underline transition-all"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Clear filters & reveal all</span>
                  </button>
                )}
              </div>
            </div>

            {/* BACTERIA GRID CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredBacteria.map((b) => {
                  const gramCfg = getGramConfig(b.gram);
                  return (
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.25 }}
                      key={b.id}
                      onClick={() => setSelectedBacterium(b)}
                      className="relative flex flex-col justify-between glass rounded-2xl overflow-hidden cursor-pointer hover:border-white/20 hover:shadow-2xl hover:bg-white/[0.06] group transition-all duration-300"
                    >
                      {/* CARD STATUS STRIP */}
                      <div className={`h-1 cursor-pointer w-full bg-gradient-to-l ${gramCfg.color}`}></div>

                      {/* Header info */}
                      <div className="p-4 sm:p-5 flex items-start gap-4">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0 border transition-transform duration-300 group-hover:scale-110 ${gramCfg.bg}`}>
                          <span>{b.icon}</span>
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="font-bold text-sm sm:text-base text-[#e6edf3] tracking-tight group-hover:text-teal-400 transition-colors">
                              {b.faName}
                            </h3>
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${gramCfg.badge}`}>
                              {gramCfg.label}
                            </span>
                          </div>
                          <p className="text-xs text-[#8b949e] font-mono italic">
                            {b.latinName}
                          </p>
                        </div>
                      </div>

                      {/* Body quick info (only a few rows) */}
                      <div className="px-5 pb-4 space-y-3 text-xs flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[#8b949e] shrink-0 font-medium">Morphology:</span>
                          <span className="text-[#e6edf3] truncate">{b.shape}</span>
                        </div>

                        {/* Diseases with limited display height */}
                        <div className="bg-black/40 p-2.5 rounded-lg border border-white/5 space-y-1 text-[11px] overflow-hidden">
                          <div className="flex items-center gap-1.5 text-xs text-rose-400 font-bold">
                            <span>{translations.diseasesLabel.split(' ')[0]}</span>
                            <span>{translations.diseasesLabel.split(' ').slice(1).join(' ')}</span>
                          </div>
                          <p className="text-[#8b949e] line-clamp-2 leading-relaxed">
                            {b.diseases}
                          </p>
                        </div>

                        {/* Badges / statuses */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                            b.catalase === 'positive' 
                              ? 'border-amber-500/40 bg-amber-950/20 text-amber-300' 
                              : 'border-slate-700 bg-slate-800/30 text-slate-400'
                          }`}>
                            {translateCatalase(b.catalase)}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full border border-teal-500/20 bg-teal-950/20 text-teal-300">
                            {translateOxygen(b.oxygen)}
                          </span>
                        </div>
                      </div>

                      {/* Card Footer actions */}
                      <div className="px-5 py-3 bg-black/30 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[10px] text-[#484f58] font-mono">ID: #{String(b.id).padStart(2, '0')}</span>
                        <div className="flex items-center gap-2.5">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedBacterium(b);
                            }}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-teal-300 border border-teal-500/20 bg-teal-950/30 hover:bg-teal-500/20 rounded-lg active:scale-95 transition-all cursor-pointer shadow-sm font-bold"
                          >
                            <span>Full Display 🗃</span>
                            <Info className="w-3.5 h-3.5 text-teal-300" />
                          </button>
                          
                          <span className="w-px h-3 bg-white/10"></span>

                          <a
                            href={`https://en.wikipedia.org/wiki/${encodeURIComponent(b.latinName)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              e.stopPropagation(); // Avoid triggering card click modal
                            }}
                            className="flex items-center gap-1 text-[11px] text-[#8b949e] hover:text-[#e6edf3] font-semibold transition-all hover:translate-x-[-1px]"
                          >
                            <span>Wikipedia</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>

              {filteredBacteria.length === 0 && (
                <div className="col-span-full py-16 text-center glass rounded-2xl">
                  <span className="text-4xl block mb-3">🔬</span>
                  <h4 className="text-lg font-bold text-[#e6edf3]">No matching bacteria species found!</h4>
                  <p className="text-xs text-[#8b949e] mt-1.5 max-w-md mx-auto leading-relaxed">
                    Verify your search keyword filters or search for clinical indicators like "Vancomycin", "Acinetobacter", or "pneumonia" to find respective organisms.
                  </p>
                  <button
                    onClick={() => {
                      setSearchTerm("");
                      setGramFilter("all");
                      setCatalaseFilter("all");
                      setOxygenFilter("all");
                    }}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white rounded-lg shadow-md transition-all duration-200"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Reset All Filters</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

         {/* TAB 2: GAMIFIED TEST (QUIZ) */}
        {activeTab === "quiz" && (
          <div className="max-w-2xl mx-auto space-y-6">
            
            {/* INSTRUCTIONS CARD */}
            <div className="glass bg-purple-950/20 border border-purple-800/35 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row items-center gap-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-purple-900/50 flex items-center justify-center border border-purple-700 shrink-0">
                <Trophy className="w-8 h-8 text-amber-400" />
              </div>
              <div className="space-y-1 flex-1 text-center sm:text-left">
                <h3 className="text-lg font-black text-purple-300">{translations.quizTitle}</h3>
                <p className="text-xs text-[#8b949e]">{translations.quizDesc}</p>
              </div>
              <div className="py-2 px-3 bg-purple-900/30 border border-purple-800/40 rounded-xl text-center shrink-0">
                <span className="text-[10px] text-purple-300 block">High Score</span>
                <strong className="text-base font-bold text-amber-300">{highScore} / 10</strong>
              </div>
            </div>

            {/* QUIZ SETTINGS GRID */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Difficulty Panel */}
              <div className="glass bg-slate-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-indigo-300 tracking-wide uppercase flex items-center gap-1.5">
                    🧪 {translations.difficultyLabel}
                  </span>
                  <p className="text-[11px] text-[#8b949e]">
                    {quizDifficulty === 'easy' && translations.difficultyEasyDesc}
                    {quizDifficulty === 'medium' && translations.difficultyMediumDesc}
                    {quizDifficulty === 'hard' && translations.difficultyHardDesc}
                  </p>
                </div>
                <div className="flex bg-[#030712]/90 p-1 border border-white/5 rounded-xl">
                  {/* Easy Mode Tooltip Container */}
                  <div className="group relative flex-1 flex">
                    <button
                      onClick={() => handleDifficultyChange('easy')}
                      className={`w-full px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quizDifficulty === 'easy'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {translations.easy}
                    </button>
                    {/* Tooltip Popup */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 bg-slate-950/95 border border-emerald-500/30 text-[11px] text-[#e6edf3] p-3 rounded-xl shadow-2xl z-40 text-center">
                      <div className="font-extrabold text-emerald-400 mb-1 flex items-center gap-1 justify-center">
                        <span>🟢 {translations.easy} Challenge</span>
                      </div>
                      <div className="space-y-1 text-left font-normal text-[#8b949e] leading-relaxed">
                        <p>• <strong className="text-emerald-300 font-bold">Options:</strong> {translations.difficultyEasyDesc}</p>
                        <p>• <strong className="text-emerald-300 font-bold">Timer:</strong> 10s per question</p>
                        <p>• <strong className="text-emerald-300 font-bold">Focus:</strong> High-yield, fundamental identification of bacteria attributes (e.g. Gram-staining, Catalase).</p>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-slate-950"></div>
                    </div>
                  </div>

                  {/* Medium Mode Tooltip Container */}
                  <div className="group relative flex-1 flex">
                    <button
                      onClick={() => handleDifficultyChange('medium')}
                      className={`w-full px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quizDifficulty === 'medium'
                          ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {translations.medium}
                    </button>
                    {/* Tooltip Popup */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 bg-slate-950/95 border border-amber-500/30 text-[11px] text-[#e6edf3] p-3 rounded-xl shadow-2xl z-40 text-center">
                      <div className="font-extrabold text-amber-400 mb-1 flex items-center gap-1 justify-center">
                        <span>🟡 {translations.medium} Challenge</span>
                      </div>
                      <div className="space-y-1 text-left font-normal text-[#8b949e] leading-relaxed">
                        <p>• <strong className="text-amber-300 font-bold">Options:</strong> {translations.difficultyMediumDesc}</p>
                        <p>• <strong className="text-amber-300 font-bold">Timer:</strong> 20s per question</p>
                        <p>• <strong className="text-amber-300 font-bold">Focus:</strong> Diagnostic biochemistry, growth cultures, and primary infectious pathology profiles.</p>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-slate-950"></div>
                    </div>
                  </div>

                  {/* Hard Mode Tooltip Container */}
                  <div className="group relative flex-1 flex">
                    <button
                      onClick={() => handleDifficultyChange('hard')}
                      className={`w-full px-3 py-1.5 text-[11px] sm:text-xs font-bold rounded-lg transition-all cursor-pointer ${
                        quizDifficulty === 'hard'
                          ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          : 'text-slate-400 hover:text-slate-200 border border-transparent'
                      }`}
                    >
                      {translations.hard}
                    </button>
                    {/* Tooltip Popup */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-200 bg-slate-950/95 border border-rose-500/30 text-[11px] text-[#e6edf3] p-3 rounded-xl shadow-2xl z-40 text-center">
                      <div className="font-extrabold text-rose-400 mb-1 flex items-center gap-1 justify-center">
                        <span>🔴 {translations.hard} Challenge</span>
                      </div>
                      <div className="space-y-1 text-left font-normal text-[#8b949e] leading-relaxed">
                        <p>• <strong className="text-rose-300 font-bold">Options:</strong> {translations.difficultyHardDesc}</p>
                        <p>• <strong className="text-rose-300 font-bold">Timer:</strong> 30s per question</p>
                        <p>• <strong className="text-rose-300 font-bold">Focus:</strong> Multi-characteristic bacteriology, specialized diagnostic media, and drug resistance.</p>
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-[6px] border-transparent border-t-slate-950"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Timed Mode Selector Panel */}
              <div className="glass bg-slate-900/40 border border-white/5 rounded-2xl p-4 sm:p-5 flex flex-col justify-between gap-3 shadow-lg">
                <div className="space-y-0.5">
                  <span className="text-xs font-extrabold text-indigo-300 tracking-wide uppercase flex items-center gap-1.5">
                    ⏱ {translations.timedModeLabel}
                  </span>
                  <p className="text-[11px] text-[#8b949e]">
                    {translations.timedModeDesc} ({getTimerDuration(quizDifficulty)}s limit)
                  </p>
                </div>
                
                <div className="flex items-center justify-between bg-[#030712]/90 p-1 border border-white/5 rounded-xl min-h-[36px]">
                  <span className="text-[11px] font-bold px-2 text-[#8b949e]">
                    Status: <span className={timedModeEnabled ? "text-amber-400 font-extrabold" : "text-slate-500"}>{timedModeEnabled ? "ON ⏱" : "OFF"}</span>
                  </span>
                  <button
                    onClick={toggleTimedMode}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      timedModeEnabled
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-sm'
                        : 'bg-white/5 text-slate-400 hover:text-slate-200 border border-white/10'
                    }`}
                  >
                    {timedModeEnabled ? "Disable" : "Enable"}
                  </button>
                </div>
              </div>
            </div>

            {/* MAIN SYSTEM CONTAINER */}
            <AnimatePresence mode="wait">
              {!quizFinished && quizQuestions.length > 0 ? (
                <motion.div
                  key={currentQuestionIdx}
                  initial={{ opacity: 0, x: 25 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -25 }}
                  transition={{ duration: 0.2 }}
                  className="glass rounded-2xl overflow-hidden shadow-2xl"
                >
                  
                  {/* Progress panel */}
                  <div className="px-5 py-4 bg-black/35 border-b border-white/5 flex items-center justify-between text-xs">
                    <span className="text-[#8b949e]">
                      {translations.questionOf} <strong className="text-[#e6edf3]">{currentQuestionIdx + 1}</strong> {translations.outOf} <strong className="text-[#e6edf3]">{quizQuestions.length}</strong>
                    </span>
                    <div className="flex items-center gap-2 sm:gap-4">
                      {timedModeEnabled && (
                        <span className={`font-mono font-black text-xs px-2.5 py-1 rounded-lg border flex items-center gap-1.5 transition-all duration-300 ${
                          quizAnswered 
                            ? (selectedAnswerIdx === -1 
                              ? "text-rose-500 bg-rose-500/10 border-rose-500/30 animate-pulse" 
                              : "text-[#8b949e] bg-slate-900 border-white/5")
                            : (timeLeft > 5
                              ? "text-teal-400 bg-teal-400/10 border-teal-400/20"
                              : "text-amber-400 bg-amber-400/10 border-amber-400/20 animate-pulse scale-105")
                        }`}>
                          <Timer className="w-3.5 h-3.5 shrink-0" />
                          <span>{quizAnswered ? (selectedAnswerIdx === -1 ? translations.timedModeTimeout : "Done") : `${timeLeft}s`}</span>
                        </span>
                      )}

                      <button
                        onClick={toggleSound}
                        className="flex items-center justify-center p-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 transition-all cursor-pointer"
                        title={soundEnabled ? "Mute quiz sounds" : "Enable quiz sounds"}
                      >
                        {soundEnabled ? (
                          <Volume2 className="w-4 h-4 text-teal-400" />
                        ) : (
                          <VolumeX className="w-4 h-4 text-slate-500" />
                        )}
                      </button>
                      <span className="text-amber-400 font-bold flex items-center gap-1 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                        <Award className="w-3.5 h-3.5" />
                        <span>Score: {quizScore}</span>
                      </span>
                      {quizStreak > 0 && (
                        <span className="text-teal-400 font-bold flex items-center gap-1 bg-teal-400/10 px-2 py-0.5 rounded border border-teal-400/20 animate-bounce">
                          🔥 {translations.streak} {quizStreak}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* REAL PROGRESS BAR */}
                  <div className="w-full bg-[#0a0d16]/40 h-1.5 flex">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-teal-400 h-full transition-all duration-300"
                      style={{ width: `${((currentQuestionIdx + 1) / quizQuestions.length) * 100}%` }}
                    ></div>
                  </div>

                  {/* TIMED MODE COUNTDOWN PROGRESS BAR */}
                  {timedModeEnabled && !quizAnswered && (
                    <div className="w-full bg-slate-950/80 h-1 relative overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-1000 ease-linear ${
                          timeLeft > 5 
                            ? "bg-teal-400" 
                            : timeLeft > 2 
                            ? "bg-amber-400" 
                            : "bg-rose-500 animate-pulse"
                        }`}
                        style={{ width: `${(timeLeft / getTimerDuration(quizDifficulty)) * 100}%` }}
                      ></div>
                    </div>
                  )}

                  {/* Body text */}
                  <div className="p-5 sm:p-6 space-y-6">
                    {(() => {
                      const timerRatio = timeLeft / getTimerDuration(quizDifficulty);
                      const timerVisual = getTimerColorClasses(timerRatio);
                      const ringRadius = 28;
                      const circumference = 2 * Math.PI * ringRadius;
                      const strokeDashoffset = circumference * (1 - timerRatio);

                      return (
                        <div className="flex flex-col sm:flex-row items-center gap-5 sm:gap-6 bg-slate-950/20 border border-white/5 rounded-2xl p-4 sm:p-5">
                          {timedModeEnabled && (
                            <div className="relative flex-shrink-0 w-16 h-16 flex items-center justify-center">
                              {/* Glowing circular backdrop */}
                              <div className={`absolute inset-0.5 rounded-full transition-all duration-500 ${timerVisual.glow}`} />
                              
                              {/* SVG Progress Ring */}
                              <svg className="w-16 h-16 -rotate-90 relative z-10">
                                {/* Track circle */}
                                <circle
                                  cx="32"
                                  cy="32"
                                  r={ringRadius}
                                  className="stroke-white/5"
                                  strokeWidth="4"
                                  fill="transparent"
                                />
                                {/* Progress circle */}
                                <circle
                                  cx="32"
                                  cy="32"
                                  r={ringRadius}
                                  stroke={timerVisual.stroke}
                                  strokeWidth="4"
                                  fill="transparent"
                                  strokeDasharray={circumference}
                                  strokeDashoffset={strokeDashoffset}
                                  strokeLinecap="round"
                                  className="transition-all duration-1000 ease-linear"
                                />
                              </svg>
                              
                              {/* Central textual countdown */}
                              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 font-mono">
                                <span className={`text-base sm:text-lg font-black leading-none tracking-tight ${timerVisual.text}`}>
                                  {quizAnswered ? (selectedAnswerIdx === -1 ? "0" : timeLeft) : timeLeft}
                                </span>
                                <span className="text-[7.5px] text-[#8b949e] uppercase font-extrabold tracking-widest mt-0.5 leading-none">
                                  {quizAnswered ? "Done" : "sec"}
                                </span>
                              </div>
                            </div>
                          )}

                          <div className="flex-1 text-center sm:text-left space-y-1">
                            <span className="text-[10px] text-indigo-400 font-extrabold uppercase tracking-widest block">
                              Question Challenge
                            </span>
                            <h4 className="text-base sm:text-lg font-bold text-[#e6edf3] leading-relaxed select-none">
                              {quizQuestions[currentQuestionIdx].questionText}
                            </h4>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Multiple choices */}
                    <div className="grid grid-cols-1 gap-3">
                      {quizQuestions[currentQuestionIdx].options.map((option, idx) => {
                        const isSelected = selectedAnswerIdx === idx;
                        const isCorrect = quizQuestions[currentQuestionIdx].correctAnswerIndex === idx;
                        
                        let choiceStyles = "border-white/10 bg-black/20 hover:border-teal-500/50 hover:bg-white/5 text-[#e6edf3]";
                        let iconComp = <HelpCircle className="w-4 h-4 text-[#8b949e]" />;

                        if (quizAnswered) {
                          if (isCorrect) {
                            choiceStyles = "border-emerald-500 bg-emerald-950/20 text-emerald-200";
                            iconComp = <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />;
                          } else if (isSelected) {
                            choiceStyles = "border-rose-500 bg-rose-950/20 text-rose-200";
                            iconComp = <XCircle className="w-4 h-4 text-rose-400 shrink-0" />;
                          } else {
                            choiceStyles = "border-white/5 bg-black/10 text-[#8b949e] opacity-60";
                          }
                        }

                        return (
                          <button
                            key={idx}
                            disabled={quizAnswered}
                            onClick={() => handleAnswerSubmit(idx)}
                            className={`flex items-center justify-between p-3.5 sm:p-4 rounded-xl border w-full text-left text-sm font-semibold transition-all ${choiceStyles}`}
                          >
                            <span className="flex-1 text-left">{option}</span>
                            <span className="ml-3 shrink-0">{iconComp}</span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Instant Feedback Notice */}
                    <AnimatePresence>
                      {quizAnswered && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-4 rounded-xl border text-xs sm:text-sm leading-relaxed ${
                            selectedAnswerIdx === quizQuestions[currentQuestionIdx].correctAnswerIndex
                              ? "bg-emerald-950/30 border-emerald-800/50 text-emerald-300"
                              : "bg-rose-950/20 border-rose-800/50 text-rose-300"
                          }`}
                        >
                          <div className="flex items-center gap-2 font-bold mb-1.5">
                            {selectedAnswerIdx === quizQuestions[currentQuestionIdx].correctAnswerIndex ? (
                                <>
                                  <span>🎉</span>
                                  <span>{translations.correctFeedback}</span>
                                </>
                              ) : (
                                <>
                                  <span>❌</span>
                                  <span>{translations.incorrectFeedback}</span>
                                </>
                              )}
                          </div>
                          <p className="text-[11px] text-[#8b949e] font-mono leading-relaxed p-2 bg-black/40 rounded-md border border-white/5">
                            {quizQuestions[currentQuestionIdx].explanation}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Actions Bar */}
                  {quizAnswered && (
                    <div className="px-5 py-4 bg-black/30 border-t border-white/5 flex justify-end">
                      <button
                        onClick={handleNextQuestion}
                        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-purple-600 to-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md hover:opacity-90 transition-all hover:scale-102"
                      >
                        <span>{translations.nextQuestion}</span>
                      </button>
                    </div>
                  )}

                </motion.div>
              ) : quizFinished ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass rounded-2xl p-6 sm:p-8 text-center space-y-6 shadow-2xl"
                >
                  <span className="text-5xl block animate-bounce">🎓</span>
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-[#e6edf3]">
                      {translations.finalScore} <span className="text-teal-400">{quizScore} / 10</span>
                    </h3>
                    <p className="text-xs text-[#8b949e] max-w-sm mx-auto leading-relaxed">
                      {quizScore >= 7 ? translations.congrats : translations.keepTrying}
                    </p>
                  </div>

                  <div className="inline-grid grid-cols-2 gap-4 max-w-xs mx-auto">
                    <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                      <span className="text-[10px] text-[#484f58] block">High Score</span>
                      <strong className="text-lg text-amber-300 font-extrabold">{highScore} / 10</strong>
                    </div>
                    <div className="bg-black/30 p-3 rounded-xl border border-white/5 text-center">
                      <span className="text-[10px] text-[#484f58] block">Correct Rate</span>
                      <strong className="text-lg text-purple-300 font-extrabold">{quizScore * 10}٪</strong>
                    </div>
                  </div>

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => {
                        triggerSound("click");
                        startNewQuiz();
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-[#e6edf3] text-[#8b949e] font-bold rounded-xl text-xs sm:text-sm shadow-md transition-all duration-200"
                    >
                      <RefreshCw className="w-4 h-4 text-purple-400" />
                      <span>{translations.restartQuiz}</span>
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-10">در حال تولید آزمون...</div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* TAB 3: STATISTICAL BIOLOGY ANALYSIS */}
        {activeTab === "stats" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Box 1: Biological ratios */}
              <div className="glass rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-purple-400">
                  <Layers className="w-5 h-5" />
                  <h4 className="font-bold text-sm sm:text-base text-[#e6edf3]">Gram Stain Distribution</h4>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  All cataloged bacteria divided by standard peptidoglycan envelope staining depth: Gram-Positive (thick peptidoglycan layer) and Gram-Negative (thin outer membrane envelope).
                </p>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-purple-300">Gram-Positive</span>
                      <span className="text-[#8b949e]">{statsSummary.gpos} species ({Math.round(statsSummary.gpos / statsSummary.total * 100)}%)</span>
                    </div>
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(statsSummary.gpos / statsSummary.total) * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-rose-300">Gram-Negative</span>
                      <span className="text-[#8b949e]">{statsSummary.gneg} species ({Math.round(statsSummary.gneg / statsSummary.total * 100)}%)</span>
                    </div>
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-rose-500 rounded-full" style={{ width: `${(statsSummary.gneg / statsSummary.total) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 2: Enzyme Profile */}
              <div className="glass rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-amber-400">
                  <FlaskConical className="w-5 h-5 opacity-80" />
                  <h4 className="font-bold text-sm sm:text-base text-[#e6edf3]">Catalase Enzyme Assays</h4>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  The catalase enzyme breaks down hydrogen peroxide (H₂O₂) into water and gaseous oxygen. It is a critical reaction for distinguishing Staphylococci (positive) from Streptococci (negative).
                </p>
                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-amber-300">Catalase Positive</span>
                      <span className="text-[#8b949e]">{statsSummary.catPos} cases ({Math.round(statsSummary.catPos / statsSummary.total * 100)}%)</span>
                    </div>
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400 rounded-full" style={{ width: `${(statsSummary.catPos / statsSummary.total) * 100}%` }}></div>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-400">Catalase Negative</span>
                      <span className="text-[#8b949e]">{statsSummary.catNeg} cases ({Math.round(statsSummary.catNeg / statsSummary.total * 100)}%)</span>
                    </div>
                    <div className="w-full bg-black/40 h-2.5 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-500 rounded-full" style={{ width: `${(statsSummary.catNeg / statsSummary.total) * 100}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Box 3: Oxygen Needs */}
              <div className="glass rounded-2xl p-5 space-y-4 shadow-xl">
                <div className="flex items-center gap-2 text-teal-400">
                  <Globe className="w-5 h-5" />
                  <h4 className="font-bold text-sm sm:text-base text-[#e6edf3]">Aerotolerance Profiles</h4>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">
                  Classification according to environmental oxygen criteria for respiration, categorized into obligate aerobes, facultative anaerobes, obligate anaerobes, and microaerophilic.
                </p>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                    <span className="text-teal-300 font-bold">Facultative Anaerobic</span>
                    <strong className="text-white">{statsSummary.facultative} species</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                    <span className="text-rose-400 font-bold">Obligate Anaerobic</span>
                    <strong className="text-white">{statsSummary.anaerobic} species</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                    <span className="text-blue-300 font-bold">Obligate Aerobic</span>
                    <strong className="text-white">{statsSummary.aerobic} species</strong>
                  </div>
                  <div className="flex items-center justify-between py-1 bg-black/30 px-3.5 rounded-lg border border-white/5">
                    <span className="text-purple-300 font-bold">Microaerophilic</span>
                    <strong className="text-white">{statsSummary.microaerophilic} species</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* QUIZ SCORE TREND CHART */}
            <div className="glass rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-indigo-400 border-b border-white/5 pb-3">
                <Activity className="w-5 h-5 text-indigo-400 animate-pulse" />
                <h4 className="font-extrabold text-[#e6edf3] text-sm sm:text-base">Score Learning Trend (Last 10 Attempts)</h4>
              </div>
              
              {quizHistory.length === 0 ? (
                <div className="bg-black/20 border border-white/5 p-8 rounded-xl text-center space-y-2 py-12">
                  <Activity className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
                  <p className="text-xs text-[#8b949e] max-w-sm mx-auto leading-relaxed">
                    No learning trend data available yet. Complete some quizzes in the Quiz tab to generate your custom progression dashboard!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-xs text-[#8b949e] leading-relaxed">
                    Visualizing your score progression over the last up to 10 quiz attempts. Aim for scores above <span className="text-teal-400 font-bold">8/10 (80%)</span> to master your diagnostic skills.
                  </p>
                  
                  {/* Recharts Container */}
                  <div className="h-64 sm:h-72 w-full bg-slate-950/20 border border-white/5 rounded-xl p-2 sm:p-4">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={trendData}
                        margin={{ top: 12, right: 16, left: -24, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" opacity={0.3} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#64748b" 
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          dy={6}
                        />
                        <YAxis 
                          domain={[0, 10]} 
                          tickCount={6}
                          stroke="#64748b" 
                          fontSize={10}
                          tickLine={false}
                          axisLine={false}
                          dx={-4}
                        />
                        <Tooltip content={<CustomTrendTooltip />} />
                        {/* Target line for 80% passing */}
                        <ReferenceLine y={8} stroke="#14b8a6" strokeDasharray="4 4" label={{ value: '80% Competency', fill: '#14b8a6', fontSize: 9, position: 'top', offset: 4 }} opacity={0.5} />
                        <Line
                          type="monotone"
                          dataKey="score"
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          dot={{ r: 4, strokeWidth: 1.5, fill: "#0f172a", stroke: "#6366f1" }}
                          activeDot={{ r: 6, strokeWidth: 2, fill: "#6366f1", stroke: "#e6edf3" }}
                          name="Quiz Score"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>

            {/* QUIZ HISTORY LIST */}
            <div className="glass rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-white/5 pb-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <History className="w-5 h-5" />
                  <h4 className="font-extrabold text-[#e6edf3] text-sm sm:text-base">{translations.quizHistoryTitle}</h4>
                </div>
                {quizHistory.length > 0 && (
                  <button
                    onClick={() => {
                      triggerSound("click");
                      try {
                        localStorage.removeItem("bacteria_quiz_history");
                        setQuizHistory([]);
                      } catch(e) {
                        console.error(e);
                      }
                    }}
                    className="text-[10px] uppercase tracking-wider font-extrabold text-rose-400 hover:text-rose-300 transition-colors"
                  >
                    Clear History 🗑
                  </button>
                )}
              </div>

              {quizHistory.length === 0 ? (
                <div className="bg-black/20 border border-white/5 p-8 rounded-xl text-center space-y-2">
                  <Sparkles className="w-8 h-8 text-indigo-400/30 mx-auto" />
                  <p className="text-xs text-[#8b949e] max-w-sm mx-auto leading-relaxed">
                    {translations.quizHistoryEmpty}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-white/5 bg-[#030712]/50 max-h-72">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-white/5 bg-slate-900/60 text-[#8b949e] font-black uppercase tracking-wider text-[10px]">
                        <th className="p-3 sm:p-4">{translations.quizHistoryDate}</th>
                        <th className="p-3 sm:p-4">{translations.quizHistoryDifficulty}</th>
                        <th className="p-3 sm:p-4 text-right">{translations.quizHistoryScore}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {quizHistory.map((item) => {
                        let diffBadgeColor = "text-amber-400 bg-amber-400/10 border-amber-400/20";
                        if (item.difficulty === "easy") {
                          diffBadgeColor = "text-emerald-400 bg-emerald-400/10 border-emerald-400/20";
                        } else if (item.difficulty === "hard") {
                          diffBadgeColor = "text-rose-400 bg-rose-400/10 border-rose-500/20";
                        }
                        
                        const percent = (item.score / item.total) * 100;
                        let scoreBadgeColor = "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";
                        if (percent < 50) {
                          scoreBadgeColor = "text-rose-400 bg-rose-500/10 border-rose-500/20";
                        } else if (percent < 80) {
                          scoreBadgeColor = "text-amber-400 bg-amber-500/10 border-amber-500/20";
                        }

                        return (
                          <tr key={item.id} className="hover:bg-white/5 transition-colors">
                            <td className="p-3 sm:p-4 font-mono text-[#8b949e]">
                              <span className="inline-flex items-center gap-2">
                                <Calendar className="w-3.5 h-3.5 text-indigo-400/60 shrink-0" />
                                <span>{item.date}</span>
                              </span>
                            </td>
                            <td className="p-3 sm:p-4">
                              <span className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider ${diffBadgeColor}`}>
                                {translations[item.difficulty] || item.difficulty}
                              </span>
                            </td>
                            <td className="p-3 sm:p-4 text-right">
                              <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-xs font-black font-mono ${scoreBadgeColor}`}>
                                <Award className="w-3.5 h-3.5" />
                                <span>{item.score} / {item.total}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* HISTOLOGY METADATA DOCS */}
            <div className="glass rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
              <div className="flex items-center gap-2 text-indigo-400">
                <FileText className="w-5 h-5" />
                <h4 className="font-bold text-[#e6edf3]">Biochemical Assays & Selective Culture Media Handbook</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
                
                <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                  <h5 className="font-bold text-teal-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-teal-400"></span>
                    Mannitol Salt Agar (MSA)
                  </h5>
                  <p className="text-[#8b949e] leading-relaxed">
                    Contains high NaCl concentrations (7.5%) to inhibit non-halophilic microbes. Fermentation of D-mannitol by Staphylococcus aureus produces acidic end-products, turning the medium from red-pink to golden-yellow.
                  </p>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                  <h5 className="font-bold text-purple-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    MacConkey's Agar (MAC)
                  </h5>
                  <p className="text-[#8b949e] leading-relaxed">
                    Selective for Gram-negative organisms; bile salts and crystal violet inhibit Gram-positive species. Lactose fermenters (like E. coli) form distinctive pink colonies.
                  </p>
                </div>

                <div className="bg-black/30 p-4 rounded-xl border border-white/5 space-y-2">
                  <h5 className="font-bold text-rose-400 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Blood Agar Hemolysis Assays
                  </h5>
                  <p className="text-[#8b949e] leading-relaxed">
                    Investigates red blood cell envelope lysis: Beta-hemolysis (complete clearance around colony), Alpha-hemolysis (partial greenish discolored zone), or Gamma-hemolysis (no hemolytic activity).
                  </p>
                </div>

              </div>
            </div>

          </div>
        )}

      </main>

      {/* FOOTER COOPERATIONS */}
      <footer className="mt-12 glass border-r-0 border-l-0 border-b-0 border-t border-white/5 py-8 text-center text-xs text-[#8b949e] space-y-3">
        <p className="max-w-md mx-auto leading-relaxed px-4">
          This medical bacteriology dictionary and evaluation sandbox is a professional, high-performance web asset created by <strong>M. Hemati Alam</strong> as a showcase for interactive reference materials and clinical diagnostic biology.
        </p>

        <div className="text-[10px] text-[#484f58] pt-1 pt-b">
          <span>© {new Date().getFullYear()} M. Hemati Alam • Laboratory Medicine & Web Architecture Portfolio</span>
        </div>
      </footer>

      {/* DETAILED MODAL OVERLAY */}
      <AnimatePresence>
        {selectedBacterium && (
          <div key={`details-modal-${selectedBacterium.id}`} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            
            {/* Modal Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.8 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedBacterium(null)}
              className="absolute inset-0 bg-[#040609]/75 backdrop-blur-sm"
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="relative w-full max-w-2xl glass-heavy border border-white/10 rounded-2xl overflow-hidden shadow-2xl z-10 p-0 text-left max-h-[90vh] flex flex-col"
            >
              
              {/* Modal Strips indicator */}
              <div className={`h-1 mx-auto w-full bg-gradient-to-l ${getGramConfig(selectedBacterium.gram).color}`}></div>

              {/* Header */}
              <div className="p-5 sm:p-6 bg-black/20 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-2xl shadow-inner shrink-0 leading-none">
                    {selectedBacterium.icon}
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-black text-[#e6edf3]">
                      {selectedBacterium.faName}
                    </h3>
                    <p className="text-xs text-teal-400 font-mono italic mt-0.5">
                      {selectedBacterium.latinName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedBacterium(null)}
                  className="p-2 bg-white/5 hover:bg-white/10 text-[#8b949e] hover:text-[#e6edf3] rounded-lg transition-colors leading-none"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Scrollable specs body */}
              <div className="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm leading-relaxed flex-1">
                
                {/* Visual statistics pill badges */}
                <div className="flex flex-wrap gap-2">
                  <span className={`text-xs px-3 py-1 rounded-full font-bold ${getGramConfig(selectedBacterium.gram).badge}`}>
                    {getGramConfig(selectedBacterium.gram).label}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full font-bold border border-amber-500/30 bg-amber-950/20 text-amber-300">
                    Catalase: {translateCatalase(selectedBacterium.catalase)}
                  </span>
                  <span className="text-xs px-3 py-1 rounded-full font-bold border border-teal-500/30 bg-teal-950/20 text-teal-300">
                    Oxygen: {translateOxygen(selectedBacterium.oxygen)}
                  </span>
                </div>

                {/* Grid descriptions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  <div className="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                    <span className="text-xs text-teal-400 font-bold block">{translations.shapeLabel}</span>
                    <p className="text-[#e6edf3] text-xs leading-relaxed">{selectedBacterium.shape}</p>
                  </div>

                  <div className="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl">
                    <span className="text-xs text-amber-400 font-bold block">{translations.habitatLabel}</span>
                    <p className="text-[#e6edf3] text-xs leading-relaxed">{selectedBacterium.habitat}</p>
                  </div>

                  {selectedBacterium.colony && (
                    <div className="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl md:col-span-2">
                      <span className="text-xs text-purple-400 font-bold block">{translations.colonyLabel}</span>
                      <p className="text-[#e6edf3] text-xs leading-relaxed">{selectedBacterium.colony}</p>
                    </div>
                  )}

                  <div className="space-y-1 p-3 bg-black/30 border border-white/5 rounded-xl md:col-span-2">
                    <span className="text-xs text-indigo-400 font-bold block">{translations.mediumLabel}</span>
                    <p className="text-[#e6edf3] text-xs tracking-wide">{selectedBacterium.cultureMedium}</p>
                  </div>

                </div>

                {/* Substantive descriptions: Disease & treatment */}
                <div className="bg-[#1f1519]/70 border border-rose-900/30 rounded-xl p-4 space-y-2">
                  <h4 className="font-extrabold text-xs text-rose-300 flex items-center gap-1.5">
                    <span>🦠</span>
                    <span>{translations.diseasesLabel}</span>
                  </h4>
                  <p className="text-rose-100/90 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {selectedBacterium.diseases}
                  </p>
                </div>

                <div className="bg-teal-950/20 border border-teal-900/30 rounded-xl p-4 space-y-2">
                  <h4 className="font-extrabold text-xs text-teal-300 flex items-center gap-1.5">
                    <span>💊</span>
                    <span>{translations.treatmentLabel}</span>
                  </h4>
                  <p className="text-teal-100/90 text-xs sm:text-sm leading-relaxed whitespace-pre-line">
                    {selectedBacterium.treatment}
                  </p>
                </div>

                {/* Personal Study Notes */}
                <div className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-4 space-y-2.5 shadow-inner relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-xs text-indigo-300 flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>{translations.studyNotesLabel}</span>
                    </h4>
                    {personalNotes.trim() && (
                      <span className={`text-[10px] font-semibold transition-all duration-300 ${
                        isNotesSaved ? "text-teal-400" : "text-amber-400 animate-pulse"
                      }`}>
                        {isNotesSaved ? `✓ ${translations.studyNotesSaved}` : "Draft / Typing..."}
                      </span>
                    )}
                  </div>
                  <textarea
                    value={personalNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder={translations.studyNotesPlaceholder}
                    rows={3}
                    className="w-full bg-slate-900/60 border border-slate-800 focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 text-[#e6edf3] text-xs p-3 rounded-lg placeholder-slate-500 outline-none resize-y transition-all leading-relaxed"
                  />

                  {/* Saved Confirmation Overlay */}
                  <AnimatePresence>
                    {showSavedAnimation && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="absolute inset-0 bg-slate-950/90 rounded-xl flex flex-col items-center justify-center backdrop-blur-xs z-30 border border-teal-500/20"
                      >
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: [0, 1.15, 1] }}
                          transition={{ duration: 0.3 }}
                          className="w-9 h-9 rounded-full bg-teal-500/10 border border-teal-400/30 flex items-center justify-center text-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.2)]"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </motion.div>
                        <motion.span 
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.12 }}
                          className="text-[10px] font-black text-teal-300 mt-2 tracking-widest uppercase"
                        >
                          {translations.studyNotesSaved || "Saved"}
                        </motion.span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              </div>

              {/* Footer action buttons */}
              <div className="p-4 sm:p-5 bg-black/20 border-t border-white/5 flex items-center justify-between gap-4">
                <button
                  onClick={() => setSelectedBacterium(null)}
                  className="px-5 py-2 bg-white/5 hover:bg-white/10 text-[#8b949e] hover:text-[#e6edf3] text-xs sm:text-sm font-bold rounded-xl transition-all"
                >
                  Close
                </button>
                <a
                  href={`https://en.wikipedia.org/wiki/${encodeURIComponent(selectedBacterium.latinName)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-l from-teal-500 to-teal-600 text-[#090d13] font-black rounded-xl text-xs sm:text-sm shadow-md hover:brightness-105 transition-all"
                >
                  <span>Wikipedia</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
