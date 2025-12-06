const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours (in ms)

// Load cache object from localStorage.
// Uses a single key "glassdoorCache" which stores a JSON object:
// {
//   "google": { timestamp: ..., data: {...} },
//   "amazon": { timestamp: ..., data: {...} }
// }
// This avoids cluttering browser storage with many keys.
function loadCache() {
  try {
    return JSON.parse(localStorage.glassdoorCache || "{}");
  } catch {
    // If parsing fails (corrupted JSON), reset to clean state
    return {};
  }
}

// Persist the cache object back into localStorage.
function saveCache(cache) {
  localStorage.glassdoorCache = JSON.stringify(cache);
}

// Fetches Glassdoor rating for a company.
//   - Instant lookup from cache if fresh
//   - Scraping fallback if not cached or expired
//   - Auto-caches new results
//
// Returns object:
//   { rating: "3.8", reviews: "3.8K", link: "https://..." }
async function getGlassdoorRating(company) {
  try {
    const key = company.toLowerCase();
    const cache = loadCache();
    const now = Date.now(); // Timestamp for caching

    // Search cached data
    if (cache[key] && now - cache[key].timestamp < CACHE_TTL) {
      return cache[key].data;
    }

    // If the company exists in cache AND is younger than TTL, return instantly.
    const searchUrl = `https://www.glassdoor.com/Search/results.htm?keyword=${encodeURIComponent(
      company
    )}`;

    // Fetch the search results page HTML
    const res = await fetch(searchUrl);
    const html = await res.text();

    // Parse HTML so DOM selectors can be used
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Find the Companies module that contains company cards
    const companiesModule = doc.querySelector('[data-test="companies-module"]');
    if (!companiesModule) {
      return { rating: "-", reviews: "-", link: "" };
    }

    // Get all company cards
    const cards = companiesModule.querySelectorAll(
      '[data-test="company-card"]'
    );
    if (!cards.length) {
      return { rating: "-", reviews: "-", link: "" };
    }

    const lookupCandidates = generateLookupCandidates(company); // Build a prioritized list of normalized candidates by stripping locale hints.
    const card = selectBestCompanyCard(cards, lookupCandidates); // Select the best company card based on the lookup candidates.
    if (!card) { // If no card is found, return a default value.
      return { rating: "-", reviews: "-", link: "" };
    }

    // Extract rating
    const ratingEl = card.querySelector(
      ".employer-card_employerRatingContainer__w93y9" // Select the rating element.
    );
    const rating = ratingEl ? ratingEl.childNodes[0].textContent.trim() : "-"; // Extract the rating text.

    // Extract reviews count
    const counts = card.querySelectorAll(".CompanyCard_companyCount__uHBhK"); // Select the reviews count elements.
    let reviews = "-";

    counts.forEach((span) => {
      const nextText = span.nextElementSibling?.textContent
        ?.trim()
        .toLowerCase();
      // The span whose label is "reviews"
      if (nextText === "reviews") {
        reviews = span.textContent.trim();
      }
    });

    // Extract glassdoor company link
    const linkEl = card.querySelector("a[href]");
    let link = "-";
    if (linkEl) {
      let href = linkEl.getAttribute("href");
      if (href.startsWith("/")) {
        link = "https://www.glassdoor.com" + href;
      } else {
        link = href;
      }
    }

    const data = { rating, reviews, link };

    // Store result in cache
    cache[key] = {
      timestamp: now,
      data,
    };
    saveCache(cache);

    return data;
  } catch (err) {
    console.error("Glassdoor scraping failed:", err);
    return { rating: "-", reviews: "-", link: "-" };
  }
}

// Common suffixes and legal designators that do not help with fuzzy matches.
const GENERIC_SUFFIXES = new Set([
  "inc",
  "inc.",
  "incorporated",
  "llc",
  "l.l.c.",
  "ltd",
  "ltd.",
  "limited",
  "co",
  "co.",
  "company",
  "corp",
  "corp.",
  "corporation",
  "plc",
]);

const MATCH_THRESHOLD = 0.58;

// Terms we frequently see appended to company names on LinkedIn (region, locale, etc.)
const LOCATION_HINTS = new Set([
  "india",
  "us",
  "usa",
  "united",
  "states",
  "state",
  "uk",
  "england",
  "canada",
  "singapore",
  "germany",
  "france",
  "spain",
  "italy",
  "japan",
  "china",
  "hong",
  "kong",
  "australia",
  "brazil",
  "mexico",
  "uae",
  "dubai",
  "sydney",
  "london",
  "bangalore",
  "bengaluru",
  "delhi",
  "mumbai",
  "tokyo",
  "paris",
  "europe",
  "asia",
  "global",
  "emea",
  "apac",
]);

const PREPOSITION_TOKENS = new Set(["in", "at", "for", "of", "by"]);

function selectBestCompanyCard(cards, lookupCandidates) {
  // Always keep at least one candidate so we evaluate every Glassdoor card.
  const candidates =
    Array.isArray(lookupCandidates) && lookupCandidates.length
      ? lookupCandidates
      : [""];

  let bestScore = 0;
  let bestCard = null;

  cards.forEach((card) => {
    if (bestScore === 1) return; // If we already found the best match, stop searching.

    const nameEl =
      card.querySelector('[data-test="employer-name"]') ||
      card.querySelector(".employer-card_employerName__kSwU7");
    if (!nameEl) return;

    const rawName = nameEl.textContent.trim();
    if (!rawName) return;

    const normalized = normalizeCompanyName(rawName) || rawName.toLowerCase();
    candidates.forEach((candidate, index) => {
      if (!candidate) return;

      if (normalized === candidate) {
        bestCard = card;
        bestScore = 1;
        return;
      }

      // Slightly down-weight progressively relaxed candidates so exact strings win.
      const candidateWeight = Math.max(0.6, 1 - index * 0.1);
      const score = getNameSimilarity(normalized, candidate) * candidateWeight;
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    });
  });
  if (bestScore < MATCH_THRESHOLD) {
    return null;
  }
  return bestCard;
}

function normalizeCompanyName(value) {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !GENERIC_SUFFIXES.has(token))
    .join(" ")
    .trim();
}

// Build a prioritized list of normalized candidates by stripping locale hints.
function generateLookupCandidates(value) {
  const normalized = normalizeCompanyName(value);

  if (!normalized) {
    const fallback = value ? value.toString().trim().toLowerCase() : "";
    return fallback ? [fallback] : [];
  }

  const tokens = normalized.split(" ").filter(Boolean);
  const candidates = new Set([normalized]);

  // Drop everything after a preposition like "in" or "at".
  const prepIndex = tokens.findIndex((token) => PREPOSITION_TOKENS.has(token));
  if (prepIndex > 0) {
    candidates.add(tokens.slice(0, prepIndex).join(" "));
  }

  // Remove trailing region/city tokens (LinkedIn often appends them).
  for (let i = tokens.length - 1; i > 0 && tokens.length - i <= 3; i--) {
    if (LOCATION_HINTS.has(tokens[i]) || tokens[i].length <= 3) {
      candidates.add(tokens.slice(0, i).join(" "));
    }
  }

  // If a location hint is embedded mid-string, also trim at that point.
  tokens.forEach((token, index) => {
    if (LOCATION_HINTS.has(token) && index > 0) {
      candidates.add(tokens.slice(0, index).join(" "));
    }
  });

  return Array.from(candidates).filter(Boolean);
}

function getNameSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const distance = levenshteinDistance(a, b);
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 0;
  return 1 - distance / maxLen;
}

function levenshteinDistance(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => new Array(cols).fill(0));

  for (let i = 0; i < rows; i++) {
    matrix[i][0] = i;
  }
  for (let j = 0; j < cols; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}
