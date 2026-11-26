import { createClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { decryptValue } from '@/lib/crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const destination = 'https://sggzshbdfgkyyvxbebul.supabase.co'
const publishable = 'sb_publishable_wLDvDmI4pmIcADkUlc6-LQ_RWMoQU1Y'
const allowed = new Set(["0863e6da-1d04-4e98-bcd3-f7650bf37bf7","cf2eacea-feba-4bf3-9e46-79ed6d3f415b","9c6eb79b-ece1-405e-8722-a64bd7026e72","b6defeb3-1d8e-4c15-a08e-228a290deb34","5bb850e9-5deb-43b3-a1c2-182409042d61","99f52bb7-f505-466b-a4b2-e3e9556880ee","1406d41e-b5ff-41b6-8ccb-2ad8a1b80f50","fdefcf3c-0a12-465c-ac6e-f965bbed98cc"])
const reply = (status:number, message:string) => Response.json({message}, {status,headers:{'Cache-Control':'private, no-store'}})

export async function POST(request:Request) {
  try {
    const auth = request.headers.get('authorization') || ''
    if (!auth.startsWith('Bearer ')) return reply(401,'Sign in to Platinum.')
    const {id,action} = await request.json()
    if (!allowed.has(id) || !['check','transfer'].includes(action)) return reply(400,'Invalid reconciliation request.')
    const db = createClient(destination,publishable,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}})
    const identity = await db.auth.getUser(auth.slice(7))
    if (!identity.data.user) return reply(401,'Your Platinum session expired.')
    const profile = await db.from('profiles').select('active,role').eq('id',identity.data.user.id).single()
    if (!profile.data?.active || !['owner','admin'].includes(profile.data.role)) return reply(403,'A Platinum administrator is required.')
    const target = await db.from('clients').select('id').eq('id',id).eq('assigned_agent_id','8099c3d2-dff1-4a34-8c90-06931f64177e').single()
    if (!target.data) return reply(409,'The Platinum client assignment could not be matched.')
    const source = await createAdminClient().from('clients').select('ssn_ciphertext').eq('id',id).eq('assigned_agent_id','b34219da-711a-4f6d-a3c6-087ae96e31c4').single()
    if (!source.data?.ssn_ciphertext) return reply(409,'The M&M record lacks a matching SSN.')
    const ssn = decryptValue(source.data.ssn_ciphertext)?.trim()
    if (!ssn || !/^\d{3}[- ]?\d{2}[- ]?\d{4}$/.test(ssn)) return reply(422,'An M&M SSN requires review.')
    const vault = async (operation:'get'|'save') => {
      const res = await db.functions.invoke('client-sensitive',{headers:{Authorization:auth},body:{client_id:id,action:operation,...(operation==='save'?{sensitive:{ssn}}:{})}})
      if (res.error || res.data?.error || !res.data) throw Error('vault')
      return res.data
    }
    const current = (await vault('get')).sensitive?.ssn
    if (typeof current !== 'string') return reply(502,'The Platinum encrypted field is unavailable.')
    const matches = (value:string) => value.replace(/\D/g,'') === ssn.replace(/\D/g,'')
    if (current && !matches(current)) return reply(409,'An existing Platinum SSN requires review.')
    if (action==='check') return reply(200,'Source and destination verified.')
    if (!current) await vault('save')
    if (!matches((await vault('get')).sensitive?.ssn || '')) return reply(502,'The saved field could not be verified.')
    return reply(200,'Saved and verified.')
  } catch { return reply(502,'The encrypted reconciliation service could not finish this record.') }
}