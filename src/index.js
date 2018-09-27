import setupCache from './cache'
import uuid from 'uuid'
import _ from 'lodash'
const urlLib = require('url');
const pointer = require('json-pointer');
const websocket = require('./websocket');
const Promise = require('bluebird');
const axios = require('axios');
const oadaIdClient = require('@oada/oada-id-client');

var connect = function connect({domain, options, cache, token, noWebsocket}) {
  let CACHE = undefined;
  let REQUEST = axios;
  let SOCKET = undefined;
  let TOKEN = undefined;
  let DOMAIN = domain;
  let NAME = urlLib.parse(domain).hostname.replace(/\./g, '_');
  let EXP = cache ? cache.exp : undefined;

  if (!DOMAIN) throw 'domain undefined'

  function _replaceLinks(obj) {
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
        //It'll get created in future iterations of ensureTree
        return;
      }
      if (val._id) { // If it's an object, and has an '_id', make it a link from descriptor
        ret[key] = { _id: obj[key]._id};
        if (val._rev) ret[key]._rev = '0-0'
        return;
      }
      // otherwise, recurse into the object looking for more links
      return _replaceLinks(val).then((result) => {
        ret[key] = result;
        return;
      })
    }).then(() => {
      return ret;
    })
  }

  function _makeResourceAndLink({path, data}) {
    console.log('making resource and linking', path, data)
    let req = {
      path: data._id ? '/'+data._id : '/resources/'+uuid(),
      type: data._type,
      data,
    }
    let link = {
      path,
      type: data._type,
      data: {_id:data._id || req.path.replace(/^\//, '')}
    }
    if (data._rev) link.data._rev = '0-0'
    return put(link).then(() => {
      return put(req)
    })
  }

  function _watch({headers, path, func, payload}) {
    if (SOCKET) {
      return SOCKET.watch({
        path,
        headers,
      }, async function watchResponse(response) {
        var watchPayload = _.cloneDeep(payload) || {};
        watchPayload.response = response;
        watchPayload.request = {
          url: DOMAIN+path,
          headers,
          method: response.change.type,
        }
        if (CACHE) await CACHE.handleWatchChange(_.cloneDeep(watchPayload))
        return func(watchPayload)
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

  function get({url, path, headers, watch, tree}) {
    let req = {
      method: 'get',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
    }

    let prom;

    if (tree) {
      // Tree must be rooted at /bookmarks. Get the subtree for the given path.
      var pieces = urlLib.parse(req.url).path.replace(/^\//, '').split('/');
      let treePath = _convertSetupTreePath(pieces, tree);
      if (!pointer.has(tree, treePath)) return get({url: req.url})
      tree = pointer.get(tree, treePath)
      prom = _recursiveGet(req.url, tree, {}).then((res) => {
        return {
          data: res,
          status: 200,
        }
      }).catch((err) => {
        return
      })
    } else {
      prom = REQUEST(req);
    }

    return prom.then(async (response) => {
      if (watch) {
        path = path || urlLib.parse(url).path;
        req.headers['x-oada-rev'] = response.data._rev;
        //        console.log('GET WATCH REV', path, response.data._rev)
        await _watch({
          headers: req.headers,
          path,
          func: watch.func,
          payload: watch.payload
        })
      }
      return response
    })
  }

  function _recursiveGet(url, tree, returnData) {
    return Promise.try(() => {
      // Perform a GET if we have reached the next resource break.
      if (tree._type) { // its a resource
        return get({
          url
        }).then((response) => {
          returnData = response.data;
          return
        }).catch((err) => {
          if (err.response.status === 404) {
            return
          }
          throw err
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

  // Identify the cached resources vs those that need to be setup.
  function _findDeepestResources(pieces, tree, cachedTree) {
    let cached = 0;
    let setup;
    // Walk down the url in reverse order
    return Promise.mapSeries(pieces, (piece, i) => {
      let z = pieces.length - 1 - i; //use z to create paths in reverse order
      let urlPath = '/'+pieces.slice(0, z+1).join('/');
      let treePath = _convertSetupTreePath(pieces.slice(0, z+1), tree);
      // Check that its in the cached tree then look for deepest _resource_.
      // If successful, break from the loop by throwing
      if (pointer.has(tree, treePath+'/_type')) {
        setup = setup || z;
        if (pointer.has(cachedTree, urlPath)) {
          cached = _.clone(z);
          throw new Error('cached');
        }
        return get({
          path: urlPath
        }).then((response) => {
          pointer.set(cachedTree, urlPath, {})
          cached = _.clone(z);
          throw new Error('cached');
        }).catch((err) => {
          //          pointer.set(cachedTree, urlPath, {})
          if (/^cached/.test(err.message)) throw err;
          return
        })
      }
      return
    }).catch((err) => {
      // Throwing with a number error only should occur on success.
      if (/^cached/.test(err.message)) return { cached, setup }
    }).then(() => {
      return { 
        cached: cached, 
        setup: setup || 0
      }
    })
  }

  // Loop over the keys of the path and determine whether the object at that level
  // contains a * key. The path must be updated along the way, replacing *s as 
  // necessary.
  function _convertSetupTreePath(pathPieces, tree) {
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

  function _ensureTree({url, tree, data}) {
    console.log('ENSURETREE', url)
    //If /resources
    
    //If /bookmarks
    let path = urlLib.parse(url).path.replace(/^\//, '');
    let pieces = path.replace(/\/$/, '').split('/');
    if (data._id) {
      let firstPath = _convertSetupTreePath(pieces, tree);
      pointer.set(tree, firstPath+'/_id', data._id)
    }
    //    if (pointer.has(tree, treePath)) pointer.set(tree, treePath, _.merge(pointer.get(tree, treePath),data))
    let cachedTree = {};
    // Find the deepest part of the path that exists. Once found, work back down.
    return _findDeepestResources(pieces, tree, cachedTree).then((ret) => {
      console.log('FOUND DEEPEST', ret)
      // Create all the resources on the way down. ret.cached is an index. Slice
      // takes the length to slice, so no need to subtract 1.
      return Promise.mapSeries(pieces.slice(0, pieces.length - ret.cached), (piece, j) => {
        let i = ret.cached+1 + j; // ret.cached exists; add one to continue beyond.
        let urlPath = '/'+pieces.slice(0, i+1).join('/');
        let treePath = _convertSetupTreePath(pieces.slice(0, i+1), tree);
        if (pointer.has(tree, treePath+'/_type') && i <= ret.setup) { // its a resource
          return _replaceLinks(pointer.get(tree, treePath)).then((content) => {
            return _makeResourceAndLink({
              path: urlPath,
              data: _.cloneDeep(content)
            }).then((resp) => {
              pointer.set(cachedTree, urlPath, content)
              return resp
            }).catch((err) => {
              return err
            })
          })
        } else return
      })
    }).then((responses) => {
      return responses[responses.length-1]
    }).catch((err) => {
      return err
    })
  }

  function post({url, path, data, type, headers, tree}) {
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

  function del({url, path, headers, unwatch}) {
    let req = {
      method: 'delete',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
    }

    if (unwatch) {
      path = path || urlLib.parse(url).path;
      return SOCKET.unwatch({
        path,
        headers: req.headers
      })/*.then(() => {
        return
      })*/
    }

    return REQUEST(req)
  }

  function _configureCache({name, req, exp}) {
    let res = setupCache({name, req, exp})
    REQUEST = res.api;
    CACHE = res;
    return
  }

  function _configureWs({domain}) {
    return websocket(domain).then((socketApi) => {
      REQUEST = socketApi.http;
      return SOCKET = socketApi;
    })
  }

  // Ensure all resources down to the deepest resource are created before
  // performing a PUT.
  async function put({url, path, data, type, headers, tree}) {
    let req = {
      method: 'put',
      url: url || DOMAIN+path,
      headers: _.merge({'Authorization': 'Bearer '+TOKEN}, headers),
      data,
    }
    if (type) req.headers['Content-Type'] = type;

    if (tree) {
      await _ensureTree({
        url: req.url,
        tree: _.cloneDeep(tree),
        data
      })
    } 
    var pieces = urlLib.parse(req.url).path.replace(/^\//, '').split('/');
    let treePath = _convertSetupTreePath(pieces, tree)+'/_type';
    if (pointer.has(tree, treePath)) req.headers['Content-Type'] = pointer.get(tree, treePath)
    return REQUEST(req)
  }

  async function resetCache(name, exp) {
    if (!CACHE) return
    await CACHE.resetCache();
    return _configureCache({
      name: NAME,
      req: SOCKET.http || axios,
      exp: exp || EXP, 
    })
  }

  function disconnect() {
    if (CACHE) CACHE.db.destroy();
    if (CACHE) CACHE.db.close();
    if (SOCKET) SOCKET.close();
  }

  let urlObj = urlLib.parse(domain);
  let prom;
  if (token) {
    prom = Promise.resolve({access_token: token})
  } else {
    if (typeof window === 'undefined') {
      prom = oadaIdClient.node(urlObj.host, options)
    } else {
      // the library itself detects a browser environment and delivers .browser
      var gat = Promise.promisify(oadaIdClient.getAccessToken);
      prom = gat(urlObj.host, options);
    }
  }
  return prom.then(async (result) => {
    TOKEN = result.access_token;
    let wsProm;
    if (!noWebsocket) {
      wsProm = websocket(domain).then((socketApi) => {
        REQUEST = socketApi.http;
		    return SOCKET = socketApi;
      })
    } else wsProm = Promise.resolve();
    return wsProm.then(() => {
      let cacheProm;
      if (cache === false) return
      return _configureCache({
        name: NAME || uuid(),
        req: REQUEST,
        exp: EXP,
      })
    })
  }).then((f) => {
    return {
      token: TOKEN,
      //      cache: CACHE,
      //socket: SOCKET,
      get,
      put,
      post,
      delete: del,
      resetCache,
      disconnect,
    }
  })
}

export default {
  connect,
}
