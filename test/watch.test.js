process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const oada = require("../src/index");
const Promise = require("bluebird");
const pretty = require("prettyjson");
const _ = require("lodash");
const { expect } = require("chai");
const { token, domain } = require("./config.js");
const { tree, getConnections } = require("./utils.js");
oada.setDbPrefix("./test/test-data/");
var expecting = false;

var connections;
var expects = {};

async function setupWatch(conn, tre, payload) {
  //watch the endpoint
  var getOne = await conn.get({
    path: "/bookmarks/test",
    tree: tre || tree,
    watch: {
      payload: payload || { someExtra: "payload" },
      callback: pay => {
        //console.log("received a watch change", pay.response.change.body);
      },
    },
  });
  expect(getOne.status).to.equal(200);
  return { getOne };
}

describe(`~~~~~~~~~~~WATCH~~~~~~~~~~~~~~`, function() {
  var connOne;
  var connTwo;
  before(`Create connection types`, async function() {
    connections = await getConnections({ domain, token });
    connOne = connections[3];
    connTwo = connections[2];
  });

  it(`1. Watches should automatically update the cache when a single resource is created (single connection)`, async function() {
    this.timeout(20000);
    await connOne.delete({ path: "/bookmarks/test", tree });
    await connOne.resetCache();
    // create the endpoint to watch before watching
    var putOne = await connOne.put({
      path: "/bookmarks/test",
      data: {},
      tree: tree,
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2');

		var result = await setupWatch(connOne);
		expect(result.getOne.status.toString().charAt(0)).to.equal('2')
		// Execute a deep PUT below the watched resource
		var putTwo = await connTwo.put({
			path: '/bookmarks/test/aaa',
			tree,
			data: {	testAAA: 123 },
		})
		expect(putTwo.status.toString().charAt(0)).to.equal('2')
		await Promise.delay(1000)
		// Retreive the data to determine that its been cached
		var getTwo = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		// Compare the rev of the parent at /bookmarks/test
		var getOneRev = parseInt(result.getOne.headers['x-oada-rev']);
		var getTwoRev = parseInt(getTwo.headers['x-oada-rev']);

		expect(getOneRev < getTwoRev).to.equal(true)
		expect(getTwo.data.aaa).to.include.keys(['_id','_rev', 'testAAA'])
	})

	it(`2. Watches should automatically update the cache when a deep endpoint creates many resources (single connection)`, async function() {
		this.timeout(20000);
		await connOne.delete({path:'/bookmarks/test', tree})
    await connOne.resetCache();
    // create the endpoint to watch before watching
    var putOne = await connOne.put({
      path: "/bookmarks/test",
      data: {},
      tree: tree,
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2');
		var result = await setupWatch(connOne);
		// Execute a deep PUT below the watched resource
		var putTwo = await connOne.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree,
			data: {	testAAA: 123 },
		})
		expect(putTwo.status.toString().charAt(0)).to.equal('2')
		// Retreive the data to determine that its been cached
		var getTwo = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		var getOneRev = parseInt(result.getOne.headers['x-oada-rev']);
		var getTwoRev = parseInt(getTwo.headers['x-oada-rev']);
		expect(getOneRev < getTwoRev).to.equal(true)

		var getThree = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		expect(getThree.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee).to.include.keys(['_id','_rev', 'testAAA'])
  })

	it(`3. Should receive the watch changes from several concurrent PUTs to the server via another connection`, async function() {
		this.timeout(45000);
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();

    // If we do not include the _rev on the deepest resource endpoint, we won't receive
    // the change notifications on our watch.
    var newTree = _.cloneDeep(tree);
    newTree.bookmarks.test.aaa.bbb["index-one"]["*"]["index-two"]["*"][
      "index-three"
    ]["*"]._rev = 0;
    // Create the endpoint to watch before watching
    var putOne = await connOne.put({
      path: "/bookmarks/test",
      data: { foo: "bar" },
      tree: newTree,
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2');

    await Promise.delay(2000);
    // Begin watching on connection one.
    var result = await setupWatch(connOne, newTree);
    await Promise.delay(2000);
    expect(result.getOne.status.toString().charAt(0)).to.equal('2');
    // Make concurrent PUT requests over a second connection.
    putOne = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee",
      tree: newTree,
      data: { testOne: 123 },
    });

    var putTwo = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/fff/index-three/eee",
      tree: newTree,
      data: { testTwo: 123 },
    });

    var putThree = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ggg/index-two/ddd/index-three/eee",
      tree: newTree,
      data: { testThree: 123 },
    });

    var putFour = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee",
      tree: newTree,
      data: { testFour: 123 },
    });

    // Wait for the set of requests to complete by joining the promises.
    await Promise.join(putOne,putTwo,putThree, putFour, (One, Two, Three, Four)=> {
      putOne = One;
      putTwo = Two;
      putThree = Three;
      putFour = Four;
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2')
    expect(putTwo.status.toString().charAt(0)).to.equal('2')
    expect(putThree.status.toString().charAt(0)).to.equal('2')
    expect(putFour.status.toString().charAt(0)).to.equal('2')
		// The server needs a brief moment to send down watch notifications
    await Promise.delay(5000);
    // Now fetch the data to verify results.
    var response = await connOne.get({
      path: "/bookmarks/test",
      tree: newTree,
    });
    var putOneRev = parseInt(putOne.headers["x-oada-rev"]);
    var putTwoRev = parseInt(putTwo.headers["x-oada-rev"]);
    var putThreeRev = parseInt(putThree.headers["x-oada-rev"]);
    var putFourRev = parseInt(putFour.headers["x-oada-rev"]);
    var maxRev = Math.max(putOneRev, putTwoRev, putThreeRev, putFourRev);
    var minRev = Math.min(putOneRev, putTwoRev, putThreeRev, putFourRev);

    var getOneRev = parseInt(result.getOne.headers["x-oada-rev"]);
    var getTwoRev = parseInt(response.headers["x-oada-rev"]);
    var responsePutTwo = parseInt(
      response.data.aaa.bbb["index-one"].ccc["index-two"].fff["index-three"].eee
        ._rev,
    );
    var responsePutThree = parseInt(
      response.data.aaa.bbb["index-one"].ggg["index-two"].ddd["index-three"].eee
        ._rev,
    );
    var responseDERev = parseInt(
      response.data.aaa.bbb["index-one"].ccc["index-two"].ddd["index-three"].eee
        ._rev,
    );

    expect(putTwoRev).to.equal(responsePutTwo);
    expect(putThreeRev).to.equal(responsePutThree);
    expect(getTwoRev).to.equal(parseInt(response.data._rev));

    expect(getOneRev < getTwoRev).to.equal(true)

    expect(putOne.status.toString().charAt(0)).to.equal('2')
    expect(putTwo.status.toString().charAt(0)).to.equal('2')
    expect(putThree.status.toString().charAt(0)).to.equal('2')
    expect(response.status.toString().charAt(0)).to.equal('2')
    expect(response.status.toString().charAt(0)).to.equal('2')
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', '_type', 'aaa'])
    expect(response.data.aaa).to.include.keys(['_id', '_rev', 'bbb', '_type'])
    expect(response.data.aaa.bbb).to.include.keys(['_id', '_rev', 'index-one', '_type'])
    expect(response.data.aaa.bbb['index-one']).to.include.keys(['ccc', 'ggg'])
    expect(response.data.aaa.bbb['index-one'].ccc).to.include.keys(['_id', '_rev', '_type', 'index-two'])
    expect(response.data.aaa.bbb['index-one'].ggg).to.include.keys(['_id', '_rev', '_type', 'index-two'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two']).to.include.keys(['ddd', 'fff'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].fff).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testOne', 'testFour'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].fff['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testTwo'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two']).to.include.keys(['ddd'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testThree'])
    expect(response.cached).to.equal(true)
  })
 
  xit(`4. Should send a change feed when "offline" changes are made before a watch is set. This change feed should bring the cache up to date.`, async function() {
    this.timeout(40000);
    await connOne.delete({ path: "/bookmarks/test", tree });
    await connOne.resetCache();

    var newTree = _.cloneDeep(tree);
    newTree.bookmarks.test.aaa.bbb["index-one"]["*"]["index-two"]["*"][
      "index-three"
    ]["*"]._rev = 0;
    // First, get the resource into the cache
    var putOne = await connOne.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee",
      tree: newTree,
      data: {testOne: 123},
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2')
    // Validate the cache by doing gets
    var getOne = await connOne.get({
      path: "/bookmarks/test",
      tree: newTree,
    });
    //Next, create several changes over a second connection
    var putTwo = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/fff/index-three/eee",
      tree: newTree,
      data: { testTwo: 123 },
    });
    var putThree = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ggg/index-two/ddd/index-three/eee",
      tree: newTree,
      data: { testThree: 123 },
    });
    var putFour = connTwo.put({
      path:
        "/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee",
      tree: newTree,
      data: { testFour: 123 },
    });
    await Promise.join(putTwo, putThree, putFour, async function(
      Two,
      Three,
      Four,
    ) {
      putTwo = Two;
      putThree = Three;
      putFour = Four;
    })
    expect(putTwo.status.toString().charAt(0)).to.equal('2')
    expect(putThree.status.toString().charAt(0)).to.equal('2')
    expect(putFour.status.toString().charAt(0)).to.equal('2')
    await Promise.delay(5000)
    // Now, setup the watch and wait for the "offline" changes to get pushed
    var result = await setupWatch(connOne, newTree);
    await Promise.delay(2000);
    // Wait out the watch notifications
    // Now retrieve the data tree to verify results
    var response = await connOne.get({
      path: "/bookmarks/test",
      tree: newTree,
    });

    var putOneRev = parseInt(putOne.headers["x-oada-rev"]);
    var putFourRev = parseInt(putFour.headers["x-oada-rev"]);
    var putTwoRev = parseInt(putTwo.headers["x-oada-rev"]);
    var putThreeRev = parseInt(putThree.headers["x-oada-rev"]);
    var maxRev = Math.max(putOneRev, putTwoRev, putThreeRev, putFourRev);
    var minRev = Math.min(putOneRev, putTwoRev, putThreeRev, putFourRev);
    var maxRev = Math.max(putOneRev, putFourRev);
    var minRev = Math.min(putOneRev, putFourRev);

    var getOneRev = parseInt(result.getOne.headers["x-oada-rev"]);
    var getTwoRev = parseInt(response.headers["x-oada-rev"]);
    var responsePutTwo = parseInt(
      response.data.aaa.bbb["index-one"].ccc["index-two"].fff["index-three"].eee
        ._rev,
    );
    var responsePutThree = parseInt(
      response.data.aaa.bbb["index-one"].ggg["index-two"].ddd["index-three"].eee
        ._rev,
    );
    var responsePutFour = parseInt(
      response.data.aaa.bbb["index-one"].ccc["index-two"].ddd["index-three"].eee
        ._rev,
    );
    var responseDERev = parseInt(
      response.data.aaa.bbb["index-one"].ccc["index-two"].ddd["index-three"].eee
        ._rev,
    );
    var maxDERev = putFourRev;

    expect(putTwoRev).to.equal(responsePutTwo);
    expect(putThreeRev).to.equal(responsePutThree);
    expect(responseDERev).to.equal(maxDERev);
    expect(getTwoRev).to.equal(parseInt(response.data._rev));
    expect(getTwoRev > maxRev).to.equal(true)
    expect(getOneRev < minRev).to.equal(true)

    expect(response.status.toString().charAt(0)).to.equal('2')
    expect(response.status.toString().charAt(0)).to.equal('2')
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.data).to.include.keys(['_id', '_rev', '_type', 'aaa'])
    expect(response.data.aaa).to.include.keys(['_id', '_rev', 'bbb', '_type'])
    expect(response.data.aaa.bbb).to.include.keys(['_id', '_rev', 'index-one', '_type'])
    expect(response.data.aaa.bbb['index-one']).to.include.keys(['ccc', 'ggg'])
    expect(response.data.aaa.bbb['index-one'].ccc).to.include.keys(['_id', '_rev', '_type', 'index-two'])
    expect(response.data.aaa.bbb['index-one'].ggg).to.include.keys(['_id', '_rev', '_type', 'index-two'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two']).to.include.keys(['ddd', 'fff'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].fff).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testOne', 'testFour'])
    expect(response.data.aaa.bbb['index-one'].ccc['index-two'].fff['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testTwo'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two']).to.include.keys(['ddd'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd).to.include.keys(['_id', '_rev', '_type', 'index-three'])
    expect(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd['index-three'].eee).to.include.keys(['_id', '_rev', '_type', 'testThree'])
    expect(response.cached).to.equal(true)

    await connOne.delete({path:'/bookmarks/test', tree})
    await connOne.resetCache();
  })

	it(`5. Should receive watches from 10 independent connections`, async function() {
		this.timeout(50000);

		var connection = await oada.connect({
			domain,
			token,
		})

		await connection.put({
			path: '/bookmarks/test',
			data: {sometest: i},
      tree,
		})

		var response = await connection.get({
			path: '/bookmarks/test',
			watch: {
				payload: {someExtra: 'payload'},
			}
		})
		expect(response.status.toString().charAt(0)).to.equal('2')

		// Create 10 connections
		var testConnections = [];
		for (var i = 0; i < 10; i++) {
			testConnections.push(await oada.connect({
				domain,
				token,
				cache: {name: 'connection'+i.toString()}
			}))
		}
		
		await Promise.map(testConnections, async function(conn, i) {
			for (var j = 0; j < 25; j++) {
				conn.put({
					path: '/bookmarks/test/conn'+i,
					type: 'application/json',
          tree,
					data: { [`put${j}`]: `value${j}`},
				})
			}
		})

		await Promise.delay(35000);

		var getOne = await connection.get({
			path: '/bookmarks/test',
		})
//		expect(getOne.cached).to.equal(true)
		for (var i = 0; i < 10; i++) {
      for (var k = 0; k < 25; k++) {
				expect(getOne.data['conn'+i]).to.include.key('put'+k)
			}
		}
		// Now wipe out all of the caches
		await Promise.map(testConnections, async function(conn, i) {
			await conn.resetCache();
		})

    await connection.put({
      path: "/bookmarks/test",
      data: { sometest: i },
      tree
    });

    var watch_count = 0;

    var response = await connection.get({
      path: "/bookmarks/test",
      watch: {
        payload: { someExtra: "payload" },
        callback: pay => {
          watch_count++;
        },
      },
    });
    expect(response.status).to.equal(200);

    // Create 10 connections
    var testConnections = [];
    for (var i = 0; i < 10; i++) {
      testConnections.push(
        await oada.connect({
          domain,
          token,
          cache: { name: "connection" + i.toString() },
        }),
      );
    }

    await Promise.map(testConnections, async function(conn, i) {
      await conn.put({
        path: "/bookmarks/test",
        data: { [`conn`+i]: { 'put': 'value' }},
        tree
      });
    });

    await Promise.delay(2000);

    var getOne = await connection.get({
      path: "/bookmarks/test",
    });
    expect(watch_count).to.equal(10);
    for (let i = 0; i < 10; i++) {
      expect(getOne.data["conn" + i]).to.include.key("put");
    }
    // Now wipe out all of the caches
    await Promise.map(testConnections, async function(conn, i) {
      await conn.resetCache();
    });
  });

  it(`6. Should not send a change feed when the rev difference due to "offline" changes is greater than 10. Instead, the whole resource should simply be sent.`, async function() {
    this.timeout(25000);
    await connOne.delete({ path: "/bookmarks/test", tree });
    await connOne.resetCache();
    var newTree = _.cloneDeep(tree);
    // First, get the resource into the cache
    var putOne = await connOne.put({
      path: "/bookmarks/test/aaa",
      tree: newTree,
      data: {testOne: 123},
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2')
    // Validate the cache by doing gets
    var getOne = await connOne.get({
      path: "/bookmarks/test",
      tree: newTree,
    });
    //Next, create several changes over a second connection
    for (var j = 0; j < 11; j++) {
      await connTwo.put({
        path: "/bookmarks/test/aaa",
        type: "application/json",
        data: { [`put${j}`]: `value${j}` },
      });
    }

    await Promise.delay(10000);

    var getT = await connTwo.get({
      path: "/bookmarks/test",
    });

    var getTwo = await connTwo.get({
      path: "/bookmarks/test/aaa",
    });
    // Make sure the puts made it to the server
    for (var j = 0; j < 11; j++) {
      expect(getTwo.data).to.include.key("put" + j);
    }

    // Now, setup the watch and wait for the "offline" changes to get pushed
    var result = await setupWatch(connOne, newTree);
    await Promise.delay(5000);
    // Wait out the watch notifications
    // Now retrieve the data tree to verify results
    var response = await connOne.get({
      path: '/bookmarks/test',
      tree: newTree
    })

    expect(response.status.toString().charAt(0)).to.equal('2')
    expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
    expect(response.cached).to.equal(true)
    expect(response).to.include.keys(['data'])
    expect(response.data)
		for (var j = 0; j < 11; j++) {
		  expect(response.data['aaa']).to.include.key('put'+j)
		}
    await connOne.delete({path:'/bookmarks/test', tree})
    await connOne.resetCache();
  });

  xit(`7. The tree is needed to decide what documents to sync given a change document where a link connected to a large, preexisting tree`, async function() {
    this.timeout(15000);
    var newTree = {
      bookmarks: {
        aaa: _.cloneDeep(tree.bookmarks.test.aaa),
        _type: "application/vnd.oada.bookmarks.1+json",
        _rev: 0,
      },
    };
    // Add some extra subtree so we can create it quickly
    newTree.bookmarks.aaa.ddd = _.cloneDeep(tree.bookmarks.test.aaa.bbb);

		await connOne.delete({path:'/bookmarks/aaa', tree:newTree})
		await connOne.delete({path:'/bookmarks/test', tree})
    await connOne.resetCache();

    // Create a tree of data that isn't cached locally
		var putOne = await connTwo.put({
      path: '/bookmarks/aaa/bbb/index-one/ccc',
			data: {putOne: 'bar'},
      tree: newTree
    })
    expect(putOne.status.toString().charAt(0)).to.equal('2');

    // Put to some other path that isn't in the original tree. This path should
    // be omitted when it is linked to the other tree
    var putTwo = await connTwo.put({
      path: '/bookmarks/aaa/ddd/index-one/ccc/index-two/ddd',
			data: {putTwo: 'foo'},
      tree: newTree
    })
    expect(putTwo.status.toString().charAt(0)).to.equal('2');

    // Create the bookmarks/test endpoint we're going to watch
    var putThree = await connOne.put({
      path: '/bookmarks/test',
			data: {putThree: 'foo'},
      tree
    })
    expect(putThree.status.toString().charAt(0)).to.equal('2');

    // Setup the watch on bookmarks/test
    var result = await setupWatch(connOne, tree);
    await Promise.delay(5000);

    var getOne = await connOne.get({
      path: '/bookmarks/aaa',
    })
    expect(getOne.status.toString().charAt(0)).to.equal('2');

    // Now link to the pre-existing tree and watch the changes come in.
    var putFour = await connTwo.put({
      path: '/bookmarks/test',
			data: {aaa: {_id: getOne.data._id, _rev: getOne.data._rev}},
      tree
    })
    expect(putFour.status.toString().charAt(0)).to.equal('2');

    // Wait for the changes to propagate back
    await Promise.delay(5000)

    // Retrieve the data with a recursive GET, which should now include the
    // linked data.
    var getTwo = await connOne.get({
      path: '/bookmarks/test',
      tree
    })
    expect(getTwo.status.toString().charAt(0)).to.equal('2');

    // The linked data should now be present
    expect(getTwo.data.aaa.bbb['index-one'].ccc).to.include.keys(['_id', '_rev', '_type', 'putOne'])

    // Everything should've been cached
    expect(getTwo.cached).to.equal(true)

    // The watch should've filtered stuff out that isn't in the watched tree
    // aaa.ddd should exists as a link, but should have no other content (putTwo should not have been retrieved)
    expect(getTwo.data.aaa.ddd).to.have.keys(['_id', '_rev'])
  })


  xit(`8. Messages should cease to be transmitted after calling unwatch`, async function() {
    this.timeout(10000);
    // Setup a counter of watch messages received.
    let counter = 0;

    var getOne = await connOne.get({
      path: '/bookmarks/test',
      tree,
      watch: {
        payload: {someExtra: 'payload'},
        callback: (pay) => {
          counter++;
          console.log('received a thing');
        }
      }
    })
    await Promise.delay(3000);

    // Produce a message
    await connOne.put({
      path: `/bookmarks/test`,
      tree,
      data: {"foo": "bar"}
    })
    expect(counter).to.equal(1);

    await connOne.delete({
      unwatch: true,
      path: `/bookmarks/test`,
      tree,
    })

    await connOne.put({
      path: `/bookmarks/test`,
      tree,
      data: {"footwo": "bar"}
    })
    expect(counter).to.equal(1);
  })
 
  xit('Now clean up', async function() {
    this.timeout(6000);
		await connOne.resetCache();
		await connOne.delete({path:'/bookmarks/test', tree})
  })
});
