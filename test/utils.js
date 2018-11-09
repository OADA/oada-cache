<<<<<<< HEAD
const oada = require('../build/index.js').default;
const Promise = require('bluebird');
var config = require('./config');
const axios = require('axios');
var domain = config.domain;
var token = config.token;
const uuid = require('uuid');
var resources = [];

async function getConnections({domain, options, token}) {
  var cYesWYes = await oada.connect({
=======
const oada = require("../build/index.js").default;
const axios = require("axios");

async function getConnections({ domain, options, token }) {
  var yy = await oada.connect({
>>>>>>> 87f0ca5fae9ea3e62c9d5119ee65e8954e7740da
    domain,
    options,
    token
  });

  var cYesWNo = await oada.connect({
    domain,
    options,
    token,
<<<<<<< HEAD
    websocket: false,
  })
  var cNoWYes = await oada.connect({
=======
    websocket: false
  });
  var ny = await oada.connect({
>>>>>>> 87f0ca5fae9ea3e62c9d5119ee65e8954e7740da
    domain,
    options,
    token,
    cache: false
  });

  var cNoWNo = await oada.connect({
    domain,
    options,
    token,
    websocket: false,
<<<<<<< HEAD
    cache: false,
  })
  return {cNoWNo, cYesWNo, cNoWYes, cYesWYes}
=======
    cache: false
  });
  return [nn, yn, ny, yy];
>>>>>>> 87f0ca5fae9ea3e62c9d5119ee65e8954e7740da
}

async function putResource(data, path) {
	var pieces = path.split('/bookmarks')[1].split('/')
	var newPath = '/bookmarks'+pieces.splice(0,pieces.length-1).join('/')
	var _id = 'resources/'+uuid();
	var newData = {};
	newData[pieces[0]] = {_id, _rev: '0-0'};
	var resource = await axios({
		method: 'put',
		url: domain+'/'+_id,
		headers: {
			Authorization: 'Bearer '+token,
			'Content-Type': 'application/json',
		},
		data
	})
	var link = await axios({
		method: 'put',
		url: domain+newPath,
		headers: {
			Authorization: 'Bearer '+token,
			'Content-Type': 'application/json',
		},
		data: newData
	})

	resources.push(resource.headers.location)


	return {resource, link}
}

async function cleanUp(otherResources) {
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
  tree,
	putResource,
};
