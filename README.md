# oada-cache

A client tool for interacting with an [OADA server](https://www.github.com/OADA/oada-srvc-docker/) instance. It can be used for fully cached web applications, data import scripts, IoT devices streaming data, and back-end microservices.

## Installation
`npm install @oada/oada-cache`

`var oada = require("@oada/oada-cache")`


#### connect
```javascript
var connection = await oada.connect({
  domain: "https://api.oada.com",
  options: {
    redirect: "http://localhost:8000/oauth2/redirect.html",
    metadata: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    scope: "oada.yield:all"
  }
})
```
This will initiate OADA OAUTH-style authentication.

#### get
```javascript
var response = await connection.get({path: '/bookmarks/test'})
```

#### put
```javascript
var response = await connection.put({
  path: "/bookmarks/test",
  data: { "power_level": 9001},
  headers: {"Content-Type": "application/json"}
})

```
#### post
```javascript
var response = await connection.post({
  path: "/bookmarks/test",
  data: { "power_level": 9001},
  headers: {"Content-Type": "application/json"}
})
var  = response.headers["content-location"]; // A path including the uuid created

```
#### delete
```javascript
var response = await connection.delete({
  path: "/bookmarks/test",
  headers: {"Content-Type": "application/json"}
})
```

## "Advanced" API
#### tree
A `tree` option can be used in many of the `oada-cache` API calls as a means to specify the data structure you intend to create or pull from the OADA server. It is used to represent a particular subgraph on the sever. The use of a `_type` key in the tree indicates that a resource break exists at this particular level of the tree and a link should be used to connect the parent resource to the resource(s) at this location. A `_rev` key in the tree indicates that _versioned_ links should be created at this location; versioned links indicate that the parent will be updated with new revision numbers (`_rev`) each time the linked child resource is altered. A `*` key in the tree represents a placeholder when a particular key cannot be specified.

```javascript
var todoTree = {
  "bookmarks": { //Represents a user's "home" directory
    "_type": "application/vnd.oada.bookmarks.1+json",
    "_rev": 0,
    "todoList": {
      "_type": "application/vnd.oada.todoList.1+json",
      "_rev": 0,
      "todo-index": {
        "*": {
          "_type": "application/vnd.oada.todoItem.1+json",
      	  "_rev": 0,
        }
      }
    }
  }
};
```


#### get
Using the `tree` option for recursive retrieval of en entire OADA subgraph:
```javascript
var response = await connection.get({
  path: "/bookmarks/todoList",
  tree: todoTree
})
```
GETs that include this tree option will recursively retreive and merge the data into the object returned. In this example, the `tree` option tells it to recursively GET all of the data below the object at the given path. The `*` key matches all keys in the `todo-index` object; since each of these are a link to a resource, GETs will be performed to retreive each of these resources.


#### put
Using the `tree` option to execute a "smart PUT", ensuring that all parent resources will be created on the server.
```javascript
var response = await connection.put({
  path: "/bookmarks/todoList/todo-index/fj029j52-mc20m23c23",
  data: {"order": 1, text: "get groceries"},
  headers: {"Content-Type": "application/vnd.oada.todoItem"},
  tree: todoTree
})
```
A PUT of this variety may actually result in several PUTs. For example, when `/bookmarks` is an empty object, the above PUT request will resources for the objects at `/bookmarks/todoList` and `/bookmarks/todoList/todo-index/fj029j52-mc20m23c23`.

#### post
POSTs including the `tree` option are identical to PUT requests except a uuid is appended to the given request `path`.

#### delete
Using the `tree` option on a DELETE request will recursively DELETE all resources and links below the request `path`.
```javascript
var response = await connection.delete({
  path: "/bookmarks/todoList",
  headers: {"Content-Type": "application/vnd.oada.todoList.1+json"},
  tree: todoTree
})
```

## Watch
Resource watching provides a change feed of updates on demand from the resource rooted at the given `path`. Watches are implemented as an extension of a GET request when the 'watch' key is supplied. When a watch is established, it will automatically keep the cache synced with the incoming change feed. When a watch is initiated, the current `_rev` of the resources is automatically passed along, and any remote changes will be pushed down to bring that resource up to date. The optional `callback` key of the `watch` object is used to supply a callback function as changes are received; this callback receives a `payload` argument containing the change. The `payload` key of the `watch` object is used to supply additional data to the callback payload.
```javascript
const watchHandler = function(payload) {
  console.log(payload); // {foo: 'bar', response: {...}, request: {...}}
  console.log(payload.response.change.type); // Either 'merge' or 'delete' given the particular change that occurred.
  console.log(payload.response.change.body); //JSON object rooted at the watch path '/bookmarks/todoList'; For deletes, this sparse tree terminates at a key with the value `null` to indicate the deleted key.
}

var response = await connection.get({
  path: "/bookmarks/todoList",
  watch: {
    payload: { foo: 'bar' }
    callback: watchHandler
  }
});
```




### Developing against an application
To further develop this library against e.g., a runnning application, utilize the `npm run build-watch` command to continuously build the source code. Utilize the `npm run dev` command to watch for changes to the built code and copy it into another project directory (e.g., node_modules of an application being developed); you must first set the `APP_DIR` environment variable to the root path of a directory containing a node_modules directory.
