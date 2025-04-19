# AI Playcaller App Instructions

This document provides an overview of the AI Playcaller web application, detailing its purpose, high‑level architecture, user flows, and page‑by‑page functionality. Use this as context when writing or refining code in Cursor.

## 1. Project Purpose

AI Playcaller is a coaching tool for American football staff to plan and simulate offensive strategies. It guides coaches through:

- Terminology Setup: Customize play terminology (short codes and labels).
- Scouting: Collect opponent defensive tendencies (fronts, coverages, blitz rates).
- Game Plan Generation: Automatically produce an AI‑driven play plan based on scouting data.

The first three pages form a guided workflow: Setup → Scouting → Game Plan.

## 2. Technology Stack

- Next.js 14 (App Router): React framework for pages, layouts, server actions.
- Tailwind CSS: Utility‑first styling.
- v0.dev: Rapid JSX + Tailwind component generation.
- Cursor AI: IDE assistant for refining and wiring code.
- OpenAI API: Single server action to generate the play plan.
- Vercel Hobby: Deployment platform.
- localStorage: Temporary client‑side persistence (no external DB for v0).

## 3. High‑Level Architecture

```
[Browser]  <— localStorage —>  [Client]  — generatePlan() (server action) —> [OpenAI]
    |                                          |
    |                                          v
    |                                   JSON response
    |                                          |
    v                                          |
UI Pages:                                 Cache in localStorage
- /setup                                  - key "terms"
- /scouting                               - key "scouting"
- /plan                                   - key "plan"
```

All pages (except the server action) live in the Next.js app/ directory.

Data is saved and loaded from localStorage via a helper in lib/local.ts.

A single server action makeGamePlan(data) calls OpenAI, returns structured JSON.

## 4. Page‑by‑Page Functionality

### 4.1 /setup (Terminology)

**Purpose**: Let coaches rename default play terminology keys.

**UI**: Card containing a table of rows:
- Key (readonly)
- Label (editable text input)
- Save icon per row
- + Add Row to append new empty key/label row
- Continue → navigates to /scouting

**State**: Load and save terms: Term[] in localStorage.

### 4.2 /scouting (Scouting Form)

**Purpose**: Capture opponent tendencies.

**UI**: Three cards: Fronts, Coverages, Blitz.
- Each displays a list of default option labels (e.g. Even, Odd, Bear)
- Each option row has a % number input (0–100)
- + Custom to add a new option label with its own input
- Generate Game Plan button below

**State**: Load and save scouting: { fronts, coverages, blitz } in localStorage.

**Action**: On click, persists scouting data and navigates to /plan.

### 4.3 /plan (AI Game Plan)

**Purpose**: Display an automated plan.

**Server Action**: makeGamePlan({ terms, scouting }):
- Prompts OpenAI: "You are an offensive coordinator…"
- Returns JSON with arrays runConcepts, passConcepts, tendencies

**UI**:
- Title & button Download PDF (jsPDF export later)
- Three columns: Run Concepts, Pass Concepts, Key Tendencies
- Each column is a card with a table: Concept | Usage % | Note

**State**: Save the plan JSON to localStorage.

**Client Flow**:
- On mount, if plan exists in localStorage, read and render
- Else, call makeGamePlan with scouting data, save, then render

## 5. Coding Guidelines

**Component Generation**: Use v0 prompts to generate raw JSX + Tailwind.

**Refinement**: Use Cursor to:
- Rename default exports to named components
- Convert class to className
- Hook up React state (useState, useEffect)
- Wire Next.js navigation (useRouter().push)

**Data Helpers**: lib/local.ts with load(key, fallback) and save(key, value).

**Server Actions**: Place in app/actions.ts using "use server" exports.

## 6. Next Steps for Cursor

1. Create app/setup/page.tsx with v0 UI and wire state
2. Create app/scouting/page.tsx with v0 UI and wire localStorage
3. Create app/plan/page.tsx with v0 UI and wire server action
4. Ensure all pages navigate correctly

Use this document (instructions.md) within Cursor when asking:
"Given these requirements, implement the component skeleton and state logic." 