// Read-only, server-side connection check. Never prints credentials, tokens,
// caller details, message metadata, transcripts, or audio URLs.
const output={check:'office-voicemail-connection'};
try{
 const client=process.env.RINGCENTRAL_CLIENT_ID?.trim();
 const secret=process.env.RINGCENTRAL_CLIENT_SECRET?.trim();
 const jwt=process.env.RINGCENTRAL_JWT?.trim();
 output.configured=Boolean(client&&secret&&jwt);
 if(output.configured){
  const server=(process.env.RINGCENTRAL_SERVER_URL||'https://platform.ringcentral.com').replace(/\/$/,'');
  if(!/^https:\/\/platform(?:\.devtest)?\.ringcentral\.com$/.test(server))throw Error('Unsupported RingCentral server.');
  const auth=await fetch(server+'/restapi/oauth/token',{
   method:'POST',headers:{Authorization:'Basic '+Buffer.from(client+':'+secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},
   body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),signal:AbortSignal.timeout(15000)
  });
  const token=await auth.json().catch(()=>({}));output.authentication_status=auth.status;
  if(auth.ok&&token.access_token){
   output.read_messages_granted=typeof token.scope==='string'?token.scope.split(/\s+/).includes('ReadMessages'):null;
   const params=new URLSearchParams({messageType:'VoiceMail',perPage:'1',dateFrom:new Date(Date.now()-90*86400000).toISOString()});
   const response=await fetch(server+'/restapi/v1.0/account/~/extension/~/message-store?'+params,{
    headers:{Authorization:'Bearer '+token.access_token},signal:AbortSignal.timeout(15000)
   });
   const data=await response.json().catch(()=>({}));output.voicemail_status=response.status;
   if(response.ok){output.total_voicemails=Number(data.paging?.totalElements??data.records?.length??0);}
   else{
    output.error_code=String(data.errorCode||data.errors?.[0]?.errorCode||'unknown').slice(0,50);
    output.read_messages_required=/ReadMessages|Read Messages/i.test(String(data.message||''));
   }
  }else{output.error_code=String(token.error||'authentication_failed').slice(0,50);}
 }
}catch(error){output.error=error?.name==='TimeoutError'?'connection_timeout':'connection_check_failed';}
console.log(JSON.stringify(output));
