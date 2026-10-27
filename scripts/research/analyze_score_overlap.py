from pathlib import Path
from fractions import Fraction as F
from collections import Counter
import xml.etree.ElementTree as E,zipfile,json
steps=dict(C=0,D=2,E=4,F=5,G=7,A=9,B=11)
for p in [Path('public/beautiful_danxia_flutes.musicxml'),Path('public/sailing-with-whales-rossano-galante.mxl'),Path('public/neruda_trumpet_concerto_excerpt.musicxml')]:
 if p.suffix=='.mxl':
  with zipfile.ZipFile(p) as z:
   c=E.fromstring(z.read('META-INF/container.xml')); name=next(e.attrib['full-path'] for e in c.iter() if e.tag.endswith('rootfile')); raw=z.read(name)
 else: raw=p.read_bytes()
 root=E.fromstring(raw)
 for e in root.iter(): e.tag=e.tag.split('}')[-1]
 partinfo={e.attrib['id']:(e.findtext('part-name'),e.findtext('midi-instrument/midi-program')) for e in root.findall('part-list/score-part')}
 events=[]; layouts=[]; lengths={};warnings=[]
 for part in root.findall('part'):
  divisions=F(1);transpose=0;part_events=[]
  for i,measure in enumerate(part.findall('measure')):
   cursor=F(0);last=F(0);extent=F(0)
   for e in measure:
    if e.tag=='attributes':
     if e.find('divisions') is not None:divisions=F(e.findtext('divisions'))
     trans=e.find('transpose')
     if trans is not None:transpose=float(trans.findtext('chromatic','0'))+12*int(trans.findtext('octave-change','0'))
    elif e.tag in ('backup','forward'):
     cursor+=(-1 if e.tag=='backup' else 1)*F(e.findtext('duration','0'))/divisions
    elif e.tag=='note':
     duration=F(e.findtext('duration','0'))/divisions;onset=last if e.find('chord') is not None else cursor
     pitch=e.find('pitch')
     if pitch is not None:
      midi=12*(int(pitch.findtext('octave'))+1)+steps[pitch.findtext('step')]+float(pitch.findtext('alter','0'))+transpose
      ties=tuple(t.attrib.get('type') for t in e.findall('tie'))
      arts=tuple(a.tag for a in e.findall('notations/articulations/*'))
      part_events.append((i,onset,midi,duration,ties,arts))
     if e.find('chord') is None:last=cursor;cursor+=duration
     extent=max(extent,cursor)
   lengths[i]=max(lengths.get(i,F(0)),extent)
  layouts.append((part.attrib['id'],part_events))
 start={};t=F(0)
 for i,length in sorted(lengths.items()):start[i]=t;t+=length
 for partid,notes in layouts:
  name,program=partinfo.get(partid,('',None))
  for i,onset,pitch,duration,ties,arts in notes:events.append((start[i]+onset,pitch,duration,ties,arts,program,partid))
 allkeys=Counter(e[:5] for e in events)
 sameprogram=Counter(e[:6] for e in events if e[5] is not None)
 print(json.dumps({'score':p.name,'parts':len(layouts),'pitched_note_events':len(events),'coincident_pitch_onset_duration_articulation_tie_events_beyond_first':sum(n-1 for n in allkeys.values()),'same_declared_MIDI_program_coincidences_beyond_first':sum(n-1 for n in sameprogram.values()),'parts_with_declared_program':sum(1 for n in partinfo.values() if n[1] is not None),'limitations':'source timeline only, no repeat expansion or tie-chain merge; coincidence does not prove accidental duplication'}))
