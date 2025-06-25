import { EnvelopeComputer } from "./EnvelopeComputer";
import { DynamicBiquadFilter } from "./filtering";
import { PickedString } from "./InstrumentState";
import { Note } from "./Pattern";
import { Config, OperatorWave } from "./SynthConfig";

export class Tone {
    instrumentIndex: number;
    readonly pitches: number[] = Array(Config.maxChordSize + 2).fill(0);
    pitchCount = 0;
    chordSize = 0;
    drumsetPitch: number | null = null;
    note: Note | null = null;
    prevNote: Note | null = null;
    nextNote: Note | null = null;
    prevNotePitchIndex = 0;
    nextNotePitchIndex = 0;
    freshlyAllocated = true;
    atNoteStart = false;
    isOnLastTick = false; // Whether the tone is finished fading out and ready to be freed.
    passedEndOfNote = false;
    forceContinueAtStart = false;
    forceContinueAtEnd = false;
    noteStartPart = 0;
    noteEndPart = 0;
    ticksSinceReleased = 0;
    liveInputSamplesHeld = 0;
    lastInterval = 0;
    chipWaveStartOffset = 0;
    noiseSample = 0.0;
    noiseSampleA = 0.0;
    noiseSampleB = 0.0;
    stringSustainStart = 0;
    stringSustainEnd = 0;
    readonly noiseSamples: number[] = [];
    readonly phases: number[] = [];
    readonly operatorWaves: OperatorWave[] = [];
    readonly phaseDeltas: number[] = [];
    // advloop addition
    directions: number[] = [];
    chipWaveCompletions: number[] = [];
    chipWavePrevWavesL: number[] = [];
    chipWavePrevWavesR: number[] = [];
    chipWaveCompletionsLastWaveL: number[] = [];
    chipWaveCompletionsLastWaveR: number[] = [];
    // advloop addition
    readonly phaseDeltaScales: number[] = [];
    expression = 0.0;
    expressionDelta = 0.0;
    readonly operatorExpressions: number[] = [];
    readonly operatorExpressionDeltas: number[] = [];
    readonly prevPitchExpressions: Array<number | null> = Array(Config.maxPitchOrOperatorCount).fill(null);
    prevVibrato: number | null = null;
    prevStringDecay: number | null = null;
    pulseWidth = 0.0;
    pulseWidthDelta = 0.0;
    decimalOffset = 0.0;
    supersawDynamism = 0.0;
    supersawDynamismDelta = 0.0;
    supersawUnisonDetunes: number[] = []; // These can change over time, but slowly enough that I'm not including corresponding delta values within a tick run.
    supersawShape = 0.0;
    supersawShapeDelta = 0.0;
    supersawDelayLength = 0.0;
    supersawDelayLengthDelta = 0.0;
    supersawDelayLine: Float32Array | null = null;
    supersawDelayIndex = -1;
    supersawPrevPhaseDelta: number | null = null;
    readonly pickedStrings: PickedString[] = [];

    readonly noteFiltersL: DynamicBiquadFilter[] = [];
    readonly noteFiltersR: DynamicBiquadFilter[] = [];
    noteFilterCount = 0;
    initialNoteFilterInputL1 = 0.0;
    initialNoteFilterInputR1 = 0.0;
    initialNoteFilterInputL2 = 0.0;
    initialNoteFilterInputR2 = 0.0;

    specialIntervalExpressionMult = 1.0;
    readonly feedbackOutputs: number[] = [];
    feedbackMult = 0.0;
    feedbackDelta = 0.0;
    stereoVolumeLStart = 0.0;
    stereoVolumeRStart = 0.0;
    stereoVolumeLDelta = 0.0;
    stereoVolumeRDelta = 0.0;
    stereoDelayStart = 0.0;
    stereoDelayEnd = 0.0;
    stereoDelayDelta = 0.0;
    customVolumeStart = 0.0;
    customVolumeEnd = 0.0;
    filterResonanceStart = 0.0;
    filterResonanceDelta = 0.0;
    isFirstOrder = false;

    readonly envelopeComputer = new EnvelopeComputer( /*true*/);

    constructor() {
        this.reset();
    }

    reset(): void {
        // this.noiseSample = 0.0;
        for (let i = 0; i < Config.unisonVoicesMax; i++) {
            this.noiseSamples[i] = 0.0;
        }
        for (let i = 0; i < Config.maxPitchOrOperatorCount; i++) {
            this.phases[i] = 0.0;
            // advloop addition
            this.directions[i] = 1;
            this.chipWaveCompletions[i] = 0;
            this.chipWavePrevWavesL[i] = 0;
            this.chipWavePrevWavesR[i] = 0;
            this.chipWaveCompletionsLastWaveL[i] = 0;
            this.chipWaveCompletionsLastWaveR[i] = 0;
            // advloop addition
            this.operatorWaves[i] = Config.operatorWaves[0];
            this.feedbackOutputs[i] = 0.0;
            this.prevPitchExpressions[i] = null;
        }
        for (let i = 0; i < this.noteFilterCount; i++) {
            this.noteFiltersL[i].resetOutput();
            this.noteFiltersR[i].resetOutput();
        }
        this.noteFilterCount = 0;
        this.initialNoteFilterInputL1 = 0.0;
        this.initialNoteFilterInputR1 = 0.0;
        this.initialNoteFilterInputL2 = 0.0;
        this.initialNoteFilterInputR2 = 0.0;
        this.liveInputSamplesHeld = 0;
        this.supersawDelayIndex = -1;
        for (const pickedString of this.pickedStrings) {
            pickedString.reset();
        }
        this.envelopeComputer.reset();
        this.prevVibrato = null;
        this.prevStringDecay = null;
        this.supersawPrevPhaseDelta = null;
        this.drumsetPitch = null;
    }
}
