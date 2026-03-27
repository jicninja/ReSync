import { describe, it, expect } from 'vitest';
import { buildJQL } from '../../../src/ingestors/jira/query-builder.js';

describe('buildJQL', () => {
  it('returns raw jql if provided', () => {
    const result = buildJQL({ jql: 'project = FOO AND status = Done' });
    expect(result).toBe('project = FOO AND status = Done');
  });

  it('raw jql overrides all other filters', () => {
    const result = buildJQL({
      jql: 'project = OVERRIDE',
      projects: ['OTHER'],
      types: ['Story'],
    });
    expect(result).toBe('project = OVERRIDE');
  });

  it('builds JQL from project filter', () => {
    const result = buildJQL({ projects: ['PROJ'] });
    expect(result).toBe('project IN ("PROJ")');
  });

  it('builds JQL with multiple projects', () => {
    const result = buildJQL({ projects: ['PROJ', 'CORE'] });
    expect(result).toBe('project IN ("PROJ", "CORE")');
  });

  it('combines multiple filters with AND', () => {
    const result = buildJQL({
      projects: ['PROJ'],
      types: ['Epic', 'Story'],
      status: ['Done'],
    });
    expect(result).toBe('project IN ("PROJ") AND issuetype IN ("Epic", "Story") AND status IN ("Done")');
  });

  it('handles title_contains with summary ~', () => {
    const result = buildJQL({ title_contains: ['login', 'auth'] });
    expect(result).toBe('summary ~ "login" AND summary ~ "auth"');
  });

  it('handles labels filter', () => {
    const result = buildJQL({ labels: ['mvp', 'core'] });
    expect(result).toBe('labels IN ("mvp", "core")');
  });

  it('handles sprints filter', () => {
    const result = buildJQL({ sprints: ['Sprint 1', 'Sprint 2'] });
    expect(result).toBe('sprint IN ("Sprint 1", "Sprint 2")');
  });

  it('returns empty string for no filters', () => {
    const result = buildJQL({});
    expect(result).toBe('');
  });

  it('returns empty string for undefined filters', () => {
    const result = buildJQL(undefined);
    expect(result).toBe('');
  });

  it('combines all filter types with AND', () => {
    const result = buildJQL({
      projects: ['PROJ'],
      types: ['Story'],
      status: ['In Progress'],
      labels: ['mvp'],
      title_contains: ['checkout'],
      sprints: ['Sprint 3'],
    });
    expect(result).toContain('project IN ("PROJ")');
    expect(result).toContain('issuetype IN ("Story")');
    expect(result).toContain('status IN ("In Progress")');
    expect(result).toContain('labels IN ("mvp")');
    expect(result).toContain('summary ~ "checkout"');
    expect(result).toContain('sprint IN ("Sprint 3")');
    // All joined with AND
    const parts = result.split(' AND ');
    expect(parts.length).toBe(6);
  });
});
