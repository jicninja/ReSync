import { describe, it, expect } from 'vitest';
import { formatTicket, groupByType, type JiraTicket } from '../../../src/ingestors/jira/formatter.js';

function makeTicket(overrides: Partial<JiraTicket> & { key: string }): JiraTicket {
  return {
    key: overrides.key,
    fields: {
      summary: 'Default Summary',
      issuetype: { name: 'Story' },
      status: { name: 'Open' },
      labels: [],
      description: undefined,
      issuelinks: [],
      comment: { comments: [] },
      ...(overrides.fields ?? {}),
    },
  };
}

describe('formatTicket', () => {
  it('formats a ticket with all fields into Markdown', () => {
    const ticket: JiraTicket = {
      key: 'PROJ-123',
      fields: {
        summary: 'Implement login flow',
        issuetype: { name: 'Epic' },
        status: { name: 'Done' },
        labels: ['mvp', 'core'],
        description: 'Full description here',
        issuelinks: [
          {
            type: 'Blocks',
            outwardIssue: { key: 'OTHER-456' },
          },
        ],
        comment: {
          comments: [
            { author: 'Alice', body: 'Looks good!' },
          ],
        },
      },
    };

    const result = formatTicket(ticket);

    expect(result).toContain('### PROJ-123: Implement login flow');
    expect(result).toContain('**Type:** Epic');
    expect(result).toContain('**Status:** Done');
    expect(result).toContain('**Labels:** mvp, core');
    expect(result).toContain('**Description:** Full description here');
    expect(result).toContain('**Links:** Blocks: OTHER-456');
    expect(result).toContain('**Comments:**');
    expect(result).toContain('**Alice:** Looks good!');
    expect(result).toContain('---');
  });

  it('formats a minimal ticket without optional fields', () => {
    const ticket = makeTicket({
      key: 'PROJ-1',
      fields: {
        summary: 'Simple ticket',
        issuetype: { name: 'Bug' },
        status: { name: 'Open' },
      },
    });

    const result = formatTicket(ticket);

    expect(result).toContain('### PROJ-1: Simple ticket');
    expect(result).toContain('**Type:** Bug');
    expect(result).toContain('**Status:** Open');
    expect(result).not.toContain('**Labels:**');
    expect(result).not.toContain('**Description:**');
    expect(result).not.toContain('**Links:**');
    expect(result).not.toContain('**Comments:**');
  });

  it('handles inward issue links', () => {
    const ticket = makeTicket({
      key: 'PROJ-2',
      fields: {
        issuelinks: [
          {
            type: 'Relates',
            inwardIssue: { key: 'PROJ-99' },
          },
        ],
      },
    });

    const result = formatTicket(ticket);
    expect(result).toContain('**Links:** Relates: PROJ-99');
  });

  it('handles missing summary gracefully', () => {
    const ticket: JiraTicket = {
      key: 'PROJ-404',
      fields: {},
    };

    const result = formatTicket(ticket);
    expect(result).toContain('### PROJ-404: (no summary)');
  });
});

describe('groupByType', () => {
  it('groups tickets correctly by issue type', () => {
    const tickets: JiraTicket[] = [
      makeTicket({ key: 'PROJ-1', fields: { issuetype: { name: 'Epic' } } }),
      makeTicket({ key: 'PROJ-2', fields: { issuetype: { name: 'Story' } } }),
      makeTicket({ key: 'PROJ-3', fields: { issuetype: { name: 'Epic' } } }),
      makeTicket({ key: 'PROJ-4', fields: { issuetype: { name: 'Bug' } } }),
    ];

    const grouped = groupByType(tickets);

    expect(grouped.get('Epic')).toHaveLength(2);
    expect(grouped.get('Story')).toHaveLength(1);
    expect(grouped.get('Bug')).toHaveLength(1);
    expect(grouped.size).toBe(3);
  });

  it('returns an empty map for an empty array', () => {
    const grouped = groupByType([]);
    expect(grouped.size).toBe(0);
  });

  it('groups tickets with missing issuetype under Unknown', () => {
    const ticket: JiraTicket = {
      key: 'PROJ-5',
      fields: {},
    };

    const grouped = groupByType([ticket]);
    expect(grouped.get('Unknown')).toHaveLength(1);
  });

  it('preserves ticket order within groups', () => {
    const tickets: JiraTicket[] = [
      makeTicket({ key: 'PROJ-1', fields: { issuetype: { name: 'Story' } } }),
      makeTicket({ key: 'PROJ-2', fields: { issuetype: { name: 'Story' } } }),
    ];

    const grouped = groupByType(tickets);
    const stories = grouped.get('Story')!;
    expect(stories[0].key).toBe('PROJ-1');
    expect(stories[1].key).toBe('PROJ-2');
  });
});
