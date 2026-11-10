import {mkdir,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const exec=promisify(execFile);
export async function voice(id:string,narration:string){
 const dir=path.resolve('remotion/public/audio');await mkdir(dir,{recursive:true});
 const outfile=path.join(dir,`${id}.mp3`);
 if(process.env.DEMO_MODE==='true'){
   // Offline smoke-test voice; replace with ElevenLabs for a natural AI narrator.
   const wav=path.join(dir,`${id}.wav`);
   try {
     await exec('espeak',['-s','160','-w',wav,narration]);
   } catch {
     if (process.platform === 'win32') {
       const ps = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; $s.SetOutputToWaveFile('${wav.replace(/\\/g, '/')}'); $s.Speak('${narration.replace(/'/g, "''")}'); $s.Dispose();`;
       await exec('powershell.exe', ['-NoProfile', '-Command', ps]);
     } else {
       throw Error('Neither espeak nor native TTS is available for DEMO_MODE');
     }
   }
   await exec('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',wav,outfile]);
 }else{
  const key=process.env.ELEVENLABS_API_KEY,voice=process.env.ELEVENLABS_VOICE_ID;
  if(!key||!voice)throw Error('Missing ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID');
  const res=await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`,{method:'POST',headers:{'xi-api-key':key,'Content-Type':'application/json'},body:JSON.stringify({text:narration,model_id:process.env.ELEVENLABS_MODEL||'eleven_multilingual_v2'})});
  if(!res.ok)throw Error(`ElevenLabs ${res.status}: ${(await res.text()).slice(0,350)}`);
  await writeFile(outfile,Buffer.from(await res.arrayBuffer()));
 }
 const {stdout}=await exec('ffprobe',['-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',outfile]);
 const seconds=Number(stdout.trim());if(!Number.isFinite(seconds)||seconds<=0)throw Error('Audio duration unavailable');
 return {file:outfile,seconds,relativeAudio:`audio/${id}.mp3`};
}
