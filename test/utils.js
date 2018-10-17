const oada = require("../build/index.js").default;
const axios = require("axios");

async function getConnections({ domain, options, token }) {
  var yy = await oada.connect({
    domain,
    options,
    token
  });

  var yn = await oada.connect({
    domain,
    options,
    token,
    websocket: false
  });
  var ny = await oada.connect({
    domain,
    options,
    token,
    cache: false
  });

  var nn = await oada.connect({
    domain,
    options,
    token,
    websocket: false,
    cache: false
  });
  return [nn, yn, ny, yy];
}

async function cleanUp(resources, domain, token) {
  // Delete resources
  resources.forEach(async function(res) {
    await axios({
      method: "delete",
      url: domain + res,
      headers: {
        Authorization: "Bearer " + token
      }
    });
  });
  // Delete link
  await axios({
    method: "delete",
    url: domain + "/bookmarks/test",
    headers: {
      Authorization: "Bearer " + token
    }
  });
}

var tree = {
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

module.exports = {
  getConnections,
  cleanUp,
  tree
};
