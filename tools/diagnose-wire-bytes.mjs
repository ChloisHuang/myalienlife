import WebSocket from 'ws';
import {randomUUID} from 'node:crypto';
const deflate = process.argv[2] === 'on';
const seconds = 30;
let decoded = 0, n = 0;
const ws = new WebSocket('wss://www.doudouai.net:6443/api/stream', {
  origin:'https://www.doudouai.net:6443', perMessageDeflate:deflate, handshakeTimeout:15000,
});
ws.on('open',()=>{
  ws.send(JSON.stringify({type:'auth',client:`probe-${randomUUID().slice(0,8)}`,session:'',authVersion:0}));
  var base = ws._socket.bytesRead;
  setTimeout(()=>{
    const wire = ws._socket.bytesRead - base;
    const span = seconds;
    console.log(`  deflate=${deflate?'ON ':'OFF'}  msgs=${n} (${(n/span).toFixed(2)}/s)`);
    console.log(`     decoded ${(decoded/1024).toFixed(0)}KB  ->  ${(decoded/n/1024).toFixed(1)}KB per message (what the app sees)`);
    console.log(`     on-wire ${(wire/1024).toFixed(0)}KB  ->  ${(wire/n/1024).toFixed(1)}KB per message`);
    console.log(`     wire rate ${(wire/span/1024).toFixed(0)} KB/s   packets/msg @MTU1380 = ${((wire/n)/1380).toFixed(1)}`);
    try{ws.close();}catch{}
    process.exit(0);
  }, seconds*1000);
});
ws.on('message',d=>{n++;decoded+=d.length;});
ws.on('error',e=>{console.log('  error',e.message);process.exit(0);});
