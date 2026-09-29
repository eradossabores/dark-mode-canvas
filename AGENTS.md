# Project architecture rules

- Keep customer-facing report calculations in pure analysis modules, separate from database loading and rendering, so financial totals are independently testable.