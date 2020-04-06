"use strict";
const cq = require("concurrent-queue");
const Promise = require("bluebird");
let PouchDB = require("pouchdb");
if (PouchDB.default) PouchDB = PouchDB.default;
const url = require("url");
const _ = require("lodash");
const pointer = require("json-pointer");
const OFFLINE = false;
const REVLIMIT = 10;
var memoryCache = {};
const timeThreshold = 30000;
const cleanMemoryTimer = 10000;
const dbPutDelay = 5000; // 5 sec
Promise.config({ cancellation: true });
//PouchDB.setMaxListeners(30);

// debug
const error = require("debug")("oada-cache:cache:error");
const info = require("debug")("oada-cache:cache:info");

module.exports = function setupCache({ name, req, expires, dbprefix }) {
  dbprefix = dbprefix || "";
  name = dbprefix + name;
  // name should be made unique across domains and users
  var db = db || new PouchDB(name);
  // This fixes concurrent accesses
  PouchDB.on("destroyed", async function(dbName) {
    if (dbName === name) {
      db = new PouchDB(name);
    }
  });
  var request = req;
  var expiration = expires || 1000 * 60 * 60 * 24 * 2; //(ms/s)*(s/min)*(min/hr)*(hr/days)*days

  // Clean in-memory cache periodically
  setInterval(cleanMemoryCache, cleanMemoryTimer);

  function cleanMemoryCache() {
    const now = Date.now();
    var oldest = { key: undefined, time: now };
    var deleteCount = 0;
    Object.keys(memoryCache).forEach(key => {
      if (
        !memoryCache[key].putPending &&
        now - memoryCache[key].access < timeThreshold
      ) {
        if (memoryCache[key].access < oldest) {
          oldest = { key, time: memoryCache[key].access };
        }
        delete memoryCache[key];
        info("Deleted expired resource from the in-memory cache", key);
        deleteCount++;
      }
    });

    if (deleteCount === 0 && oldest.key) {
      delete memoryCache[oldest.key];
    }
  }

  /** Save resource to in-memory cache and schedule PUT */
  function handleMemoryCache(resourceId, data, waitTime, req) {
    const now = Date.now();
    if (resourceId in memoryCache) {
      // resource exists in in-cache memory
      // update data and access time
      memoryCache[resourceId].data = data;
      memoryCache[resourceId].access = now;
      memoryCache[resourceId].valid = true;
    } else {
      // resource does not exist
      // add new resource
      memoryCache[resourceId] = {
        data,
        access: now,
        promise: undefined,
        putPending: false,
        valid: true,
      };
    }

    // Schedule db.put
    if (!memoryCache[resourceId].putPending) {
      // set flag
      memoryCache[resourceId].putPending = true;
      // Schedule put
      memoryCache[resourceId].promise = Promise.delay(dbPutDelay)
        .then(async function() {
          if (!(resourceId in memoryCache)) {
            throw new Error("Resource does not exist in the in-memory cache.");
          }
          await doPut(resourceId, waitTime, req);
          memoryCache[resourceId].putPending = false;
        })
        .catch(function(err) {
          error("handleMemoryCacheError", err);
          memoryCache[resourceId].putPending = false;
          throw err;
        });
    }
    return Promise.resolve();
  }

  /**  Get resource from in-memory cache and do put to Pouch DB */
  function doPut(resourceId, waitTime, req) {
    if (!memoryCache[resourceId].data.doc) return
    return db
      .put(memoryCache[resourceId].data)
      .then(response => {
        memoryCache[resourceId].data._rev = response.rev;
        delete memoryCache[resourceId].promise;
      })
      .catch(err => {
        error("Error doPut", memoryCache[resourceId].data._rev, err);
        // TODO: Handle this error
        // retry 409s
        // if (err.status === 409) {
        //   waitTime = waitTime || 1000;
        //   return Promise.delay(waitTime).then(() => {
        //     if (waitTime > 16000) throw err;
        //     return dbUpsert(req, waitTime * 2);
        //   });
        // }
        //throw err;
      });
  }

  /** Get the resource and merge data if its already in the db. */

  /**
   * Store (upsert) resource to local DB
   * @param req request
   * @param waitTime wait time
   */
  async function dbUpsert(req, waitTime) {
    var urlObj = url.parse(req.url);
    var pieces = urlObj.path.split("/");
    var resourceId = pieces.slice(1, 3).join("/"); //returns resources/abc
    var pathLeftover =
      pieces.length > 3 ? "/" + pieces.slice(3, pieces.length).join("/") : "";

    // Create the content to put in the cache
    var dbPut = {
      _id: resourceId,
      valid: req.valid === undefined ? true : req.valid,
      // TODO: This current resets this access date for e.g., every put
      // while offline. This doesn't seem right. I think this should only
      // get updated when we know we're upserting a new value from the server
      accessed: Date.now(),
      doc: {},
    };

    // ALL updates to existing docs (upserts) need to supply the current _rev.
    let memoryResult = memoryCache[resourceId]; // Try to get resource from in-memory cache
    let result = { doc: {} };

    if (!memoryResult || !memoryResult.valid) {
      // resource does not exist in memory; get from DB
      try {
        result = await db.get(resourceId);
      } catch (e) {
        // Else, the resource was not in the cache. This was the first put.
        if (req.method && req.method.toLowerCase() === "delete") {
          // Deleting a resource that doesn't exist: do nothing.
          return;
        } else if (pathLeftover) {
          dbPut.INCOMPLETE_RESOURCE = true;
        }
      }
    } else {
      result = memoryResult.data;
      // If in memory, result._rev might be undefined (409 errors)
      if (result._rev !== undefined) {
        dbPut._rev = result._rev;
      }
    }

    // Now handle the upsert
    if (req.method && req.method.toLowerCase() === "delete") {
      if (!pathLeftover) {
        if (memoryCache[resourceId] && memoryCache[resourceId].promise) {
          memoryCache[resourceId].promise.cancel();
        }
        delete memoryCache[resourceId];
        return db
          .remove(result)
          .then(response => {
            return { response };
          })
          .catch(err => {
            //its okay if it already doesn't exist
            if (err.status === 404) {
              return;
            }
            throw err;
          });
      } else {
        if (pointer.has(result.doc, pathLeftover)) {
          dbPut.doc = result.doc;
          pointer.remove(dbPut.doc, pathLeftover);
        }
      }
    } else {
      //handle "merge" type operations
      if (pathLeftover) {
        var curData = pointer.has(result.doc, pathLeftover)
          ? pointer.get(result.doc, pathLeftover)
          : {};
        var newData = _.merge(curData, req.data || {});
        pointer.set(result.doc, pathLeftover, newData);
        dbPut.doc = result.doc;
      } else {
        dbPut.doc = _.merge(result.doc, req.data);
      }
    }

    if (req._rev != undefined) {
      dbPut.doc._rev = req._rev;
    }
    return handleMemoryCache(resourceId, dbPut, waitTime, req);
  }

  /**
   * Get resource from the server
   * @param req request
   */
  async function getResFromServer(req) {
    var res = await request({
      method: "GET",
      url: req.url,
      headers: req.headers,
    });
    res.cached = false;
    req.data = res.data;
    await dbUpsert(req);
    return res;
  }

  function _getMemoryCache() {
    return memoryCache;
  }

  // Perform lookup from bookmarks to resource id (and path leftover) mapping.
  // If the lookup fails, use a HEAD request to get it from the server and put
  // it in the cache. An optional _id can be passed into req to force creation
  // of a particular lookup in the event that the resource doesn't yet exist but will.
  // This is primarily for when links are created before the resource itself has been.
  function getLookup(req) {
    var urlObj = url.parse(req.url);
    var res_inmemory = memoryCache[urlObj.path];
    if (res_inmemory) {
      return res_inmemory.data;
    } else {
      // not in memory
      return db.get(urlObj.path).catch(async function() {
        //Not found. Go to the oada server, get the associated resource and path
        //leftover, and save the lookup.
        var resourceId;
        var pathLeftover;
        // _id passed in with request object; special case of recursiveUpsert
        if (req.resourceId) {
          resourceId = req.resourceId;
          pathLeftover = "";
        } else { // normal case, not recursiveUpsert
          //info('getLookup - HEAD request:', req.url, req)
          var headReq = _.cloneDeep(req)
          headReq.method = "HEAD";
          var response = await request(headReq);
          //info('getLookup - HEAD response:', response)
          //Save the url lookup for future use
          var pieces = response.headers["content-location"].split("/");
          resourceId = pieces.slice(1, 3).join("/"); //returns resources/abc
          pathLeftover =
            pieces.length > 3
              ? "/" + pieces.slice(3, pieces.length).join("/")
              : "";
        }
        // Put the new lookup
        var data = {
          _id: urlObj.path,
          resourceId,
          pathLeftover,
        };
        return handleMemoryCache(urlObj.path, data, undefined, req).then(() => {
          return getLookup(req);
        });
      });
    }
  }

  // Create a queue of actual PUTs to make when online.
  // Resource breaks are known via setupTree.
  // Do the puts, save out the resource IDs, and return to client
  // Create an index on the data to find those that need synced

  // Create a service that other apps can run which starts up and periodically
  // checks if a connections has yet been made. A periodic service may also
  // concievably check for updates to cached things.
  //
  // The cache should go "stale" after some period of time; However, if it cannot
  // establish a connection, it should remain valid, usable data.

  /**
   * Get resource from local DB. If the specified resource does not exist, try to get it from the server.
   * @param {any} req request
   * @param {any} offline default is false (online)
   */
  async function getResFromDb(req, offline = false, revLimit) {
    var urlObj = url.parse(req.url);
    var pieces = urlObj.path.split("/");
    var resourceId = pieces.slice(1, 3).join("/"); //returns resources/abc
    var pathLeftover =
      pieces.length > 3 ? "/" + pieces.slice(3, pieces.length).join("/") : "";
    var resource = undefined;
    var rev = undefined;
    // 1) Get resource from in-memory cache
    var res_inmemory = memoryCache[resourceId];
    if (res_inmemory && res_inmemory.valid) {
      resource = res_inmemory.data;
      info(`Returning the resource [${resourceId}] from in-memory cache.`);
    }

    // 2) Get resource from local DB
    if (!resource) {
      try {
        let res_localdb = await db.get(resourceId);
        /*
        if (!res_localdb.valid) {
          throw new Error("Invalid");
        }
        */
        resource = res_localdb;
        info(`Returning the resource [${resourceId}] from PouchDB.`);
        // Save the data to in-memory cache
        const now = Date.now();
        memoryCache[resourceId] = {
          data: resource,
          access: now,
          promise: undefined,
          putPending: false,
          valid: resource.valid,
        };
      } catch (err) {
        if (err.status === 404) {
          error("Failed to get resource from PouchDB", err);
        } else throw err;
      }
    }

    // 3) get resource from the server
    if (!resource && !offline) {
      info(`Returning the resource [${resourceId}] from the remote server.`);
      return getResFromServer(req);
    } else if (!resource && offline) {
      throw `Offline and resource [${resourceId}] not found in local db.`;
    }

    // Check if the resource is still valid
    if (
      resource.accessed + expiration <= Date.now() ||
      resource.valid === false
    ) {
      if (offline) {
        // offline. skip for now. TODO: add code later
        throw new Error(
          "Cached resource is expired or invalid and unable to fetch from the remote server.",
        );
      } else {
        info(
          `Resource is expired or invalid. Returning the resource [${resourceId}] from the remote server.`,
        );
        return getResFromServer(req);
      }
    }

    //Handle _rev passed in. If current object is too far out of date, get from server
    if (
      req.headers &&
      req.headers["x-oada-rev"] &&
      parseInt(req.headers["x-oada-rev"]) - parseInt(resource.doc._rev) >=
        revLimit
    ) {
      return getResFromServer(req);
    }

    //If no pathLeftover, it'll just return resource!
    if (pointer.has(resource.doc, pathLeftover)) {
      var data = pointer.get(resource.doc, pathLeftover);
      return {
        data,
        headers: {
          "x-oada-rev": resource.doc._rev,
          "content-location": resourceId + pathLeftover,
        },
        status: 200,
        cached: true,
      };
    } else {
      return getResFromServer(req);
    }
  }

  // Accepts an axios-style request. Returns:
  // {
  //
  //   data: the data requested,
  //
  //   _rev: the rev of the parent resource requested
  //
  //   location: e.g.: /resources/abc123/some/path/leftover
  //
  // }
  async function get(req, revLimit) {
    var urlObj = url.parse(req.url);
    var newReq = _.cloneDeep(req);
    if (!/^\/resources/.test(urlObj.path) || !/^\/users/.test(urlObj.path)) {
      // First lookup the resourceId in the cache
      var lookup = await getLookup(req);
      newReq.url =
        urlObj.protocol +
        "//" +
        urlObj.host +
        "/" +
        lookup.resourceId +
        lookup.pathLeftover;
    }
    return getResFromDb(newReq, OFFLINE, revLimit || REVLIMIT).then(
      response => {
        return response;
      },
    );
  }

  // TODO: Need to update the cache for both the parent resource and child new
  // resource if one is created
  async function put(req, offline = false) {
    let urlObj = url.parse(req.url);
    if (offline) {
      //TODO:
      // 1) get the lookup
      // 2) store the last known online record
      // 3) store the change request into an array of offlineChanges
      // 4) update the cache (but dirty it)
      var lookup = await getLookup({
        url:
          urlObj.protocol +
          "//" +
          urlObj.host +
          reqPieces.slice(0, reqPieces.length - 1).join("/"),
        headers: req.headers,
      });
    } else {
      var response = await request(req);

      // Invalidate the resource in the cache (if it is cached)
      await dbUpsert({
        url: response.headers["content-location"],
        data: req.data,
        _rev: parseInt(response.headers["x-oada-rev"]),
        // TODO: should it be invalidated until pulled from server?
        valid: false,
      });
      // Invalidate in-memory cache
      if (req.data && req.data._id && memoryCache[req.data._id]) {
        memoryCache[req.data._id].valid = false;
      }

      return response;
    }
  }

  // Remove the deleted key from the parent resource optimistically using
  // put(). Also mark the parent invalid as the _rev update will affect it
  async function updateParent(req) {
    var urlObj = url.parse(req.url);
    // Try to get the parent document
    var reqPieces = urlObj.path.split("/");
    var lookup = await getLookup({
      url:
        urlObj.protocol +
        "//" +
        urlObj.host +
        reqPieces.slice(0, reqPieces.length - 1).join("/"),
      headers: req.headers,
    });
    try {
    await dbUpsert({
      url:
        "/" +
        lookup.resourceId +
        lookup.pathLeftover +
        "/" +
        reqPieces[reqPieces.length - 1],
      method: "delete",
      valid: false,
    });
    } catch (err) {
      throw err;
    }
    return;
  }

  async function removeLookup(lookup) {
    // Clear the in-memory cache
    if (memoryCache[lookup._id]) {
      if (memoryCache[lookup._id].promise) {
        memoryCache[lookup._id].promise.cancel();
      }
      delete memoryCache[lookup._id];
    }

    try {
      await db.remove(lookup);
    } catch (err) {
      if (err.status === 404) {
        return; // Delete something thats already gone; no problem
      } else throw err;
    }
  }

  // Issue DELETE to server then update the db
  async function del(req, offline) {
    var urlObj = url.parse(req.url);
    // Handle resource deletion
    if (/^\/resources/.test(urlObj.path) || /^\/users/.test(urlObj.path)) {
      // Submit a dbUpsert to either remove the whole cache document or else
      // a key within a document
      await dbUpsert({
        url: req.url,
        method: req.method,
        valid: false,
      });
    } else {
      var lookup;
      try {
        lookup = await getLookup(req);

        if (lookup.pathLeftover) { // delete inside of a resource: update the document
          await dbUpsert({
            url: "/" + lookup.resourceId + lookup.pathLeftover,
            method: req.method,
            valid: false,
          });
        } else await updateParent(req); // Deleting a link: update the parent
        await removeLookup(lookup);
      } catch (err) {
        if (err.response.status !== 404) throw err;
      }
    }

    // Execute the request if we're online, else queue it up
    var response;
    if (!offline) {
      response = await request(req);
    }
    return response;
  }

  function replaceLinks(obj, req) {
    let ret = Array.isArray(obj) ? [] : {};
    if (!obj) {
      return obj;
    }
    Object.keys(obj || {}).forEach(async function(key, i) {
      let val = obj[key];
      if (typeof val !== "object" || !val) {
        ret[key] = val; // keep it asntType: 'application/vnd.oada.harvest.1+json'
        return;
      }
      if (val._meta) {
        // If has a '_rev' (i.e, resource), make it a link
        let lookup = await getLookup({
          url: req.url + "/" + key,
          headers: req.headers,
        });
        ret[key] = { _id: lookup.resourceId };
        if (obj[key]._rev !== undefined) {
          ret[key]._rev = obj[key]._rev;
        }
        return;
      }
      ret[key] = replaceLinks(obj[key], {
        url: req.url + "/" + key,
        headers: req.headers,
      }); // otherwise, recurse into the object
    });
    return ret;
  }

  async function _recursiveUpsert(req, body) {
    if (body._rev !== undefined) {
      let lookup = await getLookup({
        url: req.url,
        headers: req.headers,
        resourceId: body._id,
      });
      let newBody = replaceLinks(body, {
        url: req.url,
        headers: req.headers,
      });

      await dbUpsert({
        url: "/" + (body._id || lookup.resourceId),
        data: newBody,
      });
    }

    if (typeof body === "object") {
      return Promise.map(Object.keys(body || {}), async function(key) {
        if (key.charAt(0) === "_") {
          return;
        }
        if (!body[key]) {
          return;
        }
        await _recursiveUpsert(
          {
            url: req.url + "/" + key,
            headers: req.headers,
          },
          body[key],
        );
      });
    } else {
      return;
    }
  }

  function findNullValue(obj, path, nullPath) {
    if (typeof obj === "object") {
      return Promise.map(
        Object.keys(obj || {}),
        key => {
          if (obj[key] === null) {
            nullPath = path + "/" + key;
            return nullPath;
          }
          return findNullValue(obj[key], path + "/" + key, nullPath).then(
            res => {
              nullPath = res || nullPath;
              return res || nullPath;
            },
          );
        },
        { concurrency: 1 },
      ).then(() => {
        return nullPath;
      })
    } else {
      return Promise.resolve();
    }
  }

  /*
  async function _upsertChangeArray(payload) {
    let urlObj = url.parse(payload.request.url);
    return Promise.map(payload.response.changes || [], async (change) => {
      if (change.type === 'merge') {
        return dbUpsert({
          url: urlObj.protocol+'//'+urlObj.host+'/'+change._id,
          data: change.body,
        })
      } else if (change.type === 'delete') {
        var nullPath = await findNullValue(change.body, '', '')
        return dbUpsert({
          url: urlObj.protocol+'//'+urlObj.host+'/'+change._id+nullPath,
          data: change.body,
        })
      }
    })
  }
	*/

  // Will this handle watches put on keys of a resource? i.e., no _id to be found
  function findDeepestResource(obj, path, deepestResource) {
    if (typeof obj === "object") {
      return Promise.map(Object.keys(obj || {}), key => {
        // _rev updates guaranteed to be present in change docs for affected resources
        if (key === "_rev") {
          deepestResource.path = path;
          deepestResource.data = obj;
        } else if (key.charAt(0) === "_") {
          return deepestResource;
        }
        return findDeepestResource(
          obj[key],
          path + "/" + key,
          deepestResource,
        ).then(() => {
          return deepestResource;
        });
      }).then(() => {
        return deepestResource;
      });
    }
    return Promise.resolve(deepestResource);
  }

  var queue = cq()
    .limit({ concurrency: 1 })
    .process(async function(payload) {
      let urlObj = url.parse(payload.request.url);
      // Give the change body an _id so the deepest resource can be found
      payload.response.change.body = payload.response.change.body || {};
      payload.response.change.body._id = payload.response.resourceId;
      //TODO: This should be unnecessary. The payload ought to specify the root
      //of the watch as a resource.
      return findDeepestResource(payload.response.change.body, "", {
        path: "",
        data: payload.response.change.body,
      })
        .then(async deepestResource => {
          if (payload.response.change.wasDelete) {
            // DELETE: remove the deepest resource from the change body, execute
            // the delete, and recursively update all other revs in the cache
            let nullPath = await findNullValue(deepestResource.data, "", "");
            let deletedPath = deepestResource.path + nullPath;
            payload.nullPath = deletedPath;
            return dbUpsert({
              url: payload.request.url + deletedPath,
              headers: payload.request.headers,
              method: "delete",
              valid: true,
            }).then(async function() {
              // Update revs on all parents all the way down to (BUT OMITTING) the
              // resource on which the delete was called.
              //pointer.remove(payload.response.change.body, deepestResource.path || '/')
              //            await _recursiveUpsert(payload.request, payload.response.change.body)
              return payload;
            });
          } else {
            // Recursively update all of the resources down the returned change body
            /*
            var oldBody = await _recursiveUpsert(payload.request, payload.response.change.body, {})
            payload.oldBody = oldBody;
            return payload;
            */
            await _recursiveUpsert(
              payload.request,
              payload.response.change.body.data,
            );
            return payload;
          }
        })
        .catch(err => {
          return payload;
        });
    });

  function handleWatchChange(payload) {
    return queue(payload);
  }

  async function resetCache(name) {
    if (db) {
      Object.keys(memoryCache).forEach(async function(key) {
        if (memoryCache[key].promise) {
          await memoryCache[key].promise.cancel();
        }
      });
      memoryCache = {};
      await db.destroy();

    }
  }

  let api = function handleRequest(req) {
    switch (req.method) {
      case "get":
        return get(req);
      case "delete":
        return del(req);
      case "put":
        return put(req);
      default:
        throw new Error("Unknown request method.");
    }
  };

  return {
    api,
    db,
    resetCache,
    handleWatchChange,
    removeLookup,
    findDeepestResource,
    findNullValue,
    getLookup,
    dbUpsert,
    handleMemoryCache,
    doPut,
    _recursiveUpsert,
    findNullValue,
    replaceLinks,
    updateParent,
    getResFromDb,
    getResFromServer,
    _getMemoryCache,
  };
}
