import { describe, it, expect } from 'vitest';
import { parseEpics } from '../../src/push/epic-parser.js';

const SAMPLE_MD = `# Project — Implementation Task Breakdown

## Epics

### EPIC-001: User Authentication
**Description:** Implement auth system
**Acceptance Criteria:**
- [ ] Users can log in
- [ ] Password reset works
**Complexity:** M

---

### EPIC-002: Dashboard
**Description:** Build the main dashboard
**Acceptance Criteria:**
- [ ] Overview widget
- [ ] Activity feed
**Complexity:** L

---

#### STORY-001: Login form
- As a user, I want to log in so that I can access the app
- Acceptance criteria:
  - Email + password fields
  - Validation errors
- Technical notes: Use Auth0 SDK

#### STORY-002: Password reset
- As a user, I want to reset my password
- Acceptance criteria:
  - Email input
  - Reset link sent
- Technical notes: Auth0 password reset flow

#### STORY-003: Overview widget
- As a user, I want to see an overview of my projects
- Acceptance criteria:
  - Shows project count
  - Recent activity
`;

describe('parseEpics', () => {
  it('extracts all epics', () => {
    const epics = parseEpics(SAMPLE_MD);
    expect(epics).toHaveLength(2);
    expect(epics[0].id).toBe('EPIC-001');
    expect(epics[0].title).toBe('User Authentication');
    expect(epics[1].id).toBe('EPIC-002');
  });

  it('extracts epic description and complexity', () => {
    const epics = parseEpics(SAMPLE_MD);
    expect(epics[0].description).toContain('auth system');
    expect(epics[0].complexity).toBe('M');
    expect(epics[1].complexity).toBe('L');
  });

  it('extracts acceptance criteria', () => {
    const epics = parseEpics(SAMPLE_MD);
    expect(epics[0].acceptanceCriteria).toContain('log in');
    expect(epics[0].acceptanceCriteria).toContain('Password reset');
  });

  it('extracts stories', () => {
    const epics = parseEpics(SAMPLE_MD);
    // Stories should be linked to the most recent epic
    const allStories = epics.flatMap(e => e.stories);
    expect(allStories.length).toBeGreaterThan(0);
    expect(allStories[0].id).toBe('STORY-001');
    expect(allStories[0].title).toBe('Login form');
  });

  it('extracts story user story text', () => {
    const epics = parseEpics(SAMPLE_MD);
    const allStories = epics.flatMap(e => e.stories);
    const loginStory = allStories.find(s => s.id === 'STORY-001');
    expect(loginStory?.userStory).toContain('As a user');
  });

  it('returns empty array for empty input', () => {
    expect(parseEpics('')).toEqual([]);
    expect(parseEpics('# No epics here')).toEqual([]);
  });
});
