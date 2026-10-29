import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
const root=process.cwd(),uid=process.getuid(),label='com.forma.local';
if(!existsSync(join(root,'.next','BUILD_ID')))throw new Error('Run npm run build first.');
const directory=join(homedir(),'Library','LaunchAgents'),data=join(root,'.todos');
mkdirSync(directory,{recursive:true});mkdirSync(data,{recursive:true,mode:0o700});
const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const file=join(directory,`${label}.plist`);
const plist=`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${escape(process.execPath)}</string><string>${escape(join(root,'scripts','start.mjs'))}</string></array>
<key>WorkingDirectory</key><string>${escape(root)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/><key>ThrottleInterval</key><integer>10</integer>
<key>StandardOutPath</key><string>${escape(join(data,'runtime.log'))}</string>
<key>StandardErrorPath</key><string>${escape(join(data,'runtime-error.log'))}</string>
</dict></plist>`;
writeFileSync(file,plist,{mode:0o600});
try{execFileSync('launchctl',['bootout',`gui/${uid}/${label}`],{stdio:'ignore'});}catch{/* First installation. */}
execFileSync('launchctl',['bootstrap',`gui/${uid}`,file],{stdio:'inherit'});
console.log(`Forma login service installed: ${file}`);
