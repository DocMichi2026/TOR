import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js";
import { mergeGeometries } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/utils/BufferGeometryUtils.js";
import { GLTFExporter } from "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/exporters/GLTFExporter.js";
/* ============================================================================
   TOR · Motor anatómico modular · Mano derecha + antebrazo distal
   Requiere en ámbito: THREE, mergeGeometries, GLTFExporter
   Ejes:  +Y proximal · -Y distal · +X radial (pulgar) · +Z palmar (volar)
   Unidad de trabajo ≈ 4 cm. Origen en el centro de la articulación radiocarpiana.
   Todas las estructuras son mallas independientes, nombradas en español.
   ========================================================================== */

const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
const PAL={
  hueso:0xE9DCC0, huesoAlt:0xE2D4B4, huesoProf:0xDACBA8,
  musculo:0x9C3E36, musculoAlt:0x8B3831, musculoProf:0x81342E, musculoTen:0xA6483C,
  tendon:0xE8DCC2, tendonProf:0xD9C9A6,
  ligamento:0xCFCEC5, polea:0xD6D5CC, sinovial:0xC5DBDE,
  nervio:0xD5B043, arteria:0xAB393C, vena:0x49608F
};

/* ---------------- texturas procedurales ---------------- */
function texRayas(){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,256,256);
  for(let i=0;i<150;i++){
    const px=i*1.75+Math.random()*2,g=Math.random();
    x.strokeStyle='rgba('+(110+g*40|0)+',86,78,'+(0.07+g*0.15).toFixed(3)+')';
    x.lineWidth=0.5+Math.random()*1.5;x.beginPath();x.moveTo(px,-4);
    x.bezierCurveTo(px+Math.sin(i*1.3)*7,74,px+Math.cos(i*0.9)*8,176,px+Math.sin(i*2.1)*6,260);x.stroke();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(3,3);
  t.colorSpace=THREE.SRGBColorSpace;return t;
}
function texHueso(){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d');
  x.fillStyle='#ffffff';x.fillRect(0,0,256,256);
  for(let i=0;i<240;i++){
    const r=4+Math.random()*26,cx=Math.random()*256,cy=Math.random()*256;
    const g=x.createRadialGradient(cx,cy,0,cx,cy,r);
    g.addColorStop(0,'rgba(196,176,140,'+(0.02+Math.random()*0.10).toFixed(3)+')');
    g.addColorStop(1,'rgba(255,255,255,0)');
    x.fillStyle=g;x.beginPath();x.arc(cx,cy,r,0,7);x.fill();
  }
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);
  t.colorSpace=THREE.SRGBColorSpace;return t;
}
const TEX={mus:texRayas(),oss:texHueso()};

function mat(color,o){
  o=o||{};
  const m=new THREE.MeshStandardMaterial({
    color:color,
    roughness:o.r===undefined?0.74:o.r,
    metalness:o.m===undefined?0.02:o.m
  });
  if(o.tex!==null){const t=o.tex||TEX.oss;m.map=t;m.bumpMap=t;m.bumpScale=o.bump===undefined?0.02:o.bump;}
  if(o.transparent){m.transparent=true;m.opacity=o.opacity;m.depthWrite=o.depthWrite!==false;}
  if(o.side)m.side=o.side;
  return m;
}
const MAT_DOBLE=THREE.DoubleSide;

function hash3(x,y,z,s){const v=Math.sin(x*127.1+y*311.7+z*74.7+s*13.37)*43758.5453;return (v-Math.floor(v))*2-1;}

function tubeGeo(pts,rFn,opt){
  opt=opt||{};
  const tub=opt.tub||44,rad=opt.rad||13,sq=opt.sq===undefined?1:opt.sq;
  const c=new THREE.CatmullRomCurve3(pts.map(p=>p.clone()),false,'catmullrom',0.3);
  const fr=c.computeFrenetFrames(tub,false);
  const pos=[],nor=[],idx=[],uvs=[];
  for(let i=0;i<=tub;i++){
    const t=i/tub,p=c.getPoint(t),r=(typeof rFn==='function')?rFn(t):rFn;
    const N=fr.normals[i]||V3(1,0,0),B=fr.binormals[i]||V3(0,0,1);
    for(let j=0;j<=rad;j++){
      const a=j/rad*Math.PI*2,s=Math.sin(a),co=Math.cos(a);
      let nx=co*N.x+s*B.x*sq,ny=co*N.y+s*B.y*sq,nz=co*N.z+s*B.z*sq;
      const L=Math.hypot(nx,ny,nz)||1;nx/=L;ny/=L;nz/=L;
      pos.push(p.x+r*nx,p.y+r*ny,p.z+r*nz);nor.push(nx,ny,nz);
      uvs.push(j/rad*2,t*2.4);
    }
  }
  for(let i=0;i<tub;i++)for(let j=0;j<rad;j++){
    const a=i*(rad+1)+j,b=a+rad+1;idx.push(a,b,a+1,b,b+1,a+1);
  }
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setAttribute('normal',new THREE.Float32BufferAttribute(nor,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  g.setIndex(idx);return g;
}
function sph(r,p,seg,ring){return new THREE.SphereGeometry(r,seg||14,ring||10).translate(p.x,p.y,p.z);}
function blob(rx,ry,rz,seed,detail){
  const g=new THREE.SphereGeometry(1,20,14),a=g.attributes.position,d=detail===undefined?0.06:detail;
  for(let i=0;i<a.count;i++){
    const x=a.getX(i),y=a.getY(i),z=a.getZ(i),n=1+d*hash3(x*3,y*3,z*3,seed||1);
    a.setXYZ(i,x*rx*n,y*ry*n,z*rz*n);
  }
  g.computeVertexNormals();return g;
}
function place(g,p,rot){
  const m=new THREE.Matrix4();
  if(rot)m.makeRotationFromEuler(rot);
  m.setPosition(p.x,p.y,p.z);g.applyMatrix4(m);return g;
}
function bandaAxial(centro,ax,sd,vl,radio,largo,arco,dorsal){
  const ini=dorsal?(Math.PI-arco/2):(-arco/2);
  const g=new THREE.CylinderGeometry(radio,radio,largo,28,1,true,ini,arco);
  const m=new THREE.Matrix4();
  if(dorsal)m.makeBasis(sd.clone().negate(),ax.clone(),vl.clone().negate());
  else m.makeBasis(sd.clone(),ax.clone(),vl.clone());
  m.setPosition(centro);g.applyMatrix4(m);return g;
}
function fanGeo(largo,w0,w1,grosor){
  const s=new THREE.Shape();
  s.moveTo(-w0/2,0);s.lineTo(w0/2,0);
  s.quadraticCurveTo(w1*0.66,largo*0.55,w1/2,largo);
  s.lineTo(-w1/2,largo);
  s.quadraticCurveTo(-w1*0.66,largo*0.55,-w0/2,0);
  return new THREE.ExtrudeGeometry(s,{depth:grosor,bevelEnabled:false,curveSegments:10,steps:1});
}
function colocarFan(g,origen,ax,sd,vl){
  g.applyMatrix4(new THREE.Matrix4().makeBasis(sd.clone(),ax.clone(),vl.clone()).setPosition(origen));
  return g;
}
function axisDe(a,b){return b.clone().sub(a).normalize();}
function volarDe(a,b,ref){
  const ax=axisDe(a,b);
  let v=ref.clone().sub(ax.clone().multiplyScalar(ref.dot(ax)));
  if(v.lengthSq()<1e-5)v=V3(0,0,1);
  return v.normalize();
}
function ladoDe(ax,vl){return new THREE.Vector3().crossVectors(ax,vl).normalize();}
function partes(lista){
  const gs=lista.map(g=>{
    let x=g.index?g.toNonIndexed():g;
    if(x.attributes.uv1)x.deleteAttribute('uv1');
    if(x.attributes.uv2)x.deleteAttribute('uv2');
    if(!x.attributes.uv){
      const n=x.attributes.position.count,u=new Float32Array(n*2);
      for(let i=0;i<n;i++){u[i*2]=0.5;u[i*2+1]=0.5;}
      x.setAttribute('uv',new THREE.Float32BufferAttribute(u,2));
    }
    return x;
  });
  const out=mergeGeometries(gs,false);
  gs.forEach(g=>g.dispose());
  out.computeBoundingSphere();
  return out;
}

/* ============================================================================
   REGISTRO
   ========================================================================== */
const COLECCIONES=[
  {id:'HUESOS',nombre:'Huesos',sis:'oseo'},
  {id:'ARTICULACIONES',nombre:'Articulaciones',sis:'articulaciones'},
  {id:'MUSCULOS_EXTRINSECOS',nombre:'Músculos extrínsecos',sis:'muscular'},
  {id:'TENDONES_FLEXORES',nombre:'Tendones flexores',sis:'tendinoso'},
  {id:'TENDONES_EXTENSORES',nombre:'Tendones extensores',sis:'tendinoso'},
  {id:'MUSCULOS_INTRINSECOS',nombre:'Músculos intrínsecos',sis:'muscular'},
  {id:'NERVIOS',nombre:'Nervios',sis:'nervioso'},
  {id:'VASOS',nombre:'Vasos sanguíneos',sis:'vascular'},
  {id:'LIGAMENTOS',nombre:'Ligamentos',sis:'ligamentoso'},
  {id:'POLEAS',nombre:'Poleas y vainas',sis:'ligamentoso'}
];
const SISTEMAS=[
  {id:'oseo',nombre:'Sistema óseo'},
  {id:'muscular',nombre:'Sistema muscular'},
  {id:'tendinoso',nombre:'Sistema tendinoso'},
  {id:'ligamentoso',nombre:'Sistema ligamentoso'},
  {id:'articulaciones',nombre:'Articulaciones'},
  {id:'nervioso',nombre:'Nervios'},
  {id:'vascular',nombre:'Vasos sanguíneos'}
];
const STR=[];
function mk(id,nombre,latin,o){
  const s={id:id,nombre:nombre,latin:latin,abbr:o.abbr||'',sis:o.sis,col:o.col,
    region:o.reg||'',dig:o.dig||'',estado:o.estado||'completo',meta:o.meta||{},
    geo:[],mat:mat(o.color,o.mo),visible:true,mesh:null,contorno:null,
    baseT:!!(o.mo&&o.mo.transparent),baseO:(o.mo&&o.mo.opacity)||1,
    baseDW:!(o.mo&&o.mo.transparent&&o.mo.depthWrite===false)};
  STR.push(s);return s;
}
function mus(nombre,latin,abbr,o,ins,acc,inn,extra){
  const m={origen:o,insercion:ins,accion:acc,inervacion:inn};
  if(extra)Object.keys(extra).forEach(k=>m[k]=extra[k]);
  return {nombre:nombre,latin:latin,abbr:abbr,meta:m};
}
const MM={
  fds:mus('Flexor superficial de los dedos','Musculus flexor digitorum superficialis','FDS',
    'Cabeza humeroulnar: epicóndilo medial y ligamento colateral cubital. Cabeza radial: mitad proximal de la cara anterior del radio.',
    'Bases de las falanges medias de II–V mediante dos bandeletas que perforan el tendón del FDP.',
    'Flexión de la IFP; contribuye a la flexión de la IFD y de la MCF.','Nervio mediano.'),
  fdp:mus('Flexor profundo de los dedos','Musculus flexor digitorum profundus','FDP',
    'Cara anterior y borde interóseo de la ulna, aponeurosis propia y mitad proximal de la cara anterior del radio.',
    'Bases de las falanges distales de II–V.','Flexión de la IFD y, a través de ella, de la IFP y la MCF.','Mediano (II–III) y ulnar (IV–V).'),
  fpl:mus('Flexor largo del pulgar','Musculus flexor pollicis longus','FPL',
    'Cara anterior del radio (tercio medio) y membrana interósea.','Base de la falange distal del pulgar.',
    'Flexión de la IF y de la MCF del pulgar.','Nervio mediano (interóseo anterior).'),
  fcr:mus('Flexor radial del carpo','Musculus flexor carpi radialis','FCR','Epicóndilo medial (origen flexor común).',
    'Base del segundo metacarpiano; a veces una lengüeta al tercero.','Flexión y abducción radial de la muñeca.','Nervio mediano.'),
  fcu:mus('Flexor ulnar del carpo','Musculus flexor carpi ulnaris','FCU',
    'Cabeza humeral: epicóndilo medial. Cabeza ulnar: olécranon y borde posterior de la ulna.',
    'Pisiforme, gancho del ganchoso y base del quinto metacarpiano.','Flexión y aducción ulnar de la muñeca.','Nervio ulnar.'),
  pl:mus('Palmar largo','Musculus palmaris longus','PL','Epicóndilo medial (origen flexor común).',
    'Aponeurosis palmar y retináculo flexor.','Tensa la aponeurosis palmar y colabora en la flexión de la muñeca.','Nervio mediano.',
    {variacion:'Presente en torno al 85 % de la población; su ausencia es una variante normal.'}),
  ed:mus('Extensor de los dedos','Musculus extensor digitorum','ED','Epicóndilo lateral (origen extensor común).',
    'Expansiones extensoras de II–V, que terminan en las bases de las falanges media y distal.',
    'Extensión de la MCF y, por las expansiones, de la IFP y la IFD.','Nervio interóseo posterior.'),
  ei:mus('Extensor del índice','Musculus extensor indicis','EI','Cara posterior de la ulna (tercio distal) y membrana interósea.',
    'Expansión extensora del índice.','Extensión del índice independiente del extensor de los dedos.','Nervio interóseo posterior.'),
  edm:mus('Extensor del meñique','Musculus extensor digiti minimi','EDM','Epicóndilo lateral (origen extensor común).',
    'Expansión extensora del quinto dedo.','Extensión de la MCF del meñique.','Nervio interóseo posterior.'),
  epl:mus('Extensor largo del pulgar','Musculus extensor pollicis longus','EPL',
    'Cara posterior de la ulna (tercio medio) y membrana interósea.','Base de la falange distal del pulgar.',
    'Extensión de la IF y la MCF del pulgar; retropulsión del primer metacarpiano.','Nervio interóseo posterior.'),
  epb:mus('Extensor corto del pulgar','Musculus extensor pollicis brevis','EPB',
    'Cara posterior del radio (tercio distal) y membrana interósea.','Base de la falange proximal del pulgar.',
    'Extensión de la MCF del pulgar y abducción del primer metacarpiano.','Nervio interóseo posterior.'),
  apl:mus('Abductor largo del pulgar','Musculus abductor pollicis longus','APL',
    'Caras posteriores de ulna y radio proximales y membrana interósea.','Base del primer metacarpiano y trapecio.',
    'Abducción y extensión del primer metacarpiano.','Nervio interóseo posterior.'),
  ecrl:mus('Extensor radial largo del carpo','Musculus extensor carpi radialis longus','ECRL',
    'Cresta supracondílea lateral y tabique intermuscular lateral.','Base del segundo metacarpiano.',
    'Extensión y abducción radial de la muñeca.','Nervio radial.'),
  ecrb:mus('Extensor radial corto del carpo','Musculus extensor carpi radialis brevis','ECRB',
    'Epicóndilo lateral (origen extensor común).','Base del tercer metacarpiano.','Extensión y abducción radial de la muñeca.','Nervio interóseo posterior.'),
  ecu:mus('Extensor ulnar del carpo','Musculus extensor carpi ulnaris','ECU',
    'Epicóndilo lateral y borde posterior de la ulna.','Base del quinto metacarpiano.','Extensión y aducción ulnar de la muñeca.','Nervio interóseo posterior.'),
  apb:mus('Abductor corto del pulgar','Musculus abductor pollicis brevis','APB',
    'Retináculo flexor (tubérculo del escafoides y trapecio) y aponeurosis palmar.',
    'Base de la falange proximal del pulgar, lado lateral, y expansión extensora.',
    'Abducción palmar del pulgar.','Nervio mediano (ramo recurrente).'),
  fpb:mus('Flexor corto del pulgar','Musculus flexor pollicis brevis','FPB',
    'Cabeza superficial: retináculo flexor y trapecio. Cabeza profunda: trapecio, trapezoide y base del primer metacarpiano.',
    'Base de la falange proximal del pulgar, con un sesamoideo en cada cabeza.',
    'Flexión de la MCF del pulgar.','Mediano (superficial) y ulnar (profunda).'),
  op:mus('Oponente del pulgar','Musculus opponens pollicis','OP',
    'Retináculo flexor y tubérculo del trapecio.','Borde lateral del primer metacarpiano.',
    'Oposición del pulgar: flexión, abducción y rotación medial del primer metacarpiano.','Nervio mediano (ramo recurrente).'),
  adpo:mus('Aductor del pulgar, cabeza oblicua','Musculus adductor pollicis, caput obliquum','ADP-o',
    'Base del segundo y tercer metacarpiano, hueso grande y vaina del flexor radial del carpo.',
    'Base de la falange proximal del pulgar y sesamoideo medial.','Aducción y oposición del pulgar.','Nervio ulnar (ramo profundo).'),
  adpt:mus('Aductor del pulgar, cabeza transversa','Musculus adductor pollicis, caput transversum','ADP-t',
    'Cara anterior del tercer metacarpiano y ligamento metacarpiano palmar.',
    'Base de la falange proximal del pulgar y sesamoideo medial.','Aducción del pulgar hacia el plano de la palma.','Nervio ulnar (ramo profundo).'),
  adm:mus('Abductor del meñique','Musculus abductor digiti minimi','ADM',
    'Pisiforme, tendón del flexor ulnar del carpo y retináculo flexor.',
    'Base de la falange proximal del quinto dedo y expansión extensora.','Abducción y flexión de la MCF del meñique.','Nervio ulnar (ramo profundo).'),
  fdmb:mus('Flexor corto del meñique','Musculus flexor digiti minimi brevis','FDMB',
    'Gancho del ganchoso y retináculo flexor.','Base de la falange proximal del quinto dedo.','Flexión de la MCF del meñique.','Nervio ulnar (ramo profundo).'),
  odm:mus('Oponente del meñique','Musculus opponens digiti minimi','ODM',
    'Gancho del ganchoso y retináculo flexor.','Borde ulnar del quinto metacarpiano.',
    'Rotación y aproximación del quinto metacarpiano al pulgar.','Nervio ulnar (ramo profundo).'),
  pb:mus('Palmar corto','Musculus palmaris brevis','PB','Retináculo flexor y aponeurosis palmar.',
    'Dermis del borde ulnar de la mano.','Arruga la eminencia hipotenar y protege el trayecto ulnar superficial.','Nervio ulnar (ramo superficial).')
};

/* ---------------- hitos ---------------- */
const FOR_TOP=3.34;
const CARPO={
  escafoides:{p:V3(0.34,0.62,-0.01),s:[0.17,0.27,0.15],r:[0.30,0.10,0.55],nom:'Escafoides',lat:'Os scaphoideum',
    art:'Articula con radio, semilunar, trapecio, trapezoide y grande.'},
  semilunar:{p:V3(-0.11,0.68,0.01),s:[0.17,0.15,0.15],r:[0.05,0,0.25],nom:'Semilunar',lat:'Os lunatum',
    art:'Articula con radio, escafoides, piramidal y grande.'},
  piramidal:{p:V3(-0.50,0.64,0.0),s:[0.15,0.16,0.14],r:[0,-0.15,0.35],nom:'Piramidal',lat:'Os triquetrum',
    art:'Articula con semilunar, pisiforme y ganchoso.'},
  pisiforme:{p:V3(-0.58,0.50,0.18),s:[0.085,0.10,0.085],r:[0.3,0.5,0.2],nom:'Pisiforme',lat:'Os pisiforme',
    art:'Articula con la cara palmar del piramidal; da inserción al flexor ulnar del carpo.'},
  trapecio:{p:V3(0.50,0.22,0.05),s:[0.14,0.13,0.13],r:[0.2,0.4,0.25],nom:'Trapecio',lat:'Os trapezium',
    art:'Articula con escafoides, trapezoide y primer metacarpiano.'},
  trapezoide:{p:V3(0.26,0.18,0.0),s:[0.11,0.11,0.12],r:[0.1,0.2,0.15],nom:'Trapezoide',lat:'Os trapezoideum',
    art:'Articula con escafoides, trapecio, grande y segundo metacarpiano.'},
  grande:{p:V3(-0.02,0.12,0.0),s:[0.155,0.20,0.155],r:[0.15,0.1,0.2],nom:'Grande',lat:'Os capitatum',
    art:'Eje de la fila distal: articula con escafoides, semilunar, trapezoide, ganchoso y tercer metacarpiano.'},
  ganchoso:{p:V3(-0.34,0.18,0.02),s:[0.165,0.185,0.15],r:[0.1,0.3,0.2],nom:'Ganchoso',lat:'Os hamatum',
    art:'Articula con piramidal, grande y cuarto y quinto metacarpianos; su gancho es polea del flexor ulnar.'}
};
const FING=[
  {k:'indice', num:'II', nom:'índice', mcp:V3(0.58,-1.52,0.02), base:V3(0.40,-0.30,0.00), seg:[1.08,0.68,0.46], flex:[0.10,0.20,0.16], dx:0.030, xi:0.28},
  {k:'medio',  num:'III',nom:'medio',  mcp:V3(0.12,-1.62,0.02), base:V3(0.05,-0.26,0.00), seg:[1.14,0.74,0.50], flex:[0.09,0.18,0.15], dx:-0.005, xi:0.07},
  {k:'anular', num:'IV', nom:'anular', mcp:V3(-0.34,-1.54,0.02),base:V3(-0.20,-0.24,0.00),seg:[1.05,0.68,0.46], flex:[0.10,0.20,0.16], dx:-0.035, xi:-0.15},
  {k:'menique',num:'V',  nom:'meñique',mcp:V3(-0.80,-1.40,0.02),base:V3(-0.50,-0.22,0.00),seg:[0.90,0.58,0.40], flex:[0.12,0.22,0.17], dx:-0.060, xi:-0.34}
];
const THUMB={cmc:V3(0.52,-0.24,0.13),mcp:V3(1.06,-0.76,0.30),ip:V3(1.44,-1.22,0.45),tip:V3(1.72,-1.58,0.55)};
const VREF=V3(0,0,1), VREF_P=V3(-0.62,0,0.78).normalize();

/* radios óseos por segmento digital */
const RB=[0.062,0.054,0.044];          /* falange proximal, media, distal */
const TEND_OFF=0.030;                  /* tendón flexor sobre el hueso  */
const PULL_OFF=0.058;                  /* cara interna de la polea      */
const R_MC=[0.084,0.098];              /* caña y cabeza del metacarpiano */

function cadena(f){
  const j=[f.mcp.clone().add(V3(0,-0.048,0))];let cum=0;
  for(let i=0;i<3;i++){
    cum+=f.flex[i];
    const d=V3(f.dx*(i===0?1:1.30),-Math.cos(cum),Math.sin(cum)).normalize();
    j.push(j[j.length-1].clone().addScaledVector(d,f.seg[i]));
  }
  return j;
}
function frames(j,ref){
  const out=[];
  for(let i=0;i<j.length-1;i++){
    const a=j[i],b=j[i+1],ax=axisDe(a,b),vl=volarDe(a,b,ref),sd=ladoDe(ax,vl);
    out.push({a:a,b:b,ax:ax,vl:vl,sd:sd,dorsal:vl.clone().negate(),len:a.distanceTo(b),
      r:RB[Math.min(i,2)]});
  }
  return out;
}
function vientre(p0,p1,rMax,flat,opt){
  opt=opt||{};
  const c=[p0.clone(),p0.clone().lerp(p1,0.38),p0.clone().lerp(p1,0.74),p1.clone()];
  return tubeGeo(c,t=>rMax*(0.26+0.74*Math.sin(Math.PI*Math.pow(t,0.82))),{tub:opt.tub||26,rad:12,sq:flat===undefined?0.8:flat});
}

/* ============================================================================
   CONSTRUCCIÓN
   ========================================================================== */
function construir(){
  const root=new THREE.Group();root.name='mano_derecha_TOR';
  const CG={};
  COLECCIONES.forEach(c=>{const g=new THREE.Group();g.name=c.id;root.add(g);CG[c.id]=g;});

  /* ---------- antebrazo ---------- */
  const radio=mk('hueso_radio','Radio (extremo distal)','Radius, extremitas distalis',
    {sis:'oseo',col:'HUESOS',reg:'Antebrazo distal',color:PAL.hueso,mo:{tex:TEX.oss,bump:0.03},
     meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',
      articulaciones:'Carilla carpiana para escafoides y semilunar; escotadura ulnar para la cabeza de la ulna.'}});
  radio.geo.push(tubeGeo([V3(0.15,FOR_TOP,0.03),V3(0.20,2.2,0.09),V3(0.25,1.5,0.07),V3(0.29,0.98,0.06)],
    t=>0.098+0.026*Math.sin(Math.PI*Math.min(1,t))+0.070*Math.exp(-Math.pow((t-0.96)/0.13,2)),{tub:44,rad:16,sq:0.9}));
  radio.geo.push(place(blob(0.155,0.075,0.115,7,0.04),V3(0.29,0.96,0.02)));

  const ulna=mk('hueso_ulna','Ulna (extremo distal)','Ulna, extremitas distalis',
    {sis:'oseo',col:'HUESOS',reg:'Antebrazo distal',color:PAL.hueso,mo:{tex:TEX.oss,bump:0.03},
     meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',
      articulaciones:'Cabeza ulnar con la escotadura ulnar del radio; el ligamento triangular la separa del carpo.'}});
  ulna.geo.push(tubeGeo([V3(-0.29,FOR_TOP,-0.02),V3(-0.33,2.3,0.02),V3(-0.37,1.6,0.0),V3(-0.395,1.16,0.01)],
    t=>0.088+0.026*Math.exp(-Math.pow((t-0.97)/0.09,2)),{tub:40,rad:14,sq:0.9}));
  ulna.geo.push(place(blob(0.125,0.12,0.12,11,0.045),V3(-0.395,1.10,0.01)));
  ulna.geo.push(sph(0.045,V3(-0.47,1.02,0.03),10,8));

  /* ---------- carpo ---------- */
  let ci=0;
  Object.keys(CARPO).forEach(k=>{
    ci++;
    const c=CARPO[k];
    const s=mk('hueso_'+k,c.nom,c.lat,{sis:'oseo',col:'HUESOS',reg:'Carpo',color:ci%2?PAL.huesoAlt:PAL.hueso,
      mo:{tex:TEX.oss,bump:0.035},meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',articulaciones:c.art}});
    s.geo.push(place(blob(c.s[0],c.s[1],c.s[2],ci,0.11),c.p,new THREE.Euler(c.r[0],c.r[1],c.r[2])));
    if(k==='ganchoso'){
      s.geo.push(new THREE.CylinderGeometry(0.032,0.038,0.16,12).translate(-0.32,0.03,0.15));
      s.geo.push(sph(0.040,V3(-0.32,0.11,0.16),10,8));
    }
    if(k==='pisiforme')s.geo.push(place(blob(0.06,0.075,0.06,3,0.08),V3(-0.585,0.40,0.165)));
  });

  /* ---------- metacarpianos ---------- */
  const MC={},ART_MC={
    1:'Articulación en silla de montar con el trapecio; la más móvil de la mano.',
    2:'Base encajada en el trapezoide; el más fijo de los metacarpianos.',
    3:'Base en el grande; su eje es el pilar central del arco transverso.',
    4:'Base en el ganchoso; movilidad limitada.',
    5:'Base en el ganchoso; inserción del extensor ulnar del carpo y del oponente del meñique.'};
  FING.forEach(f=>{
    const idx=f.num==='II'?'2':f.num==='III'?'3':f.num==='IV'?'4':'5';
    const s=mk('hueso_metacarpiano_'+idx,'Metacarpiano '+f.num,'Os metacarpale '+f.num,
      {sis:'oseo',col:'HUESOS',reg:'Metacarpo',dig:f.nom,color:PAL.huesoAlt,mo:{tex:TEX.oss,bump:0.03},
       meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',articulaciones:ART_MC[idx]}});
    const ax=axisDe(f.base,f.mcp);
    s.geo.push(tubeGeo([f.base.clone().addScaledVector(ax,-0.06),f.base.clone().lerp(f.mcp,0.42).add(V3(0,0,-0.02)),f.mcp.clone()],
      t=>R_MC[0]+(R_MC[1]-R_MC[0])*Math.exp(-Math.pow((t-0.94)/0.11,2))+0.012*Math.exp(-Math.pow((t-0.05)/0.10,2)),
      {tub:40,rad:14,sq:0.88}));
    s.geo.push(place(blob(0.092,0.078,0.080,idx*3,0.05),f.mcp.clone().addScaledVector(ax,-0.01)));
    MC[f.k]={s:s,ax:ax};
  });
  {
    const s=mk('hueso_metacarpiano_1','Metacarpiano I','Os metacarpale I',
      {sis:'oseo',col:'HUESOS',reg:'Metacarpo',dig:'pulgar',color:PAL.hueso,mo:{tex:TEX.oss,bump:0.03},
       meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',articulaciones:ART_MC[1]}});
    const ax=axisDe(THUMB.cmc,THUMB.mcp);
    s.geo.push(tubeGeo([THUMB.cmc.clone().addScaledVector(ax,-0.07),THUMB.cmc.clone().lerp(THUMB.mcp,0.45),THUMB.mcp.clone()],
      t=>0.082+0.026*Math.exp(-Math.pow((t-0.92)/0.11,2)),{tub:36,rad:14,sq:0.88}));
    s.geo.push(place(blob(0.108,0.092,0.094,5,0.055),THUMB.cmc));
    s.geo.push(place(blob(0.092,0.080,0.082,9,0.05),THUMB.mcp));
    MC.pulgar={s:s,ax:ax};
  }

  /* ---------- falanges ---------- */
  const DIG={};
  const NOM=['proximal','media','distal'],LAT=['proximalis','media','distalis'];
  FING.forEach(f=>{
    const j=cadena(f),fr=frames(j,VREF);
    DIG[f.k]={f:f,j:j,fr:fr};
    fr.forEach((sg,i)=>{
      const s=mk('hueso_falange_'+NOM[i]+'_'+f.k,'Falange '+NOM[i]+' del '+f.nom,'Phalanx '+LAT[i]+' '+f.num,
        {sis:'oseo',col:'HUESOS',reg:'Dedos',dig:f.nom,color:PAL.hueso,mo:{tex:TEX.oss,bump:0.028},
         meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',
          articulaciones:i===0?'Base articular con el metacarpiano (MCF).':(i===1?'Articulación IFP con la falange proximal.':'Articulación IFD con la falange media.')}});
      const r=RB[i];
      s.geo.push(tubeGeo([sg.a.clone().addScaledVector(sg.ax,-0.025),sg.a.clone().lerp(sg.b,0.5),sg.b.clone().addScaledVector(sg.ax,0.012)],
        t=>r+0.013*Math.exp(-Math.pow((t-0.90)/0.12,2))+0.009*Math.exp(-Math.pow((t-0.08)/0.12,2)),
        {tub:30,rad:12,sq:0.9}));
      s.geo.push(place(blob(r*1.30,r*1.12,r*1.18,i+3,0.045),sg.b.clone().addScaledVector(sg.ax,-0.008)));
    });
  });
  {
    const j=[THUMB.mcp.clone(),THUMB.ip.clone(),THUMB.tip.clone()];
    const fr=frames(j,VREF_P);
    DIG.pulgar={f:{k:'pulgar',num:'I',nom:'pulgar'},j:j,fr:fr};
    fr.forEach((sg,i)=>{
      const s=mk('hueso_falange_'+(i===0?'proximal':'distal')+'_pulgar','Falange '+(i===0?'proximal':'distal')+' del pulgar',
        'Phalanx '+(i===0?'proximalis':'distalis')+' I',
        {sis:'oseo',col:'HUESOS',reg:'Dedos',dig:'pulgar',color:PAL.hueso,mo:{tex:TEX.oss,bump:0.028},
         meta:{origen:'—',insercion:'—',accion:'—',inervacion:'—',
          articulaciones:i===0?'Articulación MCF del pulgar.':'Articulación IF del pulgar.'}});
      const r=i===0?0.070:0.058;
      s.geo.push(tubeGeo([sg.a.clone().addScaledVector(sg.ax,-0.025),sg.a.clone().lerp(sg.b,0.5),sg.b.clone().addScaledVector(sg.ax,0.010)],
        t=>r+0.014*Math.exp(-Math.pow((t-0.88)/0.13,2)),{tub:28,rad:12,sq:0.9}));
      s.geo.push(place(blob(r*1.28,r*1.12,r*1.16,i+8,0.045),sg.b.clone().addScaledVector(sg.ax,-0.008)));
    });
  }

  /* ---------- poleas y vainas ---------- */
  const POLEA=[
    {id:'A1',seg:0,t:0.06,arc:3.4,w:0.085},
    {id:'A2',seg:0,t:0.56,arc:3.3,w:0.24},
    {id:'A3',seg:1,t:0.03,arc:3.2,w:0.08},
    {id:'A4',seg:1,t:0.52,arc:3.2,w:0.19},
    {id:'A5',seg:2,t:0.03,arc:3.1,w:0.07}
  ];
  const CRUZ=[{id:'C1',seg:0,t:0.83},{id:'C2',seg:1,t:0.26},{id:'C3',seg:2,t:0.62}];
  FING.forEach(f=>{
    const D=DIG[f.k];
    POLEA.forEach(p=>{
      const sg=D.fr[p.seg];
      const centro=sg.a.clone().lerp(sg.b,p.t);
      const s=mk('polea_'+p.id+'_'+f.k,'Polea '+p.id+' del '+f.nom,'Pars anularis '+p.id.slice(1)+' '+f.num,
        {sis:'poleas',col:'POLEAS',reg:'Vaina fibrosa',dig:f.nom,color:PAL.polea,mo:{tex:null,r:0.62,side:MAT_DOBLE},
         meta:{origen:'—',insercion:'—',inervacion:'—',
          accion:'Retiene el tendón flexor contra la falange y evita el arqueamiento («bowstring») durante la flexión.',
          articulaciones:'Zona '+(p.id==='A1'?'V':p.id==='A2'?'II':p.id==='A3'?'III':p.id==='A4'?'II':'I')+' de la vaina fibrosa del '+f.nom+'.'}});
      s.geo.push(bandaAxial(centro,sg.ax,sg.sd,sg.vl,sg.r+PULL_OFF,p.w,p.arc,false));
    });
    CRUZ.forEach(c=>{
      const sg=D.fr[c.seg],centro=sg.a.clone().lerp(sg.b,c.t);
      const s=mk('polea_'+c.id+'_'+f.k,'Polea cruciforme '+c.id+' del '+f.nom,'Pars cruciformis '+c.id.slice(1)+' '+f.num,
        {sis:'poleas',col:'POLEAS',reg:'Vaina fibrosa',dig:f.nom,color:PAL.polea,mo:{tex:null,r:0.62,side:MAT_DOBLE},
         meta:{origen:'—',insercion:'—',inervacion:'—',
          accion:'Fibra cruzada que permite el acortamiento de la vaina al flexionar el dedo.',
          articulaciones:'Entre las poleas anulares vecinas.'}});
      s.geo.push(bandaAxial(centro,sg.ax,sg.sd,sg.vl,sg.r+PULL_OFF-0.004,0.028,2.5,false));
    });
    const vf=mk('vaina_fibrosa_'+f.k,'Vaina fibrosa digital del '+f.nom,'Vagina fibrosa digitorum '+f.num,
      {sis:'poleas',col:'POLEAS',reg:'Vaina fibrosa',dig:f.nom,color:PAL.ligamento,
       mo:{tex:null,r:0.72,side:MAT_DOBLE,transparent:true,opacity:0.30,depthWrite:false},
       meta:{origen:'—',insercion:'—',inervacion:'—',
        accion:'Túnica fibrosa continua que contiene las poleas; fija los tendones al esqueleto.',
        articulaciones:'Desde el cuello del metacarpiano hasta la base de la falange distal.'}});
    [0,1].forEach(i=>{
      const sg=D.fr[i],centro=sg.a.clone().lerp(sg.b,0.5);
      vf.geo.push(bandaAxial(centro,sg.ax,sg.sd,sg.vl,sg.r+PULL_OFF+0.008,sg.len*0.9,2.4,false));
    });
    const vs=mk('vaina_sinovial_'+f.k,'Vaina sinovial del '+f.nom,'Vagina synovialis '+f.num,
      {sis:'poleas',col:'POLEAS',reg:'Vaina sinovial',dig:f.nom,color:PAL.sinovial,
       mo:{tex:null,r:0.35,side:MAT_DOBLE,transparent:true,opacity:0.5,depthWrite:false},
       meta:{origen:'—',insercion:'—',inervacion:'—',
        accion:'Espacio seroso que lubrica el deslizamiento del tendón dentro de la vaina fibrosa.',
        articulaciones:'Fondo de saco proximal en el cuello del metacarpiano y distal en la base de la falange distal.'}});
    [0,1].forEach(i=>{
      const sg=D.fr[i],centro=sg.a.clone().lerp(sg.b,0.5);
      vs.geo.push(bandaAxial(centro,sg.ax,sg.sd,sg.vl,sg.r+PULL_OFF-0.022,sg.len*0.84,3.3,false));
    });
    const sag=mk('ligamento_sagital_'+f.k,'Ligamento sagital del '+f.nom,'Ligamenta sagittalia '+f.num,
      {sis:'poleas',col:'LIGAMENTOS',reg:'Mecanismo extensor',dig:f.nom,color:PAL.ligamento,mo:{tex:null,r:0.7,side:MAT_DOBLE},
       meta:{origen:'—',insercion:'—',inervacion:'—',
        accion:'Estabiliza el tendón extensor sobre la cabeza del metacarpiano y lo mantiene centrado en la MCF.',
        articulaciones:'Desde las bandas lateral y medial hasta la placa palmar de la MCF.'}});
    const sg0=D.fr[0];
    sag.geo.push(bandaAxial(f.mcp.clone().addScaledVector(sg0.ax,0.02),sg0.ax,sg0.sd,sg0.vl,R_MC[1]+0.030,0.075,2.8,true));
  });
  {
    const D=DIG.pulgar;
    [{id:'A1',t:0.06,w:0.085},{id:'A2',t:0.55,w:0.19}].forEach(p=>{
      const sg=D.fr[0],centro=sg.a.clone().lerp(sg.b,p.t);
      const s=mk('polea_'+p.id+'_pulgar','Polea '+p.id+' del pulgar','Pars anularis '+p.id.slice(1)+' I',
        {sis:'poleas',col:'POLEAS',reg:'Vaina fibrosa',dig:'pulgar',color:PAL.polea,mo:{tex:null,r:0.62,side:MAT_DOBLE},
         meta:{origen:'—',insercion:'—',inervacion:'—',
          accion:'Retiene el tendón del flexor largo del pulgar contra la falange.',
          articulaciones:'Zona III de la vaina fibrosa del pulgar.'}});
      s.geo.push(bandaAxial(centro,sg.ax,sg.sd,sg.vl,sg.r+PULL_OFF,p.w,3.3,false));
    });
    const sgp=D.fr[0],centro=sgp.a.clone().lerp(sgp.b,0.62);
    const obl=mk('polea_oblicua_pulgar','Polea oblicua del pulgar','Pars obliqua I',
      {sis:'poleas',col:'POLEAS',reg:'Vaina fibrosa',dig:'pulgar',color:PAL.polea,mo:{tex:null,r:0.62,side:MAT_DOBLE},
       meta:{origen:'—',insercion:'—',inervacion:'—',
        accion:'Sustituye funcionalmente a la polea A2 en el pulgar y evita el arqueamiento del FPL.',
        articulaciones:'Zona II de la vaina fibrosa del pulgar.'}});
    obl.geo.push(bandaAxial(centro,sgp.ax,sgp.sd,sgp.vl,sgp.r+PULL_OFF-0.004,0.085,2.7,false));
  }

  /* ---------- tendones flexores ---------- */
  FING.forEach(f=>{
    const D=DIG[f.k],j=D.j,fr=D.fr;
    const oFDP=(i)=>fr[i].r+TEND_OFF;
    const fdp=mk('tendon_flexor_profundo_'+f.k,'Tendón del flexor profundo para el '+f.nom,'Tendo musculi flexoris digitorum profundi, '+f.num,
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Canal carpiano y dedos',dig:f.nom,color:PAL.tendonProf,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del FDP en el antebrazo distal.',
        insercion:'Base de la falange distal del '+f.nom+'.',
        accion:'Flexión de la IFD del '+f.nom+'; transmite la flexión a la IFP y la MCF.',
        inervacion:(f.k==='indice'||f.k==='medio')?'Nervio mediano (fascículos del FDP).':'Nervio ulnar (fascículos del FDP).'}});
    const mcf=j[0].clone().addScaledVector(fr[0].vl,oFDP(0));
    const ppMid=fr[0].a.clone().lerp(fr[0].b,0.55).addScaledVector(fr[0].vl,oFDP(0));
    const pipV=j[1].clone().addScaledVector(fr[1].vl,oFDP(1));
    const mpMid=fr[1].a.clone().lerp(fr[1].b,0.5).addScaledVector(fr[1].vl,oFDP(1));
    const insFDP=fr[1].b.clone().addScaledVector(fr[1].ax,0.045).addScaledVector(fr[1].vl,oFDP(2));
    fdp.geo.push(tubeGeo([V3(f.xi,1.6,0.26),V3(f.xi,0.55,0.28),V3(f.mcp.x*0.85,-1.05,0.29),mcf,ppMid,pipV,mpMid,insFDP],
      t=>0.026-0.005*t,{tub:64,rad:10}));
    fdp.geo.push(sph(0.026,insFDP,8,6));

    const fds=mk('tendon_flexor_superficial_'+f.k,'Tendón del flexor superficial para el '+f.nom,'Tendo musculi flexoris digitorum superficialis, '+f.num,
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Canal carpiano y dedos',dig:f.nom,color:PAL.tendon,mo:{tex:TEX.mus,r:0.48,bump:0.006},
       meta:{origen:'Continuación tendinosa del FDS en el antebrazo distal.',
        insercion:'Base de la falange media del '+f.nom+', por dos bandeletas que perforan el tendón del FDP (quiasma).',
        accion:'Flexión de la IFP del '+f.nom+'.',inervacion:'Nervio mediano.'}});
    const oSDS=(i)=>fr[i].r+TEND_OFF+0.021;
    const mcfS=j[0].clone().addScaledVector(fr[0].vl,oSDS(0));
    const ppMidS=fr[0].a.clone().lerp(fr[0].b,0.58).addScaledVector(fr[0].vl,oSDS(0));
    const prePIP=fr[1].a.clone().addScaledVector(fr[1].vl,oSDS(1)).addScaledVector(fr[1].ax,-0.040);
    const cruce=fr[1].a.clone().addScaledVector(fr[1].vl,fr[1].r+TEND_OFF).addScaledVector(fr[1].ax,0.030);
    const insFDS=fr[1].a.clone().addScaledVector(fr[1].ax,0.070).addScaledVector(fr[1].vl,fr[1].r+TEND_OFF);
    fds.geo.push(tubeGeo([V3(f.xi,1.65,0.31),V3(f.xi,0.55,0.33),V3(f.mcp.x*0.85,-1.08,0.335),mcfS,ppMidS,prePIP],
      t=>0.028-0.004*t,{tub:56,rad:10}));
    [1,-1].forEach(sgn=>{
      const desvio=cruce.clone().addScaledVector(fr[1].sd,sgn*0.052).addScaledVector(fr[1].ax,0.012);
      fds.geo.push(tubeGeo([prePIP,prePIP.clone().lerp(desvio,0.55),desvio,insFDS],t=>0.018-0.003*t,{tub:26,rad:8}));
    });
    fds.geo.push(sph(0.021,insFDS,8,6));
  });
  {
    const D=DIG.pulgar,j=D.j,fr=D.fr;
    const fpl=mk('tendon_flexor_largo_pulgar','Tendón del flexor largo del pulgar','Tendo musculi flexoris pollicis longi',
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Canal carpiano y pulgar',dig:'pulgar',color:PAL.tendonProf,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del FPL en el antebrazo distal.',
        insercion:'Base de la falange distal del pulgar.',accion:'Flexión de la IF y de la MCF del pulgar.',
        inervacion:'Nervio mediano (interóseo anterior).'}});
    const o0=fr[0].r+TEND_OFF,o1=fr[1].r+TEND_OFF;
    const mcf=j[0].clone().addScaledVector(fr[0].vl,o0);
    const mid=fr[0].a.clone().lerp(fr[0].b,0.55).addScaledVector(fr[0].vl,o0);
    const ipv=j[1].clone().addScaledVector(fr[1].vl,o1);
    const ins=fr[1].b.clone().addScaledVector(fr[1].ax,0.04).addScaledVector(fr[1].vl,o1);
    fpl.geo.push(tubeGeo([V3(0.34,1.75,0.24),V3(0.40,0.9,0.28),V3(0.48,0.35,0.32),V3(0.70,-0.42,0.33),mcf,mid,ipv,ins],
      t=>0.029-0.006*t,{tub:56,rad:10}));
    fpl.geo.push(sph(0.026,ins,8,6));
  }
  {
    const fcr=mk('tendon_flexor_radial_carpo','Tendón del flexor radial del carpo','Tendo musculi flexoris carpi radialis',
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Muñeca',color:PAL.tendon,mo:{tex:TEX.mus,r:0.48,bump:0.006},
       meta:{origen:'Continuación tendinosa del FCR en el antebrazo distal.',insercion:'Base del segundo metacarpiano.',
        accion:'Flexión y abducción radial de la muñeca.',inervacion:'Nervio mediano.'}});
    fcr.geo.push(tubeGeo([V3(0.27,2.4,0.20),V3(0.29,1.5,0.23),V3(0.31,0.85,0.25),V3(0.34,0.28,0.24),V3(0.38,-0.20,0.15)],
      t=>0.035-0.008*t,{tub:44,rad:10}));
    const fcu=mk('tendon_flexor_ulnar_carpo','Tendón del flexor ulnar del carpo','Tendo musculi flexoris carpi ulnaris',
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Muñeca',color:PAL.tendon,mo:{tex:TEX.mus,r:0.48,bump:0.006},
       meta:{origen:'Continuación tendinosa del FCU en el antebrazo distal.',insercion:'Pisiforme, gancho del ganchoso y base del quinto metacarpiano.',
        accion:'Flexión y aducción ulnar de la muñeca.',inervacion:'Nervio ulnar.'}});
    fcu.geo.push(tubeGeo([V3(-0.35,2.5,0.14),V3(-0.39,1.6,0.17),V3(-0.44,0.95,0.19),V3(-0.56,0.52,0.22)],
      t=>0.038-0.010*t,{tub:40,rad:10}));
    const pl=mk('tendon_palmar_largo','Tendón del palmar largo','Tendo musculi palmaris longi',
      {sis:'flexor',col:'TENDONES_FLEXORES',reg:'Muñeca',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del palmar largo.',insercion:'Aponeurosis palmar.',accion:'Tensa la aponeurosis palmar.',
        inervacion:'Nervio mediano.',variacion:'Ausente en torno al 15 % de la población.'}});
    pl.geo.push(tubeGeo([V3(0.11,2.6,0.28),V3(0.12,1.7,0.30),V3(0.12,1.0,0.31),V3(0.11,0.55,0.31),V3(0.09,0.20,0.30)],
      t=>0.023-0.005*t,{tub:36,rad:9}));
  }

  /* ---------- mecanismo extensor ---------- */
  FING.forEach(f=>{
    const D=DIG[f.k],j=D.j,fr=D.fr;
    const xd={indice:0.32,medio:0.09,anular:-0.16,menique:-0.40}[f.k];
    const ed=mk('tendon_extensor_dedos_'+f.k,'Tendón del extensor de los dedos para el '+f.nom,'Tendo musculi extensoris digitorum, '+f.num,
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso de la mano',dig:f.nom,color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del extensor de los dedos en el antebrazo distal.',
        insercion:'Expansión extensora del '+f.nom+'.',accion:'Extensión de la MCF del '+f.nom+'.',
        inervacion:'Nervio interóseo posterior.'}});
    const mcfD=j[0].clone().addScaledVector(fr[0].dorsal,R_MC[1]+0.024);
    ed.geo.push(tubeGeo([V3(xd,1.9,-0.24),V3(xd*0.92,1.0,-0.27),V3(f.mcp.x*0.92,-1.10,-0.24),mcfD],
      t=>0.026-0.005*t,{tub:48,rad:10}));
    const expO=fr[0].a.clone().addScaledVector(fr[0].ax,0.13).addScaledVector(fr[0].dorsal,fr[0].r+0.020);
    const ex=mk('expansion_extensora_'+f.k,'Expansión extensora del '+f.nom,'Aponeurosis dorsalis '+f.num,
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del dedo',dig:f.nom,color:PAL.tendon,
       mo:{tex:TEX.mus,r:0.55,side:MAT_DOBLE,bump:0.005},
       meta:{origen:'Recibe las fibras del extensor de los dedos y de los músculos intrínsecos.',
        insercion:'Se continúa con la banda central y las bandas laterales.',
        accion:'Acopla la extensión de la MCF con la de las IFP e IFD; transmite la acción de los lumbricales e interóseos.',
        inervacion:'— (aponeurosis; la inervan las ramas motoras de los músculos que la forman).'}});
    ex.geo.push(colocarFan(fanGeo(fr[0].len*0.60,0.070,0.128,0.009),expO,fr[0].ax,fr[0].sd,fr[0].dorsal));
    const bc=mk('banda_central_'+f.k,'Banda central del '+f.nom,'Tendo centralis '+f.num,
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del dedo',dig:f.nom,color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.005},
       meta:{origen:'Porción media de la expansión extensora.',insercion:'Base de la falange media del '+f.nom+'.',
        accion:'Extiende la IFP.',inervacion:'—'}});
    const c0=fr[0].a.clone().lerp(fr[0].b,0.80).addScaledVector(fr[0].dorsal,fr[0].r+0.014);
    const c1=fr[1].a.clone().addScaledVector(fr[1].dorsal,fr[1].r+0.012).addScaledVector(fr[1].ax,0.045);
    bc.geo.push(tubeGeo([c0,fr[1].a.clone().addScaledVector(fr[1].dorsal,fr[1].r+0.016),c1],t=>0.017,{tub:20,rad:8}));
    const bl=mk('bandas_laterales_'+f.k,'Bandas laterales del '+f.nom,'Tendines laterales '+f.num,
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del dedo',dig:f.nom,color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.005},
       meta:{origen:'Bordes laterales de la expansión extensora, reforzados por lumbricales e interóseos.',
        insercion:'Se unen sobre la falange media y forman el tendón terminal en la base de la falange distal.',
        accion:'Extienden la IFD; con la banda central, coordinan la extensión de las IFP.',inervacion:'—'}});
    [1,-1].forEach(sgn=>{
      const a0=fr[0].a.clone().lerp(fr[0].b,0.72).addScaledVector(fr[0].dorsal,fr[0].r+0.018).addScaledVector(fr[0].sd,sgn*0.058);
      const a1=fr[1].a.clone().addScaledVector(fr[1].dorsal,fr[1].r+0.014).addScaledVector(fr[1].sd,sgn*0.044);
      const a2=fr[2].a.clone().addScaledVector(fr[2].dorsal,fr[2].r+0.012).addScaledVector(fr[2].sd,sgn*0.024);
      bl.geo.push(tubeGeo([a0,a1,a2],t=>0.014,{tub:22,rad:8}));
    });
    const tt=mk('tendon_terminal_extensor_'+f.k,'Tendón extensor terminal del '+f.nom,'Tendo terminalis '+f.num,
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del dedo',dig:f.nom,color:PAL.tendonProf,mo:{tex:TEX.mus,r:0.5,bump:0.005},
       meta:{origen:'Confluencia de las dos bandas laterales.',insercion:'Base de la falange distal del '+f.nom+'.',
        accion:'Extensión de la IFD.',inervacion:'—'}});
    tt.geo.push(tubeGeo([fr[2].a.clone().addScaledVector(fr[2].dorsal,fr[2].r+0.012),
      fr[2].b.clone().addScaledVector(fr[2].dorsal,fr[2].r+0.010)],t=>0.016-0.003*t,{tub:16,rad:8}));
  });
  {
    const ei=mk('tendon_extensor_indice','Tendón del extensor del índice','Tendo musculi extensoris indicis',
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso de la mano',dig:'indice',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del extensor del índice.',insercion:'Expansión extensora del índice, lado ulnar.',
        accion:'Extensión del índice con la MCF flexionada.',inervacion:'Nervio interóseo posterior.'}});
    ei.geo.push(tubeGeo([V3(-0.34,1.9,-0.26),V3(-0.10,1.0,-0.28),V3(0.40,-1.10,-0.24),V3(0.58,-1.46,-0.10)],t=>0.021,{tub:40,rad:9}));
    const edm=mk('tendon_extensor_menique','Tendón del extensor del meñique','Tendo musculi extensoris digiti minimi',
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso de la mano',dig:'menique',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del extensor del meñique.',insercion:'Expansión extensora del meñique.',
        accion:'Extensión de la MCF del meñique.',inervacion:'Nervio interóseo posterior.'}});
    edm.geo.push(tubeGeo([V3(-0.44,1.9,-0.27),V3(-0.56,1.0,-0.27),V3(-0.74,-0.98,-0.22),V3(-0.80,-1.36,-0.08)],t=>0.021,{tub:40,rad:9}));
  }
  {
    const D=DIG.pulgar,j=D.j,fr=D.fr;
    const epl=mk('tendon_extensor_largo_pulgar','Tendón del extensor largo del pulgar','Tendo musculi extensoris pollicis longi',
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del pulgar',dig:'pulgar',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del EPL tras el tercer compartimento extensor.',
        insercion:'Base de la falange distal del pulgar.',accion:'Extensión de la IF y de la MCF del pulgar.',
        inervacion:'Nervio interóseo posterior.'}});
    epl.geo.push(tubeGeo([V3(-0.10,2.1,-0.22),V3(0.20,1.4,-0.24),V3(0.56,0.70,-0.16),V3(0.82,0.06,-0.02),
      j[0].clone().addScaledVector(fr[0].dorsal,fr[0].r+0.024),fr[1].a.clone().addScaledVector(fr[1].dorsal,fr[1].r+0.020),
      fr[1].b.clone().addScaledVector(fr[1].dorsal,fr[1].r+0.018)],t=>0.025-0.004*t,{tub:56,rad:10}));
    const epb=mk('tendon_extensor_corto_pulgar','Tendón del extensor corto del pulgar','Tendo musculi extensoris pollicis brevis',
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Dorso del pulgar',dig:'pulgar',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del EPB.',insercion:'Base de la falange proximal del pulgar.',
        accion:'Extensión de la MCF del pulgar.',inervacion:'Nervio interóseo posterior.'}});
    epb.geo.push(tubeGeo([V3(0.06,2.1,-0.24),V3(0.36,1.4,-0.24),V3(0.68,0.70,-0.12),V3(0.94,0.06,0.04),
      j[0].clone().addScaledVector(fr[0].dorsal,fr[0].r+0.022)],t=>0.021,{tub:44,rad:9}));
    const apl=mk('tendon_abductor_largo_pulgar','Tendón del abductor largo del pulgar','Tendo musculi abductoris pollicis longi',
      {sis:'extensor',col:'TENDONES_EXTENSORES',reg:'Primer compartimento extensor',dig:'pulgar',color:PAL.tendon,mo:{tex:TEX.mus,r:0.5,bump:0.006},
       meta:{origen:'Continuación tendinosa del APL.',insercion:'Base del primer metacarpiano y trapecio.',
        accion:'Abducción y extensión del primer metacarpiano.',inervacion:'Nervio interóseo posterior.'}});
    apl.geo.push(tubeGeo([V3(-0.14,2.2,-0.20),V3(0.24,1.5,-0.14),V3(0.58,0.55,0.08),V3(0.66,0.06,0.16),
      THUMB.cmc.clone().add(V3(0.04,-0.12,0.13))],t=>0.023,{tub:40,rad:9}));
  }

  /* ---------- vientres musculares extrínsecos ---------- */
  const BELLY=[
    {id:'fds',m:MM.fds,color:PAL.musculo,p0:V3(-0.10,2.95,0.22),p1:V3(-0.05,1.42,0.30),r:0.27},
    {id:'fdp',m:MM.fdp,color:PAL.musculoProf,p0:V3(-0.28,3.0,0.08),p1:V3(-0.20,1.40,0.19),r:0.28},
    {id:'fpl',m:MM.fpl,color:PAL.musculoAlt,p0:V3(0.38,2.95,0.14),p1:V3(0.36,1.46,0.22),r:0.18},
    {id:'fcr',m:MM.fcr,color:PAL.musculoTen,p0:V3(0.29,3.05,0.20),p1:V3(0.27,2.02,0.18),r:0.12},
    {id:'fcu',m:MM.fcu,color:PAL.musculo,p0:V3(-0.40,3.05,0.08),p1:V3(-0.35,2.10,0.13),r:0.14},
    {id:'pl',m:MM.pl,color:PAL.musculoAlt,p0:V3(0.12,2.90,0.29),p1:V3(0.11,2.30,0.28),r:0.078},
    {id:'ed',m:MM.ed,color:PAL.musculoAlt,p0:V3(0.05,3.0,-0.22),p1:V3(0.02,1.58,-0.25),r:0.26},
    {id:'ei',m:MM.ei,color:PAL.musculoTen,p0:V3(-0.28,2.85,-0.22),p1:V3(-0.33,1.85,-0.27),r:0.105},
    {id:'edm',m:MM.edm,color:PAL.musculo,p0:V3(-0.42,2.85,-0.20),p1:V3(-0.43,1.90,-0.26),r:0.092},
    {id:'epl',m:MM.epl,color:PAL.musculoProf,p0:V3(-0.09,2.70,-0.20),p1:V3(-0.08,2.05,-0.22),r:0.098},
    {id:'epb',m:MM.epb,color:PAL.musculoAlt,p0:V3(0.15,2.72,-0.21),p1:V3(0.11,2.02,-0.23),r:0.088},
    {id:'apl',m:MM.apl,color:PAL.musculoTen,p0:V3(-0.10,2.90,-0.17),p1:V3(0.02,1.98,-0.16),r:0.108},
    {id:'ecrl',m:MM.ecrl,color:PAL.musculo,p0:V3(0.32,3.05,-0.16),p1:V3(0.30,2.05,-0.18),r:0.115},
    {id:'ecrb',m:MM.ecrb,color:PAL.musculoAlt,p0:V3(0.22,3.02,-0.18),p1:V3(0.22,1.95,-0.20),r:0.12},
    {id:'ecu',m:MM.ecu,color:PAL.musculoProf,p0:V3(-0.44,3.02,-0.14),p1:V3(-0.42,1.90,-0.18),r:0.105}
  ];
  BELLY.forEach(b=>{
    const s=mk('musculo_'+b.id,b.m.nombre,b.m.latin,
      {sis:'flexor',col:'MUSCULOS_EXTRINSECOS',reg:'Antebrazo distal',abbr:b.m.abbr,color:b.color,
       mo:{tex:TEX.mus,r:0.86,bump:0.035},meta:b.m.meta});
    s.geo.push(vientre(b.p0,b.p1,b.r,b.m.abbr==='ED'?0.62:0.78,{tub:34}));
    if(b.id==='fds'||b.id==='fdp'||b.id==='ed'){
      for(let i=0;i<3;i++){
        const off=(i-1)*b.r*0.5;
        s.geo.push(vientre(b.p0.clone().add(V3(off,0,0.02)),b.p1.clone().add(V3(off*1.3,0,0.02)),b.r*0.32,0.7,{tub:20}));
      }
    }
  });
  STR.filter(s=>s.col==='MUSCULOS_EXTRINSECOS').forEach(s=>{
    if(['ed','ei','edm','epl','epb','apl','ecrl','ecrb','ecu'].some(k=>s.id==='musculo_'+k))s.sis='extensor';
  });

  /* ---------- músculos intrínsecos ---------- */
  const INT=[
    {id:'abductor_corto_pulgar',m:MM.apb,cc:PAL.musculo,p0:V3(0.56,-0.26,0.22),p1:V3(0.86,-0.76,0.28),r:0.092},
    {id:'flexor_corto_pulgar',m:MM.fpb,cc:PAL.musculoAlt,p0:V3(0.55,-0.32,0.26),p1:V3(0.88,-0.82,0.36),r:0.088},
    {id:'oponente_pulgar',m:MM.op,cc:PAL.musculoProf,p0:V3(0.48,-0.24,0.18),p1:V3(0.74,-0.74,0.18),r:0.075},
    {id:'aductor_pulgar_oblicuo',m:MM.adpo,cc:PAL.musculoTen,p0:V3(0.14,-0.92,0.14),p1:V3(0.84,-0.90,0.26),r:0.066},
    {id:'aductor_pulgar_transverso',m:MM.adpt,cc:PAL.musculo,p0:V3(0.18,-1.12,0.10),p1:V3(0.82,-0.98,0.26),r:0.062},
    {id:'abductor_menique',m:MM.adm,cc:PAL.musculoAlt,p0:V3(-0.58,-0.28,0.21),p1:V3(-0.84,-0.76,0.23),r:0.078},
    {id:'flexor_corto_menique',m:MM.fdmb,cc:PAL.musculo,p0:V3(-0.53,-0.30,0.26),p1:V3(-0.76,-0.72,0.27),r:0.068},
    {id:'oponente_menique',m:MM.odm,cc:PAL.musculoProf,p0:V3(-0.45,-0.26,0.17),p1:V3(-0.68,-0.64,0.19),r:0.062},
    {id:'palmar_corto',m:MM.pb,cc:PAL.musculoTen,p0:V3(-0.58,-0.10,0.30),p1:V3(-0.80,-0.52,0.26),r:0.046}
  ];
  INT.forEach(b=>{
    const s=mk('musculo_'+b.id,b.m.nombre,b.m.latin,
      {sis:'intrinseco',col:'MUSCULOS_INTRINSECOS',reg:'Palma',abbr:b.m.abbr,color:b.cc,
       mo:{tex:TEX.mus,r:0.88,bump:0.03},meta:b.m.meta});
    s.geo.push(vientre(b.p0,b.p1,b.r,0.55,{tub:26}));
  });
  const LUM=[
    {n:1,p0:V3(0.28,-1.02,0.26),p1:V3(0.58,-1.48,0.02),inn:'Nervio mediano.',ori:'Tendón del FDS del índice (unipeniforme).',ins:'Banda lateral radial de la expansión extensora del índice.'},
    {n:2,p0:V3(0.08,-1.06,0.26),p1:V3(0.18,-1.58,0.02),inn:'Nervio mediano.',ori:'Tendón del FDS del medio (unipeniforme).',ins:'Banda lateral radial de la expansión extensora del medio.'},
    {n:3,p0:V3(-0.10,-1.06,0.26),p1:V3(0.00,-1.54,0.02),inn:'Nervio ulnar.',ori:'Tendones del FDP contiguos del medio y el anular (bipeniforme).',ins:'Banda lateral radial de la expansión extensora del anular.'},
    {n:4,p0:V3(-0.28,-1.02,0.26),p1:V3(-0.42,-1.42,0.02),inn:'Nervio ulnar.',ori:'Tendones del FDP contiguos del anular y el meñique (bipeniforme).',ins:'Banda lateral radial de la expansión extensora del meñique.'}
  ];
  LUM.forEach(l=>{
    const s=mk('musculo_lumbrical_'+l.n,'Lumbrical '+l.n,'Musculus lumbricalis '+l.n,
      {sis:'intrinseco',col:'MUSCULOS_INTRINSECOS',reg:'Palma',dig:['','índice','medio','anular','meñique'][l.n],color:PAL.musculo,
       mo:{tex:TEX.mus,r:0.86,bump:0.03},
       meta:{origen:l.ori,insercion:l.ins,accion:'Flexión de la MCF y extensión simultánea de la IFP e IFD del dedo correspondiente.',inervacion:l.inn}});
    s.geo.push(vientre(l.p0,l.p1,0.038,0.6,{tub:20}));
  });
  [{k:1,a:V3(0.44,-1.16,0.02),b:V3(0.58,-1.48,0.02),d:'índice',acc:'Aducción del índice hacia el dedo medio.'},
   {k:2,a:V3(-0.32,-1.14,0.02),b:V3(-0.32,-1.50,0.02),d:'anular',acc:'Aducción del anular hacia el dedo medio.'},
   {k:3,a:V3(-0.60,-1.04,0.02),b:V3(-0.78,-1.34,0.02),d:'meñique',acc:'Aducción del meñique hacia el anular.'}
  ].forEach(x=>{
    const s=mk('musculo_interoseo_palmar_'+x.k,'Interóseo palmar '+x.k,'Musculus interosseus palmaris '+x.k,
      {sis:'intrinseco',col:'MUSCULOS_INTRINSECOS',reg:'Metacarpo',dig:x.d,color:PAL.musculoAlt,mo:{tex:TEX.mus,r:0.86,bump:0.03},
       meta:{origen:'Cara del metacarpiano que mira al dedo medio.',insercion:'Base de la falange proximal del '+x.d+' y expansión extensora.',
        accion:x.acc,inervacion:'Nervio ulnar (ramo profundo).'}});
    s.geo.push(vientre(x.a,x.b,0.046,0.5,{tub:20}));
  });
  [{k:1,a:V3(0.76,-0.94,0.00),b:V3(0.60,-1.48,0.02),d:'índice',acc:'Abducción del índice y flexión de su MCF.'},
   {k:2,a:V3(0.28,-1.02,0.00),b:V3(0.14,-1.60,0.02),d:'medio',acc:'Abducción del medio hacia el índice.'},
   {k:3,a:V3(-0.14,-1.00,0.00),b:V3(-0.32,-1.52,0.02),d:'anular',acc:'Abducción del anular hacia el meñique.'},
   {k:4,a:V3(-0.50,-0.90,0.00),b:V3(-0.78,-1.36,0.02),d:'meñique',acc:'Abducción del meñique.'}
  ].forEach(x=>{
    const s=mk('musculo_interoseo_dorsal_'+x.k,'Interóseo dorsal '+x.k,'Musculus interosseus dorsalis '+x.k,
      {sis:'intrinseco',col:'MUSCULOS_INTRINSECOS',reg:'Metacarpo',dig:x.d,color:PAL.musculoTen,mo:{tex:TEX.mus,r:0.86,bump:0.03},
       meta:{origen:'Caras enfrentadas de dos metacarpianos contiguos.',insercion:'Base de la falange proximal del '+x.d+' y expansión extensora.',
        accion:x.acc,inervacion:'Nervio ulnar (ramo profundo).'}});
    s.geo.push(vientre(x.a,x.b,0.048,0.52,{tub:20}));
  });

  /* ---------- nervios ---------- */
  {
    const med=mk('nervio_mediano','Nervio mediano','Nervus medianus',
      {sis:'nervioso',col:'NERVIOS',reg:'Antebrazo, canal carpiano y palma',abbr:'NM',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Fascículos medial y lateral del plexo braquial (C6–T1).',
        insercion:'Termina en la palma dividiéndose en ramo recurrente, nervios digitales palmares comunes y ramo comunicante con el ulnar.',
        accion:'Motor: abductor corto, flexor corto superficial y oponente del pulgar, 1.º y 2.º lumbricales. Sensitivo: cara palmar del pulgar, índice, medio y mitad radial del anular.',
        inervacion:'Nervio mediano.'}});
    med.geo.push(tubeGeo([V3(0.09,3.1,0.12),V3(0.11,2.2,0.16),V3(0.09,1.35,0.21),V3(0.05,0.70,0.29),V3(0.01,0.36,0.36),V3(0.01,0.10,0.36)],
      t=>0.036-0.007*t,{tub:52,rad:10}));
    const rec=mk('rama_recurrente_nervio_mediano','Ramo recurrente del nervio mediano','Ramus recurrens nervi mediani',
      {sis:'nervioso',col:'NERVIOS',reg:'Eminencia tenar',abbr:'NM-r',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Rama del nervio mediano en el borde distal del retináculo flexor.',
        insercion:'Cara profunda de los músculos tenares.',accion:'Motor para abductor corto, flexor corto superficial y oponente del pulgar.',
        inervacion:'Nervio mediano.'}});
    rec.geo.push(tubeGeo([V3(0.01,0.12,0.34),V3(0.20,-0.02,0.32),V3(0.38,-0.16,0.28),V3(0.52,-0.32,0.22)],t=>0.026,{tub:28,rad:9}));
    const uln=mk('nervio_ulnar','Nervio ulnar','Nervus ulnaris',
      {sis:'nervioso',col:'NERVIOS',reg:'Antebrazo, canal de Guyon y palma',abbr:'NU',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Fascículo medial del plexo braquial (C8–T1).',
        insercion:'Se divide en el canal de Guyon en ramo superficial sensitivo y ramo profundo motor.',
        accion:'Motor: flexor ulnar del carpo, FDP de IV–V, hipotenares, interóseos, 3.º y 4.º lumbricales y aductor del pulgar. Sensitivo: meñique y mitad ulnar del anular.',
        inervacion:'Nervio ulnar.'}});
    uln.geo.push(tubeGeo([V3(-0.29,3.1,0.09),V3(-0.35,2.2,0.12),V3(-0.41,1.35,0.16),V3(-0.49,0.74,0.20),V3(-0.57,0.44,0.24)],
      t=>0.035-0.006*t,{tub:48,rad:10}));
    const prof=mk('rama_profunda_nervio_ulnar','Ramo profundo del nervio ulnar','Ramus profundus nervi ulnaris',
      {sis:'nervioso',col:'NERVIOS',reg:'Palma profunda',abbr:'NU-p',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Rama terminal motora del nervio ulnar en el canal de Guyon.',
        insercion:'Atraviesa el hiatus de los oponentes y se distribuye por la celda palmar profunda.',
        accion:'Motor para interóseos, 3.º y 4.º lumbricales, aductor del pulgar e hipotenares.',inervacion:'Nervio ulnar.'}});
    prof.geo.push(tubeGeo([V3(-0.57,0.42,0.22),V3(-0.44,0.16,0.13),V3(-0.18,-0.18,0.09),V3(0.14,-0.48,0.09),V3(0.42,-0.78,0.12)],
      t=>0.024-0.004*t,{tub:36,rad:9}));
    const rsup=mk('nervio_radial_superficial','Ramo superficial del nervio radial','Ramus superficialis nervi radialis',
      {sis:'nervioso',col:'NERVIOS',reg:'Dorso radial de la mano',abbr:'NR-s',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Rama terminal sensitiva del nervio radial tras el borde inferior del braquiorradial.',
        insercion:'Nervios digitales dorsales del pulgar, índice y medio.',
        accion:'Sensibilidad del dorso radial de la mano y de los dedos hasta la IFP; sin función motora en la mano.',
        inervacion:'Nervio radial.'}});
    rsup.geo.push(tubeGeo([V3(0.25,2.4,-0.14),V3(0.37,1.6,-0.18),V3(0.50,1.0,-0.20),V3(0.64,0.40,-0.20)],t=>0.026-0.006*t,{tub:36,rad:9}));
    [V3(0.70,-0.26,-0.18),V3(0.54,-0.62,-0.20),V3(0.10,-0.56,-0.22)].forEach(d=>{
      rsup.geo.push(tubeGeo([V3(0.64,0.40,-0.20),V3(0.68,0.02,-0.20),d],t=>0.017,{tub:22,rad:8}));
    });
    FING.forEach(f=>{
      const x0={indice:0.20,medio:0.05,anular:-0.10,menique:-0.24}[f.k];
      ['radial','ulnar'].forEach((lado,li)=>{
        const sgn=li===0?1:-1;
        const s=mk('nervio_digital_propio_'+f.k+'_'+lado,'Nervio digital palmar propio '+lado+' del '+f.nom,'Nervus digitalis palmaris proprius '+f.num,
          {sis:'nervioso',col:'NERVIOS',reg:'Dedos',dig:f.nom,color:PAL.nervio,mo:{tex:null,r:0.42},
           meta:{origen:'Nervio digital palmar común en la palma.',
            insercion:'Cara palmar del '+f.nom+', lado '+lado+', hasta la falange distal.',
            accion:'Sensibilidad de la cara palmar del '+f.nom+' en el territorio '+((f.k==='menique')?'del nervio ulnar':'del nervio mediano')+'.',
            inervacion:f.k==='menique'?'Nervio ulnar.':(lado==='ulnar'&&f.k==='anular'?'Nervio ulnar.':'Nervio mediano.')}});
        s.geo.push(tubeGeo([V3(x0,-0.42,0.24),V3(f.mcp.x+sgn*0.085,-1.02,0.22),V3(f.mcp.x+sgn*0.062,-1.44,0.14),
          f.mcp.clone().add(V3(sgn*0.075,0.02,0.08)),f.mcp.clone().add(V3(sgn*0.070,-0.38,0.08))],t=>0.018-0.003*t,{tub:34,rad:8}));
      });
    });
    const dp=mk('nervio_digital_pulgar','Nervio digital del pulgar','Nervi digitales palmares pollicis',
      {sis:'nervioso',col:'NERVIOS',reg:'Pulgar',dig:'pulgar',color:PAL.nervio,mo:{tex:null,r:0.42},
       meta:{origen:'Nervio digital palmar común del pulgar, rama del mediano.',insercion:'Caras palmar y lateral del pulgar.',
        accion:'Sensibilidad del pulgar.',inervacion:'Nervio mediano.'}});
    dp.geo.push(tubeGeo([V3(0.22,-0.28,0.26),V3(0.48,-0.62,0.30),V3(0.78,-0.94,0.34),V3(1.02,-1.28,0.42)],t=>0.020,{tub:28,rad:8}));
  }

  /* ---------- vasos ---------- */
  {
    const rad=mk('arteria_radial','Arteria radial','Arteria radialis',
      {sis:'vascular',col:'VASOS',reg:'Antebrazo y dorso radial',color:PAL.arteria,mo:{tex:null,r:0.4},
       meta:{origen:'Bifurcación de la arteria braquial en el pliegue del codo.',insercion:'Se anastomosa con el arco palmar profundo.',
        accion:'Riega el compartimento radial del antebrazo y participa en la vascularización de la mano.',inervacion:'—'}});
    rad.geo.push(tubeGeo([V3(0.23,3.2,0.08),V3(0.29,2.2,0.12),V3(0.35,1.4,0.14),V3(0.40,0.80,0.12),V3(0.38,0.30,0.15)],
      t=>0.026-0.004*t,{tub:40,rad:9}));
    const uln=mk('arteria_ulnar','Arteria ulnar','Arteria ulnaris',
      {sis:'vascular',col:'VASOS',reg:'Antebrazo y palma ulnar',color:PAL.arteria,mo:{tex:null,r:0.4},
       meta:{origen:'Bifurcación de la arteria braquial.',insercion:'Forma el arco palmar superficial tras pasar el canal de Guyon.',
        accion:'Riega el compartimento ulnar del antebrazo y la mayor parte de los dedos por el arco superficial.',inervacion:'—'}});
    uln.geo.push(tubeGeo([V3(-0.33,3.2,0.08),V3(-0.39,2.2,0.11),V3(-0.43,1.4,0.13),V3(-0.49,0.78,0.16),V3(-0.55,0.42,0.22)],
      t=>0.025-0.004*t,{tub:40,rad:9}));
    const arcoS=mk('arco_palmar_superficial','Arco palmar superficial','Arcus palmaris superficialis',
      {sis:'vascular',col:'VASOS',reg:'Palma',color:PAL.arteria,mo:{tex:null,r:0.4},
       meta:{origen:'Continuación de la arteria ulnar, completada por el ramo palmar profundo de la radial.',
        insercion:'Da las arterias digitales palmares comunes.',accion:'Principal aporte sanguíneo a los dedos.',inervacion:'—'}});
    arcoS.geo.push(tubeGeo([V3(-0.56,0.38,0.24),V3(-0.50,-0.14,0.24),V3(-0.18,-0.40,0.23),V3(0.18,-0.40,0.23),V3(0.48,-0.22,0.21)],
      t=>0.024-0.003*t,{tub:40,rad:9}));
    const arcoP=mk('arco_palmar_profundo','Arco palmar profundo','Arcus palmaris profundus',
      {sis:'vascular',col:'VASOS',reg:'Palma profunda',color:PAL.arteria,mo:{tex:null,r:0.4},
       meta:{origen:'Continuación de la arteria radial tras el primer espacio interóseo.',insercion:'Se anastomosa con el ramo profundo de la ulnar.',
        accion:'Riega la celda palmar profunda y las arterias metacarpianas palmares.',inervacion:'—'}});
    arcoP.geo.push(tubeGeo([V3(0.38,0.26,0.13),V3(0.22,-0.26,0.11),V3(-0.10,-0.36,0.10),V3(-0.42,-0.24,0.11)],t=>0.021,{tub:32,rad:8}));
    const pr=mk('arteria_princeps_pollicis','Arteria principal del pulgar','Arteria princeps pollicis',
      {sis:'vascular',col:'VASOS',reg:'Pulgar',dig:'pulgar',color:PAL.arteria,mo:{tex:null,r:0.4},
       meta:{origen:'Rama del arco palmar profundo.',insercion:'Caras palmar y lateral del pulgar.',accion:'Riega el pulgar.',inervacion:'—'}});
    pr.geo.push(tubeGeo([V3(0.38,0.22,0.15),V3(0.56,-0.10,0.22),V3(0.78,-0.48,0.30),V3(1.00,-0.86,0.40)],t=>0.020,{tub:28,rad:8}));
    FING.forEach(f=>{
      const x0={indice:0.28,medio:0.10,anular:-0.08,menique:-0.24}[f.k];
      const com=mk('arteria_digital_comun_'+f.k,'Arteria digital palmar común del '+f.nom,'Arteria digitalis palmaris communis '+f.num,
        {sis:'vascular',col:'VASOS',reg:'Palma',dig:f.nom,color:PAL.arteria,mo:{tex:null,r:0.4},
         meta:{origen:'Arco palmar superficial.',insercion:'Se divide en dos arterias digitales propias en la comisura del '+f.nom+'.',
          accion:'Riega la comisura y la primera falange del '+f.nom+'.',inervacion:'—'}});
      com.geo.push(tubeGeo([V3(x0,-0.38,0.24),V3(x0*0.62,-0.84,0.21),V3(f.mcp.x*0.92,-1.26,0.17)],t=>0.019,{tub:26,rad:8}));
      ['radial','ulnar'].forEach((lado,li)=>{
        const sgn=li===0?1:-1;
        const pro=mk('arteria_digital_propia_'+f.k+'_'+lado,'Arteria digital palmar propia '+lado+' del '+f.nom,'Arteria digitalis palmaris propria '+f.num,
          {sis:'vascular',col:'VASOS',reg:'Dedos',dig:f.nom,color:PAL.arteria,mo:{tex:null,r:0.4},
           meta:{origen:'Arteria digital palmar común.',insercion:'Cara palmar del '+f.nom+', lado '+lado+', hasta la falange distal.',
            accion:'Riega la falange y la pulpa del '+f.nom+'.',inervacion:'—'}});
        pro.geo.push(tubeGeo([V3(f.mcp.x*0.92,-1.28,0.17),V3(f.mcp.x+sgn*0.058,-1.50,0.13),
          f.mcp.clone().add(V3(sgn*0.070,0.02,0.08)),f.mcp.clone().add(V3(sgn*0.062,-0.40,0.08))],t=>0.015,{tub:26,rad:7}));
      });
    });
    const vena=mk('red_venosa_dorsal','Red venosa dorsal de la mano','Rete venosum dorsale manus',
      {sis:'vascular',col:'VASOS',reg:'Dorso de la mano',color:PAL.vena,mo:{tex:null,r:0.45},
       meta:{origen:'Arcos venosos superficiales del dorso.',insercion:'Venas cefálica y basílica.',
        accion:'Drena la sangre superficial del dorso de la mano.',inervacion:'—'}});
    vena.geo.push(tubeGeo([V3(0.48,-0.08,-0.15),V3(0.18,-0.46,-0.17),V3(-0.18,-0.48,-0.17),V3(-0.54,-0.12,-0.15)],t=>0.020-0.003*t,{tub:34,rad:8}));
    vena.geo.push(tubeGeo([V3(0.18,-0.46,-0.17),V3(0.22,-1.00,-0.13),V3(0.24,-1.40,-0.09)],t=>0.013,{tub:20,rad:7}));
    vena.geo.push(tubeGeo([V3(-0.18,-0.48,-0.17),V3(-0.28,-0.96,-0.13),V3(-0.38,-1.32,-0.07)],t=>0.013,{tub:20,rad:7}));
  }

  /* ---------- ligamentos y retináculos ---------- */
  {
    const ret=mk('retinaculo_flexor','Retináculo flexor','Retinaculum flexorum',
      {sis:'poleas',col:'LIGAMENTOS',reg:'Muñeca',color:PAL.ligamento,mo:{tex:null,r:0.66,side:MAT_DOBLE},
       meta:{origen:'Tubérculo del escafoides y trapecio (lateral) y pisiforme y gancho del ganchoso (medial).',
        insercion:'Forma el techo del túnel carpiano.',
        accion:'Convierte el canal carpiano en un conducto osteofibroso y mantiene los tendones flexores contra el carpo.',inervacion:'—'}});
    ret.geo.push(bandaAxial(V3(0.0,0.40,-0.80),V3(0,1,0),V3(1,0,0),V3(0,0,1),1.10,0.20,1.00,false));
    const retE=mk('retinaculo_extensor','Retináculo extensor','Retinaculum extensorum',
      {sis:'poleas',col:'LIGAMENTOS',reg:'Dorso de la muñeca',color:PAL.ligamento,mo:{tex:null,r:0.66,side:MAT_DOBLE},
       meta:{origen:'Borde anterior del radio distal y apófisis estiloides de la ulna.',
        insercion:'Se inserta en los tabiques de los seis compartimentos extensores.',
        accion:'Fija los tendones extensores y evita su desplazamiento en la extensión de la muñeca.',inervacion:'—'}});
    retE.geo.push(bandaAxial(V3(-0.02,0.42,0.80),V3(0,1,0),V3(-1,0,0),V3(0,0,-1),1.08,0.22,0.98,false));
    const apo=mk('aponeurosis_palmar','Aponeurosis palmar','Aponeurosis palmaris',
      {sis:'poleas',col:'LIGAMENTOS',reg:'Palma',color:PAL.ligamento,
       mo:{tex:TEX.mus,r:0.74,side:MAT_DOBLE,bump:0.006,transparent:true,opacity:0.20,depthWrite:false},
       meta:{origen:'Continuación del tendón del palmar largo y del retináculo flexor.',
        insercion:'Vainas de los tendones flexores y ligamentos metacarpianos palmares.',
        accion:'Protege los tendones y la arcada vasculonerviosa superficial; colabora en la prensión.',inervacion:'—'}});
    apo.geo.push(colocarFan(fanGeo(1.22,1.00,1.12,0.008),V3(0.02,0.02,0.375),V3(0,-1,0),V3(-1,0,0),V3(0,0,1)));
    const men=mk('ligamentos_metacarpianos_palmares','Ligamentos metacarpianos palmares','Ligamenta metacarpalia palmaria',
      {sis:'poleas',col:'LIGAMENTOS',reg:'Palma',color:PAL.ligamento,mo:{tex:null,r:0.66,side:MAT_DOBLE},
       meta:{origen:'Bordes palmares de los metacarpianos y placas de las MCF.',insercion:'Refuerzan las articulaciones MCF y las placas palmares.',
        accion:'Estabilizan las MCF y sostienen las poleas A1.',inervacion:'—'}});
    FING.forEach(f=>{men.geo.push(new THREE.BoxGeometry(0.17,0.04,0.24).translate(f.mcp.x-0.09,f.mcp.y+0.01,0.085));});
  }

  /* ---------- articulaciones ---------- */
  (function(){
    const A=[
      ['articulacion_radiocarpiana','Articulación radiocarpiana','Articulatio radiocarpalis',[0.05,0.90,0.02],[0.40,0.045,0.27],
        'Carilla carpiana del radio (escafoides y semilunar) y disco articular ulnar.',
        'Sinovial bicondílea (elipsoidea).',
        'Flexión, extensión, desviación radial y cubital.',
        'Ligamentos radiocarpianos palmar y dorsal, colateral radial, colateral ulnar y ligamento triangular.'],
      ['articulacion_mediocarpiana','Articulación mediocarpiana','Articulatio mediocarpalis',[0.02,0.42,0.02],[0.36,0.035,0.24],
        'Caras enfrentadas de la fila proximal (escafoides, semilunar, piramidal) y de la distal (trapecio, trapezoide, grande, ganchoso).',
        'Sinovial con dos cámaras; funciona como una bisagra en la flexoextensión.',
        'Flexión y extensión de la muñeca junto con la radiocarpiana; desviación pequeña.',
        'Ligamentos intercarpianos palmares y dorsales, y ligamentos radiocarpianos.'],
      ['articulacion_intercarpiana','Articulaciones intercarpianas','Articulationes intercarpales',[-0.14,0.56,0.02],[0.26,0.028,0.19],
        'Caras contiguas de los huesos del carpo dentro de cada fila.',
        'Sinovial plana (artrodias) con deslizamiento.',
        'Deslizamiento mínimo que acompaña al movimiento de la muñeca y amortigua la carga.',
        'Ligamentos intercarpianos interóseos, palmares y dorsales.']
    ];
    A.forEach(a=>{
      const s=mk(a[0],a[1],a[2],{sis:'articulaciones',col:'ARTICULACIONES',reg:'Muñeca',color:0xD8E5E3,
        mo:{tex:null,r:0.34,transparent:true,opacity:0.88},
        meta:{superficies:a[5],tipo:a[6],movimientos:a[7],estabilizadores:a[8]}});
      s.geo.push(place(blob(a[4][0],a[4][1],a[4][2],(a[0].length%13)+1,0.04),V3(a[3][0],a[3][1],a[3][2])));
    });
    const CMC=[
      [1,THUMB.cmc,'Trapecio y base del primer metacarpiano.','Sinovial en silla de montar (selar).',
        'Flexión, extensión, abducción, aducción y rotación: base de la oposición del pulgar.',
        'Ligamentos carpometacarpianos palmar y dorsal, e intermetacarpiano.'],
      [2,[0.40,-0.30,0],'Trapezoide y base del segundo metacarpiano.','Sinovial plana, muy congruente.','Deslizamiento mínimo.',
        'Ligamentos carpometacarpianos palmar y dorsal.'],
      [3,[0.05,-0.26,0],'Grande y base del tercer metacarpiano.','Sinovial plana.',
        'Deslizamiento mínimo; pilar central del arco transverso.','Ligamentos carpometacarpianos y ligamento interóseo.'],
      [4,[-0.20,-0.24,0],'Ganchoso y base del cuarto metacarpiano.','Sinovial plana.',
        'Flexión y rotación limitadas que aumentan el arco palmar.','Ligamentos carpometacarpianos e intermetacarpianos.'],
      [5,[-0.50,-0.22,0],'Ganchoso y base del quinto metacarpiano.','Sinovial plana.',
        'Flexión y rotación del quinto rayo en la prensión.','Ligamento carpometacarpiano y ligamento del oponente del meñique.']
    ];
    CMC.forEach(c=>{
      const s=mk('articulacion_carpometacarpiana_'+c[0],'Articulación carpometacarpiana '+c[0],
        'Articulatio carpometacarpalis '+c[0],
        {sis:'articulaciones',col:'ARTICULACIONES',reg:'Carpo',color:0xD8E5E3,
         mo:{tex:null,r:0.34,transparent:true,opacity:0.88},
         meta:{superficies:c[2],tipo:c[3],movimientos:c[4],estabilizadores:c[5]}});
      const rs=c[0]===1?[0.115,0.05,0.11]:[0.082,0.035,0.078];
      s.geo.push(place(blob(rs[0],rs[1],rs[2],c[0]+4,0.04),V3(c[1][0],c[1][1],c[1][2])));
    });
    FING.forEach(f=>{
      const D=DIG[f.k],j=D.j,fr=D.fr;
      [[0,'metacarpofalangica','metacarpofalángica','Metacarpophalangea',f.mcp,[0.078,0.042,0.072],
        'Cabeza del metacarpiano y base de la falange proximal, con placa palmar y dos sesamoideos.',
        'Sinovial condílea (en bisagra modificada).',
        'Flexión, extensión, abducción, aducción y circunducción limitada.',
        'Ligamentos colaterales radial y ulnar, ligamento palmar (placa) y ligamento metacarpiano transverso profundo.'],
       [1,'interfalangica_proximal','interfalángica proximal','Interphalangea proximalis',j[1],[0.058,0.032,0.055],
        'Cabeza de la falange proximal y base de la falange media.',
        'Sinovial en bisagra (troclear).','Flexión y extensión.',
        'Ligamentos colaterales radial y ulnar y placa palmar.'],
       [2,'interfalangica_distal','interfalángica distal','Interphalangea distalis',j[2],[0.046,0.026,0.043],
        'Cabeza de la falange media y base de la falange distal.',
        'Sinovial en bisagra (troclear).','Flexión y extensión.',
        'Ligamentos colaterales radial y ulnar y placa palmar.']
      ].forEach(t=>{
        const s=mk('articulacion_'+t[1]+'_'+f.k,'Articulación '+t[2]+' del '+f.nom,'Articulatio '+t[3]+' '+f.num,
          {sis:'articulaciones',col:'ARTICULACIONES',reg:'Dedos',dig:f.nom,color:0xD8E5E3,
           mo:{tex:null,r:0.34,transparent:true,opacity:0.88},
           meta:{superficies:t[6],tipo:t[7],movimientos:t[8],estabilizadores:t[9]}});
        const p=t[4];
        s.geo.push(place(blob(t[5][0],t[5][1],t[5][2],t[0]+7,0.04),p));
      });
      /* ligamentos colaterales agrupados por dígito */
      const col=mk('ligamentos_colaterales_'+f.k,'Ligamentos colaterales del '+f.nom,'Ligamenta collateralia '+f.num,
        {sis:'ligamentoso',col:'LIGAMENTOS',reg:'Dedos',dig:f.nom,color:PAL.ligamento,mo:{tex:null,r:0.6},
         meta:{origen:'Epicóndilos lateral y medial de la cabeza del metacarpiano y de la falange proximal.',
          insercion:'Bases laterales y palmares de la falange proximal y de la falange media.',
          accion:'Estabilizan las articulaciones MCF e IFP en el plano frontal y limitan la hiperextensión.',
          inervacion:'—',
          relaciones:'Se tensan con la abducción y la extensión; el fascículo accesorio lo hace con la flexión.'}});
      [0,1].forEach(gi=>{
        const sg=fr[gi];
        [1,-1].forEach(sgn=>{
          const p0=sg.a.clone().addScaledVector(sg.sd,sgn*(sg.r+0.006)).addScaledVector(sg.ax,-0.02);
          const p1=sg.b.clone().addScaledVector(sg.sd,sgn*(sg.r+0.004));
          col.geo.push(tubeGeo([p0,p0.clone().lerp(p1,0.55).addScaledVector(sg.vl,0.016),p1],t=>0.009,{tub:14,rad:6}));
        });
      });
    });
    [[ 'articulacion_metacarpofalangica_pulgar','Articulación metacarpofalángica del pulgar','Articulatio metacarpophalangea I',
        THUMB.mcp,[0.080,0.042,0.074],
        'Cabeza del primer metacarpiano y base de la falange proximal, con dos sesamoideos.',
        'Sinovial condílea.','Flexión, extensión y abducción limitada.',
        'Ligamentos colaterales radial y ulnar, placa palmar y sesamoideos.'],
      [ 'articulacion_interfalangica_pulgar','Articulación interfalángica del pulgar','Articulatio interphalangea I',
        THUMB.ip,[0.060,0.030,0.056],
        'Cabeza de la falange proximal y base de la falange distal del pulgar.',
        'Sinovial en bisagra (troclear).','Flexión y extensión.',
        'Ligamentos colaterales radial y ulnar y placa palmar.']
    ].forEach(t=>{
      const s=mk(t[0],t[1],t[2],{sis:'articulaciones',col:'ARTICULACIONES',reg:'Pulgar',dig:'pulgar',color:0xD8E5E3,
        mo:{tex:null,r:0.34,transparent:true,opacity:0.88},
        meta:{superficies:t[5],tipo:t[6],movimientos:t[7],estabilizadores:t[8]}});
      s.geo.push(place(blob(t[4][0],t[4][1],t[4][2],t[0].length%11+2,0.04),t[3]));
    });
    const colt=mk('ligamentos_colaterales_pulgar','Ligamentos colaterales del pulgar','Ligamenta collateralia I',
      {sis:'ligamentoso',col:'LIGAMENTOS',reg:'Pulgar',dig:'pulgar',color:PAL.ligamento,mo:{tex:null,r:0.6},
       meta:{origen:'Epicóndilos de la cabeza del primer metacarpiano y de la falange proximal.',
        insercion:'Bases laterales de la falange proximal y de la falange distal del pulgar.',
        accion:'Estabilizan la MCF y la IF del pulgar en el plano frontal.',
        inervacion:'—',relaciones:'El colateral ulnar de la MCF es el más solicitado en la prensión.'}});
    [0,1].forEach(gi=>{
      const sg=DIG.pulgar.fr[gi];
      [1,-1].forEach(sgn=>{
        const p0=sg.a.clone().addScaledVector(sg.sd,sgn*(sg.r+0.006)).addScaledVector(sg.ax,-0.02);
        const p1=sg.b.clone().addScaledVector(sg.sd,sgn*(sg.r+0.004));
        colt.geo.push(tubeGeo([p0,p0.clone().lerp(p1,0.55).addScaledVector(sg.vl,0.016),p1],t=>0.009,{tub:14,rad:6}));
      });
    });
  })();

  /* ---------- consolidar mallas ---------- */
  const out=[];
  STR.forEach(s=>{
    if(!s.geo.length)return;
    const g=partes(s.geo);
    s.geo.length=0;
    const mesh=new THREE.Mesh(g,s.mat);
    mesh.name=s.id;
    mesh.userData={id:s.id,nombre:s.nombre,latin:s.latin,sistema:s.sis,coleccion:s.col};
    s.mesh=mesh;
    CG[s.col].add(mesh);
    out.push(s);
  });
  return {root:root,CG:CG,estructuras:out,DIG:DIG};
}

/* ============================================================================
   API
   ========================================================================== */
const BUILT=construir();
const TOR={
  root:BUILT.root, colecciones:BUILT.CG, sistemas:SISTEMAS,
  estructuras:BUILT.estructuras, colorContorno:0x1B1B1B,
  seleccion:null, fondoOpacidad:0.40, _ocultos:new Set(),
  porId:function(id){return this.estructuras.find(e=>e.id===id);},
  _base:function(){this.estructuras.forEach(e=>{
    const m=e.mesh;
    m.visible=!this._ocultos.has(e.id);
    if(m.material.emissive)m.material.emissive.setHex(0x000000);
    m.material.opacity=e.baseO;m.material.transparent=e.baseT;m.material.depthWrite=e.baseDW;
    if(e.contorno)e.contorno.visible=false;
  });},
  _aplicar:function(){
    this._base();
    const sel=this.seleccion?this.porId(this.seleccion):null;
    this.estructuras.forEach(e=>{
      if(this._ocultos.has(e.id))return;
      if(sel&&e.id!==sel.id){
        e.mesh.material.transparent=true;
        e.mesh.material.opacity=this.fondoOpacidad*e.baseO;
        e.mesh.material.depthWrite=false;
        if(e.contorno)e.contorno.visible=false;
      }
    });
    if(sel){
      if(!sel.contorno)sel.contorno=this._contorno(sel);
      sel.contorno.visible=true;
      sel.mesh.material.opacity=sel.baseO;sel.mesh.material.transparent=sel.baseT;
      sel.mesh.material.depthWrite=sel.baseDW;
    }
  },
  _contorno:function(e){
    const g=e.mesh.geometry.clone();
    g.computeBoundingBox();
    const c=new THREE.Vector3();g.boundingBox.getCenter(c);
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(-c.x,-c.y,-c.z));
    g.applyMatrix4(new THREE.Matrix4().makeScale(1.028,1.028,1.028));
    g.applyMatrix4(new THREE.Matrix4().makeTranslation(c.x,c.y,c.z));
    const mesh=new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:this.colorContorno||0x1B1B1B,side:THREE.BackSide}));
    mesh.name=e.id+'_contorno';
    e.mesh.add(mesh);
    return mesh;
  },
  seleccionar:function(id){this.seleccion=(this.seleccion===id)?null:id;this._aplicar();return this.seleccion;},
  ocultar:function(id,b){
    if(b)this._ocultos.add(id);else this._ocultos.delete(id);
    if(this.seleccion===id&&b)this.seleccion=null;
    this._aplicar();
  },
  alternar:function(id){this.ocultar(id,this._ocultos.has(id)?false:true);},
  aislarSistema:function(sis){
    this._ocultos=new Set();
    this.estructuras.forEach(e=>{if(e.sis!==sis)this._ocultos.add(e.id);});
    this.seleccion=null;this._aplicar();
  },
  aislarColeccion:function(col){
    this._ocultos=new Set();
    this.estructuras.forEach(e=>{if(e.col!==col)this._ocultos.add(e.id);});
    this.seleccion=null;this._aplicar();
  },
  mostrarTodo:function(){this._ocultos=new Set();this.seleccion=null;this._aplicar();},
  opacidadFondo:function(v){this.fondoOpacidad=v;this._aplicar();},
  grupos:function(){
    const out={};
    this.estructuras.forEach(e=>{(out[e.col]=out[e.col]||[]).push(e);});
    return out;
  },
  conteo:function(){
    const vis=this.estructuras.filter(e=>!this._ocultos.has(e.id)).length;
    return {total:this.estructuras.length,visibles:vis,ocultos:this._ocultos.size};
  },
  exportarGLB:function(cb){
    const st=this.estructuras.map(e=>[e.mesh.material.opacity,e.mesh.material.transparent,e.mesh.visible]);
    this.estructuras.forEach(e=>{
      if(e.contorno)e.contorno.visible=false;
      e.mesh.material.opacity=1;e.mesh.material.transparent=false;
    });
    const n=this.estructuras.filter(e=>!this._ocultos.has(e.id)).length;
    const exp=new GLTFExporter();
    exp.parse(this.root,function(buf){
      TOR.estructuras.forEach((e,i)=>{
        e.mesh.material.opacity=st[i][0];e.mesh.material.transparent=st[i][1];e.mesh.visible=st[i][2];
      });
      const blob=new Blob([buf],{type:'model/gltf-binary'});
      const url=URL.createObjectURL(blob);
      const a=document.createElement('a');
      a.href=url;a.download='mano_derecha_TOR.glb';
      document.body.appendChild(a);a.click();document.body.removeChild(a);
      setTimeout(()=>URL.revokeObjectURL(url),4000);
      if(cb)cb({nombre:'mano_derecha_TOR.glb',objetos:n,tamano:(buf.byteLength/1048576).toFixed(2)});
    },function(err){if(cb)cb({error:String((err&&err.message)||err)});},{binary:true,onlyVisible:true});
  }
};

/* ============================================================================
   V2 · ESQUELETO ARTICULAR, CAPAS Y MOVIMIENTOS BIOMECÁNICOS
   ========================================================================== */
const EST=BUILT.estructuras;
const SIS_DE_COL={};COLECCIONES.forEach(c=>{SIS_DE_COL[c.id]=c.sis;});
const CLAVE_DIG={'índice':'indice','medio':'medio','anular':'anular','meñique':'menique','pulgar':'pulgar'};

/* profundidad anatómica: 1 superficial · 2 media · 3 profunda */
function profDe(s){
  const id=s.id;
  if(/^(aponeurosis|retinaculo|vaina_fibrosa|red_venosa|musculo_palmar_corto|ligamento_sagital)/.test(id))return 1;
  if(/^(tendon_flexor_profundo|tendon_flexor_largo|musculo_fdp|musculo_interoseo|musculo_lumbrical|rama_profunda_nervio_ulnar|arco_palmar_profundo|musculo_aductor_pulgar_transverso)/.test(id))return 3;
  return 2;
}
EST.forEach(s=>{s.sis=SIS_DE_COL[s.col]||s.sis;s.prof=profDe(s);s.meshes=[];});

/* ---------------- portadores (pivotes articulares) ---------------- */
const CAR=[],CARMAP={};
function nuevoCarrier(id,piv,padre,ejes,segs){
  const c={id:id,piv:piv,padre:padre,ax:ejes[0],vl:ejes[1],sd:ejes[2],segs:segs,
           grupo:new THREE.Group()};
  c.grupo.name='rig_'+id;
  CAR.push(c);CARMAP[id]=c;return c;
}
(function montarRig(){
  const Y=V3(0,1,0),Z=V3(0,0,1),NX=V3(-1,0,0);
  nuevoCarrier('antebrazo',V3(0,0,0),null,[Y,Z,NX],[{a:V3(0,3.3,0),b:V3(0.04,1.04,0.02)}]);
  nuevoCarrier('muneca',V3(0.05,0.88,0.02),'antebrazo',[Y,Z,NX],[{a:V3(0.05,1.04,0.02),b:V3(0.03,0.66,0.02)}]);
  nuevoCarrier('mano',V3(0.02,0.30,0.02),'muneca',[Y,Z,NX],[{a:V3(0.03,0.66,0.02),b:V3(0.02,-1.45,0.02)}]);
  FING.forEach(f=>{
    const D=BUILT.DIG[f.k],fr=D.fr;
    nuevoCarrier('mcp_'+f.k,f.mcp,'mano',[fr[0].ax,fr[0].vl,fr[0].sd],[{a:fr[0].a,b:fr[0].b}]);
    nuevoCarrier('pip_'+f.k,D.j[1],'mcp_'+f.k,[fr[1].ax,fr[1].vl,fr[1].sd],[{a:fr[1].a,b:fr[1].b}]);
    nuevoCarrier('dip_'+f.k,D.j[2],'pip_'+f.k,[fr[2].ax,fr[2].vl,fr[2].sd],[{a:fr[2].a,b:fr[2].b}]);
  });
  const T=BUILT.DIG.pulgar;
  nuevoCarrier('cmc_pulgar',THUMB.cmc,'mano',[T.fr[0].ax,T.fr[0].vl,T.fr[0].sd],[{a:THUMB.cmc,b:THUMB.mcp}]);
  nuevoCarrier('mcp_pulgar',THUMB.mcp,'cmc_pulgar',[T.fr[0].ax,T.fr[0].vl,T.fr[0].sd],[{a:T.fr[0].a,b:T.fr[0].b}]);
  nuevoCarrier('ip_pulgar',THUMB.ip,'mcp_pulgar',[T.fr[1].ax,T.fr[1].vl,T.fr[1].sd],[{a:T.fr[1].a,b:T.fr[1].b}]);
  CAR.forEach(c=>{
    if(c.padre){const p=CARMAP[c.padre];c.grupo.position.copy(c.piv).sub(p.piv);p.grupo.add(c.grupo);}
    else{ c.grupo.position.copy(c.piv); BUILT.root.add(c.grupo); }
  });
})();

/* ---------------- reparto de cada estructura entre portadores ---------------- */
function distSeg(p,a,b){
  const ab=b?b.clone().sub(a):null;
  if(!ab||ab.lengthSq()<1e-9)return p.distanceTo(a);
  let t=p.clone().sub(a).dot(ab)/ab.lengthSq();
  t=Math.max(0,Math.min(1,t));
  return p.distanceTo(a.clone().addScaledVector(ab,t));
}
function candidatosDe(s){
  const id=s.id,k=CLAVE_DIG[s.dig]||'';
  if(/^hueso_radio|^hueso_ulna/.test(id))return ['antebrazo'];
  if(/^hueso_(escafoides|semilunar|piramidal|pisiforme|trapecio|trapezoide|grande|ganchoso)/.test(id))return ['muneca'];
  if(id==='hueso_metacarpiano_1')return ['cmc_pulgar'];
  if(/^hueso_metacarpiano/.test(id))return ['mano'];
  if(k==='pulgar'){
    if(/^hueso_falange_proximal/.test(id)||/^articulacion_metacarpofalangica_pulgar/.test(id))return ['mcp_pulgar'];
    if(/^hueso_falange_distal/.test(id)||/^articulacion_interfalangica_pulgar/.test(id))return ['ip_pulgar'];
  }
  if(/^hueso_falange_proximal/.test(id))return ['mcp_'+k];
  if(/^hueso_falange_media/.test(id))return ['pip_'+k];
  if(/^hueso_falange_distal/.test(id))return ['dip_'+k];
  if(/^articulacion_(radiocarpiana|mediocarpiana|intercarpiana)/.test(id))return ['muneca'];
  if(/^articulacion_carpometacarpiana/.test(id))return ['mano'];
  if(/^articulacion_metacarpofalangica/.test(id))return ['mcp_'+k];
  if(/^articulacion_interfalangica_proximal/.test(id))return ['pip_'+k];
  if(/^articulacion_interfalangica_distal/.test(id))return ['dip_'+k];
  if(/^retinaculo/.test(id))return ['muneca'];
  if(s.col==='MUSCULOS_EXTRINSECOS')return ['antebrazo'];
  if(k==='pulgar')return ['muneca','mano','cmc_pulgar','mcp_pulgar','ip_pulgar'];
  if(k)return ['muneca','mano','mcp_'+k,'pip_'+k,'dip_'+k];
  return ['antebrazo','muneca','mano'];
}
(function repartir(){
  COLECCIONES.forEach(c=>{if(BUILT.CG[c.id])BUILT.root.remove(BUILT.CG[c.id]);});
  EST.forEach(s=>{
    const g=s.mesh?s.mesh.geometry:null;
    if(!g)return;
    const pos=g.attributes.position,nor=g.attributes.normal,uv=g.attributes.uv;
    const cubos={};
    for(let i=0;i<pos.count;i+=3){
      const cx=(pos.getX(i)+pos.getX(i+1)+pos.getX(i+2))/3;
      const cy=(pos.getY(i)+pos.getY(i+1)+pos.getY(i+2))/3;
      const cz=(pos.getZ(i)+pos.getZ(i+1)+pos.getZ(i+2))/3;
      const p=V3(cx,cy,cz);
      let best=CAR[0],bd=1e9;
      for(let ci=0;ci<CAR.length;ci++){
        const c=CAR[ci];
        for(let si=0;si<c.segs.length;si++){
          const d=distSeg(p,c.segs[si].a,c.segs[si].b);
          if(d<bd){bd=d;best=c;}
        }
      }
      if(!cubos[best.id])cubos[best.id]=[];
      cubos[best.id].push(i);
    }
    EST; // no-op
    Object.keys(cubos).forEach(cid=>{
      const idx=cubos[cid],n=idx.length*9;
      const P=new Float32Array(n),N=new Float32Array(n),U=new Float32Array(idx.length*6);
      const c=CARMAP[cid];
      let k=0,u=0;
      for(let ti=0;ti<idx.length;ti++){
        const t=idx[ti];
        for(let q=0;q<3;q++){
          const v=t+q;
          P[k]=pos.getX(v)-c.piv.x;N[k]=nor.getX(v);k++;
          P[k]=pos.getY(v)-c.piv.y;N[k]=nor.getY(v);k++;
          P[k]=pos.getZ(v)-c.piv.z;N[k]=nor.getZ(v);k++;
          U[u++]=uv?uv.getX(v):0.5;U[u++]=uv?uv.getY(v):0.5;
        }
      }
      const ng=new THREE.BufferGeometry();
      ng.setAttribute('position',new THREE.BufferAttribute(P,3));
      ng.setAttribute('normal',new THREE.BufferAttribute(N,3));
      ng.setAttribute('uv',new THREE.BufferAttribute(U,2));
      ng.computeBoundingSphere();
      const m=new THREE.Mesh(ng,s.mat);
      m.name=Object.keys(cubos).length>1?s.id+'__'+cid:s.id;
      m.userData={id:s.id,nombre:s.nombre,latin:s.latin,sistema:s.sis,coleccion:s.col,portador:cid};
      c.grupo.add(m);
      s.meshes.push(m);
    });
    if(s.mesh){s.mesh.geometry.dispose();s.mesh=null;}
    s.mesh=s.meshes[0]||null;
  });
})();

/* ---------------- movimientos biomecánicos ---------------- */
const idsDe=function(pref){return EST.filter(s=>pref.some(p=>s.id.indexOf(p)===0)).map(s=>s.id);};
const movDedos=function(eje,g1,g2,g3){const o=[];FING.forEach(f=>{if(g1)o.push({c:'mcp_'+f.k,eje:eje,g:g1});if(g2)o.push({c:'pip_'+f.k,eje:eje,g:g2});if(g3)o.push({c:'dip_'+f.k,eje:eje,g:g3});});return o;};
const H_DEDOS=idsDe(['hueso_falange_']);
const H_CARPO=idsDe(['hueso_escafoides','hueso_semilunar','hueso_piramidal','hueso_pisiforme','hueso_trapecio','hueso_trapezoide','hueso_grande','hueso_ganchoso']);
const MOV=[
  {id:'flexion_dedos',nombre:'Flexión de los dedos',familia:'Dedos',
   detalle:'MCF, IFP e IFD de los dedos II–V.',
   joints:movDedos('flex',72,86,52),
   huesos:H_DEDOS,
   articulaciones:idsDe(['articulacion_metacarpofalangica_i','articulacion_metacarpofalangica_m','articulacion_metacarpofalangica_a','articulacion_metacarpofalangica_me','articulacion_interfalangica_']),
   musculos:['musculo_fds','musculo_fdp'].concat(idsDe(['musculo_lumbrical_','musculo_interoseo_'])),
   tendones:idsDe(['tendon_flexor_superficial_','tendon_flexor_profundo_']),
   estables:'Radio, ulna y carpo permanecen fijos; las poleas A2 y A4 mantienen los tendones contra la falange.'},
  {id:'extension_dedos',nombre:'Extensión de los dedos',familia:'Dedos',
   detalle:'MCF, IFP e IFD de los dedos II–V.',
   joints:movDedos('flex',-18,-12,-10),
   huesos:H_DEDOS,
   articulaciones:idsDe(['articulacion_metacarpofalangica_i','articulacion_metacarpofalangica_m','articulacion_metacarpofalangica_a','articulacion_metacarpofalangica_me','articulacion_interfalangica_']),
   musculos:['musculo_ed','musculo_ei','musculo_edm'].concat(idsDe(['musculo_lumbrical_'])),
   tendones:idsDe(['tendon_extensor_dedos_','expansion_extensora_','banda_central_','bandas_laterales_','tendon_terminal_extensor_']),
   estables:'El carpo no se desplaza; las expansiones extensoras transmiten la fuerza a las IFP e IFD.'},
  {id:'abduccion_dedos',nombre:'Abducción de los dedos',familia:'Dedos',
   detalle:'MCF de los dedos II, IV y V.',
   joints:[{c:'mcp_indice',eje:'abd',g:14},{c:'mcp_anular',eje:'abd',g:-11},{c:'mcp_menique',eje:'abd',g:-16}],
   huesos:H_DEDOS,
   articulaciones:['articulacion_metacarpofalangica_indice','articulacion_metacarpofalangica_anular','articulacion_metacarpofalangica_menique'],
   musculos:idsDe(['musculo_interoseo_dorsal_']),
   tendones:idsDe(['expansion_extensora_']),
   estables:'El dedo medio sirve de referencia; los interóseos palmares quedan en reposo.'},
  {id:'aduccion_dedos',nombre:'Aducción de los dedos',familia:'Dedos',
   detalle:'MCF de los dedos II, IV y V.',
   joints:[{c:'mcp_indice',eje:'abd',g:-13},{c:'mcp_anular',eje:'abd',g:10},{c:'mcp_menique',eje:'abd',g:15}],
   huesos:H_DEDOS,
   articulaciones:['articulacion_metacarpofalangica_indice','articulacion_metacarpofalangica_anular','articulacion_metacarpofalangica_menique'],
   musculos:idsDe(['musculo_interoseo_palmar_']),
   tendones:idsDe(['expansion_extensora_']),
   estables:'El dedo medio permanece centrado; los interóseos dorsales se relajan.'},
  {id:'flexion_pulgar',nombre:'Flexión del pulgar',familia:'Pulgar',
   detalle:'MCF e IF del pulgar.',
   joints:[{c:'mcp_pulgar',eje:'flex',g:42},{c:'ip_pulgar',eje:'flex',g:52}],
   huesos:['hueso_metacarpiano_1','hueso_falange_proximal_pulgar','hueso_falange_distal_pulgar'],
   articulaciones:['articulacion_metacarpofalangica_pulgar','articulacion_interfalangica_pulgar'],
   musculos:['musculo_fpl','musculo_fpb','musculo_adductor_pulgar_transverso'],
   tendones:['tendon_flexor_largo_pulgar'],
   estables:'El primer metacarpiano conserva su posición; la polea oblicua retiene el FPL.'},
  {id:'extension_pulgar',nombre:'Extensión del pulgar',familia:'Pulgar',
   detalle:'MCF e IF del pulgar.',
   joints:[{c:'mcp_pulgar',eje:'flex',g:-26},{c:'ip_pulgar',eje:'flex',g:-30}],
   huesos:['hueso_metacarpiano_1','hueso_falange_proximal_pulgar','hueso_falange_distal_pulgar'],
   articulaciones:['articulacion_metacarpofalangica_pulgar','articulacion_interfalangica_pulgar'],
   musculos:['musculo_epl','musculo_epb','musculo_apl'],
   tendones:['tendon_extensor_largo_pulgar','tendon_extensor_corto_pulgar'],
   estables:'El carpo no se mueve; los extensores pasan por el tercer y el primer compartimento.'},
  {id:'oposicion_pulgar',nombre:'Oposición del pulgar',familia:'Pulgar',
   detalle:'Articulación carpometacarpiana del pulgar, con MCF e IF acompañando.',
   joints:[{c:'cmc_pulgar',eje:'flex',g:34},{c:'cmc_pulgar',eje:'abd',g:26},{c:'mcp_pulgar',eje:'flex',g:22},{c:'ip_pulgar',eje:'flex',g:26}],
   huesos:['hueso_metacarpiano_1','hueso_falange_proximal_pulgar','hueso_falange_distal_pulgar'],
   articulaciones:['articulacion_carpometacarpiana_1','articulacion_metacarpofalangica_pulgar','articulacion_interfalangica_pulgar'],
   musculos:['musculo_oponente_pulgar','musculo_abductor_corto_pulgar','musculo_flexor_corto_pulgar','musculo_aductor_pulgar_oblicuo'],
   tendones:['tendon_flexor_largo_pulgar','tendon_abductor_largo_pulgar'],
   estables:'El trapecio y el resto del carpo permanecen fijos; la oposición ocurre en la silla de montar.'},
  {id:'reposicion_pulgar',nombre:'Reposición del pulgar',familia:'Pulgar',
   detalle:'Retorno del primer rayo desde la oposición a la posición anatómica.',
   joints:[{c:'cmc_pulgar',eje:'flex',g:-30},{c:'cmc_pulgar',eje:'abd',g:-24},{c:'mcp_pulgar',eje:'flex',g:-18},{c:'ip_pulgar',eje:'flex',g:-20}],
   huesos:['hueso_metacarpiano_1','hueso_falange_proximal_pulgar','hueso_falange_distal_pulgar'],
   articulaciones:['articulacion_carpometacarpiana_1','articulacion_metacarpofalangica_pulgar','articulacion_interfalangica_pulgar'],
   musculos:['musculo_epl','musculo_apl','musculo_extensor_corto_pulgar'],
   tendones:['tendon_extensor_largo_pulgar','tendon_abductor_largo_pulgar'],
   estables:'El primer metacarpiano vuelve a su posición; el trapecio no cambia.'},
  {id:'flexion_muneca',nombre:'Flexión de la muñeca',familia:'Muñeca',
   detalle:'Articulaciones radiocarpiana y mediocarpiana.',
   joints:[{c:'muneca',eje:'flex',g:58}],
   huesos:H_CARPO.concat(idsDe(['hueso_metacarpiano_'])),
   articulaciones:['articulacion_radiocarpiana','articulacion_mediocarpiana'],
   musculos:['musculo_fcr','musculo_fcu','musculo_pl'],
   tendones:['tendon_flexor_radial_carpo','tendon_flexor_ulnar_carpo','tendon_palmar_largo'],
   estables:'Radio y ulna no se desplazan; el retináculo flexor mantiene los tendones en el túnel carpiano.'},
  {id:'extension_muneca',nombre:'Extensión de la muñeca',familia:'Muñeca',
   detalle:'Articulaciones radiocarpiana y mediocarpiana.',
   joints:[{c:'muneca',eje:'flex',g:-52}],
   huesos:H_CARPO.concat(idsDe(['hueso_metacarpiano_'])),
   articulaciones:['articulacion_radiocarpiana','articulacion_mediocarpiana'],
   musculos:['musculo_ecrl','musculo_ecrb','musculo_ecu','musculo_ed'],
   tendones:idsDe(['tendon_extensor_dedos_','tendon_extensor_radial']),
   estables:'La ulna permanece estable; el retináculo extensor guía los tendones dorsales.'},
  {id:'desviacion_radial',nombre:'Desviación radial de la muñeca',familia:'Muñeca',
   detalle:'Radiocarpiana y mediocarpiana con deslizamiento intercarpiano.',
   joints:[{c:'muneca',eje:'abd',g:24}],
   huesos:H_CARPO.concat(idsDe(['hueso_metacarpiano_'])),
   articulaciones:['articulacion_radiocarpiana','articulacion_mediocarpiana','articulacion_intercarpiana'],
   musculos:['musculo_fcr','musculo_ecrl','musculo_abductor_largo_pulgar'],
   tendones:['tendon_flexor_radial_carpo','tendon_abductor_largo_pulgar'],
   estables:'La ulna no acompaña el movimiento; el escafoides se extiende y el semilunar sigue al radio.'},
  {id:'desviacion_cubital',nombre:'Desviación cubital de la muñeca',familia:'Muñeca',
   detalle:'Radiocarpiana y mediocarpiana con deslizamiento intercarpiano.',
   joints:[{c:'muneca',eje:'abd',g:-30}],
   huesos:H_CARPO.concat(idsDe(['hueso_metacarpiano_'])),
   articulaciones:['articulacion_radiocarpiana','articulacion_mediocarpiana','articulacion_intercarpiana'],
   musculos:['musculo_fcu','musculo_ecu'],
   tendones:['tendon_flexor_ulnar_carpo','tendon_extensor_ulnar_carpo'],
   estables:'El radio permanece estable; el piramidal se traslada y el pisiforme acompaña al carpo.'}
];

/* ---------------- API v2 ---------------- */
const suave=t=>t<0.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
const capaDe=s=>s.prof;
TOR.movimientos=MOV;
TOR.carriers=CARMAP;
TOR.seleccion=new Set();
TOR.acento=0x56D6FF;
TOR.fondoOpacidad=0.34;
TOR._capa=1;
TOR.movimiento=null;
TOR._t=0;
TOR.porId=function(id){return EST.find(e=>e.id===id);};
TOR._base=function(){
  EST.forEach(s=>{
    const vis=!this._ocultos.has(s.id)&&capaDe(s)>=this._capa;
    s.meshes.forEach(m=>{m.visible=vis;});
    s.mat.emissive.setHex(0x000000);
    s.mat.emissiveIntensity=0;
    s.mat.opacity=s.baseO;s.mat.transparent=s.baseT;s.mat.depthWrite=s.baseDW;
  });
};
TOR._aplicar=function(){
  this._base();
  if(!this.seleccion.size)return;
  EST.forEach(s=>{
    if(this._ocultos.has(s.id)||capaDe(s)<this._capa)return;
    if(this.seleccion.has(s.id)){
      s.mat.emissive.setHex(this.acento);
      s.mat.emissiveIntensity=0.55;
    }else{
      s.mat.transparent=true;
      s.mat.opacity=this.fondoOpacidad*s.baseO;
      s.mat.depthWrite=false;
    }
  });
};
TOR.seleccionar=function(id){
  const ya=this.seleccion.size===1&&this.seleccion.has(id);
  this.seleccion.clear();
  if(!ya)this.seleccion.add(id);
  this._aplicar();return this.seleccion;
};
TOR.alternarSeleccion=function(id){
  if(this.seleccion.has(id))this.seleccion.delete(id);else this.seleccion.add(id);
  this._aplicar();
};
TOR.seleccionarVarios=function(ids){this.seleccion=new Set(ids);this._aplicar();};
TOR.limpiarSeleccion=function(){this.seleccion.clear();this._aplicar();};
TOR.primeraSeleccion=function(){return this.seleccion.size?this.porId([...this.seleccion][0]):null;};
TOR.referenciasDe=function(id){
  const s=this.porId(id);
  if(!s||!s.dig)return [];
  const k=CLAVE_DIG[s.dig]||'';
  if(!k)return [];
  return EST.filter(x=>x.col==='HUESOS'&&x.id.indexOf(k)>=0).map(x=>x.id);
};
TOR.ocultar=function(id,b){
  if(b)this._ocultos.add(id);else this._ocultos.delete(id);
  this._aplicar();
};
TOR.alternar=function(id){this.ocultar(id,this._ocultos.has(id)?false:true);};
TOR.aislarEstructura=function(id){
  this._ocultos=new Set(EST.filter(e=>e.id!==id).map(e=>e.id));
  this.seleccion=new Set([id]);
  this._aplicar();
};
TOR.aislarConReferencias=function(id){
  const refs=this.referenciasDe(id);
  const keep=new Set([id].concat(refs));
  this._ocultos=new Set(EST.filter(e=>!keep.has(e.id)).map(e=>e.id));
  this.seleccion=new Set([id]);
  this._aplicar();
};
TOR.aislarParticipantes=function(movId){
  const m=MOV.find(x=>x.id===movId);if(!m)return;
  const keep=new Set([].concat(m.musculos,m.tendones,m.articulaciones,m.huesos));
  this._ocultos=new Set(EST.filter(e=>!keep.has(e.id)).map(e=>e.id));
  this.seleccion=new Set(m.tendones.length?[m.tendones[0]]:[]);
  this._aplicar();
};
TOR.aislarSistema=function(sis){
  this._ocultos=new Set(EST.filter(e=>e.sis!==sis).map(e=>e.id));
  this.seleccion.clear();this._aplicar();
};
TOR.aislarColeccion=function(col){
  this._ocultos=new Set(EST.filter(e=>e.col!==col).map(e=>e.id));
  this.seleccion.clear();this._aplicar();
};
TOR.ocultarColeccion=function(col,b){
  EST.forEach(e=>{if(e.col===col){if(b)this._ocultos.add(e.id);else this._ocultos.delete(e.id);}});
  this._aplicar();
};
TOR.mostrarTodo=function(){this._ocultos=new Set();this.seleccion.clear();this._capa=1;this._aplicar();};
TOR.capa=function(n){this._capa=n;this._aplicar();};
TOR.opacidadFondo=function(v){this.fondoOpacidad=v;this._aplicar();};
TOR.grupos=function(){const out={};EST.forEach(e=>{(out[e.col]=out[e.col]||[]).push(e);});return out;};
TOR.conteo=function(){
  let vis=0,ocu=0;
  EST.forEach(e=>{ if(this._ocultos.has(e.id)||capaDe(e)<this._capa)ocu++; else vis++; });
  return {total:EST.length,visibles:vis,ocultos:ocu};
};
TOR.resetPose=function(){
  CAR.forEach(c=>{c.grupo.quaternion.identity();});
};
TOR.pose=function(movId,t){
  this.resetPose();
  const m=MOV.find(x=>x.id===movId);
  if(!m)return;
  const k=suave(Math.max(0,Math.min(1,t)));
  const q={};
  m.joints.forEach(o=>{
    const c=CARMAP[o.c];if(!c)return;
    const eje=o.eje==='flex'?c.sd:(o.eje==='abd'?c.vl:c.ax);
    const qq=new THREE.Quaternion().setFromAxisAngle(eje,THREE.MathUtils.degToRad(o.g)*k);
    if(!q[o.c])q[o.c]=new THREE.Quaternion();
    q[o.c].multiply(qq);
  });
  Object.keys(q).forEach(c=>{CARMAP[c].grupo.quaternion.copy(q[c]);});
  this.movimiento=movId;this._t=t;
};
TOR.estructurasDeMovimiento=function(movId){
  const m=MOV.find(x=>x.id===movId);
  if(!m)return [];
  const ids=new Set([].concat(m.musculos,m.tendones,m.articulaciones,m.huesos));
  return EST.filter(e=>ids.has(e.id));
};
TOR._aplicar();
window.THREE = THREE;
window.TOR = TOR;
window.dispatchEvent(new Event("tor-model-ready"));
