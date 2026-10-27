// Core Architecture & Session
export * from './core/base/BaseStrategy';
export * from './core/controllers/FadingController';
export * from './core/controllers/StrategyScaffoldController';
export * from './core/session/StrategySession';
export * from './core/types/strategy';
export * from './core/types/fading';
export * from './core/types/referral';

// Agent & Router
export * from './agent/StrategiesAgent';
export * from './agent/ClassificationRouter';

// Rhythm Classification
export * from './classifications/rhythm/agent/RhythmStrategiesAgent';
export * from './classifications/rhythm/selector/RhythmStrategySelector';
export * from './classifications/rhythm/registry/RhythmStrategyRegistry';
export * from './classifications/rhythm/types/rhythmStrategy';
export * from './classifications/rhythm/types/capacities';
export * from './classifications/rhythm/types/signatures';
export type {
  AssistanceConfig,
  PerformanceMetrics,
  RecommendationRecord
} from './classifications/rhythm/types/aipcStrategy';

// Scaffolds & Audio/Notation Engines
export * from './classifications/rhythm/scaffolds/rhythmEngine';
export * from './classifications/rhythm/scaffolds/playbackSession';
export * from './classifications/rhythm/scaffolds/measureExtractor';
export * from './classifications/rhythm/scaffolds/musicXmlTransforms';
export * from './classifications/rhythm/scaffolds/rhythmHelper';
export * from './classifications/rhythm/scaffolds/audioInputManager';
export * from './classifications/rhythm/scaffolds/clickAudioGenerator';
export * from './classifications/rhythm/scaffolds/StrategyAudioPlayer';
export * from './classifications/rhythm/scaffolds/VexFlowRenderer';

// UI Components
export * from './AipcStrategyCoachModal';
export * from './components/StudentChatCompanion';
export * from './components/InstrumentMascot';

// Student Chat & Pedagogical Language
export * from './chat/types';
export * from './chat/studentStrategyLanguage';
export * from './chat/StudentIntentHandler';
export * from './chat/StudentMessageComposer';
