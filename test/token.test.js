process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const oada = require("../src/index");
const chai = require("chai");
var expect = chai.expect;
const status = require("http-status");
const { domain } = require("./config");
let connectTime = 30 * 1000; // seconds to click through oauth
let nTests = 5;
const _ = require("lodash");
let expiredConnections = new Array(10);
oada.setDbPrefix("./test/test-data/");

let connectionParameters = {
  domain,
  options: {
    redirect: "http://localhost:8000/oauth2/redirect.html",
    metadata:
      "eyJqa3UiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbS9jZXJ0cyIsImtpZCI6ImtqY1NjamMzMmR3SlhYTEpEczNyMTI0c2ExIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJyZWRpcmVjdF91cmlzIjpbImh0dHA6Ly92aXAzLmVjbi5wdXJkdWUuZWR1OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiLCJodHRwOi8vbG9jYWxob3N0OjgwMDAvb2F1dGgyL3JlZGlyZWN0Lmh0bWwiXSwidG9rZW5fZW5kcG9pbnRfYXV0aF9tZXRob2QiOiJ1cm46aWV0ZjpwYXJhbXM6b2F1dGg6Y2xpZW50LWFzc2VydGlvbi10eXBlOmp3dC1iZWFyZXIiLCJncmFudF90eXBlcyI6WyJpbXBsaWNpdCJdLCJyZXNwb25zZV90eXBlcyI6WyJ0b2tlbiIsImlkX3Rva2VuIiwiaWRfdG9rZW4gdG9rZW4iXSwiY2xpZW50X25hbWUiOiJPcGVuQVRLIiwiY2xpZW50X3VyaSI6Imh0dHBzOi8vdmlwMy5lY24ucHVyZHVlLmVkdSIsImNvbnRhY3RzIjpbIlNhbSBOb2VsIDxzYW5vZWxAcHVyZHVlLmVkdT4iXSwic29mdHdhcmVfaWQiOiIxZjc4NDc3Zi0zNTQxLTQxM2ItOTdiNi04NjQ0YjRhZjViYjgiLCJyZWdpc3RyYXRpb25fcHJvdmlkZXIiOiJodHRwczovL2lkZW50aXR5Lm9hZGEtZGV2LmNvbSIsImlhdCI6MTUxMjAwNjc2MX0.AJSjNlWX8UKfVh-h1ebCe0MEGqKzArNJ6x0nmta0oFMcWMyR6Cn2saR-oHvU8WrtUMEr-w020mAjvhfYav4EdT3GOGtaFgnbVkIs73iIMtr8Z-Y6mDEzqRzNzVRMLghj7CyWRCNJEk0jwWjOuC8FH4UsfHmtw3ouMFomjwsNLY0",
    scope: "oada.yield:all",
  },
};

let expiredTokens = [
  "vxQyUQYUT0E5akXN_3LEoaPWtChJzeFNItEFgjA0",
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
];

// describe("~~~~Testing with expired tokens -> PUTs ~~~~~~~", async function() {
//   this.timeout(connectTime);
//   for (let i = 0; i < nTests; i++) {
//     before(
//       "Make the connection with a valid but expired token. Cache + websockets enabled.",
//       async function() {
//         expiredConnections[i] = await oada.connect({
//           domain,
//           options: connectionParameters.options,
//           token: expiredTokens[i],
//         });
//       },
//     );
//   } //for

//   for (let i = 0; i < nTests; i++) {
//     it(`Token [${i}]. Should create/put a resource after renewing the token.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].put({
//         path: `/bookmarks/test/test${i}/sometest`,
//         data: { _type: "application/json" },
//       });
//       expect(response.status).to.equal(status.NO_CONTENT);
//     });
//   } //for

//   for (let i = 0; i < nTests; i++) {
//     it(`Token [${i}]. Should not renew token for the subsequent PUTs.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].put({
//         path: `/bookmarks/test/test${i}/secondput${i}`,
//         data: { _type: "application/json" },
//       });
//       expect(response.status).to.equal(status.NO_CONTENT);
//     });
//   } //for

//   for (let i = 0; i < nTests; i++) {
//     it(`Token [${i}]. Should not renew token for the GETs.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].get({
//         path: `/bookmarks/test/test${i}`,
//       });
//       expect(response.status).to.equal(status.OK);
//     });
//   } //for

//   for (let i = 0; i < nTests; i++) {
//     it(`Token [${i}]. Should not renew token for the DELs.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].delete({
//         path: `/bookmarks/test/test${i}`,
//       });
//       expect(response.status).to.equal(status.NO_CONTENT);
//     });
//   } //for
// });

// describe("~~~~Testing with expired tokens -> GETs ~~~~~~~", async function() {
//   this.timeout(connectTime);
//   for (let i = nTests; i < 2 * nTests; i++) {
//     before(
//       "Make the connection with a valid but expired token. Cache + websockets enabled.",
//       async function() {
//         expiredConnections[i] = await oada.connect({
//           domain,
//           options: connectionParameters.options,
//           token: expiredTokens[i],
//         });
//       },
//     );
//   } //for

//   for (let i = nTests; i < 2 * nTests; i++) {
//     it(`Token [${i}]. Should GET a resource after renewing the token.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].get({
//         path: `/bookmarks/test`,
//       });
//       expect(response.status).to.equal(status.OK);
//     });
//   } //for

//   for (let i = nTests; i < 2 * nTests; i++) {
//     it(`Token [${i}]. Should not renew token for the subsequent GETs.`, async function() {
//       this.timeout(connectTime);
//       var response = await expiredConnections[i].get({
//         path: `/bookmarks/test`,
//       });
//       expect(response.status).to.equal(status.OK);
//     });
//   } //for
// });
