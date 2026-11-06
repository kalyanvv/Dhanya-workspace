---
name: dataviz
description: Build and review Dhanya dashboard charts with exact order totals, India-time dates, accessible alternatives and existing design tokens. Use for S8.3 and related order analytics visualizations.
---

# Dhanya data visualization

Use this project guide with the existing Apple design references. Read
`../apple-design/references/hig/charting-data.md` and `charts.md` when available
through the installed Apple skill; in the workspace their source is
`.claude/skills/apple-design/references/hig/`. This is a local project guide,
not a recovered third-party skill.

- Read FR-45..47 and the current dashboard service contract. The chart and summary
  cover the complete filtered order set, independently of list pagination. Do not
  plot private book allocations or equate order amount with collected payments.
- Show amount by India calendar day with a clearly labeled date range and currency.
  Keep exact integer paise until formatting; use numbers only to position marks.
  Missing days inside the requested range represent zero, not missing labels or
  interpolated sales. Include cancelled/rejected orders when the chosen status
  filter includes them; explain that the figure is order amount.
- Choose a chart that answers the question. Daily sums suit bars; preserve a zero
  baseline, honest spacing and chronological order. Describe any aggregation.
  A plain single-series SVG is sufficient unless interaction needs a library.
- Read colors and typography from existing tokens. Avoid gradients, decorative
  motion and color-only meaning. Handle no orders, all-zero amounts, one day,
  long ranges and narrow screens without invalid axes or clipping.
- Supply a useful title and a text summary, plus a reachable semantic data table
  with exact dates and amounts. Important values must not depend on hovering.
  If a chart is interactive, make the same operation keyboard accessible.
- Reuse the dashboard journey for filter/chart/table agreement and one normal
  light-mode axe scan. Check phone/desktop and large text; document the builder's
  design review and any limitation. Do not add tests for every visual state.

Source principles: Apple HIG `charting-data.md` (purpose, chart size and continuity)
and `charts.md` (marks, axes, accessibility and avoiding color-only meaning).
Product-specific choices such as zero-filled IST days and full-order filtering
come from Dhanya's requirements and service contract.
