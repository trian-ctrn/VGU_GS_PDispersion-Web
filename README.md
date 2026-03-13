# Exam Seating Allocation Web App

This project is a web app that helps allocate students to seats across multiple exams.

It is built for conflict-aware seating:
- Upload one CSV per exam (`id,name` format).
- Configure room size and available seats.
- Run automatic seat allocation.
- Review conflicts and rerun from a selected exam.
- Export results.

## Tech Stack

- React + TypeScript
- Vite
- WebAssembly for p-dispersion seat selection

## Install

Requirements:
- Node.js 20+
- npm

Steps:

```bash
npm install
npm run dev
```

Open the local URL shown in the terminal (usually `http://localhost:5173`).

## Build for Production

```bash
npm run build
```

The production output is generated in the `dist/` folder.

To test the production build locally:

```bash
npm run preview
```

## Deploy

This is a static frontend app, so you can deploy the `dist/` folder to any static hosting service.

Basic flow:

```bash
npm install
npm run build
```

Then upload the generated `dist/` folder to your host (for example: Netlify, Vercel, GitHub Pages, Firebase Hosting, Cloudflare Pages, or an Nginx static site).

If your hosting provider supports build settings, use:
- Build command: `npm run build`
- Publish directory: `dist`
