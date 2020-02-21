process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const { token, domain } = require("./config.js");
const oada = require("../src/index");
const chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
oada.setDbPrefix("./test/test-data/");

let connections = new Array(4);
let connectTime = 30 * 1000; // seconds to click through oauth

describe("~~~~~~ CONNECTIONS~~~~~~~", function() {
  this.timeout(connectTime);

  it("Should connect with metadata. Browser popup must be used to login within 30s.", async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
			domain,
			options: {
				redirect: "http://localhost:8000/oauth2/redirect.html",
				metadata:
					"eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0",
				scope: "oada.yield:all"
			},
			cache: false
		})
		expect(result).to.include.keys([
			"token",
			"cache",
			"websocket",
			"disconnect",
			"reconnect",
			"get",
			"put",
			"post",
			"delete",
			"resetCache",
//      "_getMemoryCache",
		]);
		expect(result.cache).to.equal(false);
		expect(result.websocket).to.be.a("object");
		expect(result.get).to.be.a("function");
		expect(result.put).to.be.a("function");
		expect(result.post).to.be.a("function");
		expect(result.resetCache).to.be.a("function");
		expect(result.disconnect).to.be.a("function");
  });

  it("Should make a connection with websocket and cache", async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
      domain,
      token,
    })
    connections[0] = result;
    expect(result).to.include.keys([
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
    expect(result.cache).to.be.a("object");
    expect(result.websocket).to.be.a("object");
    expect(result.get).to.be.a("function");
    expect(result.put).to.be.a("function");
    expect(result.post).to.be.a("function");
    expect(result.resetCache).to.be.a("function");
    expect(result.disconnect).to.be.a("function");
  });

  it("Should make a connection with websocket off, cache on", async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
			domain,
			token,
			websocket: false
		})
		connections[1] = result;
		expect(result).to.include.keys([
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
    expect(result.cache).to.be.a("object");
    expect(result.websocket).to.equal(false);
    expect(result.get).to.be.a("function");
    expect(result.put).to.be.a("function");
    expect(result.post).to.be.a("function");
    expect(result.resetCache).to.be.a("function");
    expect(result.disconnect).to.be.a("function");
  });

  it("Should make a connection with websocket on, cache off", async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
			domain,
			token: "def",
			cache: false
		})
		connections[2] = result;
		expect(result).to.include.keys([
			"token",
			"disconnect",
			"get",
			"put",
			"post",
			"reconnect",
			"delete",
			"resetCache",
			"cache",
			"websocket",
      "_getMemoryCache",
		]);
		expect(result.cache).to.equal(false);
		expect(result.websocket).to.be.a("object");
		expect(result.get).to.be.a("function");
		expect(result.put).to.be.a("function");
		expect(result.post).to.be.a("function");
		expect(result.resetCache).to.be.a("function");
		expect(result.disconnect).to.be.a("function");
  });
  it("Should make a connection with websocket off, cache off", async function() {
    this.timeout(connectTime);
    var result = await oada.connect({
			domain,
			token: "def",
			websocket: false,
			cache: false
		})
		connections[3] = result;
		expect(result).to.include.keys([
			"token",
			"cache",
			"websocket",
      "_getMemoryCache",
			"disconnect",
			"get",
			"reconnect",
			"put",
			"post",
			"delete",
			"resetCache"
		]);
		expect(result.cache).to.equal(false);
		expect(result.websocket).to.equal(false);
		expect(result.get).to.be.a("function");
		expect(result.put).to.be.a("function");
		expect(result.post).to.be.a("function");
		expect(result.resetCache).to.be.a("function");
		expect(result.disconnect).to.be.a("function");
  });

  it("Should not make a connection without domain", async function() {
    this.timeout(connectTime);
    expect(
      oada.connect({
        token: "def",
        websocket: false,
        cache: false,
      })
    ).to.be.rejectedWith(Error, "domain undefined");
  });

  it("Should not make a connection without options and token", async function() {
    this.timeout(connectTime);
    await expect(
      oada.connect({
        domain,
        websocket: false,
        cache: false,
      })
    ).to.be.rejectedWith(Error, "options and token undefined");
  });

  it("Should not make a connection if token provided but not a string", async function() {
    this.timeout(connectTime);
    await expect(
      oada.connect({
        domain,
        token: { def: "def" },
        websocket: false,
        cache: false,
      })
    ).to.be.rejectedWith(Error, "token must be a string");
  });

  it("Should not make a connection if websocket provided but not a boolean", async function() {
    this.timeout(connectTime);
    await expect(
      oada.connect({
        domain,
        token: "def",
        websocket: "false",
      })
    ).to.be.rejectedWith(Error, "websocket must be boolean");
  });

  it("Should not make a connection if cache provided but not a boolean", async function() {
    this.timeout(connectTime);
    await expect(
      oada.connect({
        domain,
        token: "def",
        cache: "false",
      })
    ).to.be.rejectedWith(
      Error,
      `cache must be either a boolean or an object with 'name' and/or 'expires' keys`
    );
  });

  /**
   * disconnections
   */
  for (let i = 0; i < connections.length; i++) {
    describe(`Disconnecting connection ${i + 1}`, function() {
      it("Should disconnect", async () => {
        connections[i].disconnect();
      });
    });
  } //for
});
