(function () {
  // Store last known URL for detecting SPA navigation changes on LinkedIn
  let lastUrl = location.href;

  // LinkedIn uses client-side navigation (SPA)
  // This way we detect job changes without a full page reload.
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      initGlassdoorBox(); // Start a fresh rating lookup
    }
  }, 500);

  // Run once on initial pageload
  initGlassdoorBox();

  // Runs every time a job changes
  async function initGlassdoorBox() {
    // Remove previously injected rating boxes to avoid duplicates
    document.querySelectorAll(".rating-box").forEach((el) => el.remove());

    // Wait until the LinkedIn job header loads and the company name is available
    const company = await waitForCompanyName();
    const headerBlock = await waitForCompanyHeader();

    if (!company || !headerBlock) return;

    // Create an empty container which will show ratings
    const container = document.createElement("div");
    container.className = "rating-box";

    // Initial loading UI with animated dots
    container.innerHTML = `
      <span class="glassdoor-loading">
        <span class="label">Glassdoor Rating: </span> 
        <span class="dots">.</span>
      </span>
    `;

    headerBlock.insertAdjacentElement("afterend", container);

    // Animate the dots in .glassdoor-loading .dots
    let dotCount = 1;

    // Insert rating box below the company header block
    const dotsEl = container.querySelector(".dots");

    // Animated dots - simple loading indicator while fetching
    const dotsInterval = setInterval(() => {
      dotCount = (dotCount % 3) + 1; // 1 → 2 → 3 → 1
      dotsEl.textContent = ".".repeat(dotCount);
    }, 350);

    // Fetch Glassdoor data (via utils.js)
    const glassdoor = await getGlassdoorRating(company);

    // Stop the dots animation once data is available
    clearInterval(dotsInterval);

    const rating = glassdoor?.rating || "-";
    const reviews = glassdoor?.reviews || "-";
    const color = getRatingColor(rating);

    // Render final result - clickable, styled rating
    container.innerHTML = `
      <a href="${glassdoor.link}" target="_blank" class="glassdoor-data">
        <span class="label">Glassdoor Rating: </span> 
        <span class="rating" style="color:${color}; font-weight:600;">
          ${rating !== "-" ? rating + "⭐" : "-"}
        </span> 
        (${reviews} reviews)
      </a>
    `;
  }

  // Wait for LinkedIn to inject company name
  function waitForCompanyName() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        let el = null;
        // 1. Try selector for old/desktop job view
        if (location.href.includes("/jobs/view/")) {
          el = document.querySelector("a.topcard__org-name-link");
        }
        // 2. If not found, use new unified job page selector
        if (!el) {
          el = document.querySelector(
            "div.job-details-jobs-unified-top-card__company-name"
          );
        }


        // 3. Once we find and it's non-empty: resolve
        if (el && el.innerText.trim().length > 0) {
          clearInterval(interval);
          resolve(el.innerText.trim());
        }
      }, 300);
    });
  }

  // Identify the correct header block by detecting the "top-buttons" container, which is unique
  function getCompanyHeaderBlock() {
    if (location.href.includes("/jobs/view/")) {
      const blocks = document.querySelectorAll("div.topcard__flavor-row");
      for (const block of blocks) {
        if (block.querySelector(".topcard__org-name-link")) {
          return block;
        }
      }
    }

    const blocks = document.querySelectorAll(
      "div.display-flex.align-items-center"
    );
    for (const block of blocks) {
      if (
        block.querySelector(".job-details-jobs-unified-top-card__top-buttons")
      ) {
        return block;
      }
    }

    return null;
  }

  // Wait until the correct header block exists in DOM
  function waitForCompanyHeader() {
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        const header = getCompanyHeaderBlock();
        if (header) {
          clearInterval(interval);
          resolve(header);
        }
      }, 300);
    });
  }

  // Determine rating color based on thresholds
  function getRatingColor(rating) {
    const r = parseFloat(rating);
    if (isNaN(r)) return "gray"; // Not Found
    if (r < 3.0) return "red"; // Poor
    if (r < 3.7) return "orange"; // Average
    return "green"; // Good+
  }
})();
