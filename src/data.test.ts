import {describe,expect,it} from 'vitest'
import {searchTransactions,total,transactions} from './data'
describe('purchase history',()=>{it('finds Ichinose by normalized id and name',()=>{expect(searchTransactions('０７１９')[0]?.name).toBe('一ノ瀬 なつき');expect(searchTransactions('一ノ瀬')).toHaveLength(1)});it('keeps the evidence transaction at 580 yen',()=>{const t=transactions.find(x=>x.employeeId==='0719')!;expect(t.time).toBe('20:15');expect(total(t)).toBe(580)});it('does not contain Yotsuya',()=>{expect(transactions.some(t=>t.name.includes('四ツ谷')||t.employeeId==='1031')).toBe(false)})})
