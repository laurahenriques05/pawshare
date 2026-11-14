# PawShare UI research and application

Reviewed 14 November 2026. This is a focused design audit for a mobile-first
household care app, not a ranking of every product or UI library.

## Useful reference systems

- **Apple Human Interface Guidelines:** adapt layouts to available space and
  text size, use familiar navigation, and place frequent mobile controls where
  they are comfortable to reach. The PawShare sidebar can remain on wide screens
  while the bottom navigation serves phones.
- **Material Design 3:** keep app bars focused on the current page and its most
  important actions; use color roles consistently so surfaces, text and feedback
  have predictable meaning.
- **GOV.UK Design System:** keep the user's answers after validation errors,
  explain what failed and how to fix it, and make errors discoverable to screen
  readers. This pattern is useful for PawShare forms even though PawShare is not
  a government service.
- **WCAG 2.2:** normal text needs at least 4.5:1 contrast; visible focus and
  sufficiently sized pointer targets matter. A 44 CSS-pixel touch target is a
  useful mobile design target; WCAG 2.2 AA's minimum target-size criterion is
  24 CSS pixels, subject to its exceptions.

## What the current code already does well

- Mobile-first responsive layouts, a bottom navigation on narrow screens and a
  sidebar on wider screens.
- 48px default button and field heights, visible keyboard focus, skip link,
  explicit loading/error/empty states and reduced-motion handling.
- A calm, recognizable PawShare palette and shared button, field, notice and
  page-title primitives.

## Changes applied from this audit

- Darken muted navigation, eyebrow and supporting text colors where the former
  palette fell below the normal-text contrast target on the ivory/white surfaces.
- Give Home summaries a reserved loading shape with an accessible status label,
  reducing layout jump while preserving a quiet reduced-motion mode.
- Keep task/Academy actions and cards within the existing visual language rather
  than adding a second component system.

## Component-library decision

[Magic UI](https://magicui.design/docs/components) provides copyable React,
TypeScript and Tailwind components, including animated lists and shimmer
buttons. Its own examples present the animated list as a way to showcase
notifications/events and the shimmer button as a visual effect. PawShare should
only use such motion for genuine state changes: a looping or staged list could
make care records look live when they are not, and a shimmering primary button
would distract from routine actions. The repository has no Motion dependency,
so importing these components would also add a new dependency for effects that
do not improve task completion. Prefer the current local primitives; evaluate a
Magic UI component when a real feature can benefit from it.

## References

- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple HIG: Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles/)
- [Material 3: App bars](https://m3.material.io/components/app-bars/)
- [Material 3: Color system](https://m3.material.io/styles/color/the-color-system/)
- [GOV.UK: Recover from validation errors](https://design-system.service.gov.uk/patterns/validation/)
- [W3C: WCAG 2.2 contrast minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
- [W3C: WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
- [W3C: WCAG 2.2 focus appearance](https://www.w3.org/WAI/WCAG22/Understanding/focus-appearance.html)
- [Magic UI components](https://magicui.design/docs/components)
- [Magic UI Animated List](https://magicui.design/docs/components/animated-list)
- [Magic UI Shimmer Button](https://magicui.design/docs/components/shimmer-button)
