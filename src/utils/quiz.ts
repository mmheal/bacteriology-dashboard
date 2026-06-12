import { Bacterium } from '../data/bacteria';

export type QuizDifficulty = 'easy' | 'medium' | 'hard';

export interface QuizHistoryItem {
  id: string;
  date: string;
  score: number;
  total: number;
  difficulty: QuizDifficulty;
}

export interface Question {
  id: number;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
  bacteriumId: number;
}

// Helper to shuffle array
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Generates 10 customizable random quiz questions strictly from the 28 bacteria
export function generateQuiz(bacteria: Bacterium[], difficulty: QuizDifficulty = 'medium'): Question[] {
  if (bacteria.length < 5) return [];

  const questionsList: Question[] = [];
  const shuffledBacteria = shuffleArray(bacteria);

  // Distractors count based on difficulty:
  // easy: 2 options (1 distractor)
  // medium: 3 options (2 distractors)
  // hard: 4 options (3 distractors)
  const totalOptionsCount = difficulty === 'easy' ? 2 : (difficulty === 'medium' ? 3 : 4);
  const distractorsCount = totalOptionsCount - 1;

  // We want to generate diverse question types (10 questions total)
  for (let i = 0; i < 10; i++) {
    const target = shuffledBacteria[i % shuffledBacteria.length];

    // Select randomly from 5 styles of questions
    const questionType = Math.floor(Math.random() * 5);
    let questionText = "";
    let correctAnswer = "";
    let explanation = "";
    let options: string[] = [];

    if (questionType === 0) {
      // Gram stain question
      questionText = `What is the Gram reaction and staining characteristics of "${target.faName} (${target.latinName})"?`;
      correctAnswer = target.gram === 'gpos' ? 'Gram-positive (blue/purple)' : 'Gram-negative (pink/red)';
      explanation = `The bacterium ${target.faName} is a ${target.gram === 'gpos' ? 'Gram-positive' : 'Gram-negative'} organism.`;

      const distractor = target.gram === 'gpos' ? 'Gram-negative (pink/red)' : 'Gram-positive (blue/purple)';
      const otherPotentials = ['Lacks a cell wall structure', 'Acid-fast (AFB) positive'];
      
      if (difficulty === 'easy') {
        options = [correctAnswer, distractor];
      } else if (difficulty === 'medium') {
        options = [correctAnswer, distractor, otherPotentials[0]];
      } else {
        options = [correctAnswer, distractor, ...otherPotentials];
      }
    }
    else if (questionType === 1) {
      // Disease association question
      const diseasesSplit = target.diseases.split(',');
      const sampleDisease = diseasesSplit[0].trim();

      questionText = `Which of the following bacteria is a primary causative agent of "${sampleDisease}" or related clinical complications?`;
      correctAnswer = target.faName;
      explanation = `The bacterium ${target.faName} is associated with several pathological conditions, including: ${target.diseases}.`;

      // Grab dynamic distractors
      const distractors = shuffledBacteria
        .filter(b => b.id !== target.id)
        .slice(0, distractorsCount)
        .map(b => b.faName);
      options = [correctAnswer, ...distractors];
    }
    else if (questionType === 2) {
      // Morphological shape question
      questionText = `How is the microscopic morphology and cell arrangement of "${target.faName}" described?`;
      correctAnswer = target.shape.split(';')[0].trim(); // first part of the shape description
      explanation = `The complete microscopic morphology of ${target.faName} is described as: ${target.shape}.`;

      // Distractors from other bacteria
      const distractors = shuffledBacteria
        .filter(b => b.id !== target.id)
        .map(b => b.shape.split(';')[0].trim())
        .filter(s => s !== correctAnswer && s.length > 3);

      const uniqueDistractors = Array.from(new Set(distractors)).slice(0, distractorsCount);
      while (uniqueDistractors.length < distractorsCount) {
        uniqueDistractors.push(
          uniqueDistractors.length === 0 ? "Spore-forming chain bacilli" :
          uniqueDistractors.length === 1 ? "Encapsulated tetrad cocci" : "Safety-pin bipolar bacilli"
        );
      }

      options = [correctAnswer, ...uniqueDistractors];
    }
    else if (questionType === 3) {
      // Culture Medium question
      const mediums = target.cultureMedium.split(',');
      const singleMedium = mediums[0].trim();

      questionText = `Which of the following bacteria is selectively isolated or primary identified using "${singleMedium}" agar?`;
      correctAnswer = target.faName;
      explanation = `The culture medium ${target.cultureMedium} is typically used to isolate or cultivate ${target.faName}.`;

      // Distractors
      const distractors = shuffledBacteria
        .filter(b => b.id !== target.id)
        .slice(0, distractorsCount)
        .map(b => b.faName);
      options = [correctAnswer, ...distractors];
    }
    else {
      // Catalase status question
      const catalaseEn = target.catalase === 'positive' ? 'Catalase-positive' : (target.catalase === 'negative' ? 'Catalase-negative' : 'Undetermined');
      questionText = `What is the biochemical reaction of "${target.faName}" regarding the catalase enzyme test?`;
      correctAnswer = catalaseEn;
      explanation = `The bacterium ${target.faName} is biochemicaly characterized as ${target.catalase === 'positive' ? 'catalase-positive (＋)' : 'catalase-negative (－)'}.`;

      const allCatalaseOptions = ['Catalase-positive', 'Catalase-negative', 'Variable/No specific test'];
      const otherPotentials = allCatalaseOptions.filter(o => o !== correctAnswer);

      if (difficulty === 'easy') {
        options = [correctAnswer, otherPotentials[0]];
      } else {
        options = [correctAnswer, ...otherPotentials]; // Max options for catalase is 3 anyway
      }
    }

    // Shuffle options and find the new index of correctAnswer
    const shuffledOptions = shuffleArray(Array.from(new Set(options)));
    const correctIdx = shuffledOptions.indexOf(correctAnswer);

    questionsList.push({
      id: i + 1,
      questionText,
      options: shuffledOptions,
      correctAnswerIndex: correctIdx !== -1 ? correctIdx : 0,
      explanation,
      bacteriumId: target.id
    });
  }

  return questionsList;
}
