const { test } = require('node:test');
const assert = require('node:assert/strict');
const core = require('../app/core.js');

test('normalizes, sorts and excludes hidden/duplicate/self apps', () => {
  const apps = [
    {id:'2',name:'Zulu'}, {id:'1',name:'Alpha'}, {id:'2',name:'Again'},
    {id:'self',name:'FastTV'}, {id:'3',name:'System',show:false},
    {id:'4',name:'   '}, null
  ];
  assert.deepEqual(core.normalizeApps(apps,'self').map(a=>a.id),['1','2']);
});
test('non-array and malformed app list is safe', () => {
  assert.deepEqual(core.normalizeApps(null,''),[]);
  assert.deepEqual(core.normalizeApps([{}, {name:'No ID'}],''),[]);
});
test('home shows every discovered app with favourites first', () => {
  const apps = Array.from({length:15},(_,i)=>({id:String(i),name:'App '+String(i).padStart(2,'0')}));
  const results = core.filterApps(apps,'','home',['14','13']);
  assert.equal(results.length,15);
  assert.deepEqual(results.slice(0,2).map(a=>a.id),['13','14']);
});
test('search is case insensitive', () => {
  const apps = [{id:'1',name:'Music'}, {id:'2',name:'Movies'}, {id:'3',name:'Photos'}];
  assert.deepEqual(core.filterApps(apps,'MUS','home',[]).map(a=>a.id),['1']);
});
test('normalization preserves source and verified icon metadata', () => {
  const list = core.normalizeApps([{id:'native.X',name:'  Netflix  ',kind:'native',icon:true,show:true}], '');
  assert.equal(list[0].kind,'native');
  assert.equal(list[0].icon,true);
  assert.equal(list[0].name,'Netflix');
});
test('merge keeps both native and module apps with same ids distinct', () => {
  const list = core.mergeApps([{id:'tv.music',name:'Music',kind:'native'}],[{id:'tv.music',name:'Music Module',kind:'module'}]);
  assert.equal(list.length,2);
  assert.deepEqual(list.map(a=>a.key).sort(),['module:tv.music','native:tv.music']);
});
test('favourites only returns saved ids', () => {
  const apps = [{id:'1',name:'One'}, {id:'2',name:'Two'}];
  assert.deepEqual(core.filterApps(apps,'','favorites',['2']).map(a=>a.id),['2']);
});
test('toggle favourite is reversible and immutable', () => {
  const source = ['a'];
  const added = core.toggleFavorite(source,'b');
  assert.deepEqual(added,['a','b']);
  assert.deepEqual(source,['a']);
  assert.deepEqual(core.toggleFavorite(added,'b'),['a']);
});
test('saved favourite parsing handles invalid, duplicate and malformed JSON', () => {
  assert.deepEqual(core.readFavorites('invalid'),[]);
  assert.deepEqual(core.readFavorites('{}'),[]);
  assert.deepEqual(core.readFavorites('["a","a","b",12]'),['a','b']);
});
