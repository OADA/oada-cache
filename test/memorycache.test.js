const _ = require("lodash");
const oada = require("../build/index.js").default;
const uuid = require("uuid");
const chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
const axios = require("axios");
const { token, domain } = require("./config");
const { tree, putResource, getConnections } = require("./utils.js");
const { performance } = require("perf_hooks");

const timer = ms => new Promise(res => setTimeout(res, ms));

const cleanMemoryTimer = 11000;
const dbPutDelay = 6000;

describe(`In-memory Cache`, async function() {
  this.timeout(30000);
  describe(`GET`, async function() {
    var connection;
    before(`Create connection`, async function() {
      connection = await oada.connect({
        domain,
        token: "def",
      });
    });

    it(`Should get a resource from server`, async function() {
      var response = await connection.get({
        path: "/resources/default:resources_bookmarks_321",
      });
      expect(response.data).to.include.keys(["_id", "_rev", "_type", "_meta"]);
    });

    it(`In-memory cache should contain one entry`, async function() {
      expect(connection._getMemoryCache()).to.have.property(
        "resources/default:resources_bookmarks_321",
      );
    });

    it(`Should wait ${cleanMemoryTimer} ms`, async function() {
      await timer(cleanMemoryTimer);
    });

    it(`In-memory cache should be empty`, async function() {
      expect(connection._getMemoryCache()).to.be.empty;
    });

    it(`Should get a resource from PouchDB`, async function() {
      var response = await connection.get({
        path: "/resources/default:resources_bookmarks_321",
      });
      expect(response.data).to.include.keys(["_id", "_rev", "_type", "_meta"]);
    });

    it(`In-memory cache should contain one entry`, async function() {
      expect(connection._getMemoryCache()).to.have.property(
        "resources/default:resources_bookmarks_321",
      );
    });

    it(`Should get a resource from im-memory cache`, async function() {
      var response = await connection.get({
        path: "/resources/default:resources_bookmarks_321",
      });
      expect(response.data).to.include.keys(["_id", "_rev", "_type", "_meta"]);
    });

    after(`Close connection`, async function() {
      await timer(cleanMemoryTimer);
      connection.disconnect();
    });
  });

  describe(`PUT`, async function() {
    var connection;
    before(`Create connection`, async function() {
      connection = await oada.connect({
        domain,
        token: "def",
      });
    });

    const timer = ms => new Promise(res => setTimeout(res, ms));

    it(`Should create a resource`, async function() {
      var response = await connection.put({
        path: "/bookmarks/test",
        data: { sometest: 123 },
        tree,
      });
      expect(response.status).to.equal(204);
      expect(response.headers).to.include.keys([
        "content-location",
        "x-oada-rev",
        "location",
      ]);
    });

    it(`The resource should be waiting for PUT`, async function() {
      var data = connection._getMemoryCache();
      expect(data[Object.keys(data)[0]]).to.include.keys(["promise"]);
    });

    it(`The resource should NOT be waiting for PUT`, async function() {
      await timer(dbPutDelay);
      var data = connection._getMemoryCache();
      expect(data[Object.keys(data)[0]]).to.not.include.keys(["promise"]);
    });

    it(`In-memory cache should be empty`, async function() {
      await timer(cleanMemoryTimer);
      expect(connection._getMemoryCache()).to.be.empty;
    });

    after(`Close connection`, async function() {
      connection.disconnect();
    });
  });
});