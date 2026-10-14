import {test} from 'node:test';
import assert from 'node:assert/strict';
import {commandFor,keySequence} from '../src/lib/easter-eggs.js';
test('exact requested commands work in search, without accepting partial or similar cheats',()=>{
 assert.equal(commandFor('thereisnourflevel'),'reset');assert.equal(commandFor(' zenpoweradd '),'users');assert.equal(commandFor('ZENPOWERADD'),'users');
 assert.equal(commandFor('thereisnoflevel'),null);assert.equal(commandFor('thereisnourflevelx'),null);assert.equal(commandFor('zenpower'),null);
});
test('outside-field key sequence activates once and expires after a typing gap',()=>{
 const type=keySequence();let now=0,result;
 for(const key of 'thereisnourflevel')result=type(key,now+=100);
 assert.equal(result,'reset');assert.equal(type('x',now+=100),null);
 const next=keySequence();for(const key of 'zenpower')next(key,now+=100);
 assert.equal(next('a',now+=6000),null);assert.equal(next('d',now+=100),null);assert.equal(next('d',now+=100),null);
 let match;for(const key of 'zenpoweradd')match=next(key,now+=100);assert.equal(match,'users');
});
