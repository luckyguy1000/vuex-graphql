import {Model as ORMModel} from "@vuex-orm/core";
import Vue from 'vue';
import {createStore, sendWithMockFetch} from "../support/Helpers";
import fetchMock from 'fetch-mock';

let store;
let vuexOrmApollo;

class User extends ORMModel {
  static entity = 'users';

  static fields () {
    return {
      id: this.increment(null),
      name: this.attr(null),
      posts: this.hasMany(Post, 'userId'),
      comments: this.hasMany(Comment, 'userId')
    };
  }
}

class Post extends ORMModel {
  static entity = 'posts';
  static eagerLoad = ['comments'];

  static fields () {
    return {
      id: this.increment(null),
      content: this.attr(''),
      title: this.attr(''),
      userId: this.attr(null),
      otherId: this.attr(0), // This is a field which ends with `Id` but doesn't belong to any relation
      user: this.belongsTo(User, 'userId'),
      comments: this.hasMany(Comment, 'userId')
    };
  }
}


class Comment extends ORMModel {
  static entity = 'comments';

  static fields () {
    return {
      id: this.increment(null),
      content: this.attr(''),
      userId: this.attr(null),
      postId: this.attr(null),
      user: this.belongsTo(User, 'userId'),
      post: this.belongsTo(Post, 'postId')
    };
  }
}

describe('VuexORMApollo', () => {
  beforeEach(() => {
    [store, vuexOrmApollo] = createStore([{ model: User }, { model: Post }, { model: Comment }]);

    store.dispatch('entities/users/insert', { data: { id: 1, name: 'Charlie Brown' }});
    store.dispatch('entities/users/insert', { data: { id: 2, name: 'Peppermint Patty' }});
    store.dispatch('entities/posts/insert', { data: { id: 1, userId: 1, title: 'Example post 1', content: 'Foo' }});
    store.dispatch('entities/posts/insert', { data: { id: 1, userId: 1, title: 'Example post 2', content: 'Bar' }});
    store.dispatch('entities/comments/insert', { data: { id: 1, userId: 1, postId: 1, content: 'Example comment 1' }});
    store.dispatch('entities/comments/insert', { data: { id: 1, userId: 2, postId: 1, content: 'Example comment 2' }});
  });

  describe('fetch', () => {
    it('also requests the otherId field', async () => {
      const response = {
        data: {
          post: {
            __typename: 'post',
            id: 1,
            otherId: 13548,
            title: 'Example Post 1',
            content: 'Foo',
            comments: {
              __typename: 'comment',
              nodes: []
            },
            user: {
              __typename: 'user',
              id: 1,
              name: 'Johnny Imba',
            }
          }
        }
      };

      let request = await sendWithMockFetch(response, async () => {
        await store.dispatch('entities/posts/fetch', { filter: { id: 1 } });
      });
      expect(request).not.toEqual(null);

      expect(request.query).toEqual(`
query Post($id: ID!) {
  post(id: $id) {
    id
    content
    title
    otherId
    user {
      id
      name
      __typename
    }
    comments {
      nodes {
        id
        content
        __typename
      }
      __typename
    }
    __typename
  }
}
        `.trim() + "\n");
    });


    describe('with ID', () => {
      it("doesn't cache when bypassCache = true", async () => {
        const response = {
          data: {
            user: {
              __typename: 'user',
              id: 1,
              name: 'Johnny Imba'
            }
          }
        };

        let request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch', { filter: { id: 1 } });
        });
        expect(request).not.toEqual(null);

        request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch', { filter: { id: 1 } });
        }, true);
        expect(request).toEqual(null);

        request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch', { filter: { id: 1 }, bypassCache: true });
        });
        expect(request).not.toEqual(null);
      });

      it('sends the correct query to the API', async () => {
        const response = {
          data: {
            user: {
              __typename: 'user',
              id: 1,
              name: 'Johnny Imba'
            }
          }
        };

        const request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch', { filter: { id: 1 } });
        });

        expect(request.variables).toEqual({ id: 1 });
        expect(request.query).toEqual(`
query User($id: ID!) {
  user(id: $id) {
    id
    name
    __typename
  }
}
        `.trim() + "\n");
      });
    });

    describe('without ID but with filter', () => {
      it('sends the correct query to the API', async () => {
        const response = {
          data: {
            users: {
              __typename: 'user',
              nodes: [
                {
                  __typename: 'user',
                  id: 1,
                  name: 'Charlie Brown'
                }
              ]
            }
          }
        };

        const request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch', { filter: { active: true } });
        });

        expect(request.variables).toEqual({ active: true });
        expect(request.query).toEqual(`
query Users($active: Boolean!) {
  users(filter: {active: $active}) {
    nodes {
      id
      name
      __typename
    }
    __typename
  }
}
          `.trim() + "\n");
      });
    });

    describe('without ID or filter', () => {
      it('sends the correct query to the API', async () => {
        const response = {
          data: {
            users: {
              __typename: 'user',
              nodes: [
                {
                  __typename: 'user',
                  id: 1,
                  name: 'Charlie Brown'
                }
              ]
            }
          }
        };

        const request = await sendWithMockFetch(response, async () => {
          await store.dispatch('entities/users/fetch');
        });

        expect(request.variables).toEqual({});
        expect(request.query).toEqual(`
query Users {
  users {
    nodes {
      id
      name
      __typename
    }
    __typename
  }
}
          `.trim() + "\n");
      });
    });
  });


  describe('persist', () => {
    it('sends the correct query to the API', async () => {
      const response = {
        data: {
          createUser: {
            __typename: 'user',
            id: 1,
            name: 'Charlie Brown'
          }
        }
      };

      const request = await sendWithMockFetch(response, async () => {
        await store.dispatch('entities/users/persist', { id: 1 });
      });

      expect(request.variables).toEqual({ user: { name: 'Charlie Brown' } });
      expect(request.query).toEqual(`
mutation CreateUser($user: UserInput!) {
  createUser(user: $user) {
    id
    name
    __typename
  }
}
      `.trim() + "\n");
    });
  });


  describe('push', () => {
    it('sends the correct query to the API', async () => {
      const response = {
        data: {
          updateUser: {
            __typename: 'user',
            id: 1,
            name: 'Snoopy'
          }
        }
      };

      const request = await sendWithMockFetch(response, async () => {
        const user = store.getters['entities/users/find'](1);
        user.name = 'Snoopy';

        await store.dispatch('entities/users/push', { data: user });
      });

      expect(request.variables).toEqual({ id: 1, user: { name: 'Snoopy' } });
      expect(request.query).toEqual(`
mutation UpdateUser($id: ID!, $user: UserInput!) {
  updateUser(id: $id, user: $user) {
    id
    name
    __typename
  }
}
      `.trim() + "\n");
    });
  });


  describe('destroy', () => {
    it('sends the correct query to the API', async () => {
      const response = {
        data: {
          deleteUser: {
            __typename: 'user',
            id: 1,
            name: 'Charlie Brown'
          }
        }
      };

      const request = await sendWithMockFetch(response, async () => {
        await store.dispatch('entities/users/destroy', { id: 1 });
      });

      expect(request.variables).toEqual({ id: 1 });
      expect(request.query).toEqual(`
mutation DeleteUser($id: ID!) {
  deleteUser(id: $id) {
    id
    name
    __typename
  }
}
      `.trim() + "\n");
    });
  });


  describe('customMutation', () => {
    it('sends the correct query to the API', async () => {
      const user = store.getters['entities/users/find'](1);
      const response = {
        data: {
          signupUser: {
            __typename: 'user',
            id: 1,
            name: 'Charlie Brown'
          }
        }
      };

      const request = await sendWithMockFetch(response, async () => {
        await store.dispatch('entities/users/mutate', { mutation: 'signupUser', user, captchaToken: '15' });
      });

      expect(request.variables.captchaToken).toEqual('15');
      expect(request.variables.user.name).toEqual(user.name);
      expect(request.query).toEqual(`
mutation SignupUser($user: UserInput!, $captchaToken: String!) {
  signupUser(user: $user, captchaToken: $captchaToken) {
    id
    name
    __typename
  }
}
      `.trim() + "\n");
    });
  });
});
