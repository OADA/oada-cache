import setupCache from "./cache";
import uuid from "uuid";
import _ from "lodash";
const urlLib = require("url");
const pointer = require("json-pointer");
const ws = require("./websocket");
const Promise = require("bluebird");
const axios = require("axios");
const _TOKEN = require("./token");

var connect = async function connect({
  domain,
  options,
  cache,
  token,
  websocket
}) {
  if (!domain) throw "domain undefined";
  if (typeof domain !== "string") throw "domain must be a string";
  if (!options && !token) throw "options and token undefined";
  if (token && typeof token !== "string") throw "token must be a string";
  if (typeof websocket !== "undefined" && typeof websocket !== "boolean")
    throw "websocket must be boolean";

  let CACHE = undefined;
  let REQUEST = axios;
  let SOCKET = undefined;
  let TOKEN = undefined;
  let _token = new _TOKEN({ domain, token, options });
  if (!domain) throw "domain undefined";
  let DOMAIN = domain;
  let NAME =
    cache && cache.name
      ? cache.name
      : urlLib.parse(domain).hostname.replace(/\./g, "_");
  let EXP = cache && cache.exp ? cache.exp : undefined;

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
        ret[key] = { _id: obj[key]._id };
        if (val._rev) ret[key]._rev = "0-0";
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

  async function _makeResourceAndLink({ path, data }) {
    let resReq = {
      path: data._id ? "/" + data._id : "/resources/" + uuid(),
      type: data._type,
      data
    };
    let linkReq = {
      path,
      type: data._type,
      data: { _id: data._id || resReq.path.replace(/^\//, "") }
    };
    if (data._rev) linkReq.data._rev = "0-0";
    var resource = await put(resReq);
    var link = await put(linkReq);

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
          if (CACHE) await CACHE.handleWatchChange(watchPayload);
          return func(watchPayload);
        }
      );
    } else {
      // Ping a normal GET every 5 seconds in the absense of a websocket
      return setInterval(() => {
        get({ url }).then(result => {
          func(payload);
        });
      }, 5000);
    }
  }

  async function _buildRequest({ method, url, path, headers, data, type }) {
    if (!path && !url) throw new Error("Either path or url must be specified.");
    let req = {
      method: method,
      url: url || DOMAIN + path,
      headers: _.merge({ Authorization: "Bearer " + TOKEN }, headers)
    };

    //handle headers
    if (method === "put") {
      Object.keys(headers || {}).forEach(header => {
        req.headers[header.toLowerCase()] = headers[header];
      });
      req.headers["content-type"] =
        req.headers["content-type"] || type || data._type;

      req.data = data;
    }
    return req;
  } //buildRequest

  async function get({ url, path, headers, watch, tree }) {
    let req = await _buildRequest({ method: "get", url, path, headers });
    // If a tree is supplied, recursively GET data according to the data tree
    // The tree must be rooted at /bookmarks.

    var response;
    try {
      response = await REQUEST(_.clone(req));
    } catch (error) {
      if (error && error.response.status === 401) {
        //token has expired
        await reconnect();
        req = await _buildRequest({ method: "get", url, path, headers });
        response = await REQUEST(_.clone(req));
      }
    } //catch

    if (tree) {
      if (!tree.bookmarks) throw new Error("Tree must be rooted at bookmarks");
      var pieces = urlLib
        .parse(req.url)
        .path.replace(/^\//, "")
        .split("/");
      let treePath = _convertSetupTreePath(pieces, tree);
      if (!pointer.has(tree, treePath))
        throw new Error("The path does not exist on the given tree.");
      //return get({url: req.url})
      var subTree = pointer.get(tree, treePath);
      var stuff = await _recursiveGet(req.url, subTree, {}, true);
      response.data = stuff.data;
      response.cached = stuff.cached;
    }

    // Handle watch
    if (watch) {
      path = path || urlLib.parse(url).path;
      req.headers["x-oada-rev"] = response.data._rev;
      await _watch({
        headers: req.headers,
        path,
        func: watch.func,
        payload: watch.payload
      });
    }
    return response;
  } //get

  async function _recursiveGet(url, tree, data, cached) {
    // Perform a GET if we have reached the next resource break.
    if (tree._type) {
      // its a resource
      var got = await get({
        url
      });
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
          return (data[key] = res.data);
        } else if (tree["*"]) {
          var res = await _recursiveGet(
            url + "/" + key,
            tree["*"],
            data[key],
            cached
          );
          return (data[key] = res.data);
        } else return; //data[key] is already stored in the data object
      } else return;
    }).then(() => {
      return { data, cached };
    });
  }

  /*
  // recursively get data based on the supplied tree
  function _recursiveGet(url, tree, returnData) {
    return Promise.try(() => {
      // Perform a GET if we have reached the next resource break.
      if (tree._type) { // its a resource
        return get({
          url
        }).then((response) => {
          returnData = response.data;
          return tree
        })
      }
      return tree
    }).then(() => {
      // Walk down the data at this url and continue recursion.
      return Promise.map(Object.keys(tree || {}), (key) => {
        // If tree contains a *, this means we should get ALL content on the server
        // at this level and continue recursion for each returned key.
        if (key === '*') {
          return Promise.map(Object.keys(returnData || {}), (resKey) => {
            if (resKey.charAt(0) === '_') return
            return _recursiveGet(url+'/'+resKey, tree[key] || {}, returnData[resKey]).then((res) => {
              return returnData[resKey] = res;
            })
          })
        } else if (typeof tree[key] === 'object') {
          return _recursiveGet(url+'/'+key, tree[key] || {}, returnData[key]).then((res) => {
            if (res !== undefined) return returnData[key] = res;
            return
          })
        } else {
          return
        }
      }).then(() => {
        return returnData
      })
    }).catch((err) => {
      if (err.response.status === 404) return
      return err
    })
  }
  */

  function makeIntoResource() {
    //1. Get the current content of the object at that endpoint
    //1. Create a resource with the content from (1)
    //2. Delete the current content at that key
    //3. Create a link
  }

  // Identify the stored resources vs those that need to be setup.
  function _findDeepestResources(pieces, tree, storedTree) {
    let stored = 0;
    let setup;
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
        })
          .then(response => {
            //TODO: Detect whether the returned data matches the given tree
            pointer.set(storedTree, urlPath, {});
            stored = _.clone(z);
            throw new Error("stored");
          })
          .catch(err => {
            if (/^stored/.test(err.message)) throw err;
            return;
          });
      }
      return;
    })
      .catch(err => {
        // Throwing with a number error only should occur on success.
        if (/^stored/.test(err.message)) return { stored, setup };
      })
      .then(() => {
        return {
          stored: stored,
          setup: setup || 0
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

  function _ensureTree({ url, tree, data }) {
    //If /resources

    //If /bookmarks
    let path = urlLib.parse(url).path.replace(/^\//, "");
    let pieces = path.replace(/\/$/, "").split("/");
    if (data._id) {
      let firstPath = _convertSetupTreePath(pieces, tree);
      pointer.set(tree, firstPath + "/_id", data._id);
    }
    //    if (pointer.has(tree, treePath)) pointer.set(tree, treePath, _.merge(pointer.get(tree, treePath),data))
    let storedTree = {};
    var responses = [];
    // Find the deepest part of the path that exists. Once found, work back down.
    return _findDeepestResources(pieces, tree, storedTree)
      .then(ret => {
        // Create all the resources on the way down. ret.stored is an index. Slice
        // takes the length to slice, so no need to subtract 1.
        return Promise.mapSeries(
          pieces.slice(0, pieces.length - ret.stored),
          (piece, j) => {
            let i = ret.stored + 1 + j; // ret.stored exists; add one to continue beyond.
            let urlPath = "/" + pieces.slice(0, i + 1).join("/");
            let treePath = _convertSetupTreePath(pieces.slice(0, i + 1), tree);
            if (pointer.has(tree, treePath + "/_type") && i <= ret.setup) {
              // its a resource
              return _replaceLinks(pointer.get(tree, treePath)).then(
                content => {
                  return _makeResourceAndLink({
                    path: urlPath,
                    data: _.cloneDeep(content)
                  })
                    .then(resp => {
                      pointer.set(storedTree, urlPath, content);
                      resp.path = urlPath;
                      responses.push(resp);
                      return resp;
                    })
                    .catch(err => {
                      return err;
                    });
                }
              );
            } else return;
          }
        );
      })
      .then(() => {
        return responses;
      })
      .catch(err => {
        return err;
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

  async function del({ url, path, headers, unwatch }) {
    let req = await _buildRequest({ method: "delete", url, path, headers });

    if (unwatch) {
      path = path || urlLib.parse(url).path;
      return SOCKET.unwatch({
        path,
        headers: req.headers
      }); /*.then(() => {
        return
      })*/
    }

    var response;
    try {
      response = await REQUEST(req);
    } catch (error) {
      if (error && error.response.status === 401) {
        //token has expired
        //console.log("Token has expired, renewing");
        await reconnect();
        req = await _buildRequest({ method: "delete", url, path, headers });
        response = await REQUEST(req);
      }
    } //catch

    //return REQUEST(req);
    return response;
  }

  function _configureCache({ name, req, exp }) {
    let res = setupCache({ name, req, exp });
    REQUEST = res.api;
    CACHE = res;
    return;
  }

  function _configureWs({ domain }) {
    return ws(domain).then(socketApi => {
      REQUEST = socketApi.http;
      return (SOCKET = socketApi);
    });
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

      var pieces = responses[responses.length - 1].path
        .replace(/^\//, "")
        .split("/");
      let treePath = _convertSetupTreePath(pieces, tree) + "/_type";
      if (pointer.has(tree, treePath))
        req.headers["content-type"] = _.clone(pointer.get(tree, treePath));
    }
    if (!req.headers["content-type"])
      throw new Error(`'content-type' header must be specified.`);

    var response;
    try {
      response = await REQUEST(req);
    } catch (error) {
      if (error && error.response.status === 401) {
        //token has expired
        await reconnect();
        req = await _buildRequest({
          method: "put",
          url,
          path,
          data,
          type,
          headers
        });
        response = await REQUEST(req);
      } //if
    } //catch

    return response;
  }

  async function resetCache(name, exp) {
    if (!CACHE) return;
    await CACHE.resetCache();
    // return _configureCache({
    //   name: NAME,
    //   req: SOCKET && SOCKET.http ? SOCKET.http : axios,
    //   exp: exp || EXP
    // });
  }

  function disconnect() {
    if (CACHE) CACHE.db.destroy();
    if (CACHE) CACHE.db.close();
    if (SOCKET) SOCKET.close();
    if (_token.isSet()) {
      _token.cleanUp();
    }
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
  if (cache !== false)
    await _configureCache({
      name: NAME || uuid(),
      req: REQUEST,
      exp: EXP
    });

  return {
    token: TOKEN,
    cache: CACHE ? true : false,
    websocket: SOCKET ? true : false,
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
