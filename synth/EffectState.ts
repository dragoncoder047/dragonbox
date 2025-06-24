// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { FilterType, EffectType, EnvelopeComputeIndex, Config, GranularEnvelopeType, calculateRingModHertz } from "./SynthConfig";
import { DynamicBiquadFilter } from "./filtering";
import { Instrument } from "./Instrument";
import { InstrumentState } from "./InstrumentState";
import { Effect } from "./Effect";
import { Synth, Tone } from "./synth";
import { FilterSettings, FilterControlPoint } from "./Filter";
import { fittingPowerOfTwo } from "./utils";

class Grain {
	delayLinePosition: number; // Relative to latest sample

	ageInSamples: number;
	maxAgeInSamples: number;
	delay: number;

	//parabolic envelope implementation
	parabolicEnvelopeAmplitude: number;
	parabolicEnvelopeSlope: number;
	parabolicEnvelopeCurve: number;

	//raised cosine bell envelope implementation
	rcbEnvelopeAmplitude: number;
	rcbEnvelopeAttackIndex: number;
	rcbEnvelopeReleaseIndex: number;
	rcbEnvelopeSustain: number;

	constructor() {
		this.delayLinePosition = 0;

		this.ageInSamples = 0;
		this.maxAgeInSamples = 0;
		this.delay = 0;

		this.parabolicEnvelopeAmplitude = 0;
		this.parabolicEnvelopeSlope = 0;
		this.parabolicEnvelopeCurve = 0;

		this.rcbEnvelopeAmplitude = 0;
		this.rcbEnvelopeAttackIndex = 0;
		this.rcbEnvelopeReleaseIndex = 0;
		this.rcbEnvelopeSustain = 0;
	}

	initializeParabolicEnvelope(durationInSamples: number, amplitude: number): void {
		this.parabolicEnvelopeAmplitude = 0;
		const invDuration = 1.0 / durationInSamples;
		const invDurationSquared = invDuration * invDuration;
		this.parabolicEnvelopeSlope = 4.0 * amplitude * (invDuration - invDurationSquared);
		this.parabolicEnvelopeCurve = -8.0 * amplitude * invDurationSquared;
	}

	updateParabolicEnvelope(): void {
		this.parabolicEnvelopeAmplitude += this.parabolicEnvelopeSlope;
		this.parabolicEnvelopeSlope += this.parabolicEnvelopeCurve;
	}

	initializeRCBEnvelope(durationInSamples: number, amplitude: number): void {
		// attack:
		this.rcbEnvelopeAttackIndex = Math.floor(durationInSamples / 6);
		// sustain:
		this.rcbEnvelopeSustain = amplitude;
		// release:
		this.rcbEnvelopeReleaseIndex = Math.floor(durationInSamples * 5 / 6);
	}

	updateRCBEnvelope(): void {
		if (this.ageInSamples < this.rcbEnvelopeAttackIndex) { //attack
			this.rcbEnvelopeAmplitude = (1.0 + Math.cos(Math.PI + (Math.PI * (this.ageInSamples / this.rcbEnvelopeAttackIndex) * (this.rcbEnvelopeSustain / 2.0))));
		} else if (this.ageInSamples > this.rcbEnvelopeReleaseIndex) { //release
			this.rcbEnvelopeAmplitude = (1.0 + Math.cos(Math.PI * ((this.ageInSamples - this.rcbEnvelopeReleaseIndex) / this.rcbEnvelopeAttackIndex)) * (this.rcbEnvelopeSustain / 2.0));
		} //sustain covered by the end of attack
	}

	addDelay(delay: number): void {
		this.delay = delay;
	}
}

export class EffectState {
	type = EffectType.reverb;

	eqFilterVolume = 1.0;
	eqFilterVolumeDelta = 0.0;

	granularMix = 1.0;
	granularMixDelta = 0.0;
	granularDelayLineL: Float32Array | null = null;
	granularDelayLineR: Float32Array | null = null;
	granularDelayLineIndex = 0;
	granularMaximumDelayTimeInSeconds = 1;
	granularGrains: Grain[];
	granularGrainsLength: number;
	granularMaximumGrains: number;
	usesRandomGrainLocation = true; //eventually I might use the granular code for sample pitch shifting, but we'll see
	granularDelayLineDirty = false;
	computeGrains = true;

	ringModMix = 0;
	ringModMixDelta = 0;
	ringModPhase = 0;
	ringModPhaseDelta = 0;
	ringModPhaseDeltaScale = 1.0;
	ringModWaveformIndex = 0.0;
	ringModPulseWidth = 0.0;
	ringModHzOffset = 0.0;
	ringModMixFade = 1.0;
	ringModMixFadeDelta = 0;

	distortion = 0.0;
	distortionDelta = 0.0;
	distortionDrive = 0.0;
	distortionDriveDelta = 0.0;
	distortionFractionalInputL1 = 0.0;
	distortionFractionalInputL2 = 0.0;
	distortionFractionalInputL3 = 0.0;
	distortionFractionalInputR1 = 0.0;
	distortionFractionalInputR2 = 0.0;
	distortionFractionalInputR3 = 0.0;
	distortionPrevInputL = 0.0;
	distortionPrevInputR = 0.0;
	distortionNextOutputL = 0.0;
	distortionNextOutputR = 0.0;

	bitcrusherPrevInputL = 0.0;
	bitcrusherPrevInputR = 0.0;
	bitcrusherCurrentOutputL = 0.0;
	bitcrusherCurrentOutputR = 0.0;
	bitcrusherPhase = 1.0;
	bitcrusherPhaseDelta = 0.0;
	bitcrusherPhaseDeltaScale = 1.0;
	bitcrusherScale = 1.0;
	bitcrusherScaleScale = 1.0;
	bitcrusherFoldLevel = 1.0;
	bitcrusherFoldLevelScale = 1.0;

	readonly eqFiltersL: DynamicBiquadFilter[] = [];
	readonly eqFiltersR: DynamicBiquadFilter[] = [];
	eqFilterCount = 0;
	initialEqFilterInputL1 = 0.0;
	initialEqFilterInputR1 = 0.0;
	initialEqFilterInputL2 = 0.0;
	initialEqFilterInputR2 = 0.0;

	gain = 1.0;
	gainDelta = 0.0;

	panningDelayLineL: Float32Array | null = null;
	panningDelayLineR: Float32Array | null = null;
	panningDelayPos = 0;
	panningVolumeL = 0.0;
	panningVolumeR = 0.0;
	panningVolumeDeltaL = 0.0;
	panningVolumeDeltaR = 0.0;
	panningOffsetL = 0.0;
	panningOffsetR = 0.0;
	panningOffsetDeltaL = 0.0;
	panningOffsetDeltaR = 0.0;
	panningMode = 0;

	flangerDelayLineL: Float32Array | null = null;
	flangerDelayLineR: Float32Array | null = null;
	flangerDelayLineDirty = false;
	flangerDelayPos = 0;
	flanger = 0;
	flangerDelta = 0;
	flangerSpeed = 0;
	flangerSpeedDelta = 0;
	flangerDepth = 0;
	flangerDepthDelta = 0;
	flangerFeedback = 0;
	flangerFeedbackDelta = 0;
	flangerPhase = 0;

	chorusDelayLineL: Float32Array | null = null;
	chorusDelayLineR: Float32Array | null = null;
	chorusDelayLineDirty = false;
	chorusDelayPos = 0;
	chorusPhase = 0;
	chorusVoiceMult = 0;
	chorusVoiceMultDelta = 0;
	chorusCombinedMult = 0;
	chorusCombinedMultDelta = 0;

	echoDelayLineL: Float32Array | null = null;
	echoDelayLineR: Float32Array | null = null;
	echoDelayLineDirty = false;
	echoDelayPosL = 0;
	echoDelayPosR = 0;
	echoDelayOffsetStart = 0;
	echoDelayOffsetEnd: number | null = null;
	echoDelayOffsetRatio = 0.0;
	echoDelayOffsetRatioDelta = 0.0;
	echoMult = 0.0;
	echoMultDelta = 0.0;
	echoPingPong = 0.0;
	echoShelfA1 = 0.0;
	echoShelfB0 = 0.0;
	echoShelfB1 = 0.0;
	echoShelfSampleL = 0.0;
	echoShelfSampleR = 0.0;
	echoShelfPrevInputL = 0.0;
	echoShelfPrevInputR = 0.0;

	reverbDelayLine: Float32Array | null = null;
	reverbDelayLineDirty = false;
	reverbDelayPos = 0;
	reverbMult = 0.0;
	reverbMultDelta = 0.0;
	reverbShelfA1 = 0.0;
	reverbShelfB0 = 0.0;
	reverbShelfB1 = 0.0;
	reverbShelfSample0 = 0.0;
	reverbShelfSample1 = 0.0;
	reverbShelfSample2 = 0.0;
	reverbShelfSample3 = 0.0;
	reverbShelfPrevInput0 = 0.0;
	reverbShelfPrevInput1 = 0.0;
	reverbShelfPrevInput2 = 0.0;
	reverbShelfPrevInput3 = 0.0;

	constructor(type: EffectType) {
		this.type = type;
		// Allocate all grains to be used ahead of time.
		// granularGrainsLength is what indicates how many grains actually "exist".
		this.granularGrains = [];
		this.granularMaximumGrains = 256;
		for (let i = 0; i < this.granularMaximumGrains; i++) {
			this.granularGrains.push(new Grain());
		}
		this.granularGrainsLength = 0;
	}

	reset(): void {
		if (this.chorusDelayLineDirty) {
			for (let i = 0; i < this.chorusDelayLineL!.length; i++) this.chorusDelayLineL![i] = 0.0;
			for (let i = 0; i < this.chorusDelayLineR!.length; i++) this.chorusDelayLineR![i] = 0.0;
		}
		if (this.flangerDelayLineDirty) {
			for (let i = 0; i < this.flangerDelayLineL!.length; i++) this.flangerDelayLineL![i] = 0.0;
			for (let i = 0; i < this.flangerDelayLineR!.length; i++) this.flangerDelayLineR![i] = 0.0;
		}
		if (this.echoDelayLineDirty) {
			for (let i = 0; i < this.echoDelayLineL!.length; i++) this.echoDelayLineL![i] = 0.0;
			for (let i = 0; i < this.echoDelayLineR!.length; i++) this.echoDelayLineR![i] = 0.0;
		}
		if (this.reverbDelayLineDirty) {
			for (let i = 0; i < this.reverbDelayLine!.length; i++) this.reverbDelayLine![i] = 0.0;
		}
		if (this.granularDelayLineDirty) {
			for (let i = 0; i < this.granularDelayLineL!.length; i++) this.granularDelayLineL![i] = 0.0;
			for (let i = 0; i < this.granularDelayLineR!.length; i++) this.granularDelayLineR![i] = 0.0;
		}

		this.flangerPhase = 0.0;
		this.chorusPhase = 0.0;
		this.ringModPhase = 0.0;
		this.ringModMixFade = 1.0;
	}

	allocateNecessaryBuffers(synth: Synth, instrument: Instrument, effect: Effect, samplesPerTick: number): void {
		if (effect.type == EffectType.panning) {
			if (this.panningDelayLineL == null || this.panningDelayLineR == null || this.panningDelayLineL.length < synth.panningDelayBufferSize || this.panningDelayLineR.length < synth.panningDelayBufferSize) {
				this.panningDelayLineL = new Float32Array(synth.panningDelayBufferSize);
				this.panningDelayLineR = new Float32Array(synth.panningDelayBufferSize);
			}
		}
		if (effect.type == EffectType.chorus) {
			if (this.chorusDelayLineL == null || this.chorusDelayLineL.length < synth.chorusDelayBufferSize) {
				this.chorusDelayLineL = new Float32Array(synth.chorusDelayBufferSize);
			}
			if (this.chorusDelayLineR == null || this.chorusDelayLineR.length < synth.chorusDelayBufferSize) {
				this.chorusDelayLineR = new Float32Array(synth.chorusDelayBufferSize);
			}
		}
		if (effect.type == EffectType.flanger) {
			if (this.flangerDelayLineL == null || this.flangerDelayLineL.length < synth.flangerDelayBufferSize) {
				this.flangerDelayLineL = new Float32Array(synth.flangerDelayBufferSize);
			}
			if (this.flangerDelayLineR == null || this.flangerDelayLineR.length < synth.flangerDelayBufferSize) {
				this.flangerDelayLineR = new Float32Array(synth.flangerDelayBufferSize);
			}
		}
		if (effect.type == EffectType.echo) {
			this.allocateEchoBuffers(samplesPerTick, effect.echoDelay);
		}
		if (effect.type == EffectType.reverb) {
			// TODO: Make reverb delay line sample rate agnostic. Maybe just double buffer size for 96KHz? Adjust attenuation and shelf cutoff appropriately?
			if (this.reverbDelayLine == null) {
				this.reverbDelayLine = new Float32Array(Config.reverbDelayBufferSize);
			}
		}
		if (effect.type == EffectType.granular) {
			const granularDelayLineSizeInMilliseconds = 2500;
			const granularDelayLineSizeInSeconds = granularDelayLineSizeInMilliseconds / 1000; // Maximum possible delay time
			this.granularMaximumDelayTimeInSeconds = granularDelayLineSizeInSeconds;
			const granularDelayLineSizeInSamples = fittingPowerOfTwo(Math.floor(granularDelayLineSizeInSeconds * synth.samplesPerSecond));
			if (this.granularDelayLineL == null || this.granularDelayLineR == null || this.granularDelayLineL.length != granularDelayLineSizeInSamples || this.granularDelayLineR.length != granularDelayLineSizeInSamples) {
				this.granularDelayLineL = new Float32Array(granularDelayLineSizeInSamples);
				this.granularDelayLineR = new Float32Array(granularDelayLineSizeInSamples);
				this.granularDelayLineIndex = 0;
			}
			const oldGrainsLength = this.granularGrains.length;
			if (this.granularMaximumGrains > oldGrainsLength) { //increase grain amount if it changes
				for (let i = oldGrainsLength; i < this.granularMaximumGrains+1; i++) {
					this.granularGrains.push(new Grain());
				}
			}
			if (this.granularMaximumGrains < this.granularGrainsLength) {
				this.granularGrainsLength = Math.round(this.granularMaximumGrains);
			}
		}
	}

	allocateEchoBuffers(samplesPerTick: number, echoDelay: number) {
		// account for tempo and delay automation changing delay length during a tick?
		const safeEchoDelaySteps = Math.max(Config.echoDelayRange >> 1, (echoDelay + 1)); // The delay may be very short now, but if it increases later make sure we have enough sample history.
		const baseEchoDelayBufferSize = fittingPowerOfTwo(safeEchoDelaySteps * Config.echoDelayStepTicks * samplesPerTick);
		const safeEchoDelayBufferSize = baseEchoDelayBufferSize * 2; // If the tempo or delay changes and we suddenly need a longer delay, make sure that we have enough sample history to accomodate the longer delay.

		if (this.echoDelayLineL == null || this.echoDelayLineR == null) {
			this.echoDelayLineL = new Float32Array(safeEchoDelayBufferSize);
			this.echoDelayLineR = new Float32Array(safeEchoDelayBufferSize);
		} else if (this.echoDelayLineL.length < safeEchoDelayBufferSize || this.echoDelayLineR.length < safeEchoDelayBufferSize) {
			// The echo delay length may change while the song is playing if tempo changes,
			// so buffers may need to be reallocated, but we don't want to lose any echoes
			// so we need to copy the contents of the old buffer to the new one.
			const newDelayLineL: Float32Array = new Float32Array(safeEchoDelayBufferSize);
			const newDelayLineR: Float32Array = new Float32Array(safeEchoDelayBufferSize);
			const oldMask = this.echoDelayLineL.length - 1;

			for (let i = 0; i < this.echoDelayLineL.length; i++) {
				newDelayLineL[i] = this.echoDelayLineL[(this.echoDelayPosL + i) & oldMask];
				newDelayLineR[i] = this.echoDelayLineR[(this.echoDelayPosR + i) & oldMask];
			}

			this.echoDelayPosL = this.echoDelayLineL.length;
			this.echoDelayPosR = this.echoDelayLineR.length;
			this.echoDelayLineL = newDelayLineL;
			this.echoDelayLineR = newDelayLineR;
		}
	}

	deactivate(): void {
		this.bitcrusherPrevInputL = 0.0;
		this.bitcrusherPrevInputR = 0.0;
		this.bitcrusherCurrentOutputL = 0.0;
		this.bitcrusherCurrentOutputR = 0.0;
		this.bitcrusherPhase = 1.0;
		for (let i = 0; i < this.eqFilterCount; i++) {
			this.eqFiltersL[i].resetOutput();
			this.eqFiltersR[i].resetOutput();
		}
		this.eqFilterCount = 0;
		this.initialEqFilterInputL1 = 0.0;
		this.initialEqFilterInputR1 = 0.0;
		this.initialEqFilterInputL2 = 0.0;
		this.initialEqFilterInputR2 = 0.0;
		this.distortionFractionalInputL1 = 0.0;
		this.distortionFractionalInputL2 = 0.0;
		this.distortionFractionalInputL3 = 0.0;
		this.distortionFractionalInputR1 = 0.0;
		this.distortionFractionalInputR2 = 0.0;
		this.distortionFractionalInputR3 = 0.0;
		this.distortionPrevInputL = 0.0;
		this.distortionPrevInputR = 0.0;
		this.distortionNextOutputL = 0.0;
		this.distortionNextOutputR = 0.0;
		this.flangerDelayPos = 0;
		this.panningDelayPos = 0;
		if (this.panningDelayLineL != null) for (let i = 0; i < this.panningDelayLineL.length; i++) this.panningDelayLineL[i] = 0.0;
		if (this.panningDelayLineR != null) for (let i = 0; i < this.panningDelayLineR.length; i++) this.panningDelayLineR[i] = 0.0;
		this.echoDelayOffsetEnd = null;
		this.echoShelfSampleL = 0.0;
		this.echoShelfSampleR = 0.0;
		this.echoShelfPrevInputL = 0.0;
		this.echoShelfPrevInputR = 0.0;
		this.reverbShelfSample0 = 0.0;
		this.reverbShelfSample1 = 0.0;
		this.reverbShelfSample2 = 0.0;
		this.reverbShelfSample3 = 0.0;
		this.reverbShelfPrevInput0 = 0.0;
		this.reverbShelfPrevInput1 = 0.0;
		this.reverbShelfPrevInput2 = 0.0;
		this.reverbShelfPrevInput3 = 0.0;
	}

	compute(synth: Synth, instrument: Instrument, effect: Effect, instrumentState: InstrumentState, samplesPerTick: number, roundedSamplesPerTick: number, tone: Tone | null, channelIndex: number, instrumentIndex: number, envelopeStarts: number[], envelopeEnds: number[]): void {
		const samplesPerSecond = synth.samplesPerSecond;

		this.type = effect.type;

		const usesGranular = effect.type == EffectType.granular;
		const usesRingModulation = effect.type == EffectType.ringModulation;
		const usesDistortion = effect.type == EffectType.distortion;
		const usesBitcrusher = effect.type == EffectType.bitcrusher;
		const usesGain = effect.type == EffectType.gain;
		const usesPanning = effect.type == EffectType.panning;
		const usesFlanger = effect.type == EffectType.flanger;
		const usesChorus = effect.type == EffectType.chorus;
		const usesEcho = effect.type == EffectType.echo;
		const usesReverb = effect.type == EffectType.reverb;
		const usesEQFilter = effect.type == EffectType.eqFilter;

		if (usesGranular) { //has to happen before buffer allocation
			this.granularMaximumGrains = Math.pow(2, effect.grainAmounts * envelopeStarts[EnvelopeComputeIndex.grainAmount]);
			if (synth.isModActive(Config.modulators.dictionary["grain freq"].index, channelIndex, instrumentIndex)) {
				this.granularMaximumGrains = Math.pow(2, synth.getModValue(Config.modulators.dictionary["grain freq"].index, channelIndex, instrumentIndex, false) * envelopeStarts[EnvelopeComputeIndex.grainAmount]);
			}
			this.granularMaximumGrains == Math.floor(this.granularMaximumGrains);
		}

		this.allocateNecessaryBuffers(synth, instrument, effect, samplesPerTick);

		if (usesGranular) {
			this.granularMix = effect.granular / Config.granularRange;
			this.computeGrains = true;
			let granularMixEnd = this.granularMix;
			if (synth.isModActive(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex)) {
				this.granularMix = synth.getModValue(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex, false) / Config.granularRange;
				granularMixEnd = synth.getModValue(Config.modulators.dictionary["granular"].index, channelIndex, instrumentIndex, true) / Config.granularRange;
			}
			this.granularMix *= envelopeStarts[EnvelopeComputeIndex.granular];
			granularMixEnd *= envelopeEnds[EnvelopeComputeIndex.granular];
			this.granularMixDelta = (granularMixEnd - this.granularMix) / roundedSamplesPerTick;
			for (let iterations = 0; iterations < Math.ceil(Math.random() * Math.random() * 10); iterations++) { //dirty weighting toward lower numbers
				//create a grain
				if (this.granularGrainsLength < this.granularMaximumGrains) {
					let granularMinGrainSizeInMilliseconds = effect.grainSize;
					if (synth.isModActive(Config.modulators.dictionary["grain size"].index, channelIndex, instrumentIndex)) {
						granularMinGrainSizeInMilliseconds = synth.getModValue(Config.modulators.dictionary["grain size"].index, channelIndex, instrumentIndex, false);
					}
					granularMinGrainSizeInMilliseconds *= envelopeStarts[EnvelopeComputeIndex.grainSize];
					let grainRange = effect.grainRange;
					if (synth.isModActive(Config.modulators.dictionary["grain range"].index, channelIndex, instrumentIndex)) {
						grainRange = synth.getModValue(Config.modulators.dictionary["grain range"].index, channelIndex, instrumentIndex, false);
					}
					grainRange *= envelopeStarts[EnvelopeComputeIndex.grainRange];
					const granularMaxGrainSizeInMilliseconds = granularMinGrainSizeInMilliseconds + grainRange;
					const granularGrainSizeInMilliseconds = granularMinGrainSizeInMilliseconds + (granularMaxGrainSizeInMilliseconds - granularMinGrainSizeInMilliseconds) * Math.random();
					const granularGrainSizeInSeconds = granularGrainSizeInMilliseconds / 1000.0;
					const granularGrainSizeInSamples = Math.floor(granularGrainSizeInSeconds * samplesPerSecond);
					const granularDelayLineLength = this.granularDelayLineL!.length;
					const grainIndex = this.granularGrainsLength;

					this.granularGrainsLength++;
					const grain = this.granularGrains[grainIndex];
					grain.ageInSamples = 0;
					grain.maxAgeInSamples = granularGrainSizeInSamples;
					// const minDelayTimeInMilliseconds = 2;
					// const minDelayTimeInSeconds = minDelayTimeInMilliseconds / 1000.0;
					const minDelayTimeInSeconds = 0.02;
					// const maxDelayTimeInSeconds = this.granularMaximumDelayTimeInSeconds;
					const maxDelayTimeInSeconds = 2.4;
					grain.delayLinePosition = this.usesRandomGrainLocation ? (minDelayTimeInSeconds + (maxDelayTimeInSeconds - minDelayTimeInSeconds) * Math.random() * Math.random() * samplesPerSecond) % (granularDelayLineLength - 1) : minDelayTimeInSeconds; //dirty weighting toward lower numbers ; The clamp was clumping everything at the end, so I decided to use a modulo instead
					if (Config.granularEnvelopeType == GranularEnvelopeType.parabolic) {
						grain.initializeParabolicEnvelope(grain.maxAgeInSamples, 1.0);
					} else if (Config.granularEnvelopeType == GranularEnvelopeType.raisedCosineBell) {
						grain.initializeRCBEnvelope(grain.maxAgeInSamples, 1.0);
					}
					// if (this.usesRandomGrainLocation) {
					grain.addDelay(Math.random() * samplesPerTick * 4); //offset when grains begin playing ; This is different from the above delay, which delays how far back in time the grain looks for samples
					// }
				}
			}
		}

		if (usesDistortion) {
			let useDistortionStart = effect.distortion;
			let useDistortionEnd = effect.distortion;

			// Check for distortion mods
			if (synth.isModActive(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex)) {
				useDistortionStart = synth.getModValue(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex, false);
				useDistortionEnd = synth.getModValue(Config.modulators.dictionary["distortion"].index, channelIndex, instrumentIndex, true);
			}

			const distortionSliderStart = Math.min(1.0, envelopeStarts[EnvelopeComputeIndex.distortion] * useDistortionStart / (Config.distortionRange - 1));
			const distortionSliderEnd = Math.min(1.0, envelopeEnds[EnvelopeComputeIndex.distortion] * useDistortionEnd / (Config.distortionRange - 1));
			const distortionStart = Math.pow(1.0 - 0.895 * (Math.pow(20.0, distortionSliderStart) - 1.0) / 19.0, 2.0);
			const distortionEnd = Math.pow(1.0 - 0.895 * (Math.pow(20.0, distortionSliderEnd) - 1.0) / 19.0, 2.0);
			const distortionDriveStart = (1.0 + 2.0 * distortionSliderStart) / Config.distortionBaseVolume;
			const distortionDriveEnd = (1.0 + 2.0 * distortionSliderEnd) / Config.distortionBaseVolume;
			this.distortion = distortionStart;
			this.distortionDelta = (distortionEnd - distortionStart) / roundedSamplesPerTick;
			this.distortionDrive = distortionDriveStart;
			this.distortionDriveDelta = (distortionDriveEnd - distortionDriveStart) / roundedSamplesPerTick;
		}

		if (usesBitcrusher) {
			let freqSettingStart = effect.bitcrusherFreq * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherFrequency]);
			let freqSettingEnd = effect.bitcrusherFreq * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherFrequency]);

			// Check for freq crush mods
			if (synth.isModActive(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex)) {
				freqSettingStart = synth.getModValue(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex, false) * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherFrequency]);
				freqSettingEnd = synth.getModValue(Config.modulators.dictionary["freq crush"].index, channelIndex, instrumentIndex, true) * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherFrequency]);
			}

			let quantizationSettingStart = effect.bitcrusherQuantization * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherQuantization]);
			let quantizationSettingEnd = effect.bitcrusherQuantization * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherQuantization]);

			// Check for bitcrush mods
			if (synth.isModActive(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex)) {
				quantizationSettingStart = synth.getModValue(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex, false) * Math.sqrt(envelopeStarts[EnvelopeComputeIndex.bitcrusherQuantization]);
				quantizationSettingEnd = synth.getModValue(Config.modulators.dictionary["bit crush"].index, channelIndex, instrumentIndex, true) * Math.sqrt(envelopeEnds[EnvelopeComputeIndex.bitcrusherQuantization]);
			}

			const basePitch = Config.keys[synth.song!.key].basePitch + (Config.pitchesPerOctave * synth.song!.octave); // TODO: What if there's a key change mid-song?
			const freqStart = Instrument.frequencyFromPitch(basePitch + 60) * Math.pow(2.0, (Config.bitcrusherFreqRange - 1 - freqSettingStart) * Config.bitcrusherOctaveStep);
			const freqEnd = Instrument.frequencyFromPitch(basePitch + 60) * Math.pow(2.0, (Config.bitcrusherFreqRange - 1 - freqSettingEnd) * Config.bitcrusherOctaveStep);
			const phaseDeltaStart = Math.min(1.0, freqStart / samplesPerSecond);
			const phaseDeltaEnd = Math.min(1.0, freqEnd / samplesPerSecond);
			this.bitcrusherPhaseDelta = phaseDeltaStart;
			this.bitcrusherPhaseDeltaScale = Math.pow(phaseDeltaEnd / phaseDeltaStart, 1.0 / roundedSamplesPerTick);

			const scaleStart = 2.0 * Config.bitcrusherBaseVolume * Math.pow(2.0, 1.0 - Math.pow(2.0, (Config.bitcrusherQuantizationRange - 1 - quantizationSettingStart) * 0.5));
			const scaleEnd = 2.0 * Config.bitcrusherBaseVolume * Math.pow(2.0, 1.0 - Math.pow(2.0, (Config.bitcrusherQuantizationRange - 1 - quantizationSettingEnd) * 0.5));
			this.bitcrusherScale = scaleStart;
			this.bitcrusherScaleScale = Math.pow(scaleEnd / scaleStart, 1.0 / roundedSamplesPerTick);

			const foldLevelStart = 2.0 * Config.bitcrusherBaseVolume * Math.pow(1.5, Config.bitcrusherQuantizationRange - 1 - quantizationSettingStart);
			const foldLevelEnd = 2.0 * Config.bitcrusherBaseVolume * Math.pow(1.5, Config.bitcrusherQuantizationRange - 1 - quantizationSettingEnd);
			this.bitcrusherFoldLevel = foldLevelStart;
			this.bitcrusherFoldLevelScale = Math.pow(foldLevelEnd / foldLevelStart, 1.0 / roundedSamplesPerTick);
		}

		if (usesEQFilter) {
			let eqFilterVolume = 1.0; //this.envelopeComputer.lowpassCutoffDecayVolumeCompensation;
			if (effect.eqFilterType) {
				// Simple EQ filter (old style). For analysis, using random filters from normal style since they are N/A in this context.
				const eqFilterSettingsStart = effect.eqFilter;
				if (effect.eqSubFilters[1] == null)
					effect.eqSubFilters[1] = new FilterSettings();
				const eqFilterSettingsEnd = effect.eqSubFilters[1];

				// Change location based on slider values
				let startSimpleFreq = effect.eqFilterSimpleCut;
				let startSimpleGain = effect.eqFilterSimplePeak;
				let endSimpleFreq = effect.eqFilterSimpleCut;
				let endSimpleGain = effect.eqFilterSimplePeak;

				let filterChanges = false;

				if (synth.isModActive(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex)) {
					startSimpleFreq = synth.getModValue(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex, false);
					endSimpleFreq = synth.getModValue(Config.modulators.dictionary["eq filt cut"].index, channelIndex, instrumentIndex, true);
					filterChanges = true;
				}
				if (synth.isModActive(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex)) {
					startSimpleGain = synth.getModValue(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex, false);
					endSimpleGain = synth.getModValue(Config.modulators.dictionary["eq filt peak"].index, channelIndex, instrumentIndex, true);
					filterChanges = true;
				}

				let startPoint: FilterControlPoint;

				if (filterChanges) {
					eqFilterSettingsStart.convertLegacySettingsForSynth(startSimpleFreq, startSimpleGain);
					eqFilterSettingsEnd.convertLegacySettingsForSynth(endSimpleFreq, endSimpleGain);

					startPoint = eqFilterSettingsStart.controlPoints[0];
					let endPoint = eqFilterSettingsEnd.controlPoints[0];

					startPoint.toCoefficients(Synth.tempFilterStartCoefficients, samplesPerSecond, 1.0, 1.0);
					endPoint.toCoefficients(Synth.tempFilterEndCoefficients, samplesPerSecond, 1.0, 1.0);

					if (this.eqFiltersL.length < 1) this.eqFiltersL[0] = new DynamicBiquadFilter();
					if (this.eqFiltersR.length < 1) this.eqFiltersR[0] = new DynamicBiquadFilter();
					this.eqFiltersL[0].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
					this.eqFiltersR[0].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
				} else {
					eqFilterSettingsStart.convertLegacySettingsForSynth(startSimpleFreq, startSimpleGain, true);

					startPoint = eqFilterSettingsStart.controlPoints[0];

					startPoint.toCoefficients(Synth.tempFilterStartCoefficients, samplesPerSecond, 1.0, 1.0);

					if (this.eqFiltersL.length < 1) this.eqFiltersL[0] = new DynamicBiquadFilter();
					if (this.eqFiltersR.length < 1) this.eqFiltersR[0] = new DynamicBiquadFilter();
					this.eqFiltersL[0].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterStartCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
					this.eqFiltersR[0].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterStartCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
				}
				this.eqFilterCount = 1;

				eqFilterVolume *= startPoint.getVolumeCompensationMult();
			}
			else {
				const eqFilterSettings = (effect.tmpEqFilterStart != null) ? effect.tmpEqFilterStart : effect.eqFilter;
				//const eqAllFreqsEnvelopeStart = envelopeStarts[InstrumentAutomationIndex.eqFilterAllFreqs];
				//const eqAllFreqsEnvelopeEnd = envelopeEnds[  InstrumentAutomationIndex.eqFilterAllFreqs];
				for (let i = 0; i < eqFilterSettings.controlPointCount; i++) {
					//const eqFreqEnvelopeStart = envelopeStarts[InstrumentAutomationIndex.eqFilterFreq0 + i];
					//const eqFreqEnvelopeEnd = envelopeEnds[  InstrumentAutomationIndex.eqFilterFreq0 + i];
					//const eqPeakEnvelopeStart = envelopeStarts[InstrumentAutomationIndex.eqFilterGain0 + i];
					//const eqPeakEnvelopeEnd = envelopeEnds[  InstrumentAutomationIndex.eqFilterGain0 + i];
					let startPoint = eqFilterSettings.controlPoints[i];
					let endPoint = (effect.tmpEqFilterEnd != null && effect.tmpEqFilterEnd.controlPoints[i] != null) ? effect.tmpEqFilterEnd.controlPoints[i] : eqFilterSettings.controlPoints[i];

					// If switching dot type, do it all at once and do not try to interpolate since no valid interpolation exists.
					if (startPoint.type != endPoint.type) {
						startPoint = endPoint;
					}

					startPoint.toCoefficients(Synth.tempFilterStartCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeStart * eqFreqEnvelopeStart*/ 1.0, /*eqPeakEnvelopeStart*/ 1.0);
					endPoint.toCoefficients(Synth.tempFilterEndCoefficients, samplesPerSecond, /*eqAllFreqsEnvelopeEnd   * eqFreqEnvelopeEnd*/   1.0, /*eqPeakEnvelopeEnd*/   1.0);
					if (this.eqFiltersL.length <= i) this.eqFiltersL[i] = new DynamicBiquadFilter();
					if (this.eqFiltersR.length <= i) this.eqFiltersR[i] = new DynamicBiquadFilter();
					this.eqFiltersL[i].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
					this.eqFiltersR[i].loadCoefficientsWithGradient(Synth.tempFilterStartCoefficients, Synth.tempFilterEndCoefficients, 1.0 / roundedSamplesPerTick, startPoint.type == FilterType.lowPass);
					eqFilterVolume *= startPoint.getVolumeCompensationMult();

				}
				this.eqFilterCount = eqFilterSettings.controlPointCount;
			}
			eqFilterVolume = Math.min(3.0, eqFilterVolume);

			let eqFilterVolumeStart = eqFilterVolume;
			let eqFilterVolumeEnd = eqFilterVolume;

			this.eqFilterVolume = eqFilterVolumeStart;
			this.eqFilterVolumeDelta = (eqFilterVolumeEnd - eqFilterVolumeStart) / roundedSamplesPerTick;
		}

		if (usesPanning) {
			this.panningMode = effect.panMode;

			const panEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.panning] * 2.0 - 1.0;
			const panEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.panning] * 2.0 - 1.0;

			let usePanStart = effect.pan;
			let usePanEnd = effect.pan;
			// Check for pan mods
			if (synth.isModActive(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex)) {
				usePanStart = synth.getModValue(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex, false);
				usePanEnd = synth.getModValue(Config.modulators.dictionary["pan"].index, channelIndex, instrumentIndex, true);
			}

			let panStart = Math.max(-1.0, Math.min(1.0, (usePanStart - Config.panCenter) / Config.panCenter * panEnvelopeStart));
			let panEnd = Math.max(-1.0, Math.min(1.0, (usePanEnd - Config.panCenter) / Config.panCenter * panEnvelopeEnd));

			const volumeStartL = Math.cos((1 + panStart) * Math.PI * 0.25) * 1.414;
			const volumeStartR = Math.cos((1 - panStart) * Math.PI * 0.25) * 1.414;
			const volumeEndL = Math.cos((1 + panEnd) * Math.PI * 0.25) * 1.414;
			const volumeEndR = Math.cos((1 - panEnd) * Math.PI * 0.25) * 1.414;
			const maxDelaySamples = samplesPerSecond * Config.panDelaySecondsMax;

			let usePanDelayStart = effect.panDelay;
			let usePanDelayEnd = effect.panDelay;
			// Check for pan delay mods
			if (synth.isModActive(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex)) {
				usePanDelayStart = synth.getModValue(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex, false);
				usePanDelayEnd = synth.getModValue(Config.modulators.dictionary["pan delay"].index, channelIndex, instrumentIndex, true);
			}

			const delayStart = panStart * usePanDelayStart * maxDelaySamples / 10;
			const delayEnd = panEnd * usePanDelayEnd * maxDelaySamples / 10;
			const delayStartL = Math.max(0.0, delayStart);
			const delayStartR = Math.max(0.0, -delayStart);
			const delayEndL = Math.max(0.0, delayEnd);
			const delayEndR = Math.max(0.0, -delayEnd);

			this.panningVolumeL = volumeStartL;
			this.panningVolumeR = volumeStartR;
			this.panningVolumeDeltaL = (volumeEndL - volumeStartL) / roundedSamplesPerTick;
			this.panningVolumeDeltaR = (volumeEndR - volumeStartR) / roundedSamplesPerTick;
			this.panningOffsetL = this.panningDelayPos - delayStartL + synth.panningDelayBufferSize;
			this.panningOffsetR = this.panningDelayPos - delayStartR + synth.panningDelayBufferSize;
			this.panningOffsetDeltaL = (delayEndL - delayStartL) / roundedSamplesPerTick;
			this.panningOffsetDeltaR = (delayEndR - delayStartR) / roundedSamplesPerTick;
		}

		if (usesGain) {
			const gainEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.gain];
			const gainEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.gain];

			let useGainStart = effect.gain;
			let useGainEnd = effect.gain;
			// Check for pan mods
			if (synth.isModActive(Config.modulators.dictionary["gain"].index, channelIndex, instrumentIndex)) {
				useGainStart = synth.getModValue(Config.modulators.dictionary["gain"].index, channelIndex, instrumentIndex, false);
				useGainEnd = synth.getModValue(Config.modulators.dictionary["gain"].index, channelIndex, instrumentIndex, true);
			}

			let gainStart = Math.min(Config.gainRangeMult, gainEnvelopeStart * useGainStart / (Config.volumeRange / 2 * Config.gainRangeMult)) * Config.gainRangeMult;
			let gainEnd = Math.min(Config.gainRangeMult, gainEnvelopeEnd * useGainEnd / (Config.volumeRange / 2 * Config.gainRangeMult)) * Config.gainRangeMult;

			this.gain = gainStart;
			this.gainDelta = (gainEnd - gainStart) / roundedSamplesPerTick;
		}

		if (usesChorus) {
			const chorusEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.chorus];
			const chorusEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.chorus];
			let useChorusStart = effect.chorus;
			let useChorusEnd = effect.chorus;
			// Check for chorus mods
			if (synth.isModActive(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex)) {
				useChorusStart = synth.getModValue(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex, false);
				useChorusEnd = synth.getModValue(Config.modulators.dictionary["chorus"].index, channelIndex, instrumentIndex, true);
			}

			let chorusStart = Math.min(1.0, chorusEnvelopeStart * useChorusStart / (Config.chorusRange - 1));
			let chorusEnd = Math.min(1.0, chorusEnvelopeEnd * useChorusEnd / (Config.chorusRange - 1));
			chorusStart = chorusStart * 0.6 + (Math.pow(chorusStart, 6.0)) * 0.4;
			chorusEnd = chorusEnd * 0.6 + (Math.pow(chorusEnd, 6.0)) * 0.4;
			const chorusCombinedMultStart = 1.0 / Math.sqrt(3.0 * chorusStart * chorusStart + 1.0);
			const chorusCombinedMultEnd = 1.0 / Math.sqrt(3.0 * chorusEnd * chorusEnd + 1.0);
			this.chorusVoiceMult = chorusStart;
			this.chorusVoiceMultDelta = (chorusEnd - chorusStart) / roundedSamplesPerTick;
			this.chorusCombinedMult = chorusCombinedMultStart;
			this.chorusCombinedMultDelta = (chorusCombinedMultEnd - chorusCombinedMultStart) / roundedSamplesPerTick;
		}

		if (usesFlanger) {
			const flangerEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.flanger];
			const flangerEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.flanger];
			let useFlangerStart = effect.flanger;
			let useFlangerEnd = effect.flanger;
			if (synth.isModActive(Config.modulators.dictionary["flanger"].index, channelIndex, instrumentIndex)) {
				useFlangerStart = synth.getModValue(Config.modulators.dictionary["flanger"].index, channelIndex, instrumentIndex, false);
				useFlangerEnd = synth.getModValue(Config.modulators.dictionary["flanger"].index, channelIndex, instrumentIndex, true);
			}
			let flangerStart = Math.min(1.0, flangerEnvelopeStart * useFlangerStart / (Config.flangerRange - 1));
			let flangerEnd = Math.min(1.0, flangerEnvelopeEnd * useFlangerEnd / (Config.flangerRange - 1));

			const flangerSpeedEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.flangerSpeed];
			const flangerSpeedEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.flangerSpeed];
			let useFlangerSpeedStart = effect.flangerSpeed;
			let useFlangerSpeedEnd = effect.flangerSpeed;
			if (synth.isModActive(Config.modulators.dictionary["flanger speed"].index, channelIndex, instrumentIndex)) {
				useFlangerSpeedStart = synth.getModValue(Config.modulators.dictionary["flanger speed"].index, channelIndex, instrumentIndex, false);
				useFlangerSpeedEnd = synth.getModValue(Config.modulators.dictionary["flanger speed"].index, channelIndex, instrumentIndex, true);
			}
			let flangerSpeedStart = flangerSpeedEnvelopeStart * useFlangerSpeedStart + 2;
			let flangerSpeedEnd = flangerSpeedEnvelopeEnd * useFlangerSpeedEnd + 2;

			const flangerDepthEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.flangerDepth];
			const flangerDepthEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.flangerDepth];
			let useFlangerDepthStart = effect.flangerDepth;
			let useFlangerDepthEnd = effect.flangerDepth;
			if (synth.isModActive(Config.modulators.dictionary["flanger depth"].index, channelIndex, instrumentIndex)) {
				useFlangerDepthStart = synth.getModValue(Config.modulators.dictionary["flanger depth"].index, channelIndex, instrumentIndex, false);
				useFlangerDepthEnd = synth.getModValue(Config.modulators.dictionary["flanger depth"].index, channelIndex, instrumentIndex, true);
			}
			let flangerDepthStart = flangerDepthEnvelopeStart * useFlangerDepthStart * 2 + 2;
			let flangerDepthEnd = flangerDepthEnvelopeEnd * useFlangerDepthEnd * 2 + 2;

			const flangerFeedbackEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.flangerFeedback];
			const flangerFeedbackEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.flangerFeedback];
			let useFlangerFeedbackStart = effect.flangerFeedback;
			let useFlangerFeedbackEnd = effect.flangerFeedback;
			if (synth.isModActive(Config.modulators.dictionary["flanger feedback"].index, channelIndex, instrumentIndex)) {
				useFlangerFeedbackStart = synth.getModValue(Config.modulators.dictionary["flanger feedback"].index, channelIndex, instrumentIndex, false);
				useFlangerFeedbackEnd = synth.getModValue(Config.modulators.dictionary["flanger feedback"].index, channelIndex, instrumentIndex, true);
			}
			let flangerFeedbackStart = flangerFeedbackEnvelopeStart * useFlangerFeedbackStart * 1.5;
			let flangerFeedbackEnd = flangerFeedbackEnvelopeEnd * useFlangerFeedbackEnd * 1.5;

			this.flanger = flangerStart;
			this.flangerDelta = (flangerEnd - flangerStart) / roundedSamplesPerTick;
			this.flangerSpeed = flangerSpeedStart;
			this.flangerSpeedDelta = (flangerSpeedEnd - flangerSpeedStart) / roundedSamplesPerTick;
			this.flangerDepth = flangerDepthStart;
			this.flangerDepthDelta = (flangerDepthEnd - flangerDepthStart) / roundedSamplesPerTick;
			this.flangerFeedback = (Math.sqrt(flangerFeedbackStart) / Math.sqrt(Config.flangerFeedbackRange));
			this.flangerFeedbackDelta = ((Math.sqrt(flangerFeedbackEnd) / Math.sqrt(Config.flangerFeedbackRange)) - (Math.sqrt(flangerFeedbackStart) / Math.sqrt(Config.flangerFeedbackRange))) / roundedSamplesPerTick;
		}

		if (usesRingModulation) {
			let useRingModStart = effect.ringModulation;
			let useRingModEnd = effect.ringModulation;

			let useRingModEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.ringModulation];
			let useRingModEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.ringModulation];

			let useRingModHzStart = Math.min(1.0, effect.ringModulationHz / (Config.ringModHzRange - 1));
			let useRingModHzEnd = Math.min(1.0, effect.ringModulationHz / (Config.ringModHzRange - 1));
			let useRingModHzEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.ringModulationHz];
			let useRingModHzEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.ringModulationHz];


			if (synth.isModActive(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex)) {
				useRingModStart = (synth.getModValue(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex, false));
				useRingModEnd = (synth.getModValue(Config.modulators.dictionary["ring modulation"].index, channelIndex, instrumentIndex, true));
			}
			if (synth.isModActive(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex)) {
				useRingModHzStart = Math.min(1.0, Math.max(0.0, (synth.getModValue(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex, false)) / (Config.ringModHzRange - 1)));
				useRingModHzEnd = Math.min(1.0, Math.max(0.0, (synth.getModValue(Config.modulators.dictionary["ring mod hertz"].index, channelIndex, instrumentIndex, false)) / (Config.ringModHzRange - 1)));
			}
			useRingModHzStart *= useRingModHzEnvelopeStart;
			useRingModHzEnd *= useRingModHzEnvelopeEnd;
			let ringModStart = Math.min(1.0, (useRingModStart * useRingModEnvelopeStart) / (Config.ringModRange - 1));
			let ringModEnd = Math.min(1.0, (useRingModEnd * useRingModEnvelopeEnd) / (Config.ringModRange - 1));

			this.ringModMix = ringModStart;
			this.ringModMixDelta = (ringModEnd - ringModStart) / roundedSamplesPerTick;

			this.ringModHzOffset = effect.ringModHzOffset;

			let ringModPhaseDeltaStart = (Math.max(0, calculateRingModHertz(useRingModHzStart))) / synth.samplesPerSecond;
			let ringModPhaseDeltaEnd = (Math.max(0, calculateRingModHertz(useRingModHzEnd))) / synth.samplesPerSecond;

			this.ringModMixFadeDelta = 0;
			if (this.ringModMixFade < 0) this.ringModMixFade = 0;
			if (ringModPhaseDeltaStart <= 0 && ringModPhaseDeltaEnd <= 0 && this.ringModMixFade != 0) {
				this.ringModMixFadeDelta = this.ringModMixFade / -10;
			} else if (ringModPhaseDeltaStart > 0 && ringModPhaseDeltaEnd > 0) {
				this.ringModMixFade = 1.0;
			}

			this.ringModPhaseDelta = ringModPhaseDeltaStart;
			this.ringModPhaseDeltaScale = ringModPhaseDeltaStart == 0 ? 1 : Math.pow(ringModPhaseDeltaEnd / ringModPhaseDeltaStart, 1.0 / roundedSamplesPerTick);

			this.ringModWaveformIndex = effect.ringModWaveformIndex;
			this.ringModPulseWidth = effect.ringModPulseWidth;

		}

		let maxEchoMult = 0.0;
		let averageEchoDelaySeconds = 0.0;

		if (usesEcho) {
			const echoSustainEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.echoSustain];
			const echoSustainEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.echoSustain];
			let useEchoSustainStart = effect.echoSustain;
			let useEchoSustainEnd = effect.echoSustain;
			// Check for echo mods
			if (synth.isModActive(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex)) {
				useEchoSustainStart = Math.max(0.0, synth.getModValue(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex, false));
				useEchoSustainEnd = Math.max(0.0, synth.getModValue(Config.modulators.dictionary["echo"].index, channelIndex, instrumentIndex, true));
			}
			const echoMultStart = Math.min(1.0, Math.pow(echoSustainEnvelopeStart * useEchoSustainStart / Config.echoSustainRange, 1.1)) * 0.9;
			const echoMultEnd = Math.min(1.0, Math.pow(echoSustainEnvelopeEnd * useEchoSustainEnd / Config.echoSustainRange, 1.1)) * 0.9;
			this.echoMult = echoMultStart;
			this.echoMultDelta = Math.max(0.0, (echoMultEnd - echoMultStart) / roundedSamplesPerTick);
			maxEchoMult = Math.max(echoMultStart, echoMultEnd);

			// TODO: After computing a tick's settings once for multiple run lengths (which is
			// good for audio worklet threads), compute the echo delay envelopes at tick (or
			// part) boundaries to interpolate between two delay taps.
			const echoDelayEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.echoDelay];
			const echoDelayEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.echoDelay];
			let useEchoDelayStart = effect.echoDelay * echoDelayEnvelopeStart;
			let useEchoDelayEnd = effect.echoDelay * echoDelayEnvelopeEnd;
			// let ignoreTicks = false;
			// Check for echo delay mods
			if (synth.isModActive(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex)) {
				useEchoDelayStart = synth.getModValue(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex, false) * echoDelayEnvelopeStart;
				useEchoDelayEnd = synth.getModValue(Config.modulators.dictionary["echo delay"].index, channelIndex, instrumentIndex, true) * echoDelayEnvelopeEnd;
				// ignoreTicks = true;
				// this.allocateEchoBuffers(samplesPerTick, Math.max(useEchoDelayStart,useEchoDelayEnd)); //update buffer size for modulation / envelopes
			}
			const tmpEchoDelayOffsetStart = /*ignoreTicks ? (useEchoDelayStart + 1) * Config.echoDelayStepTicks * samplesPerTick : */Math.round((useEchoDelayStart + 1) * Config.echoDelayStepTicks * samplesPerTick);
			const tmpEchoDelayOffsetEnd = /*ignoreTicks ? (useEchoDelayEnd + 1) * Config.echoDelayStepTicks * samplesPerTick : */Math.round((useEchoDelayEnd + 1) * Config.echoDelayStepTicks * samplesPerTick);
			if (this.echoDelayOffsetEnd != null/* && !ignoreTicks*/) {
				this.echoDelayOffsetStart = this.echoDelayOffsetEnd;
			} else {
				this.echoDelayOffsetStart = tmpEchoDelayOffsetStart;
			}

			this.echoDelayOffsetEnd = tmpEchoDelayOffsetEnd;
			averageEchoDelaySeconds = (this.echoDelayOffsetStart + this.echoDelayOffsetEnd) * 0.5 / samplesPerSecond;

			this.echoDelayOffsetRatio = 0.0;
			this.echoDelayOffsetRatioDelta = 1.0 / roundedSamplesPerTick;

			this.echoPingPong = ((effect.echoPingPong / Config.panMax) - 0.5) * 2;
			//const echoPingPongEnd

			const shelfRadians = 2.0 * Math.PI * Config.echoShelfHz / synth.samplesPerSecond;
			Synth.tempFilterStartCoefficients.highShelf1stOrder(shelfRadians, Config.echoShelfGain);
			this.echoShelfA1 = Synth.tempFilterStartCoefficients.a[1];
			this.echoShelfB0 = Synth.tempFilterStartCoefficients.b[0];
			this.echoShelfB1 = Synth.tempFilterStartCoefficients.b[1];
		}

		let maxReverbMult = 0.0;

		if (usesReverb) {
			const reverbEnvelopeStart = envelopeStarts[EnvelopeComputeIndex.reverb];
			const reverbEnvelopeEnd = envelopeEnds[EnvelopeComputeIndex.reverb];

			let useReverbStart = effect.reverb;
			let useReverbEnd = effect.reverb;

			// Check for mod reverb, instrument level
			if (synth.isModActive(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex)) {
				useReverbStart = synth.getModValue(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex, false);
				useReverbEnd = synth.getModValue(Config.modulators.dictionary["reverb"].index, channelIndex, instrumentIndex, true);
			}
			// Check for mod reverb, song scalar
			if (synth.isModActive(Config.modulators.dictionary["song reverb"].index, channelIndex, instrumentIndex)) {
				useReverbStart *= (synth.getModValue(Config.modulators.dictionary["song reverb"].index, undefined, undefined, false) - Config.modulators.dictionary["song reverb"].convertRealFactor) / Config.reverbRange;
				useReverbEnd *= (synth.getModValue(Config.modulators.dictionary["song reverb"].index, undefined, undefined, true) - Config.modulators.dictionary["song reverb"].convertRealFactor) / Config.reverbRange;
			}

			const reverbStart = Math.min(1.0, Math.pow(reverbEnvelopeStart * useReverbStart / Config.reverbRange, 0.667)) * 0.425;
			const reverbEnd = Math.min(1.0, Math.pow(reverbEnvelopeEnd * useReverbEnd / Config.reverbRange, 0.667)) * 0.425;

			this.reverbMult = reverbStart;
			this.reverbMultDelta = (reverbEnd - reverbStart) / roundedSamplesPerTick;
			maxReverbMult = Math.max(reverbStart, reverbEnd);

			const shelfRadians = 2.0 * Math.PI * Config.reverbShelfHz / synth.samplesPerSecond;
			Synth.tempFilterStartCoefficients.highShelf1stOrder(shelfRadians, Config.reverbShelfGain);
			this.reverbShelfA1 = Synth.tempFilterStartCoefficients.a[1];
			this.reverbShelfB0 = Synth.tempFilterStartCoefficients.b[0];
			this.reverbShelfB1 = Synth.tempFilterStartCoefficients.b[1];
		}

		if (!instrumentState.tonesAddedInThisTick && !instrumentState.flushingDelayLines) {
			const attenuationThreshold = 1.0 / 256.0; // when the delay line signal has attenuated this much, it should be inaudible and should be flushed to zero.
			const halfLifeMult = -Math.log2(attenuationThreshold);

			if (usesChorus) {
				instrumentState.delayDuration += Config.chorusMaxDelay;
			}

			if (usesFlanger) {
				instrumentState.delayDuration += Config.flangerMaxDelay;
			}

			if (usesEcho) {
				const attenuationPerSecond = Math.pow(maxEchoMult, 1.0 / averageEchoDelaySeconds);
				const halfLife = -1.0 / Math.log2(attenuationPerSecond);
				const echoDuration = halfLife * halfLifeMult;
				instrumentState.delayDuration += echoDuration;
			}

			if (usesReverb) {
				const averageMult = maxReverbMult * 2.0;
				const averageReverbDelaySeconds = (Config.reverbDelayBufferSize / 4.0) / samplesPerSecond;
				const attenuationPerSecond = Math.pow(averageMult, 1.0 / averageReverbDelaySeconds);
				const halfLife = -1.0 / Math.log2(attenuationPerSecond);
				const reverbDuration = halfLife * halfLifeMult;
				instrumentState.delayDuration += reverbDuration;
			}

			if (usesGranular) {
				this.computeGrains = false;
			}
		} else {
			// Flushing delay lines to zero since the signal has mostly dissipated.
			//eqFilterVolumeStart = 0.0;
			//eqFilterVolumeEnd = 0.0;

			if (usesChorus) instrumentState.totalDelaySamples += synth.chorusDelayBufferSize;
			if (usesFlanger) instrumentState.totalDelaySamples += synth.flangerDelayBufferSize;
			if (usesEcho) instrumentState.totalDelaySamples += this.echoDelayLineL!.length;
			if (usesReverb) instrumentState.totalDelaySamples += Config.reverbDelayBufferSize;
			if (usesGranular) instrumentState.totalDelaySamples += this.granularMaximumDelayTimeInSeconds;
		}
	}
}
