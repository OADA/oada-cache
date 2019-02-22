const Promise = require("bluebird");
const pretty = require('prettyjson');
import setupCache from "./cache";
import uuid from "uuid";
import _ from "lodash";
const urlLib = require("url");
const pointer = require("json-pointer");
const ws = require("./websocket");
const axios = require("axios");
const _TOKEN = require("./token");
const error = require('debug')('oada-cache:index:error');
const info = require('debug')('oada-cache:index:info');

var connect = async function connect({
  domain,
  options,
  cache,
  token,
  websocket
}) {
  if (!domain) throw new Error("domain undefined");
  if (typeof domain !== "string") throw new Error("domain must be a string");
  if (!options && !token) throw new Error("options and token undefined");
  if (token && typeof token !== "string") throw new Error("token must be a string");
	if (cache !== undefined && typeof cache !== "boolean" && typeof cache !== "object") throw new Error(`cache must be either a boolean or an object with 'name' and/or 'expires' keys`);
	if (cache && cache.name && typeof cache.name !== "string") throw new Error("cache name must be a string");
  //  if (typeof cache !== "undefined" && typeof cache !== "boolean")
  //throw "cache must be boolean";
  if (typeof websocket !== "undefined" && typeof websocket !== "boolean")
    throw new Error("websocket must be boolean");

	var OFFLINE;
  var CACHE;
  var REQUEST = axios;
	var NOCACHEREQUEST = axios;
  var SOCKET;
  var TOKEN;
  let _token = new _TOKEN({ domain, token, options });
  if (!domain) throw new Error('domain undefined');
  var DOMAIN = domain;
	var NAME =
    cache && cache.name
      ? cache.name
      : urlLib.parse(domain).hostname.replace(/\./g, "_");

  var EXPIRES = (cache && cache.expires) ? cache.expires : undefined;

  function _replaceLinks(obj) {
    let ret = Array.isArray(obj) ? [] : {};
    if (!obj) return obj; // no defined objriptors for this level
    return Promise.map(Object.keys(obj || {}), key => {
      if (key === "*") {
        // Don't put *s into oada. Ignore them
        return;
      }
      let val = obj[key];
      if (typeof val !== "object" || !val) {
        ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
        return;
      }
      if (val._type) {
        // If it has a '_type' key, don't worry about it.
        //It'll get created in future iterations of ensureTree
        return;
      }
      if (val._id) {
        // If it's an object, and has an '_id', make it a link from descriptor
        ret[key] = { _id: val._id };
        if (val._rev) ret[key]._rev = val._rev;
        return;
      }
      // otherwise, recurse into the object looking for more links
      return _replaceLinks(val).then(result => {
        ret[key] = result;
        return;
      });
    }).then(() => {
      return ret;
    });
  }

  async function _makeResourceAndLink({ path, data, headers }, waitTime) {
    info('_makeResourceAndLink', path, data)
    data._id = _.clone(data._id) || "resources/" + uuid();

		let linkReq = {
			path,
      type: data._type,
			headers,
      data: {_id: data._id}
    };
    // Create a versioned link if the tree specifies one.
    if (data._rev) linkReq.data._rev = '0-0';
    // We don't want to attempt to set the rev when we put the resource

    let resReq = {
      path: "/"+data._id,
      type: data._type,
      data
    };
		var link;
    try {
		  link = await put(linkReq);
    } catch (err) {
      if (err.response && err.response.status === 412) {
        var pathPieces = path.split('/');
        var parentPath = pathPieces.splice(0, pathPieces.length-1).join('/');
				// Wait time increases: 1s, 2s, 4s, 8s, 16s. Throw after 16s.
				if (waitTime > 16000) throw err;
				//The parent has been modified; attempt to get the new _rev
				var response;
				try {
          response = await NOCACHEREQUEST({method: 'get', url: DOMAIN+parentPath, headers:{"Authorization": "Bearer "+TOKEN}})
				} catch (erro) {
          waitTime = waitTime || 1000;
          await Promise.delay(waitTime)
				  return _makeResourceAndLink({path, data, headers}, waitTime*2)
        }
        // If the key has already been created, set the resource path to the bookmarks path and let it map automatically, not a resource id 
        if (response.data[pathPieces[pathPieces.length-1]]) {
          resReq.data._id = response.data[pathPieces[pathPieces.length-1]]._id;
          resReq.path = '/'+resReq.data._id;
        } else {
          // The key does not yet exist, adjust the if-match and try again.
					waitTime = waitTime || 1000;
					await Promise.delay(waitTime)
					var newHeaders = _.cloneDeep(headers);
					newHeaders['if-match'] = response.headers['x-oada-rev'];
				  return _makeResourceAndLink({path, data, headers: newHeaders}, waitTime*2)
				}
			} else throw err;
		}
		// Delete the _rev  and _id keys. No need for them in the resource object. They will break things.
    if (data._rev) delete resReq.data._rev
		var resource = await put(resReq);
    return { link, resource };
  }

  function _watch({ headers, path, func, payload }) {
    if (SOCKET) {
      return SOCKET.watch(
        {
          path,
          headers
        },
        async function watchResponse(response) {
          var watchPayload = _.cloneDeep(payload) || {};
          watchPayload.response = response;
          watchPayload.request = {
            url: DOMAIN + path,
            headers,
            method: response.change.type
          };
          if (CACHE) watchPayload = await CACHE.handleWatchChange(watchPayload);
					if (func) await func(watchPayload);
					return
        }
      );
    } else {
      // Ping a normal GET every 5 seconds in the absense of a websocket
      return setInterval(() => {
        get({ url: DOMAIN + path }).then(result => {
          func(payload);
        });
      }, 5000);
    }
  }

	// Construct the request object and catch any 401s (expired token)
  async function _buildRequest({ method, url, path, headers, data, type }) {
    if (!path && !url) throw new Error("Either path or url must be specified.");
		if (url) {
			if ((/^\//).test(url)) {
				url = domain + url;
			} else if (url.indexOf(domain) !== 0) {
				throw new Error(`'url' key must begin with the domain used to connect`);
			}
		}
		method = method.toLowerCase()
    let req = {
      method,
      url: url || DOMAIN + path,
      headers: { authorization: "Bearer " + TOKEN }
    };
		if (/\/$/.test(req.url)) req.url = req.url.slice(0, req.url.length-1)

    //handle headers
		Object.keys(headers || {}).forEach(header => {
      req.headers[header.toLowerCase()] = headers[header];
		});

    if (method === "put" || method === 'post') {
      req.headers["content-type"] =
        req.headers["content-type"] || type || data._type;
			req.data = data;
	  }


		if (method === "delete") {
			req.headers["content-type"] =
				req.headers["content-type"] || type;
		}
		return req;
	}


	async function _sendRequest(req) {
    try {
      return REQUEST(req)
    } catch (err) {
		  if (err && err.response.status === 401) {
        //token has expired
        await reconnect();
        return REQUEST(req);
      }
			throw err;
    } 
  }

  async function get({ url, path, headers, watch, tree }) {
    let req = await _buildRequest({ method: "get", url, path, headers });
    // If a tree is supplied, recursively GET data according to the data tree
    // The tree must be rooted at /bookmarks.

    var response = await _sendRequest(req);

    if (tree) {
      var pieces = urlLib
        .parse(req.url)
        .path.replace(/^\//, "")
        .split("/");
      let treePath = _convertSetupTreePath(pieces, tree);
      if (!pointer.has(tree, treePath))
        throw new Error("The path does not exist on the given tree.");
      //return get({url: req.url})
      var subTree = pointer.get(tree, treePath);
      try {
        var stuff = await _recursiveGet(req.url, subTree, {}, true);
        response.data = stuff.data;
        response.cached = stuff.cached;
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    }

    // Handle watch
    if (watch) {
      path = path || urlLib.parse(url).path;
      req.headers["x-oada-rev"] = response.data._rev;
      await _watch({
        headers: req.headers,
        path,
        func: watch.function,
        payload: watch.payload
      });
    }
    return response;
  } //get

  async function _recursiveGet(url, tree, data, cached) {

    console.log('_recursiveGet', url, tree._type, data)
    info('_recursiveGet', url, tree._type, data)
    // Perform a GET if we have reached the next resource break.
    if (tree._type) {
      // its a resource
      var got = await get({
        url
      });
      info('_recursiveGet GET data:', got.data)
      data = got.data;
      cached = got.cached ? got.cached : false;
    }
    return Promise.map(Object.keys(data || {}), async function(key) {
      if (typeof data[key] === "object") {
        if (tree[key]) {
          var res = await _recursiveGet(
            url + "/" + key,
            tree[key],
            data[key],
            cached
          );
					cached = res.cached
          return (data[key] = res.data);
        } else if (tree["*"]) {
          var res = await _recursiveGet(
            url + "/" + key,
            tree["*"],
            data[key],
            cached
          );
					cached = res.cached
          return (data[key] = res.data);
        } else return; //data[key] is already stored in the data object
      } else return;
    }).then(() => {
      return { data, cached };
    });
  }

  // Identify the stored resources vs those that need to be setup.
  function _findDeepestResources(pieces, tree, storedTree) {
    let stored = 0;
    let setup;
		var _rev;
    // Walk down the url in reverse order
    return Promise.mapSeries(pieces, (piece, i) => {
      let z = pieces.length - 1 - i; //use z to create paths in reverse order
      let urlPath = "/" + pieces.slice(0, z + 1).join("/");
      let treePath = _convertSetupTreePath(pieces.slice(0, z + 1), tree);
      // Check that its in the stored tree then look for deepest _resource_.
      // If successful, break from the loop by throwing
      if (pointer.has(tree, treePath + "/_type")) {
        setup = setup || z;
        if (pointer.has(storedTree, urlPath)) {
          stored = _.clone(z);
          throw new Error("stored");
        }
        return get({
          path: urlPath
        }).then(response => {
          //TODO: Detect whether the returned data matches the given tree
          pointer.set(storedTree, urlPath, {});
          stored = _.clone(z);
					_rev = response.headers['x-oada-rev']
          throw new Error("stored");
        }).catch(err => {
          if (/^stored/.test(err.message)) throw err;
          return;
        });
      } else return;
    }).catch(err => {
      // Throwing with a number error only should occur on success.
      if (/^stored/.test(err.message)) return { stored, setup };
    }).then(() => {
      return {
        stored: stored,
        setup: setup || 0,
				_rev
      };
    });
  }

  // Loop over the keys of the path and determine whether the object at that level
  // contains a * key. The path must be updated along the way, replacing *s as
  // necessary.
  function _convertSetupTreePath(pathPieces, tree) {
    let newPieces = _.clone(pathPieces);
    newPieces = pathPieces.map((piece, i) => {
      if (pointer.has(tree, "/" + newPieces.slice(0, i).join("/") + "/*")) {
        newPieces[i] = "*";
        return "*";
      } else {
        return piece;
      }
    });
    return "/" + newPieces.join("/");
  }

  async function _ensureTree({ url, tree, data }) {
    let path = urlLib.parse(url).path.replace(/^\//, "");
    let pieces = path.replace(/\/$/, "").split("/"); // replace trailing slashes
    if (data._id) {
      let firstPath = _convertSetupTreePath(pieces, tree);
      pointer.set(tree, firstPath + "/_id", data._id);
    }
    //    if (pointer.has(tree, treePath)) pointer.set(tree, treePath, _.merge(pointer.get(tree, treePath),data))
    let storedTree = {};
    var responses = [];
    // Find the deepest part of the path that exists. Once found, work back down.
    var ret = await _findDeepestResources(pieces, tree, storedTree)
		// Create all the resources on the way down. ret.stored is an index. Slice
		// takes the length to slice, so no need to subtract 1.
		var parentRev = ret._rev;
    await Promise.mapSeries(pieces.slice(0, pieces.length - ret.stored), async function (piece, j) {
			let i = ret.stored + 1 + j;
			let urlPath = "/" + pieces.slice(0, i + 1).join("/");
			let treePath = _convertSetupTreePath(pieces.slice(0, i + 1), tree);
			if (pointer.has(tree, treePath + "/_type") && i <= ret.setup) {
        // its a resource
        var content = await _replaceLinks(pointer.get(tree, treePath))
				var resp = await _makeResourceAndLink({
					path: urlPath,
					data: _.cloneDeep(content),
					headers: {'if-match': parentRev},
				})
				parentRev = resp.resource.headers['x-oada-rev'];
				pointer.set(storedTree, urlPath, content);
				resp.path = urlPath;
				responses.push(resp);
			};
		})
		return responses;
  }

  function _configureCache({ name, req, expires }) {
    let res = setupCache({ name, req, expires });
    REQUEST = res.api;
    CACHE = res;
    return;
  }

  function _configureWs({ domain }) {
    return ws(domain).then(socketApi => {
      REQUEST = socketApi.http;
			NOCACHEREQUEST = socketApi.http;
      return (SOCKET = socketApi);
    });
  }

  function post({ url, path, data, type, headers, tree }) {
    url = url || DOMAIN + path;
    url = url[url.length - 1] === "/" ? url + uuid() : url + "/" + uuid();
    return put({
      url,
      data,
      type,
      headers,
      tree
    });
  }

  async function _recursiveDelete(url, tree, data) {
    // Perform a GET if we have reached the next resource break.
    if (tree._type) {
      // its a resource
			try {
				var got = await get({
					url
				});
				data = got.data;
			} catch (err) {
				if (err.status === 404) {
					data = {};
					return
				}
			}
		}
    return Promise.map(Object.keys(data || {}), async function(key) {
      if (typeof data[key] === "object") {
        if (tree[key]) {
          var res = await _recursiveDelete(
            url + "/" + key,
            tree[key],
            data[key],
          );
          return (data[key] = res.data);
        } else if (tree["*"]) {
          var res = await _recursiveDelete(
            url + "/" + key,
            tree["*"],
            data[key],
          );
          return (data[key] = res.data);
        } else return; //data[key] is already stored in the data object
      } else return;
    }).then(async function() {
			var link;
			if (tree._type) {
				try {
					// Delete the resource
          if (data._id) {
						await del({
							path: '/'+data._id,
							headers: {'content-type': tree._type}
						});
					}

					// Delete the link
					link = await del({
						url,
						headers: {
							'content-type': tree._type
						}
					});
        } catch (err) {
					if (err.status === 404) {
						data = {};
						return
					}
				}
      } else {
        // Delete the lookup for non resources
        if (CACHE) await CACHE.removeLookup({url})
      }
			return { link, data };
    });
  }



  async function del({ url, path, type, headers, tree, unwatch}) {
    let req = await _buildRequest({ method: "delete", url, path, type, headers });
    if (unwatch) {
      path = path || urlLib.parse(url).path;
      return SOCKET.unwatch({
        path,
        headers: req.headers
      });
    }
    if (tree) {
      var pieces = urlLib
        .parse(req.url)
        .path.replace(/^\//, "")
        .split("/");
      let treePath = _convertSetupTreePath(pieces, tree);
      if (!pointer.has(tree, treePath))
        throw new Error("The path does not exist on the given tree.");
      //return get({url: req.url})
      var subTree = pointer.get(tree, treePath);
      var result = await _recursiveDelete(req.url, subTree, {}, true);
			return result.link

			//var treePath = _convertSetupTreePath(pieces, tree) + "/_type";
      //if (!req.headers["content-type"] && pointer.has(tree, treePath))
      //  req.headers["content-type"] = _.clone(pointer.get(tree, treePath));
    }
    
		if (!req.headers["content-type"])
      throw new Error(`content-type header must be specified.`);

    return _sendRequest(req)
  }

  // Ensure all resources down to the deepest resource are created before
  // performing a PUT.
  async function put({ url, path, data, type, headers, tree }) {
    let req = await _buildRequest({
      method: "put",
      url,
      path,
      data,
      type,
      headers
    });

    // Ensure parent resources are created
    if (tree) {
      var responses = await _ensureTree({
        url: req.url,
        tree: _.cloneDeep(tree),
        data
      });
			var pieces = responses.length > 0 ? 
				responses[responses.length - 1].path
					.replace(/^\//, "")
					.split("/")
				: urlLib.parse(req.url)
					.path
					.replace(/^\//, "")
					.split('/')

			var treePath = _convertSetupTreePath(pieces, tree) + "/_type";
      if (!req.headers["content-type"] && pointer.has(tree, treePath))
        req.headers["content-type"] = _.clone(pointer.get(tree, treePath));
    }

    if (!req.headers["content-type"])
      throw new Error(`content-type header must be specified.`);
    return _sendRequest(req).then((result) => {
      return result;
    })
  }

  async function resetCache(name, expires) {
    if (!CACHE) return;
    await CACHE.resetCache();
  }

  async function disconnect() {
    if (CACHE) await CACHE.db.close();
    //if (CACHE) await CACHE.db.destroy();
    if (SOCKET) SOCKET.close();
    //if (_token.isSet()) {
      _token.cleanUp();
    //}
  }

  async function reconnect() {
    // get a new token
    TOKEN = await _token.renew();
  }

  // get a token
  TOKEN = await _token.get();

  // Setup websockets
  if (websocket !== false) {
    var socketApi = await ws(domain);
    REQUEST = socketApi.http;
    SOCKET = await socketApi;
  }

  //Setup the cache
  if (cache !== false) await _configureCache({
    name: NAME || uuid(),
    req: REQUEST,
    expires: EXPIRES,
  })

  return {
    token: TOKEN,
    cache: CACHE ? CACHE : false,
    websocket: SOCKET ? SOCKET : false,
    get,
    put,
    post,
    delete: del,
    resetCache,
    disconnect,
    reconnect
  };
};

export default {
  connect
};
