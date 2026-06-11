# Product Intro Landing Page Design

Date: 2026-06-11

## Purpose

Create a public-facing product introduction page for 别吃灰 Web. The page explains the product before users enter the app workspace.

The landing page should feel like a calm product website for a personal knowledge base, not a loud SaaS marketing page. It should borrow the clean white, light gray, thin-border feeling from the provided reference while staying consistent with the existing app visual language in `docs/product/design.md`.

## Route Structure

- `/` is the product introduction landing page.
- `/app` is the app workspace Home dashboard.
- The existing app pages move under the app workspace route:
  - `/app` for Home.
  - `/app/knowledge` for Knowledge Base.
  - `/app/knowledge/trash` for Trash.
  - `/app/calendar` for Calendar.
  - `/app/search` for Search.
  - `/app/recommendations` for AI Hot Recommendations.
  - `/app/settings` for Settings.
- Legacy app aliases may redirect to the new app routes if needed for compatibility.

The landing page has a primary CTA labeled `立即使用`. It navigates to `/app`.

## Positioning

The hero combines two approved directions:

- Memorable product promise: `别让收藏继续吃灰`
- Clear product explanation: `从一个链接开始，建立你的本地个人知识库`

The page should communicate that 别吃灰 turns saved links into an organized, searchable, reviewable local knowledge base.

## Page Structure

### 1. Hero

Content:

- Navigation bar with product name, section anchors, and `立即使用`.
- Main headline: `别让收藏继续吃灰`
- Supporting copy: `从一个链接开始，建立你的本地个人知识库。导入网页，自动生成摘要、标签和知识卡片，再用搜索、问答和日报把内容重新找回来。`
- Primary CTA: `立即使用`
- Secondary CTA: `看看如何工作`
- Product interface preview based on the app workspace, not a decorative illustration.

Visual direction:

- White or near-white background.
- Thin border around the interface preview.
- Soft shadow only if needed.
- No gradient hero background, decorative orbs, glassmorphism, or oversized marketing illustration.

### 2. Core Workflow

Use the approved workflow-first structure:

1. `导入网页链接`
   - User adds one URL and chooses a folder.
   - Emphasize focused single-link import.
2. `自动整理成知识卡片`
   - The app creates summary, tags, source metadata, folder placement, and readable card content.
3. `搜索、问答、重新找回`
   - User searches by fuzzy memory and asks questions based on selected cards.

Each step should use a compact visual panel or product UI mock, not abstract illustration.

### 3. Daily Knowledge Report

Daily report is an independent feature section, not a small item inside a feature grid.

Message:

- It helps users review what they imported on a specific day.
- It reorganizes daily inputs into a readable summary with themes, keywords, and worth-revisiting cards.
- It is generated from Calendar and does not need to be saved as a knowledge card in the first version.

Tone:

- Avoid promising polished publishing reports.
- Present it as a calm review tool for personal knowledge work.

### 4. AI Hot Recommendations

AI Hot Recommendations is an independent feature section.

Message:

- It helps users discover worthwhile articles.
- Recommended articles can be previewed and imported one at a time.
- It feeds useful new input into the same knowledge base workflow.

Tone:

- Avoid making it feel like an addictive feed.
- Present it as a curated discovery source that connects back to import and organization.

### 5. Supporting Capabilities

Use a restrained feature grid for supporting capabilities:

- Folders and tags.
- Knowledge activity heatmap.
- Recent import status.
- Trash and recovery.
- Local-first personal workspace positioning.

These should support the main story rather than compete with the three major product ideas: import workflow, daily report, and hot recommendations.

### 6. Final CTA

Close with a dark, calm CTA band or full-width section:

- Headline: `开始整理你的第一篇文章`
- Copy: `从一个链接开始，让收藏变成可以回看的知识库。`
- Primary CTA: `立即使用`

Keep the section restrained. It can use a dark neutral background, but should avoid gradients and decorative effects.

## Visual Requirements

- Follow `docs/product/design.md`.
- Use neutral whites, light grays, near-black text, and subtle borders.
- Cards should have `8px` to `12px` radius and very light or no shadow.
- Use lucide icons where icons are useful.
- The page should include product-like visual assets or UI mockups. Do not rely only on text.
- Avoid one-note purple/blue gradients, decorative blobs, bokeh, glassmorphism, or large abstract SVG art.
- Use responsive constraints so text and buttons do not overflow on mobile.
- Desktop layout may be spacious, but the next section should be hinted below the first viewport where practical.

## Components and Architecture

Recommended file structure for implementation:

- Create `src/pages/Landing.tsx` for the public product introduction page.
- Keep app workspace pages inside the existing `AppLayout`.
- Add or adjust route constants in `src/app/routes.ts`.
- Update `src/App.tsx` so the landing page is outside `AppLayout`, while `/app/*` routes use `AppLayout`.
- Reuse existing `Button` styles where practical, but the landing page may use page-local layout components for hero, workflow, daily report, recommendations, supporting capabilities, and CTA sections.

The landing page should not open the import modal directly. `立即使用` navigates to `/app`.

## Error Handling and Edge Cases

- Unknown routes should redirect to `/` or an appropriate app route without trapping users.
- Legacy app routes should be considered during implementation. If old app URLs remain exposed, redirect them to the new `/app/*` routes.
- Landing navigation section anchors should still work if JavaScript routing is active.
- Mobile navigation can be simple for the first version, but primary CTA must remain easy to access.

## Testing Plan

Implementation should include:

- Route tests verifying `/` renders the landing page.
- Route tests verifying `/app` renders the app Home dashboard inside `AppLayout`.
- CTA test verifying `立即使用` navigates from `/` to `/app`.
- Existing app page tests should be updated if route paths change.
- Build/typecheck verification with the existing project commands.
- Browser visual check on desktop and mobile widths after implementation.

## Out of Scope

- Login, pricing, testimonials, newsletter signup, analytics tracking, or account creation.
- Cloud sync claims.
- Batch import claims.
- Saving daily reports as knowledge cards.
- Turning AI Hot Recommendations into an infinite feed.
- Pixel-perfect reproduction of the provided reference screenshot.

## Acceptance Criteria

- Visiting `/` shows the public product introduction page.
- The hero clearly communicates `别让收藏继续吃灰` and `从一个链接开始，建立你的本地个人知识库`.
- `立即使用` navigates to `/app`.
- `/app` shows the existing application Home dashboard.
- Daily Knowledge Report has its own section.
- AI Hot Recommendations has its own section.
- The page visually matches the calm, neutral, knowledge-work style defined in the product design guide.
- The page avoids large gradients, decorative blobs, and generic marketing visuals.
