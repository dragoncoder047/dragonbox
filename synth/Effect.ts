// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { EffectType, Config } from "./SynthConfig";
import { FilterSettings } from "./Filter";

export class Effect {
	type: EffectType = EffectType.reverb;
	wetDryMix: number = 0.5;
	send: number = 1;

	eqFilter: FilterSettings = new FilterSettings();
	eqFilterType: boolean = false;
	eqFilterSimpleCut: number = Config.filterSimpleCutRange - 1;
	eqFilterSimplePeak: number = 0;
	eqSubFilters: (FilterSettings | null)[] = [];
	tmpEqFilterStart: FilterSettings | null;
	tmpEqFilterEnd: FilterSettings | null;
	//public envelopes: EnvelopeSettings[] = [];
	//public envelopeCount: number = 0;
	//public envelopeSpeed: number = 12;

	gain: number = Config.volumeRange / 2;
	pan: number = Config.panCenter;
	panDelay: number = 0;
	panMode: number = 0;
	aliases: boolean = false;
	distortion: number = 0;
	bitcrusherFreq: number = 0;
	bitcrusherQuantization: number = 0;
	ringModulation: number = Math.floor(Config.ringModRange/2);
	ringModulationHz: number = Math.floor(Config.ringModHzRange / 2);
	ringModWaveformIndex: number = 0;
	ringModPulseWidth: number = 0;
	ringModHzOffset: number = 200;
	granular: number = 4;
	grainSize: number = (Config.grainSizeMax-Config.grainSizeMin)/Config.grainSizeStep;
	grainAmounts: number = Config.grainAmountsMax;
	grainRange: number = 40;
	flanger: number = 0;
	flangerSpeed: number = 0;
	flangerDepth: number = 0;
	flangerFeedback: number = 0;
	chorus: number = 0;
	reverb: number = 0;
	echoSustain: number = 0;
	echoDelay: number = 0;
	echoPingPong: number = Config.panCenter;

	constructor(type: EffectType) {
		this.type = type;
	}
}
