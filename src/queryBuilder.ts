import { print } from 'graphql/language/printer';
import { parse } from 'graphql/language/parser';
import { Arguments, Data, Field } from './interfaces';
import Model from './model';
import gql from 'graphql-tag';
import Logger from './logger';
const inflection = require('inflection');

/**
 * This class takes care of everything GraphQL query related, especially the generation of queries out of models
 */
export default class QueryBuilder {
  private readonly logger: Logger;
  private readonly getModel: (name: Model | string) => Model;

  /**
   * Constructor.
   * @param {Logger} logger
   * @param {(name: (Model | string)) => Model} getModel
   */
  public constructor (logger: Logger, getModel: (name: Model | string) => Model) {
    this.logger = logger;
    this.getModel = getModel;
  }

  /**
   * Takes a string with a graphql query and formats it
   * @param {string} query
   * @returns {string}
   */
  public static prettify (query: string): string {
    return print(parse(query));
  }

  /**
   * Generates the arguments string for a graphql query based on a given map.
   *
   * There are three types of arguments:
   *
   * 1) Signatures with simple types (signature = true)
   *      mutation createUser($name: String!)
   *
   * 2) Signatures with object types (signature = true, args = { user: { __type: 'User' }})
   *      mutation createUser($user: UserInput!)
   *
   * 3) Fields with values (signature = false, valuesAsVariables = false)
   *      query user(id: 15)
   *
   * 4) Fields with variables (signature = false, valuesAsVariables = true)
   *      query user(id: $id)
   *
   * 5) Fields with object value (signature = false, valuesAsVariables = false, args = { user: { __type: 'User' }})
   *      mutation createUser(user: {...})
   *
   * @param {Arguments | undefined} args
   * @param {boolean} signature When true, then this method generates a query signature instead of key/value pairs
   * @param {boolean} valuesAsVariables When true and abstract = false, then this method generates filter arguments with
   *                           variables instead of values
   * @returns {String}
   */
  public buildArguments (args: Arguments | undefined,
                        signature: boolean = false,
                        valuesAsVariables: boolean = false): string {
    let returnValue: string = '';
    let first: boolean = true;

    if (args) {
      Object.keys(args).forEach((key: string) => {
        let value: any = args[key];

        // Ignore ids and connections
        if (!(value instanceof Array || key === 'id')) {
          let typeOrValue: any = '';

          if (signature) {
            if (typeof value === 'object' && value.__type) {
              // Case 2 (User!)
              typeOrValue = value.__type + 'Input!';
            } else {
              // Case 1 (String!)
              typeOrValue = typeof value === 'number' ? 'Number!' : 'String!';
            }
          } else if (valuesAsVariables) {
            // Case 6 (user: $user)
            typeOrValue = `$${key}`;
          } else {
            if (typeof value === 'object' && value.__type) {
              // Case 3 ({name: 'Helga Hufflepuff"})
              typeOrValue = JSON.stringify(value);
            } else {
              // Case 3 ("someValue")
              typeOrValue = typeof value === 'number' ? value : `"${value}"`;
            }
          }

          returnValue = `${returnValue}${first ? '' : ', '}${(signature ? '$' : '') + key}: ${typeOrValue}`;
          first = false;
        }
      });

      if (!first) returnValue = `(${returnValue})`;
    }

    return returnValue;
  }

  /**
   * Transforms outgoing data. Use for variables param.
   *
   * Omits relations and id fields.
   *
   * @param {Data} data
   * @returns {Data}
   */
  public transformOutgoingData (data: Data): Data {
    const model: Model = this.getModel(data.$self().entity);
    const relations: Map<string, Field> = model.getRelations();
    const returnValue: Data = {};

    Object.keys(data).forEach((key) => {
      const value = data[key];

      // Ignore IDs and connections
      if (!relations.has(key) && key !== 'id') {
        returnValue[key] = value;
      }
    });

    return returnValue;
  }

  /**
   * Transforms a set of incoming data to the format vuex-orm requires.
   *
   * @param {Data | Array<Data>} data
   * @param {boolean} recursiveCall
   * @returns {Data}
   */
  public transformIncomingData (data: Data | Array<Data>, recursiveCall: boolean = false): Data {
    let result: Data = {};

    if (!recursiveCall) {
      this.logger.group('Transforming incoming data');
      this.logger.log('Raw data:', data);
    }

    if (data instanceof Array) {
      result = data.map(d => this.transformIncomingData(d, true));
    } else {
      Object.keys(data).forEach((key) => {
        if (data[key]) {
          if (data[key] instanceof Object) {
            if (data[key].nodes) {
              result[inflection.pluralize(key)] = this.transformIncomingData(data[key].nodes, true);
            } else {
              result[inflection.singularize(key)] = this.transformIncomingData(data[key], true);
            }
          } else if (key === 'id') {
            result[key] = parseInt(data[key], 0);
          } else {
            result[key] = data[key];
          }
        }
      });
    }

    if (!recursiveCall) {
      this.logger.log('Transformed data:', result);
      this.logger.groupEnd();
    }

    return result;
  }

  /**
   *
   * @param {Model} model
   * @param {Model} rootModel
   * @returns {Array<String>}
   */
  public buildRelationsQuery (model: Model, rootModel?: Model) {
    const relationQueries: Array<string> = [];

    model.getRelations().forEach((field: Field, name: string) => {
      if (!rootModel || name !== rootModel.singularName && name !== rootModel.pluralName) {
        const multiple: boolean = field.constructor.name !== 'BelongsTo';
        relationQueries.push(this.buildField(name, multiple, undefined, false, rootModel || model));
      }
    });

    return relationQueries;
  }

  /**
   * Builds a field for the GraphQL query and a specific model
   * @param {Model|string} model
   * @param {boolean} multiple
   * @param {Arguments} args
   * @param {boolean} withVars
   * @param {Model} rootModel
   * @param {string} name
   * @returns {string}
   */
  public buildField (model: Model | string, multiple: boolean = true, args?: Arguments, withVars: boolean = false, rootModel?: Model, name?: string): string {
    model = this.getModel(model);

    let params: string = this.buildArguments(args, false, withVars);

    const fields = `
      ${model.getQueryFields().join(' ')}
      ${this.buildRelationsQuery(model, rootModel)}
    `;

    if (multiple) {
      return `
        ${name ? name : model.pluralName}${params} {
          nodes {
            ${fields}
          }
        }
      `;
    } else {
      return `
        ${name ? name : model.singularName}${params} {
          ${fields}
        }
      `;
    }
  }

  /**
   * Create a GraphQL query for the given model and arguments.
   *
   * @param {string} modelName
   * @param {Arguments} args
   * @returns {any}
   */
  public buildQuery (modelName: string, args?: Arguments): any {
    const multiple = !(args && args.get('id'));
    const query = `{ ${this.buildField(modelName, multiple, args)} }`;
    return gql(query);
  }
}
