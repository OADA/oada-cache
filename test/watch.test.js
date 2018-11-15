process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import Promise from 'bluebird'
import oada from '../src/index'
const pretty = require('prettyjson');
const _ = require('lodash');
const {expect} = require('chai');
const {token, domain} = require('./config.js');
const {tree, putResource, getConnections} = require('./utils.js');

var connections;
var expects = {};

async function setupWatch(connOne, tre, payload) {
	// create the endpoint to watch before watching
	var putOne = await connOne.put({
		path: '/bookmarks/test',
		data: {},
		tree: tre || tree,
	})
	expect(putOne.status).to.equal(204);
	//watch the endpoint
	var getOne = await connOne.get({
		path: '/bookmarks/test',
		tree: tre || tree,
		watch: {
			payload: payload || {someExtra: 'payload'},
			/*
			func: (pay) => {
				console.log(pay.response.headers['x-request-id'])
				expects[pay.response.headers['x-request-id']].forEach((exp) => {
					exp()
				})
			}*/
		}
	})
	expect(getOne.status).to.equal(200);
	return {putOne, getOne}
}

describe(`~~~~~~~~~~~WATCH~~~~~~~~~~~~~~`, function() {
	var connOne;
	var connTwo;
	before(`Create connection types`, async function() {
		connections = await getConnections({domain, token})
//		connections = Object.values(connections)
		connOne = connections['cYesWYes'];
		connTwo = connections['cNoWYes'];
	})

	it(`Watches should automatically update the cache when a single resource is created (single connection)`, async function() {
		this.timeout(8000);
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();
		var result = await setupWatch(connOne);
		expect(result.getOne.status).to.equal(200)
		// Execute a deep PUT below the watched resource
		var putTwo = await connTwo.put({
			path: '/bookmarks/test/aaa',
			tree,
			data: {	testAAA: 123 },
		})
		expect(putTwo.status).to.equal(204)
		await Promise.delay(1000)
		// Retreive the data to determine that its been cached
		var getTwo = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		// Compare the rev of the parent at /bookmarks/test
		var getOneRev = parseInt(result.getOne.headers['x-oada-rev'].split('-')[0]);
		var getTwoRev = parseInt(getTwo.headers['x-oada-rev'].split('-')[0]);

		expect(getOneRev < getTwoRev).to.equal(true)
		expect(getTwo.data.aaa).to.include.keys(['_id','_rev', 'testAAA'])
	})

	it(`Watches should automatically update the cache when a deep endpoint creates many resources (single connection)`, async function() {
		this.timeout(8000);
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();
		var result = await setupWatch(connOne);
		// Execute a deep PUT below the watched resource
		var putTwo = await connOne.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree,
			data: {	testAAA: 123 },
		})
		expect(putTwo.status).to.equal(204)
		// Retreive the data to determine that its been cached
		var getTwo = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		var getOneRev = parseInt(result.getOne.headers['x-oada-rev'].split('-')[0]);
		var getTwoRev = parseInt(getTwo.headers['x-oada-rev'].split('-')[0]);
		expect(getOneRev < getTwoRev).to.equal(true)

		var getThree = await connOne.get({
			path: '/bookmarks/test',
			tree,
		})
		expect(getThree.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee).to.include.keys(['_id','_rev', 'testAAA'])
	})

	it(`Should receive the watch changes from several concurrent PUTs to the server via another connection.`, async function() {
		this.timeout(20000);
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();

		// If we do not include the _rev on the deepest resource endpoint, we won't receive
		// the change notifications on our watch.
		var newTree = _.cloneDeep(tree)
		newTree.bookmarks.test.aaa.bbb['index-one']['*']['index-two']['*']['index-three']['*']._rev = '0-0';
		var result = await setupWatch(connOne, newTree);
		var putOne = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testOne: 123},
		})
		var putTwo = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/fff/index-three/eee',
			tree: newTree,
			data: {testTwo: 123},
		})
		var putThree = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ggg/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testThree: 123},
		})
		var putFour = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testFour: 123},
		})
		var join = await Promise.join(putOne,putTwo,putThree, putFour, async function(putOne,putTwo,putThree,putFour) {
			// Now give the watch time to push changes down to the cache
			await Promise.delay(8000);
			var response = await connOne.get({
				path: '/bookmarks/test',
				tree: newTree
			})

			var putOneRev = parseInt(putOne.headers['x-oada-rev'].split('-')[0]);
			var putTwoRev = parseInt(putTwo.headers['x-oada-rev'].split('-')[0]);
			var putThreeRev = parseInt(putThree.headers['x-oada-rev'].split('-')[0]);
			var putFourRev = parseInt(putFour.headers['x-oada-rev'].split('-')[0]);
			var maxRev = Math.max(putOneRev, putTwoRev, putThreeRev, putFourRev);
			var minRev = Math.min(putOneRev, putTwoRev, putThreeRev, putFourRev);

			var getOneRev = parseInt(result.getOne.headers['x-oada-rev'].split('-')[0]);
			var getTwoRev = parseInt(response.headers['x-oada-rev'].split('-')[0]);
			var responsePutTwo = parseInt(response.data.aaa.bbb['index-one'].ccc['index-two'].fff['index-three'].eee._rev.split('-')[0]);
			var responsePutThree = parseInt(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd['index-three'].eee._rev.split('-')[0]);
			var responseDERev = parseInt(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee._rev.split('-')[0]);
			var maxDERev = Math.max(putOneRev, putFourRev);

			expect(putTwoRev).to.equal(responsePutTwo)
			expect(putThreeRev).to.equal(responsePutThree)
			expect(responseDERev).to.equal(maxDERev)
			expect(getTwoRev).to.equal(parseInt(response.data._rev.split('-')[0]));

			expect(getOneRev < getTwoRev).to.equal(true)
			expect(getOneRev < maxRev).to.equal(true)
			expect(getOneRev < minRev).to.equal(true)

			expect(putOne.status).to.equal(204)
			expect(putTwo.status).to.equal(204)
			expect(putThree.status).to.equal(204)
			expect(response.status).to.equal(200)
			expect(response.status).to.equal(200)
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
	})

	it(`Should send a change feed when "offline" changes are made before a watch is set. This change feed should bring the cache up to date.`, async function() {
		this.timeout(15000);
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();

		var newTree = _.cloneDeep(tree)
		newTree.bookmarks.test.aaa.bbb['index-one']['*']['index-two']['*']['index-three']['*']._rev = '0-0';
		// First, get the resource into the cache
		var putOne = await connOne.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testOne: 123},
		})
		var putOneRev = parseInt(putOne.headers['x-oada-rev'].split('-')[0]);
		//Next, create several changes over a second connection
		var putTwo = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/fff/index-three/eee',
			tree: newTree,
			data: {testTwo: 123},
		})
		var putThree = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ggg/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testThree: 123},
		})
		var putFour = connTwo.put({
			path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
			tree: newTree,
			data: {testFour: 123},
		})
		var join = await Promise.join(putOne,putTwo,putThree, putFour, async function(putOne,putTwo,putThree,putFour) {

			// Now, after putting a bunch of documents, setup the watch. And wait for the changes to roll in.
			var result = await setupWatch(connOne, newTree);
			await Promise.delay(10000)
			var response = await connOne.get({
				path: '/bookmarks/test',
				tree: newTree
			})

			var putOneRev = parseInt(putOne.headers['x-oada-rev'].split('-')[0]);
			var putTwoRev = parseInt(putTwo.headers['x-oada-rev'].split('-')[0]);
			var putThreeRev = parseInt(putThree.headers['x-oada-rev'].split('-')[0]);
			var putFourRev = parseInt(putFour.headers['x-oada-rev'].split('-')[0]);
			var maxRev = Math.max(putOneRev, putTwoRev, putThreeRev, putFourRev);
			var minRev = Math.min(putOneRev, putTwoRev, putThreeRev, putFourRev);

			var getOneRev = parseInt(result.getOne.headers['x-oada-rev'].split('-')[0]);
			var getTwoRev = parseInt(response.headers['x-oada-rev'].split('-')[0]);
			var responsePutTwo = parseInt(response.data.aaa.bbb['index-one'].ccc['index-two'].fff['index-three'].eee._rev.split('-')[0]);
			var responsePutThree = parseInt(response.data.aaa.bbb['index-one'].ggg['index-two'].ddd['index-three'].eee._rev.split('-')[0]);
			var responsePutFour = parseInt(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee._rev.split('-')[0]);
			var responseDERev = parseInt(response.data.aaa.bbb['index-one'].ccc['index-two'].ddd['index-three'].eee._rev.split('-')[0]);
			var maxDERev = Math.max(putOneRev, putFourRev);

			expect(putTwoRev).to.equal(responsePutTwo)
			expect(putThreeRev).to.equal(responsePutThree)
			expect(responseDERev).to.equal(maxDERev)
			expect(getTwoRev).to.equal(parseInt(response.data._rev.split('-')[0]));

			expect(getOneRev).to.equal(getTwoRev)
			expect(getOneRev > maxRev).to.equal(true)
			expect(getOneRev > minRev).to.equal(true)

			expect(putOne.status).to.equal(204)
			expect(putTwo.status).to.equal(204)
			expect(putThree.status).to.equal(204)
			expect(response.status).to.equal(200)
			expect(response.status).to.equal(200)
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
		await connOne.delete({path:'/bookmarks/test', tree})
		await connOne.resetCache();
	})

	it(`Should receive watches from 10 independent connections`, async function() {
		this.timeout(20000);
		var newTree = _.cloneDeep(tree)
		newTree.bookmarks.test.aaa.bbb['index-one']['*']['index-two']['*']['index-three']['*']._rev = '0-0';

		var connection = await oada.connect({
			domain,
			token,
		})

		await connection.put({
			path: '/bookmarks/test',
			data: {sometest: i},
			type: 'application/json'
		})

		var response = await connection.get({
			path: '/bookmarks/test',
			watch: {
				payload: {someExtra: 'payload'},
			}
		})
		expect(response.status).to.equal(200)

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
					data: { [`put${j}`]: `value${j}`},
				})
			}
		})

		await Promise.delay(15000);

		var getOne = await connection.get({
			path: '/bookmarks/test',
		})
		expect(getOne.cached).to.equal(true)
		for (var i = 0; i < 10; i++) {
			for (var k = 0; k < 25; k++) {
				expect(getOne.data['conn'+i]).to.include.key('put'+k)
			}
		}

		// Now wipe out all of the caches
		await Promise.map(testConnections, async function(conn, i) {
			await conn.resetCache();
		})
	
	})

  it('Now clean up', async function() {
		await connOne.resetCache();
		await connOne.delete({path:'/bookmarks/test', tree})
  })
})
