'use strict';
const params = new URLSearchParams(location.search);
const imageUrl = params.get('image') || '';
const filename = params.get('filename') || 'annotated-capture.png';
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const image = new Image();
let drawing = false; let last = null; let baseData = null; const actions = []; let current = [];
function paint() { if (!baseData) return; context.putImageData(baseData,0,0); for (const strokes of actions) drawStroke(strokes); drawStroke(current); }
function drawStroke(stroke) { if (!stroke.length) return; context.save(); context.strokeStyle=stroke[0].color; context.lineWidth=stroke[0].size; context.lineCap='round'; context.lineJoin='round'; context.beginPath(); context.moveTo(stroke[0].x,stroke[0].y); for (const point of stroke.slice(1)) context.lineTo(point.x,point.y); if(stroke.length===1){context.lineTo(stroke[0].x+.1,stroke[0].y+.1)} context.stroke(); context.restore(); }
image.onload=()=>{const maxW=1600;const scale=Math.min(1,maxW/image.naturalWidth);canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);context.drawImage(image,0,0,canvas.width,canvas.height);baseData=context.getImageData(0,0,canvas.width,canvas.height);};
image.onerror=()=>{document.querySelector('header small').textContent='Could not load the screenshot.'}; image.src=imageUrl;
function point(event){const rect=canvas.getBoundingClientRect();return{x:(event.clientX-rect.left)*(canvas.width/rect.width),y:(event.clientY-rect.top)*(canvas.height/rect.height),color:document.getElementById('color').value,size:Number(document.getElementById('size').value)}}
canvas.addEventListener('pointerdown',(event)=>{drawing=true;last=point(event);current=[last];canvas.setPointerCapture(event.pointerId)});
canvas.addEventListener('pointermove',(event)=>{if(!drawing)return;const next=point(event);current.push(next);paint();drawStroke(current)});
function finish(){if(!drawing)return;drawing=false;if(current.length){actions.push(current);current=[]}paint()}
canvas.addEventListener('pointerup',finish);canvas.addEventListener('pointercancel',finish);
document.getElementById('undo').addEventListener('click',()=>{actions.pop();paint()});
document.getElementById('clear').addEventListener('click',()=>{actions.length=0;paint()});
document.getElementById('save').addEventListener('click',()=>{const link=document.createElement('a');link.href=canvas.toDataURL('image/png');link.download=filename.replace(/\.png$/i,'')+'-annotated.png';link.click()});
