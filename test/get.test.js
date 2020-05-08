process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0
const _ = require('lodash')
const chai = require('chai')
const chaiAsPromised = require('chai-as-promised')
chai.use(chaiAsPromised)
const { expect } = chai
const axios = require('axios')
const { token, domain } = require('./config')
const { tree, putResource, getConnections } = require('./utils.js')

const connections = getConnections({
  domain,
  token
})

describe(`------------GET-----------------`, async function () {
  for (const connection of connections) {
    const { cache, websocket } = connection
    describe(`Testing connection cache:${cache} websocket:${websocket}`, function () {
      let conn
      before('Wait on connection', async function () {
        conn = await connection
      })

      beforeEach('Reset connection', async function () {
        await conn.resetCache()
      })

      after('Clean up', async function () {
        this.timeout(5000)
        await conn.resetCache()
        try {
          await conn.delete({ path: '/bookmarks/test', tree })
        } catch (error) {
          console.log(error)
        }
      })

      it(`1. Should allow for a basic GET request without tree parameter`, async function () {
        this.timeout(4000)
        await putResource(
          {
            _type: 'application/vnd.oada.notes.1+json',
            sometest: 'abc'
          },
          domain + '/bookmarks/test'
        )

        await putResource(
          { somethingelse: 'okay' },
          domain + '/bookmarks/test/aaa'
        )
        await putResource({ b: 'b' }, domain + '/bookmarks/test/aaa/bbb')
        await putResource(
          { c: 'c' },
          domain + '/bookmarks/test/aaa/bbb/index-one/ccc'
        )
        await putResource(
          { d: 'd' },
          domain + '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/bob'
        )
        await putResource(
          { e: 'e' },
          domain +
            '/bookmarks/test/aaa/bbb/index-one/ccc/index-two/bob/index-three/2018'
        )

        var test = await conn.get({
          path: '/bookmarks/test'
        })
        expect(test.data).to.include.key('aaa')
        expect(test.data).to.include.keys(['_id', '_meta', '_type', '_rev'])
      })

      it(`2. Should allow you to get a resource directly`, async function () {
        var response = await conn.get({
          path: '/resources/default:resources_bookmarks_321'
        })
        expect(response.data).to.include.keys(['_id', '_rev', '_meta'])
      })

      it(`3. Should error when the root path of a 'tree' GET doesn't exist`, async function () {
        return expect(
          conn.get({
            path: '/bookmarks/test/testTwo',
            tree
          })
        ).to.be.rejectedWith(Error, 'Request failed with status code 404')
      })

      it(`4. Should handle when the cache only contains part of the tree which is on the server`, async function () {
        if (conn.cache) {
          var subTree = _.cloneDeep(tree)
          delete subTree.bookmarks.test.aaa.bbb['index-one']['*']
          // Prep the cache with part of the tree
          var first = await conn.get({
            path: '/bookmarks/test',
            tree: subTree
          })
          expect(first.data).to.include.key('aaa')
          expect(first.data['aaa']).to.include.key('bbb')
          expect(first.data['aaa']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(first.data['aaa']['bbb']).to.include.key('index-one')
          expect(first.data['aaa']['bbb']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(first.data['aaa']['bbb']['index-one']).to.not.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(first.data['aaa']['bbb']['index-one']).to.include.key('ccc')
          expect(first.data['aaa']['bbb']['index-one']['ccc']).to.have.keys([
            '_id',
            '_rev'
          ])

          // Now Attempt to GET the entire tree
          var second = await conn.get({
            path: '/bookmarks/test',
            tree
          })
          expect(second.data).to.include.key('aaa')
          expect(second.data['aaa']).to.include.key('bbb')
          expect(second.data['aaa']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(second.data['aaa']['bbb']).to.include.key('index-one')
          expect(second.data['aaa']['bbb']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(second.data['aaa']['bbb']['index-one']).to.not.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(second.data['aaa']['bbb']['index-one']).to.include.key('ccc')
          expect(second.data['aaa']['bbb']['index-one']['ccc']).to.include.keys(
            ['_id', '_meta', '_type', '_rev']
          )
          expect(
            second.data['aaa']['bbb']['index-one']['ccc']['index-two']['bob'][
              'index-three'
            ]['2018']
          ).to.include.keys(['_id', '_meta', '_type', '_rev'])
          expect(second.cached).to.equal(false)
        }
      })

      it(`5. Should handle fully cached tree`, async function () {
        if (conn.cache) {
          await conn.get({
            path: '/bookmarks/test',
            tree
          })

          var test = await conn.get({
            path: '/bookmarks/test',
            tree
          })
          expect(test.data).to.include.key('aaa')
          expect(test.data['aaa']).to.include.key('bbb')
          expect(test.data['aaa']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(test.data['aaa']['bbb']).to.include.key('index-one')
          expect(test.data['aaa']['bbb']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(test.data['aaa']['bbb']['index-one']).to.not.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(test.data['aaa']['bbb']['index-one']).to.include.key('ccc')
          expect(test.data['aaa']['bbb']['index-one']['ccc']).to.include.keys([
            '_id',
            '_meta',
            '_type',
            '_rev'
          ])
          expect(test.cached).to.equal(true)
        }
      })

      it(`6. Should only return the part of the tree prescribed by the given 'tree' when the server has more data`, async function () {
        try {
          await conn.delete({ path: '/bookmarks/test', tree })
        } catch (error) {
          console.log(error)
        }

        this.timeout(4000)

        await conn.put({
          path: '/bookmarks/test/aaa/bbb/index-one/hhh',
          data: { foo: 'bar' },
          tree
        })

        await conn.put({
          path:
            '/bookmarks/test/aaa/bbb/index-one/hhh/index-two/bob/index-three/2014',
          type: 'application/vnd.oada.yield.1+json',
          data: { bar: 'foo' },
          tree
        })

        await axios({
          method: 'put',
          url: domain + '/bookmarks/test/aaa/bbb/extraKey',
          headers: {
            Authorization: 'Bearer def',
            'Content-Type': 'application/vnd.oada.yield.1+json'
          },
          data: { hello: 'world' }
        })

        await axios({
          method: 'put',
          url: domain + '/resources/7656401651',
          headers: {
            Authorization: 'Bearer def',
            'Content-Type': 'application/vnd.oada.yield.1+json'
          },
          data: { foobar: 'foobar' }
        })

        await conn.put({
          path:
            '/bookmarks/test/aaa/bbb/index-one/hhh/index-two/joe/somethingElse',
          type: 'application/vnd.oada.yield.1+json',
          data: { _id: 'resources/7656401651' },
          tree
        })

        var first = await conn.get({
          path: '/bookmarks/test',
          tree
        })

        expect(first.data).to.include.key('aaa')
        expect(first.data['aaa']).to.include.key('bbb')
        expect(first.data['aaa']).to.include.keys(['_id', '_type', '_rev'])
        expect(first.data['aaa']['bbb']).to.include.key('index-one')
        expect(first.data['aaa']['bbb']).to.include.keys([
          '_id',
          '_type',
          '_rev'
        ])
        expect(first.data['aaa']['bbb']['index-one']).to.not.include.keys([
          '_id',
          '_type',
          '_rev'
        ])
        expect(first.data['aaa']['bbb']['index-one']).to.include.key('hhh')
        expect(first.data['aaa']['bbb']['index-one']['hhh']).to.include.keys([
          '_id',
          '_type',
          '_rev'
        ])
        expect(
          first.data['aaa']['bbb']['index-one']['hhh']['index-two']
        ).to.include.keys(['bob', 'joe'])
        expect(
          first.data['aaa']['bbb']['index-one']['hhh']['index-two']['joe']
        ).to.include.keys(['somethingElse'])
        expect(
          first.data['aaa']['bbb']['index-one']['hhh']['index-two']['joe'][
            'somethingElse'
          ]
        ).to.not.include.keys(['foobar'])
      })

      xit('should permit a GET on users', async function () {
        await conections[i].put({
          path:
            '/bookmarks/test/_meta/_permissions/users/default:users_audrey_999',
          data: {
            read: true,
            write: true,
            owner: false
          }
        })
      })
    })
  }
})
