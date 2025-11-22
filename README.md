# LinkedIn Company Ratings (Firefox Extension)

A lightweight Firefox extension that automatically displays company ratings from Glassdoor on LinkedIn job pages.  
It integrates directly into the LinkedIn UI and updates live as you navigate between jobs - even without full page reloads.

---

## ✨ Features

- **Company rating** displayed directly under the job header on LinkedIn.
- **Live updates on job navigation** (LinkedIn SPA support).
- **Color-coded rating badge**:
  - Red: < 3.0  
  - Orange: < 3.7  
  - Green: ≥ 3.7
- **No page reload required** - reacts instantly to URL changes.

---

## Screenshot

<img src="https://file.garden/aATRZRm2KRQR_hmq/LinkedIn%20Rating%20AddOn/screenshot.png" width="1080">

## 🔧 How It Works

When you open a LinkedIn job page:

1. The extension extracts the company name from the job header.
2. It requests the search result page from Glassdoor.
3. It finds the best matching company card.
4. It extracts:
   - Rating  
   - Number of reviews  
   - Company page link  
5. Inserts the information neatly under the company header block.

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
