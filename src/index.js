import configureCache from './cache'
import uuid from 'uuid'
import _ from 'lodash'
var urlLib = require('url');
var pointer = require('json-pointer');
var websocket = require('./websocket');
var Promise = require('bluebird');
var axios = require('axios');
let hostLogin = require('oada-id-client').node

let CACHE;
let REQUEST = axios;
let SOCKET;
let TOKEN;
let DOMAIN;

var connect = function connect({domain, options, name, exp, token, noCache, noWs}) {
  CACHE = undefined;
  REQUEST = axios;
  SOCKET = undefined;
  TOKEN = undefined;
  DOMAIN = undefined;

  let urlObj = urlLib.parse(domain);
  DOMAIN = domain;
  let prom;
  if (token) {
    prom = Promise.resolve({access_token: token})
  } else {
    prom = hostLogin(urlObj.host, options)
  }
  return prom.then(async (result) => {
    TOKEN = result.access_token;
    let wsProm;
    if (noWs === undefined || !noWs) {
      wsProm = websocket(domain).then((socketApi) => {
        REQUEST = socketApi.http;
		    return SOCKET = socketApi;
      })
    } else wsProm = Promise.resolve();
    return wsProm.then(() => {
      let cacheProm;
      if (noCache === undefined || !noCache) {
        return configureCache({
          name: name || uuid(),
          req: REQUEST,
          exp,
        }).then((res) => {
          REQUEST = res.api;
          CACHE = res;
          return
        })
      } else return
    })
  }).then((f) => {
    return {
      token: TOKEN,
      cache: CACHE,
      socket: SOCKET
    }
  })
}
	
var get = function get({url, path, headers, watch, tree}) {
	let req = {
		method: 'get',
		url: url || DOMAIN+path,
		headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
  }

  let prom;

  if (tree) {
    prom = recursiveGet(req.url, tree, {}).then((res) => {
      return {
        data: res,
        status: 200,
      }
    })
  } else {
    prom = REQUEST(req);
  }

  return prom.then((response) => {
    if (watch) {
      return watch({
        path,
      }).then(() => {
        return response
      })
    } else return response
  })
}

var	put = function put({url, path, data, type, headers, tree}) {
	let req = {
		method: 'put',
		url: url || DOMAIN+path,
    headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
		data,
  }
  if (type) req.headers['Content-Type'] = type;
  if (tree) {
    return smartPut({
      url: url || DOMAIN+path,
      tree,
      data,
    })
  }

	return REQUEST(req)
}

var	post = function post({url, path, data, type, headers, tree}) {
  url = url || DOMAIN+path;
  url = url[url.length-1] === '/' ? url+uuid() : url+'/'+uuid();
  return put({
    url,
    data,
    type,
    headers,
    tree
  })
}

var	del = function del({url, path, headers}) {
	let req = {
		method: 'delete',
		url: url || DOMAIN+path,
    headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
	}
  return REQUEST(req)
}

var clearCache = async function({name, exp}) {
	await CACHE.resetCache();
	return configureCache({
    name: name || uuid(),
    req: SOCKET.http || axios,
    exp,
  }).then((res) => {
    REQUEST = res.api;
    CACHE = res;
    return
  })
}

var configureWs = function({domain}) {
	return websocket(domain).then((socketApi) => {
    REQUEST = socketApi.http;
		return SOCKET = socketApi;
  })
}

var watch = function watch({path, func, payload}) {
	if (SOCKET) {
		return SOCKET.watch({
			path,
			headers: {Authorization: 'Bearer '+TOKEN},
		}, async function watchResponse(response) {
			if (!payload) payload = {};
			payload.response = response;
			payload.request = {
				url: DOMAIN+path,
				headers,
				method: payload.response.change.type,
			}
			if (CACHE) await CACHE.handleWatchChange(payload)
			return func(payload)
		})
	} else {
    // Ping a normal GET every 5 seconds in the absense of a websocket
		return setInterval(() => {
			this.get({url}).then((result) => {
				func(payload)
			})
		}, 5000)
  }
}

function replaceLinks(obj) {
	let ret = (Array.isArray(obj)) ? [] : {};
	if (!obj) return obj;  // no defined objriptors for this level
	return Promise.map(Object.keys(obj || {}), (key)  => {
		if (key === '*') { // Don't put *s into oada. Ignore them
			return;
		}
		let val = obj[key];
		if (typeof val !== 'object' || !val) {
			ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
			return;
		}
		if (val._type) { // If it has a '_type' key, don't worry about it.
			//It'll get created in future iterations of ensureTreeExists
			return;
		}
		if (val._id) { // If it's an object, and has an '_id', make it a link from descriptor
			ret[key] = { _id: obj[key]._id};
			if (val._rev) ret[key]._rev = '0-0'
			return;
		}
		// otherwise, recurse into the object looking for more links
		return replaceLinks(val).then((result) => {
			ret[key] = result;
			return;
		})
	}).then(() => {
		return ret;
	})
}

let recursiveGet = (url, tree, returnData) => {
	return Promise.try(() => {
		// Perform a GET if we have reached the next resource break.
		if (tree._type) { // its a resource
      return get({
				url
			}).then((response) => {
				returnData = response.data;
				return
			})
		}
		return
	}).then(() => {
		// Walk down the data at this url and continue recursion.
		return Promise.map(Object.keys(tree), (key) => {
			// If tree contains a *, this means we should get ALL content on the server
			// at this level and continue recursion for each returned key.
			if (key === '*') {
				return Promise.map(Object.keys(returnData), (resKey) => {
					if (resKey.charAt(0) === '_') return
					return recursiveGet(url+'/'+resKey, tree[key] || {}, returnData[key]).then((res) => {
						return returnData[resKey] = res;
					})
				})
			} else if (typeof tree[key] === 'object') {
				return recursiveGet(url+'/'+key, tree[key] || {}, returnData[key]).then((res) => {
					return returnData[key] = res;
				})
			} else return returnData[key]
		}).then(() => {
			return returnData
		})
	}).catch((err) => {
    if (err.response.status === 404) {
      return
		}
		throw err
	})
}

function findDeepestResources(pieces, tree, cachedTree, domain) {
	let cached = 0;
	let setup;
	// Walk down the url in reverse order
	return Promise.mapSeries(pieces, (piece, i) => {
		let z = pieces.length - 1 - i; //
		let urlPath = '/'+pieces.slice(0, z+1).join('/');
		let treePath = convertSetupTreePath(pieces.slice(0, z+1), tree);
		// Check that its in the cached tree then look for deepest _resource_.
		// If successful, break from the loop by throwing
		if (pointer.has(tree, treePath+'/_type')) {
			setup = setup || z;
			if (pointer.has(cachedTree, urlPath)) {
				cached = z;
				throw z;
			}
			return get({
				url: domain+urlPath
			}).then((response) => {
				pointer.set(cachedTree, urlPath, {})
				cached = z;
				throw z;
			}).catch((err) => {
				if (typeof err === 'number') throw z;
				return
			})
		}
		return
	}).catch((err) => {
		// Throwing with a number error only should occur on success.
		if (typeof err === 'number') return { cached, setup }
	}).then(() => {
		return { 
			cached: cached, 
			setup: setup || 0
		}
	})
}

// Ensure all resources down to the deepest resource are created before
// performing a PUT.
let smartPut = ({url, tree, data}) => {
	//If /resources
	
	//If /bookmarks
	let urlObj = urlLib.parse(url);
	let domain = urlObj.protocol+'//'+urlObj.host;
	let path = urlObj.path;
	path = path.replace(/^\//, '');
	let pieces = path.replace(/\/$/, '').split('/');
	let obj = {};
	// Find the deepest part of the path that exists. Once found, work back down.
	return findDeepestResources(pieces, tree, tempTree, domain).then((ret) => {
		// Create all the resources on the way down. ret.cached is an index. Subtract
		// one from pieces.length so its in terms of an index as well.
		return Promise.mapSeries(pieces.slice(0, pieces.length - 1 - ret.cached), (piece, j) => {
			let i = ret.cached+1 + j; // ret.cached exists; add one to continue beyond.
			let urlPath = '/'+pieces.slice(0, i+1).join('/');
			let treePath = convertSetupTreePath(pieces.slice(0, i+1), tree);
			if (pointer.has(tree, treePath+'/_type') && i <= ret.setup) { // its a resource
				return replaceLinks(pointer.get(tree, treePath)).then((content) => {
					return makeResourceAndLink({
						url: urlObj.protocol+'//'+urlObj.host+urlPath,
						data: content
					}).then(() => {
						pointer.set(TREE, urlPath, content)
						return
					})
				})
			} else return
		}).then(() => {
			// Finally, PUT to the deepest resource with the data (upsert)
			// We're not putting data into the cached tree. It only needs to know about
			// resource ids, not underlying data itself.
			return put({
				url,
				type: data._type,
				data,
			})
		})
	}).catch((err) => {
		console.log(err);
		return err
	})
}

// Loop over the keys of the path and determine whether the object at that level
// contains a * key. The path must be updated along the way, replacing *s as 
// necessary.
function convertSetupTreePath(pathPieces, tree) {
	let newPieces = _.clone(pathPieces);
	newPieces =	pathPieces.map((piece, i) => {
		if (pointer.has(tree, '/'+newPieces.slice(0, i).join('/')+'/*')) {
			newPieces[i] = '*';
			return '*';
		} else {
			return piece
		}
	})
	return '/'+newPieces.join('/')
}

function makeResourceAndLink({url, data}) {
	let urlObj = urlLib.parse(url);
	let domain = urlObj.protocol+'//'+urlObj.host;
	let req = {
		url: data._id ? domain+'/'+data._id : domain+'/resources',
		contentType: data._type,
		data,
	}
	let resource = data._id ? put(req) : post(req);
	return resource.then((response) => {
		data._id = response.headers['content-location'].replace(/^\//, '');
		let link = {
			url,
			'Content-Type': data._type,
			data: {_id:data._id},
		}
		if (data._rev) link.data._rev = '0-0'
		return put(link)
	}).catch((err) => {
		console.log(err)
	})
}

export default {
  connect,
	get,
	delete: del,
	put,
  post,
  clearCache,
}
