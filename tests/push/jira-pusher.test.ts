import { describe, it, expect, vi } from 'vitest';
import { createJiraIssues } from '../../src/push/jira-pusher.js';
import type { Epic } from '../../src/push/epic-parser.js';

const mockCreateIssue = vi.fn().mockResolvedValue({ key: 'PROJ-1' });
const mockClient = {
  issues: { createIssue: mockCreateIssue },
};

const epics: Epic[] = [
  {
    id: 'EPIC-001',
    title: 'Auth',
    description: 'Implement auth',
    acceptanceCriteria: 'Users can log in',
    complexity: 'M',
    stories: [
      { id: 'STORY-001', title: 'Login form', userStory: 'As a user...', acceptanceCriteria: 'Email field', technicalNotes: '' },
    ],
  },
];

describe('createJiraIssues', () => {
  it('creates epic and story issues', async () => {
    mockCreateIssue.mockClear();
    const result = await createJiraIssues(mockClient as any, epics, {
      project: 'PROJ',
      prefix: '[ReSpec]',
      epicsOnly: false,
    });
    expect(result.epicsCreated).toBe(1);
    expect(result.storiesCreated).toBe(1);
    expect(mockCreateIssue).toHaveBeenCalledTimes(2);
  });

  it('creates only epics when epicsOnly is true', async () => {
    mockCreateIssue.mockClear();
    const result = await createJiraIssues(mockClient as any, epics, {
      project: 'PROJ',
      prefix: '[ReSpec]',
      epicsOnly: true,
    });
    expect(result.epicsCreated).toBe(1);
    expect(result.storiesCreated).toBe(0);
    expect(mockCreateIssue).toHaveBeenCalledTimes(1);
  });

  it('applies prefix to issue summaries', async () => {
    mockCreateIssue.mockClear();
    await createJiraIssues(mockClient as any, epics, {
      project: 'PROJ',
      prefix: '[Migration]',
      epicsOnly: true,
    });
    const call = mockCreateIssue.mock.calls[0][0];
    expect(call.fields.summary).toContain('[Migration]');
  });

  it('adds respec label to all issues', async () => {
    mockCreateIssue.mockClear();
    await createJiraIssues(mockClient as any, epics, {
      project: 'PROJ',
      prefix: '[ReSpec]',
      epicsOnly: true,
    });
    const call = mockCreateIssue.mock.calls[0][0];
    expect(call.fields.labels).toContain('respec');
  });

  it('links stories to parent epic', async () => {
    mockCreateIssue.mockClear();
    await createJiraIssues(mockClient as any, epics, {
      project: 'PROJ',
      prefix: '[ReSpec]',
      epicsOnly: false,
    });
    // Second call is the story — should have parent
    const storyCall = mockCreateIssue.mock.calls[1][0];
    expect(storyCall.fields.parent).toBeDefined();
    expect(storyCall.fields.parent.key).toBe('PROJ-1');
  });
});
