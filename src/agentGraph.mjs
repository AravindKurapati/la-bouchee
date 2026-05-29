const MEAL_TYPES = ["breakfast", "lunch", "dinner"];

const MULTIWORD_FOODS = [
  "iced coffee",
  "cold brew",
  "cream cheese",
  "fried rice",
  "mac and cheese",
  "green tea",
  "chicken tikka",
  "caesar salad",
  "sweet potato",
  "overnight oats",
  "avocado toast",
  "protein shake",
  "greek yogurt",
  "banana bread"
];

const TAG_RULES = [
  { tag: "caffeine", words: ["coffee", "espresso", "latte", "cold brew", "chai", "matcha"] },
  { tag: "protein", words: ["egg", "chicken", "beef", "salmon", "tuna", "tofu", "beans", "lentil", "yogurt", "turkey", "paneer", "protein"] },
  { tag: "carb", words: ["rice", "bread", "bagel", "pasta", "noodle", "tortilla", "oats", "cereal", "potato", "toast", "pancake", "waffle", "naan", "paratha"] },
  { tag: "fruit", words: ["banana", "apple", "berry", "berries", "mango", "orange", "grape", "pineapple"] },
  { tag: "vegetable", words: ["salad", "spinach", "broccoli", "pepper", "tomato", "avocado", "greens", "cucumber", "carrot", "kale"] },
  { tag: "dairy", words: ["milk", "cheese", "yogurt", "cream", "paneer"] },
  { tag: "sweet", words: ["cookie", "cake", "brownie", "donut", "honey", "chocolate", "dessert", "banana bread"] },
  { tag: "spicy", words: ["spicy", "hot sauce", "jalapeno", "chili", "sriracha", "gochujang"] },
  { tag: "comfort", words: ["soup", "ramen", "mac and cheese", "pizza", "pasta", "curry", "stew", "grilled cheese"] },
  { tag: "light", words: ["salad", "smoothie", "fruit", "soup", "yogurt"] },
  { tag: "quick", words: ["quick", "grabbed", "bar", "protein shake", "cereal", "toast"] },
  { tag: "leftovers", words: ["leftover", "leftovers"] },
  { tag: "homemade", words: ["made", "cooked", "home", "homemade", "meal prep"] },
  { tag: "restaurant", words: ["restaurant", "cafe", "diner", "truck"] },
  { tag: "takeout", words: ["takeout", "delivery", "doordash", "uber eats", "ordered"] }
];

const CUISINE_RULES = [
  { cuisine: "Indian", words: ["dosa", "idli", "sambar", "curry", "paneer", "naan", "biryani", "tikka", "paratha", "dal"] },
  { cuisine: "Japanese", words: ["sushi", "ramen", "miso", "udon", "soba", "teriyaki"] },
  { cuisine: "Mexican", words: ["taco", "burrito", "quesadilla", "salsa", "tortilla", "guac", "enchilada"] },
  { cuisine: "Italian", words: ["pasta", "pizza", "risotto", "gnocchi", "lasagna", "pesto"] },
  { cuisine: "Korean", words: ["kimchi", "bibimbap", "gochujang", "bulgogi"] },
  { cuisine: "Chinese", words: ["dumpling", "lo mein", "fried rice", "mapo", "bao"] },
  { cuisine: "Thai", words: ["pad thai", "thai", "green curry", "tom yum"] },
  { cuisine: "Mediterranean", words: ["hummus", "falafel", "pita", "shawarma", "gyro", "tzatziki"] },
  { cuisine: "American", words: ["bagel", "burger", "pancake", "waffle", "mac and cheese", "grilled cheese"] }
];

const TEXTURE_RULES = [
  { tag: "crunchy", words: ["toast", "chips", "granola", "cereal", "crouton", "apple", "salad"] },
  { tag: "soft", words: ["oats", "rice", "yogurt", "soup", "ramen", "pasta", "banana"] },
  { tag: "saucy", words: ["curry", "soup", "stew", "sauce", "ramen", "pasta"] },
  { tag: "cold", words: ["iced", "smoothie", "salad", "yogurt", "cold brew"] },
  { tag: "hot", words: ["coffee", "soup", "ramen", "curry", "tea", "stew"] }
];

function cleanSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function protectPhrases(text) {
  let next = text;
  for (const phrase of MULTIWORD_FOODS) {
    const token = phrase.replaceAll(" ", "_");
    next = next.replace(new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "gi"), token);
  }
  return next;
}

function unprotect(value) {
  return value.replaceAll("_", " ");
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isSkipped(rawText) {
  return /\b(skipped|nothing|fasted|fasting|no meal|did not eat|didn't eat)\b/i.test(rawText);
}

function extractFoods(rawText) {
  if (isSkipped(rawText)) return [];

  let text = protectPhrases(rawText.toLowerCase());
  text = text
    .replace(/\b(i|we)\s+(had|ate|made|cooked|got|grabbed|ordered|did)\b/g, " ")
    .replace(/\b(for|as)\s+(breakfast|lunch|dinner)\b/g, " ")
    .replace(/\bwith a side of\b/g, ",")
    .replace(/\bwith\b/g, ",")
    .replace(/\bplus\b/g, ",")
    .replace(/\band\b/g, ",")
    .replace(/[.;/|+&]/g, ",")
    .replace(/\bfrom\b.+$/g, " ");

  const stopWords = new Set(["a", "an", "the", "some", "my", "one", "two", "today", "tonight", "morning"]);
  const foods = text
    .split(",")
    .map((item) => unprotect(item))
    .map((item) => item.replace(/[^a-z0-9 '\-]/g, " "))
    .map((item) => cleanSpaces(item))
    .map((item) => item.split(" ").filter((word) => !stopWords.has(word)).join(" "))
    .map((item) => cleanSpaces(item))
    .filter((item) => item.length > 1 && item.length < 44)
    .filter((item) => !/^(at|near|home|restaurant|cafe)$/.test(item));

  return [...new Set(foods)].slice(0, 12);
}

function inferTags(rawText, foods) {
  const haystack = `${rawText} ${foods.join(" ")}`.toLowerCase();
  const tags = new Set();

  if (isSkipped(rawText)) tags.add("skipped");
  for (const rule of [...TAG_RULES, ...TEXTURE_RULES]) {
    if (rule.words.some((word) => haystack.includes(word))) tags.add(rule.tag);
  }
  if (!tags.has("homemade") && !tags.has("restaurant") && !tags.has("takeout")) {
    tags.add("unclear-source");
  }
  return [...tags].sort();
}

function inferCuisine(rawText, foods) {
  const haystack = `${rawText} ${foods.join(" ")}`.toLowerCase();
  const matches = CUISINE_RULES.filter((rule) => rule.words.some((word) => haystack.includes(word)));
  if (matches.length === 0) return "Mixed";
  return matches[0].cuisine;
}

function inferSource(rawText, tags) {
  const text = rawText.toLowerCase();
  if (isSkipped(rawText)) return "skipped";
  if (tags.includes("takeout") || /\b(delivery|doordash|uber eats|takeout|ordered)\b/.test(text)) return "takeout";
  if (tags.includes("restaurant") || /\b(cafe|restaurant|diner|truck|spot)\b/.test(text)) return "restaurant";
  if (tags.includes("homemade") || /\b(home|homemade|made|cooked|leftover)\b/.test(text)) return "home";
  return "unknown";
}

function publicList(items) {
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

function titleMealType(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function runPrivacyAgent(rawText) {
  const issues = [];
  const patterns = [
    {
      label: "email",
      severity: "high",
      regex: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
      replacement: "[email]"
    },
    {
      label: "phone number",
      severity: "high",
      regex: /\b(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}\b/g,
      replacement: "[phone]"
    },
    {
      label: "street address",
      severity: "high",
      regex: /\b\d{1,5}\s+[A-Za-z0-9 .'-]+\s+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)\b/gi,
      replacement: "[address]"
    },
    {
      label: "exact price",
      severity: "low",
      regex: /\$\s?\d+(?:\.\d{2})?/g,
      replacement: "[price]"
    }
  ];

  let redactedText = rawText;
  for (const pattern of patterns) {
    if (pattern.regex.test(rawText)) {
      issues.push({
        label: pattern.label,
        severity: pattern.severity,
        detail: `Detected ${pattern.label}; public copy should redact it.`
      });
      pattern.regex.lastIndex = 0;
      redactedText = redactedText.replace(pattern.regex, pattern.replacement);
    }
  }

  if (/\b(near my|by my|around my|my apartment|my dorm|my office)\b/i.test(rawText)) {
    issues.push({
      label: "location clue",
      severity: "medium",
      detail: "This sounds like it could reveal a recurring location."
    });
  }

  const nameMatch = rawText.match(/\bwith\s+([A-Z][a-z]+)\b/);
  if (nameMatch) {
    issues.push({
      label: "person name",
      severity: "medium",
      detail: `The entry mentions ${nameMatch[1]}; consider removing names from public posts.`
    });
  }

  return {
    issues,
    redactedText: cleanSpaces(redactedText),
    publishable: !issues.some((issue) => issue.severity === "high")
  };
}

function makeCaption({ mealType, foods, tags, cuisine, source }) {
  const mealName = titleMealType(mealType);
  if (tags.includes("skipped")) return `${mealName} was skipped.`;
  const base = foods.length ? publicList(foods.slice(0, 5)) : "an unstructured meal";
  const sourcePhrase = source === "home" ? " at home" : source === "takeout" ? " from takeout" : source === "restaurant" ? " out" : "";
  const cuisinePhrase = cuisine && cuisine !== "Mixed" ? ` (${cuisine})` : "";
  return `${mealName}: ${base}${sourcePhrase}${cuisinePhrase}.`;
}

function confidenceFor({ foods, tags, privacyIssues }) {
  let score = 0.7;
  if (foods.length > 0) score += 0.12;
  if (foods.length > 2) score += 0.06;
  if (!tags.includes("unclear-source")) score += 0.04;
  if (privacyIssues.length === 0) score += 0.05;
  if (tags.includes("skipped")) score = 0.95;
  return Number(Math.min(score, 0.98).toFixed(2));
}

export function runMealAgentGraph(input) {
  const date = input.date || new Date().toISOString().slice(0, 10);
  const mealType = MEAL_TYPES.includes(input.mealType) ? input.mealType : "breakfast";
  const rawText = cleanSpaces(input.rawText);
  const photoUrl = cleanSpaces(input.photoUrl);
  const trace = [];

  if (!rawText) {
    throw new Error("rawText is required");
  }

  const privacy = runPrivacyAgent(rawText);
  trace.push({
    name: "privacy-agent",
    status: privacy.publishable ? "clear" : "review",
    summary: privacy.issues.length ? `${privacy.issues.length} privacy signal(s) found` : "No sensitive detail detected"
  });

  const foods = extractFoods(privacy.redactedText);
  trace.push({
    name: "parser-agent",
    status: foods.length || isSkipped(rawText) ? "clear" : "review",
    summary: foods.length ? `Extracted ${foods.length} food item(s)` : "No foods extracted"
  });

  const tags = inferTags(privacy.redactedText, foods);
  const cuisine = inferCuisine(privacy.redactedText, foods);
  const source = inferSource(privacy.redactedText, tags);
  trace.push({
    name: "tagger-agent",
    status: "clear",
    summary: `${tags.slice(0, 4).join(", ")}${tags.length > 4 ? "..." : ""}`
  });

  const publicCaption = makeCaption({ mealType, foods, tags, cuisine, source });
  trace.push({
    name: "caption-agent",
    status: "clear",
    summary: publicCaption
  });

  const confidence = confidenceFor({ foods, tags, privacyIssues: privacy.issues });
  trace.push({
    name: "memory-agent",
    status: "queued",
    summary: "Ready to update long-term public stats after publish"
  });

  return {
    date,
    mealType,
    rawText,
    redactedText: privacy.redactedText,
    foods,
    tags,
    cuisine,
    source,
    photoUrl,
    confidence,
    privacyIssues: privacy.issues,
    publishable: privacy.publishable,
    publicCaption,
    agentTrace: trace
  };
}
