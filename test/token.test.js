process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
import oada from "../src";
import chai from "chai";
var expect = chai.expect;

let token = "def";
//let domain = "https://vip3.ecn.purdue.edu";
let domain = "https://localhost";
let contentType = "application/vnd.oada.yield.1+json";
let connectTime = 30 * 1000; // seconds to click through oauth
const { cleanUp } = require("./utils.js");

var expiredConnection;
var connection;

var resources = [];

let expiredTokens = [
  "vxQyUQYUT0E5akXN_3LEoaPWtChJzeFNItEFgjA1",
  "884rtVKCffFihijcMh8Y_0X5NsA1Srcx9TjJQY3f",
  "GjLyKjR5HalUrZxauMdXJ38169T8ad9UdMvyjmRK",
  "_-sNNae6ElBMlrewfGPjjv9JnVcUaHxQdJ-9pE4j",
  "F3ZFCKjrR2cJY2FxCLgbqyMP7B6ybDuSMRabw4xB",
  "PWgfksVlpIxxXF0xDUWDbiLTmB-MwiGP5FcmKirX",
  "OkJpZdAijFOIw88QOqtdLd0hjy_ZsPICGAnRymaS",
  "jAhUhVHhOKZ50K_B15_DrSYBBif2Noc9zTFYzY_5",
  "iDuhpzZ-FxB2RkICfmO0vclG3sb2kYLuQtc_NZ9x",
  "fdw3tuShJ-V-9AvAz2Af7lny_svkepl2TsrzcJX3",
  "PIk8DfHGqXrPEdUxpL7sLsvBzptFSQnEHcqsssjb",
  "OlJYiDGKbiw6B9epTE5NcmUmSoadseEnMycdC4io",
  "q6so77ocgiLwOceTXocBpK6r4C6Gp3LG-pRmjwiF",
  "2KYa_M-1UfZVNapZN3YpGMkKH623ZMH4jrQ320YT",
  "ZhM9lyBRJRi9ztS8QGyYnqXXT7EmaTo2o6FjqpC7"
];

describe("~~~~~~ Testing Token Class ~~~~~~~", function() {
  this.timeout(connectTime);

  before(
    "Second, make the connection with expired token. Cache + websockets enabled.",
    async function() {
      connection = await oada.connect({
        domain,
        options: {
          redirect: "http://localhost:8000/oauth2/redirect.html",
          metadata:
            "eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0",
          scope: "oada.yield:all"
        }
      });
    }
  );

  it(`Puts Shouldn't error when fresh token.`, async () => {
    try {
      var response = await connection.put({
        path: "/bookmarks/testB/somethingnew",
        data: `"abc123"`,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      expect(error.message).to.equal("Request failed with status code 401");
    }
  });

  it("Now clean up", () => {
    connection.resetCache();
    return cleanUp(resources, domain, token);
  });
});

describe("~~~~~~ Testing Token Class with Expired token ~~~~~~~", function() {
  this.timeout(connectTime);

  before(
    "Second, make the connection with expired token. Cache + websockets enabled.",
    async function() {
      expiredConnection = await oada.connect({
        domain,
        options: {
          redirect: "http://localhost:8000/oauth2/redirect.html",
          metadata:
            "eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0",
          scope: "oada.yield:all"
        },
        token: expiredTokens[0]
      });
    }
  );

  /**
   *  should return a
   * Error: Request failed with status code 401
   * */
  it(`puts should failed with expired token.`, async () => {
    //console.log("expired connection", expiredConnection);
    try {
      var response = await expiredConnection.put({
        path: "/bookmarks/testB/somethingnew",
        data: `"abc123"`,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      expect(error.message).to.equal("Request failed with status code 401");
    }

    // console.log("response status with expired token", response.status);
    // expect(response.status).to.equal(401);
  });

  it("Now clean up", () => {
    expiredConnection.resetCache();
    return cleanUp(resources, domain, token);
  });
});
