# Project architecture rules

- Keep customer-facing report calculations in pure analysis modules, separate from database loading and rendering, so financial totals are independently testable.
- Use the shared PDF logo loader and contained placement for all PDF headers; flatten transparency onto paper and serve D'Praia from a bundled pre-sized copy so phones never generate PDFs without the logo, while other factories keep their own logo URL.