process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const _ = require("lodash");
const oada = require("../src/index.js");
process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
const uuid = require("uuid");
const chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
const axios = require("axios");
const { token, domain } = require("./config");
const { tree, putResource, getConnections } = require("./utils.js");
const { performance } = require("perf_hooks");
console.log(oada);
oada.setDbPrefix("./test/test-data/");

const timer = ms => new Promise(res => setTimeout(res, ms));

const cleanMemoryTimer = 11000;
const dbPutDelay = 6000;
var connection;

describe(`In-memory Cache`, async function() {

  this.timeout(30000);
  describe(`GET`, async function() {
    before(`Create connection`, async function() {
      try {
        connection = await oada.connect({
          domain,
          token,
        });
      } catch (err) {
        console.log(err)
      }
    });

    it(`Should get a resource from server`, async function() {
      var response = await connection.get({
        path: "/resources/default:resources_bookmarks_321",
      });
      expect(response.data).to.include.keys(["_id", "_rev", "_type", "_meta"]);
    });

    it(`In-memory cache should contain one entry`, async function() {
      expect(connection._getMemoryCache()).to.have.property(
        "resources/default:resources_bookmarks_321"
      );
    });

    it(`Should wait ${cleanMemoryTimer} ms`, async function() {
      await timer(cleanMemoryTimer);
    });

    it(`In-memory cache should be empty`, async function() {
      console.log(connection._getMemoryCache())
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
        "resources/default:resources_bookmarks_321"
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
        token,
      });
    });

    it(`Should create a resource`, async function() {
      var response = await connection.put({
        path: "/bookmarks/test",
        data: { sometest: 123 },
        tree,
      });
      expect(response.status.toString().charAt(0)).to.equal('2');
      expect(response.headers).to.include.keys([
        "content-location",
        "x-oada-rev",
      ]);
    });

    it(`The resource should be waiting for PUT`, async function() {
      var data = connection._getMemoryCache();
      expect(data[Object.keys(data)[0]]).to.include.keys(["promise"]);
    });

    it(`The resource should NOT be waiting for PUT`, async function() {
      await timer(dbPutDelay);
      var data = connection._getMemoryCache();
      expect(data[Object.keys(data)[0]].putPending).to.be.false;
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
