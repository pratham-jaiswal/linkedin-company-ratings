# LinkedIn Company Ratings (Firefox Extension)

A lightweight Firefox extension that automatically displays Glassdoor ratings on LinkedIn job, company, and school pages.
It integrates directly into LinkedIn's UI and updates live as you navigate, no page reload needed.

<a href="https://addons.mozilla.org/en-US/firefox/addon/linkedin-company-ratings/">
   <img src="https://blog.mozilla.org/addons/files/2020/04/get-the-addon-fx-apr-2020.svg" width="129" />
</a>

---

## ✨ Features

- **Company rating pulled from Glassdoor's public search results**
- **Works on job, company, and school profile pages**
- **Fuzzy Glassdoor matching** that ignores suffixes like "LLC", locations (e.g. "Accenture in India"), and other LinkedIn-only wording
- **Supports logged-in AND logged-out LinkedIn layouts**
- **Smart DOM detection** for multiple LinkedIn UI versions
- **Zero-refresh navigation tracking** via history hooks + DOM observers
- **Color-coded rating indicator**:
  - Red: < 3.0
  - Orange: < 3.7
  - Green: ≥ 3.7
- **Live updates** on SPA navigation
- **24-hour local caching** for faster repeated lookups and reduced network usage

---

## ✓ Supported LinkedIn Pages

### **Job Pages**

- `/jobs/view/<job-id>/` - public job detail pages (no login required)
- `/jobs/collections/*` - collections / recommendations (login required)
- `/jobs/search/*` - job search results (login required)

### **Company Pages**

- `/company/<company-id>/` - company page (no login required)

### **School Pages**

- `/school/<school-id>/` - school<sup>1</sup> pages (no login required)
  > <sup>1</sup> "school" includes universities, colleges, bootcamps, training institutes, and some EdTech companies

The extension automatically chooses the correct selector for each layout and only injects UI on the supported URLs above (even though the script is loaded site-wide for seamless navigation detection).

---

## Screenshot

<img src="https://file.garden/aATRZRm2KRQR_hmq/LinkedIn%20Rating%20AddOn/ss.png" width="1080">

<img src="https://file.garden/aATRZRm2KRQR_hmq/LinkedIn%20Rating%20AddOn/ss2.png" width="1080">

<img src="https://file.garden/aATRZRm2KRQR_hmq/LinkedIn%20Rating%20AddOn/ss3.png" width="1080">

<img src="https://file.garden/aATRZRm2KRQR_hmq/LinkedIn%20Rating%20AddOn/ss4.png" width="1080">

## 🔧 How It Works

When you open a LinkedIn job page:

1. Hooks into LinkedIn’s history API + DOM mutations to detect navigation instantly (no polling or manual refresh).
2. Extracts the organisation name from header using multiple fallback selectors.
3. Normalizes and fuzzy-matches the name against Glassdoor's search cards (handling suffixes, region tags, etc.).
4. Fetches the organisation rating from Glassdoor's public search results HTML.
4. Inserts rating, review count, and glasdoor link of that organisation underneath the LinkedIn header block.
5. Caches results locally for 24 hours to reduce network traffic and speed up repeated visits.
6. Updates automatically when switching between supported pages.

All updates happen dynamically using DOM observers, so the data stays accurate even as LinkedIn changes content via client-side navigation.

---

## 🛠 Installation (Developer Mode)

1. Clone the repository:

   ```bash
   git clone https://github.com/pratham-jaiswal/linkedin-company-ratings.git
   ```

2. Open Firefox and go to:
   ```
   about:debugging#/runtime/this-firefox
   ```
3. Click **Load Temporary Add-on**
4. Select `manifest.json` from the folder.

The extension will now run on all LinkedIn job pages.

> Note: Temporary add-ons disappear after restarting Firefox.

---

## 🧩 Contributing

Pull requests are welcome!
If you'd like to extend functionality or improve performance, feel free to fork and submit a PR.

---

## 📝 License

[MIT License](../main/LICENSE)

---

## ⭐ Acknowledgements

This extension fetches publicly accessible data from **Glassdoor search results pages**.
It is not affiliated with or endorsed by LinkedIn or Glassdoor.
