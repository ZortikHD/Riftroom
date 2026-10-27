import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import catalog from '../catalog.js';
import * as de from '../engine.js';
import * as en from '../en/engine.js';
import {biggestChanges} from '../insights.js';
import {biggestChanges as englishChanges} from '../en/insights.js';
import {acceptPublishedMeta, fetchPublishedBundle} from '../meta-data.js';

const snapshot = () => ({schemaVersion:1, source:'Test import', patch:catalog.version,
  updatedAt:new Date().toISOString(), region:'EUW', rank:'Emerald+', queue:'Ranked Solo',
  matches:10000, entries:[{champion:'Ahri',role:'MIDDLE',games:10000,wins:5200}]});
const response = data => async () => ({ok:true, json:async()=>data});

for (const [language, engine] of [['German',de],['English',en]]) {
  test(`${language}: new profiles use published data`, () => {
    assert.equal(engine.initialState().metaMode, 'published');
  });
  test(`${language}: imported data survives backup/reload and published refresh`, () => {
    const input = {...engine.initialState(), meta:snapshot(),metaMode:'imported'};
    const restored = engine.validateState(JSON.parse(JSON.stringify(input)),catalog);
    assert.equal(acceptPublishedMeta(restored,{...snapshot(),source:'Published'}),false);
    assert.equal(restored.meta.source,'Test import');
    restored.metaMode='published';
    assert.equal(acceptPublishedMeta(restored,{...snapshot(),source:'Published'},'2026-10-27T12:00:00Z'),true);
    assert.equal(restored.meta.source,'Published');
    assert.equal(restored.lastChecked,'2026-10-27T12:00:00Z');
  });
  test(`${language}: disabled and legacy imports are protected`, () => {
    const legacy={...engine.initialState(),meta:snapshot()};delete legacy.metaMode;
    assert.equal(engine.validateState(legacy,catalog).metaMode,'imported');
    const disabled=engine.validateState({...engine.initialState(),metaMode:'disabled'},catalog);
    assert.equal(acceptPublishedMeta(disabled,snapshot()),false);
    assert.equal(disabled.meta,null);
  });
  test(`${language}: expired and unrelated patch data are rejected for recommendations`, () => {
    assert.equal(engine.metaStatus({...snapshot(),updatedAt:'2000-01-01T00:00:00Z'},catalog.version).ok,false);
    assert.equal(engine.metaStatus({...snapshot(),patch:'1.1'},catalog.version).ok,false);
  });
}

test('language switch retains the chosen source', () => {
  const saved=de.validateState({...de.initialState(),meta:snapshot(),metaMode:'imported'},catalog);
  assert.equal(en.validateState(saved,catalog).metaMode,'imported');
});
test('retrieval validates the bundle and bypasses cached responses', async () => {
  const data={catalog,current:{snapshot:snapshot()}};
  const result=await fetchPublishedBundle(catalog,de.validateMeta,async(url,options)=>{
    assert.equal(url,'data/meta.json');assert.equal(options.cache,'no-store');
    assert.equal(options.credentials,'same-origin');assert.ok(options.signal instanceof AbortSignal);
    return {ok:true,json:async()=>data};
  });
  assert.equal(result.snapshot.source,'Test import');assert.equal(result.previous,null);
});
test('network, HTTP and invalid snapshots fail without changing the previous state', async () => {
  const state={...de.initialState(),meta:snapshot()};const before=structuredClone(state);
  for(const fetcher of [async()=>{throw Error('offline');},async()=>({ok:false,status:503}),
    response({current:{snapshot:{}}}),response({catalog:{version:'bad'},current:{snapshot:snapshot()}}),
    response({current:{snapshot:snapshot()},previous:{snapshot:{}}})]) {
    await assert.rejects(fetchPublishedBundle(catalog,de.validateMeta,fetcher));
    assert.deepEqual(state,before);
  }
});
test('declining and unchanged champions never appear as risers in either language', () => {
  const entry={champion:'Ahri',role:'MIDDLE',games:10000};
  for(const calculate of [biggestChanges,englishChanges]) {
    const result=calculate({entries:[{...entry,wins:4800}]},{entries:[{...entry,wins:5200}]});
    assert.equal(result.risers.length,0);assert.equal(result.fallers.length,1);
    assert.deepEqual(calculate({entries:[{...entry,wins:5200}]},{entries:[{...entry,wins:5200}]}),{risers:[],fallers:[]});
    assert.equal(calculate({entries:[{...entry,wins:5400}]},{entries:[{...entry,wins:5200}]}).risers.length,1);
  }
});
test('service worker never falls back to cache for explicit refreshes', async () => {
  const handlers={};let cacheRead=false;
  vm.runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{
    self:{addEventListener:(name,handler)=>handlers[name]=handler},URL,
    location:{origin:'https://example.test'},fetch:async()=>{throw Error('offline');},
    caches:{match:()=>{cacheRead=true;return {ok:true};}}
  });
  let result;
  handlers.fetch({request:{method:'GET',url:'https://example.test/data/meta.json',cache:'no-store'},respondWith:p=>result=p});
  await assert.rejects(result,/offline/);assert.equal(cacheRead,false);
});
