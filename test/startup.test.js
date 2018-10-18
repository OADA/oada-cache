process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
import oada from "../src/index";
import chai from "chai";
var expect = chai.expect;

let token = "def";
//let domain = "https://vip3.ecn.purdue.edu";
let domain = "https://localhost";
let connections = new Array(4);
let contentType = "application/vnd.oada.yield.1+json";
let connectTime = 30 * 1000; // seconds to click through oauth

const _ = require("lodash");
const config = require("./config.js");
const { cleanUp, getConnections } = require("./utils.js");

let connection;
var resources = [];
let tree = {
  bookmarks: {
    _type: "application/vnd.oada.bookmarks.1+json",
    _rev: "0-0",
    test: {
      _type: "application/vnd.oada.harvest.1+json",
      _rev: "0-0",
      aaa: {
        _type: "application/vnd.oada.as-harvested.1+json",
        _rev: "0-0",
        bbb: {
          _type:
            "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
          _rev: "0-0",
          "index-one": {
            "*": {
              _type:
                "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
              _rev: "0-0",
              "index-two": {
                "*": {
                  _type:
                    "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                  _rev: "0-0",
                  "index-three": {
                    "*": {
                      _type:
                        "application/vnd.oada.as-harvested.yield-moisture-dataset.1+json",
                      test: {}
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};

describe("~~~~~~ Testing Connect() -> Disconnect() -> Connect() ~~~~~~~", function() {
  it("Should make a connection with websocket and cache", function() {
    return oada
      .connect({
        domain,
        token: "def"
      })
      .then(result => {
        connections[0] = result;
        expect(result).to.have.keys([
          "token",
          "disconnect",
          "reconnect",
          "get",
          "put",
          "post",
          "delete",
          "resetCache",
          "cache",
          "websocket"
        ]);
        expect(result.cache).to.equal(true);
        expect(result.websocket).to.equal(true);
        expect(result.get).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.put).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.post).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.delete).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.resetCache).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.disconnect).to.satisfy(x => {
          return typeof x === "function";
        });
      });
  });

  describe(`Disconnecting connection 0`, function() {
    it("Should disconnect connection with websocket and cache", async () => {
      connections[0].disconnect();
    });
  });

  it("Should make a connection with websocket and cache", function() {
    return oada
      .connect({
        domain,
        token: "def"
      })
      .then(result => {
        connections[0] = result;
        expect(result).to.have.keys([
          "token",
          "disconnect",
          "reconnect",
          "get",
          "put",
          "post",
          "delete",
          "resetCache",
          "cache",
          "websocket"
        ]);
        expect(result.cache).to.equal(true);
        expect(result.websocket).to.equal(true);
        expect(result.get).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.put).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.post).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.delete).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.resetCache).to.satisfy(x => {
          return typeof x === "function";
        });
        expect(result.disconnect).to.satisfy(x => {
          return typeof x === "function";
        });
      });
  });
});

describe("~~~~connect() -> disconnect() -> connect() -> puts ~~~~~~~", () => {
  var connections;
  var conn;
  before(
    "First, make the connection. Cache + websockets enabled.",
    async function() {
      connection = await oada.connect({
        domain,
        token: "def"
      });
      conn = connection;
    }
  );

  before("Disconnecting - First time", function() {
    conn.disconnect();
  });

  before(
    "Second, make the connection. Cache + websockets enabled.",
    async function() {
      connection = await oada.connect({
        domain,
        token: "def"
      });
      conn = connection;
    }
  );

  it(`Should error when neither 'url' nor 'path' are supplied`, async function() {
    try {
      var response = await conn.put({
        data: `"123"`,
        tree,
        type: "application/json"
      });
    } catch (error) {
      expect(error.message).to.equal("Either path or url must be specified.");
    }
  });

  it(`Shouldn't error when 'data' contains a _type key.`, async function() {
    var response = await conn.put({
      path: "/bookmarks/testA/sometest",
      data: { _type: "application/json" }
    });
    expect(response.status).to.equal(204);
  });

  it(`Shouldn't error when 'type' is specified.`, async function() {
    var response = await conn.put({
      path: "/bookmarks/testA/somethingnew",
      data: `"abc123"`,
      type: "application/json"
    });
    expect(response.status).to.equal(204);
  });

  it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
    var response = await conn.put({
      path: "/bookmarks/testA/somethingnew",
      data: `"abc123"`,
      headers: { "Content-Type": "application/json" }
    });
    expect(response.status).to.equal(204);
  });

  it(`Shouldn't error when 'Content-Type' header (_type) can be derived from the 'tree'`, async function() {
    var response = await conn.put({
      path: "/bookmarks/test/aaa/bbb/sometest",
      tree,
      data: `"123"`
    });
    expect(response.status).to.equal(204);
  });

  it("Should provide the expected response status and headers when a tree is supplied.", async function() {
    var response = await conn.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123",
      type: "application/vnd.oada.as-harvested.yield-moisture.dataset.1+json",
      data: `"some test"`,
      tree
    });
    expect(response.status).to.equal(204);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
      "location"
    ]);
  });

  it("Should provide expected response status and headers when no tree is supplied.", async function() {
    var response = await conn.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123",
      type: "application/vnd.oada.as-harvested.yield-moisture.dataset.1+json",
      data: `"some test"`
    });
    expect(response.status).to.equal(204);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
      "location"
    ]);
  });

  it(`Should create the data PUT in the previous test.`, async function() {
    var response = await conn.get({
      path: "/bookmarks/test"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "aaa"]);
    expect(response.data.aaa).to.have.keys(["_id", "_rev"]);
    expect(response.data.aaa).to.not.include.keys(["bbb"]);
  });

  it("retrieving previous data: aaa", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "bbb"]);
    expect(response.data.bbb).to.have.keys(["_id", "_rev"]);
    expect(response.data.bbb).to.not.include.keys(["index-one"]);
  });

  it("retrieving previous data: bbb", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "index-one"]);
    expect(response.data["index-one"]).to.not.include.keys(["_id", "_rev"]);
    expect(response.data["index-one"]).to.include.keys(["ccc"]);
  });

  it("retrieving previous data: index-one", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.not.include.keys(["_id", "_rev"]);
    expect(response.data).to.include.keys(["ccc"]);
    expect(response.data.ccc).to.have.keys(["_id", "_rev"]);
  });

  it("retrieving previous data: ccc", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "index-two"]);
    expect(response.data["index-two"]).to.not.include.keys(["_id", "_rev"]);
  });

  it("retrieving previous data: index-two", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.not.include.keys(["_id", "_rev"]);
    expect(response.data).to.include.keys(["ddd"]);
    expect(response.data["ddd"]).to.have.keys(["_id", "_rev"]);
  });

  it("retrieving previous data: ddd", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "index-three"]);
    expect(response.data["index-three"]).to.not.include.keys(["_id", "_rev"]);
    expect(response.data["index-three"]).to.include.keys(["eee"]);
  });

  it("retrieving previous data: test", async function() {
    var response = await conn.get({
      path: "/bookmarks/test"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "aaa"]);
    expect(response.data.aaa).to.have.keys(["_id", "_rev"]);
    expect(response.data.aaa).to.not.include.keys(["bbb"]);
  });

  it("retrieving previous data: aaa", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "bbb"]);
    expect(response.data.bbb).to.have.keys(["_id", "_rev"]);
    expect(response.data.bbb).to.not.include.keys(["index-one"]);
  });

  it("retrieving previous data: bbb", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "index-one"]);
    expect(response.data["index-one"]).to.not.include.keys(["_id", "_rev"]);
    expect(response.data["index-one"]).to.include.keys(["ccc"]);
  });

  it("retrieving previous data: index-one", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.not.include.keys(["_id", "_rev"]);
    expect(response.data).to.include.keys(["ccc"]);
    expect(response.data.ccc).to.have.keys(["_id", "_rev"]);
  });

  it("retrieving previous data: ccc", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "index-two"]);
    expect(response.data["index-two"]).to.not.include.keys(["_id", "_rev"]);
  });

  it("Now clean up", () => {
    conn.resetCache();
    return cleanUp(resources, domain, token);
  });

  it(`Should use an _id specified via the 'tree'`, async function() {
    var newTree = _.cloneDeep(tree);
    newTree.bookmarks.test.aaa.sss = {
      _id: "resources/sssssssss",
      _type: "application/vnd.oada.yield.1+json",
      _rev: "0-0"
    };
    var putResponse = await conn.put({
      path: "/bookmarks/test/aaa/sss",
      tree: newTree,
      data: { anothertest: 123 }
    });
    var response = await conn.get({
      path: "/bookmarks/test/aaa/sss"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "anothertest"]);
    expect(response.data._id).to.equal("resources/sssssssss");
  });

  it(`Should use an _id specified via the 'data'`, async function() {
    var putResponse = await conn.put({
      path: "/bookmarks/test/aaa/bbb",
      tree: tree,
      data: { _id: "resources/foobar_foobar", sometest: 123 }
    });
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data).to.include.keys(["_id", "_rev", "sometest"]);
    expect(response.data._id).to.equal("resources/foobar_foobar");
    expect(response.data.sometest).to.equal(123);
  });

  it("Now clean up", () => {
    var conn = connection;
    conn.resetCache();
    return cleanUp(resources, domain, token);
  });

  it("Should make unversioned links where _rev is not specified on resources", async function() {
    var newTree = _.cloneDeep(tree);
    delete newTree.bookmarks.test.aaa.bbb._rev;

    var putResponse = await conn.put({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc/",
      tree: newTree,
      data: { anothertest: 123 }
    });
    var response = await conn.get({
      path: "/bookmarks/test/aaa"
    });
    expect(response.status).to.equal(200);
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev"
    ]);
    expect(response.data.bbb).to.include.keys(["_id"]);
    expect(response.data.bbb).to.not.include.keys(["_rev"]);
  });

  it("Now clean up", () => {
    var conn = connection;
    conn.resetCache();
    return cleanUp(resources, domain, token);
  });
});

describe("~~~~connect() -> disconnect() -> connect() -> disconnect() -> puts ~~~~~~~", () => {
  var connections;
  var conn;
  before(
    "First, make the connection. Cache + websockets enabled.",
    async function() {
      connection = await oada.connect({
        domain,
        token: "def"
      });
      conn = connection;
    }
  );

  before("Disconnecting - First time", function() {
    conn.disconnect();
  });

  before(
    "Second, make the connection. Cache + websockets enabled.",
    async function() {
      connection = await oada.connect({
        domain,
        token: "def"
      });
      conn = connection;
    }
  );

  before("Disconnecting - Second time", function() {
    conn.disconnect();
  });

  it(`Should error when there is no active connection and neither 'url' nor 'path' are supplied`, async function() {
    try {
      var response = await conn.put({
        data: `"123"`,
        tree,
        type: "application/json"
      });
    } catch (error) {
      expect(error.message).to.equal("Either path or url must be specified.");
    }
  });

  it(`Should error when there is no active connection and 'data' contains a _type key.`, async function() {
    try {
      var response = await conn.put({
        path: "/bookmarks/testA/sometest",
        data: { _type: "application/json" }
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it(`Should error when there is no active connection and 'type' is specified.`, async function() {
    try {
      var reposnse = await conn.put({
        path: "/bookmarks/testA/somethingnew",
        data: `"abc123"`,
        type: "application/json"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it(`Should error when there is no active connection and 'Content-Type' header is specified.`, async function() {
    try {
      var response = await conn.put({
        path: "/bookmarks/testA/somethingnew",
        data: `"abc123"`,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: aaa", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: bbb", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: index-one", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: ccc", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: index-two", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: ddd", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: eee", async function() {
    try {
      var response = await conn.get({
        path:
          "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: test", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: aaa", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: bbb", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: index-one", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: ccc", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: index-two", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Should not retrieve any data: ggg", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg"
      });
    } catch (error) {
      expect(error.message).to.equal(
        "WebSocket is not open: readyState 3 (CLOSED)"
      );
    }
  });

  it("Now clean up", () => {
    conn.resetCache();
    return cleanUp(resources, domain, token);
  });
});
