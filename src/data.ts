export type Item={name:string;barcode:string;qty:number;price:number}
export type Transaction={id:string;time:string;name:string;employeeId:string;register:string;payment:string;items:Item[]}
const i=(name:string,barcode:string,price:number,qty=1):Item=>({name,barcode,price,qty})
export const transactions:Transaction[]=[
{id:'TX-201842',time:'18:42',name:'佐倉 みなみ',employeeId:'2148',register:'KIOSK-02',payment:'社員証',items:[i('天然水 550ml','2000000000015',110),i('鮭おにぎり','2000000000022',190)]},
{id:'TX-191108',time:'19:11',name:'大崎 りょう',employeeId:'5520',register:'KIOSK-01',payment:'交通系IC',items:[i('無糖コーヒー','2000000000039',180),i('ミックスサンド','2000000000046',360)]},
{id:'TX-193726',time:'19:37',name:'神谷 さやか',employeeId:'3086',register:'KIOSK-02',payment:'社員証',items:[i('のり塩ポテトチップス','2000000000053',170),i('レモン炭酸水','2000000000060',140)]},
{id:'TX-195451',time:'19:54',name:'羽田 そうた',employeeId:'4412',register:'KIOSK-01',payment:'クレジット',items:[i('チキン弁当','2000000000077',640),i('緑茶 600ml','2000000000084',160)]},
{id:'TX-200317',time:'20:03',name:'西園 まこと',employeeId:'6934',register:'KIOSK-02',payment:'社員証',items:[i('梅おにぎり','2000000000091',160),i('カップみそ汁','2000000000107',150)]},
{id:'TX-201584',time:'20:15',name:'一ノ瀬 なつき',employeeId:'0719',register:'KIOSK-02',payment:'社員証',items:[i('梅おにぎり','2000000000091',160),i('カフェラテ','2000000000114',220),i('ミックスナッツ','2000000000121',200)]},
{id:'TX-202241',time:'20:22',name:'相原 けい',employeeId:'3257',register:'KIOSK-01',payment:'QR決済',items:[i('たまごサンド','2000000000152',320),i('ほうじ茶','2000000000169',150)]},
{id:'TX-203905',time:'20:39',name:'久保 あおい',employeeId:'1853',register:'KIOSK-02',payment:'社員証',items:[i('ビターチョコレート','2000000000176',240)]},
{id:'TX-205628',time:'20:56',name:'三田 なお',employeeId:'9046',register:'KIOSK-01',payment:'交通系IC',items:[i('カルボナーラ','2000000000183',520),i('ミネラルウォーター','2000000000190',110)]},
{id:'TX-211412',time:'21:14',name:'若林 ゆう',employeeId:'6371',register:'KIOSK-02',payment:'社員証',items:[i('バナナ','2000000000206',130),i('ヨーグルト','2000000000213',170)]},
]
export const total=(t:Transaction)=>t.items.reduce((sum,x)=>sum+x.price*x.qty,0)
export const normalize=(v:string)=>v.normalize('NFKC').replace(/\s/g,'').toLowerCase()
export const searchTransactions=(query:string)=>{const q=normalize(query);return q?transactions.filter(t=>normalize(t.name).includes(q)||normalize(t.employeeId).includes(q)):transactions}
