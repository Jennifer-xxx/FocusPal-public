import {
  RoutedThought,
  ThoughtCategory,
  isRewardEligible,
} from "./thoughts";

const keywordRules: Array<{
  category: ThoughtCategory;
  confidence: number;
  keywords: string[];
}> = [
  {
    category: "game",
    confidence: 0.9,
    keywords: ["game", "steam", "nikki", "wuthering waves", "wordle", "switch"],
  },
  {
    category: "media",
    confidence: 0.88,
    keywords: ["watch", "movie", "show", "youtube", "tiktok", "song", "album", "read"],
  },
  {
    category: "food",
    confidence: 0.86,
    keywords: ["food", "coffee", "ramen", "snack", "dinner", "lunch", "boba", "eat", "cook", "drink"],
  },
  {
    category: "shopping",
    confidence: 0.84,
    keywords: ["buy", "order", "amazon", "cart", "deal", "shopping", "target", "walmart"],
  },
  {
    category: "message",
    confidence: 0.82,
    keywords: ["text", "reply", "email", "dm", "message", "slack"],
  },
  {
    category: "study",
    confidence: 0.82,
    keywords: ["study", "homework", "lecture", "class", "exam", "quiz", "notes"],
  },
  {
    category: "task",
    confidence: 0.82,
    keywords: ["todo", "submit", "finish", "schedule", "call", "pay"],
  },
  {
    category: "search",
    confidence: 0.78,
    keywords: ["search", "look up", "google", "find", "read about", "research"],
  },
  {
    category: "idea",
    confidence: 0.74,
    keywords: ["idea", "maybe", "what if", "build", "write about"],
  },
];

export function classifyThought(rawText: string): RoutedThought {
  const normalized = rawText.trim().toLowerCase();
  const rule = keywordRules.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  const category = rule?.category ?? "other";
  const confidence = rule?.confidence ?? 0.35;

  return {
    category,
    confidence,
    rewardEligible: isRewardEligible(category, confidence),
    title: createThoughtTitle(rawText),
  };
}

function createThoughtTitle(rawText: string) {
  const compact = rawText.trim().replace(/\s+/g, " ");

  return compact || "Untitled thought";
}
