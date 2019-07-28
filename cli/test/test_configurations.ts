/* eslint-env mocha */

import * as chai from "chai";
import * as fs from "fs";
import * as tmp from "tmp";
chai.should();

import { Configurations, copy, load, merge } from "../src/configurations";

describe("#Configurations", () => {
  describe("#load", () => {
    it("load the file", async () => {
      const tmpFile = tmp.fileSync();
      fs.writeFileSync(tmpFile.name, '{"foo": "bar"}');
      const c = await load(tmpFile.name);
      c.should.deep.equal({ foo: "bar" });
    });
    it("return {} if the file does not exist", async () => {
      const tmpFile = tmp.fileSync();
      fs.unlinkSync(tmpFile.name);
      const c = await load(tmpFile.name);
      c.should.deep.equal({});
    });
  });
  describe("#copy", () => {
    it("deep copy the configuration", () => {
      const orig = { primitive: 10, object: { test: false }, array: [10, 20] };
      const c1 = { primitive: 10, object: { test: false }, array: [10, 20] };
      const c2: Configurations = copy(c1);
      c2.should.deep.equal(c1);

      c2.primitive = 20;
      c2.object.test = true;
      c2.array.push(30);
      c1.should.deep.equal(orig);
      c2.should.deep.equal({
        primitive: 20,
        object: { test: true },
        array: [10, 20, 30]
      });
    });
  });
  describe("#merge", () => {
    it("merge two configurations", () => {
      merge({ c1: 10 }, { c2: "c2" }).should.deep.equal({ c1: 10, c2: "c2" });
    });
    it("use later configuration when conflict happens", () => {
      merge({ c: 10 }, { c: "c2" }).should.deep.equal({ c: "c2" });
      merge({ c: { k1: 10 } }, { c: { k2: 20 } }).should.deep.equal({
        c: { k1: 10, k2: 20 }
      });
    });
    it("handle arrays properly", () => {
      merge([], [1, 2, 3]).should.deep.equal([1, 2, 3]);
    });
  });
});
