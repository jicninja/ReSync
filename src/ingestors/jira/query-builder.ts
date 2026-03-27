export interface JiraFilters {
  projects?: string[];
  labels?: string[];
  title_contains?: string[];
  types?: string[];
  status?: string[];
  sprints?: string[];
  jql?: string;
}

export function buildJQL(filters: JiraFilters | undefined): string {
  if (!filters) return '';

  // Raw JQL override takes precedence
  if (filters.jql) {
    return filters.jql;
  }

  const clauses: string[] = [];

  if (filters.projects && filters.projects.length > 0) {
    const values = filters.projects.map((p) => `"${p}"`).join(', ');
    clauses.push(`project IN (${values})`);
  }

  if (filters.types && filters.types.length > 0) {
    const values = filters.types.map((t) => `"${t}"`).join(', ');
    clauses.push(`issuetype IN (${values})`);
  }

  if (filters.status && filters.status.length > 0) {
    const values = filters.status.map((s) => `"${s}"`).join(', ');
    clauses.push(`status IN (${values})`);
  }

  if (filters.labels && filters.labels.length > 0) {
    const values = filters.labels.map((l) => `"${l}"`).join(', ');
    clauses.push(`labels IN (${values})`);
  }

  if (filters.title_contains && filters.title_contains.length > 0) {
    for (const term of filters.title_contains) {
      clauses.push(`summary ~ "${term}"`);
    }
  }

  if (filters.sprints && filters.sprints.length > 0) {
    const values = filters.sprints.map((s) => `"${s}"`).join(', ');
    clauses.push(`sprint IN (${values})`);
  }

  return clauses.join(' AND ');
}
