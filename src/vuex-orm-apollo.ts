import Model from './model';
import { ApolloClient } from 'apollo-client';
import { HttpLink } from 'apollo-link-http';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { Data, ActionParams, Arguments, ORMModel, DispatchFunction } from './interfaces';
import Logger from './logger';
import QueryBuilder from './queryBuilder';

const inflection = require('inflection');

/**
 * Plugin class
 */
export default class VuexORMApollo {
  private readonly httpLink: HttpLink;
  private readonly apolloClient: ApolloClient<any>;
  private readonly components: any;
  private readonly options: any;
  private readonly database: any;
  private readonly models: Map<string, Model> = new Map();
  private readonly debugMode: boolean = false;
  private readonly logger: Logger;
  private readonly queryBuilder: QueryBuilder;

  /**
   * Constructor
   *
   * @param components
   * @param options
   */
  public constructor (components: any, options: any) {
    this.components = components;
    this.options = options;

    if (!options.database) {
      throw new Error('database param is required to initialize vuex-orm-apollo!');
    }

    this.database = options.database;
    this.debugMode = options.debug as boolean;
    this.logger = new Logger(this.debugMode);

    this.collectModels();
    this.setupMethods();

    this.httpLink = new HttpLink({
      uri: '/graphql'
    });

    this.apolloClient = new ApolloClient({
      link: this.httpLink,
      cache: new InMemoryCache(),
      connectToDevTools: true
    });

    this.queryBuilder = new QueryBuilder(this.logger, this.getModel.bind(this));
  }

  /**
   * Returns a model by name
   *
   * @param {Model|string} model
   * @returns {Model}
   */
  public getModel (model: Model | string): Model {
    if (!(model instanceof Model)) {
      model = this.models.get(inflection.singularize(model)) as Model;
      if (!model) throw new Error(`No such model ${model}!`);
    }

    return model;
  }

  /**
   * Wraps all Vuex-ORM entities in a Model object and saves them into this.models
   */
  private collectModels () {
    this.database.entities.forEach((entity: any) => {
      const model = new Model(entity.model as ORMModel);
      this.models.set(model.singularName, model);
    });
  }

  /**
   * This method will setup following Vuex action: fetch, persist, push, destroy
   */
  private setupMethods () {
    this.components.subActions.fetch = this.fetch.bind(this);

    this.components.subActions.persist = this.persist.bind(this);
    this.components.subActions.push = this.push.bind(this);
    this.components.subActions.destroy = this.destroy.bind(this);
    // this.components.subActions.destroyAll = this.destroyAll.bind(this);
  }

  /**
   * Will be called, when dispatch('entities/something/fetch') is called.
   *
   * @param {Arguments} args
   * @param {any} state
   * @param {any} dispatch
   * @returns {Promise<void>}
   */
  private async fetch ({ state, dispatch, filter }: ActionParams) {
    // Send the request to the GraphQL API
    const query = this.queryBuilder.buildQuery(state.$name, filter);
    const data = await this.apolloRequest(query);

    // Insert incoming data into the store
    await this.insertData(data, dispatch);
  }

  /**
   * Will be called, when dispatch('entities/something/persist') is called.
   *
   * @param {any} state
   * @param {any} dispatch
   * @param {any} id
   * @returns {Promise<void>}
   */
  private async persist ({ state, dispatch }: ActionParams, { id }: ActionParams) {
    const model = this.getModel(state.$name);
    const data = model.baseModel.getters('find')(id);

    await this.mutate('create', data, dispatch, this.getModel(state.$name));

    // TODO is this really necessary?
    return model.baseModel.getters('find')(id);
  }

  /**
   * Will be called, when dispatch('entities/something/push') is called.
   * @param {any} state
   * @param {any} dispatch
   * @param {Data} data
   * @returns {Promise<Data | {}>}
   */
  private async push ({ state, dispatch }: ActionParams, { data }: ActionParams) {
    return this.mutate('update', data, dispatch, this.getModel(state.$name));
  }

  /**
   * Will be called, when dispatch('entities/something/destroy') is called.
   *
   * @param {any} state
   * @param {any} dispatch
   * @param {Data} id
   * @returns {Promise<void>}
   */
  private async destroy ({ state, dispatch }: ActionParams, { id }: ActionParams): Promise<void> {
    const model = this.getModel(state.$name);

    if (id) {
      const query = this.queryBuilder.buildMutation(model, id, 'delete');

      // Send GraphQL Mutation
      await this.apolloClient.mutate({
        mutation: query,
        variables: { id }
      });
    }
  }

  /**
   * Contains the logic to save (persist or push) data.
   *
   * @param {string} action
   * @param {Data | undefined} data
   * @param {Function} dispatch
   * @param {Model} model
   * @returns {Promise<any>}
   */
  private async mutate (action: string, data: Data | undefined, dispatch: DispatchFunction, model: Model): Promise<any> {
    if (data) {
      const id = action === 'create' ? undefined : data.id;
      const query = this.queryBuilder.buildMutation(model, id, action);

      const variables: Data = {
        [model.singularName]: this.queryBuilder.transformOutgoingData(data)
      };

      if (id) variables['id'] = id;

      // Send GraphQL Mutation
      const response = await this.apolloClient.mutate({
        mutation: query,
        variables
      });

      // Insert incoming data into the store
      const newData = this.queryBuilder.transformIncomingData(response.data as Data, true);
      return this.updateData(newData, dispatch, data.id);
    }
  }

  /**
   * Sends a query to the GraphQL API via apollo
   * @param query
   * @returns {Promise<Data>}
   */
  private async apolloRequest (query: any): Promise<Data> {
    const response = await (this.apolloClient).query({ query });

    // Transform incoming data into something useful
    return this.queryBuilder.transformIncomingData(response.data);
  }

  /**
   * Inserts incoming data into the store.
   *
   * @param {Data} data
   * @param {Function} dispatch
   * @param {boolean} update
   */
  private async insertData (data: Data, dispatch: DispatchFunction) {
    Object.keys(data).forEach(async (key) => {
      await dispatch('insertOrUpdate', { data: data[key] });
    });
  }

  /**
   * Updates an existing record in the store with new data. This method can only update one single record, so
   * it takes the first record of the first field from the data object!
   * @param {Data} data
   * @param {Function} dispatch
   * @param id
   */
  private async updateData (data: Data, dispatch: DispatchFunction, id: number | string) {
    // We only take the first field!
    data = data[Object.keys(data)[0]];

    if (data instanceof Array) {
      data = data[0];
    }

    return dispatch('update', { where: id, data });
  }
}
