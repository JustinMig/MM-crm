import test from 'node:test';import assert from 'node:assert/strict';
import {officeReviewYear,withOfficeReviewStatus} from '../office-static/office-review-status.ts';
test('Office review year matches the Arctos September rollover in Central time',()=>{
 assert.equal(officeReviewYear(new Date('2027-09-01T04:59:59Z')),2026);
 assert.equal(officeReviewYear(new Date('2027-09-01T05:00:00Z')),2027);
 assert.equal(officeReviewYear(new Date('2027-01-01T12:00:00Z')),2026);
});
test('Search statuses come from checked current-year records for just the returned client IDs',async()=>{
 const calls=[],q={select:()=>q,in:(k,v)=>{calls.push([k,v]);return q},eq:(k,v)=>{calls.push([k,v]);return q},then:resolve=>Promise.resolve({data:[{client_id:'one'}]}).then(resolve)};
 const result=await withOfficeReviewStatus({sb:{from:t=>{assert.equal(t,'client_review_manual');return q}}},[{id:'one'},{id:'two'}],new Date('2026-11-25T12:00:00Z'));
 assert.deepEqual(result,[{id:'one',medicare_review_year:2026,medicare_review_completed:true},{id:'two',medicare_review_year:2026,medicare_review_completed:false}]);
 assert.deepEqual(calls,[['client_id',['one','two']],['review_year',2026],['completed',true]]);
});
