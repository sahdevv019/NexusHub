# NexusHub Project Static Image Assets

This directory hosts static media assets for NexusHub showcase projects. Images committed here are automatically distributed globally through Vercel's Edge CDN at **zero hosting cost** (₹0 budget).

---

## Directory Organization

Each project should have its own dedicated directory matching its project slug:

```
assets/
└── projects/
    ├── README.md
    ├── demo/
    │   └── cover.webp
    ├── cricscore/
    │   ├── cover.webp
    │   ├── dashboard.webp
    │   └── scoring.webp
    └── <project-slug>/
        ├── cover.webp
        └── screen-1.webp
```

---

## Recommended Specifications

1. **Cover Images:**
   - **Aspect Ratio:** 16:9 (e.g., 1280 × 720 px or 1920 × 1080 px)
   - **Format:** `.webp` (strongly recommended for modern compression and performance), `.png`, or `.jpg` / `.jpeg`.
   - **File Size:** Under 300 KB recommended.

2. **Gallery Screenshots:**
   - **Aspect Ratio:** 16:9 or native display aspect ratio (e.g. 1920 × 1080 px).
   - **Format:** `.webp` or `.png`.

---

## Referencing in NexusHub Admin Dashboard

When adding or editing a project in the NexusHub dashboard (`#/admin/projects/new`), enter the **root-relative path** starting with `/assets/`:

- **Cover Image Path:**
  ```
  /assets/projects/<project-slug>/cover.webp
  ```
- **Screenshot Path:**
  ```
  /assets/projects/<project-slug>/dashboard.webp
  ```

> [!NOTE]
> Existing legacy Firebase Storage URLs (`https://firebasestorage.googleapis.com/...`) and external HTTPS image URLs remain fully supported for older projects.
