import { useState, useMemo, useEffect, useRef } from 'react';
import { PlaybackControls } from './components/PlaybackControls';
import { SheetMusicViewer } from './components/SheetMusicViewer';
import { 
  parseXmlOffscreen, 
  getInstrumentGroup, 
  type ScoreData, 
  type PartData,
  type PracticePart 
} from './utils/scoreParser';
import { AudioEngine } from './utils/audioEngine';
import { Music, Heart, Play, Pause, RotateCcw } from 'lucide-react';
import JSZip from 'jszip';

interface LoadedFile {
  id: string;
  name: string;
  xmlData: string | Uint8Array;
  isMxl: boolean;
  scoreData: ScoreData;
}

function App() {
  const [fileLoaded, setFileLoaded] = useState<boolean>(false);
  const [loadedFiles, setLoadedFiles] = useState<LoadedFile[]>([]);
  const [selectedFileIndex, setSelectedFileIndex] = useState<number>(-1);
  const [unifiedScoreData, setUnifiedScoreData] = useState<ScoreData | null>(null);
  
  // Playback states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackProgress, setPlaybackProgress] = useState<number>(0);
  const [metronomeMuted, setMetronomeMuted] = useState<boolean>(false);
  const [metronomeVolume, setMetronomeVolume] = useState<number>(-12); // default comfortable volume in dB
  const [backingVolume, setBackingVolume] = useState<number>(0);
  
  // Backing track modes and selections
  const [backingTrackMode, setBackingTrackMode] = useState<'solo' | 'custom'>('custom');
  const [selectedPracticePart, setSelectedPracticePart] = useState<PracticePart | null>(null);
  const [customMutedPartIds, setCustomMutedPartIds] = useState<Record<string, boolean>>({});

  // Audio Engine Loading states
  const [isLoadingInstruments, setIsLoadingInstruments] = useState<boolean>(false);
  const [loadingProgress, setLoadingProgress] = useState<number>(0);
  const [zipParsingStatus, setZipParsingStatus] = useState<string>('');

  const [soundfontCatalog, setSoundfontCatalog] = useState<'FluidR3_GM' | 'MusyngKite'>('MusyngKite');
  const [countInEnabled, setCountInEnabled] = useState<boolean>(true);
  
  // Refs for tracking states inside effects without triggering redundant reloads
  const isPlayingRef = useRef(isPlaying);
  const backingTrackModeRef = useRef(backingTrackMode);
  const selectedPracticePartRef = useRef(selectedPracticePart);
  const customMutedPartIdsRef = useRef(customMutedPartIds);
  const lastLoadedCatalogRef = useRef<string>('');

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    backingTrackModeRef.current = backingTrackMode;
    selectedPracticePartRef.current = selectedPracticePart;
    customMutedPartIdsRef.current = customMutedPartIds;
  });

  // Memoize audio engine to prevent multiple initialization
  const audioEngine = useMemo(() => {
    const ae = new AudioEngine();
    (window as any).audioEngine = ae;
    return ae;
  }, []);

  // 1. Audio Engine Callback Setup
  useEffect(() => {
    audioEngine.setTimeUpdateCallback((seconds) => {
      setPlaybackProgress(seconds);
    });

    audioEngine.setPlaybackEndCallback(() => {
      setIsPlaying(false);
      audioEngine.stop();
    });

    return () => {
      audioEngine.cancelPlayback();
    };
  }, [audioEngine]);

  // 2. Volume and Settings Sync Effects
  useEffect(() => {
    audioEngine.setMetronomeMuted(metronomeMuted);
    audioEngine.setMetronomeVolume(metronomeVolume);
  }, [metronomeMuted, metronomeVolume, audioEngine]);

  useEffect(() => {
    audioEngine.setBackingVolume(backingVolume);
  }, [backingVolume, audioEngine]);

  useEffect(() => {
    audioEngine.setSoundfontCatalog(soundfontCatalog);
  }, [soundfontCatalog, audioEngine]);

  // Synchronize dynamic loading when the soundfontCatalog changes
  useEffect(() => {
    // If files are loaded, reload the instruments using the new catalog
    if (unifiedScoreData && fileLoaded && soundfontCatalog !== lastLoadedCatalogRef.current) {
      const reloadInstruments = async () => {
        const wasPlaying = isPlayingRef.current;
        if (wasPlaying) {
          setIsPlaying(false);
          audioEngine.pause(backingTrackModeRef.current === 'solo' ? 'solo_run' : 'custom_run');
        } else {
          audioEngine.stop();
        }
        audioEngine.cancelPlayback();
        
        setIsLoadingInstruments(true);
        setLoadingProgress(0);
        setZipParsingStatus(`Switching to ${soundfontCatalog === 'MusyngKite' ? 'High Quality' : 'Standard'} samples...`);
        
        try {
          await audioEngine.loadInstruments(unifiedScoreData, (progress) => {
            setLoadingProgress(progress);
          });
          lastLoadedCatalogRef.current = soundfontCatalog;
          setIsLoadingInstruments(false);
          setZipParsingStatus('');
          audioEngine.scheduleScore(unifiedScoreData, false, selectedPracticePartRef.current?.audioPartId || '', countInEnabled);
          
          // Apply muting states immediately since scheduleScore resets volume nodes
          unifiedScoreData.parts.forEach((part) => {
            const isMuted = backingTrackModeRef.current === 'solo'
              ? selectedPracticePartRef.current?.audioPartId !== part.id
              : !!customMutedPartIdsRef.current[part.id];
            audioEngine.setPartMuted(part.id, isMuted);
          });
          
          if (wasPlaying) {
            await audioEngine.start();
            setIsPlaying(true);
          }
        } catch (err) {
          console.error("Error reloading instruments", err);
          setIsLoadingInstruments(false);
          setZipParsingStatus('Failed to load instrument samples.');
        }
      };
      
      reloadInstruments();
    }
  }, [soundfontCatalog, unifiedScoreData, fileLoaded, audioEngine]);

  // 3. Handle backing track muting updates dynamically
  useEffect(() => {
    if (!unifiedScoreData) return;
    
    console.log(`[Audio Mute Sync] Mode: ${backingTrackMode}`);
    unifiedScoreData.parts.forEach((part) => {
      let isMuted = false;
      if (backingTrackMode === 'solo') {
        // Solo mode: mute all staves EXCEPT the selected practice instrument
        isMuted = selectedPracticePart?.audioPartId !== part.id;
      } else {
        // Custom mix mode: mute if present in customMutedPartIds
        isMuted = !!customMutedPartIds[part.id];
      }
      audioEngine.setPartMuted(part.id, isMuted);
      console.log(` - Part: ${part.name} (${part.id}) -> Muted: ${isMuted}`);
    });
  }, [selectedPracticePart, backingTrackMode, customMutedPartIds, unifiedScoreData, audioEngine]);

  // Helper to merge all parts from loaded files into a single unified ScoreData for AudioEngine
  const buildUnifiedScoreData = (files: LoadedFile[]): ScoreData => {
    if (files.length === 0) {
      return {
        title: 'Empty Score',
        parts: [],
        tempos: [],
        durationInSeconds: 0,
        clicks: [],
        cursorPositions: [],
      };
    }

    const baseline = files[0].scoreData;
    const mergedParts: PartData[] = [];
    files.forEach((file) => {
      file.scoreData.parts.forEach((part) => {
        mergedParts.push({
          ...part,
          id: `${file.id}::${part.id}`, // Globally unique part ID
        });
      });
    });

    const maxDuration = Math.max(...files.map(f => f.scoreData.durationInSeconds));

    return {
      title: files.length > 1 ? `Combined Score (${files.length} parts)` : baseline.title,
      parts: mergedParts,
      tempos: baseline.tempos,
      clicks: baseline.clicks,
      durationInSeconds: maxDuration,
      cursorPositions: baseline.cursorPositions,
      initialTimeSignature: baseline.initialTimeSignature,
    };
  };

  // Helper to initialize playback controls, load instruments, and schedule
  const processLoadedFiles = async (parsedFiles: LoadedFile[]) => {
    setIsPlaying(false);
    audioEngine.stop();
    audioEngine.cancelPlayback();
    setPlaybackProgress(0);

    setLoadedFiles(parsedFiles);
    setSelectedFileIndex(0);

    const unified = buildUnifiedScoreData(parsedFiles);
    setUnifiedScoreData(unified);

    // Build all practice parts list
    const allParts: PracticePart[] = [];
    parsedFiles.forEach((file) => {
      file.scoreData.parts.forEach((part) => {
        allParts.push({
          fileId: file.id,
          partIdInFile: part.id,
          audioPartId: `${file.id}::${part.id}`,
          name: part.name,
          group: getInstrumentGroup(part.name),
          soundfontInstrument: part.soundfontInstrument,
        });
      });
    });

    if (allParts.length > 0) {
      setSelectedPracticePart(allParts[0]);
    }

    // Now start loading soundfonts for the unified track
    setIsLoadingInstruments(true);
    setLoadingProgress(0);
    setZipParsingStatus('Loading backing instrument samples...');

    try {
      await audioEngine.loadInstruments(unified, (progress) => {
        setLoadingProgress(progress);
      });
      lastLoadedCatalogRef.current = soundfontCatalog;
      setIsLoadingInstruments(false);
      setZipParsingStatus('');
      audioEngine.scheduleScore(unified, false, allParts.length > 0 ? allParts[0].audioPartId : '', countInEnabled);
      
      // Apply muting states immediately since scheduleScore resets volume nodes
      unified.parts.forEach((part) => {
        const isMuted = backingTrackMode === 'solo'
          ? (allParts.length > 0 ? allParts[0].audioPartId : '') !== part.id
          : !!customMutedPartIds[part.id];
        audioEngine.setPartMuted(part.id, isMuted);
      });
      
      setFileLoaded(true);
    } catch (err) {
      console.error("Error loading instruments", err);
      setIsLoadingInstruments(false);
      setZipParsingStatus('Failed to load instrument samples.');
    }
  };

  useEffect(() => {
    if (unifiedScoreData && fileLoaded) {
      audioEngine.scheduleScore(unifiedScoreData, false, selectedPracticePart?.audioPartId || '', countInEnabled);
      // Apply muting states immediately since scheduleScore resets volume nodes
      unifiedScoreData.parts.forEach((part) => {
        const isMuted = backingTrackModeRef.current === 'solo'
          ? selectedPracticePart?.audioPartId !== part.id
          : !!customMutedPartIdsRef.current[part.id];
        audioEngine.setPartMuted(part.id, isMuted);
      });
    }
  }, [selectedPracticePart, unifiedScoreData, fileLoaded, audioEngine, countInEnabled]);

  // 5. Initialize custom mix muting state to match minus-one mode by default
  useEffect(() => {
    if (backingTrackMode === 'custom' && selectedPracticePart && Object.keys(customMutedPartIds).length === 0) {
      setCustomMutedPartIds({
        [selectedPracticePart.audioPartId]: true
      });
    }
  }, [backingTrackMode, selectedPracticePart, customMutedPartIds]);

  // 4. File Upload Logic
  const handleFileUpload = async (file: File) => {
    // Reset states
    setIsPlaying(false);
    audioEngine.stop();
    audioEngine.cancelPlayback();
    setPlaybackProgress(0);
    setFileLoaded(false);
    setBackingTrackMode('custom');
    setCustomMutedPartIds({});

    const isMxl = file.name.endsWith('.mxl');
    const isZip = file.name.endsWith('.zip');

    if (isZip) {
      setIsLoadingInstruments(true);
      setLoadingProgress(0);
      setZipParsingStatus('Extracting ZIP contents...');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result;
          if (!result) return;

          const zip = await JSZip.loadAsync(result as ArrayBuffer);
          const xmlFiles = Object.keys(zip.files).filter((name) => {
            const lower = name.toLowerCase();
            return (lower.endsWith('.xml') || lower.endsWith('.musicxml') || lower.endsWith('.mxl')) && !name.includes('__MACOSX');
          });

          if (xmlFiles.length === 0) {
            alert('No valid MusicXML or MXL files found in ZIP.');
            setIsLoadingInstruments(false);
            setZipParsingStatus('');
            return;
          }

          const parsedFiles: LoadedFile[] = [];
          for (let i = 0; i < xmlFiles.length; i++) {
            const fileName = xmlFiles[i];
            const baseName = fileName.split('/').pop() || fileName;
            setZipParsingStatus(`Parsing ${baseName} (${i + 1}/${xmlFiles.length})...`);
            setLoadingProgress((i + 0.1) / xmlFiles.length);

            const fileEntry = zip.files[fileName];
            const isEntryMxl = fileName.toLowerCase().endsWith('.mxl');
            
            let fileContent: string | Uint8Array;
            if (isEntryMxl) {
              fileContent = await fileEntry.async('uint8array');
            } else {
              fileContent = await fileEntry.async('string');
            }

            try {
              const scoreData = await parseXmlOffscreen(fileContent, isEntryMxl);
              parsedFiles.push({
                id: `zip_file_${i}_${Date.now()}`,
                name: baseName,
                xmlData: fileContent,
                isMxl: isEntryMxl,
                scoreData,
              });
            } catch (err) {
              console.error(`Error parsing file ${baseName}:`, err);
            }
          }

          if (parsedFiles.length === 0) {
            alert('Failed to parse any parts in the ZIP archive.');
            setIsLoadingInstruments(false);
            setZipParsingStatus('');
            return;
          }

          await processLoadedFiles(parsedFiles);
        } catch (err) {
          console.error('Error handling zip extraction:', err);
          alert('Failed to process ZIP file.');
          setIsLoadingInstruments(false);
          setZipParsingStatus('');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Single XML or MXL file
      setIsLoadingInstruments(true);
      setLoadingProgress(0);
      setZipParsingStatus(`Parsing ${file.name}...`);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const result = e.target?.result;
          if (!result) return;

          let fileContent: string | Uint8Array;
          if (isMxl) {
            fileContent = new Uint8Array(result as ArrayBuffer);
          } else {
            fileContent = result as string;
          }

          const scoreData = await parseXmlOffscreen(fileContent, isMxl);
          const loadedFile: LoadedFile = {
            id: `single_file_${Date.now()}`,
            name: file.name,
            xmlData: fileContent,
            isMxl,
            scoreData,
          };

          await processLoadedFiles([loadedFile]);
        } catch (err) {
          console.error('Error parsing uploaded file:', err);
          alert('Failed to parse MusicXML file.');
          setIsLoadingInstruments(false);
          setZipParsingStatus('');
        }
      };

      if (isMxl) {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    }
  };

  // 5. Playback Handlers
  const handlePlayPause = async () => {
    if (isPlaying) {
      audioEngine.pause(backingTrackMode === 'solo' ? 'solo_run' : 'custom_run');
      setIsPlaying(false);
    } else {
      await audioEngine.start();
      setIsPlaying(true);
    }
  };

  const handleStop = () => {
    audioEngine.stop(backingTrackMode === 'solo' ? 'solo_run' : 'custom_run');
    setIsPlaying(false);
    setPlaybackProgress(0);
  };

  // 6. Pre-load Demo Score
  const loadDemoScore = async () => {
    try {
      setIsPlaying(false);
      audioEngine.stop();
      audioEngine.cancelPlayback();
      setPlaybackProgress(0);
      setFileLoaded(false);
      setBackingTrackMode('custom');
      setCustomMutedPartIds({});

      const response = await fetch('/Ode_To_Joy_Demo.musicxml');
      if (!response.ok) {
        throw new Error('Failed to load demo score file.');
      }
      const text = await response.text();
      
      setIsLoadingInstruments(true);
      setLoadingProgress(0);
      setZipParsingStatus('Parsing demo score...');
      
      const parsedData = await parseXmlOffscreen(text, false);
      const demoFile: LoadedFile = {
        id: 'demo_score',
        name: 'Ode_To_Joy_Demo.musicxml',
        xmlData: text,
        isMxl: false,
        scoreData: parsedData,
      };
      
      await processLoadedFiles([demoFile]);
    } catch (err) {
      console.error('Error fetching demo score', err);
      setIsLoadingInstruments(false);
      setZipParsingStatus('');
    }
  };

  const loadYorkshireBallad = async () => {
    try {
      setIsPlaying(false);
      audioEngine.stop();
      audioEngine.cancelPlayback();
      setPlaybackProgress(0);
      setFileLoaded(false);
      setBackingTrackMode('custom');
      setCustomMutedPartIds({});

      const response = await fetch('/yorkshire-ballad-james-barnesFULLSCORE.musicxml');
      if (!response.ok) {
        throw new Error('Failed to load Yorkshire Ballad score.');
      }
      const text = await response.text();
      
      setIsLoadingInstruments(true);
      setLoadingProgress(0);
      setZipParsingStatus('Parsing Yorkshire Ballad...');
      
      const parsedData = await parseXmlOffscreen(text, false);
      const demoFile: LoadedFile = {
        id: 'yorkshire_ballad',
        name: 'yorkshire-ballad-james-barnesFULLSCORE.musicxml',
        xmlData: text,
        isMxl: false,
        scoreData: parsedData,
      };
      
      await processLoadedFiles([demoFile]);
    } catch (err) {
      console.error('Error fetching Yorkshire Ballad score', err);
      setIsLoadingInstruments(false);
      setZipParsingStatus('');
    }
  };

  const handlePracticePartSelect = (part: PracticePart) => {
    setSelectedPracticePart(part);
    // Find file index for this part and set it to display in SheetMusicViewer
    const fileIndex = loadedFiles.findIndex(f => f.id === part.fileId);
    if (fileIndex !== -1) {
      setSelectedFileIndex(fileIndex);
    }
  };

  const handleCustomMuteToggle = (audioPartId: string) => {
    setCustomMutedPartIds((prev) => ({
      ...prev,
      [audioPartId]: !prev[audioPartId],
    }));
  };

  const handleCustomMuteGroupToggle = (group: string, mute: boolean) => {
    if (!unifiedScoreData) return;
    
    // Find all parts in this group across all loaded files
    const groupPartIds = loadedFiles.flatMap(file => 
      file.scoreData.parts
        .filter(part => getInstrumentGroup(part.name) === group)
        .map(part => `${file.id}::${part.id}`)
    );

    setCustomMutedPartIds((prev) => {
      const updated = { ...prev };
      groupPartIds.forEach((partId) => {
        updated[partId] = mute;
      });
      return updated;
    });
  };

  const handleCustomMuteAllToggle = (mute: boolean) => {
    if (!unifiedScoreData) return;
    
    const updated: Record<string, boolean> = {};
    unifiedScoreData.parts.forEach((part) => {
      updated[part.id] = mute;
    });
    setCustomMutedPartIds(updated);
  };

  return (
    <div className="min-h-screen bg-[#0a090f] text-white flex flex-col font-sans antialiased no-scrollbar pb-10">
      {/* Navbar Header */}
      <header className="border-b border-white/5 py-4 px-6 mb-8 bg-[#12111a]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-lg tracking-tight text-white">
              Score Follower
            </span>
          </div>

          {fileLoaded && (
            <div className="flex items-center gap-3 bg-[#1c1926] px-4 py-1.5 rounded-full border border-white/5 shadow-inner">
              <button
                onClick={handlePlayPause}
                disabled={isLoadingInstruments}
                className="w-7 h-7 rounded-full bg-brand hover:bg-brand-hover text-white transition flex items-center justify-center active:scale-95 cursor-pointer disabled:opacity-40"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 translate-x-0.5" />}
              </button>
              <button
                onClick={handleStop}
                className="w-7 h-7 rounded-full bg-[#12111a] hover:bg-[#252133] text-zinc-300 hover:text-white transition flex items-center justify-center active:scale-95 cursor-pointer border border-white/5"
                title="Stop and Rewind"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
              <div className="h-4 w-px bg-white/10" />
              <span className="font-mono text-xs font-bold text-brand tracking-wide">
                {Math.floor(Math.max(0, playbackProgress) / 60)}:
                {String(Math.floor(Math.max(0, playbackProgress) % 60)).padStart(2, '0')}
                <span className="text-text-secondary font-medium ml-1">
                  / {Math.floor((selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData.durationInSeconds : 0) / 60)}:
                  {String(Math.floor((selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData.durationInSeconds : 0) % 60)).padStart(2, '0')}
                </span>
              </span>
            </div>
          )}
        </div>
      </header>

      {/* Main Body Grid */}
      <main className="flex-grow max-w-6xl w-full mx-auto px-4 flex flex-col gap-8">
        
        {/* Loader/Uploader when no files are parsed */}
        {!fileLoaded && (
          <div className="clean-panel text-center max-w-2xl mx-auto p-10 flex flex-col gap-6 items-center my-auto">
            <div className="bg-brand-bg w-16 h-16 rounded-2xl flex items-center justify-center border border-brand-border shadow-xl shadow-brand/5">
              <Music className="w-8 h-8 text-brand animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white mb-2">
                Wind Band Practice Assistant
              </h1>
              <p className="text-text-secondary text-sm max-w-md">
                Upload a ZIP folder containing multiple MusicXML parts, or a single MusicXML/MXL score, to build your customizable backing track.
              </p>
            </div>

            {/* Parsing/Loading Status Overlay */}
            {isLoadingInstruments && zipParsingStatus && (
              <div className="w-full bg-brand-bg border border-brand-border rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-brand">{zipParsingStatus}</span>
                  <span className="text-brand font-mono">{Math.round(loadingProgress * 100)}%</span>
                </div>
                <div className="w-full bg-panel-light h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-brand h-full transition-all duration-300 animate-pulse"
                    style={{ width: `${loadingProgress * 100}%` }}
                  />
                </div>
              </div>
            )}

            {!isLoadingInstruments && (
              <div className="flex flex-col sm:flex-row gap-3 w-full justify-center">
                <button
                  onClick={loadDemoScore}
                  className="bg-brand hover:bg-brand-hover text-white transition font-bold px-6 py-3 rounded-xl shadow-lg active:scale-95 text-sm cursor-pointer"
                >
                  Load Demo Score
                </button>
                <button
                  onClick={loadYorkshireBallad}
                  className="bg-brand hover:bg-brand-hover text-white transition font-bold px-6 py-3 rounded-xl shadow-lg active:scale-95 text-sm cursor-pointer"
                >
                  Load Yorkshire Ballad
                </button>
                <label 
                  htmlFor="file-upload-init" 
                  className="bg-[#1c1926] hover:bg-[#252133] border border-white/5 transition font-bold px-6 py-3 rounded-xl active:scale-95 text-sm flex items-center justify-center gap-2 cursor-pointer text-zinc-200"
                >
                  Upload ZIP or XML
                </label>
                <input 
                  id="file-upload-init" 
                  type="file" 
                  accept=".xml,.musicxml,.mxl,.zip" 
                  className="hidden" 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Loaded app views */}
        {fileLoaded && (
          <div className="flex flex-col gap-8">
            {/* Top Section: Sidebar + Controls Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Sidebar (3 cols) */}
              <div className="lg:col-span-3 flex flex-col gap-6">
                {/* Score Info Card */}
                <div className="clean-panel p-5 flex flex-col gap-4">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Score</span>
                    <span className="bg-brand-bg text-brand px-2.5 py-0.5 rounded-md font-extrabold text-[10px] border border-brand-border uppercase">
                      {loadedFiles.length > 1 ? `${loadedFiles.length} Parts` : '1 Part'}
                    </span>
                  </div>
                  <div className="flex flex-col items-center text-center gap-3 py-2">
                    <div className="bg-brand-bg p-3 rounded-xl border border-brand-border">
                      <Music className="w-6 h-6 text-brand" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-white line-clamp-2 px-1">
                        {selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData.title : 'No Score'}
                      </h3>
                      <p className="text-xs text-text-secondary mt-1.5">
                        Duration: {Math.floor((selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData.durationInSeconds : 0) / 60)}:
                        {String(Math.floor((selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData.durationInSeconds : 0) % 60)).padStart(2, '0')}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Selected Practice Instrument Card */}
                <div className="clean-panel p-5 flex flex-col gap-4">
                  <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Practice Part</span>
                  
                  {/* Active highlight container (matches the design style in reference picture) */}
                  <div className="bg-[#1c1926] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                    <span className="text-[10px] font-extrabold tracking-wider text-brand uppercase mb-1.5">Active</span>
                    <div className="text-base font-black text-white px-1 leading-snug truncate max-w-full">
                      {selectedPracticePart ? selectedPracticePart.name : 'None'}
                    </div>
                    <span className="text-[10px] text-text-secondary mt-1.5 truncate max-w-full">
                      {selectedPracticePart?.soundfontInstrument || 'No sound'}
                    </span>
                  </div>
                  
                  {/* Select menu */}
                  <div className="flex flex-col gap-2 mt-1">
                    <span className="text-[10px] font-bold tracking-wider text-text-secondary uppercase">Change Part:</span>
                    <select 
                      value={selectedPracticePart ? selectedPracticePart.audioPartId : ''}
                      onChange={(e) => {
                        const allParts = loadedFiles.flatMap(file => 
                          file.scoreData.parts.map(part => ({
                            fileId: file.id,
                            partIdInFile: part.id,
                            audioPartId: `${file.id}::${part.id}`,
                            name: part.name,
                            group: getInstrumentGroup(part.name),
                            soundfontInstrument: part.soundfontInstrument
                          }))
                        );
                        const part = allParts.find(p => p.audioPartId === e.target.value);
                        if (part) handlePracticePartSelect(part);
                      }}
                      className="bg-[#1c1926] border border-white/5 hover:border-brand/20 transition rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-brand cursor-pointer w-full text-white"
                    >
                      {loadedFiles.flatMap(file => 
                        file.scoreData.parts.map(part => (
                          <option key={`${file.id}::${part.id}`} value={`${file.id}::${part.id}`}>
                            {part.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                </div>
              </div>

              {/* Right Column: Playback Controls (9 cols) */}
              <div className="lg:col-span-9">
                <PlaybackControls
                  viewedScoreData={selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData : null}
                  isPlaying={isPlaying}
                  playbackProgress={playbackProgress}
                  metronomeMuted={metronomeMuted}
                  metronomeVolume={metronomeVolume}
                  backingVolume={backingVolume}
                  soundfontCatalog={soundfontCatalog}
                  onSoundfontCatalogChange={setSoundfontCatalog}
                  countInEnabled={countInEnabled}
                  onCountInToggle={() => setCountInEnabled(!countInEnabled)}
                  backingTrackMode={backingTrackMode}
                  selectedPracticePart={selectedPracticePart}
                  allPracticeParts={
                    loadedFiles.flatMap(file => 
                      file.scoreData.parts.map(part => ({
                        fileId: file.id,
                        partIdInFile: part.id,
                        audioPartId: `${file.id}::${part.id}`,
                        name: part.name,
                        group: getInstrumentGroup(part.name),
                        soundfontInstrument: part.soundfontInstrument
                      }))
                    )
                  }
                  customMutedPartIds={customMutedPartIds}
                  isLoadingInstruments={isLoadingInstruments}
                  loadingProgress={loadingProgress}
                  zipParsingStatus={zipParsingStatus}
                  onFileUpload={handleFileUpload}
                  onPlayPause={handlePlayPause}
                  onStop={handleStop}
                  onMetronomeMuteToggle={() => setMetronomeMuted(!metronomeMuted)}
                  onMetronomeVolumeChange={setMetronomeVolume}
                  onBackingVolumeChange={setBackingVolume}
                  onBackingTrackModeChange={setBackingTrackMode}
                  onCustomMuteToggle={handleCustomMuteToggle}
                  onCustomMuteGroupToggle={handleCustomMuteGroupToggle}
                  onCustomMuteAllToggle={handleCustomMuteAllToggle}
                />
              </div>
            </div>

            <SheetMusicViewer
              xmlData={selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].xmlData as any : null}
              scoreData={selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].scoreData : null}
              playbackProgress={playbackProgress}
              isPlaying={isPlaying}
              selectedPartId={selectedPracticePart ? selectedPracticePart.partIdInFile : ''}
              onOsmdInit={() => {}}
              onSeek={(seconds) => {
                audioEngine.seek(seconds);
                setPlaybackProgress(seconds);
              }}
              backingTrackMode={backingTrackMode}
              customMutedPartIds={customMutedPartIds}
              viewedFileId={selectedFileIndex >= 0 ? loadedFiles[selectedFileIndex].id : ''}
              countInEnabled={countInEnabled}
            />
          </div>
        )}
      </main>

      {/* Footer footer */}
      <footer className="mt-16 border-t border-white/5 py-6 text-center text-xs text-text-muted">
        <div className="max-w-6xl mx-auto flex items-center justify-center gap-1">
          Made with <Heart className="w-3.5 h-3.5 text-brand fill-brand/20" /> for Wind Ensembles
        </div>
      </footer>
    </div>
  );
}

export default App;
