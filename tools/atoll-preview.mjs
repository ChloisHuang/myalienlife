const bundleIdentifier='local.orbitlife.atoll-preview';
const descriptor={
 id:'orbit-webgl-verification',bundleIdentifier,priority:'normal',
 accentColor:{red:.7,green:.7,blue:.7,alpha:1},
 metadata:{purpose:'Read-only server save preview'},
 tab:{title:'星岛',iconSymbolName:'globe',preferredHeight:420,sections:[],allowWebInteraction:false,
  webContent:{html:'<script>location.replace("http://127.0.0.1:5173/tools/atoll-verification.html?save=1")</script>',preferredHeight:420,isTransparent:false,allowLocalhostRequests:true,allowRemoteRequests:false,maximumContentWidth:600}}
};
const ws=new WebSocket('ws://127.0.0.1:9020');
const timeout=setTimeout(()=>{console.error('Atoll connection timed out');process.exit(1);},5000);
ws.onopen=()=>ws.send(JSON.stringify({jsonrpc:'2.0',id:crypto.randomUUID(),method:'atoll.presentNotchExperience',params:{bundleIdentifier,descriptor}}));
ws.onmessage=event=>{
 const response=JSON.parse(event.data);console.log(JSON.stringify(response));clearTimeout(timeout);ws.close();
 setTimeout(()=>process.exit(response.result?.success===true?0:1),100);
};
ws.onerror=()=>{console.error('Cannot connect to Atoll on port 9020');process.exit(1);};
