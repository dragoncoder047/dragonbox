// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { Effect } from "../synth/Effect";
import { FilterControlPoint, FilterSettings } from "../synth/Filter";
import { FilterCoefficients, FrequencyResponse } from "../synth/filtering";
import { Instrument } from "../synth/Instrument";
import { Song } from "../synth/Song";
import { Config, FilterType } from "../synth/SynthConfig";
import { ChangeSequence, UndoableChange } from "./Change";
import { ChangeFilterAddPoint, ChangeFilterMovePoint, ChangeFilterSettings, ChangeSongFilterAddPoint, ChangeSongFilterMovePoint, ChangeSongFilterSettings } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { prettyNumber } from "./EditorConfig";
import { SongDocument } from "./SongDocument";

export class FilterEditor {
    private _editorWidth = 120;
    private _editorHeight = 26;
    private readonly _responsePath = SVG.path({ fill: ColorConfig.uiWidgetBackground, "pointer-events": "none" });
    //private readonly _octaves = SVG.svg({"pointer-events": "none", overflow: "visible"});
    private _indicators: SVGTextElement[] = [];
    private _subFilters: FilterSettings[] = [];
    private _writingMods = false;
    private readonly _controlPointPath = SVG.path({ fill: "currentColor", "pointer-events": "none" });
    private readonly _dottedLinePath = SVG.path({ fill: "none", stroke: "currentColor", "stroke-width": 1, "stroke-dasharray": "3, 2", "pointer-events": "none" });
    private readonly _highlight = SVG.circle({ fill: "white", stroke: "none", "pointer-events": "none", r: 4 });
    private readonly _svg = SVG.svg({ style: `background-color: ${ColorConfig.editorBackground}; touch-action: none;`, width: "100%", height: "100%", viewBox: "0 0 " + this._editorWidth + " " + this._editorHeight, preserveAspectRatio: "none" },
        this._responsePath,
        //this._octaves,
        this._dottedLinePath,
        this._highlight,
        this._controlPointPath,
    );
    private selfUndoSettings: String[] = [];
    private selfUndoHistoryPos = 0;
    private readonly _label = HTML.div({ style: "position: absolute; bottom: 0; left: 2px; font-size: 8px; line-height: 1; pointer-events: none;" });

    coordText: HTMLElement | null = null;
    readonly container = HTML.div({ class: "filterEditor", style: "height: 100%; position: relative;" },
        this._svg,
        this._label,
    );
    private _pointRadius = 2;

    private _useNoteFilter = false;
    private _effectIndex = 0;
    private _larger = false;
    private _touchMode = false;
    private _mouseX = 0;
    private _mouseY = 0;
    private _mouseOver = false;
    private _mouseDown = false;
    private _mouseDragging = false;
    private _addingPoint = false;
    private _deletingPoint = false;
    private _addedType = FilterType.peak;
    private _selectedIndex = 0;
    private _freqStart = 0;
    private _gainStart = 0;
    private _dragChange: UndoableChange | null = null;
    private _subfilterIndex = 0;

    private _filterSettings: FilterSettings;
    private _useFilterSettings: FilterSettings;
    private _renderedSelectedIndex = -1;
    private _renderedPointCount = -1;
    private _renderedPointTypes = -1;
    private _renderedPointFreqs = -1;
    private _renderedPointGains = -1;
    //private _renderedKey = -1;

    private _forSong = false;

    constructor(private _doc: SongDocument, useNoteFilter = false, larger = false, forSong = false, effectIndex = 0) {
        this._useNoteFilter = useNoteFilter;
        this._effectIndex = effectIndex;
        this._larger = larger;
        this._forSong = forSong;

        if (this._larger) {
            this.container.addEventListener("keydown", this._whenKeyPressed)
            this._editorWidth = 1200;
            this._editorHeight = 260;
            this._pointRadius = 14;
            // A bit of vertical spacing on viewBox so that numbers will show.
            this._svg.setAttribute("viewBox", "0 -20 " + this._editorWidth + " " + (this._editorHeight + 30));
            this._label.style.setProperty("font-size", "16px");
            this._label.style.setProperty("position", "");
            this._label.style.setProperty("bottom", "-16px");
            this._label.style.setProperty("min-height", "1em");
            this._dottedLinePath.style.setProperty("stroke-width", "3");
            this._dottedLinePath.style.setProperty("stroke-dasharray", "6, 4");
            this._dottedLinePath.setAttribute("color", ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[this._doc.channel].color, this._doc.channel, this._doc.prefs.fixChannelColorOrder).primaryNote);
            this.container.style.setProperty("width", "85%");
            this._highlight.setAttribute("r", "20");
            this._controlPointPath.setAttribute("fill", ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[this._doc.channel].color, this._doc.channel, this._doc.prefs.fixChannelColorOrder).primaryNote);

            for (let i = 0; i < Config.filterMaxPoints; i++) {
                this._indicators[i] = SVG.text();
                this._indicators[i].setAttribute("fill", ColorConfig.invertedText);
                this._indicators[i].setAttribute("text-anchor", "start");
                this._indicators[i].setAttribute("dominant-baseline", "central");
                this._indicators[i].setAttribute("pointer-events", "none");
                this._indicators[i].setAttribute("font-weight", "bolder");
                this._indicators[i].textContent = "" + (i + 1);
                this._indicators[i].style.setProperty("display", "none");
                this._indicators[i].style.setProperty("font-size", "24px");
                this._svg.appendChild(this._indicators[i]);
            }

            // Push initial state
            let filterSettings: FilterSettings;
            const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const effect = <Effect>instrument.effects[effectIndex];
            if (this._forSong) {
                filterSettings = this._doc.song.eqFilter;
            } else {
                filterSettings = this._useNoteFilter ? instrument.noteFilter : effect.eqFilter;
            }
            this.selfUndoSettings.push(JSON.stringify(filterSettings.toJsonObject()));

            this._subFilters[0] = filterSettings;
            for (let i = 1; i < Config.filterMorphCount; i++) {
                if (this._forSong) {
                    const subFilter: FilterSettings | null = this._doc.song.eqSubFilters[i];
                    if (subFilter != null) {
                        let parsedFilter = new FilterSettings();
                        parsedFilter.fromJsonObject(subFilter.toJsonObject());
                        this._subFilters[i] = parsedFilter;
                    }
                } else {
                    const subFilter: FilterSettings | null = this._useNoteFilter ? instrument.noteSubFilters[i] : effect.eqSubFilters[i];
                    if (subFilter != null) {
                        let parsedFilter = new FilterSettings();
                        parsedFilter.fromJsonObject(subFilter.toJsonObject());
                        this._subFilters[i] = parsedFilter;
                    }
                }
            }
        }

        this.container.addEventListener("mousedown", this._whenMousePressed);
        this.container.addEventListener("mouseover", this._whenMouseOver);
        this.container.addEventListener("mouseout", this._whenMouseOut);
        document.addEventListener("mousemove", this._whenMouseMoved);
        document.addEventListener("mouseup", this._whenCursorReleased);

        this.container.addEventListener("touchstart", this._whenTouchPressed);
        this.container.addEventListener("touchmove", this._whenTouchMoved);
        this.container.addEventListener("touchend", this._whenCursorReleased);
        this.container.addEventListener("touchcancel", this._whenCursorReleased);
    }

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if (event.keyCode == 90) { // z
            this.undo();
            event.stopPropagation();
        }
        if (event.keyCode == 89) { // y
            this.redo();
            event.stopPropagation();
        }
    }

    private _xToFreq(x: number): number {
        return Config.filterFreqRange * x / this._editorWidth - 0.5;
    }
    private _freqToX(freq: number): number {
        return this._editorWidth * (freq + 0.5) / Config.filterFreqRange;
    }
    private _yToGain(y: number): number {
        return (Config.filterGainRange - 1) * (1 - (y - .5) / (this._editorHeight - 1));
    }
    private _gainToY(gain: number): number {
        return (this._editorHeight - 1) * (1 - gain / (Config.filterGainRange - 1)) + .5;
    }

    private _whenMouseOver = (event: MouseEvent): void => {
        this._mouseOver = true;

        if (!this._larger)
            this._controlPointPath.style.setProperty("fill", "currentColor");
    }

    private _whenMouseOut = (event: MouseEvent): void => {
        this._mouseOver = false;
        this._updatePath();

        if (this.coordText != null) {
            this.coordText.innerText = "";
        }
    }

    private _whenMousePressed = (event: MouseEvent): void => {
        event.preventDefault();
        this._touchMode = false;
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorPressed();
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        event.preventDefault();
        this._touchMode = true;
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorPressed();
    }

    private _whenMouseMoved = (event: MouseEvent): void => {
        if (this.container.offsetParent == null) return;
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        if (!this._mouseDown) this._updateCursor();

        this._whenCursorMoved();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (this.container.offsetParent == null) return;
        if (this._mouseDown) event.preventDefault();
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        if (!this._mouseDown) this._updateCursor();
        this._whenCursorMoved();
    }

    private _whenCursorPressed(): void {
        this._mouseDown = true;
        const sequence = new ChangeSequence();
        this._dragChange = sequence;
        this._doc.setProspectiveChange(this._dragChange);
        this._updateCursor();
        this._whenCursorMoved();
    }

    private _updateCursor(): void {
        this._freqStart = this._xToFreq(this._mouseX);
        this._gainStart = this._yToGain(this._mouseY);

        this._addingPoint = true;
        this._selectedIndex = -1;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (let i = 0; i < this._useFilterSettings.controlPointCount; i++) {
            const point = this._useFilterSettings.controlPoints[i];
            const distance = Math.sqrt(Math.pow(this._freqToX(point.freq) - this._mouseX, 2) + Math.pow(this._gainToY(point.gain) - this._mouseY, 2));
            if ((distance <= 13 * (1 + +this._larger) || this._useFilterSettings.controlPointCount >= Config.filterMaxPoints) && distance < nearestDistance) {
                nearestDistance = distance;
                this._selectedIndex = i;
                this._addingPoint = false;
            }
        }
        if (this._addingPoint) {
            const ratio = this._mouseX / this._editorWidth;
            if (ratio < 0.2) {
                this._addedType = FilterType.highPass;
            } else if (ratio < 0.8) {
                this._addedType = FilterType.peak;
            } else {
                this._addedType = FilterType.lowPass;
            }
        }
    }

    private _whenCursorMoved(): void {
        if (this._writingMods) {
            if (this._forSong) {
                this._useFilterSettings = this._getTargetFilterSettingsForSong(this._doc.song);
            } else {
                const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
                const effect = <Effect>instrument.effects[this._effectIndex];
                this._useFilterSettings = this._getTargetFilterSettings(instrument, effect);
            }
            if (this._dragChange != null) {
                if (this._dragChange instanceof ChangeSequence && this._dragChange.checkFirst() instanceof ChangeFilterMovePoint) {
                    const data = ((this._dragChange as ChangeSequence).checkFirst() as ChangeFilterMovePoint).getMoveData(true);
                    const newPoint: FilterControlPoint | null = this._useFilterSettings.controlPoints[this._selectedIndex];

                    if (newPoint == null || newPoint.type != data.point.type) {
                        this._dragChange = null;
                        this._writingMods = false;
                        this._mouseDown = false;
                    } else {
                        newPoint.freq = data.freq;
                        newPoint.gain = data.gain;
                    }
                } else if (this._forSong && this._dragChange instanceof ChangeSequence && this._dragChange.checkFirst() instanceof ChangeSongFilterMovePoint) {
                    const data = ((this._dragChange as ChangeSequence).checkFirst() as ChangeSongFilterMovePoint).getMoveData(true);
                    const newPoint: FilterControlPoint | null = this._useFilterSettings.controlPoints[this._selectedIndex];

                    if (newPoint == null || newPoint.type != data.point.type) {
                        this._dragChange = null;
                        this._writingMods = false;
                        this._mouseDown = false;
                    } else {
                        newPoint.freq = data.freq;
                        newPoint.gain = data.gain;
                    }
                } else {
                    this._dragChange = null;
                    this._writingMods = false;
                    this._mouseDown = false;
                }
            }
        }

        if (this._dragChange != null && (this._doc.lastChangeWas(this._dragChange) || this._writingMods)) {
            this._dragChange.undo();
        } else {
            this._mouseDown = false;
        }
        this._dragChange = null;
        this._deletingPoint = false;

        if (this.coordText != null && !this._mouseDown) {
            let gain = Math.round(this._yToGain(this._mouseY));
            let freq = Math.round(this._xToFreq(this._mouseX));
            if (freq >= 0 && freq < Config.filterFreqRange && gain >= 0 && gain < Config.filterGainRange)
                this.coordText.innerText = "(" + freq + ", " + gain + ")";
            else
                this.coordText.innerText = "";
        }

        if (this._mouseDown) {
            const sequence = new ChangeSequence();
            this._dragChange = sequence;
            this._doc.setProspectiveChange(this._dragChange);

            if (this._addingPoint) {
                const gain = Math.max(0, Math.min(Config.filterGainRange - 1, Math.round(this._yToGain(this._mouseY))));
                const freq = this._findNearestFreqSlot(this._useFilterSettings, this._xToFreq(this._mouseX), -1);
                if (freq >= 0 && freq < Config.filterFreqRange) {
                    const point = new FilterControlPoint();
                    point.type = this._addedType;
                    point.freq = freq;
                    point.gain = gain;

                    if (this._forSong) {
                        sequence.append(new ChangeSongFilterAddPoint(this._doc, this._useFilterSettings, point, this._useFilterSettings.controlPointCount));
                    } else {
                        sequence.append(new ChangeFilterAddPoint(this._doc, this._useFilterSettings, point, this._useFilterSettings.controlPointCount, this._useNoteFilter, this._effectIndex));
                    }

                    if (this.coordText != null) {
                        this.coordText.innerText = "(" + freq + ", " + gain + ")";
                    }
                } else {
                    this._deletingPoint = true;
                }
            } else if (this._selectedIndex >= this._useFilterSettings.controlPointCount || this._selectedIndex == -1) {
                this._dragChange = null;
                this._mouseDown = false;
            } else {
                const freqDelta = this._xToFreq(this._mouseX) - this._freqStart;
                const gainDelta = this._yToGain(this._mouseY) - this._gainStart;
                let point = this._useFilterSettings.controlPoints[this._selectedIndex];
                const gain = Math.max(0, Math.min(Config.filterGainRange - 1, Math.round(point.gain + gainDelta)));
                const freq = this._findNearestFreqSlot(this._useFilterSettings, point.freq + freqDelta, this._selectedIndex);

                if (Math.round(freqDelta) != 0.0 || Math.round(gainDelta) != 0.0 || freq != point.freq || gain != point.gain) {
                    this._mouseDragging = true;
                }

                if (freq >= 0 && freq < Config.filterFreqRange) {
                    if (this._forSong) {
                        sequence.append(new ChangeSongFilterMovePoint(this._doc, point, point.freq, freq, point.gain, gain, this._selectedIndex));
                    } else {
                        sequence.append(new ChangeFilterMovePoint(this._doc, point, point.freq, freq, point.gain, gain, this._useNoteFilter, this._effectIndex, this._selectedIndex));
                    }
                    if (this.coordText != null) {
                        this.coordText.innerText = "(" + freq + ", " + gain + ")";
                        if (!this._writingMods) {
                            if (this._forSong) {
                                this._doc.song.tmpEqFilterStart = this._doc.song.eqFilter;
                                this._doc.song.tmpEqFilterEnd = null;
                            } else {
                                const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
                                instrument.tmpNoteFilterStart = instrument.noteFilter;
                                instrument.tmpNoteFilterEnd = null;
                                let effect = instrument.effects[this._effectIndex] as Effect;
                                effect.tmpEqFilterStart = effect.eqFilter;
                                effect.tmpEqFilterEnd = null;
                            }
                        }
                    }
                } else {
                    if (this._forSong) {
                        sequence.append(new ChangeSongFilterAddPoint(this._doc, this._useFilterSettings, point, this._selectedIndex, true));
                    } else {
                        sequence.append(new ChangeFilterAddPoint(this._doc, this._useFilterSettings, point, this._selectedIndex, this._useNoteFilter, this._effectIndex, true));
                    }
                    this._deletingPoint = true;
                }
            }
        }
        if (this._mouseDown || this._mouseOver) {
            this._updatePath();
        }
    }

    private _whenCursorReleased = (event: Event): void => {
        if (this._writingMods) {
            if (this._forSong) {
                this._useFilterSettings = this._getTargetFilterSettingsForSong(this._doc.song);
            } else {
                const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
                const effect = <Effect>instrument.effects[this._effectIndex];
                this._useFilterSettings = this._getTargetFilterSettings(instrument, effect);
            }
        }

        if (this.container.offsetParent == null) return;
        if (this._mouseDown && (this._doc.lastChangeWas(this._dragChange) || this._writingMods) && this._dragChange != null) {
            if (!this._addingPoint && !this._mouseDragging && !this._touchMode) {
                if (this._selectedIndex < this._useFilterSettings.controlPointCount && this._selectedIndex != -1) {
                    const point = this._useFilterSettings.controlPoints[this._selectedIndex];
                    if (this._forSong) {
                        let change = new ChangeSongFilterAddPoint(this._doc, this._useFilterSettings, point, this._selectedIndex, true);
                        if (!this._larger) {
                                this._doc.record(change);
                            }
                    } else {
                        let change = new ChangeFilterAddPoint(this._doc, this._useFilterSettings, point, this._selectedIndex, this._useNoteFilter, this._effectIndex, true);
                        if (!this._larger) {
                                this._doc.record(change);
                            }
                    }
                }
            } else if (!this._larger) {
                this._doc.record(this._dragChange);
            }
            this._updatePath();
            if (this._larger) {
                this.selfUndoSettings.length = this.selfUndoHistoryPos + 1;
                this.selfUndoSettings.push(JSON.stringify(this._filterSettings.toJsonObject()));
                this.selfUndoHistoryPos++;
            }
        }
        this._dragChange = null;
        this._mouseDragging = false;
        this._deletingPoint = false;
        this._mouseDown = false;
        this._writingMods = false;
        this._updateCursor();
    }

    private _findNearestFreqSlot(filterSettings: FilterSettings, targetFreq: number, ignoreIndex: number): number {
        const roundedFreq = Math.round(targetFreq);
        let lowerFreq = roundedFreq;
        let upperFreq = roundedFreq;
        let tryingLower = (roundedFreq <= targetFreq);
        while (true) {
            let foundConflict = false;
            const currentFreq = tryingLower ? lowerFreq : upperFreq;
            for (let i = 0; i < filterSettings.controlPointCount; i++) {
                if (i == ignoreIndex) continue;
                if (filterSettings.controlPoints[i].freq == currentFreq) {
                    foundConflict = true;
                    break;
                }
            }
            if (!foundConflict) return currentFreq;
            tryingLower = !tryingLower;
            if (tryingLower) lowerFreq--;
            if (!tryingLower) upperFreq++;
        }
    }

    private static _circlePath(cx: number, cy: number, radius: number, reverse = false): string {
        return `M ${cx - radius} ${cy} ` +
            `a ${radius} ${radius} 0 1 ${reverse ? 1 : 0} ${radius * 2} 0 ` +
            `a ${radius} ${radius} 0 1 ${reverse ? 1 : 0} ${-radius * 2} 0 `;
    }

    private _updatePath(): void {
        this._highlight.style.display = "none";
        this._label.textContent = "";

        let controlPointPath = "";
        let dottedLinePath = "";
        for (let i = 0; i < this._useFilterSettings.controlPointCount; i++) {
            const point = this._useFilterSettings.controlPoints[i];
            const pointX = this._freqToX(point.freq);
            const pointY = this._gainToY(point.gain);

            controlPointPath += FilterEditor._circlePath(pointX, pointY, this._pointRadius);

            if (point.type == FilterType.highPass) {
                dottedLinePath += "M " + 0 + " " + pointY + " L " + pointX + " " + pointY + " ";
            } else if (point.type == FilterType.lowPass) {
                dottedLinePath += "M " + this._editorWidth + " " + pointY + " L " + pointX + " " + pointY + " ";
            }

            if (this._selectedIndex == i && this._mouseOver && !this._mouseDown) {
                this._highlight.setAttribute("cx", String(pointX));
                this._highlight.setAttribute("cy", String(pointY));
                this._highlight.style.display = "";

                if (this.coordText != null) {
                    this.coordText.innerText = "(" + point.freq + ", " + point.gain + ")";
                }
            }
            if ((this._selectedIndex == i || (this._addingPoint && this._mouseDown && i == this._useFilterSettings.controlPointCount - 1)) && (this._mouseOver || this._mouseDown) && !this._deletingPoint) {
                this._label.textContent = (i + 1) + ": " + Config.filterTypeNames[point.type] + (this._larger ? " @" + prettyNumber(point.getHz()) + "Hz" : "");
            }

            if (this._larger) {
                this._indicators[i].style.setProperty("display", "");
                this._indicators[i].setAttribute("x", "" + (pointX - 7));
                this._indicators[i].setAttribute("y", "" + (pointY + 2));
            }
        }
        this._controlPointPath.setAttribute("d", controlPointPath);
        this._dottedLinePath.setAttribute("d", dottedLinePath);
        if (this._addingPoint && !this._mouseDown && this._mouseOver) {
            this._label.textContent = "+ " + Config.filterTypeNames[this._addedType];
        }

        // Hide unused control point labels
        if (this._larger) {
            for (let i = this._useFilterSettings.controlPointCount; i < Config.filterMaxPoints; i++) {
                this._indicators[i].style.setProperty("display", "none");
            }
        }

        //let volumeCompensation = 1.0;
        const standardSampleRate = 44800;
        const filters: FilterCoefficients[] = [];
        for (let i = 0; i < this._useFilterSettings.controlPointCount; i++) {
            const point = this._useFilterSettings.controlPoints[i];
            const filter = new FilterCoefficients();
            point.toCoefficients(filter, standardSampleRate);
            filters.push(filter);
            //volumeCompensation *= point.getVolumeCompensationMult();
        }

        const response = new FrequencyResponse();
        let responsePath = "M 0 " + this._editorHeight + " ";
        for (let i = -1; i <= Config.filterFreqRange; i++) {
            const hz = FilterControlPoint.getHzFromSettingValue(i);
            const cornerRadiansPerSample = 2.0 * Math.PI * hz / standardSampleRate;
            const real = Math.cos(cornerRadiansPerSample);
            const imag = Math.sin(cornerRadiansPerSample);

            let linearGain = 1.0; //volumeCompensation;
            for (const filter of filters) {
                response.analyzeComplex(filter, real, imag);
                linearGain *= response.magnitude();
            }

            const gainSetting = Math.log2(linearGain) / Config.filterGainStep + Config.filterGainCenter;
            const y = this._gainToY(gainSetting);
            const x = this._freqToX(i);
            responsePath += "L " + prettyNumber(x) + " " + prettyNumber(y) + " ";
        }

        responsePath += "L " + this._editorWidth + " " + this._editorHeight + " L 0 " + this._editorHeight + " z ";
        this._responsePath.setAttribute("d", responsePath);
    }

    // Swap to new filter settings all at once.
    swapToSettings(settings: FilterSettings, useHistory = false) {
        if (this._forSong) {
            new ChangeSongFilterSettings(this._doc, settings, this._filterSettings, this._subFilters, this._doc.song.eqSubFilters);
        } else {
            const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const effect = <Effect>instrument.effects[this._effectIndex];
            new ChangeFilterSettings(this._doc, settings, this._filterSettings, this._useNoteFilter, this._effectIndex, this._subFilters, this._useNoteFilter ? instrument.noteSubFilters : effect.eqSubFilters);
        }
        this._filterSettings = settings;
        this._subFilters[this._subfilterIndex] = settings;
        if (useHistory && this._larger) {
            this.selfUndoSettings.length = this.selfUndoHistoryPos + 1;
            this.selfUndoSettings.push(JSON.stringify((this._filterSettings.toJsonObject())));
            this.selfUndoHistoryPos++;
        }
        this._useFilterSettings = this._filterSettings;
        this._updatePath();
    }

    // Save settings on prompt close (record a change from first settings to newest)
    saveSettings() {
        let firstFilter = new FilterSettings;
        firstFilter.fromJsonObject(JSON.parse(String(this.selfUndoSettings[0])));
        if (this._forSong) {
            this._doc.record(new ChangeSongFilterSettings(this._doc, this._subFilters[0], firstFilter, this._subFilters, this._doc.song.eqSubFilters), true);
        } else {
            const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
            const effect = <Effect>instrument.effects[this._effectIndex];
            this._doc.record(new ChangeFilterSettings(this._doc, this._subFilters[0], firstFilter, this._useNoteFilter, this._effectIndex, this._subFilters, this._useNoteFilter ? instrument.noteSubFilters : effect.eqSubFilters), true);
        }
    }

    // Self-undo history management
    // Returns the subfilter index to swap to, if any
    undo(): number {
        if (this.selfUndoHistoryPos > 0) {
            this.selfUndoHistoryPos--;
            // Jump back and load latest state of this subfilter. Also save subfilter settings for current index
            if (this.selfUndoSettings[this.selfUndoHistoryPos + 1] != null && this.selfUndoSettings[this.selfUndoHistoryPos + 1].startsWith("jmp")) {
                let str = this.selfUndoSettings[this.selfUndoHistoryPos + 1];
                let jumpIndex = +str.substring(3, str.indexOf("|"));
                this.swapToSubfilter(this._subfilterIndex, jumpIndex);
                return jumpIndex;
                // Jumping to FIRST state of this subfilter
            } else if (this.selfUndoSettings[this.selfUndoHistoryPos].startsWith("jmp")) {
                let savedFilter = new FilterSettings();
                let str = this.selfUndoSettings[this.selfUndoHistoryPos];
                savedFilter.fromJsonObject(JSON.parse(str.substring(str.indexOf(":") + 1)));
                this.swapToSettings(savedFilter, false);
            } else {
                let savedFilter = new FilterSettings();
                savedFilter.fromJsonObject(JSON.parse(String(this.selfUndoSettings[this.selfUndoHistoryPos])));
                this.swapToSettings(savedFilter, false);
            }
        }
        return -1;
    }

    // Returns the subfilter index to swap to, if any
    redo(): number {
        if (this.selfUndoHistoryPos < this.selfUndoSettings.length - 1) {
            this.selfUndoHistoryPos++;
            // Check if next index in undo queue is a command to jump to a new filter index
            if (this.selfUndoSettings[this.selfUndoHistoryPos].startsWith("jmp")) {
                let str = this.selfUndoSettings[this.selfUndoHistoryPos];
                let jumpIndex = +str.substring(str.indexOf("|") + 1, str.indexOf(":"));
                this.swapToSubfilter(this._subfilterIndex, jumpIndex, false);
                return jumpIndex;
            } else {
                let savedFilter = new FilterSettings();
                savedFilter.fromJsonObject(JSON.parse(String(this.selfUndoSettings[this.selfUndoHistoryPos])));
                this.swapToSettings(savedFilter, false);
            }
        }
        return -1;

    }

    resetToInitial() {
        this.selfUndoHistoryPos = 1;
        this.undo();
    }

    swapSubfilterIndices(newIndex: number) {
        if (this._selectedIndex == -1)
            return;

        if (newIndex >= this._useFilterSettings.controlPointCount)
            return;

        let tmp = this._useFilterSettings.controlPoints[this._selectedIndex];
        this._useFilterSettings.controlPoints[this._selectedIndex] = this._useFilterSettings.controlPoints[newIndex];
        this._useFilterSettings.controlPoints[newIndex] = tmp;

        this.render();
    }

    swapToSubfilter(oldIndex: number, newIndex: number, useHistory = false) {
        if (oldIndex != newIndex) {
            // Save current subfilter
            let currFilter = new FilterSettings();
            currFilter.fromJsonObject(this._filterSettings.toJsonObject());
            this._subFilters[oldIndex] = currFilter;

            // Copy main filter at this time
            if (this._subFilters[newIndex] == undefined) {
                let parsedFilter = new FilterSettings();
                parsedFilter.fromJsonObject(this._subFilters[0].toJsonObject());
                this._subFilters[newIndex] = parsedFilter;
            }

            // Record the swap in undo history
            if (useHistory) {
                this.selfUndoSettings.length = this.selfUndoHistoryPos + 1;
                // Swap from|to:filterInitSettings
                this.selfUndoSettings.push("jmp" + oldIndex + "|" + newIndex + ":" + JSON.stringify(this._subFilters[newIndex].toJsonObject()));
                this.selfUndoHistoryPos++;
            }

            this._subfilterIndex = newIndex;
            // Never use history here since the swap action is itself history-generating
            this.swapToSettings(this._subFilters[newIndex], false);
        }

    }

    private _getTargetFilterSettingsForSong(song: Song): FilterSettings {
        // TODO: Re-compute default point freqs/gains only when needed
            let targetSettings = song.tmpEqFilterStart!;
        if (targetSettings == null) targetSettings = song.eqFilter;

        return targetSettings;
    }

    private _getTargetFilterSettings(instrument: Instrument, effect: Effect): FilterSettings {
        // TODO: Re-compute default point freqs/gains only when needed
        let targetSettings = (this._useNoteFilter) ? instrument.tmpNoteFilterStart! : effect.tmpEqFilterStart!;
        if (targetSettings == null) targetSettings = (this._useNoteFilter) ? instrument.noteFilter : effect.eqFilter;

        return targetSettings;
    }

    render(activeMods = false, forceModRender = false): void {
        this._writingMods = forceModRender && this._mouseDown;
        const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        const effect = <Effect>instrument.effects[this._effectIndex];
        if (this._forSong || this._useNoteFilter || effect != undefined) {
            const filterSettings = this._forSong ? this._doc.song.eqFilter : (this._useNoteFilter ? instrument.noteFilter : effect.eqFilter);
            let displayMods = (activeMods && !this._larger && (forceModRender || (!this._mouseOver && !this._mouseDragging && !this._mouseDown)) && this._doc.synth.playing);
            if (displayMods)
                this._controlPointPath.style.setProperty("fill", `${ColorConfig.overwritingModSlider}`);
            else if (!this._larger)
                this._controlPointPath.style.setProperty("fill", "currentColor");

            if (this._useFilterSettings != filterSettings && !this._writingMods) {
                this._dragChange = null;
                this._mouseDown = false;
            }
            this._filterSettings = filterSettings;

            // If modulators are active, show synth's current filter point settings instead of real points.
            // Will auto update, but if the user is writing directly to mod values then the writing point will be
            // forcibly maintained at the cursor position.
            if (displayMods) {
                this._useFilterSettings = this._forSong ? this._getTargetFilterSettingsForSong(this._doc.song) : this._getTargetFilterSettings(instrument, effect);

                if (this._writingMods)
                    this._whenCursorMoved();
            } else {
                this._useFilterSettings = filterSettings;
            }

            if (!this._mouseDown) this._updateCursor();

            let pointTypes = 0;
            let pointFreqs = 0;
            let pointGains = 0;
            for (let i = 0; i < this._useFilterSettings.controlPointCount; i++) {
                const point = this._useFilterSettings.controlPoints[i];
                pointTypes = pointTypes * FilterType.length + point.type;
                pointFreqs = pointFreqs * Config.filterFreqRange + point.freq;
                pointGains = pointGains * Config.filterGainRange + point.gain;
            }
            if (this._renderedSelectedIndex != this._selectedIndex ||
                this._renderedPointCount != this._useFilterSettings.controlPointCount ||
                this._renderedPointTypes != pointTypes ||
                this._renderedPointFreqs != pointFreqs ||
                this._renderedPointGains != pointGains) {
                this._renderedSelectedIndex = this._selectedIndex;
                this._renderedPointCount = this._useFilterSettings.controlPointCount;
                this._renderedPointTypes = pointTypes;
                this._renderedPointFreqs = pointFreqs;
                this._renderedPointGains = pointGains;
                this._updatePath();
            }

            /*
            if (this._renderedKey != this._doc.song.key) {
                this._renderedKey = this._doc.song.key;
                const tonicHz = Instrument.frequencyFromPitch(Config.keys[this._doc.song.key].basePitch);
                const x = this._freqToX(FilterControlPoint.getSettingValueFromHz(tonicHz));
                this._octaves.setAttribute("x", String(x));
            }
            */
        }
    }
}
