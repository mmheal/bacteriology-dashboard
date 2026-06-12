export const translations = {
  name: "Medical Bacteriology Encyclopedia",
  // Gram stains
  gpos: {
    label: "Gram-Positive",
    sub: "Gram-Positive",
    color: "from-purple-600 to-indigo-700",
    bg: "bg-purple-950/40 border-purple-800/60 text-purple-200",
    badge: "bg-purple-600 text-white",
  },
  gneg: {
    label: "Gram-Negative",
    sub: "Gram-Negative",
    color: "from-rose-600 to-pink-700",
    bg: "bg-rose-950/40 border-rose-800/60 text-rose-200",
    badge: "bg-rose-600 text-white",
  },

  // Catalase
  positive: "Catalase ＋",
  negative: "Catalase −",
  none: "Undetermined",

  // Oxygen requirements
  aerobic: "Aerobic",
  anaerobic: "Obligate Anaerobic",
  facultative: "Facultative Anaerobic",
  microaerophilic: "Microaerophilic",

  // UI elements
  searchPlaceholder: "🔍 Search bacterial name, diseases, treatment, or keywords...",
  searchLabel: "Search:",
  filterGram: "Gram Stain:",
  filterCatalase: "Catalase:",
  filterOxygen: "Oxygen Requirements:",
  all: "All",
  totalFound: "organisms found",
  gposCount: "Gram-Positive",
  gnegCount: "Gram-Negative",
  readMoreEn: "Wikipedia (EN)",
  readMoreFa: "Wikipedia 📖",
  diseasesLabel: "🦠 Associated Diseases",
  treatmentLabel: "💊 Antibiotics, Treatment & Resistance",
  shapeLabel: "🔬 Morphology & Arrangement",
  mediumLabel: "🧫 Selective/Differential Media",
  colonyLabel: "🏘 Colony Characteristics & Bio-tests",
  habitatLabel: "🌍 Natural Habitat",
  studyNotesLabel: "📝 Personal Study Notes",
  studyNotesPlaceholder: "Type your personal notes, study mnemonics, or diagnostic reminder tips for this bacterium here... (auto-saved)",
  studyNotesSaved: "Auto-saved to device",
  difficultyLabel: "Quiz Difficulty:",
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  difficultyEasyDesc: "2 options (Correct + 1 distractor)",
  difficultyMediumDesc: "3 options (Correct + 2 distractors)",
  difficultyHardDesc: "4 options (Correct + 3 distractors)",
  timedModeLabel: "⏱ Timed Challenge Mode",
  timedModeDesc: "A ticking countdown per question! Time limit scales with quiz difficulty.",
  timedModeTime: "Time Left",
  timedModeSecs: "seconds",
  timedModeTimeout: "Time's Up!",

  // Tabs
  dashboardTab: "🔬 Bacteria Database",
  questionsTab: "Interactive Quiz",
  statisticsTab: "📊 Analytical Statistics",

  // Quiz items
  quizTitle: "Microbiology Challenge Quiz",
  quizDesc: "Assess your knowledge of bacterial morphology, Gram stains, catalase tests, selective media, and associated clinical infections!",
  score: "Score:",
  streak: "Correct Streak:",
  progress: "Quiz Progress:",
  correctFeedback: "Correct answer! Well done! 🎉",
  incorrectFeedback: "Incorrect answer. The correct answer has been highlighted in green. ❌",
  nextQuestion: "Next Question ➔",
  restartQuiz: "Restart Quiz 🔄",
  finalScore: "Quiz Completed! Your final score is:",
  congrats: "Outstanding! You are an expert medical microbiologist! 🎓",
  keepTrying: "Good try! Challenge yourself again to achieve a perfect score. 💪",
  questionOf: "Question",
  outOf: "of",
  quizHistoryTitle: "⏳ Recent Quiz History (Last 5)",
  quizHistoryEmpty: "No quiz runs in the record yet. Finish a quiz challenge to start tracking your performance!",
  quizHistoryDate: "Date & Time",
  quizHistoryScore: "Result",
  quizHistoryDifficulty: "Difficulty"
};

export function getGramConfig(gram: 'gpos' | 'gneg') {
  return translations[gram] || {
    label: gram,
    sub: "",
    color: "from-slate-600 to-slate-700",
    bg: "bg-slate-900",
    badge: "bg-slate-500",
  };
}

export function translateOxygen(oxygen: string) {
  return (translations as any)[oxygen] || oxygen;
}

export function translateCatalase(catalase: string) {
  return (translations as any)[catalase] || catalase;
}
