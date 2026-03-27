export interface JiraComment {
  author?: string;
  body?: string;
}

export interface JiraLink {
  type?: string;
  outwardIssue?: { key?: string };
  inwardIssue?: { key?: string };
}

export interface JiraTicket {
  key: string;
  fields: {
    summary?: string;
    issuetype?: { name?: string };
    status?: { name?: string };
    labels?: string[];
    description?: string;
    issuelinks?: JiraLink[];
    comment?: {
      comments?: JiraComment[];
    };
  };
}

export function formatTicket(ticket: JiraTicket): string {
  const { key, fields } = ticket;
  const lines: string[] = [];

  const summary = fields.summary ?? '(no summary)';
  const type = fields.issuetype?.name ?? 'Unknown';
  const status = fields.status?.name ?? 'Unknown';
  const labels = fields.labels && fields.labels.length > 0
    ? fields.labels.join(', ')
    : undefined;
  const description = fields.description;

  lines.push(`### ${key}: ${summary}`);
  lines.push(`**Type:** ${type}`);
  lines.push(`**Status:** ${status}`);

  if (labels) {
    lines.push(`**Labels:** ${labels}`);
  }

  if (description) {
    lines.push(`**Description:** ${description}`);
  }

  const issuelinks = fields.issuelinks ?? [];
  if (issuelinks.length > 0) {
    const linkStrs = issuelinks.map((link) => {
      const linkType = link.type ?? 'Related';
      if (link.outwardIssue?.key) {
        return `${linkType}: ${link.outwardIssue.key}`;
      }
      if (link.inwardIssue?.key) {
        return `${linkType}: ${link.inwardIssue.key}`;
      }
      return linkType;
    });
    lines.push(`**Links:** ${linkStrs.join(', ')}`);
  }

  const comments = fields.comment?.comments ?? [];
  if (comments.length > 0) {
    lines.push('**Comments:**');
    for (const comment of comments) {
      const author = comment.author ?? 'Unknown';
      const body = comment.body ?? '';
      lines.push(`- **${author}:** ${body}`);
    }
  }

  lines.push('---');

  return lines.join('\n');
}

export function groupByType(tickets: JiraTicket[]): Map<string, JiraTicket[]> {
  const map = new Map<string, JiraTicket[]>();

  for (const ticket of tickets) {
    const type = ticket.fields.issuetype?.name ?? 'Unknown';
    const existing = map.get(type);
    if (existing) {
      existing.push(ticket);
    } else {
      map.set(type, [ticket]);
    }
  }

  return map;
}
