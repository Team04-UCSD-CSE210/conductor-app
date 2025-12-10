# ADR-0005: Frontend Technology Selection (Vanilla JavaScript)

## Status

Accepted

## Context

The Conductor App needed a frontend technology approach for building the user interface. The application requires:

- **Multiple role-based dashboards** (student, instructor, TA, tutor, professor, admin)
- **Form-heavy interfaces** for roster management, team creation, and attendance
- **Real-time updates** for attendance sessions and announcements
- **Fast page loads** to support 100+ concurrent users
- **Maintainability** by a team with varying JavaScript experience levels
- **Accessibility** compliance for educational use

We needed to decide whether to use a modern JavaScript framework or stick with vanilla JavaScript and HTML/CSS.

## Decision

We chose **Vanilla JavaScript (ES6+)** with **HTML5** and **CSS3** for the frontend, avoiding frameworks like React, Vue, or Angular.

### Technology Stack

**Frontend Technologies:**
- HTML5 with semantic markup
- CSS3 with custom properties (CSS variables)
- Vanilla JavaScript (ES6+ with ES Modules)
- No build step or transpilation
- No npm frontend dependencies

**JavaScript Features Used:**
- ES Modules (`import`/`export`)
- Async/await for API calls
- Arrow functions and destructuring
- Template literals for HTML generation
- Fetch API for HTTP requests
- Modern DOM APIs

## Consequences

### Positive

- **Zero build step** - Direct browser execution, faster development cycle
- **Faster page loads** - No framework overhead (~50KB+ saved)
- **Simple debugging** - No source maps, stack traces point to actual code
- **Lower barrier to entry** - Team members can contribute without learning a framework
- **Direct DOM control** - Full control over rendering and updates
- **No dependency hell** - No framework version conflicts or breaking changes
- **Progressive enhancement** - Basic functionality works without JavaScript
- **Better understanding** - Forces developers to learn web fundamentals

### Negative

- **More boilerplate** - Manual DOM manipulation and event handling
- **Code duplication** - Similar patterns repeated across dashboards
- **No component reusability** - Cannot easily share UI components
- **Manual state management** - No built-in reactivity or state management
- **Testing complexity** - Harder to unit test without component isolation
- **Scaling concerns** - May become unwieldy as application grows
- **No type safety** - Missing TypeScript benefits without additional tooling

### Neutral

- **Different patterns** - Uses module pattern instead of component pattern
- **File organization** - One JavaScript file per page instead of components
- **Manual routing** - URL navigation handled by server/HTML instead of client-side router
- **Styling approach** - Global CSS instead of scoped/component styles

## Alternatives Considered

### 1. React

**Pros:**
- Component reusability
- Large ecosystem
- Virtual DOM performance
- Rich developer tools

**Cons:**
- Build step required (Webpack/Vite)
- Learning curve for team
- 40KB+ framework overhead
- JSX adds complexity
- **Rejected because:** Team velocity would decrease due to learning curve

### 2. Vue.js

**Pros:**
- Progressive framework
- Simpler than React
- Good documentation
- Template syntax familiar to HTML

**Cons:**
- Still requires build step
- 30KB+ framework overhead
- Another technology to learn
- **Rejected because:** Unnecessary complexity for current requirements

### 3. Svelte

**Pros:**
- Compiles to vanilla JavaScript
- No runtime overhead
- Reactive by default

**Cons:**
- Requires build step and compiler
- Smaller ecosystem
- Less team familiarity
- **Rejected because:** Immature ecosystem for production use

### 4. jQuery

**Pros:**
- No build step
- Large plugin ecosystem
- Familiar to team

**Cons:**
- 30KB overhead
- Outdated patterns
- Modern browsers don't need it
- **Rejected because:** Modern JavaScript has better native APIs

## Implementation Notes

### Code Organization Pattern

Each page follows the Module Pattern:

```javascript
// public/js/student-dashboard.js
(function() {
  'use strict';
  
  // Private state
  let offeringId = null;
  let teams = [];
  
  // Private functions
  async function loadDashboard() {
    const offering = await DashboardService.getActiveOffering();
    offeringId = offering.id;
    await Promise.all([
      loadTeams(),
      loadAnnouncements(),
      loadJournal()
    ]);
  }
  
  async function loadTeams() {
    teams = await DashboardService.getTeams(offeringId);
    renderTeams(teams);
  }
  
  // Initialization
  function init() {
    loadDashboard();
    setupEventListeners();
  }
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
```

### Service Layer Pattern

Shared API logic extracted to services:

```javascript
// public/js/services/dashboard-service.js
export const DashboardService = {
  async getActiveOffering() {
    const response = await fetch('/api/offerings/active');
    return await response.json();
  },
  
  async getTeams(offeringId) {
    const response = await fetch(`/api/offerings/${offeringId}/teams`);
    return await response.json();
  }
};
```

### CSS Architecture

Using BEM methodology with CSS custom properties:

```css
/* global.css */
:root {
  --palette-primary: #0F766E;
  --palette-secondary: #0891B2;
  --gray-50: #f9fafb;
  --gray-900: #111827;
}

/* dashboard-global.css */
.dashboard-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
}

.dashboard-card__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.dashboard-card__title {
  font-size: 1.25rem;
  font-weight: 600;
}
```

### Migration Strategy

If the application grows and requires a framework:

1. **Incremental adoption** - Can introduce React/Vue for specific pages
2. **API-first** - Backend is already decoupled via REST API
3. **Shared styling** - CSS can be reused in any framework
4. **No rewrite needed** - Can migrate page-by-page

## Related Decisions

- [ADR-0004: Server Selection (Express.js)](adr-0004-server-selection.md)
- [ADR-0003: Authentication Selection](adr-0003-authentication-selection.md)

## Date

2025-11-10

## Participants

- Development Team
- Product Owner
- Technical Lead

---

**Note:** This decision prioritizes simplicity and development speed over long-term scalability. If the application grows significantly (>20 pages, >10 developers), a framework migration should be reconsidered.
