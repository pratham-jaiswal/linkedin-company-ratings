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

    // Normalize company name for string comparison
    const lookup = company.trim().toLowerCase();

    let bestMatch = null;

    cards.forEach((card) => {
      const nameEl = card.querySelector(".employer-card_employerName__kSwU7");
      if (!nameEl) return;

      const name = nameEl.textContent.trim().toLowerCase();

      // Exact match
      if (name === lookup) {
        bestMatch = card;
      }
    });

    // If Company details not found
    if (bestMatch === null) return { rating: "-", reviews: "-", link: "" };
    const card = bestMatch;

    // Extract rating
    const ratingEl = card.querySelector(
      ".employer-card_employerRatingContainer__w93y9"
    );
    const rating = ratingEl ? ratingEl.childNodes[0].textContent.trim() : "-";

    // Extract reviews count
    const counts = card.querySelectorAll(".CompanyCard_companyCount__uHBhK");
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
