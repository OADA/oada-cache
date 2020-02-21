process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;
const axios = require("axios");
const pretty = require("prettyjson");
const Promise = require("bluebird");
const _ = require("lodash");
var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
var expect = chai.expect;
const { token, domain } = require("./config.js");
const { tree, getConnections } = require("./utils.js");

var resources = [];
var connections;

describe(`------------PUT-----------------`, async function() {
	before(`Create connection types`, async function() {
		connections = await getConnections({
			domain,
			token: 'def',
		})
	})

	for (let i = 0; i < 4; i++) {
    describe(`Testing connection ${i+1}`, async function() {
			it(`1. Should error when neither 'url' nor 'path' are supplied`, async function() {
				console.log(`Cache: ${connections[i].cache ? true : false}; Websocket: ${connections[i].websocket ? true : false}`)
				return expect(connections[i].put({
					data: `"abc123"`,
					tree,
					type: 'application/json'
				})).to.be.rejectedWith(Error, 'Either path or url must be specified.')
			})

			it(`2. Shouldn't error when the 'Content-Type' header can be derived from the '_type' key in the PUT body`, async function() {
				var response = await connections[i].put({
					path: '/bookmarks/test/sometest',
					data: { _type: 'application/json'},
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
			})   

			it(`3. Shouldn't error when the 'Content-Type' header can be derived from the 'type' key`, async function() {
				var response = await connections[i].put({
					path: '/bookmarks/test/somethingnew',
					data: `"abc123"`,
					type: 'application/json'
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
			})

			it(`4. Shouldn't error when 'Content-Type' header is specified.`, async function() {
				var response = await connections[i].put({
					path: '/bookmarks/test/somethingnew',
					data: `"abc123"`,
					headers: {'Content-Type': 'application/json'}
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
			})

      it(`5. Shouldn't error when 'Content-Type' header (_type) can be derived from the 'tree'`, async function() {
        this.timeout(5000);
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();

				var response = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/sometest',
					tree,
					data: `"abc123"`,
				}).catch((err) => {
          console.log('ERRRRRRRRRRRRRRR', err);
        })
				expect(response.status.toString().charAt(0)).to.equal('2')
			})

      it(`6. Should error when _type cannot be derived from the above tested sources`, async function() {
        return expect(
          connections[i].put({
            path: "/bookmarks/test/sometest",
            data: `"abc123"`,
          })
        ).to.be.rejectedWith(Error, `content-type header must be specified.`);
      });

      it(`7. Should produce a 403 error when using a content-type header for which your token does not have access to read/write`, async function() {
        this.timeout(4000);
        await connections[i].delete({ path: "/bookmarks/test", tree });
        await connections[i].resetCache();
        return expect(
          connections[i].put({
            path: "/bookmarks/test/aaa/bbb/index-one/ccc",
            headers: { "Content-Type": "application/vnd.oada.foobar.1+json" },
            tree: tree,
            data: { anothertest: 123 },
          })
        ).to.be.rejectedWith(Error, "Request failed with status code 403");
      });

			it(`9. Should properly create a single new resource. The link _rev should not remain as 0`, async function() {
        await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].put({
					path: '/bookmarks/test',
					data: {'sometest': 123},
					tree,
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				response = await connections[i].get({
					path: '/bookmarks',
					tree
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'test'])
        expect(response.data.test._rev).not.to.equal(0)
			})

			it(`10. Should create the proper resource breaks on the server when a 'tree' parameter is supplied to a deep endpoint`, async function() {
				this.timeout(4000)
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
					data: {"test": "some test"},
					tree,
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				response = await connections[i].get({
					path: '/bookmarks/test/aaa',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa',
				})
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
				expect(response.data.bbb).to.have.keys(['_id', '_rev'])
				expect(response.data.bbb).to.not.include.keys(['index-one'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
				expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
				expect(response.data['index-one']).to.include.keys(['ccc'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['ccc'])
				expect(response.data.ccc).to.have.keys(['_id', '_rev'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_type', '_rev', 'index-two'])
				expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['ddd'])
				expect(response.data['ddd']).to.have.keys(['_id', '_rev'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_type', '_rev', 'index-three'])
				expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
				expect(response.data['index-three']).to.include.keys(['eee'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['eee'])
				expect(response.data['eee']).to.have.keys(['_id'])
				expect(response.data['eee']).to.not.have.keys(['_rev'])

				await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
				})
				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				if (connections[i].cache) {
					expect(response.cached).to.equal(true)
				}
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'test'])
				expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
			})

			it(`11. Should allow for a PUT request without a 'tree' parameter`, async function() {
				this.timeout(4000)
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee/test/123',
					type: 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
					data: `"some test"`,
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])

				response = await connections[i].get({
					path: '/bookmarks/test',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.have.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['aaa'])
				expect(response.data.aaa).to.not.have.keys(['_id', '_rev'])
				expect(response.data.aaa).to.include.keys(['bbb'])
			})

      it(`12. Should create the proper resource if we PUT to a different path on an existing subtree`, async function() {
        this.timeout(6000);
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh/test/123',
					type: 'application/vnd.oada.as-harvested.yield-moisture-dataset.1+json',
					data: `"some test"`,
					tree,
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				response = await connections[i].get({
					path: '/bookmarks/test',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'aaa'])
				expect(response.data.aaa).to.have.keys(['_id', '_rev'])
				expect(response.data.aaa).to.not.include.keys(['bbb'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'bbb'])
				expect(response.data.bbb).to.have.keys(['_id', '_rev'])
				expect(response.data.bbb).to.not.include.keys(['index-one'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'index-one'])
				expect(response.data['index-one']).to.not.include.keys(['_id', '_rev'])
				expect(response.data['index-one']).to.include.keys(['ccc'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one',
        })
        expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['ccc'])
				expect(response.data.ccc).to.have.keys(['_id', '_rev'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'index-two'])
				expect(response.data['index-two']).to.not.include.keys(['_id', '_rev'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['ggg'])
				expect(response.data['ggg']).to.have.keys(['_id', '_rev'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'index-three'])
				expect(response.data['index-three']).to.not.include.keys(['_id', '_rev'])
				expect(response.data['index-three']).to.include.keys(['hhh'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.not.include.keys(['_id', '_rev'])
				expect(response.data).to.include.keys(['hhh'])
				expect(response.data['hhh']).to.have.keys(['_id'])
				expect(response.data['hhh']).to.not.have.keys(['_rev'])

				response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ggg/index-three/hhh',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'test'])
				expect(response.data['test']).to.not.include.keys(['_id', '_rev'])
			})

			it(`13. Should use an _id specified via the 'tree'`, async function() {
				this.timeout(4000)
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var newTree = _.cloneDeep(tree)
				newTree.bookmarks.test.aaa.sss = {
					_id: 'resources/sssssssss',
					_type: 'application/vnd.oada.yield.1+json',
					_rev: 0
				}
				var putResponse = await connections[i].put({
					path: '/bookmarks/test/aaa/sss',
					tree: newTree,
					data: {anothertest: 123},
				})
				var response = await connections[i].get({
					path: '/bookmarks/test/aaa/sss',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'anothertest'])
				expect(response.data._id).to.equal('resources/sssssssss')
			})

			it(`14. Should use an _id specified via the 'data'`, async function() {
				this.timeout(4000)
				var putResponse = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb',
					tree: tree,
					data: {_id: 'resources/foobar_foobar', sometest: 123},
				})
				var response = await connections[i].get({
					path: '/bookmarks/test/aaa/bbb',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data).to.include.keys(['_id', '_rev', 'sometest'])
				expect(response.data._id).to.equal('resources/foobar_foobar')
				expect(response.data.sometest).to.equal(123)
			})

			it(`15. Should make unversioned links where _rev is not specified on resources`, async function() {
				this.timeout(4000)
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
        
        var newTree = _.cloneDeep(tree)
				delete newTree.bookmarks.test.aaa.bbb._rev

				var putResponse = await connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/',
					tree: newTree,
					data: {anothertest: 123},
				})
				var response = await connections[i].get({
					path: '/bookmarks/test/aaa',
				})
				expect(response.status.toString().charAt(0)).to.equal('2')
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev'])
				expect(response.data.bbb).to.include.keys(['_id'])
				expect(response.data.bbb).to.not.include.keys(['_rev'])
			})

      it(`16. Should produce a 412 if the 'If-Match' header doesn't match the existing _rev`, async function() {
        this.timeout(4000);
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				return expect(connections[i].put({
					path: '/bookmarks/test',
					data: {'sometest': 'foobar'},
					headers: {
						'If-Match': '2-foobar',
						'Content-Type': 'application/json'
					}
				})).to.be.rejectedWith(Error, 'Request failed with status code 412');
			})

			it(`17. Should produce a 412 if two PUTs are executed in series with the same 'If-Match' header`, async function() {
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].get({path: '/bookmarks'})
				expect(response.status.toString().charAt(0)).to.equal('2')
				var putOne = await connections[i].put({
					path: '/bookmarks/test',
					data: {'testOne': 'putOne'},
					headers: {
						'If-Match': response.headers['x-oada-rev'],
						'Content-Type': 'application/json'
					}
				})
				expect(putOne.status.toString().charAt(0)).to.equal('2')
				return expect(connections[i].put({
					path: '/bookmarks/test',
					data: {'testTwo': 'putTwo'},
					headers: {
						'If-Match': response.headers['x-oada-rev'],
						'Content-Type': 'application/json'
					}
				})).to.be.rejectedWith(Error, 'Request failed with status code 412');
      })

			it(`18. Should produce a 412 if two PUTs are executed in parallel with the same 'If-Match' header`, async function() {
        await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var response = await connections[i].get({path: '/bookmarks'})
        expect(response.status.toString().charAt(0)).to.equal('2')
				var putOne = connections[i].put({
					path: '/bookmarks/test',
					data: {'testOne': 'putOne'},
					headers: {
						'If-Match': response.headers['x-oada-rev'],
						'Content-Type': 'application/json'
					}
				})
				var putTwo = connections[i].put({
					path: '/bookmarks/test',
					data: {'testTwo': 'putTwo'},
					headers: {
						'If-Match': response.headers['x-oada-rev'],
						'Content-Type': 'application/json'
					}
				})
				return expect(
					Promise.join(putOne,putTwo, async function(putOne,putTwo) {})
				).to.be.rejectedWith(Error, 'Request failed with status code 412')
			})

			it(`19. Should work under a sequence of PUT, DELETE, PUT`, async function() {
				this.timeout(3000);
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
        var putOne = await connections[i].put({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree,
          data: {sometest: 123},
        })
        expect(putOne.status.toString().charAt(0)).to.equal('2')
        var deleteOne = await connections[i].delete({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree,
        })
        expect(deleteOne.status.toString().charAt(0)).to.equal('2')
        var putTwo = await connections[i].put({
          path: '/bookmarks/test/aaa/bbb/index-one/ccc',
          tree,
          data: {anothertest: 123},
        })
        expect(putTwo.status.toString().charAt(0)).to.equal('2')
        var response = await connections[i].get({
          path: '/bookmarks/test',
          tree
        })

				expect(response.status.toString().charAt(0)).to.equal('2');
				expect(response.headers).to.include.keys(['content-location', 'x-oada-rev']);
				expect(response.data).to.include.keys(['_id', '_rev', '_type', 'aaa']);
				expect(response.data.aaa).to.include.keys(['_id', '_rev', 'bbb', '_type']);
				expect(response.data.aaa.bbb).to.include.keys(['_id', '_rev', 'index-one', '_type']);
				expect(response.data.aaa.bbb['index-one']).to.include.keys(['ccc']);
				expect(response.data.aaa.bbb['index-one'].ccc).to.include.keys(['_id', '_rev', '_type', 'anothertest']);
				expect(response.data.aaa.bbb['index-one'].ccc).to.not.include.keys(['sometest']);
			})

			it(`20. Should work under a sequence of PUTs to similar (same parent tree) endpoints`, async function() {
				this.timeout(35000);
        await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
				var putOne = connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
					tree: tree,
					data: {testOne: 123},
				})
				var putTwo = connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/fff/index-three/eee',
					tree: tree,
					data: {testTwo: 123},
				})
				var putThree = connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ggg/index-two/ddd/index-three/eee',
					tree: tree,
					data: {testThree: 123},
				})
				var putFour = connections[i].put({
					path: '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/ddd/index-three/eee',
					tree: tree,
					data: {testFour: 123},
				})
        try{
				var result = await Promise.join(putOne,putTwo,putThree, putFour, async function(putOne,putTwo,putThree,putFour) {
					var response = await connections[i].get({
						path: '/bookmarks/test',
						tree
					})
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
        })
        } catch (error) {
          console.log("TWAS ERROR", error);
        }
      });

      it(`21. Should allow links to be created first, then puts to that path should create the resource`, async function() {
        this.timeout(7000);
        await connections[i].delete({ path: "/bookmarks/test", tree });
        await connections[i].resetCache();

        let putOne = await connections[i].put({
          path: "/bookmarks/test",
          type: "application/json",
          data: {
            _id: 'resources/11111',
            _rev: 0
          }
        })
        expect(putOne.status.toString().charAt(0)).to.equal('2')
        let putTwo = await connections[i].put({
          path: "/bookmarks/test",
          type: "application/json",
          data: {
            'test-One': 'bar'
          }
        })
        expect(putTwo.status.toString().charAt(0)).to.equal('2')

        var getOne = await connections[i].get({
          path: '/bookmarks/test'
        })
        expect(getOne.status.toString().charAt(0)).to.equal('2')
        expect(getOne.data).to.include.keys(['_id', '_rev', 'test-One'])

        var getTwo = await connections[i].get({
          path: '/resources/11111'
        })
        expect(getTwo.status.toString().charAt(0)).to.equal('2')
        expect(getTwo.data).to.include.keys(['_id', '_rev', 'test-One'])
      })

      it(`22. Should allow links to be created first. A future PUT to that resource id should be handled`, async function() {
        this.timeout(7000);
        await connections[i].delete({ path: "/bookmarks/test", tree });
        await connections[i].resetCache();

        let putOne = await connections[i].put({
          path: "/bookmarks/test",
          type: "application/json",
          data: {
            _id: 'resources/11111',
            _rev: 0
          }
        })
        expect(putOne.status.toString().charAt(0)).to.equal('2')

        let putTwo = await connections[i].put({
          path: "/resources/11111",
          type: "application/json",
          data: {
            'test-One': 'bar'
          }
        })
        expect(putTwo.status.toString().charAt(0)).to.equal('2')
        
        var getOne = await connections[i].get({
          path: '/bookmarks/test'
        })
        expect(getOne.status.toString().charAt(0)).to.equal('2')
        expect(getOne.data).to.include.keys(['_id', '_rev', 'test-One'])

        var getTwo = await connections[i].get({
          path: '/resources/11111'
        })
        expect(getTwo.status.toString().charAt(0)).to.equal('2')
        expect(getTwo.data).to.include.keys(['_id', '_rev', 'test-One'])
        console.log(pretty.render(getOne.data))
        console.log(pretty.render(getTwo.data));
      });

			it(`23. Now clean up`, async function() {
				this.timeout(3000);
				await connections[i].delete({path:'/bookmarks/test', tree})
				await connections[i].resetCache();
      })
    });
  }
});
