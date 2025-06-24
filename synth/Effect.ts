// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { EffectType, Config } from "./SynthConfig";
import { FilterSettings } from "./Filter";

export class Effect {
	type = EffectType.reverb;
	wetDryMix = 0.5;
	send = 1;

	eqFilter = new FilterSettings();
	eqFilterType = false;
	eqFilterSimpleCut = Config.filterSimpleCutRange - 1;
	eqFilterSimplePeak = 0;
	eqSubFilters: (FilterSettings | null)[] = [];
	tmpEqFilterStart: FilterSettings | null;
	tmpEqFilterEnd: FilterSettings | null;
	//public envelopes: EnvelopeSettings[] = [];
	//public envelopeCount = 0;
	//public envelopeSpeed = 12;

	gain = Config.volumeRange / 2;
	pan = Config.panCenter;
	panDelay = 0;
	panMode = 0;
	aliases = false;
	distortion = 0;
	bitcrusherFreq = 0;
	bitcrusherQuantization = 0;
	ringModulation = Math.floor(Config.ringModRange/2);
	ringModulationHz = Math.floor(Config.ringModHzRange / 2);
	ringModWaveformIndex = 0;
	ringModPulseWidth = 0;
	ringModHzOffset = 200;
	granular = 4;
	grainSize = (Config.grainSizeMax-Config.grainSizeMin)/Config.grainSizeStep;
	grainAmounts = Config.grainAmountsMax;
	grainRange = 40;
	flanger = 0;
	flangerSpeed = 0;
	flangerDepth = 0;
	flangerFeedback = 0;
	chorus = 0;
	reverb = 0;
	echoSustain = 0;
	echoDelay = 0;
	echoPingPong = Config.panCenter;

	constructor(type: EffectType) {
		this.type = type;
	}
}
