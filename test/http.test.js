process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oadaLib from '../index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let url = 'https://vip3.ecn.purdue.edu/bookmarks';
let contentType = 'application/vnd.oada.yield.1+json';

it('should perform a get over http', () => {
  return oadaLib.get({url, token}).then((response) => {
    expect(response.status).to.equal(200)
    expect(response.headers).to.contains.keys(['location', 'content-location'])
  })
})

it('should perform a put over http', ()=> {
  expect(oadaLib.put({
    url: url+'/test', 
    token, 
    contentType, 
    data:'123'})).toBe();
})

it('should perform a delete over http', ()=> {
  return oadaLib.delete({
    url: url+'/test', 
    token, 
  }).then((res) => {
    res.response
    .response.to.have
  })
})

