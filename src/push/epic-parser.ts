export interface Story {
  id: string;
  title: string;
  userStory: string;
  acceptanceCriteria: string;
  technicalNotes: string;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  complexity: string;
  stories: Story[];
}

export function parseEpics(markdown: string): Epic[] {
  if (!markdown || markdown.trim() === '') return [];

  const lines = markdown.split('\n');
  const epics: Epic[] = [];
  let currentEpic: Epic | null = null;
  let currentStory: Story | null = null;
  let section: 'none' | 'description' | 'acceptance' | 'story_acceptance' | 'story_tech' = 'none';

  const epicRegex = /^###\s+(EPIC-\d+):\s+(.+)$/;
  const storyRegex = /^####\s+(STORY-\d+):\s+(.+)$/;

  function flushStory() {
    if (currentStory && currentEpic) {
      currentEpic.stories.push(currentStory);
      currentStory = null;
    }
  }

  function flushEpic() {
    flushStory();
    if (currentEpic) {
      epics.push(currentEpic);
      currentEpic = null;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Check for epic heading
    const epicMatch = trimmed.match(epicRegex);
    if (epicMatch) {
      flushEpic();
      currentEpic = {
        id: epicMatch[1],
        title: epicMatch[2].trim(),
        description: '',
        acceptanceCriteria: '',
        complexity: '',
        stories: [],
      };
      section = 'none';
      continue;
    }

    // Check for story heading
    const storyMatch = trimmed.match(storyRegex);
    if (storyMatch) {
      flushStory();
      // If no current epic, attach to last epic
      if (!currentEpic && epics.length > 0) {
        currentEpic = epics.pop()!;
      }
      currentStory = {
        id: storyMatch[1],
        title: storyMatch[2].trim(),
        userStory: '',
        acceptanceCriteria: '',
        technicalNotes: '',
      };
      section = 'none';
      continue;
    }

    // Epic field parsers
    if (currentEpic && !currentStory) {
      if (/^\*\*Description:\*\*/.test(trimmed)) {
        const inline = trimmed.replace(/^\*\*Description:\*\*\s*/, '').trim();
        currentEpic.description = inline;
        section = 'description';
        continue;
      }

      if (/^\*\*Acceptance Criteria:\*\*/.test(trimmed)) {
        section = 'acceptance';
        continue;
      }

      if (/^\*\*Complexity:\*\*/.test(trimmed)) {
        currentEpic.complexity = trimmed.replace(/^\*\*Complexity:\*\*\s*/, '').trim();
        section = 'none';
        continue;
      }

      if (section === 'description' && trimmed !== '' && !trimmed.startsWith('**') && !trimmed.startsWith('-') && !trimmed.startsWith('#')) {
        currentEpic.description += (currentEpic.description ? ' ' : '') + trimmed;
        continue;
      }

      if (section === 'acceptance' && /^-\s+\[[ xX]\]/.test(trimmed)) {
        const item = trimmed.replace(/^-\s+\[[ xX]\]\s*/, '').trim();
        currentEpic.acceptanceCriteria += (currentEpic.acceptanceCriteria ? '\n' : '') + item;
        continue;
      }

      // Blank line or separator ends the current section for epics
      if (trimmed === '' || trimmed === '---') {
        if (section !== 'none') section = 'none';
        continue;
      }

      continue;
    }

    // Story field parsers
    if (currentStory) {
      // "As a user..." line
      if (/^-\s+As\s+/i.test(trimmed) && !currentStory.userStory) {
        currentStory.userStory = trimmed.replace(/^-\s+/, '').trim();
        section = 'none';
        continue;
      }

      if (/^-\s+Acceptance criteria:/i.test(trimmed)) {
        section = 'story_acceptance';
        continue;
      }

      if (/^-\s+Technical notes:/i.test(trimmed)) {
        const inline = trimmed.replace(/^-\s+Technical notes:\s*/i, '').trim();
        currentStory.technicalNotes = inline;
        section = 'story_tech';
        continue;
      }

      // Indented items under story acceptance criteria
      if (section === 'story_acceptance' && /^\s{2,}-\s+/.test(line)) {
        const item = trimmed.replace(/^-\s*/, '').trim();
        currentStory.acceptanceCriteria += (currentStory.acceptanceCriteria ? '\n' : '') + item;
        continue;
      }

      // Technical notes continuation (indented or plain continuation line)
      if (section === 'story_tech' && trimmed !== '' && !trimmed.startsWith('#') && !/^####/.test(trimmed)) {
        if (!currentStory.technicalNotes) {
          currentStory.technicalNotes = trimmed;
        }
        continue;
      }

      continue;
    }
  }

  flushEpic();

  return epics;
}
