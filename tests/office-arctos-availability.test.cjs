const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { runInNewContext } = require('node:vm');
const source = readFileSync(require.resolve('../office-static/office-schedule-arctos.ts'), 'utf8')
  .replace(/^import .*$/m, '').split('Deno.serve(')[0];
const justin = '9ca80b13-42e7-46eb-9ad8-c0bb700c6ba9';
const other = '00000000-0000-4000-8000-000000000001';
function fixture(shared, local = []) {
  const http = [], writes = [];
  const db = {
    from(table) {
      const rows = table === 'profiles' ? { id: justin } : local;
      const q = { then(resolve) { resolve({ data: rows }); } };
      for (const verb of ['select','eq','in','neq','limit','maybeSingle','insert']) q[verb] = () => q;
      return q;
    },
    async rpc(name) { writes.push(name); return { data: 'test-id' }; }
  };
  const run = runInNewContext(source + '\nrun', { AbortSignal, fetch: async (url, init) => {
    http.push({url, init});
    return {ok: shared !== null, json: async () => shared};
  } });
  const request = (action, agent_id = justin) => run(db, action,
    {agent_id,date:'2027-01-11',time:'10:00',event_type:'appointment',person_name:'Test'},'operator','Bearer test');
  return {request,http,writes};
}
test('Office slots combine Justin’s shared and local events, using interval overlaps', async () => {
  const f = fixture([{start_time:'10:15',end_time:'10:45'},{start_time:'11:20',end_time:null}],
    [{status:'scheduled',start_time:'12:00',end_time:'12:30'}]);
  const {blocked} = await f.request('slots');
  assert.deepEqual([...blocked],['10:00','10:30','11:00','11:30','12:00']);
  assert.equal(f.http[0].init.headers.authorization,'Bearer test');
  assert.match(f.http[0].url,/event_type=eq.appointment&status=eq.scheduled/);
  assert.deepEqual(JSON.parse(f.http[0].init.body),{p_from:'2027-01-11',p_to:'2027-01-11'});
});
test('Submit rechecks shared availability and fails closed before saving', async () => {
  for(const shared of [null,[{start_time:'10:15',end_time:'10:45'}]]) {
    const f = fixture(shared);
    await assert.rejects(f.request('book'),/could not be checked|already booked/);
    assert.equal(f.writes.length,0);
  }
  const f = fixture([{start_time:'10:30',end_time:'11:00'}]);
  assert.equal((await f.request('book')).saved,true);
  assert.deepEqual(f.writes,['office_book_agent_appointment']);
});
test('The shared calendar is never fetched for another agent', async () => {
  const f = fixture(null);
  await f.request('slots',other);
  assert.equal(f.http.length,0);
});
