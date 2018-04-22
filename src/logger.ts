import QueryBuilder from './queryBuilder';
import { DocumentNode } from 'graphql';
import { Arguments } from './interfaces';
import { FetchPolicy } from 'apollo-client';

export default class Logger {
  private readonly enabled: boolean;

  private PREFIX = process.env.NODE_ENV === 'test' ? ['[Vuex-ORM-Apollo]'] :
    [
      '%c Vuex-ORM: Apollo Plugin %c',
      'background: #35495e; padding: 1px 0; border-radius: 3px; color: #eee;',
      'background: transparent;'
    ];

  public constructor (enabled: boolean) {
    this.enabled = enabled;
    this.log('Logging is enabled.');
  }

  public group (...messages: Array<any>): void {
    if (this.enabled) {
      if (process.env.NODE_ENV === 'test') {
        console.group(...this.PREFIX, ...messages);
      } else {
        console.groupCollapsed(...this.PREFIX, ...messages);
      }
    }
  }

  public groupEnd (): void {
    if (this.enabled) console.groupEnd();
  }

  public log (...messages: Array<any>): void {
    if (this.enabled) {
      console.log(...this.PREFIX, ...messages);
    }
  }

  public logQuery (query: string | DocumentNode, variables?: Arguments, fetchPolicy?: FetchPolicy) {
    if (this.enabled) {
      try {
        let prettified = '';
        if (typeof query === 'object' && query.loc) {
          prettified = QueryBuilder.prettify(query.loc.source.body);
        } else {
          prettified = QueryBuilder.prettify(query as string);
        }

        this.group('Sending query:', prettified.split('\n')[1].replace('{', '').trim());
        console.log(prettified);

        if (variables) console.log('VARIABLES:', variables);
        if (fetchPolicy) console.log('FETCH POLICY:', fetchPolicy);

        this.groupEnd();
      } catch (e) {
        console.error('[Vuex-ORM-Apollo] There is a syntax error in the query!', e, query);
      }
    }
  }
}
