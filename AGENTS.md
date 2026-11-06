# Project architecture rules

- Keep customer-facing report calculations in pure analysis modules, separate from database loading and rendering, so financial totals are independently testable.
- Use the shared PDF logo loader and contained placement for all PDF headers; flatten transparency onto paper to prevent alpha artifacts and preserve each factory's identity.