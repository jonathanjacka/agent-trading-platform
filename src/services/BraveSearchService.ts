import { Logger } from '../utils/logger.js';

// API Documentation: https://api.search.brave.com/res/v1/web/search
export class BraveSearchService {
  private apiKey: string;
  private baseUrl = 'https://api.search.brave.com/res/v1/web/search';

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('BRAVE_API_KEY is required for BraveSearchService');
    }

    this.apiKey = apiKey;
    Logger.info('BraveSearchService initialized');
  }

  async search(
    query: string,
    options: {
      count?: number; // Number of web results (1-20, default 20)
      freshness?: 'pd' | 'pw' | 'pm' | 'py'; // Past day/week/month/year
      result_filter?: string; // e.g., 'web,news' or 'news' only
      country?: string; // Country code (default 'US')
      search_lang?: string; // Language code (default 'en')
    } = {}
  ): Promise<{
    query: {
      original: string;
      altered?: string;
    };
    web?: {
      results: Array<{
        title: string;
        description: string;
        url: string;
        age?: string;
        language?: string;
      }>;
    };
    news?: {
      results: Array<{
        title: string;
        description: string;
        url: string;
        source?: string;
        age?: string;
        thumbnail?: {
          src: string;
        };
        breaking?: boolean;
      }>;
    };
  }> {
    try {
      const {
        count = 10,
        freshness,
        result_filter,
        country = 'US',
        search_lang = 'en',
      } = options;

      Logger.info(
        `Brave search: "${query}" (count: ${count}${result_filter ? `, filter: ${result_filter}` : ''})`
      );

      const params = new URLSearchParams({
        q: query,
        count: count.toString(),
        country,
        search_lang,
      });

      if (freshness) {
        params.append('freshness', freshness);
      }

      if (result_filter) {
        params.append('result_filter', result_filter);
      }

      const response = await fetch(`${this.baseUrl}?${params.toString()}`, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Brave Search API error: ${response.status} ${response.statusText}`
        );
      }

      const data = (await response.json()) as any;

      const result: any = {
        query: {
          original: data.query?.original || query,
          altered: data.query?.altered,
        },
      };

      if (data.web?.results) {
        result.web = {
          results: data.web.results.map((r: any) => ({
            title: r.title,
            description: r.description || '',
            url: r.url,
            age: r.age,
            language: r.language,
          })),
        };
        Logger.info(`Found ${result.web.results.length} web results`);
      }

      if (data.news?.results) {
        result.news = {
          results: data.news.results.map((r: any) => ({
            title: r.title,
            description: r.description || '',
            url: r.url,
            source: r.source,
            age: r.age,
            thumbnail: r.thumbnail,
            breaking: r.breaking,
          })),
        };
        Logger.info(`Found ${result.news.results.length} news results`);
      }

      return result;
    } catch (error) {
      Logger.error(`Failed to search for "${query}"`, error);
      throw new Error(
        `Unable to perform search: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async searchNews(
    query: string,
    options: {
      count?: number;
      freshness?: 'pd' | 'pw' | 'pm' | 'py';
    } = {}
  ) {
    const { count = 10, freshness = 'pw' } = options;

    return this.search(query, {
      count,
      freshness,
      result_filter: 'news',
    });
  }

  async searchWeb(
    query: string,
    options: {
      count?: number;
      freshness?: 'pd' | 'pw' | 'pm' | 'py';
    } = {}
  ) {
    const { count = 10, freshness } = options;

    return this.search(query, {
      count,
      freshness,
      result_filter: 'web',
    });
  }
}
