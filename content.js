(function () {
  // Store last known URL for detecting SPA navigation changes on LinkedIn
  let lastUrl = location.href;

  // LinkedIn uses client-side navigation (SPA)
  // This way we detect job/company navigation without full page reloads.
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      initGlassdoorBox(); // Start a fresh rating lookup
    }
  }, 500);

  // Run once on initial pageload
  initGlassdoorBox();

  // Runs for every LinkedIn job/company page change
  async function initGlassdoorBox() {
    // Remove previously injected rating boxes to avoid duplicates
    // document.querySelectorAll(".rating-box").forEach((el) => el.remove());
    document.querySelectorAll(".rating-box").forEach((el) => {
      if (
        el.previousElementSibling &&
        el.previousElementSibling.matches("h1, h2, div")
      ) {
        el.remove();
      }
    });

    // Wait until the company name and its surrounding header block are available
    const company = await waitForCompanyName();
    const headerBlock = await waitForCompanyHeader();

    if (!company || !headerBlock) return;

    if (
      headerBlock.nextElementSibling &&
      headerBlock.nextElementSibling.classList.contains("rating-box")
    ) {
      return; // Already injected for this block
    }

    // Create a container for rating output
    const container = document.createElement("div");
    container.className = "rating-box";

    // Initial loading UI with animated dots
    container.innerHTML = `
      <span class="glassdoor-loading">
        <span class="label">Glassdoor Rating: </span> 
        <span class="dots">.</span>
      </span>
    `;

    // Insert rating box under the LinkedIn company/job header
    headerBlock.insertAdjacentElement("afterend", container);

    // Animate the dots in .glassdoor-loading .dots
    let dotCount = 1;
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

    // Render final clickable result
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

        if (
          location.href.includes("/company/") ||
          location.href.includes("/school/")
        ) {
          // Company/School Page - logged out layout
          el = document.querySelector("h1.top-card-layout__title");

          // Company/School Page - logged in layout
          if (!el) {
            el = document.querySelector("h1.org-top-card-summary__title");
          }
        } else if (location.href.includes("/jobs/")) {
          // Job Page - logged out job view
          if (location.href.includes("/jobs/view/")) {
            el = document.querySelector("a.topcard__org-name-link");
          }

          // Job Page - logged in unified layout
          if (location.href.includes("/jobs/") && !el) {
            el = document.querySelector(
              "div.job-details-jobs-unified-top-card__company-name"
            );
          }
        }

        // Once we find and it's non-empty: resolve
        if (el && el.innerText.trim().length > 0) {
          clearInterval(interval);
          resolve(el.innerText.trim());
        }
      }, 300);
    });
  }

  // Locate the container block under which we should insert the rating UI.
  // Handles multiple LinkedIn layouts (logged-in/out, job/company pages).
  function getCompanyHeaderBlock() {
    if (
      location.href.includes("/company/") ||
      location.href.includes("/school/")
    ) {
      // Company/School Page - logged out
      let blocks = document.querySelectorAll(
        "div.top-card-layout__entity-info"
      );
      for (const block of blocks) {
        if (block.querySelector("h2.top-card-layout__headline")) {
          return block.querySelector("h2.top-card-layout__headline");
        }
      }

      // Company/School Page - logged in
      blocks = document.querySelectorAll("div.block.mt4");
      for (const block of blocks) {
        if (block.querySelector("h1.org-top-card-summary__title")) {
          return block;
        }
      }
    } else if (location.href.includes("/jobs/")) {
      // Job Page - logged out
      if (location.href.includes("/jobs/view/")) {
        const blocks = document.querySelectorAll("div.topcard__flavor-row");
        for (const block of blocks) {
          if (block.querySelector(".topcard__org-name-link")) {
            return block;
          }
        }
      }

      // Job Page - unified (logged in)
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
    }

    return null;
  }

  // Wait until LinkedIn renders the header block we inject ratings into
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
