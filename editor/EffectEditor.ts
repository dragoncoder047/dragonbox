// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config, EffectType } from "../synth/SynthConfig";
import { Instrument } from "../synth/Instrument";
import { Effect } from "../synth/Effect";
import { SongDocument } from "./SongDocument";
import { ChangeChorus, ChangeReverb, ChangeRingModChipWave, ChangeRingMod, ChangeRingModHz, ChangeGranular, ChangeGrainSize, ChangeGrainAmounts, ChangeGrainRange, ChangeEchoDelay, ChangeEchoSustain, ChangeEchoPingPong, ChangePan, ChangePanMode, ChangePanDelay, ChangeDistortion, ChangeAliasing, ChangeBitcrusherQuantization, ChangeBitcrusherFreq, ChangeEQFilterType, ChangeEQFilterSimpleCut, ChangeEQFilterSimplePeak, ChangeRemoveEffects, ChangeReorderEffects } from "./changes";
import { HTML } from "imperative-html/dist/esm/elements-strict";
import { Change } from "./Change";
import { FilterEditor } from "./FilterEditor";
import { ColorConfig } from "./ColorConfig";
import { Slider } from "./HTMLWrapper";

function buildOptions(menu: HTMLSelectElement, items: ReadonlyArray<string | number>): HTMLSelectElement {
	for (let index: number = 0; index < items.length; index++) {
		menu.appendChild(HTML.option({ value: index }, items[index]));
	}
	return menu;
}

function setSelectedValue(menu: HTMLSelectElement, value: number, isSelect2: boolean = false): void {
	const stringValue = value.toString();
	if (menu.value != stringValue) {
		menu.value = stringValue;

		// Change select2 value, if this select is a member of that class.
		if (isSelect2) {
			$(menu).val(value).trigger('change.select2');
		}
	}
}

export class EffectEditor {
	public readonly container: HTMLElement = HTML.div({ class: "effectEditor" });

	private readonly _rows: HTMLDivElement[] = [];

	public readonly moveupButtons: HTMLButtonElement[] = [];
	public readonly movedownButtons: HTMLButtonElement[] = [];
	public readonly minimizeButtons: HTMLButtonElement[] = [];
	public readonly deleteButtons: HTMLButtonElement[] = [];

	public readonly renderEffectRows: boolean[] = [];

	public readonly chorusSliders: Slider[] = [];
	public readonly reverbSliders: Slider[] = [];
	public readonly ringModWaveSelects: HTMLSelectElement[] = [];
	public readonly ringModSliders: Slider[] = [];
	public readonly ringModHzSliders: Slider[] = [];
	public readonly granularSliders: Slider[] = [];
	public readonly grainSizeSliders: Slider[] = [];
	public readonly grainAmountsSliders: Slider[] = [];
	public readonly grainRangeSliders: Slider[] = [];
	public readonly echoSustainSliders: Slider[] = [];
	public readonly echoDelaySliders: Slider[] = [];
	public readonly echoPingPongSliders: Slider[] = [];
	public readonly panSliders: Slider[] = [];
	public readonly panSliderInputBoxes: HTMLInputElement[] = [];
	public readonly panDelaySliders: Slider[] = [];
	public readonly panModeSelects: HTMLSelectElement[] = [];
	public readonly distortionSliders: Slider[] = [];
	public readonly aliasingBoxes: HTMLInputElement[] = [];
	public readonly bitcrusherQuantizationSliders: Slider[] = [];
	public readonly bitcrusherFreqSliders: Slider[] = [];
	public readonly eqFilterSimpleButtons: HTMLButtonElement[] = [];
	public readonly eqFilterAdvancedButtons: HTMLButtonElement[] = [];
	public readonly eqFilterEditors: FilterEditor[] = [];
	public readonly eqFilterSimpleCutSliders: Slider[] = [];
	public readonly eqFilterSimplePeakSliders: Slider[] = [];

	private _lastChange: Change | null = null;

	constructor(private _doc: SongDocument, private _openPrompt: Function) {
		this.container.addEventListener("change", this._onChange);
		this.container.addEventListener("click", this._onClick);
		this.container.addEventListener("input", this._onInput);
	}

	private _onChange = (event: Event): void => {
		const ringModWaveSelectIndex: number = this.ringModWaveSelects.indexOf(<any>event.target);
		const panModeSelectIndex: number = this.panModeSelects.indexOf(<any>event.target);
		const aliasingBoxIndex: number = this.aliasingBoxes.indexOf(<any>event.target);

		const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
		if (ringModWaveSelectIndex != -1) {
			let effect: Effect = <Effect>instrument.effects[ringModWaveSelectIndex];
			this._doc.record(new ChangeRingModChipWave(this._doc, effect, parseInt(this.ringModWaveSelects[ringModWaveSelectIndex].value)));
		} else if (panModeSelectIndex != -1) {
			let effect: Effect = <Effect>instrument.effects[panModeSelectIndex];
			this._doc.record(new ChangePanMode(this._doc, effect, parseInt(this.panModeSelects[panModeSelectIndex].value)));
			console.log(this.panModeSelects[panModeSelectIndex].value)
		} else if (aliasingBoxIndex != -1) {
			let effect: Effect = <Effect>instrument.effects[aliasingBoxIndex];
			console.log(this.aliasingBoxes[aliasingBoxIndex].value)
			this._doc.record(new ChangeAliasing(this._doc, effect, this.aliasingBoxes[aliasingBoxIndex].checked));
		} else if (this._lastChange != null) {
			this._doc.record(this._lastChange);
			this._lastChange = null;
		}
	}

	private _onClick = (event: MouseEvent): void => {
		const moveupButtonIndex: number = this.moveupButtons.indexOf(<any>event.target);
		const movedownButtonIndex: number = this.movedownButtons.indexOf(<any>event.target);
		const minimizeButtonIndex: number = this.minimizeButtons.indexOf(<any>event.target);
		const deleteButtonIndex: number = this.deleteButtons.indexOf(<any>event.target);
		if (deleteButtonIndex != -1) {
			this._doc.record(new ChangeRemoveEffects(this._doc, deleteButtonIndex, null));
			this.render(true)
		}
		else if (moveupButtonIndex != -1) {
			this._doc.record(new ChangeReorderEffects(this._doc, moveupButtonIndex, true, null));
			this.render(true)
		}
		else if (movedownButtonIndex != -1) {
			this._doc.record(new ChangeReorderEffects(this._doc, movedownButtonIndex, false, null));
			this.render(true)
		}
		else if (minimizeButtonIndex != -1) {
			this.renderEffectRows[minimizeButtonIndex] = !this.renderEffectRows[minimizeButtonIndex]
			this.render(true)
		}
	}

	private _onInput = (event: Event): void => {
		const panSliderInputBoxIndex: number = this.panSliderInputBoxes.indexOf(<any>event.target);

		const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];

		if (panSliderInputBoxIndex != -1) {
			let effect: Effect = <Effect>instrument.effects[panSliderInputBoxIndex];
			this._doc.record(new ChangePan(this._doc, effect, Math.min(100.0, Math.max(0.0, Math.round(+this.panSliderInputBoxes[panSliderInputBoxIndex].value)))));
			this.panSliders[panSliderInputBoxIndex].updateValue(effect.pan);
		}

		for (let effectIndex: number = 0; effectIndex < instrument.effectCount; effectIndex++) {
			if (instrument.effects[effectIndex] == null) continue;
			const effect: Effect = instrument.effects[effectIndex] as Effect;

			this.panSliderInputBoxes[effectIndex].value = effect.pan + "";
		}
		//this.render();
	}

	private _switchEQFilterType = (simpleFilter: boolean, effect: Effect): void => {
		const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
		this._doc.record(new ChangeEQFilterType(this._doc, effect, instrument, simpleFilter));
		this.render(true)
	}

	public render(forceRender: boolean = false): void {
		const instrument: Instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];

		if (instrument.effects.length != this.container.children.length || forceRender) {
			this.container.replaceChildren();
			for (let effectIndex: number = 0; effectIndex < instrument.effectCount; effectIndex++) {
				if (instrument.effects[effectIndex] == null) continue;
				const effect: Effect = instrument.effects[effectIndex] as Effect;

				const moveupButton: HTMLButtonElement = HTML.button({ type: "button", class: "moveup-effect", style: "width: 16px; height: 70%; font-size: small; flex: 1; margin-left:0.2em;" }, "🞁");
				const movedownButton: HTMLButtonElement = HTML.button({ type: "button", class: "movedown-effect", style: "width: 16px; height: 70%; font-size: small; flex: 1; margin-left:0.2em;" }, "🞃");
				const minimizeButton: HTMLButtonElement = HTML.button({ type: "button", class: "minimize-effect", style: "width: 16px; height: 70%; font-size: small; flex: 1; margin-left:0.2em;" }, "-");
				const deleteButton: HTMLButtonElement = HTML.button({ type: "button", class: "delete-effect", style: "width: 16px; height: 70%; font-size: small; flex: 1; margin-left:0.2em;" }, "x");

				const effectButtonsText: HTMLDivElement = HTML.div({ style: `width: 50%; color: ${ColorConfig.secondaryText};` }, Config.effectDisplayNames[effect.type]);

				const chorusSlider: Slider = new Slider(HTML.input({ value: effect.chorus, type: "range", min: 0, max: Config.chorusRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeChorus(this._doc, effect, newValue), false);
				const reverbSlider: Slider = new Slider(HTML.input({ value: effect.reverb, type: "range", min: 0, max: Config.reverbRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeReverb(this._doc, effect, newValue), false);
				const ringModWaveSelect: HTMLSelectElement = buildOptions(HTML.select(), Config.operatorWaves.map(wave => wave.name));
				const ringModSlider: Slider = new Slider(HTML.input({ value: effect.ringModulation, type: "range", min: 0, max: Config.ringModRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeRingMod(this._doc, effect, newValue), false);
				const ringModHzSlider: Slider = new Slider(HTML.input({ value: effect.ringModulationHz, type: "range", min: 0, max: Config.ringModHzRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeRingModHz(this._doc, effect, newValue), false);
				const granularSlider: Slider = new Slider(HTML.input({ value: effect.granular, type: "range", min: 0, max: Config.granularRange, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeGranular(this._doc, effect, newValue), false);
				const grainSizeSlider: Slider = new Slider(HTML.input({ value: effect.grainSize, type: "range", min: Config.grainSizeMin / Config.grainSizeStep, max: Config.grainSizeMax / Config.grainSizeStep, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainSize(this._doc, effect, newValue), false);
				const grainAmountsSlider: Slider = new Slider(HTML.input({ value: effect.grainAmounts, type: "range", min: "0", max: Config.grainAmountsMax, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainAmounts(this._doc, effect, newValue), false);
				const grainRangeSlider: Slider = new Slider(HTML.input({ value: effect.grainRange, type: "range", min: "0", max: Config.grainRangeMax, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainRange(this._doc, effect, newValue), false);
				const echoSustainSlider: Slider = new Slider(HTML.input({ value: effect.echoSustain, type: "range", min: 0, max: Config.echoSustainRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoSustain(this._doc, effect, newValue), false);
				const echoDelaySlider: Slider = new Slider(HTML.input({ value: effect.echoDelay, type: "range", min: 0, max: Config.echoDelayRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoDelay(this._doc, effect, newValue), false);
				const echoPingPongSlider: Slider = new Slider(HTML.input({ value: effect.echoPingPong, type: "range", min: 0, max: Config.panMax, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoPingPong(this._doc, effect, newValue), false);
				const panSlider: Slider = new Slider(HTML.input({ value: effect.pan, type: "range", min: 0, max: Config.panMax, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangePan(this._doc, effect, newValue), true);
				const panSliderInputBox: HTMLInputElement = HTML.input({ style: "width: 4em; font-size: 80%; ", id: "panSliderInputBox", type: "number", step: "1", min: "0", max: "100", value: effect.pan.toString() });
				const panDelaySlider: Slider = new Slider(HTML.input({ value: effect.panDelay, type: "range", min: 0, max: Config.modulators.dictionary["pan delay"].maxRawVol, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangePanDelay(this._doc, effect, newValue), false);
				const panModeSelect: HTMLSelectElement = buildOptions(HTML.select(), ["stereo", "split stereo", "mono"]); //TODO: put this in SynthConfig.ts
				const distortionSlider: Slider = new Slider(HTML.input({ value: effect.distortion, type: "range", min: 0, max: Config.distortionRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeDistortion(this._doc, effect, newValue), false);
				const aliasingBox: HTMLInputElement = HTML.input({ type: "checkbox", style: "width: 1em; padding: 0; margin-right: 4em;" });
				const bitcrusherQuantizationSlider: Slider = new Slider(HTML.input({ value: effect.bitcrusherQuantization, type: "range", min: 0, max: Config.bitcrusherQuantizationRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeBitcrusherQuantization(this._doc, effect, newValue), false);
				const bitcrusherFreqSlider: Slider = new Slider(HTML.input({ value: effect.bitcrusherFreq, type: "range", min: 0, max: Config.bitcrusherFreqRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeBitcrusherFreq(this._doc, effect, newValue), false);
				const eqFilterSimpleButton: HTMLButtonElement = HTML.button({ style: "font-size: x-small; width: 50%; height: 40%", class: "no-underline", onclick: () => this._switchEQFilterType(true, effect) }, "simple");
				const eqFilterAdvancedButton: HTMLButtonElement = HTML.button({ style: "font-size: x-small; width: 50%; height: 40%", class: "last-button no-underline", onclick: () => this._switchEQFilterType(false, effect) }, "advanced");
				const eqFilterEditor: FilterEditor = new FilterEditor(this._doc, false, false, false, effectIndex);
				const eqFilterSimpleCutSlider: Slider = new Slider(HTML.input({ value: effect.eqFilterSimpleCut, type: "range", min: 0, max: Config.filterSimpleCutRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimpleCut(this._doc, effect, newValue), false);
				const eqFilterSimplePeakSlider: Slider = new Slider(HTML.input({ value: effect.eqFilterSimplePeak, type: "range", min: 0, max: Config.filterSimplePeakRange - 1, step: 1, style: "margin: 0;" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimplePeak(this._doc, effect, newValue), false);
				const eqFilterZoom: HTMLButtonElement = HTML.button({ style: "margin-left:0em; padding-left:0.2em; height:1.5em; max-width: 12px;", onclick: () => this._openPrompt("customEQFilterSettings", effectIndex) }, "+");

				setSelectedValue(ringModWaveSelect, effect.ringModWaveformIndex);
				setSelectedValue(panModeSelect, effect.panMode);
				panSliderInputBox.value = effect.pan + "";
				aliasingBox.checked = instrument.aliases ? true : false;

				const effectButtonsRow: HTMLDivElement = HTML.div({ class: "selectRow", style: `padding-left:2em; max-width: 70%; height: 20%;` }, effectButtonsText, moveupButton, movedownButton, minimizeButton, deleteButton);
				const chorusRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("chorus") }, "Chorus:"), chorusSlider.container);
				const reverbRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("reverb") }, "Reverb:"), reverbSlider.container);
				const ringModWaveRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("ringModHz") }, "Wave:"), HTML.div({ class: "selectContainer" }, ringModWaveSelect));
				const ringModRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("ringMod") }, "Ring Mod:"), ringModSlider.container);
				const ringModHzRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("ringModHz") }, "Hertz:"), ringModHzSlider.container);
				const granularRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("granular") }, "Granular:"), granularSlider.container);
				const grainSizeRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("grainSize") }, "Grain Size:"), grainSizeSlider.container);
				const grainAmountsRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("grainAmounts") }, "Grain Amount:"), grainAmountsSlider.container);
				const grainRangeRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("grainRange") }, "Grain Range:"), grainRangeSlider.container);
				const echoSustainRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("echo") }, "Echo:"), echoSustainSlider.container);
				const echoDelayRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("echoDelay") }, "Echo Delay:"), echoDelaySlider.container);
				const echoPingPongRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("echoDelay") }, "Ping Pong:"), echoPingPongSlider.container);
				const panRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.div({}, HTML.span({ class: "tip", tabindex: "0", style: "height:1em; font-size: smaller;", onclick: () => this._openPrompt("pan") }, "Pan: "), HTML.div({ style: "color: " + ColorConfig.secondaryText + "; margin-top: -3px;" }, panSliderInputBox)), panSlider.container);
				const panDelayRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("panDelay") }, "Pan Delay:"), panDelaySlider.container);
				const panModeRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("panMode") }, "Pan Mode:"), HTML.div({ class: "selectContainer" }, panModeSelect));
				const distortionRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("distortion") }, "Distortion:"), distortionSlider.container);
				const aliasingRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("aliasing") }, "Aliasing:"), aliasingBox);
				const bitcrusherQuantizationRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("bitcrusherQuantization") }, "Bit Crush:"), bitcrusherQuantizationSlider.container);
				const bitcrusherFreqRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("bitcrusherFreq") }, "Freq Crush:"), bitcrusherFreqSlider.container);
				const eqFilterButtonsRow: HTMLElement = HTML.div({ class: "selectRow", style: "display: none; padding-top: 4px; margin-bottom: 0px;" }, HTML.span({ style: "font-size: x-small;", class: "tip", onclick: () => this._openPrompt("filterType") }, "Post EQ Type:"), HTML.div({ class: "instrument-bar" }, eqFilterSimpleButton, eqFilterAdvancedButton));
				const eqFilterEditorRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("eqFilter") }, "Post EQ:"), eqFilterZoom,  eqFilterEditor.container);
				const eqFilterSimpleCutRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("filterCutoff") }, "Filter Cut:"), eqFilterSimpleCutSlider.container);
				const eqFilterSimplePeakRow: HTMLDivElement = HTML.div({ class: "selectRow", style: "display: none;" }, HTML.span({ class: "tip", onclick: () => this._openPrompt("filterPeak") }, "Filter Peak:"), eqFilterSimplePeakSlider.container);

				if (this.renderEffectRows[effectIndex] == null) this.renderEffectRows[effectIndex] = true

				if (this.renderEffectRows[effectIndex]) {
					if (effect.type == EffectType.reverb) {
						reverbRow.style.display = "";
					} else if (effect.type == EffectType.chorus) {
						chorusRow.style.display = "";
					} else if (effect.type == EffectType.ringModulation) {
						ringModRow.style.display = "";
						ringModHzRow.style.display = "";
						ringModWaveRow.style.display = "";
					} else if (effect.type == EffectType.granular) {
						granularRow.style.display = "";
						grainSizeRow.style.display = "";
						grainAmountsRow.style.display = "";
						grainRangeRow.style.display = "";
					} else if (effect.type == EffectType.echo) {
						echoSustainRow.style.display = "";
						echoDelayRow.style.display = "";
						echoPingPongRow.style.display = "";
					} else if (effect.type == EffectType.panning) {
						panRow.style.display = "";
						panDelayRow.style.display = "";
						panModeRow.style.display = "";
					} else if (effect.type == EffectType.distortion) {
						distortionRow.style.display = "";
						aliasingRow.style.display = "";
					} else if (effect.type == EffectType.bitcrusher) {
						bitcrusherQuantizationRow.style.display = "";
						bitcrusherFreqRow.style.display = "";
					} else if (effect.type == EffectType.eqFilter) {
						eqFilterButtonsRow.style.display = "";
						if (effect.eqFilterType) {
							eqFilterSimpleButton.classList.remove("deactivated");
							eqFilterAdvancedButton.classList.add("deactivated");
							eqFilterEditorRow.style.display = "none";
							eqFilterSimpleCutRow.style.display = "";
							eqFilterSimplePeakRow.style.display = "";
						} else {
							eqFilterSimpleButton.classList.add("deactivated");
							eqFilterAdvancedButton.classList.remove("deactivated");
							eqFilterEditorRow.style.display = "";
							eqFilterEditor.render();
							eqFilterSimpleCutRow.style.display = "none";
							eqFilterSimplePeakRow.style.display = "none";
						}
					}
				}

				const row: HTMLDivElement = HTML.div({ class: "effect-row" },
					effectButtonsRow,
					chorusRow,
					reverbRow,
					ringModRow,
					ringModHzRow,
					ringModWaveRow,
					granularRow,
					grainSizeRow,
					grainAmountsRow,
					grainRangeRow,
					echoSustainRow,
					echoDelayRow,
					echoPingPongRow,
					panRow,
					panDelayRow,
					panModeRow,
					distortionRow,
					aliasingRow,
					bitcrusherQuantizationRow,
					bitcrusherFreqRow,
					eqFilterButtonsRow,
					eqFilterEditorRow,
					eqFilterSimpleCutRow,
					eqFilterSimplePeakRow,
				);

				this.container.appendChild(row);

				this._rows[effectIndex] = row;

				this.moveupButtons[effectIndex] = moveupButton;
				this.movedownButtons[effectIndex] = movedownButton;
				this.minimizeButtons[effectIndex] = minimizeButton;
				this.deleteButtons[effectIndex] = deleteButton;

				this.chorusSliders[effectIndex] = chorusSlider;
				this.reverbSliders[effectIndex] = reverbSlider;
				this.ringModWaveSelects[effectIndex] = ringModWaveSelect;
				this.ringModSliders[effectIndex] = ringModSlider;
				this.ringModHzSliders[effectIndex] = ringModHzSlider;
				this.granularSliders[effectIndex] = granularSlider;
				this.grainSizeSliders[effectIndex] = grainSizeSlider;
				this.grainAmountsSliders[effectIndex] = grainAmountsSlider;
				this.grainRangeSliders[effectIndex] = grainRangeSlider;
				this.echoSustainSliders[effectIndex] = echoSustainSlider;
				this.echoDelaySliders[effectIndex] = echoDelaySlider;
				this.echoPingPongSliders[effectIndex] = echoPingPongSlider;
				this.panSliders[effectIndex] = panSlider;
				this.panSliderInputBoxes[effectIndex] = panSliderInputBox;
				this.panDelaySliders[effectIndex] = panDelaySlider;
				this.panModeSelects[effectIndex] = panModeSelect;
				this.distortionSliders[effectIndex] = distortionSlider;
				this.aliasingBoxes[effectIndex] = aliasingBox;
				this.bitcrusherQuantizationSliders[effectIndex] = bitcrusherQuantizationSlider;
				this.bitcrusherFreqSliders[effectIndex] = bitcrusherFreqSlider;
				this.eqFilterSimpleButtons[effectIndex] = eqFilterSimpleButton;
				this.eqFilterAdvancedButtons[effectIndex] = eqFilterAdvancedButton;
				this.eqFilterEditors[effectIndex] = eqFilterEditor;
				this.eqFilterSimpleCutSliders[effectIndex] = eqFilterSimpleCutSlider;
				this.eqFilterSimplePeakSliders[effectIndex] = eqFilterSimplePeakSlider;

				//TODO: re-order, minimize, and delete buttons

				/*
				t his._panSliderInputBox.addEventListener("input", () => { this._doc.record(new ChangePan(this._doc, this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()].pan, Math.min(100.0, Math.max(0.0, Math.round(+this._panSliderIn*putBox.value))))) });

				private readonly _eqFilterSimpleButton: HTMLButtonElement = button({ style: "font-size: x-small; width: 50%; height: 40%", class: "no-underline", onclick: () => this._switchEQFilterType(true) }, "simple");
				private readonly _eqFilterAdvancedButton: HTMLButtonElement = button({ style: "font-size: x-small; width: 50%; height: 40%", class: "last-button no-underline", onclick: () => this._switchEQFilterType(false) }, "advanced");
				private readonly _eqFilterTypeRow: HTMLElement = div({ class: "selectRow", style: "padding-top: 4px; margin-bottom: 0px;" }, span({ style: "font-size: x-small;", class: "tip", onclick: () => this._openPrompt("filterType") }, "Post EQ Type:"), div({ class: "instrument-bar" }, this._eqFilterSimpleButton, this._eqFilterAdvancedButton));
				private readonly _eqFilterEditor: FilterEditor = new FilterEditor(this._doc);
				private readonly _eqFilterZoom: HTMLButtonElement = button({ style: "margin-left:0em; padding-left:0.2em; height:1.5em; max-width: 12px;", onclick: () => this._openPrompt("customEQFilterSettings") }, "+");
				private readonly _eqFilterRow: HTMLElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("eqFilter") }, "Post EQ:"), this._eqFilterZoom, this._eqFilterEditor.container);
				private readonly _eqFilterSimpleCutSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.filterSimpleCutRange - 1, value: "6", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimpleCut(this._doc, oldValue, newValue), false);
				private _eqFilterSimpleCutRow: HTMLDivElement = div({ class: "selectRow", title: "Low-pass Filter Cutoff Frequency" }, span({ class: "tip", onclick: () => this._openPrompt("filterCutoff") }, "Filter Cut:"), this._eqFilterSimpleCutSlider.container);
				private readonly _eqFilterSimplePeakSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.filterSimplePeakRange - 1, value: "6", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimplePeak(this._doc, oldValue, newValue), false);
				private _eqFilterSimplePeakRow: HTMLDivElement = div({ class: "selectRow", title: "Low-pass Filter Peak Resonance" }, span({ class: "tip", onclick: () => this._openPrompt("filterResonance") }, "Filter Peak:"), this._eqFilterSimplePeakSlider.container);

				private readonly _eqFilterSimpleButton: HTMLButtonElement = button({ style: "font-size: x-small; width: 50%; height: 40%", class: "no-underline", onclick: () => this._switchEQFilterType(true) }, "simple");
				private readonly _eqFilterAdvancedButton: HTMLButtonElement = button({ style: "font-size: x-small; width: 50%; height: 40%", class: "last-button no-underline", onclick: () => this._switchEQFilterType(false) }, "advanced");
				private readonly _eqFilterTypeRow: HTMLElement = div({ class: "selectRow", style: "padding-top: 4px; margin-bottom: 0px;" }, span({ style: "font-size: x-small;", class: "tip", onclick: () => this._openPrompt("filterType") }, "Post EQ Type:"), div({ class: "instrument-bar" }, this._eqFilterSimpleButton, this._eqFilterAdvancedButton));
				private readonly _eqFilterEditor: FilterEditor = new FilterEditor(this._doc);
				private readonly _eqFilterZoom: HTMLButtonElement = button({ style: "margin-left:0em; padding-left:0.2em; height:1.5em; max-width: 12px;", onclick: () => this._openPrompt("customEQFilterSettings") }, "+");
				private readonly _eqFilterRow: HTMLElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("eqFilter") }, "Post EQ:"), this._eqFilterZoom, this._eqFilterEditor.container);
				private readonly _eqFilterSimpleCutSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.filterSimpleCutRange - 1, value: "6", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimpleCut(this._doc, oldValue, newValue), false);
				private _eqFilterSimpleCutRow: HTMLDivElement = div({ class: "selectRow", title: "Low-pass Filter Cutoff Frequency" }, span({ class: "tip", onclick: () => this._openPrompt("filterCutoff") }, "Filter Cut:"), this._eqFilterSimpleCutSlider.container);
				private readonly _eqFilterSimplePeakSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.filterSimplePeakRange - 1, value: "6", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEQFilterSimplePeak(this._doc, oldValue, newValue), false);
				private _eqFilterSimplePeakRow: HTMLDivElement = div({ class: "selectRow", title: "Low-pass Filter Peak Resonance" }, span({ class: "tip", onclick: () => this._openPrompt("filterResonance") }, "Filter Peak:"), this._eqFilterSimplePeakSlider.container);

				private readonly _distortionSlider: Slider = new Slider(input({ style: "margin: 0; position: sticky;", type: "range", min: "0", max: Config.distortionRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeDistortion(this._doc, oldValue, newValue), false);
				private readonly _distortionRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("distortion") }, "Distortion:"), this._distortionSlider.container);
				private readonly _aliasingBox: HTMLInputElement = input({ type: "checkbox", style: "width: 1em; padding: 0; margin-right: 4em;" });
				private readonly _aliasingRow: HTMLElement = div({ class: "selectRow" }, span({ class: "tip", style: "margin-left:10px;", onclick: () => this._openPrompt("aliases") }, "Aliasing:"), this._aliasingBox);

				private readonly _bitcrusherQuantizationSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.bitcrusherQuantizationRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeBitcrusherQuantization(this._doc, oldValue, newValue), false);
				private readonly _bitcrusherQuantizationRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("bitcrusherQuantization") }, "Bit Crush:"), this._bitcrusherQuantizationSlider.container);
				private readonly _bitcrusherFreqSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.bitcrusherFreqRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeBitcrusherFreq(this._doc, oldValue, newValue), false);
				private readonly _bitcrusherFreqRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("bitcrusherFreq") }, "Freq Crush:"), this._bitcrusherFreqSlider.container);

				const _ringModWaveSelect: HTMLSelectElement = buildOptions(select({}), Config.operatorWaves.map(wave => wave.name));
				const _ringModSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.ringModRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeRingMod(this._doc, oldValue, newValue), false);
				const _ringModRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("ringMod") }, "Ring Mod:"), this._ringModSlider.container);
				const _ringModHzSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.ringModHzRange - 1, value: (Config.ringModHzRange - (Config.ringModHzRange / 2)), step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeRingModHz(this._doc, oldValue, newValue), true);
				public readonly ringModHzNum: HTMLParagraphElement = div({ style: "font-size: 80%; ", id: "ringModHzNum" });
				const _ringModHzSliderRow: HTMLDivElement = div({ class: "selectRow", style: "width:100%;" }, div({ style: "display:flex; flex-direction:column; align-items:center;" },
				span({ class: "tip", style: "font-size: smaller;", onclick: () => this._openPrompt("RingModHz") }, "Hertz: "),
				div({ style: `color: ${ColorConfig.secondaryText}; ` }, this.ringModHzNum),
				), this._ringModHzSlider.container);
				const _ringModWaveText: HTMLSpanElement = span({ class: "tip", onclick: () => this._openPrompt("chipWave") }, "Wave: ")
				const _ringModWaveSelectRow: HTMLDivElement = div({ class: "selectRow", style: "width: 100%;" }, this._ringModWaveText, div({ class: "selectContainer", style: "width:40%;" }, this._ringModWaveSelect));
				const _ringModContainerRow: HTMLDivElement = div({ class: "", style: "display:flex; flex-direction:column;" },
				this._ringModRow,
				this._ringModHzSliderRow,
				// this._rmOffsetHzSliderRow,
				this._ringModWaveSelectRow);

				const _granularSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.granularRange, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeGranular(this._doc, oldValue, newValue), false);
				const _granularRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("granular") }, "Granular:"), this._granularSlider.container);
				const _grainSizeSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: Config.grainSizeMin / Config.grainSizeStep, max: Config.grainSizeMax / Config.grainSizeStep, value: Config.grainSizeMin / Config.grainSizeStep, step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainSize(this._doc, oldValue, newValue), false);
				public readonly grainSizeNum: HTMLParagraphElement = div({ style: "font-size: 80%; ", id: "grainSizeNum" });
				const _grainSizeSliderRow: HTMLDivElement = div({ class: "selectRow", style: "width:100%;" }, div({ style: "display:flex; flex-direction:column; align-items:center;" },
				span({ class: "tip", style: "font-size: smaller;", onclick: () => this._openPrompt("grainSize") }, "Grain: "),
				div({ style: `color: ${ColorConfig.secondaryText}; ` }, this.grainSizeNum),
				), this._grainSizeSlider.container);
				const _grainAmountsSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.grainAmountsMax, value: 8, step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainAmounts(this._doc, oldValue, newValue), false);
				const _grainAmountsRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("grainAmount") }, "Grain Freq:"), this._grainAmountsSlider.container);
				const _grainRangeSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.grainRangeMax / Config.grainSizeStep, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeGrainRange(this._doc, oldValue, newValue), false);
				public readonly grainRangeNum: HTMLParagraphElement = div({ style: "font-size: 80%; ", id: "grainRangeNum" });
				const _grainRangeSliderRow: HTMLDivElement = div({ class: "selectRow", style: "width:100%;" }, div({ style: "display:flex; flex-direction:column; align-items:center;" },
				span({ class: "tip", style: "font-size: smaller;", onclick: () => this._openPrompt("grainRange") }, "Range: "),
				div({ style: `color: ${ColorConfig.secondaryText}; ` }, this.grainRangeNum),
				), this._grainRangeSlider.container);
				const _granularContainerRow: HTMLDivElement = div({ class: "", style: "display:flex; flex-direction:column;" },
				this._granularRow,
				this._grainAmountsRow,
				this._grainSizeSliderRow,
				this._grainRangeSliderRow
				);

				const _echoSustainSlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.echoSustainRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoSustain(this._doc, oldValue, newValue), false);
				const _echoSustainRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("echoSustain") }, "Echo:"), this._echoSustainSlider.container);
				const _echoDelaySlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.echoDelayRange - 1, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoDelay(this._doc, oldValue, newValue), false);
				const _echoDelayRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("echoDelay") }, "Echo Delay:"), this._echoDelaySlider.container);
				const _echoPingPongSlider: Slider = new Slider(input({ style: "margin: 0; position: sticky;", type: "range", min: "0", max: Config.panMax, value: Config.panCenter, step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangeEchoPingPong(this._doc, oldValue, newValue), true);
				const _echoPingPongRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("echoPingPong") }, "Ping-Pong:"), this._echoPingPongSlider.container);

				private readonly _panSlider: Slider = new Slider(input({ style: "margin: 0; position: sticky;", type: "range", min: "0", max: Config.panMax, value: Config.panCenter, step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangePan(this._doc, oldValue, newValue), true);
				private readonly _panDropdown: HTMLButtonElement = button({ style: "margin-left:0em; height:1.5em; width: 10px; padding: 0px; font-size: 8px;", onclick: () => this._toggleDropdownMenu(DropdownID.Pan) }, "▼");
				private readonly _panSliderInputBox: HTMLInputElement = input({ style: "width: 4em; font-size: 80%;", id: "panSliderInputBox", type: "number", step: "1", min: "0", max: "100", value: "0" });
				private readonly _panSliderRow: HTMLDivElement = div({ class: "selectRow" }, div({},
				span({ class: "tip", tabindex: "0", style: "height:1em; font-size: smaller;", onclick: () => this._openPrompt("pan") }, "Pan: "),
				div({ style: "color: " + ColorConfig.secondaryText + "; margin-top: -3px;" }, this._panSliderInputBox),
				), this._panDropdown, this._panSlider.container);
				private readonly _panDelaySlider: Slider = new Slider(input({ style: "margin: 0;", type: "range", min: "0", max: Config.modulators.dictionary["pan delay"].maxRawVol, value: "0", step: "1" }), this._doc, (oldValue: number, newValue: number) => new ChangePanDelay(this._doc, oldValue, newValue), false);
				private readonly _panDelayRow: HTMLElement = div({ class: "selectRow dropFader" }, span({ class: "tip", style: "margin-left:4px;", onclick: () => this._openPrompt("panDelay") }, "‣ Delay:"), this._panDelaySlider.container);
				private readonly _panModeSelect = buildOptions(select(), ["stereo", "split stereo", "mono"]);
				private readonly _panModeSelectRow: HTMLDivElement = div({ class: "selectRow" }, span({ class: "tip", onclick: () => this._openPrompt("panMode") }, "‣ Mode: "), div({ class: "selectContainer" }, this._panModeSelect));
				private readonly _panDropdownGroup: HTMLElement = div({ class: "editor-controls", style: "display: none;" }, this._panDelayRow, this._panModeSelectRow);
				*/
			}
		}
	}
}
