const G=9.8,clamp=(v,a,b)=>v<a?a:v>b?b:v;
function mk(P){return function stats(l){return{launch:P.l0+P.l1*l.launcher,stall:14-.6*l.wings,gr:P.g0+P.g1*l.wings,
 drag:P.dr/(1+.08*l.wings)/(1+.07*l.body),thrust:5+2.2*l.engine,fuel:2.5+1.4*l.fuel,
 boost:16+1.2*l.nitro+.5*l.engine,nitro0:.4+.06*l.nitro,ndrain:.3/(1+.08*l.nitro)};};}
const cliff=d=>-22*clamp((d-15)/80,0,1);
function run(stats,P,l,power=1,useBoost=true,pin=0){
 const S=stats(l);const q={a:.42,s:S.launch*power,y:9,z:0,fuel:S.fuel,nitro:S.nitro0};let t=0;const dt=.02;let peak=0;
 while(t<900){
  const boosting=useBoost&&q.nitro>0&&q.s<S.stall*1.7;
  const liftF=clamp((q.s-S.stall*.6)/(S.stall*.4),0,1);
  let th=0;if(q.fuel>0){th=S.thrust;q.fuel-=dt;}
  if(boosting){th+=S.boost;q.nitro-=S.ndrain*dt;}
  const at=clamp(P.trim+(q.s-1.3*S.stall)*P.tk,-.03,P.tmax);q.a+=(at-q.a)*dt*.9*liftF+pin*1.4*dt-(1-liftF)*1.2*dt;q.a=clamp(q.a,-1.45,1.45);
  q.s+=(-G*Math.sin(q.a)-S.drag*q.s*q.s+th)*dt;if(q.s<1)q.s=1;
  const vy=q.s*Math.sin(q.a)*(.4+.6*liftF)-(q.s/S.gr+P.sk)*liftF-(1-liftF)*7;
  q.z+=q.s*Math.cos(q.a)*dt;q.y+=vy*dt;t+=dt;peak=Math.max(peak,q.y);
  if(q.y<=cliff(q.z)+1)break;
 }
 return [Math.round(q.z),Math.round(t)];
}
const L=(n)=>({launcher:n,wings:n,engine:n,fuel:n,body:n,nitro:n});
for(const P of[
 {l0:34,l1:6.5,g0:7,g1:1.2,dr:.0028,trim:.02,sk:1.5,tk:.003,tmax:.22},
 {l0:34,l1:6.5,g0:7,g1:1.2,dr:.0028,trim:.02,sk:1.5,tk:.002,tmax:.18},
 {l0:34,l1:6.5,g0:7,g1:1.2,dr:.0032,trim:.02,sk:1.5,tk:.003,tmax:.22},
 {l0:34,l1:6.5,g0:6,g1:1.3,dr:.0032,trim:.02,sk:2,tk:.0035,tmax:.25},
]){const st=mk(P);
 const o=[];for(const n of[0,2,4,6,8,10])o.push(n+':'+run(st,P,L(n)).join('/')+' nb'+run(st,P,L(n),1,false)[0]);
 console.log(JSON.stringify(P));console.log(' ',o.join('  '),' weak',run(st,P,L(0),.6).join('/'),' up',run(st,P,L(0),1,true,.3).join('/'));
}
{const P={l0:34,l1:6.5,g0:7,g1:.9,dr:.0028,trim:.02,sk:1.5,tk:.003,tmax:.2};const st=mk(P);
 const o=[];for(const n of[0,1,2,3,4,5,6,7,8,9,10])o.push(n+':'+run(st,P,L(n)).join('/'));console.log('FINAL',o.join(' '));
 for(const k of['launcher','wings','engine','fuel','body','nitro']){const l=L(0);l[k]=5;const l2=L(5);l2[k]=10;console.log(k,'only5',run(st,P,l).join('/'),'all5+this10',run(st,P,l2).join('/'));}
 console.log('all5',run(st,P,L(5)).join('/'));}
