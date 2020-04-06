"use strict";

/* Copyright 2018 Open Ag Data Alliance
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an 'AS IS' BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author Servio Palacios, Samuel Noel
 * Token API for Handling Tokens in the Cache Library - Super Class.
 * @module src/token
 */

var Promise = require("bluebird");
let PouchDB = require("pouchdb");
if (PouchDB.default) PouchDB = PouchDB.default;
const { STATUS_CODE } = require("http");
const urlLib = require("url");
const _ = require("lodash");
//const debug = require("debug")("oada-cache:token");
const crypto = require("crypto");
const oadaIdClient = require("@oada/oada-id-client");
//const error = require('debug')('oada-cache:index:error');
//const info = require('debug')('oada-cache:index:info');

class Token {
  constructor(param = {}) {
    let self = this;
    self._token = param.token || null;
    self._domain = param.domain || "localhost";
    self._options = param.options;
    self._dbprefix = param.dbprefix || "";

    // creating database nae based on the domain
    // ensured one to one correspondence with the domain
    // i.e., token belongs to that domain
    const hash = crypto.createHash("sha256");
    hash.update(self._domain);
    self._name = self._dbprefix + hash.digest("hex");

    self._isSet = self._token ? true : false;
    self._tokenDB = new PouchDB(self._name);
    self._id = "OadaTokenID";
    self._rev = null;
    self.token = self._token ? self._token : "";
  } //constructor

  /**
   * searches for a local db and a doc
   */
  async checkTokenDB() {
    let result = null;
    try {
      //getting the doc from the server if exists
      let doc = await this._tokenDB.get(this._id);
      //      debug("received document ->", doc);
      result = doc.token;
      this._rev = doc._rev;
    } catch (err) {
      return result;
    }
    return result;
  } //checkTokenDB

  /**
   * if token was provided then it sets the .token in the constructor -> returns that value
   * sets the pouch db if it does not exist
   */
  async setup(_expired) {
    // Get a token
    let TOKEN = null; //returned to the chache library
    if (this.isSet()) {
      TOKEN = this.token;
    } else {
      // get token from local cache
      TOKEN = await this.checkTokenDB();

      if (!TOKEN || _expired) {
        //local cache does not have a token
        let urlObj = urlLib.parse(this._domain);
        let result;
        // Open the browser and the login popup
        if (typeof window === "undefined") {
          result = await oadaIdClient.node(urlObj.host, this._options);
        } else {
          // the library itself detects a browser environment and delivers .browser
          var gat = Promise.promisify(oadaIdClient.getAccessToken);
          result = await gat(urlObj.host, this._options);
        }
        TOKEN = result.access_token;
        //        debug("setup token -> access token:", result.access_token);
        this.put(TOKEN);
      } //if !TOKEN
    } //else
    return TOKEN;
  } //setup

  /**
   * fetches the token from the this._tokenDB or
   * setups the new database and retrieves the new token to be used
   */
  async get() {
    return this.setup();
  }

  /**
   * searches for the token in the this._tokenDB
   * if present, the it sends the current _rev
   * if not present (404), it creates a new document in the created this._tokenDB
   * @param {string} _token
   */
  async put(_token) {
    // get token from local cache
    let TOKEN = this.checkTokenDB();
    try {
      if (TOKEN) {
        //local cache has that token, use the _rev
        let response = await this._tokenDB.put({
          _id: this._id,
          _rev: this._rev,
          token: _token,
        });
        this.token = _token;
      } else {
        //not found
        //        debug("not found -> creating one");
        let response = await this._tokenDB.put({
          _id: this._id,
          token: _token,
        });
        this.token = _token;
      } //else
    } catch (err) {
      //error("Error: not found -> put", err);
    }
  } //put

  async renew() {
    this._isSet = false;
    return this.setup(true); //expired = true
  }

  async cleanUp() {
    try {
      await this._tokenDB.destroy();
      //await this._tokenDB.close();
      this._isSet = false;
    } catch (err) {
      //error("deleting token from cache", err);
    }
  } //cleanUp

  isSet() {
    return this._isSet;
  }
} //class

/* exporting the module */
module.exports = Token;
