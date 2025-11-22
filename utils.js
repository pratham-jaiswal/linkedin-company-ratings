// Scrapes Glassdoor's search results page for a given company name.
// Returns: { rating: "3.8", reviews: "3.8K", link: "https://..." }
async function getGlassdoorRating(company) {
  try {
    // Build Glassdoor search URL for the provided company name
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
      return { rating: "-", reviews: "-", link: "-" };
    }

    // Get all company cards
    const cards = companiesModule.querySelectorAll(
      '[data-test="company-card"]'
    );
    if (!cards.length) {
      return { rating: "-", reviews: "-", link: "-" };
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
    if (bestMatch === null) return { rating: "-", reviews: "-", link: "-" };
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

    return { rating, reviews, link };
  } catch (err) {
    console.error("Glassdoor scraping failed:", err);
    return { rating: "-", reviews: "-", link: "-" };
  }
}
