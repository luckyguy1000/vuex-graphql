import { Post, setupMockData, Tariff, User } from "../../support/mock-data";
import { Data } from "../../../src/support/interfaces";

let store: any;
let vuexOrmGraphQL;

describe("Has Many Through", async () => {
  beforeEach(async () => {
    [store, vuexOrmGraphQL] = await setupMockData();
  });

  test("works", async () => {
    // @ts-ignore
    await Tariff.fetch();

    const tariff: Data = Tariff.query()
      .withAllRecursive()
      .find(1)! as Data;
    expect(tariff.name).toEqual("Super DSL S");
    expect(tariff.tariffOptions).not.toEqual(null);
    expect(tariff.tariffOptions.length).not.toEqual(0);
    expect(tariff.tariffOptions[0].name).toEqual("Installation");
    expect(tariff.tariffOptions[0].tariffs).not.toEqual(null);
    expect(tariff.tariffOptions[0].tariffs[0].name).toEqual("Super DSL S");
  });
});
