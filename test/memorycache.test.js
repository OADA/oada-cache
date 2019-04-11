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

var connection;
var resources = [];

describe(`In-memory Cache`, async function() {
  describe(`GET`, async function() {
    before(`Create connection`, async function() {
      connection = await oada.connect({
        domain,
        token: "def",
      });
    });

    const timer = ms => new Promise(res => setTimeout(res, ms));

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

    it(`Should wait 20000 ms`, async function() {
      this.timeout(30000);
      await timer(20000);
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

    it(`Should close the connection gracefully`, async function() {
      connection.disconnect();
    });
  });
});
