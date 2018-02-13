import _ from 'lodash';
import Vue from 'vue';
import Vuex from 'vuex';
import VuexORM, { Database, Model } from '@vuex-orm/core';

Vue.use(Vuex);

/**
 * Create whole application.
 */
export function createApplication (namespace, entities) {
  const database = new Database();

  _.forEach(entities, (entity) => {
    database.register(entity.model, entity.module || {})
  });

  database.registerNamespace(namespace);

  return database;
}

/**
 * Create a new Vuex Store.
 */
export function createStore (entities) {
  const database = new Database();

  _.forEach(entities, (entity) => {
    database.register(entity.model, entity.module || {})
  });

  return new Vuex.Store({
    plugins: [VuexORM.install(database)]
  });
}

/**
 * Create a new Vuex State.
 */
export function createState (namespace, state) {
  return {
    name: namespace,

    ..._.mapValues(state, data => {
      return { data }
    })
  };
}

/**
 * Get action context that can be passed to action as argument.
 */
export function actionContext (context = {}) {
  return {
    state: context.state || {},
    rootState: context.rootState || {},
    getters: context.getters || sinon.spy(),
    rootGetters: context.rootGetters || sinon.spy(),
    dispatch: context.dispatch || sinon.spy(),
    commit: context.commit || sinon.spy()
  };
}

export default {
  createApplication,
  actionContext
}
