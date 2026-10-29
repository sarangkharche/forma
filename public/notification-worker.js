self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('push',event=>{
 let message={title:'Forma',body:'Open Forma to review your updates.',tag:'forma'};
 try{if(event.data)message=event.data.json();}catch{/* Keep safe fallback. */}
 event.waitUntil((async()=>{
  await self.registration.showNotification(message.title,{body:message.body,tag:message.tag,renotify:Boolean(message.renotify),icon:'/icon.svg',data:{id:message.id}});
  if(message.deliveryToken)try{await fetch('/api/inbox',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'shown',token:message.deliveryToken})});}catch{/* Display succeeded. Confirmation can be unavailable. */}
 })());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const url=new URL('/',self.location.origin);url.searchParams.set('inbox','1');
  const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const tab of tabs)if(new URL(tab.url).origin===self.location.origin){tab.postMessage({type:'forma-open-inbox'});return tab.focus();}
  return self.clients.openWindow(url.href);
 })());
});
