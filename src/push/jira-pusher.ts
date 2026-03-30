import type { Version2Client } from 'jira.js';
import type { Epic } from './epic-parser.js';

export interface PushOptions {
  project: string;
  prefix: string;
  epicsOnly: boolean;
}

export interface PushResult {
  epicsCreated: number;
  storiesCreated: number;
  issues: { key: string; summary: string }[];
}

export async function createJiraIssues(
  client: Version2Client,
  epics: Epic[],
  options: PushOptions,
): Promise<PushResult> {
  const result: PushResult = { epicsCreated: 0, storiesCreated: 0, issues: [] };

  for (const epic of epics) {
    const summary = `${options.prefix} ${epic.id}: ${epic.title}`;
    const description = [
      epic.description,
      '',
      '**Acceptance Criteria:**',
      epic.acceptanceCriteria,
      '',
      `**Complexity:** ${epic.complexity}`,
    ].join('\n');

    const epicIssue = await client.issues.createIssue({
      fields: {
        project: { key: options.project },
        summary,
        description,
        issuetype: { name: 'Epic' },
        labels: ['respec'],
      },
    });

    result.epicsCreated++;
    result.issues.push({ key: epicIssue.key, summary });

    if (!options.epicsOnly) {
      for (const story of epic.stories) {
        const storySummary = `${options.prefix} ${story.title}`;
        const storyDescription = [
          story.userStory,
          '',
          '**Acceptance Criteria:**',
          story.acceptanceCriteria,
          ...(story.technicalNotes ? ['', `**Technical Notes:** ${story.technicalNotes}`] : []),
        ].join('\n');

        const storyIssue = await client.issues.createIssue({
          fields: {
            project: { key: options.project },
            summary: storySummary,
            description: storyDescription,
            issuetype: { name: 'Story' },
            labels: ['respec'],
            parent: { key: epicIssue.key },
          },
        });

        result.storiesCreated++;
        result.issues.push({ key: storyIssue.key, summary: storySummary });
      }
    }
  }

  return result;
}
