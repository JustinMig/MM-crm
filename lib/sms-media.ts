export const SMS_MEDIA_BUCKET = 'sms-photos'
export function photoType(bytes: Uint8Array) {
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg'
 if(Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png'
 if(['GIF87a','GIF89a'].includes(Buffer.from(bytes.slice(0,6)).toString()))return 'image/gif'
 return ''
}
export function ownedPhotoPaths(value: unknown, agency: string, user: string): string[] {
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>1)throw Error('Attach one photo per message.')
 return value.map(path=>{
  if(typeof path!=='string'||!path.startsWith(`${agency}/${user}/`)||!new RegExp(`^[a-f0-9-]+/[a-f0-9-]+/[a-f0-9-]+\\.(jpg|png|gif)$`,'i').test(path))throw Error('This photo is not available to your account.')
  return path
 })
}
export async function photoUrls(admin: any, paths: string[], seconds=3600): Promise<string[]> {
 if(!paths.length)return []
 const {data,error}=await admin.storage.from(SMS_MEDIA_BUCKET).createSignedUrls(paths,seconds)
 if(error||!data||data.some((p:any)=>p.error||!p.signedUrl))throw Error('Unable to load the attached photo. Please attach it again.')
 return data.map((p:any)=>p.signedUrl)
}
