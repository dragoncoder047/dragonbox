// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Deque } from "./Deque";
import { EffectState } from "./EffectState";
import { EnvelopeComputer } from "./EnvelopeComputer";
import { inverseRealFourierTransform, scaleElementsByFactor } from "./FFT";
import { warpInfinityToNyquist } from "./filtering";
import { HarmonicsWave, Instrument, SpectrumWave } from "./Instrument";
import { Synth } from "./synth";
import { Chord, Config, drawNoiseSpectrum, EffectType, EnvelopeComputeIndex, getDrumWave, InstrumentType, performIntegralOld, SustainType, Unison } from "./SynthConfig";
import { Tone } from "./Tone";
import { fittingPowerOfTwo } from "./utils";

export class SpectrumWaveState {
    wave: Float32Array | null = null;
    private _hash = -1;

    getCustomWave(settings: SpectrumWave, lowestOctave: number): Float32Array {
        if (this._hash == settings.hash) return this.wave!;
        this._hash = settings.hash;

        const waveLength = Config.spectrumNoiseLength;
        if (this.wave == null || this.wave.length != waveLength + 1) {
            this.wave = new Float32Array(waveLength + 1);
        }
        const wave: Float32Array = this.wave;

        for (let i = 0; i < waveLength; i++) {
            wave[i] = 0;
        }

        const highestOctave = 14;
        const falloffRatio = 0.25;
        // Nudge the 2/7 and 4/7 control points so that they form harmonic intervals.
        const pitchTweak: number[] = [0, 1 / 7, Math.log2(5 / 4), 3 / 7, Math.log2(3 / 2), 5 / 7, 6 / 7];
        function controlPointToOctave(point: number): number {
            return lowestOctave + Math.floor(point / Config.spectrumControlPointsPerOctave) + pitchTweak[(point + Config.spectrumControlPointsPerOctave) % Config.spectrumControlPointsPerOctave];
        }

        let combinedAmplitude = 1;
        for (let i = 0; i < Config.spectrumControlPoints + 1; i++) {
            const value1 = (i <= 0) ? 0 : settings.spectrum[i - 1];
            const value2 = (i >= Config.spectrumControlPoints) ? settings.spectrum[Config.spectrumControlPoints - 1] : settings.spectrum[i];
            const octave1 = controlPointToOctave(i - 1);
            let octave2 = controlPointToOctave(i);
            if (i >= Config.spectrumControlPoints) octave2 = highestOctave + (octave2 - highestOctave) * falloffRatio;
            if (value1 == 0 && value2 == 0) continue;

            combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, octave1, octave2, value1 / Config.spectrumMax, value2 / Config.spectrumMax, -0.5);
        }
        if (settings.spectrum[Config.spectrumControlPoints - 1] > 0) {
            combinedAmplitude += 0.02 * drawNoiseSpectrum(wave, waveLength, highestOctave + (controlPointToOctave(Config.spectrumControlPoints) - highestOctave) * falloffRatio, highestOctave, settings.spectrum[Config.spectrumControlPoints - 1] / Config.spectrumMax, 0, -0.5);
        }

        inverseRealFourierTransform(wave, waveLength);
        scaleElementsByFactor(wave, 5.0 / (Math.sqrt(waveLength) * Math.pow(combinedAmplitude, 0.75)));

        // Duplicate the first sample at the end for easier wrap-around interpolation.
        wave[waveLength] = wave[0];

        return wave;
    }
}

export class HarmonicsWaveState {
    wave: Float32Array | null = null;
    private _hash = -1;
    private _generatedForType: InstrumentType;

    getCustomWave(settings: HarmonicsWave, instrumentType: InstrumentType): Float32Array {
        if (this._hash == settings.hash && this._generatedForType == instrumentType) return this.wave!;
        this._hash = settings.hash;
        this._generatedForType = instrumentType;

        const harmonicsRendered = (instrumentType == InstrumentType.pickedString) ? Config.harmonicsRenderedForPickedString : Config.harmonicsRendered;

        const waveLength = Config.harmonicsWavelength;
        const retroWave: Float32Array = getDrumWave(0, null, null);

        if (this.wave == null || this.wave.length != waveLength + 1) {
            this.wave = new Float32Array(waveLength + 1);
        }
        const wave: Float32Array = this.wave;

        for (let i = 0; i < waveLength; i++) {
            wave[i] = 0;
        }

        const overallSlope = -0.25;
        let combinedControlPointAmplitude = 1;

        for (let harmonicIndex = 0; harmonicIndex < harmonicsRendered; harmonicIndex++) {
            const harmonicFreq = harmonicIndex + 1;
            let controlValue = harmonicIndex < Config.harmonicsControlPoints ? settings.harmonics[harmonicIndex] : settings.harmonics[Config.harmonicsControlPoints - 1];
            if (harmonicIndex >= Config.harmonicsControlPoints) {
                controlValue *= 1 - (harmonicIndex - Config.harmonicsControlPoints) / (harmonicsRendered - Config.harmonicsControlPoints);
            }
            const normalizedValue = controlValue / Config.harmonicsMax;
            let amplitude = Math.pow(2, controlValue - Config.harmonicsMax + 1) * Math.sqrt(normalizedValue);
            if (harmonicIndex < Config.harmonicsControlPoints) {
                combinedControlPointAmplitude += amplitude;
            }
            amplitude *= Math.pow(harmonicFreq, overallSlope);

            // Multiply all the sine wave amplitudes by 1 or -1 based on the LFSR
            // retro wave (effectively random) to avoid egregiously tall spikes.
            amplitude *= retroWave[harmonicIndex + 589];

            wave[waveLength - harmonicFreq] = amplitude;
        }

        inverseRealFourierTransform(wave, waveLength);

        // Limit the maximum wave amplitude.
        const mult = 1 / Math.pow(combinedControlPointAmplitude, 0.7);
        for (let i = 0; i < wave.length; i++) wave[i] *= mult;

        performIntegralOld(wave);

        // The first sample should be zero, and we'll duplicate it at the end for easier interpolation.
        wave[waveLength] = wave[0];

        return wave;
    }
}

export class PickedString {
    delayLine: Float32Array | null = null;
    delayIndex: number;
    allPassSample: number;
    allPassPrevInput: number;
    sustainFilterSample: number;
    sustainFilterPrevOutput2: number;
    sustainFilterPrevInput1: number;
    sustainFilterPrevInput2: number;
    fractionalDelaySample: number;
    prevDelayLength: number;
    delayLengthDelta: number;
    delayResetOffset: number;

    allPassG = 0.0;
    allPassGDelta = 0.0;
    sustainFilterA1 = 0.0;
    sustainFilterA1Delta = 0.0;
    sustainFilterA2 = 0.0;
    sustainFilterA2Delta = 0.0;
    sustainFilterB0 = 0.0;
    sustainFilterB0Delta = 0.0;
    sustainFilterB1 = 0.0;
    sustainFilterB1Delta = 0.0;
    sustainFilterB2 = 0.0;
    sustainFilterB2Delta = 0.0;

    constructor() {
        this.reset();
    }

    reset(): void {
        this.delayIndex = -1;
        this.allPassSample = 0.0;
        this.allPassPrevInput = 0.0;
        this.sustainFilterSample = 0.0;
        this.sustainFilterPrevOutput2 = 0.0;
        this.sustainFilterPrevInput1 = 0.0;
        this.sustainFilterPrevInput2 = 0.0;
        this.fractionalDelaySample = 0.0;
        this.prevDelayLength = -1.0;
        this.delayResetOffset = 0;
    }

    update(synth: Synth, instrumentState: InstrumentState, tone: Tone, stringIndex: number, roundedSamplesPerTick: number, stringDecayStart: number, stringDecayEnd: number, sustainType: SustainType): void {
        const allPassCenter = 2.0 * Math.PI * Config.pickedStringDispersionCenterFreq / synth.samplesPerSecond;

        const prevDelayLength = this.prevDelayLength;

        const phaseDeltaStart = tone.phaseDeltas[stringIndex];
        const phaseDeltaScale = tone.phaseDeltaScales[stringIndex];
        const phaseDeltaEnd = phaseDeltaStart * Math.pow(phaseDeltaScale, roundedSamplesPerTick);

        const radiansPerSampleStart = Math.PI * 2.0 * phaseDeltaStart;
        const radiansPerSampleEnd = Math.PI * 2.0 * phaseDeltaEnd;

        const centerHarmonicStart = radiansPerSampleStart * 2.0;
        const centerHarmonicEnd = radiansPerSampleEnd * 2.0;

        const allPassRadiansStart = Math.min(Math.PI, radiansPerSampleStart * Config.pickedStringDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleStart, Config.pickedStringDispersionFreqScale));
        const allPassRadiansEnd = Math.min(Math.PI, radiansPerSampleEnd * Config.pickedStringDispersionFreqMult * Math.pow(allPassCenter / radiansPerSampleEnd, Config.pickedStringDispersionFreqScale));
        const shelfRadians = 2.0 * Math.PI * Config.pickedStringShelfHz / synth.samplesPerSecond;
        const decayCurveStart = (Math.pow(100.0, stringDecayStart) - 1.0) / 99.0;
        const decayCurveEnd = (Math.pow(100.0, stringDecayEnd  ) - 1.0) / 99.0;
        const register = sustainType == SustainType.acoustic ? 0.25 : 0.0;
        const registerShelfCenter = 15.6;
        const registerLowpassCenter = 3.0 * synth.samplesPerSecond / 48000;
        //const decayRateStart = Math.pow(0.5, decayCurveStart * shelfRadians / radiansPerSampleStart);
        //const decayRateEnd = Math.pow(0.5, decayCurveEnd   * shelfRadians / radiansPerSampleEnd);
        const decayRateStart = Math.pow(0.5, decayCurveStart * Math.pow(shelfRadians / (radiansPerSampleStart * registerShelfCenter), (1.0 + 2.0 * register)) * registerShelfCenter);
        const decayRateEnd = Math.pow(0.5, decayCurveEnd   * Math.pow(shelfRadians / (radiansPerSampleEnd   * registerShelfCenter), (1.0 + 2.0 * register)) * registerShelfCenter);

        const expressionDecayStart = Math.pow(decayRateStart, 0.002);
        const expressionDecayEnd = Math.pow(decayRateEnd, 0.002);

        Synth.tempFilterStartCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansStart);
        synth.tempFrequencyResponse.analyze(Synth.tempFilterStartCoefficients, centerHarmonicStart);
        const allPassGStart = Synth.tempFilterStartCoefficients.b[0]; /* same as a[1] */
        const allPassPhaseDelayStart = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;

        Synth.tempFilterEndCoefficients.allPass1stOrderInvertPhaseAbove(allPassRadiansEnd);
        synth.tempFrequencyResponse.analyze(Synth.tempFilterEndCoefficients, centerHarmonicEnd);
        const allPassGEnd = Synth.tempFilterEndCoefficients.b[0]; /* same as a[1] */
        const allPassPhaseDelayEnd = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;

        // 1st order shelf filters and 2nd order lowpass filters have differently shaped frequency
        // responses, as well as adjustable shapes. I originally picked a 1st order shelf filter,
        // but I kinda prefer 2nd order lowpass filters now and I designed a couple settings:
        const enum PickedStringBrightnessType {
            bright, // 1st order shelf
            normal, // 2nd order lowpass, rounded corner
            resonant, // 3rd order lowpass, harder corner
        }
        const brightnessType = <any> sustainType == SustainType.bright ? PickedStringBrightnessType.bright : PickedStringBrightnessType.normal;
        if (brightnessType == PickedStringBrightnessType.bright) {
            const shelfGainStart = Math.pow(decayRateStart, Config.stringDecayRate);
            const shelfGainEnd = Math.pow(decayRateEnd,   Config.stringDecayRate);
            Synth.tempFilterStartCoefficients.highShelf2ndOrder(shelfRadians, shelfGainStart, 0.5);
            Synth.tempFilterEndCoefficients.highShelf2ndOrder(shelfRadians, shelfGainEnd, 0.5);
        } else {
            const cornerHardness = Math.pow(brightnessType == PickedStringBrightnessType.normal ? 0.0 : 1.0, 0.25);
            const lowpass1stOrderCutoffRadiansStart = Math.pow(registerLowpassCenter * registerLowpassCenter * radiansPerSampleStart * 3.3 * 48000 / synth.samplesPerSecond, 0.5 + register) / registerLowpassCenter / Math.pow(decayCurveStart, .5);
            const lowpass1stOrderCutoffRadiansEnd = Math.pow(registerLowpassCenter * registerLowpassCenter * radiansPerSampleEnd   * 3.3 * 48000 / synth.samplesPerSecond, 0.5 + register) / registerLowpassCenter / Math.pow(decayCurveEnd,   .5);
            const lowpass2ndOrderCutoffRadiansStart = lowpass1stOrderCutoffRadiansStart * Math.pow(2.0, 0.5 - 1.75 * (1.0 - Math.pow(1.0 - cornerHardness, 0.85)));
            const lowpass2ndOrderCutoffRadiansEnd = lowpass1stOrderCutoffRadiansEnd   * Math.pow(2.0, 0.5 - 1.75 * (1.0 - Math.pow(1.0 - cornerHardness, 0.85)));
            const lowpass2ndOrderGainStart = Math.pow(2.0, -Math.pow(2.0, -Math.pow(cornerHardness, 0.9)));
            const lowpass2ndOrderGainEnd = Math.pow(2.0, -Math.pow(2.0, -Math.pow(cornerHardness, 0.9)));
            Synth.tempFilterStartCoefficients.lowPass2ndOrderButterworth(warpInfinityToNyquist(lowpass2ndOrderCutoffRadiansStart), lowpass2ndOrderGainStart);
            Synth.tempFilterEndCoefficients  .lowPass2ndOrderButterworth(warpInfinityToNyquist(lowpass2ndOrderCutoffRadiansEnd),   lowpass2ndOrderGainEnd);
        }

        synth.tempFrequencyResponse.analyze(Synth.tempFilterStartCoefficients, centerHarmonicStart);
        const sustainFilterA1Start = Synth.tempFilterStartCoefficients.a[1];
        const sustainFilterA2Start = Synth.tempFilterStartCoefficients.a[2];
        const sustainFilterB0Start = Synth.tempFilterStartCoefficients.b[0] * expressionDecayStart;
        const sustainFilterB1Start = Synth.tempFilterStartCoefficients.b[1] * expressionDecayStart;
        const sustainFilterB2Start = Synth.tempFilterStartCoefficients.b[2] * expressionDecayStart;
        const sustainFilterPhaseDelayStart = -synth.tempFrequencyResponse.angle() / centerHarmonicStart;

        synth.tempFrequencyResponse.analyze(Synth.tempFilterEndCoefficients, centerHarmonicEnd);
        const sustainFilterA1End = Synth.tempFilterEndCoefficients.a[1];
        const sustainFilterA2End = Synth.tempFilterEndCoefficients.a[2];
        const sustainFilterB0End = Synth.tempFilterEndCoefficients.b[0] * expressionDecayEnd;
        const sustainFilterB1End = Synth.tempFilterEndCoefficients.b[1] * expressionDecayEnd;
        const sustainFilterB2End = Synth.tempFilterEndCoefficients.b[2] * expressionDecayEnd;
        const sustainFilterPhaseDelayEnd = -synth.tempFrequencyResponse.angle() / centerHarmonicEnd;

        const periodLengthStart = 1.0 / phaseDeltaStart;
        const periodLengthEnd = 1.0 / phaseDeltaEnd;
        const minBufferLength = Math.ceil(Math.max(periodLengthStart, periodLengthEnd) * 2);
        const delayLength = periodLengthStart - allPassPhaseDelayStart - sustainFilterPhaseDelayStart;
        const delayLengthEnd = periodLengthEnd - allPassPhaseDelayEnd - sustainFilterPhaseDelayEnd;

        this.prevDelayLength = delayLength;
        this.delayLengthDelta = (delayLengthEnd - delayLength) / roundedSamplesPerTick;
        this.allPassG = allPassGStart;
        this.sustainFilterA1 = sustainFilterA1Start;
        this.sustainFilterA2 = sustainFilterA2Start;
        this.sustainFilterB0 = sustainFilterB0Start;
        this.sustainFilterB1 = sustainFilterB1Start;
        this.sustainFilterB2 = sustainFilterB2Start;
        this.allPassGDelta = (allPassGEnd - allPassGStart) / roundedSamplesPerTick;
        this.sustainFilterA1Delta = (sustainFilterA1End - sustainFilterA1Start) / roundedSamplesPerTick;
        this.sustainFilterA2Delta = (sustainFilterA2End - sustainFilterA2Start) / roundedSamplesPerTick;
        this.sustainFilterB0Delta = (sustainFilterB0End - sustainFilterB0Start) / roundedSamplesPerTick;
        this.sustainFilterB1Delta = (sustainFilterB1End - sustainFilterB1Start) / roundedSamplesPerTick;
        this.sustainFilterB2Delta = (sustainFilterB2End - sustainFilterB2Start) / roundedSamplesPerTick;

        const pitchChanged = Math.abs(Math.log2(delayLength / prevDelayLength)) > 0.01;

        const reinitializeImpulse = (this.delayIndex == -1 || pitchChanged);
        if (this.delayLine == null || this.delayLine.length <= minBufferLength) {
            // The delay line buffer will get reused for other tones so might as well
            // start off with a buffer size that is big enough for most notes.
            const likelyMaximumLength = Math.ceil(2 * synth.samplesPerSecond / Instrument.frequencyFromPitch(12));
            const newDelayLine: Float32Array = new Float32Array(fittingPowerOfTwo(Math.max(likelyMaximumLength, minBufferLength)));
            if (!reinitializeImpulse && this.delayLine != null) {
                // If the tone has already started but the buffer needs to be reallocated,
                // transfer the old data to the new buffer.
                const oldDelayBufferMask = (this.delayLine.length - 1) >> 0;
                const startCopyingFromIndex = this.delayIndex + this.delayResetOffset;
                this.delayIndex = this.delayLine.length - this.delayResetOffset;
                for (let i = 0; i < this.delayLine.length; i++) {
                    newDelayLine[i] = this.delayLine[(startCopyingFromIndex + i) & oldDelayBufferMask];
                }
            }
            this.delayLine = newDelayLine;
        }
        const delayLine: Float32Array = this.delayLine;
        const delayBufferMask = (delayLine.length - 1) >> 0;

        if (reinitializeImpulse) {
            // -1 delay index means the tone was reset.
            // Also, if the pitch changed suddenly (e.g. from seamless or arpeggio) then reset the wave.

            this.delayIndex = 0;
            this.allPassSample = 0.0;
            this.allPassPrevInput = 0.0;
            this.sustainFilterSample = 0.0;
            this.sustainFilterPrevOutput2 = 0.0;
            this.sustainFilterPrevInput1 = 0.0;
            this.sustainFilterPrevInput2 = 0.0;
            this.fractionalDelaySample = 0.0;

            // Clear away a region of the delay buffer for the new impulse.
            const startImpulseFrom = -delayLength;
            const startZerosFrom = Math.floor(startImpulseFrom - periodLengthStart / 2);
            const stopZerosAt = Math.ceil(startZerosFrom + periodLengthStart * 2);
            this.delayResetOffset = stopZerosAt; // And continue clearing the area in front of the delay line.
            for (let i = startZerosFrom; i <= stopZerosAt; i++) {
                delayLine[i & delayBufferMask] = 0.0;
            }

            const impulseWave: Float32Array = instrumentState.waveL!;
            const impulseWaveLength = impulseWave.length - 1; // The first sample is duplicated at the end, don't double-count it.
            const impulsePhaseDelta = impulseWaveLength / periodLengthStart;

            const fadeDuration = Math.min(periodLengthStart * 0.2, synth.samplesPerSecond * 0.003);
            const startImpulseFromSample = Math.ceil(startImpulseFrom);
            const stopImpulseAt = startImpulseFrom + periodLengthStart + fadeDuration;
            const stopImpulseAtSample = stopImpulseAt;
            let impulsePhase = (startImpulseFromSample - startImpulseFrom) * impulsePhaseDelta;
            let prevWaveIntegral = 0.0;
            for (let i = startImpulseFromSample; i <= stopImpulseAtSample; i++) {
                const impulsePhaseInt = impulsePhase | 0;
                const index = impulsePhaseInt % impulseWaveLength;
                let nextWaveIntegral = impulseWave[index];
                const phaseRatio = impulsePhase - impulsePhaseInt;
                nextWaveIntegral += (impulseWave[index + 1] - nextWaveIntegral) * phaseRatio;
                const sample = (nextWaveIntegral - prevWaveIntegral) / impulsePhaseDelta;
                const fadeIn = Math.min(1.0, (i - startImpulseFrom) / fadeDuration);
                const fadeOut = Math.min(1.0, (stopImpulseAt - i) / fadeDuration);
                const combinedFade = fadeIn * fadeOut;
                const curvedFade = combinedFade * combinedFade * (3.0 - 2.0 * combinedFade); // A cubic sigmoid from 0 to 1.
                delayLine[i & delayBufferMask] += sample * curvedFade;
                prevWaveIntegral = nextWaveIntegral;
                impulsePhase += impulsePhaseDelta;
            }
        }
    }
}

export class InstrumentState {
    awake = false; // Whether the instrument's effects-processing loop should continue.
    computed = false; // Whether the effects-processing parameters are up-to-date for the current synth run.
    tonesAddedInThisTick = false; // Whether any instrument tones are currently active.
    flushingDelayLines = false; // If no tones were active recently, enter a mode where the delay lines are filled with zeros to reset them for later use.
    deactivateAfterThisTick = false; // Whether the instrument is ready to be deactivated because the delay lines, if any, are fully zeroed.
    attentuationProgress = 0.0; // How long since an active tone introduced an input signal to the delay lines, normalized from 0 to 1 based on how long to wait until the delay lines signal will have audibly dissapated.
    flushedSamples = 0; // How many delay line samples have been flushed to zero.
    readonly activeTones: Deque<Tone> = new Deque<Tone>();
    readonly activeModTones: Deque<Tone> = new Deque<Tone>();
    readonly releasedTones: Deque<Tone> = new Deque<Tone>(); // Tones that are in the process of fading out after the corresponding notes ended.
    readonly liveInputTones: Deque<Tone> = new Deque<Tone>(); // Tones that are initiated by a source external to the loaded song data.

    type = InstrumentType.chip;
    synthesizer: Function | null = null;
    waveL: Float32Array | null = null;
    waveR: Float32Array | null = null;
    isStereo = false; //this refers to whether or not the synth should be processed through the effect chain in mono or stereo...
    // advloop addition
    isUsingAdvancedLoopControls = false;
    chipWaveLoopStart = 0;
    chipWaveLoopEnd = 0;
    chipWaveLoopMode = 0;
    chipWavePlayBackwards = false;
    chipWaveStartOffset = 0;
    // advloop addition
    chipWaveInStereo = false; //...and this refers to whether or not the stereo checkmark is active.
    noisePitchFilterMult = 1.0;
    unison: Unison | null = null;
    unisonVoices = 1;
    unisonSpread = 0.0;
    unisonOffset = 0.0;
    unisonExpression = 1.4;
    unisonSign = 1.0;
    chord: Chord | null = null;
    effects: EffectState[] = [];

    volumeScale = 0;
    aliases = false;
    arpTime = 0;
    vibratoTime = 0;
    nextVibratoTime = 0;
    envelopeTime: number[] = [];
    mixVolume = 1.0;
    mixVolumeDelta = 0.0;
    delayDuration = 0.0;
    totalDelaySamples = 0.0;
    delayInputMult = 0.0;
    delayInputMultDelta = 0.0;

    readonly spectrumWave = new SpectrumWaveState();
    readonly harmonicsWave = new HarmonicsWaveState();
    readonly drumsetSpectrumWaves: SpectrumWaveState[] = [];

    constructor() {
        for (let i = 0; i < Config.drumCount; i++) {
            this.drumsetSpectrumWaves[i] = new SpectrumWaveState();
        }
    }

    readonly envelopeComputer = new EnvelopeComputer();

    allocateNecessaryBuffers(synth: Synth, instrument: Instrument, samplesPerTick: number): void {
        for (let effectIndex = 0; effectIndex < instrument.effects.length; effectIndex++) {
            if (this.effects[effectIndex] != null) {
                let effect = instrument.effects[effectIndex]!
                this.effects[effectIndex]!.allocateNecessaryBuffers(synth, instrument, effect, samplesPerTick);
            }
        }
    }

    deactivate(): void {
        for (let effectIndex = 0; effectIndex < this.effects.length; effectIndex++) {
            if (this.effects[effectIndex] != null) this.effects[effectIndex]!.deactivate();
        }

        this.volumeScale = 1.0;
        this.aliases = false;

        this.awake = false;
        this.flushingDelayLines = false;
        this.deactivateAfterThisTick = false;
        this.attentuationProgress = 0.0;
        this.flushedSamples = 0;
    }

    resetAllEffects(): void {
        this.deactivate();
        // LFOs are reset here rather than in deactivate() for periodic oscillation that stays "on the beat". Resetting in deactivate() will cause it to reset with each note.
        this.vibratoTime = 0;
        this.nextVibratoTime = 0;
        this.arpTime = 0;
        for (let envelopeIndex = 0; envelopeIndex < Config.maxEnvelopeCount + 1; envelopeIndex++) this.envelopeTime[envelopeIndex] = 0;
        this.envelopeComputer.reset();

        for (let effectIndex = 0; effectIndex < this.effects.length; effectIndex++) {
            if (this.effects[effectIndex] != null) this.effects[effectIndex]!.reset();
        }
    }

    compute(synth: Synth, instrument: Instrument, samplesPerTick: number, roundedSamplesPerTick: number, tone: Tone | null, channelIndex: number, instrumentIndex: number): void {
        this.computed = true;

        this.type = instrument.type;
        this.synthesizer = Synth.getInstrumentSynthFunction(instrument);
        this.unison = Config.unisons[instrument.unison];
        this.chord = instrument.getChord();
        this.noisePitchFilterMult = Config.chipNoises[instrument.chipNoise].pitchFilterMult;

        this.aliases = instrument.aliases;
        this.volumeScale = 1.0;
        this.delayDuration = 0.0;
        this.totalDelaySamples = 0.0;

        for (let effectIndex = 0; effectIndex < instrument.effects.length; effectIndex++) {
            if (this.effects[effectIndex] == null) this.effects[effectIndex] = new EffectState(instrument.effects[effectIndex]!.type);
        }
        this.effects.length = instrument.effects.length

        this.allocateNecessaryBuffers(synth, instrument, samplesPerTick);

        const samplesPerSecond = synth.samplesPerSecond;
        this.updateWaves(instrument, samplesPerSecond);

        const ticksIntoBar = synth.getTicksIntoBar();
        const tickTimeStart = ticksIntoBar;
        const secondsPerTick = samplesPerTick / synth.samplesPerSecond;
        const currentPart = synth.getCurrentPart();
        const envelopeSpeeds: number[] = [];
        for (let i = 0; i < Config.maxEnvelopeCount; i++) {
            envelopeSpeeds[i] = 0;
        }
        let useEnvelopeSpeed = Config.arpSpeedScale[instrument.envelopeSpeed];
        if (synth.isModActive(Config.modulators.dictionary["envelope speed"].index, channelIndex, instrumentIndex)) {
            useEnvelopeSpeed = Math.max(0, Math.min(Config.arpSpeedScale.length - 1, synth.getModValue(Config.modulators.dictionary["envelope speed"].index, channelIndex, instrumentIndex, false)));
            if (Number.isInteger(useEnvelopeSpeed)) {
                useEnvelopeSpeed = Config.arpSpeedScale[useEnvelopeSpeed];
            } else {
                // Linear interpolate envelope values
                useEnvelopeSpeed = ((1 - (useEnvelopeSpeed % 1)) * Config.arpSpeedScale[Math.floor(useEnvelopeSpeed)] + (useEnvelopeSpeed % 1) * Config.arpSpeedScale[Math.ceil(useEnvelopeSpeed)]);
            }
        }
        for (let envelopeIndex = 0; envelopeIndex < instrument.envelopeCount; envelopeIndex++) {
            let perEnvelopeSpeed = instrument.envelopes[envelopeIndex].perEnvelopeSpeed;
            if (synth.isModActive(Config.modulators.dictionary["individual envelope speed"].index, channelIndex, instrumentIndex) && instrument.envelopes[envelopeIndex].tempEnvelopeSpeed != null) {
                perEnvelopeSpeed = instrument.envelopes[envelopeIndex].tempEnvelopeSpeed!;
            }
            envelopeSpeeds[envelopeIndex] = useEnvelopeSpeed * perEnvelopeSpeed;
        }
        this.envelopeComputer.computeEnvelopes(instrument, currentPart, this.envelopeTime, tickTimeStart, secondsPerTick, tone, envelopeSpeeds, this, synth, channelIndex, instrumentIndex);
        const envelopeStarts: number[] = this.envelopeComputer.envelopeStarts;
        const envelopeEnds: number[] = this.envelopeComputer.envelopeEnds;

        for (let effectIndex = 0; effectIndex < instrument.effects.length; effectIndex++) {
            if (this.effects[effectIndex] != null) {
                let effect = instrument.effects[effectIndex]!
                this.effects[effectIndex]!.compute(synth, instrument, effect, this, samplesPerTick, roundedSamplesPerTick, tone, channelIndex, instrumentIndex, envelopeStarts, envelopeEnds);
            }
        }

        //const mainInstrumentVolume = Synth.instrumentVolumeToVolumeMult(instrument.volume);
        this.mixVolume = envelopeStarts[EnvelopeComputeIndex.mixVolume] * Synth.instrumentVolumeToVolumeMult(instrument.volume);
        let mixVolumeEnd = envelopeEnds[EnvelopeComputeIndex.mixVolume] * Synth.instrumentVolumeToVolumeMult(instrument.volume);

        // Check for mod-related volume delta
        if (synth.isModActive(Config.modulators.dictionary["post volume"].index, channelIndex, instrumentIndex)) {
            // Linear falloff below 0, normal volume formula above 0. Seems to work best for scaling since the normal volume mult formula has a big gap from -25 to -24.
            const startVal = synth.getModValue(Config.modulators.dictionary["post volume"].index, channelIndex, instrumentIndex, false);
            const endVal = synth.getModValue(Config.modulators.dictionary["post volume"].index, channelIndex, instrumentIndex, true);
            this.mixVolume *= ((startVal <= 0) ? ((startVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : Synth.instrumentVolumeToVolumeMult(startVal));
            mixVolumeEnd *= ((endVal <= 0) ? ((endVal + Config.volumeRange / 2) / (Config.volumeRange / 2)) : Synth.instrumentVolumeToVolumeMult(endVal));
        }

        // Check for SONG mod-related volume delta
        if (synth.isModActive(Config.modulators.dictionary["song volume"].index)) {
            this.mixVolume *= (synth.getModValue(Config.modulators.dictionary["song volume"].index, undefined, undefined, false)) / 100.0;
            mixVolumeEnd *= (synth.getModValue(Config.modulators.dictionary["song volume"].index, undefined, undefined, true)) / 100.0;
        }

        this.mixVolumeDelta = (mixVolumeEnd - this.mixVolume) / roundedSamplesPerTick;

        let delayInputMultStart = 1.0;
        let delayInputMultEnd = 1.0;

        if (this.tonesAddedInThisTick) {
            this.attentuationProgress = 0.0;
            this.flushedSamples = 0;
            this.flushingDelayLines = false;
        } else if (!this.flushingDelayLines) {
            // If this instrument isn't playing tones anymore, the volume can fade out by the
            // end of the first tick. It's possible for filters and the panning delay line to
            // continue past the end of the tone but they should have mostly dissipated by the
            // end of the tick anyway.
            if (this.attentuationProgress == 0.0) {
                //eqFilterVolumeEnd = 0.0;
            } else {
                //eqFilterVolumeStart = 0.0;
                //eqFilterVolumeEnd = 0.0;
            }

            const secondsInTick = samplesPerTick / samplesPerSecond;
            const progressInTick = secondsInTick / this.delayDuration;
            const progressAtEndOfTick = this.attentuationProgress + progressInTick;
            if (progressAtEndOfTick >= 1.0) {
                delayInputMultEnd = 0.0;
            }

            this.attentuationProgress = progressAtEndOfTick;
            if (this.attentuationProgress >= 1.0) {
                this.flushingDelayLines = true;
            }
        } else {
            delayInputMultStart = 0.0;
            delayInputMultEnd = 0.0;

            this.flushedSamples += roundedSamplesPerTick;
            if (this.flushedSamples >= this.totalDelaySamples) {
                this.deactivateAfterThisTick = true;
            }
        }

        this.delayInputMult = delayInputMultStart;
        this.delayInputMultDelta = (delayInputMultEnd - delayInputMultStart) / roundedSamplesPerTick;

        this.envelopeComputer.clearEnvelopes();
    }

    updateWaves(instrument: Instrument, samplesPerSecond: number): void {
        this.volumeScale = 1.0;
        if (instrument.type == InstrumentType.chip) {
            this.waveL = (this.aliases) ? Config.rawChipWaves[instrument.chipWave].samples : Config.chipWaves[instrument.chipWave].samples;
            this.waveR = (this.aliases) ? Config.rawChipWaves[instrument.chipWave].samplesR || Config.rawChipWaves[instrument.chipWave].samples : Config.chipWaves[instrument.chipWave].samplesR || Config.chipWaves[instrument.chipWave].samples;
            // advloop addition
            this.isUsingAdvancedLoopControls = instrument.isUsingAdvancedLoopControls;
            this.chipWaveLoopStart = instrument.chipWaveLoopStart;
            this.chipWaveLoopEnd = instrument.chipWaveLoopEnd;
            this.chipWaveLoopMode = instrument.chipWaveLoopMode;
            this.chipWavePlayBackwards = instrument.chipWavePlayBackwards;
            this.chipWaveStartOffset = instrument.chipWaveStartOffset;
            // advloop addition

            this.chipWaveInStereo = instrument.chipWaveInStereo;
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.pwm) {
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.customChipWave) {
            this.waveL = (this.aliases) ? instrument.customChipWave! : instrument.customChipWaveIntegral!;
            this.waveR = (this.aliases) ? instrument.customChipWave! : instrument.customChipWaveIntegral!;
            this.volumeScale = 0.05;
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.noise) {
            this.waveL = getDrumWave(instrument.chipNoise, inverseRealFourierTransform, scaleElementsByFactor);
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.harmonics) {
            this.waveL = this.harmonicsWave.getCustomWave(instrument.harmonicsWave, instrument.type);
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.pickedString) {
            this.waveL = this.harmonicsWave.getCustomWave(instrument.harmonicsWave, instrument.type);
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.spectrum) {
            this.waveL = this.spectrumWave.getCustomWave(instrument.spectrumWave, 8);
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else if (instrument.type == InstrumentType.drumset) {
            for (let i = 0; i < Config.drumCount; i++) {
                this.drumsetSpectrumWaves[i].getCustomWave(instrument.drumsetSpectrumWaves[i], InstrumentState._drumsetIndexToSpectrumOctave(i));
            }
            this.waveL = null;
            this.unisonVoices = instrument.unisonVoices;
            this.unisonSpread = instrument.unisonSpread;
            this.unisonOffset = instrument.unisonOffset;
            this.unisonExpression = instrument.unisonExpression;
            this.unisonSign = instrument.unisonSign;
        } else {
            this.waveL = null;
        }
    }

    getDrumsetWave(pitch: number): Float32Array {
        if (this.type == InstrumentType.drumset) {
            return this.drumsetSpectrumWaves[pitch].wave!;
        } else {
            throw new Error("Unhandled instrument type in getDrumsetWave");
        }
    }

    static drumsetIndexReferenceDelta(index: number): number {
        return Instrument.frequencyFromPitch(Config.spectrumBasePitch + index * 6) / 44100;
    }

    private static _drumsetIndexToSpectrumOctave(index: number): number {
        return 15 + Math.log2(InstrumentState.drumsetIndexReferenceDelta(index));
    }

    effectsIncludeType(type: EffectType): boolean {
        for (let i = 0; i < this.effects.length; i++) if (this.effects[i] != null && this.effects[i]!.type == type) return true;
        return false;
    }
}
