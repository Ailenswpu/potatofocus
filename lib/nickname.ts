const ADJ = [
  "quiet",
  "calm",
  "swift",
  "golden",
  "silver",
  "brave",
  "gentle",
  "wild",
  "soft",
  "amber",
  "misty",
  "bright",
];
const NOUN = [
  "fox",
  "owl",
  "deer",
  "moon",
  "river",
  "leaf",
  "fern",
  "star",
  "wave",
  "pine",
  "wren",
  "lark",
];

export function randomNickname(): string {
  const a = ADJ[Math.floor(Math.random() * ADJ.length)];
  const n = NOUN[Math.floor(Math.random() * NOUN.length)];
  const d = Math.floor(Math.random() * 90) + 10;
  return `${a}${n}${d}`;
}

export function randomClientId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
