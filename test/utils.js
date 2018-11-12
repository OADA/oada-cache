const oada = require('../build/index.js').default;
const Promise = require('bluebird');
const axios = require('axios');
const uuid = require('uuid');
var { token, domain} = require('./config');
var resources = [];

async function getConnections({domain, options, token}) {
  var cYesWYes = await oada.connect({
    domain,
    options,
    token
  });

  var cYesWNo = await oada.connect({
    domain,
    options,
    token,
    websocket: false,
  })
  var cNoWYes = await oada.connect({
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
    cache: false,
  })
  return {cNoWNo, cYesWNo, cNoWYes, cYesWYes}
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

async function cleanUp(otherResources) {
  // Delete resources
  resources.forEach(async function(res) {
    await axios({
      method: "delete",
      url: domain + res,
      headers: {
        Authorization: "Bearer " + token,
				'Content-Type': "application/vnd.oada.harvest.1+json",
      }
    });
  });
  // Delete link
	try {
  await axios({
    method: "delete",
    url: domain + "/bookmarks/test",
    headers: {
      Authorization: "Bearer " + token,
      'Content-Type': "application/vnd.oada.harvest.1+json",
    },
  });
	} catch(err) {
		console.log('wtf', err.response)
	}
}

module.exports = {
  getConnections,
  cleanUp,
  tree,
	putResource,
};
