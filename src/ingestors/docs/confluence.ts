import { resolveEnvAuth } from '../../config/loader.js';

export interface ConfluencePage {
  id: string;
  title: string;
  slug: string;
  body: string; // raw HTML (body.storage.value)
  ancestors: Array<{ id: string; title: string }>;
}

interface ConfluenceConfig {
  host: string;
  space: string;
  auth: string;
}

export class ConfluenceClient {
  private host: string;
  private space: string;
  private authHeader: string;

  constructor(config: ConfluenceConfig) {
    this.host = config.host.replace(/\/$/, '');
    this.space = config.space;
    const token = resolveEnvAuth(config.auth);
    this.authHeader = `Basic ${Buffer.from(token).toString('base64')}`;
  }

  async *fetchPages(): AsyncGenerator<ConfluencePage> {
    let start = 0;
    const limit = 25;

    while (true) {
      const url = `${this.host}/wiki/rest/api/content?spaceKey=${this.space}&type=page&expand=body.storage,ancestors&limit=${limit}&start=${start}`;

      const response = await fetch(url, {
        headers: { 'Authorization': this.authHeader, 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Confluence API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json() as any;
      const results = data.results ?? [];

      if (results.length === 0) break;

      for (const page of results) {
        const slug = page.title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '');

        yield {
          id: page.id,
          title: page.title,
          slug,
          body: page.body?.storage?.value ?? '',
          ancestors: (page.ancestors ?? []).map((a: any) => ({ id: a.id, title: a.title })),
        };
      }

      start += results.length;
      if (results.length < limit) break;
    }
  }
}
