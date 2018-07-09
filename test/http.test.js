process.env.NODE_TLS_REJECT_UNAUTHORIZED=0
import oada from '../index'
import chai from 'chai';
var expect = chai.expect;

let token = 'def';
let url = 'https://vip3.ecn.purdue.edu/bookmarks';
let contentType = 'application/vnd.oada.yield.1+json';

it('should connect when a token is provided', () => {
  return oada.connect({token, domain: 'https://vip3.ecn.purdue.edu'}).then((result) => {
    console.log(result)
    expect(result)
  })
})

it('should perform a get over http', () => {
  return oada.get({url, token}).then((response) => {
    expect(200).to.equal(200)
    //    expect(response.headers).to.contains.keys(['location', 'content-location'])
  }).catch(() => {

  })
})

it('should perform a put over http', ()=> {
  expect(oada.put({
    url: url+'/test', 
    token, 
    contentType, 
    data:'123'})).toBe();
})

it('should perform a delete over http', ()=> {
  return oada.delete({
    url: url+'/test', 
    token, 
  }).then((res) => {
    res.response
    .response.to.have
  })
})

