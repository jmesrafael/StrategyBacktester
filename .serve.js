const http=require('http'),fs=require('fs'),path=require('path');
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webmanifest':'application/manifest+json','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'};
// /mexc/api/v1/contract/(kline|detail)... → contract.mexc.com (it sends no CORS header,
// so the browser can't call it directly). Only these public market-data paths are forwarded.
const MEXC_PATH=/^\/api\/v1\/contract\/(kline\/[A-Z0-9_]+|detail)(\?|$)/;
http.createServer((req,res)=>{
  if(req.url.startsWith('/mexc/')){
    const sub=req.url.slice(5);
    if(req.method!=='GET'||!MEXC_PATH.test(sub)){res.writeHead(404);res.end('{"success":false}');return;}
    fetch('https://contract.mexc.com'+sub).then(r=>r.text().then(t=>{
      res.writeHead(r.status,{'Content-Type':'application/json'});res.end(t);}))
      .catch(()=>{res.writeHead(502,{'Content-Type':'application/json'});res.end('{"success":false,"message":"MEXC unreachable"}');});
    return;
  }
  let p=decodeURIComponent(req.url.split('?')[0]); if(p==='/')p='/index.html';
  const f=path.join(process.cwd(),p);
  fs.readFile(f,(e,d)=>{ if(e){res.writeHead(404);res.end('404');return;}
    res.writeHead(200,{'Content-Type':types[path.extname(f)]||'application/octet-stream'});res.end(d);});
}).listen(8137,()=>console.log('serving on http://localhost:8137'));
