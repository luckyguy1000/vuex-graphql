import Model from 'app/orm/model';
import { setupMockData, User, Video, Post, Comment, ContractContractOption, Contract, ContractOption } from 'test/support/mock-data';
import Context from "app/common/context";
import Action from "app/actions/action";

let store;
let vuexOrmApollo;
let context;

beforeEach(async () => {
  [store, vuexOrmApollo] = await setupMockData();
  context = Context.getInstance();
});

describe('Action', () => {
  describe('.getModelFromState', () => {
    it('returns the model', () => {
      expect(Action.getModelFromState({ $name: 'post' })).toEqual(context.getModel('post'));
    });
  });

  describe('.prepareArgs', () => {
    it('returns a args object without the id', () => {
      expect(Action.prepareArgs(undefined, 15)).toEqual({ id: 15 });
      expect(Action.prepareArgs({}, 42)).toEqual({ id: 42 });
    });

    it('returns a args object with the id', () => {
      expect(Action.prepareArgs(undefined)).toEqual({});
      expect(Action.prepareArgs({ test: 15 })).toEqual({ test: 15 });
    });
  });

  describe('.addRecordToArgs', () => {
    it('returns a args object with the record', () => {
      const model = context.getModel('post');
      const record = model.getRecordWithId(1);

      expect(Action.addRecordToArgs({test: 2}, model, record)).toEqual({
        post: {
          id: 1,
          content: 'Foo',
          otherId: 9,
          published: true,
          title: 'Example post 1',
          user: { id: 1, name: 'Charlie Brown'},
          userId: 1
        },

        test: 2
      });
    });
  });
});
