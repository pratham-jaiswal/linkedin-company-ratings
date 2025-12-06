(function () {
  // Track the last URL to detect SPA navigation changes without polling.
  let lastUrl = location.href;

  const SUPPORTED_PATTERNS = [
    /\/jobs\/view\//i,
    /\/jobs\/search/i,
    /\/jobs\/collections\//i,
    /\/company\//i,
    /\/school\//i,
  ];

  setupNavigationListeners();
  injectHistoryHook();
  observeDomMutations();
  initGlassdoorBox();

  // Called by navigation listeners whenever LinkedIn mutates the history stack.
  function handleNavigation() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    initGlassdoorBox();
  }

  // LinkedIn behaves like a SPA, so we watch history APIs instead of polling.
  function setupNavigationListeners() {
    const NAV_FLAG = "__glassdoorRatingsHistoryWrapped";

    if (!window[NAV_FLAG]) {
      window[NAV_FLAG] = true;

      // Re-emit a tiny synthetic event whenever push/replaceState fire.
      const dispatchLocationChange = () =>
        window.dispatchEvent(new Event("locationchange"));

      const wrapHistoryMethod = (method) => {
        const original = history[method];
        if (typeof original !== "function") return;
        history[method] = function (...args) {
          const result = original.apply(this, args);
          dispatchLocationChange();
          return result;
        };
      };

      wrapHistoryMethod("pushState");
      wrapHistoryMethod("replaceState");
      window.addEventListener("popstate", dispatchLocationChange);
    }

    window.addEventListener("locationchange", handleNavigation);
    window.addEventListener("glassdoor-locationchange", handleNavigation);
  }

  // Injects a tiny inline script so we can hook history APIs in the page context.
  function injectHistoryHook() {
    const id = "glassdoor-history-hook";
    if (document.getElementById(id)) return;

    const script = document.createElement("script");
    script.id = id;
    script.textContent = `
      (() => {
        const FLAG = "__glassdoorRatingsHistoryHooked";
        if (window[FLAG]) return;
        window[FLAG] = true;

        const dispatch = () =>
          window.dispatchEvent(new CustomEvent("glassdoor-locationchange"));

        const wrap = (method) => {
          const original = history[method];
          if (typeof original !== "function") return;
          history[method] = function (...args) {
            const result = original.apply(this, args);
            dispatch();
            return result;
          };
        };

        wrap("pushState");
        wrap("replaceState");
        window.addEventListener("popstate", dispatch);
      })();
    `;

    document.documentElement.appendChild(script);
    script.remove();
  }

  // LinkedIn sometimes mutates content without touching history APIs.
  // Watching DOM changes lets us fall back to URL comparisons safely.
  function observeDomMutations() {
    if (window.__glassdoorRatingsObserver) return;
    const target = document.body || document.documentElement;
    if (!target) {
      window.addEventListener("DOMContentLoaded", observeDomMutations, {
        once: true,
      });
      return;
    }

    const observer = new MutationObserver(() => handleNavigation());
    observer.observe(target, { childList: true, subtree: true });
    window.__glassdoorRatingsObserver = observer;
  }

  // Runs for every LinkedIn job/organization page change
  async function initGlassdoorBox() {
    if (!isSupportedUrl(location.href)) {
      clearRatingBoxes();
      return;
    }

    // Main entry point: clear previous inserts and rebuild once data is ready.
    clearRatingBoxes();

    // Wait until the organization name and its surrounding header block are available
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

    // Insert rating box under the LinkedIn organization/job header
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
    const link = glassdoor?.link || "";
    const color = getRatingColor(rating);

    // Render final clickable result
    container.innerHTML = `
      <a href="${link}" target="_blank" class="glassdoor-data">
        <span class="label">Glassdoor Rating: </span> 
        <span class="rating" style="color:${color}; font-weight:600;">
          ${rating !== "-" ? rating + "⭐" : "-"}
        </span> 
        (${reviews} reviews)
      </a>
    `;
  }

  function isSupportedUrl(url) {
    return SUPPORTED_PATTERNS.some((pattern) => pattern.test(url));
  }

  function clearRatingBoxes() {
    document.querySelectorAll(".rating-box").forEach((el) => {
      if (
        el.previousElementSibling &&
        el.previousElementSibling.matches("h1, h2, div")
      ) {
        el.remove();
      } else if (!isSupportedUrl(location.href)) {
        el.remove();
      }
    });
  }

  // Wait for LinkedIn to inject organization name
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
  // Handles multiple LinkedIn layouts (logged-in/out, job/organization pages).
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
