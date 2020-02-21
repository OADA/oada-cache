process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const oada = require("../src/index");
const chai = require("chai");
var expect = chai.expect;
const status = require("http-status");
oada.setDbPrefix("./test/test-data/");

const { token, domain } = require("./config.js");
let connections = new Array(4);
let contentType = "application/vnd.oada.yield.1+json";
let connectTime = 30 * 1000; // seconds to click through oauth
let nTests = 5;

const _ = require("lodash");
const config = require("./config.js");
const { tree, getConnections } = require("./utils.js");

let connection;

let connectionParameters = {
  domain,
  options: {
    redirect: "http://localhost:8000/oauth2/redirect.html",
    metadata:
      "eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0",
    scope: "oada.yield:all",
  },
};

describe("~~~~~~ Testing Connect() -> Disconnect() -> Connect() ~~~~~~~", function() {
  it("#1 - Should make a connection with websocket and cache", async function() {
    this.timeout(connectTime);
    connections[0] = await oada.connect({
      domain,
      token: "def",
      options: connectionParameters.options,
    });
    expect(connections[0]).to.contain.all.keys([
      "token",
      "disconnect",
      "reconnect",
      "get",
      "put",
      "post",
      "delete",
      "resetCache",
      "cache",
      "websocket",
      "_getMemoryCache",
    ]);
    expect(connections[0].cache).to.be.an("object");
    expect(connections[0].websocket).to.be.an("object");
    expect(connections[0].get).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].put).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].post).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].delete).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].resetCache).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].disconnect).to.satisfy(member => {
      return typeof member === "function";
    });
  });

  describe(`Disconnecting connection 0`, function() {
    it("Should disconnect connection with websocket and cache", async () => {
      connections[0].disconnect();
    });
  });

/*
  it("#2 - Should make a connection with websocket and cache", async function() {
    this.timeout(connectTime);
    connections[0] = await oada.connect({
      domain,
      token: "def",
      options: connectionParameters.options,
    });
    expect(connections[0]).to.contain.all.keys([
      "token",
      "disconnect",
      "reconnect",
      "get",
      "put",
      "post",
      "delete",
      "resetCache",
      "cache",
      "websocket",
      "_getMemoryCache",
    ]);
    expect(connections[0].cache).to.be.an("object");
    expect(connections[0].websocket).to.be.an("object");
    expect(connections[0].get).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].put).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].post).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].delete).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].resetCache).to.satisfy(member => {
      return typeof member === "function";
    });
    expect(connections[0].disconnect).to.satisfy(member => {
      return typeof member === "function";
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
        token: "def",
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
        token: "def",
      });
      conn = connection;
    }
  );

  it(`Should error when neither 'url' nor 'path' are supplied`, async function() {
    try {
      var response = await conn.put({
        data: `"123"`,
        tree,
        type: "application/json",
      });
    } catch (error) {
      expect(error.message).to.equal("Either path or url must be specified.");
    }
  });

  it(`Shouldn't error when 'data' contains a _type key.`, async function() {
    try {
      var response = await conn.put({
        path: "/bookmarks/testA/sometest",
        data: { _type: "application/json" },
      });
      expect(response.status).to.equal(status.NO_CONTENT);
    } catch (error) {
      console.log("data _type", error);
    }
  });

  it(`Shouldn't error when 'type' is specified.`, async function() {
    var response = await conn.put({
      path: "/bookmarks/testA/somethingnew",
      data: `"abc123"`,
      type: "application/json",
    });
    expect(response.status).to.equal(status.NO_CONTENT);
  });

  it(`Shouldn't error when 'Content-Type' header is specified.`, async function() {
    var response = await conn.put({
      path: "/bookmarks/testA/somethingnew",
      data: `"abc123"`,
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status).to.equal(status.NO_CONTENT);
  });

  it("Should provide expected response status and headers when no tree is supplied.", async function() {
    var response = await conn.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123",
      type: "application/json",
      data: `"some test"`,
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
      "location",
    ]);
  });

  it(`Should create the data PUT in the previous test.`, async function() {
    var response = await conn.get({
      path: "/bookmarks/test",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: aaa", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: bbb", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: index-one", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: ccc", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: index-two", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: ddd", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: test", async function() {
    var response = await conn.get({
      path: "/bookmarks/test",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: aaa", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: bbb", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: index-one", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });

  it("retrieving previous data: ccc", async function() {
    var response = await conn.get({
      path: "/bookmarks/test/aaa/bbb/index-one/ccc",
    });
    expect(response.status.toString().charAt(0)).to.equal('2');
    expect(response.headers).to.include.keys([
      "content-location",
      "x-oada-rev",
    ]);
  });*/

  /*
  it("Should set watches on previous data: /bookmarks/test", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test",
        watch: payload => {
          console.log("handling watch valid", payload);
        } // handleWatch("exists")
      });
      expect(response.status).to.equal(status.OK);
      expect(response.headers).to.include.keys([
        "content-location",
        "x-oada-rev",
      ]);
    } catch (error) {
      console.log("Catch error", error);
    }
  });

  it("Should fail setting watches on non existent data: yyy", async function() {
    try {
      var response = await conn.get({
        path: "/bookmarks/test/aaa/bbb/index-one/yyy",
        watch: payload => {
          console.log("handlinng watch invalid", payload);
        }, // handleWatch("exists")//handleWatch("does not exist")
        //Possible EventEmitter memory leak detected. 11 destroyed listeners added.
      });
    } catch (error) {
      // console.log("error watching non existent", error.message);
      // expect(error.message).to.equal("Request failed with status code 404");
    }
  });

  it("Now clean up", async function() {
    await conn.resetCache();
    await conn.delete({ path: "/bookmarks/test", tree });
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
        token: "def",
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
        token: "def",
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
        type: "application/json",
      });
    } catch (error) {
      expect(error.message).to.equal("Either path or url must be specified.");
    }
  });

  // it(`Should error when there is no active connection and 'data' contains a _type key.`, async function() {
  //   try {
  //     var response = await conn.put({
  //       path: "/bookmarks/testA/sometest",
  //       data: { _type: "application/json" }
  //     });
  //   } catch (error) {
  //     expect(error.message).to.include("WebSocket is not open");
  //   }
  // });

  // it(`Should error when there is no active connection and 'type' is specified.`, async function() {
  //   try {
  //     var reposnse = await conn.put({
  //       path: "/bookmarks/testA/somethingnew",
  //       data: `"abc123"`,
  //       type: "application/json"
  //     });
  //   } catch (error) {
  //     expect(error.message).to.equal(
  //       "WebSocket is not open: readyState 3 (CLOSED)"
  //     );
  //   }
  // });

  // it(`Should error when there is no active connection and 'Content-Type' header is specified.`, async function() {
  //   try {
  //     var response = await conn.put({
  //       path: "/bookmarks/testA/somethingnew",
  //       data: `"abc123"`,
  //       headers: { "Content-Type": "application/json" }
  //     });
  //   } catch (error) {
  //     expect(error.message).to.equal(
  //       "WebSocket is not open: readyState 3 (CLOSED)"
  //     );
  //   }
  // });

  // it("Should not retrieve any data: aaa", async function() {
  //   try {
  //     var response = await conn.get({
  //       path: "/bookmarks/test/aaa"
  //     });
  //   } catch (error) {
  //     expect(error.message).to.equal(
  //       "WebSocket is not open: readyState 3 (CLOSED)"
  //     );
  //   }
  // });

  // it("Should not retrieve any data: bbb", async function() {
  //   try {
  //     var response = await conn.get({
  //       path: "/bookmarks/test/aaa/bbb"
  //     });
  //   } catch (error) {
  //     expect(error.message).to.equal(
  //       "WebSocket is not open: readyState 3 (CLOSED)"
  //     );
  //   }
  // });
  //});
  */
});

//   /* ----------------------------------------------------------------------------------- */
//   it("Should not set any watches on previous data: ccc when disconnected", async function() {
//     try {
//       var response = await conn.get({
//         path: "/bookmarks/test/aaa/bbb/index-one/ccc",
//         watch: handleWath
//       });
//     } catch (error) {
//       //expect(error.message).to.include("WebSocket is not open");
//       expect(error.message).to.include("Cannot read property"); //ok, but error is not related to the websocket
//     }
//   });
// });

//   /* ----------------------------------------------------------------------------------- */
//   it("Should fail setting watches on non existent data: yyy and disconnected", async function() {
//     try {
//       var response = await conn.get({
//         path: "/bookmarks/test/aaa/bbb/index-one/yyy",
//         watch: handleWath
//       });
//     } catch (error) {
//       expect(error.message).to.include("WebSocket is not open");
//     }
//   });

//   it("Now clean up", () => {
//     conn.resetCache();
//     await conn.delete({path: '/bookmarks/test', tree})
//   });
// });
