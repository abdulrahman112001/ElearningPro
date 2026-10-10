const fs=require('fs'),path=require('path');
const root=process.argv[2];process.chdir(root);
function walk(d,out=[]){for(const f of fs.readdirSync(d,{withFileTypes:true})){if(['node_modules','.next','.git'].includes(f.name))continue;const p=path.join(d,f.name);if(f.isDirectory())walk(p,out);else if(/\.(tsx|ts)$/.test(f.name))out.push(p.split(path.sep).join('/'));}return out;}
const files=[...walk('app'),...walk('components'),...walk('lib'),...(fs.existsSync('providers')?walk('providers'):[])];
const ar=JSON.parse(fs.readFileSync('messages/ar.json')),en=JSON.parse(fs.readFileSync('messages/en.json'));
function flat(o,p='',s=new Set()){for(const[k,v]of Object.entries(o)){const kk=p?p+'.'+k:k;if(v&&typeof v==='object'&&!Array.isArray(v))flat(v,kk,s);else s.add(kk);}return s;}
const A=flat(ar),E=flat(en);
const onlyAr=[...A].filter(k=>!E.has(k)),onlyEn=[...E].filter(k=>!A.has(k));
console.log('KEYS ar',A.size,'en',E.size,'onlyAr',onlyAr.length,'onlyEn',onlyEn.length);
console.log('onlyAr sample',onlyAr.slice(0,25));console.log('onlyEn sample',onlyEn.slice(0,25));
// pages -> route regexes
const pages=walk('app').filter(f=>/\/page\.tsx$/.test(f)).map(f=>f.replace(/^app/,'').replace(/\/page\.tsx$/,'').replace(/\/\([^)]+\)/g,'')||'/');
const rx=pages.map(r=>new RegExp('^'+(r==='/'?'/':r.replace(/\[\[\.\.\.[^\]]+\]\]/g,'__OPT__').replace(/\[\.\.\.[^\]]+\]/g,'.+').replace(/\[[^\]]+\]/g,'[^/]+').replace(/\/__OPT__/,'(/.*)?'))+'/?$'));
const apis=walk('app/api').filter(f=>/route\.ts$/.test(f)).map(f=>({r:f.replace(/^app/,'').replace(/\/route\.ts$/,''),m:[...fs.readFileSync(f,'utf8').matchAll(/export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)/g)].map(x=>x[1])}));
apis.push({r:'/api/socket/io',m:['ANY']});
const apiRx=apis.map(a=>({...a,x:new RegExp('^'+a.r.replace(/\[\.\.\.[^\]]+\]/g,'.+').replace(/\[[^\]]+\]/g,'[^/]+')+'/?$')}));
function norm(u){return u.replace(/\$\{[^}]*\}/g,'X').split('?')[0].split('#')[0];}
let badHref=[],badApi=[],arabic=[],iconBtn=0,iconBtnList=[],missingKeys=[];
for(const f of files){const src=fs.readFileSync(f,'utf8');const lines=src.split('\n');
 // hrefs
 for(const m of src.matchAll(/(?:href=|router\.(?:push|replace)\(|redirect\(|callbackUrl:\s*)\{?\s*[`"']([^`"']+)[`"']/g)){let u=m[1];if(!u.startsWith('/')||u.startsWith('/api'))continue;const n=norm(u);if(!rx.some(r=>r.test(n))){const ln=src.slice(0,m.index).split('\n').length;badHref.push(`${f}:${ln} ${u}`);}}
 // href arrays in objects: href: "/..."
 for(const m of src.matchAll(/href:\s*[`"']([^`"']+)[`"']/g)){const u=m[1];if(!u.startsWith('/'))continue;const n=norm(u);if(!rx.some(r=>r.test(n))){const ln=src.slice(0,m.index).split('\n').length;badHref.push(`${f}:${ln} ${u} (obj)`);}}
 // fetch
 for(const m of src.matchAll(/fetch\(\s*[`"'](\/api[^`"']*)[`"']\s*(,\s*\{[\s\S]{0,200}?method:\s*[`"'](\w+)[`"'])?/g)){const n=norm(m[1]);const meth=(m[3]||'GET').toUpperCase();const ln=src.slice(0,m.index).split('\n').length;const a=apiRx.find(a=>a.x.test(n));if(!a)badApi.push(`${f}:${ln} ${meth} ${m[1]} NO ROUTE`);else if(!a.m.includes(meth)&&!a.m.includes('ANY')&&!a.r.includes('nextauth'))badApi.push(`${f}:${ln} ${meth} ${m[1]} -> has ${a.m}`);}
 // arabic
 lines.forEach((l,i)=>{if(/[؀-ۿ]/.test(l)&&!/^\s*(\/\/|\*|\/\*)/.test(l))arabic.push(`${f}:${i+1}`);});
 // icon-only buttons: <Button ... size="icon" ...> without aria-label within tag
 for(const m of src.matchAll(/<(Button|button)\b([^>]*?)>/gs)){const attrs=m[2];if(/size=["']icon["']/.test(attrs)&&!/aria-label/.test(attrs)&&!/asChild/.test(attrs)){iconBtn++;iconBtnList.push(f+':'+src.slice(0,m.index).split('\n').length);}else if(/size=["']icon["']/.test(attrs)&&/asChild/.test(attrs)&&!/aria-label/.test(attrs)){iconBtn++;iconBtnList.push(f+':'+src.slice(0,m.index).split('\n').length+'(asChild)');}}
 // translation keys
 const nsDecl=[...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*(?:[`"']([^`"']*)[`"']|\{[^}]*namespace:\s*[`"']([^`"']*)[`"'][^}]*\})?\s*\)/g)];
 for(const d of nsDecl){const v=d[1],ns=d[2]||d[3]||'';const re=new RegExp(String.raw`(?<![\w.])`+v+String.raw`(?:\.(?:rich|raw|markup))?\(\s*[\x60"']([^\x60"'$]+)[\x60"']`,'g');for(const m of src.matchAll(re)){const near=nsDecl.filter(x=>x[1]===v&&x.index<m.index).pop();if(near!==d)continue;const k=(ns?ns+'.':'')+m[1];const ln=src.slice(0,m.index).split('\n').length;const inE=E.has(k)||[...E].some(x=>x.startsWith(k+'.'));const inA=A.has(k)||[...A].some(x=>x.startsWith(k+'.'));if(!inE||!inA)missingKeys.push(`${f}:${ln} ${k} ${inA?'':'[no ar]'}${inE?'':'[no en]'}`);}}
}
console.log('\nBAD HREFS',badHref.length);badHref.forEach(x=>console.log(' ',x));
console.log('\nBAD API',badApi.length);badApi.forEach(x=>console.log(' ',x));
console.log('\nICON BTN no aria',iconBtn);console.log(iconBtnList.join('\n'));
console.log('\nMISSING KEYS',missingKeys.length);missingKeys.forEach(x=>console.log(' ',x));
const byFile={};arabic.forEach(x=>{const f=x.split(':')[0];byFile[f]=(byFile[f]||0)+1});
console.log('\nARABIC lines by file');Object.entries(byFile).sort((a,b)=>b[1]-a[1]).forEach(([f,c])=>console.log(' ',c,f));
