# Forma design foundations

Apply https://atlassian.design/foundations/grid and https://atlassian.design/foundations/typography to the task dashboard.  UIArc provides controls, colors and spacing. Morphicons provides icons.

The main content uses the fixed wide grid with a 1296px maximum including margins. Viewports below 480px use two columns. From 480px to 1023px use six columns. From 1024px use twelve columns. Gutters are 12px below 1024px and 16px above. Margins are 16px below 1024px and 32px above. Main sections span the grid. Navigation and drawers sit outside it. Nested controls use spacing tokens.

Use the documented system font fallback without adding font downloads or dependencies. Text uses rem units. Desktop page headings use 28px/32px bold and mobile headings use 24px/28px bold. Drawer headings use 20px/24px bold. Subsections use 16px/20px bold. Task titles, metadata, links and controls use 14px/20px. Reserve 12px/16px for fine print. Paragraphs use 16px/24px with a maximum of 70 characters per line. Maintain semantic heading order and wrap task titles without truncating them.

Keep one simple task list with status, search and category filters. Priority labels stay in the row flow. Mobile links remain touch sized. Task counts come from stored data. Both themes use Arc semantic color tokens.

Iconography follows https://atlassian.design/foundations/iconography. Keep Morphicons with familiar Lucide shapes. Default action icons are 16px. Chevrons and supporting link arrows use 12px. Use a constant 1.5px physical stroke with butt caps, current text colors and accessible text or button labels. The empty state icon is decorative inside its existing tile. Honor reduced motion.

Borders follow https://atlassian.design/foundations/border. Standard borders and dividers use the 1px width token. Selected category controls and segmented selections use 2px with the semantic selected color. Keyboard focus uses 2px with the semantic focused color, including fields and the search shell. Stronger input boundaries are separate from subtle container dividers. Selected indicators are inset so selection does not shift the layout.

Layout follows https://atlassian.design/foundations/spacing/primitives. Apply Box, Inline and Stack behavior through the existing semantic containers and CSS without replacing UIArc controls. Panel padding uses shared tokens: 24px on desktop and 16px on mobile. Horizontal groups use gaps and wrap where appropriate. Vertical title, metadata, link and drawer groups use token based gaps instead of child margins. Keep the existing main grid and responsive toolbar.

Task category and reference labels follow https://atlassian.design/components/tag/examples and its usage guidance. Reuse the existing UIArc Badge for neutral categories and keep real anchor elements for source references. Tags have a compact corner radius, subdued colors and a 200px maximum width. Show source names instead of generic provider names. Full names remain in titles, accessible link labels and task details. Priority retains its separate semantic badge treatment. References wrap as a group and preserve mobile touch targets.

The application menu contains the brand, live task counts, Add task, sync details and theme control. Remove the duplicate title and tagline block. Keep the list directly below the menu. On smaller screens counts wrap into a compact second menu row.

Use dense single line task rows with title truncation, compact metadata and labeled source shortcuts. Task details provide complete titles, metadata and links. On narrow screens retain the title, completion control, chat shortcut and details action.
