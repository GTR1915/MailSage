# Distinguish AI Analyses from Inbox

## Goal

Redesign the **AI Analyses** tab as a dedicated insights dashboard rather than a filtered copy of the Inbox. Preserve the current polished visual language, demo email data, local analysis behavior, and responsive support, while making each navigation destination serve a clearly different purpose:

- **Inbox:** fetch, search, filter, select, star, preview, and initiate analysis.
- **AI Analyses:** review the current analysis as a focused AI-generated briefing.
- **Starred:** retain the existing filtered email-list experience.

## Confirmed Product Decisions

- Use a **dedicated insights dashboard** for AI Analyses.
- When an individual or bulk demo analysis completes, automatically navigate to **AI Analyses**.
- Do not add Google OAuth, Gmail API fetching, persistent history, or a real AI backend.
- Continue using the existing `analyzed` email state as the source for the current analysis; a new analysis replaces the prior result, matching current behavior.
- Keep all work scoped to `src/App.tsx` and `src/index.css` unless implementation reveals a concrete need otherwise.

## Current-State Findings

- `src/App.tsx` currently renders one shared page shell for Inbox, AI Analyses, and Starred.
- The date-range fetch card, stats, category/search toolbar, email rows, bulk-analysis control, and right-side copilot panel appear on all three pages.
- AI Analyses only changes the heading, title, count, empty copy, and filters the shared list to analyzed emails, which is why it reads like Inbox.
- Analysis is local and asynchronous: `analyze()` sets `analyzing`, waits one second, then stores the selected `Email[]` in `analyzed`.
- Existing `Email` data already provides sender, subject, preview/body, category, timestamp, and optional `action`, which is sufficient for a demo insights dashboard.

## Implementation Plan

### 1. Separate page composition in `src/App.tsx`

Refactor the main content into explicit conditional page branches instead of changing labels inside one shared layout.

- Render the existing fetch controls, inbox statistics, email table, and copilot surface only for **Inbox** and **Starred**.
- Preserve the current Inbox and Starred filtering, search, selection, starring, preview modal, and refresh behavior.
- Render a new AI-specific page body when `page === "AI analyses"`.
- Keep the shared sidebar, top bar, breadcrumb, account controls, notifications, modals, toast, and footer intact.
- Give AI Analyses page-specific heading copy and visual treatment rather than reusing the Inbox eyebrow and composition.

Where practical, extract small render helpers or local components for repeated email/summary UI, but avoid broad architecture changes or new files for this two-file app.

### 2. Route completed analyses to the dashboard

Update `analyze(emails)` so that:

1. Empty input still produces the existing validation toast.
2. The analyzing state begins and any open email modal closes.
3. After the existing one-second demo delay, the selected emails are stored in `analyzed`.
4. `analyzing` is cleared.
5. The active page becomes `"AI analyses"`.

Do not switch pages before completion; this preserves immediate visual feedback in the current Inbox panel while processing and lands users on the finished result once ready.

### 3. Build the populated AI Analyses dashboard

When `analyzed.length > 0`, create a clearly differentiated dark-violet workspace with these sections:

#### A. AI briefing hero

- Full-width dark gradient surface, visually related to the existing copilot panel but scaled into a page-level destination.
- Sparkle/orb identity, a compact “Demo analysis complete” status, strong result headline, and supporting copy based on the number of analyzed emails.
- Include an explicit demo/local-analysis note so the interface does not imply a live AI integration.
- Provide a primary action such as **Analyze more emails** that returns to Inbox without clearing the current result.

#### B. Snapshot metrics

Show concise, analysis-specific metrics rather than the Inbox’s fetched/unread counts:

- Emails analyzed: `analyzed.length`.
- Action items: count of analyzed emails with `action`.
- Conversations/senders: count of unique senders in `analyzed`.

Compute these values from existing state with derived constants or `useMemo`; do not store duplicate state.

#### C. Key insights / analyzed conversation cards

- Present each analyzed email as an insight card, not an inbox row.
- Include sender/avatar, category, subject, and a concise summary derived from the existing body/preview logic.
- Visually mark cards that include an action item.
- Let users open the existing full email preview from the card so the dashboard remains connected to source material.
- Avoid Inbox affordances such as checkboxes, star controls, category tabs, and the shared table header/footer.

#### D. Action-items panel

- Collect every defined `email.action` into a dedicated next-steps list.
- Associate each action with its sender or source subject.
- If the current analysis has no actions, show a calm “No immediate action items” state rather than leaving a blank panel.

Use a desktop composition that balances the main insights feed with a narrower action-items column, then collapse to one column on smaller screens.

### 4. Build a purpose-built AI empty state

When no emails have been analyzed:

- Do not show the date fetch card, Inbox metrics, empty email table, or standard right-side copilot.
- Show a generous dark AI introduction surface explaining what analysis will provide: summaries, patterns, and next steps.
- Include a clear **Choose emails to analyze** action that returns to Inbox.
- Reuse the existing sparkle/orb motif and privacy/demo language so the empty state feels intentional and trustworthy.

### 5. Keep Inbox and Starred focused

- Inbox retains the date-range fetch card, fetched/unread/analyzed stats, filters, search, selection, email rows, and per-email sparkle actions.
- Starred retains the same mail-list structure filtered to starred messages.
- Keep the compact right-side AI copilot on Inbox/Starred for discovery, processing feedback, and explaining the sparkle action.
- Since completed analysis moves to the dashboard, simplify any populated right-panel state if needed to avoid presenting the full result twice; it may show a compact completion state with a **View analysis** action rather than duplicate all summaries and actions.
- Keep the sidebar’s AI Analyses count/badge behavior coherent. Prefer replacing the static `NEW` badge with the analyzed count once results exist, while retaining a subtle `NEW` indicator before first use.

### 6. Add dedicated responsive styling in `src/index.css`

Add narrowly named AI-dashboard classes while preserving existing design tokens and typography.

- Use the current charcoal/violet palette, `Manrope` headings, rounded surfaces, subtle borders, and restrained gradients.
- Make the AI dashboard visibly darker and more immersive than the light Inbox canvas without changing the global sidebar or overall app shell.
- Add hover/focus states for insight cards and dashboard actions.
- Maintain readable contrast for violet-muted text on dark surfaces.
- Add breakpoint behavior alongside the existing `1200px`, `1000px`, `700px`, and `390px` rules:
  - Reduce multi-column dashboard layouts at tablet widths.
  - Stack insight/action panels on mobile.
  - Keep metrics usable without horizontal overflow.
  - Ensure long subjects, summaries, and action text wrap cleanly.
- Respect the existing `prefers-reduced-motion` rule and avoid introducing motion required for comprehension.

## Data Flow and State Rules

- `analyze(emails)` remains the only entry point for individual and bulk analysis.
- `analyzed: Email[]` remains the current analysis payload.
- Dashboard metrics and action lists are derived from `analyzed`.
- Starting a new analysis replaces the prior result, as it does today.
- Returning to Inbox does not clear `analyzed`; users can revisit the latest analysis from the sidebar.
- Search/category state remains scoped behaviorally to mail-list pages and must not hide content on AI Analyses.
- Full-email preview continues to use `activeEmail` and the existing modal.
- Existing demo notices, settings/help modals, starring, read tracking, date validation, and fetch simulation remain unchanged.

## Edge Cases

- **No analyzed emails:** show the dedicated AI empty state and route CTA to Inbox.
- **One analyzed email:** use singular copy and a single insight card without awkward empty grid space.
- **No action fields:** show the explicit no-actions state and a zero action metric.
- **Repeated sender:** unique-sender metric must deduplicate by sender/address.
- **Long summary/action text:** wrap without clipping or forcing horizontal scroll.
- **Analysis triggered from a filtered/Starred view:** analyze exactly the supplied emails, then navigate to the same dashboard result.
- **Analysis in progress:** prevent ambiguous stale completion UI; continue using the disabled/loading feedback already present and only navigate after the result is stored.
- **Direct navigation back to AI Analyses:** preserve and display the latest in-memory result for the session.

## Verification

Because this is a broader UI composition change, run the repository’s production check:

- `npm run build`

Then manually verify through the already-running preview (do not start another dev server):

1. Inbox still fetches, filters, searches, selects, stars, previews, and triggers individual/bulk analysis.
2. Starred still shows only starred messages and keeps normal email-list behavior.
3. AI Analyses with no result displays the dedicated empty dashboard and returns to Inbox via its CTA.
4. Individual analysis waits for completion, navigates to AI Analyses, and shows one insight with correct singular copy.
5. Bulk analysis navigates to AI Analyses and shows correct email, action, and unique-sender counts.
6. Action items are sourced only from emails with `action`; the no-action state appears when appropriate.
7. Insight cards open the existing email preview.
8. Returning to Inbox and revisiting AI Analyses preserves the latest result.
9. Layout remains visually distinct and usable at desktop, tablet, and mobile widths, with no overflow.
10. Keyboard focus remains visible on new controls and reduced-motion behavior remains respected.

## Out of Scope

- Google OAuth or Gmail API integration.
- Real AI requests or backend endpoints.
- Persistent analysis history across refreshes.
- New routing libraries or URL-based routes.
- Changes to demo email content beyond minimal copy needed for the dashboard.
- General redesign of the sidebar, Inbox, Starred page, modals, or global brand system.
