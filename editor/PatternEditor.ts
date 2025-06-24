// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { Channel } from "../synth/Channel";
import { Effect } from "../synth/Effect";
import { FilterControlPoint, FilterSettings } from "../synth/Filter";
import { Instrument } from "../synth/Instrument";
import { makeNotePin, Note, NotePin, Pattern } from "../synth/Pattern";
import { Config, getLocalStorageItem } from "../synth/SynthConfig";
import { ChangeSequence, UndoableChange } from "./Change";
import { ChangeArpeggioSpeed, ChangeBitcrusherFreq, ChangeBitcrusherQuantization, ChangeChannelBar, ChangeChorus, ChangeDecimalOffset, ChangeDetune, ChangeDistortion, ChangeDragSelectedNotes, ChangeDuplicateSelectedReusedPatterns, ChangeEchoSustain, ChangeEnsurePatternExists, ChangeEnvelopeLowerBound, ChangeEnvelopeSpeed, ChangeEnvelopeUpperBound, ChangeEQFilterSimpleCut, ChangeEQFilterSimplePeak, ChangeFeedbackAmplitude, ChangeFilterMovePoint, ChangeGrainAmounts, ChangeGrainRange, ChangeGrainSize, ChangeGranular, ChangeHoldingModRecording, ChangeNoteAdded, ChangeNoteFilterSimpleCut, ChangeNoteFilterSimplePeak, ChangeNoteStartOffset, ChangeNoteTruncate, ChangeOperatorAmplitude, ChangePan, ChangePanDelay, ChangePatternSelection, ChangePerEnvelopeSpeed, ChangePinTime, ChangePitchAdded, ChangePitchBend, ChangePitchShift, ChangePulseWidth, ChangeReverb, ChangeRingMod, ChangeRingModHz, ChangeSizeBend, ChangeSongFilterMovePoint, ChangeStringSustain, ChangeSupersawDynamism, ChangeSupersawShape, ChangeSupersawSpread, ChangeTempo, ChangeVibratoDelay, ChangeVibratoDepth, ChangeVibratoSpeed, ChangeVolume } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { prettyNumber } from "./EditorConfig";
import { EnvelopeEditor } from "./EnvelopeEditor";
import { Slider } from "./HTMLWrapper";
import { SongDocument } from "./SongDocument";
import { SongEditor } from "./SongEditor";

function makeEmptyReplacementElement<T extends Node>(node: T): T {
    const clone = <T>node.cloneNode(false);
    node.parentNode!.replaceChild(clone, node);
    return clone;
}

class PatternCursor {
    valid = false;
    prevNote: Note | null = null;
    curNote: Note | null = null;
    nextNote: Note | null = null;
    pitch = 0;
    pitchIndex = -1;
    curIndex = 0;
    start = 0;
    end = 0;
    part = 0;
    exactPart = 0;
    nearPinIndex = 0;
    pins: NotePin[] = [];
    chipWaveSampleOffset = 0;
}

export class PatternEditor {
    controlMode = false;
    shiftMode = false;
    // @TODO: Here I decided to move everything into the constructor since I'm
    // not sure what's the correct way to preserve the current behavior while
    // keeping them up here.
    private readonly _svgNoteBackground: SVGPatternElement;
    private readonly _svgDrumBackground: SVGPatternElement;
    private readonly _svgModBackground: SVGPatternElement;
    private readonly _svgBackground: SVGRectElement;
    private _svgNoteContainer: SVGSVGElement;
    private readonly _svgPlayhead: SVGRectElement;
    private readonly _selectionRect: SVGRectElement;
    private readonly _svgPreview: SVGPathElement;
    modDragValueLabel: HTMLDivElement;
    _svg: SVGSVGElement;
    readonly container: HTMLDivElement;

    private readonly _defaultModBorder = 34;
    private readonly _backgroundPitchRows: SVGRectElement[] = [];
    private readonly _backgroundDrumRow = SVG.rect();
    private readonly _backgroundModRow = SVG.rect();

    private _editorWidth: number;

    private _modDragValueLabelLeft = 0;
    private _modDragValueLabelTop = 0;
    private _modDragValueLabelWidth = 0;
    editingModLabel = false;
    private _modDragStartValue = 0;
    private _modDragPin: NotePin;
    private _modDragNote: Note;
    private _modDragSetting: number;
    private _modDragLowerBound = 0;
    private _modDragUpperBound = 6;

    private _editorHeight: number;
    private _partWidth: number;
    private _pitchHeight = -1;
    private _pitchBorder: number;
    private _pitchCount: number;
    private _mouseX = 0;
    private _mouseY = 0;
    private _mouseDown = false;
    private _mouseOver = false;
    private _mouseDragging = false;
    private _mouseHorizontal = false;
    private _usingTouch = false;
    private _copiedPinChannels: NotePin[][] = [];
    private _copiedPins: NotePin[];
    private _mouseXStart = 0;
    private _mouseYStart = 0;
    private _touchTime = 0;
    private _shiftHeld = false;
    private _ctrlHeld = false;
    private _dragConfirmed = false;
    private _draggingStartOfSelection = false;
    private _draggingEndOfSelection = false;
    private _draggingSelectionContents = false;
    private _dragTime = 0;
    private _dragPitch = 0;
    private _dragSize = 0;
    private _dragVisible = false;
    private _dragChange: UndoableChange | null = null;
    private _changePatternSelection: UndoableChange | null = null;
    private _lastChangeWasPatternSelection = false;
    private _cursor = new PatternCursor();
    private _stashCursorPinVols: number[][] = [];
    private _pattern: Pattern | null = null;
    private _playheadX = 0.0;
    private _octaveOffset = 0;
    private _renderedWidth = -1;
    private _renderedHeight = -1;
    private _renderedBeatWidth = -1;
    private _renderedPitchHeight = -1;
    private _renderedFifths = false;
    private _renderedDrums = false;
    private _renderedMod = false;
    private _renderedRhythm = -1;
    private _renderedPitchChannelCount = -1;
    private _renderedNoiseChannelCount = -1;
    private _renderedModChannelCount = -1;
    private _followPlayheadBar = -1;

    constructor(private _doc: SongDocument, private _interactive: boolean, private _barOffset: number) {
        this._svgNoteBackground = SVG.pattern({ id: "patternEditorNoteBackground" + this._barOffset, x: "0", y: "0", patternUnits: "userSpaceOnUse" });
        this._svgDrumBackground = SVG.pattern({ id: "patternEditorDrumBackground" + this._barOffset, x: "0", y: "0", patternUnits: "userSpaceOnUse" });
        this._svgModBackground = SVG.pattern({ id: "patternEditorModBackground" + this._barOffset, x: "0", y: "0", patternUnits: "userSpaceOnUse" });
        this._svgBackground = SVG.rect({ x: "0", y: "0", "pointer-events": "none", fill: "url(#patternEditorNoteBackground" + this._barOffset + ")" });
        this._svgNoteContainer = SVG.svg();
        this._svgPlayhead = SVG.rect({ x: "0", y: "0", width: "4", fill: ColorConfig.playhead, "pointer-events": "none" });
        this._selectionRect = SVG.rect({ class: "dashed-line dash-move", fill: ColorConfig.boxSelectionFill, stroke: ColorConfig.hoverPreview, "stroke-width": 2, "stroke-dasharray": "5, 3", "fill-opacity": "0.4", "pointer-events": "none", visibility: "hidden" });
        this._svgPreview = SVG.path({ fill: "none", stroke: ColorConfig.hoverPreview, "stroke-width": "2", "pointer-events": "none" });
        this.modDragValueLabel = HTML.div({ width: "90", "text-anchor": "start", contenteditable: "true", style: "display: flex, justify-content: center; align-items:center; position:absolute; pointer-events: none;", "dominant-baseline": "central", "tabindex": "-1" });
        this._svg = SVG.svg({ id: 'firstImage', style: `background-image: url(${getLocalStorageItem("customTheme", "")}); background-repeat: no-repeat; background-size: 100% 100%; background-color: ${ColorConfig.editorBackground}; touch-action: none; position: absolute;`, width: "100%", height: "100%" },
            SVG.defs(
                this._svgNoteBackground,
                this._svgDrumBackground,
                this._svgModBackground,
            ),
            this._svgBackground,
            this._selectionRect,
            this._svgNoteContainer,
            this._svgPreview,
            this._svgPlayhead,
        );
        this.container = HTML.div({ style: "height: 100%; overflow:hidden; position: relative; flex-grow: 1;" }, this._svg, this.modDragValueLabel);
        for (let i = 0; i < Config.pitchesPerOctave; i++) {
            const rectangle = SVG.rect();
            rectangle.setAttribute("x", "1");
            rectangle.setAttribute("fill", (i == 0) ? ColorConfig.tonic : ColorConfig.pitchBackground);
            this._svgNoteBackground.appendChild(rectangle);
            this._backgroundPitchRows[i] = rectangle;
        }

        this._backgroundDrumRow.setAttribute("x", "1");
        this._backgroundDrumRow.setAttribute("y", "1");
        this._backgroundDrumRow.setAttribute("fill", ColorConfig.pitchBackground);
        this._svgDrumBackground.appendChild(this._backgroundDrumRow);
        this._backgroundModRow.setAttribute("fill", ColorConfig.pitchBackground);
        this._svgModBackground.appendChild(this._backgroundModRow);

        if (this._interactive) {
            this._updateCursorStatus();
            this._updatePreview();
            window.requestAnimationFrame(this._animatePlayhead);
            this._svg.addEventListener("mousedown", this._whenMousePressed);
            document.addEventListener("mousemove", this._whenMouseMoved);
            document.addEventListener("mouseup", this._whenCursorReleased);
            this._svg.addEventListener("mouseover", this._whenMouseOver);
            this._svg.addEventListener("mouseout", this._whenMouseOut);

            this._svg.addEventListener("touchstart", this._whenTouchPressed);
            this._svg.addEventListener("touchmove", this._whenTouchMoved);
            this._svg.addEventListener("touchend", this._whenCursorReleased);
            this._svg.addEventListener("touchcancel", this._whenCursorReleased);

            this.modDragValueLabel.addEventListener("input", this._validateModDragLabelInput);
        } else {
            this._svgPlayhead.style.display = "none";
            this._svg.appendChild(SVG.rect({ x: 0, y: 0, width: 10000, height: 10000, fill: ColorConfig.editorBackground, style: "opacity: 0.5;" }));
        }

        this.resetCopiedPins();
    }

    private _getMaxPitch(): number {
        return this._doc.song.getChannelIsMod(this._doc.channel) ? Config.modCount - 1 : (this._doc.song.getChannelIsNoise(this._doc.channel) ? Config.drumCount - 1 : Config.maxPitch);
    }

    private _validateModDragLabelInput = (event: Event): void => {
        const label = <HTMLDivElement>event.target;

        // Special case - when user is typing a number between zero and min, allow it (the alternative is quite annoying, when min is nonzero)
        let converted = Number(label.innerText);
        if (!isNaN(converted) && converted >= 0 && converted < this._modDragLowerBound)
            return;

        // Another special case - allow "" e.g. the empty string and a single negative sign, but don't do anything about it.
        if (label.innerText != "" && label.innerText != "-") {
            // Force NaN results to be 0
            if (isNaN(converted)) {
                converted = this._modDragLowerBound;
                label.innerText = "" + this._modDragLowerBound;
            }

            let presValue = Math.floor(Math.max(Number(this._modDragLowerBound), Math.min(Number(this._modDragUpperBound), converted)));
            if (label.innerText != presValue + "")
                label.innerText = presValue + "";

            // This is me being too lazy to fiddle with the css to get it to align center.
            let xOffset = (+(presValue >= 10.0)) + (+(presValue >= 100.0)) + (+(presValue < 0.0)) + (+(presValue <= -10.0));
            this._modDragValueLabelLeft = +prettyNumber(Math.max(Math.min(this._editorWidth - 10 - xOffset * 8, this._partWidth * (this._modDragNote.start + this._modDragPin.time) - 4 - xOffset * 4), 2));
            this.modDragValueLabel.style.setProperty("left", "" + this._modDragValueLabelLeft + "px");

            const sequence = new ChangeSequence();
            this._dragChange = sequence;
            this._doc.setProspectiveChange(this._dragChange);

            sequence.append(new ChangeSizeBend(this._doc, this._modDragNote, this._modDragPin.time, presValue - Config.modulators[this._modDragSetting].convertRealFactor, this._modDragPin.interval, this.shiftMode));

        }
    }

    private _getMaxDivision(): number {
        if (this.controlMode && this._mouseHorizontal)
            return Config.partsPerBeat;
        const rhythmStepsPerBeat = Config.rhythms[this._doc.song.rhythm].stepsPerBeat;
        if (rhythmStepsPerBeat % 4 == 0) {
            // Beat is divisible by 2 (and 4).
            return Config.partsPerBeat / 2;
        } else if (rhythmStepsPerBeat % 3 == 0) {
            // Beat is divisible by 3.
            return Config.partsPerBeat / 3;
        } else if (rhythmStepsPerBeat % 2 == 0) {
            // Beat is divisible by 2.
            return Config.partsPerBeat / 2;
        }
        return Config.partsPerBeat;
    }

    private _getMinDivision(): number {
        if (this.controlMode && this._mouseHorizontal)
            return 1;
        return Config.partsPerBeat / Config.rhythms[this._doc.song.rhythm].stepsPerBeat;
    }

    private _snapToMinDivision(input: number): number {
        const minDivision = this._getMinDivision();
        return Math.floor(input / minDivision) * minDivision;
    }

    private _updateCursorStatus(): void {
        this._cursor = new PatternCursor();

        if (this._mouseX < 0 || this._mouseX > this._editorWidth || this._mouseY < 0 || this._mouseY > this._editorHeight || this._pitchHeight <= 0) return;

        const minDivision = this._getMinDivision();
        this._cursor.exactPart = this._mouseX / this._partWidth;
        this._cursor.part =
            Math.floor(
                Math.max(0,
                    Math.min(this._doc.song.beatsPerBar * Config.partsPerBeat - minDivision, this._cursor.exactPart)
                )
                / minDivision) * minDivision;

        let foundNote = false;

        if (this._pattern != null) {
            for (const note of this._pattern.notes) {
                if (note.end <= this._cursor.exactPart) {
                    if (this._doc.song.getChannelIsMod(this._doc.channel)) {
                        if (note.pitches[0] == Math.floor(this._findMousePitch(this._mouseY))) {
                            this._cursor.prevNote = note;
                        }
                        if (!foundNote)
                            this._cursor.curIndex++;

                    } else {
                        this._cursor.prevNote = note;
                        this._cursor.curIndex++;
                    }
                } else if (note.start <= this._cursor.exactPart && note.end > this._cursor.exactPart) {
                    if (this._doc.song.getChannelIsMod(this._doc.channel)) {
                        if (note.pitches[0] == Math.floor(this._findMousePitch(this._mouseY))) {
                            this._cursor.curNote = note;
                            foundNote = true;
                        }
                        // Only increment index if the sought note has been found... or if this note truly starts before the other
                        else if (!foundNote || (this._cursor.curNote != null && note.start < this._cursor.curNote.start))
                            this._cursor.curIndex++;
                    }
                    else {
                        this._cursor.curNote = note;
                    }
                } else if (note.start > this._cursor.exactPart) {
                    if (this._doc.song.getChannelIsMod(this._doc.channel)) {
                        if (note.pitches[0] == Math.floor(this._findMousePitch(this._mouseY))) {
                            this._cursor.nextNote = note;
                            break;
                        }
                    } else {
                        this._cursor.nextNote = note;
                        break;
                    }
                }
            }

            if (this._doc.song.getChannelIsMod(this._doc.channel) && !this.editingModLabel) {

                if (this._pattern.notes[this._cursor.curIndex] != null && this._cursor.curNote != null) {

                    let pinIdx = 0;

                    while (this._cursor.curNote.start + this._cursor.curNote.pins[pinIdx].time < this._cursor.exactPart && pinIdx < this._cursor.curNote.pins.length) {
                        pinIdx++;
                    }
                    // Decide if the previous pin is closer
                    if (pinIdx > 0) {
                        if (this._cursor.curNote.start + this._cursor.curNote.pins[pinIdx].time - this._cursor.exactPart > this._cursor.exactPart - (this._cursor.curNote.start + this._cursor.curNote.pins[pinIdx - 1].time)) {
                            pinIdx--;
                        }
                    }

                    this.modDragValueLabel.style.setProperty("color", "#666688");
                    this.modDragValueLabel.style.setProperty("display", "");
                    const mod = Math.max(0, Config.modCount - 1 - this._cursor.curNote.pitches[0]);

                    let setting = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument(this._barOffset)].modulators[mod];

                    let presValue = this._cursor.curNote.pins[pinIdx].size + Config.modulators[setting].convertRealFactor;

                    // This is me being too lazy to fiddle with the css to get it to align center.
                    let xOffset = (+(presValue >= 10.0)) + (+(presValue >= 100.0)) + (+(presValue < 0.0)) + (+(presValue <= -10.0));

                    this._modDragValueLabelWidth = 8 + xOffset * 8;
                    this._modDragValueLabelLeft = +prettyNumber(Math.max(Math.min(this._editorWidth - 10 - xOffset * 8, this._partWidth * (this._cursor.curNote.start + this._cursor.curNote.pins[pinIdx].time) - 4 - xOffset * 4), 2));
                    this._modDragValueLabelTop = +prettyNumber(this._pitchToPixelHeight(this._cursor.curNote.pitches[0] - this._octaveOffset) - 17 - (this._pitchHeight - this._pitchBorder) / 2);

                    this._modDragStartValue = this._cursor.curNote.pins[pinIdx].size;
                    this._modDragNote = this._cursor.curNote;
                    this._modDragPin = this._cursor.curNote.pins[pinIdx];
                    this._modDragLowerBound = Config.modulators[setting].convertRealFactor;
                    this._modDragUpperBound = Config.modulators[setting].convertRealFactor + this._doc.song.getVolumeCapForSetting(true, setting, this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument(this._barOffset)].modFilterTypes[mod]);
                    this._modDragSetting = setting;

                    this.modDragValueLabel.style.setProperty("left", "" + this._modDragValueLabelLeft + "px");
                    this.modDragValueLabel.style.setProperty("top", "" + this._modDragValueLabelTop + "px");
                    this.modDragValueLabel.textContent = "" + presValue;

                } else {
                    this.modDragValueLabel.style.setProperty("display", "none");
                    this.modDragValueLabel.style.setProperty("pointer-events", "none");
                    this.modDragValueLabel.setAttribute("contenteditable", "false");
                }
            }
            else if (!this.editingModLabel) {
                this.modDragValueLabel.style.setProperty("display", "none");
                this.modDragValueLabel.style.setProperty("pointer-events", "none");
                this.modDragValueLabel.setAttribute("contenteditable", "false");
            }
        }
        else {
            this.modDragValueLabel.style.setProperty("display", "none");
            this.modDragValueLabel.style.setProperty("pointer-events", "none");
            this.modDragValueLabel.setAttribute("contenteditable", "false");
        }

        let mousePitch = this._findMousePitch(this._mouseY);

        if (this._cursor.curNote != null) {

            this._cursor.start = this._cursor.curNote.start;
            this._cursor.end = this._cursor.curNote.end;
            this._cursor.pins = this._cursor.curNote.pins;

            let interval = 0;
            let error = 0;
            let prevPin: NotePin;
            let nextPin = this._cursor.curNote.pins[0];
            for (let j = 1; j < this._cursor.curNote.pins.length; j++) {
                prevPin = nextPin;
                nextPin = this._cursor.curNote.pins[j];
                const leftSide = this._partWidth * (this._cursor.curNote.start + prevPin.time);
                const rightSide = this._partWidth * (this._cursor.curNote.start + nextPin.time);
                if (this._mouseX > rightSide) continue;
                if (this._mouseX < leftSide) throw new Error();
                const intervalRatio = (this._mouseX - leftSide) / (rightSide - leftSide);
                const arc = Math.sqrt(1.0 / Math.sqrt(4.0) - Math.pow(intervalRatio - 0.5, 2.0)) - 0.5;
                const bendHeight = Math.abs(nextPin.interval - prevPin.interval);
                interval = prevPin.interval * (1.0 - intervalRatio) + nextPin.interval * intervalRatio;
                error = arc * bendHeight + 0.95;
                break;
            }

            let minInterval = Number.MAX_VALUE;
            let maxInterval = -Number.MAX_VALUE;
            let bestDistance = Number.MAX_VALUE;
            for (const pin of this._cursor.curNote.pins) {
                if (minInterval > pin.interval) minInterval = pin.interval;
                if (maxInterval < pin.interval) maxInterval = pin.interval;
                const pinDistance = Math.abs(this._cursor.curNote.start + pin.time - this._mouseX / this._partWidth);
                if (bestDistance > pinDistance) {
                    bestDistance = pinDistance;
                    this._cursor.nearPinIndex = this._cursor.curNote.pins.indexOf(pin);
                }
            }

            mousePitch -= interval;
            this._cursor.pitch = this._snapToPitch(mousePitch, -minInterval, this._getMaxPitch() - maxInterval);

            // Snap to nearby existing note if present.
            if (!this._doc.song.getChannelIsNoise(this._doc.channel) && !this._doc.song.getChannelIsMod(this._doc.channel)) {
                let nearest = error;
                for (let i = 0; i < this._cursor.curNote.pitches.length; i++) {
                    const distance = Math.abs(this._cursor.curNote.pitches[i] - mousePitch + 0.5);
                    if (distance > nearest) continue;
                    nearest = distance;
                    this._cursor.pitch = this._cursor.curNote.pitches[i];
                }
            }

            for (let i = 0; i < this._cursor.curNote.pitches.length; i++) {
                if (this._cursor.curNote.pitches[i] == this._cursor.pitch) {
                    this._cursor.pitchIndex = i;
                    break;
                }
            }
        } else {
            this._cursor.pitch = this._snapToPitch(mousePitch, 0, this._getMaxPitch());
            const defaultLength = this._copiedPins[this._copiedPins.length - 1].time;
            const fullBeats = Math.floor(this._cursor.part / Config.partsPerBeat);
            const maxDivision = this._getMaxDivision();
            const modMouse = this._cursor.part % Config.partsPerBeat;
            if (defaultLength == 1) {
                this._cursor.start = this._cursor.part;
            } else if (defaultLength > Config.partsPerBeat) {
                this._cursor.start = fullBeats * Config.partsPerBeat;
            } else if (defaultLength == Config.partsPerBeat) {
                this._cursor.start = fullBeats * Config.partsPerBeat;
                if (maxDivision < Config.partsPerBeat && modMouse > maxDivision) {
                    this._cursor.start += Math.floor(modMouse / maxDivision) * maxDivision;
                }
            } else {
                this._cursor.start = fullBeats * Config.partsPerBeat;
                let division = Config.partsPerBeat % defaultLength == 0 ? defaultLength : Math.min(defaultLength, maxDivision);
                while (division < maxDivision && Config.partsPerBeat % division != 0) {
                    division++;
                }
                this._cursor.start += Math.floor(modMouse / division) * division;
            }
            this._cursor.end = this._cursor.start + defaultLength;
            let forceStart = 0;
            let forceEnd = this._doc.song.beatsPerBar * Config.partsPerBeat;
            if (this._cursor.prevNote != null) {
                forceStart = this._cursor.prevNote.end;
            }
            if (this._cursor.nextNote != null) {
                forceEnd = this._cursor.nextNote.start;
            }
            if (this._cursor.start < forceStart) {
                this._cursor.start = forceStart;
                this._cursor.end = this._cursor.start + defaultLength;
                if (this._cursor.end > forceEnd) {
                    this._cursor.end = forceEnd;
                }
            } else if (this._cursor.end > forceEnd) {
                this._cursor.end = forceEnd;
                this._cursor.start = this._cursor.end - defaultLength;
                if (this._cursor.start < forceStart) {
                    this._cursor.start = forceStart;
                }
            }

            if (this._cursor.end - this._cursor.start == defaultLength) {
                if (this._copiedPinChannels.length > this._doc.channel) {
                    this._copiedPins = this._copiedPinChannels[this._doc.channel];
                    this._cursor.pins = this._copiedPins;
                } else {
                    const cap = this._doc.song.getVolumeCap(false);
                    this._cursor.pins = [makeNotePin(0, 0, cap), makeNotePin(0, maxDivision, cap)];
                }
            } else {
                this._cursor.pins = [];
                for (const oldPin of this._copiedPins) {
                    if (oldPin.time <= this._cursor.end - this._cursor.start) {
                        this._cursor.pins.push(makeNotePin(0, oldPin.time, oldPin.size));
                        if (oldPin.time == this._cursor.end - this._cursor.start) break;
                    } else {
                        this._cursor.pins.push(makeNotePin(0, this._cursor.end - this._cursor.start, oldPin.size));
                        break;
                    }
                }
            }

            if (this._doc.song.getChannelIsMod(this._doc.channel)) {

                this._cursor.pitch = Math.max(0, Math.min(Config.modCount - 1, this._cursor.pitch));

                // Return cursor to stashed cursor volumes (so pins aren't destroyed by moving the preview around several volume scales.)
                if (this._stashCursorPinVols != null && this._stashCursorPinVols[this._doc.channel] != null) {
                    for (let pin = 0; pin < this._cursor.pins.length; pin++) {
                        this._cursor.pins[pin].size = this._stashCursorPinVols[this._doc.channel][pin];
                    }
                }

                // Scale volume of copied pin to cap for this row
                let maxHeight = this._doc.song.getVolumeCap(this._doc.song.getChannelIsMod(this._doc.channel), this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), this._cursor.pitch);
                let maxFoundHeight = 0;
                for (const pin of this._cursor.pins) {
                    if (pin.size > maxFoundHeight) {
                        maxFoundHeight = pin.size;
                    }
                }
                // Apply scaling if the max height is below any pin setting.
                if (maxFoundHeight > maxHeight) {
                    for (const pin of this._cursor.pins) {
                        pin.size = Math.round(pin.size * (maxHeight / maxFoundHeight));
                    }
                }
            }

        }

        this._cursor.valid = true;

    }

    private _cursorIsInSelection(): boolean {
        return this._cursor.valid && this._doc.selection.patternSelectionActive && this._doc.selection.patternSelectionStart <= this._cursor.exactPart && this._cursor.exactPart <= this._doc.selection.patternSelectionEnd;
    }

    private _cursorAtStartOfSelection(): boolean {
        return this._cursor.valid && this._doc.selection.patternSelectionActive && this._cursor.pitchIndex == -1 && this._doc.selection.patternSelectionStart - 3 <= this._cursor.exactPart && this._cursor.exactPart <= this._doc.selection.patternSelectionStart + 1.25;
    }

    private _cursorAtEndOfSelection(): boolean {
        return this._cursor.valid && this._doc.selection.patternSelectionActive && this._cursor.pitchIndex == -1 && this._doc.selection.patternSelectionEnd - 1.25 <= this._cursor.exactPart && this._cursor.exactPart <= this._doc.selection.patternSelectionEnd + 3;
    }

    private _findMousePitch(pixelY: number): number {
        return Math.max(0, Math.min(this._pitchCount - 1, this._pitchCount - (pixelY / this._pitchHeight))) + this._octaveOffset;
    }

    private _snapToPitch(guess: number, min: number, max: number): number {
        if (guess < min) guess = min;
        if (guess > max) guess = max;
        const scale: ReadonlyArray<boolean> = this._doc.prefs.notesOutsideScale ? Config.scales.dictionary["Free"].flags : this._doc.song.scale == Config.scales.dictionary["Custom"].index ? this._doc.song.scaleCustom : Config.scales[this._doc.song.scale].flags;
        if (scale[Math.floor(guess) % Config.pitchesPerOctave] || this._doc.song.getChannelIsNoise(this._doc.channel) || this._doc.song.getChannelIsMod(this._doc.channel)) {

            return Math.floor(guess);
        } else {
            let topPitch = Math.floor(guess) + 1;
            let bottomPitch = Math.floor(guess) - 1;
            while (!scale[topPitch % Config.pitchesPerOctave]) {
                topPitch++;
            }
            while (!scale[(bottomPitch) % Config.pitchesPerOctave]) {
                bottomPitch--;
            }
            if (topPitch > max) {
                if (bottomPitch < min) {
                    return min;
                } else {
                    return bottomPitch;
                }
            } else if (bottomPitch < min) {
                return topPitch;
            }
            let topRange = topPitch;
            let bottomRange = bottomPitch + 1;
            if (topPitch % Config.pitchesPerOctave == 0 || topPitch % Config.pitchesPerOctave == 7) {
                topRange -= 0.5;
            }
            if (bottomPitch % Config.pitchesPerOctave == 0 || bottomPitch % Config.pitchesPerOctave == 7) {
                bottomRange += 0.5;
            }
            return guess - bottomRange > topRange - guess ? topPitch : bottomPitch;
        }
    }

    private _copyPins(note: Note): void {
        this._copiedPins = [];
        for (const oldPin of note.pins) {
            this._copiedPins.push(makeNotePin(0, oldPin.time, oldPin.size));
        }
        for (let i = 1; i < this._copiedPins.length - 1;) {
            if (this._copiedPins[i - 1].size == this._copiedPins[i].size &&
                this._copiedPins[i].size == this._copiedPins[i + 1].size) {
                this._copiedPins.splice(i, 1);
            } else {
                i++;
            }
        }
        this._copiedPinChannels[this._doc.channel] = this._copiedPins;

        this._stashCursorPinVols[this._doc.channel] = [];
        for (let pin = 0; pin < this._copiedPins.length; pin++) {
            this._stashCursorPinVols[this._doc.channel].push(this._copiedPins[pin].size);
        }
    }

    movePlayheadToMouse(): boolean {
        if (this._mouseOver) {
            this._doc.synth.playhead = this._doc.bar + this._barOffset + (this._mouseX / this._editorWidth);
            return true;
        }
        return false;
    }

    resetCopiedPins = (): void => {
        const maxDivision = this._getMaxDivision();
        let cap = this._doc.song.getVolumeCap(false);
        this._copiedPinChannels.length = this._doc.song.getChannelCount();
        this._stashCursorPinVols.length = this._doc.song.getChannelCount();
        for (let i = 0; i < this._doc.song.pitchChannelCount; i++) {
            this._copiedPinChannels[i] = [makeNotePin(0, 0, cap), makeNotePin(0, maxDivision, cap)];
            this._stashCursorPinVols[i] = [cap, cap];
        }
        for (let i = this._doc.song.pitchChannelCount; i < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; i++) {
            this._copiedPinChannels[i] = [makeNotePin(0, 0, cap), makeNotePin(0, maxDivision, 0)];
            this._stashCursorPinVols[i] = [cap, 0];
        }
        for (let i = this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; i < this._doc.song.getChannelCount(); i++) {
            this._copiedPinChannels[i] = [makeNotePin(0, 0, cap), makeNotePin(0, maxDivision, 0)];
            this._stashCursorPinVols[i] = [cap, 0];
        }
    }

    private _animatePlayhead = (timestamp: number): void => {

        if (this._usingTouch && !this.shiftMode && !this._mouseDragging && this._mouseDown && performance.now() > this._touchTime + 1000 && this._cursor.valid && this._doc.lastChangeWas(this._dragChange)) {
            // On a mobile device, the pattern editor supports using a long stationary touch to activate selection.
            this._dragChange!.undo();
            this._shiftHeld = true;  //TODO: how can the mobile editor support control?
            this._dragConfirmed = false;
            this._whenCursorPressed();
            // The full interface is usually only rerendered in response to user input events, not animation events, but in this case go ahead and rerender everything.
            this._doc.notifier.notifyWatchers();
        }

        const playheadBar = Math.floor(this._doc.synth.playhead);
        const noteFlashElements: NodeListOf<SVGPathElement> = this._svgNoteContainer.querySelectorAll('.note-flash');

        if (this._doc.synth.playing && ((this._pattern != null && this._doc.song.getPattern(this._doc.channel, Math.floor(this._doc.synth.playhead)) == this._pattern) || Math.floor(this._doc.synth.playhead) == this._doc.bar + this._barOffset)) {
            this._svgPlayhead.setAttribute("visibility", "visible");
            const modPlayhead = this._doc.synth.playhead - playheadBar;

            // note flash
            for (var i = 0; i < noteFlashElements.length; i++) {
                var element = noteFlashElements[i];
                const noteStart = Number(element.getAttribute("note-start")) / (this._doc.song.beatsPerBar * Config.partsPerBeat)
                const noteEnd = Number(element.getAttribute("note-end")) / (this._doc.song.beatsPerBar * Config.partsPerBeat)
                if ((modPlayhead >= noteStart) && this._doc.prefs.notesFlashWhenPlayed) {
                    const dist = noteEnd - noteStart
                    element.style.opacity = String((1 - (((modPlayhead - noteStart) - (dist / 2)) / (dist / 2))))
                } else {
                    element.style.opacity = "0"
                }
            }

            if (Math.abs(modPlayhead - this._playheadX) > 0.1) {
                this._playheadX = modPlayhead;
            } else {
                this._playheadX += (modPlayhead - this._playheadX) * 0.2;
            }
            this._svgPlayhead.setAttribute("x", "" + prettyNumber(this._playheadX * this._editorWidth - 2));
        } else {
            this._svgPlayhead.setAttribute("visibility", "hidden");

            // dogeiscut: lazy fix boohoo
            for (var i = 0; i < noteFlashElements.length; i++) {
                var element = noteFlashElements[i];
                element.style.opacity = "0"
            }
        }

        if (this._doc.synth.playing && (this._doc.synth.recording || this._doc.prefs.autoFollow) && this._followPlayheadBar != playheadBar) {
            // When autofollow is enabled, select the current bar (but don't record it in undo history).
            new ChangeChannelBar(this._doc, this._doc.channel, playheadBar);
            // The full interface is usually only rerendered in response to user input events, not animation events, but in this case go ahead and rerender everything.
            this._doc.notifier.notifyWatchers();
        }
        this._followPlayheadBar = playheadBar;

        if (this._doc.currentPatternIsDirty) {
            this._redrawNotePatterns();
        }

        window.requestAnimationFrame(this._animatePlayhead);
    }

    private _whenMouseOver = (event: MouseEvent): void => {
        if (this._mouseOver) return;
        this._mouseOver = true;
        this._usingTouch = false;
    }

    private _whenMouseOut = (event: MouseEvent): void => {
        if (!this._mouseOver) return;
        this._mouseOver = false;
    }

    private _whenMousePressed = (event: MouseEvent): void => {
        event.preventDefault();
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._usingTouch = false;
        this._shiftHeld = event.shiftKey;
        this._ctrlHeld = event.altKey; //originally was control but thats already to record
        this._dragConfirmed = false;
        this._whenCursorPressed();
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        event.preventDefault();
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._usingTouch = true;
        this._shiftHeld = event.shiftKey;
        this._ctrlHeld = event.altKey;
        this._dragConfirmed = false;
        this._touchTime = performance.now();
        this._whenCursorPressed();
    }


    // For a given change type, check the modulator channels for a matching mod to the changed parameter. If it exists, add a pin onto the latest note, or make a new note if enough time elapsed since the last pin. 
    setModSettingsForChange(change: any, songEditor: SongEditor): boolean {
        const thisRef = this;
        const timeQuantum = Math.max(4, (Config.partsPerBeat / Config.rhythms[this._doc.song.rhythm].stepsPerBeat));
        const currentBar = Math.floor(this._doc.synth.playhead);
        const realPart = this._doc.synth.getCurrentPart();
        let changedPatterns = false;

        // Ceiling is applied usually to give the synth time to catch the mod updates, but rounds to 0 to avoid skipping the first part.
        const currentPart = (realPart < timeQuantum / 2) ? 0 : Math.ceil(realPart / timeQuantum) * timeQuantum;

        // For a given setting and a given channel, find the instrument and mod number that influences the setting.
        function getMatchingInstrumentAndMod(applyToMod: number, modChannel: Channel, modInsIndex?: number | undefined, modFilterIndex?: number | undefined, modEnvIndex?: number | undefined): number[] {
            let startIndex = (modInsIndex == undefined) ? 0 : modInsIndex;
            let endIndex = (modInsIndex == undefined) ? modChannel.instruments.length - 1 : modInsIndex;
            for (let instrumentIndex = startIndex; instrumentIndex <= endIndex; instrumentIndex++) {
                let instrument = modChannel.instruments[instrumentIndex];
                for (let mod = 0; mod < Config.modCount; mod++) {
                    // Non-song application
                    for (let channelIndex = 0; channelIndex < instrument.modChannels[mod].length; channelIndex++) {
                        if (instrument.modulators[mod] == applyToMod && !Config.modulators[instrument.modulators[mod]].forSong && (instrument.modChannels[mod][channelIndex] == thisRef._doc.channel)) {
                            // This is a check if the instrument targeted is relevant. Is it the exact one being edited? An "all" or "active" target?
                            // For "active" target it doesn't check if the instrument is active, allowing write to other active instruments from an inactive one. Should be fine since audibly while writing you'll hear what you'd expect -
                            // the current channel's active instruments being modulated, which is what most people would expect even if editing an inactive instrument.
                            if (thisRef._doc.getCurrentInstrument() == instrument.modInstruments[mod][channelIndex]
                                || instrument.modInstruments[mod][channelIndex] >= thisRef._doc.song.channels[thisRef._doc.channel].instruments.length) {
                                // If it's an eq/note filter target, one additional step is performed to see if it matches the right modFilterType.
                                if (modFilterIndex != undefined && (applyToMod == Config.modulators.dictionary["eq filter"].index || applyToMod == Config.modulators.dictionary["note filter"].index)) {
                                    if (instrument.modFilterTypes[mod] == modFilterIndex)
                                        return [instrumentIndex, mod];
                                } else if (modEnvIndex != undefined && applyToMod == Config.modulators.dictionary["individual envelope speed"].index ||
                                    applyToMod == Config.modulators.dictionary["individual envelope lower bound"].index ||
                                    applyToMod == Config.modulators.dictionary["individual envelope upper bound"].index
                                ) {
                                    if (instrument.modEnvelopeNumbers[mod] == modEnvIndex)
                                        return [instrumentIndex, mod];
                                } else
                                    return [instrumentIndex, mod];
                            }
                        }
                    }
                    // Song wide application
                    if (instrument.modulators[mod] == applyToMod && Config.modulators[instrument.modulators[mod]].forSong && (instrument.modChannels[mod][0] == -1)) {
                        // check song eq? 
                        if (modFilterIndex != undefined && (applyToMod == Config.modulators.dictionary["song eq"].index)) {
                            if (instrument.modFilterTypes[mod] == modFilterIndex)
                                return [instrumentIndex, mod];
                        }
                        else
                            return [instrumentIndex, mod];
                    }
                }
            }
            return [-1, -1];
        }

        // For the given duration, scans through and removes pins and notes that are within. If two pins of a note cross the interval boundary, the interior pin is moved to the boundary.
        function sanitizeInterval(doc: SongDocument, startPart: number, endPart: number, pattern: Pattern, forMod: number, sequence: ChangeSequence) {
            if (startPart >= endPart) return;
            for (let noteIndex = 0; noteIndex < pattern.notes.length; noteIndex++) {
                const note = pattern.notes[noteIndex];
                if (note.pitches[0] != forMod)
                    continue;
                if (note.start < endPart && note.end > startPart) {
                    let couldIntersectStart = false;
                    let intersectsEnd = false;
                    let firstInteriorPin = -1;
                    let interiorPinCount = 0;

                    // The interval is spanned by the entire note. Just process internal pins, then done.
                    if (note.start <= startPart && note.end >= endPart) {
                        for (let pinIndex = 0; pinIndex < note.pins.length; pinIndex++) {
                            const pin = note.pins[pinIndex];
                            if (note.start + pin.time > startPart && note.start + pin.time < endPart) {
                                if (firstInteriorPin < 0)
                                    firstInteriorPin = pinIndex;
                                interiorPinCount++;
                            }
                        }
                        // Splice pins inside the interval.
                        if (interiorPinCount > 0)
                            note.pins.splice(firstInteriorPin, interiorPinCount);
                        return;
                    }

                    for (let pinIndex = 0; pinIndex < note.pins.length; pinIndex++) {
                        const pin = note.pins[pinIndex];
                        if (note.start + pin.time >= startPart && note.start + pin.time <= endPart) {
                            if (firstInteriorPin < 0)
                                firstInteriorPin = pinIndex;
                            interiorPinCount++;
                        }
                        else {
                            if (interiorPinCount == 0)
                                couldIntersectStart = true;
                            if (interiorPinCount > 0)
                                intersectsEnd = true;
                        }
                    }
                    if (couldIntersectStart && interiorPinCount > 0) {
                        note.pins[firstInteriorPin].time = startPart - note.start;
                        firstInteriorPin++; interiorPinCount--;
                    }
                    if (intersectsEnd && interiorPinCount > 0) {
                        note.pins[firstInteriorPin + interiorPinCount - 1].time = endPart - note.start;
                        interiorPinCount--;
                    }

                    // Splice pins inside the interval.
                    note.pins.splice(firstInteriorPin, interiorPinCount);

                    if (note.pins.length < 2) {
                        sequence.append(new ChangeNoteAdded(doc, pattern, note, noteIndex, true));
                        noteIndex--;
                        continue;
                    }

                    // Clean up properties.
                    let timeAdjust = 0;
                    timeAdjust = note.pins[0].time;
                    note.start += timeAdjust;
                    for (let i = 0; i < note.pins.length; i++) {
                        note.pins[i].time -= timeAdjust;
                    }
                    note.end = note.start + note.pins[note.pins.length - 1].time;

                    if (note.end <= note.start) {
                        sequence.append(new ChangeNoteAdded(doc, pattern, note, noteIndex, true));
                        noteIndex--;
                    }
                }
            }
        }

        const sequence = new ChangeSequence();

        const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument()];
        let applyToMods: number[] = [];
        let applyToFilterTargets: number[] = [];
        let applyToEnvelopeTargets: number[] = [];
        let applyValues: number[] = [];
        let toApply = true;
        let slider: Slider | null = null;

        // Special case, treat null change as Song volume.
        if (change == null) {
            var modulator = Config.modulators.dictionary["song volume"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(this._doc.prefs.volume - modulator.convertRealFactor);
        }
        // Also for song volume, when holding the slider at a single value.
        else if (this._doc.continuingModRecordingChange != null && this._doc.continuingModRecordingChange.storedChange == null && this._doc.continuingModRecordingChange.storedSlider == null) {
            var modulator = Config.modulators.dictionary["song volume"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(this._doc.continuingModRecordingChange.storedValues![0]);
        }
        else if (change instanceof ChangeTempo) {
            var modulator = Config.modulators.dictionary["tempo"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(this._doc.song.tempo - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                this._doc.song.tempo = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeSequence && change.checkFirst() instanceof ChangeSongFilterMovePoint && !change.isCommitted()) {
            // Pushes some pieces of data in each array, to be handled individually down below.
            //   applyToMods:
            //     mod index for songFilter
            //     mod index for songFilter
            //   applyValues:
            //     new freq
            //     new gain
            //   applyToFilterTargets:
            //     modFilterTarget freq index (X)
            //     modFilterTarget gain index (Y)
            //
            const useChange = change.checkFirst() as ChangeSongFilterMovePoint;
            const preMoveData = useChange.getMoveData(true);
            const postMoveData = useChange.getMoveData(false);
            const song = this._doc.song;
            let useFilter = song.eqFilter;
            var modulatorIndex = Config.modulators.dictionary["song eq"].index;

            if (song.tmpEqFilterEnd == null) {
                song.tmpEqFilterStart = new FilterSettings();
                song.tmpEqFilterStart.fromJsonObject(song.eqFilter.toJsonObject());
                song.tmpEqFilterEnd = song.tmpEqFilterStart;
            }

            const modifyPoint: FilterControlPoint | null = song.tmpEqFilterEnd.controlPoints[useChange.pointIndex];
            if (modifyPoint != null && modifyPoint.type == useChange.pointType) {
                modifyPoint.freq = postMoveData.freq;
                modifyPoint.gain = postMoveData.gain;
            }

            applyToMods.push(modulatorIndex);
            applyToMods.push(modulatorIndex);
            if (toApply) applyValues.push(postMoveData.freq);
            if (toApply) applyValues.push(postMoveData.gain);

            // ModFilterTypes indices, one each for X/Y.
            applyToFilterTargets.push(1 + useChange.pointIndex * 2);
            applyToFilterTargets.push(1 + useChange.pointIndex * 2 + 1);

            // Reset the original point, if it was the instrument's default eq/note filter.
            for (let i = 0; i < useFilter.controlPointCount; i++) {
                var point = useFilter.controlPoints[i];
                if (Object.is(point, preMoveData.point)) {
                    // Reset the filter point to its previous value, as just the mods are being changed.
                    point.freq = preMoveData.freq;
                    point.gain = preMoveData.gain;
                }
            }

        }
        /* Song reverb - a casualty of splitting to reverb per instrument, it's not modulate-able via slider!
        else if (change instanceof ChangeSongReverb) { } */
        else if (change instanceof ChangeVolume) {
            var modulator = Config.modulators.dictionary["mix volume"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.volume - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null)
                instrument.volume = slider.getValueBeforeProspectiveChange();
        }
        else if (change instanceof ChangePan) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["pan"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.pan - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.pan = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeReverb) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["reverb"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.reverb - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.reverb = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeDistortion) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["distortion"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.distortion - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.distortion = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeRingMod) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["ring modulation"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.ringModulation - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.ringModulation = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeRingModHz) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["ring mod hertz"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.ringModulationHz - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.ringModulationHz = slider.getValueBeforeProspectiveChange();
                    //songEditor.ringModHzNum.innerHTML = "(" + instrument.ringModulationHz + ")";
                }
            }
        }
        else if (change instanceof ChangeGranular) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["granular"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.granular - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.granular = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeGrainAmounts) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["grain freq"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.grainAmounts - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.grainAmounts = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeGrainSize) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["grain size"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.grainSize - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.grainSize = slider.getValueBeforeProspectiveChange();
                    //songEditor.grainSizeNum.innerHTML = "(" + (instrument.grainSize * Config.grainSizeStep) + ")";
                }
            }
        }
        else if (change instanceof ChangeGrainRange) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["grain range"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.grainRange - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.grainRange = slider.getValueBeforeProspectiveChange();
                    //songEditor.grainRangeNum.innerHTML = "(" + (instrument.grainRange * Config.grainSizeStep) + ")";
                }
            }
        }
        else if (change instanceof ChangeOperatorAmplitude) {
            var modulator = Config.modulators.dictionary["fm slider " + (change.operatorIndex + 1)];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.operators[change.operatorIndex].amplitude - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.operators[change.operatorIndex].amplitude = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeFeedbackAmplitude) {
            var modulator = Config.modulators.dictionary["fm feedback"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.feedbackAmplitude - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.feedbackAmplitude = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangePulseWidth) {
            var modulator = Config.modulators.dictionary["pulse width"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.pulseWidth - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.pulseWidth = slider.getValueBeforeProspectiveChange();
            }
        }
        // PWM decimal offset code for UB, DOUBLE-CHECK THAT THIS IS CORRECT
        else if (change instanceof ChangeDecimalOffset) {
            var modulator = Config.modulators.dictionary["decimal offset"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.decimalOffset - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.decimalOffset = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeDetune) {
            var modulator = Config.modulators.dictionary["detune"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.detune - modulator.convertRealFactor - Config.detuneCenter);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.detune = slider.getValueBeforeProspectiveChange() + Config.detuneCenter;
            }
        }
        else if (change instanceof ChangeVibratoDepth) {
            var modulator = Config.modulators.dictionary["vibrato depth"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.vibratoDepth * 25 - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.vibratoDepth = slider.getValueBeforeProspectiveChange() / 25;
            }
        }
        else if (change instanceof ChangeVibratoSpeed) {
            var modulator = Config.modulators.dictionary["vibrato speed"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.vibratoSpeed - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.vibratoSpeed = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeVibratoDelay) {
            var modulator = Config.modulators.dictionary["vibrato delay"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.vibratoDelay - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.vibratoDelay = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeArpeggioSpeed) {
            var modulator = Config.modulators.dictionary["arp speed"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.arpeggioSpeed - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.arpeggioSpeed = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangePanDelay) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["pan delay"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.panDelay - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.panDelay = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeSequence && change.checkFirst() instanceof ChangeFilterMovePoint && !change.isCommitted()) {
            // Pushes some pieces of data in each array, to be handled individually down below.
            //   applyToMods:
            //     mod index for eqFilter||noteFilter
            //     mod index for eqFilter||noteFilter
            //   applyValues:
            //     new freq
            //     new gain
            //   applyToFilterTargets:
            //     modFilterTarget freq index (X)
            //     modFilterTarget gain index (Y)
            //
            const useChange = change.checkFirst() as ChangeFilterMovePoint;
            const preMoveData = useChange.getMoveData(true);
            const postMoveData = useChange.getMoveData(false);
            let useFilter = instrument.noteFilter;
            let modulatorIndex;

            if (useChange.useNoteFilter) {
                modulatorIndex = Config.modulators.dictionary["note filter"].index;

                if (instrument.tmpNoteFilterEnd == null) {
                    instrument.tmpNoteFilterStart = new FilterSettings();
                    instrument.tmpNoteFilterStart.fromJsonObject(instrument.noteFilter.toJsonObject());
                    instrument.tmpNoteFilterEnd = instrument.tmpNoteFilterStart;
                }

                const modifyPoint: FilterControlPoint | null = instrument.tmpNoteFilterEnd.controlPoints[useChange.pointIndex];
                if (modifyPoint != null && modifyPoint.type == useChange.pointType) {
                    modifyPoint.freq = postMoveData.freq;
                    modifyPoint.gain = postMoveData.gain;
                }
            }
            else {
                modulatorIndex = Config.modulators.dictionary["eq filter"].index;
                for (let i = 0; i < instrument.effects.length; i++) {
                    let effect = instrument.effects[i] as Effect;
                    useFilter = effect.eqFilter;

                    if (effect.tmpEqFilterEnd == null) {
                        effect.tmpEqFilterStart = new FilterSettings();
                        effect.tmpEqFilterStart.fromJsonObject(effect.eqFilter.toJsonObject());
                        effect.tmpEqFilterEnd = effect.tmpEqFilterStart;
                    }

                    const modifyPoint: FilterControlPoint | null = effect.tmpEqFilterEnd.controlPoints[useChange.pointIndex];
                    if (modifyPoint != null && modifyPoint.type == useChange.pointType) {
                        modifyPoint.freq = postMoveData.freq;
                        modifyPoint.gain = postMoveData.gain;
                    }
                }
            }

            applyToMods.push(modulatorIndex);
            applyToMods.push(modulatorIndex);
            if (toApply) applyValues.push(postMoveData.freq);
            if (toApply) applyValues.push(postMoveData.gain);

            // ModFilterTypes indices, one each for X/Y.
            applyToFilterTargets.push(1 + useChange.pointIndex * 2);
            applyToFilterTargets.push(1 + useChange.pointIndex * 2 + 1);

            // Reset the original point, if it was the instrument's default eq/note filter.
            for (let i = 0; i < useFilter.controlPointCount; i++) {
                var point = useFilter.controlPoints[i];
                if (Object.is(point, preMoveData.point)) {
                    // Reset the filter point to its previous value, as just the mods are being changed.
                    point.freq = preMoveData.freq;
                    point.gain = preMoveData.gain;
                }
            }

        }
        else if (change instanceof ChangeBitcrusherQuantization) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["bit crush"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.bitcrusherQuantization - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.bitcrusherQuantization = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeBitcrusherFreq) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["freq crush"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.bitcrusherFreq - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.bitcrusherFreq = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeEchoSustain) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["echo"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.echoSustain - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.echoSustain = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeChorus) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["chorus"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.chorus - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.chorus = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeEQFilterSimpleCut) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["eq filt cut"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.eqFilterSimpleCut - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.eqFilterSimpleCut = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeEQFilterSimplePeak) {
            for (let i = 0; i < instrument.effects.length; i++) {
                let effect = instrument.effects[i] as Effect;
                var modulator = Config.modulators.dictionary["eq filt peak"];
                applyToMods.push(modulator.index);
                if (toApply) applyValues.push(effect.eqFilterSimplePeak - modulator.convertRealFactor);
                // Move the actual value back, since we just want to update the modulated value and not the base slider.
                slider = songEditor.getSliderForModSetting(modulator.index);
                if (slider != null) {
                    effect.eqFilterSimplePeak = slider.getValueBeforeProspectiveChange();
                }
            }
        }
        else if (change instanceof ChangeNoteFilterSimpleCut) {
            var modulator = Config.modulators.dictionary["note filt cut"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.noteFilterSimpleCut - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.noteFilterSimpleCut = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeNoteFilterSimplePeak) {
            var modulator = Config.modulators.dictionary["note filt peak"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.noteFilterSimplePeak - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.noteFilterSimplePeak = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangePitchShift) {
            var modulator = Config.modulators.dictionary["pitch shift"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.pitchShift - Config.pitchShiftCenter - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.pitchShift = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeStringSustain) {
            var modulator = Config.modulators.dictionary["sustain"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.stringSustain - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.stringSustain = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeEnvelopeSpeed) {
            var modulator = Config.modulators.dictionary["envelope speed"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.envelopeSpeed - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.envelopeSpeed = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeSupersawDynamism) {
            var modulator = Config.modulators.dictionary["dynamism"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.supersawDynamism - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.supersawDynamism = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeSupersawSpread) {
            var modulator = Config.modulators.dictionary["spread"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.supersawSpread - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.supersawSpread = slider.getValueBeforeProspectiveChange();
            }
        }
        else if (change instanceof ChangeSupersawShape) {
            var modulator = Config.modulators.dictionary["saw shape"];
            applyToMods.push(modulator.index);
            if (toApply) applyValues.push(instrument.supersawShape - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index);
            if (slider != null) {
                instrument.supersawShape = slider.getValueBeforeProspectiveChange();
            }
        } else if (change instanceof ChangePerEnvelopeSpeed) {
            var modulator = Config.modulators.dictionary["individual envelope speed"];
            applyToMods.push(modulator.index);
            const envelopeIndex = change.getIndex();
            if (toApply) applyValues.push(EnvelopeEditor.convertIndexSpeed(instrument.envelopes[envelopeIndex].perEnvelopeSpeed, "index") - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index, envelopeIndex);
            if (slider != null) {
                instrument.envelopes[envelopeIndex].perEnvelopeSpeed = EnvelopeEditor.convertIndexSpeed(slider.getValueBeforeProspectiveChange(), "speed");
            }
            applyToEnvelopeTargets.push(envelopeIndex);

        } else if (change instanceof ChangeEnvelopeLowerBound) {
            var modulator = Config.modulators.dictionary["individual envelope lower bound"];
            applyToMods.push(modulator.index);
            const envelopeIndex = change.getIndex();
            if (toApply) applyValues.push(instrument.envelopes[envelopeIndex].perEnvelopeLowerBound*10 - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index, envelopeIndex);
            if (slider != null) {
                instrument.envelopes[envelopeIndex].perEnvelopeLowerBound = slider.getValueBeforeProspectiveChange();
            }
            applyToEnvelopeTargets.push(envelopeIndex);

        } else if (change instanceof ChangeEnvelopeUpperBound) {
            var modulator = Config.modulators.dictionary["individual envelope upper bound"];
            applyToMods.push(modulator.index);
            const envelopeIndex = change.getIndex();
            if (toApply) applyValues.push(instrument.envelopes[envelopeIndex].perEnvelopeUpperBound*10 - modulator.convertRealFactor);
            // Move the actual value back, since we just want to update the modulated value and not the base slider.
            slider = songEditor.getSliderForModSetting(modulator.index, envelopeIndex);
            if (slider != null) {
                instrument.envelopes[envelopeIndex].perEnvelopeUpperBound = slider.getValueBeforeProspectiveChange();
            }
            applyToEnvelopeTargets.push(envelopeIndex);

        }

        for (let applyIndex = 0; applyIndex < applyValues.length; applyIndex++) {
            applyValues[applyIndex] = Math.round(applyValues[applyIndex]);
        }

        // Held value from previous call. Used to record flat durations/notes.
        if (this._doc.continuingModRecordingChange != null && applyToFilterTargets.length == 0) {
            if (slider == null && this._doc.continuingModRecordingChange.storedSlider != null)
                slider = this._doc.continuingModRecordingChange.storedSlider;
            if (slider != null && +slider.input.value == slider.getValueBeforeProspectiveChange()) {
                applyValues = this._doc.continuingModRecordingChange.storedValues!;
                toApply = false;
            }
            this._doc.continuingModRecordingChange = null;
        }

        // Set the slider back to its previous value.
        if (slider != null)
            slider.updateValue(slider.getValueBeforeProspectiveChange());

        for (let applyIndex = 0; applyIndex < applyToMods.length; applyIndex++) {
            // Search the current bar (and only the current bar) for active instruments (and only active instruments) matching to the related mod to apply to.
            let usedPatterns: Pattern[] = [];
            let usedInstruments: Instrument[] = [];
            let usedInstrumentIndices: number[] = [];
            let usedModIndices: number[] = [];

            for (let channelIndex = this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex < this._doc.song.getChannelCount(); channelIndex++) {
                const channel = this._doc.song.channels[channelIndex];
                let pattern: Pattern | null = this._doc.song.getPattern(channelIndex, currentBar);
                let useInstrumentIndex = 0;
                let useModIndex = 0;

                if (pattern == null) {
                    // Hunt for instrument matching this setting and swap to it.
                    var rtn;
                    if (applyToFilterTargets.length > applyIndex)
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel, undefined, applyToFilterTargets[applyIndex]);
                    else if (applyToEnvelopeTargets.length > applyIndex)
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel, undefined, undefined, applyToEnvelopeTargets[applyIndex]);
                    else
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel);
                    useInstrumentIndex = rtn[0];
                    useModIndex = rtn[1];

                    // Found it in this channel, but the pattern doesn't exist. So, add a new pattern and swap to that instrument.
                    if (useInstrumentIndex != -1) {
                        sequence.append(new ChangeEnsurePatternExists(this._doc, channelIndex, currentBar));
                        new ChangeDuplicateSelectedReusedPatterns(this._doc, currentBar, 1, channelIndex, 1, false);

                        pattern = this._doc.song.getPattern(channelIndex, currentBar)!;

                        pattern.instruments[0] = useInstrumentIndex;

                        changedPatterns = true;
                    }
                } else {
                    var rtn;
                    if (applyToFilterTargets.length > applyIndex)
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel, pattern.instruments[0], applyToFilterTargets[applyIndex]);
                    else if (applyToEnvelopeTargets.length > applyIndex)
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel, pattern.instruments[0], undefined, applyToEnvelopeTargets[applyIndex]);
                    else
                        rtn = getMatchingInstrumentAndMod(applyToMods[applyIndex], channel, pattern.instruments[0]);
                    useInstrumentIndex = rtn[0];
                    useModIndex = rtn[1];

                    if (useInstrumentIndex != -1) {
                        new ChangeDuplicateSelectedReusedPatterns(this._doc, currentBar, 1, channelIndex, 1, false);
                        pattern = this._doc.song.getPattern(channelIndex, currentBar);

                        changedPatterns = true;
                    }
                }

                if (useInstrumentIndex != -1) {
                    // Found the appropriate mod channel's mod instrument, mod number, and the pattern to modify (useInstrumentIndex, useModIndex, and pattern respectively).
                    // Note these as needing modification, but continue on until all channels are checked.
                    usedPatterns.push(pattern!);
                    usedInstrumentIndices.push(useInstrumentIndex);
                    usedInstruments.push(channel.instruments[useInstrumentIndex]);
                    usedModIndices.push(useModIndex);
                }
            }

            // If the setting wasn't found in any channel or instruments, add it to the first unused slot in any channel.
            if (usedInstrumentIndices.length == 0) {
                for (let channelIndex = this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount; channelIndex < this._doc.song.getChannelCount(); channelIndex++) {
                    const channel = this._doc.song.channels[channelIndex];
                    let pattern: Pattern | null = this._doc.song.getPattern(channelIndex, currentBar);
                    let useInstrument = -1;
                    // If there's a pattern for this channel in this bar, it only makes sense to add the new slot in that instrument somewhere or give up and move to the next.
                    if (pattern != null) {
                        useInstrument = pattern.instruments[0];
                    }
                    // No pattern for this channel, so check through all the instruments for a free slot, and add a pattern if there's a free one.
                    else {
                        for (let instrumentIndex = 0; instrumentIndex < channel.instruments.length; instrumentIndex++) {
                            for (let mod = 0; mod < Config.modCount; mod++) {
                                if (channel.instruments[instrumentIndex].modulators[mod] == Config.modulators.dictionary["none"].index) {
                                    useInstrument = instrumentIndex;

                                    sequence.append(new ChangeEnsurePatternExists(this._doc, channelIndex, currentBar));

                                    pattern = this._doc.song.getPattern(channelIndex, currentBar)!;

                                    pattern.instruments[0] = instrumentIndex;

                                    mod = Config.modCount;
                                    instrumentIndex = channel.instruments.length;
                                    channelIndex = this._doc.song.getChannelCount();

                                    changedPatterns = true;
                                }
                            }
                        }
                    }

                    // Found a suitable instrument to use, now add the setting
                    if (useInstrument != -1) {
                        let instrument = channel.instruments[useInstrument];
                        for (let mod = 0; mod < Config.modCount; mod++) {
                            if (instrument.modulators[mod] == Config.modulators.dictionary["none"].index) {
                                instrument.modulators[mod] = applyToMods[applyIndex];
                                if (Config.modulators[applyToMods[applyIndex]].forSong) {
                                    if (applyToFilterTargets.length > applyIndex) {
                                        instrument.modFilterTypes[mod] = applyToFilterTargets[applyIndex];
                                    }
                                    instrument.modChannels[mod][0] = -1; // Song
                                } else {
                                    instrument.modChannels[mod][instrument.modChannels[mod].length] = this._doc.channel;

                                    if (this._doc.song.channels[this._doc.channel].instruments.length > 1) {
                                        // Ctrl key or Shift key: set the new mod target to "active" modulation for the most flexibility, if there's more than one instrument in the channel.
                                        if (!this.controlMode || !this.shiftMode)
                                            instrument.modInstruments[mod][instrument.modChannels[mod].length] = this._doc.song.channels[this._doc.channel].instruments.length + 1;
                                        // Control+Shift key: Set the new mod target to the currently viewed instrument only.
                                        else
                                            instrument.modInstruments[mod][instrument.modChannels[mod].length] = this._doc.getCurrentInstrument();
                                    }
                                    else
                                        instrument.modInstruments[mod][instrument.modChannels[mod].length] = 0;

                                    // Filter dot. Add appropriate filter target settings (dot# X and dot# Y mod).
                                    if (applyToFilterTargets.length > applyIndex) {
                                        instrument.modFilterTypes[mod] = applyToFilterTargets[applyIndex];
                                    }
                                    //or add appropriate envelope settings
                                    else if (applyToEnvelopeTargets.length > applyIndex)
                                        instrument.modEnvelopeNumbers[mod] = applyToEnvelopeTargets[applyIndex];
                                }

                                usedPatterns.push(pattern!);
                                usedInstrumentIndices.push(useInstrument);
                                usedInstruments.push(instrument);
                                usedModIndices.push(mod);

                                mod = Config.modCount; channelIndex = this._doc.song.getChannelCount(); // Skip after finding one
                            }
                        }
                    }
                }
            }

            // Now, finally, go through all the used patterns/instruments/mods and add appropriate pins
            for (let i = 0; i < usedPatterns.length; i++) {

                // When recording filter dots, have a longer minimum duration to lessen the chance of fighting with active morph mods.
                const addLength = (applyToFilterTargets.length == 0) ? 0 : 24;

                // The distance before previous notes won't be extended and a new one will be created instead. A bit longer at large time quanta since the chance of missing the end of a note is higher.
                const newNoteDist = +(timeQuantum >= 6) * 6 + 12;

                let latestPart = -1;
                let latestNote: Note | null = null;
                let latestPin: NotePin | null = null;
                let latestPinIdx = -1;

                let prevNotePart = -1;
                let prevNote: Note | null = null;

                // Debug, get an unaltered copy of the current pattern (usedPatterns[i]) for comparison if an error is thrown down below.
                // let patternCopy = JSON.parse(JSON.stringify(usedPatterns[i].notes));

                // Explicitly set the mod to the applied value, just in case the note we add isn't picked up in the next synth run.
                const modNoteIndex = Config.modCount - 1 - usedModIndices[i];
                const usedInstrument = usedInstruments[i];
                if (usedInstrument.modChannels[usedModIndices[i]][instrument.modChannels[modNoteIndex].length] >= -1) {
                    // Generate list of used instruments
                    let usedNewInstrumentIndices: number[] = [];
                    if (Config.modulators[applyToMods[applyIndex]].forSong) {
                        // Instrument doesn't matter for song, just push a random index to run the modsynth once
                        usedNewInstrumentIndices.push(0);
                    } else {
                        // All
                        if (usedInstrument.modInstruments[usedModIndices[i]][0] == this._doc.synth.song!.channels[usedInstrument.modChannels[usedModIndices[i]][0]].instruments.length) {
                            for (let k = 0; k < this._doc.synth.song!.channels[usedInstrument.modChannels[usedModIndices[i]][0]].instruments.length; k++) {
                                usedNewInstrumentIndices.push(k);
                            }
                        }
                        // Active
                        else if (usedInstrument.modInstruments[usedModIndices[i]][0] > this._doc.synth.song!.channels[usedInstrument.modChannels[usedModIndices[i]][0]].instruments.length) {
                            if (this._doc.synth.song!.getPattern(usedInstrument.modChannels[usedModIndices[i]][0], currentBar) != null)
                                usedNewInstrumentIndices = this._doc.synth.song!.getPattern(usedInstrument.modChannels[usedModIndices[i]][0], currentBar)!.instruments;
                        } else {
                            usedNewInstrumentIndices.push(usedInstrument.modInstruments[usedModIndices[i]][instrument.modChannels[modNoteIndex].length]);
                        }
                    }

                    for (let instrumentIndex = 0; instrumentIndex < usedNewInstrumentIndices.length; instrumentIndex++) {
                        this._doc.synth.setModValue(applyValues[applyIndex], applyValues[applyIndex], usedInstruments[i].modChannels[usedModIndices[i]][instrument.modChannels[modNoteIndex].length], usedNewInstrumentIndices[instrumentIndex], applyToMods[applyIndex]);
                        this._doc.synth.forceHoldMods(applyValues[applyIndex], usedInstruments[i].modChannels[usedModIndices[i]][instrument.modChannels[modNoteIndex].length], usedNewInstrumentIndices[instrumentIndex], applyToMods[applyIndex]);
                    }
                }

                // Scan for a note starting around this point.
                for (let j = 0; j < usedPatterns[i].notes.length; j++) {
                    const note = usedPatterns[i].notes[j];
                    if (note.pitches[0] == modNoteIndex && note.start <= currentPart) {
                        // Find latest pin that doesn't exceed this part.
                        for (let pinIdx = 0; pinIdx < note.pins.length; pinIdx++) {
                            const pin = note.pins[pinIdx];
                            // Special case in there to prioritize picking the start of a note over the end of another (though they share the same time).
                            if (note.start + pin.time <= currentPart && (note.start + pin.time > latestPart || (note.start == latestPart))) {
                                latestPart = note.start + pin.time;
                                latestPin = pin;
                                latestPinIdx = pinIdx;
                                latestNote = note;
                            }
                        }
                    }

                    if (note.pitches[0] == modNoteIndex && note.end <= currentPart && note.end > prevNotePart) {
                        prevNotePart = note.end;
                        prevNote = note;
                    }
                }

                let prevPart = Math.max(0, currentPart - timeQuantum);
                let endPart = Math.min(currentPart + timeQuantum + addLength, Config.partsPerBeat * this._doc.song.beatsPerBar);

                let continuous = (toApply == false);

                // Make a new note if enough time has elapsed since the prior note.
                if (latestNote == null || currentPart - latestNote.end >= newNoteDist) {
                    // At end, so unable to make a new note.
                    if (currentPart == endPart)
                        continue;
                    sanitizeInterval(this._doc, currentPart, endPart, usedPatterns[i], modNoteIndex, sequence);
                    latestNote = new Note(modNoteIndex, currentPart, endPart, applyValues[applyIndex], this._doc.song.getChannelIsNoise(this._doc.channel));
                    sequence.append(new ChangeNoteAdded(this._doc, usedPatterns[i], latestNote, usedPatterns[i].notes.length));
                }
                else if (latestPart == currentPart) {
                    sanitizeInterval(this._doc, prevPart, currentPart, usedPatterns[i], modNoteIndex, sequence);
                    sanitizeInterval(this._doc, currentPart, endPart, usedPatterns[i], modNoteIndex, sequence);

                    latestPin!.size = applyValues[applyIndex];

                    if (continuous) {
                        for (let usePin = 0; usePin < latestNote.pins.length; usePin++) {
                            if (latestNote.pins[usePin].time >= prevPart && latestNote.pins[usePin].time <= currentPart)
                                latestNote.pins[usePin].size = applyValues[applyIndex];
                        }
                    }

                    if (prevNote != null && prevNote.pins.length >= 2) {
                        // Directly update the overlapping pin.
                        if (prevNote.end == currentPart) {
                            prevNote.pins[prevNote.pins.length - 1].size = applyValues[applyIndex];

                            if (continuous) {
                                for (let usePin = 0; usePin < prevNote.pins.length; usePin++) {
                                    if (prevNote.pins[usePin].time + prevNote.start >= prevPart)
                                        prevNote.pins[usePin].size = applyValues[applyIndex];
                                }
                            }
                        }
                        // Bridge the gap from previous note to this.
                        else if (prevNote.end == prevPart && latestNote.start == currentPart) {
                            prevNote.pins.push(makeNotePin(0, currentPart - prevNote.start, applyValues[applyIndex]));
                            prevNote.end = currentPart;
                        }
                    }
                }
                else if (currentPart - latestPart < 8 && latestNote.pins[latestPinIdx].size == applyValues[applyIndex]) {
                    // Don't record flat readings, prefer smooth interpolation.
                    // But, we'll still smooth out previous pins if we're continuously holding.
                    if (continuous) {
                        for (let usePin = 0; usePin < latestNote.pins.length; usePin++) {
                            if (latestNote.pins[usePin].time >= prevPart && latestNote.pins[usePin].time <= currentPart)
                                latestNote.pins[usePin].size = applyValues[applyIndex];
                        }
                    }
                }
                else {
                    // Insert a pin in the current note.
                    if (latestNote.pins.length - 1 > latestPinIdx) {
                        sanitizeInterval(this._doc, prevPart, currentPart, usedPatterns[i], modNoteIndex, sequence);
                        sanitizeInterval(this._doc, currentPart, endPart, usedPatterns[i], modNoteIndex, sequence);

                        // Sanitization can cause a pin to snap to the insertion point. If so, use it instead.
                        let k: number;
                        let usePin: NotePin | null = null;
                        for (k = 0; k < latestNote.pins.length; k++) {
                            if (latestNote.pins[k].time == currentPart - latestNote.start) {
                                usePin = latestNote.pins[k];
                                break;
                            }
                            else if (latestNote.pins[k].time > currentPart - latestNote.start)
                                break;
                        }
                        if (usePin != null)
                            usePin.size = applyValues[applyIndex];
                        else
                            latestNote.pins.splice(k, 0, makeNotePin(0, currentPart - latestNote.start, applyValues[applyIndex]));
                    }
                    // Push a new pin at the end of the note.
                    else {
                        sanitizeInterval(this._doc, prevPart, currentPart, usedPatterns[i], modNoteIndex, sequence);
                        sanitizeInterval(this._doc, currentPart, endPart, usedPatterns[i], modNoteIndex, sequence);
                        latestNote.pins.push(makeNotePin(0, currentPart - latestNote.start, applyValues[applyIndex]));
                        latestNote.end = currentPart;
                    }

                    if (continuous) {
                        for (let usePin = 0; usePin < latestNote.pins.length; usePin++) {
                            if (latestNote.pins[usePin].time >= prevPart && latestNote.pins[usePin].time <= currentPart)
                                latestNote.pins[usePin].size = applyValues[applyIndex];
                        }
                    }
                }

                // A few sanity checks.
                let lastNoteEnds: number[] = [-1, -1, -1, -1, -1, -1];
                usedPatterns[i].notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });
                for (let checkIndex = 0; checkIndex < usedPatterns[i].notes.length; checkIndex++) {
                    const note = usedPatterns[i].notes[checkIndex];
                    if (note.start < lastNoteEnds[note.pitches[0]])
                        throw new Error("Error in mod note recording!");
                    lastNoteEnds[note.pitches[0]] = note.end;
                    if (note.pins.length < 2 || note.pins[0].time > 0 || note.start == note.end
                        || note.pins[note.pins.length - 1].time != note.end - note.start) {
                        throw new Error("Error in mod note recording!");
                    }
                    let latestPinTime = -1;
                    for (let k = 0; k < note.pins.length; k++) {
                        if (note.pins[k].time <= latestPinTime) {
                            throw new Error("Error in mod note recording!");
                        }
                        latestPinTime = note.pins[k].time;
                    }
                }
            }
        }

        // Re-render mod pattern since it may have new notes in it (e.g. if editing song mods from mod channel)
        if (this._doc.channel >= this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount) {
            this._doc.currentPatternIsDirty = true;
        }

        if (applyValues.length > 0) {
            //this._doc.record(sequence);
            this._doc.continuingModRecordingChange = new ChangeHoldingModRecording(this._doc, change, applyValues, slider);
        }

        return changedPatterns;
    }

    stopEditingModLabel(discardChanges: boolean) {
        if (this.editingModLabel) {
            this.editingModLabel = false;
            this.modDragValueLabel.style.setProperty("pointer-events", "none");

            if (window.getSelection) {
                let sel: Selection | null = window.getSelection();
                if (sel != null)
                    sel.removeAllRanges();
            }
            // Return pin to its state before text editing
            if (discardChanges) {
                this._modDragPin.size = this._modDragStartValue;

                let presValue = this._modDragStartValue + Config.modulators[this._modDragSetting].convertRealFactor;

                // This is me being too lazy to fiddle with the css to get it to align center.
                let xOffset = (+(presValue >= 10.0)) + (+(presValue >= 100.0)) + (+(presValue < 0.0)) + (+(presValue <= -10.0));
                this._modDragValueLabelLeft = +prettyNumber(Math.max(Math.min(this._editorWidth - 10 - xOffset * 8, this._partWidth * (this._modDragNote.start + this._modDragPin.time) - 4 - xOffset * 4), 2));
                this.modDragValueLabel.style.setProperty("left", "" + this._modDragValueLabelLeft + "px");

                const sequence = new ChangeSequence();
                this._dragChange = sequence;
                this._doc.setProspectiveChange(this._dragChange);

                sequence.append(new ChangeSizeBend(this._doc, this._modDragNote, this._modDragPin.time, this._modDragStartValue, this._modDragPin.interval, this.shiftMode));

                this._dragChange = null;
            }

            const continuousState = this._doc.lastChangeWas(this._dragChange);
            if (continuousState) {
                if (this._dragChange != null) {
                    this._doc.record(this._dragChange);
                    this._dragChange = null;
                }
            }
        }
    }

    private _whenCursorPressed(): void {
        // Check for click on mod value label
        if (this._doc.song.getChannelIsMod(this._doc.channel) && this.modDragValueLabel.style.getPropertyValue("display") != "none" &&
            this._mouseX > +this._modDragValueLabelLeft - 6 &&
            this._mouseX < +this._modDragValueLabelLeft + this._modDragValueLabelWidth + 6 &&
            this._mouseY > +this._modDragValueLabelTop - 8 &&
            this._mouseY < +this._modDragValueLabelTop + 11) {
            // Mod value label clicked, select it
            this.modDragValueLabel.style.setProperty("pointer-events", "fill");
            this.modDragValueLabel.setAttribute("contenteditable", "true");
            if (window.getSelection) {
                let sel: Selection | null = window.getSelection();
                if (sel != null)
                    sel.selectAllChildren(this.modDragValueLabel);
            }

            window.setTimeout(() => { this.modDragValueLabel.focus(); });
            this.editingModLabel = true;
        } else {
            this.stopEditingModLabel(false);
            if (this._doc.prefs.enableNotePreview) this._doc.synth.maintainLiveInput();
            this._mouseDown = true;
            this._mouseXStart = this._mouseX;
            this._mouseYStart = this._mouseY;
            this._updateCursorStatus();
            this._updatePreview();
            const sequence = new ChangeSequence();
            this._dragChange = sequence;
            this._lastChangeWasPatternSelection = this._doc.lastChangeWas(this._changePatternSelection);
            this._doc.setProspectiveChange(this._dragChange);

            if (this._cursorAtStartOfSelection()) {
                this._draggingStartOfSelection = true;
            } else if (this._cursorAtEndOfSelection()) {
                this._draggingEndOfSelection = true;
            } else if (this._shiftHeld) {
                if ((this._doc.selection.patternSelectionActive && this._cursor.pitchIndex == -1) || this._cursorIsInSelection()) {
                    sequence.append(new ChangePatternSelection(this._doc, 0, 0));
                } else {
                    if (this._cursor.curNote != null) {
                        sequence.append(new ChangePatternSelection(this._doc, this._cursor.curNote.start, this._cursor.curNote.end));
                    } else {
                        const start = Math.max(0, Math.min((this._doc.song.beatsPerBar - 1) * Config.partsPerBeat, Math.floor(this._cursor.exactPart / Config.partsPerBeat) * Config.partsPerBeat));
                        const end = start + Config.partsPerBeat;
                        sequence.append(new ChangePatternSelection(this._doc, start, end));
                    }
                }
            } else if (this._cursorIsInSelection()) {
                this._draggingSelectionContents = true;
            } else if (this._cursor.valid && this._cursor.curNote == null) {
                sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                // If clicking in empty space, the result will be adding a note,
                // so we can safely add it immediately. Note that if clicking on
                // or near an existing note, the result will depend on whether
                // a drag follows, so we couldn't add the note yet without being
                // confusing.

                const note = new Note(this._cursor.pitch, this._cursor.start, this._cursor.end, Config.noteSizeMax, this._doc.song.getChannelIsNoise(this._doc.channel), this._cursor.chipWaveSampleOffset);
                note.pins = [];
                for (const oldPin of this._cursor.pins) {
                    note.pins.push(makeNotePin(0, oldPin.time, oldPin.size));
                }
                sequence.append(new ChangeEnsurePatternExists(this._doc, this._doc.channel, this._doc.bar));
                const pattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);
                if (pattern == null) throw new Error();
                sequence.append(new ChangeNoteAdded(this._doc, pattern, note, this._cursor.curIndex));

                if (this._doc.prefs.enableNotePreview && !this._doc.synth.playing) {
                    // Play the new note out loud if enabled.
                    const duration = Math.min(Config.partsPerBeat, this._cursor.end - this._cursor.start);
                    this._doc.performance.setTemporaryPitches([this._cursor.pitch], duration);
                }
            }
            this._updateSelection();
        }
    }

    private _whenMouseMoved = (event: MouseEvent): void => {
        this.controlMode = event.ctrlKey;
        this.shiftMode = event.shiftKey;

        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = ((event.clientX || event.pageX) - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._usingTouch = false;
        this._whenCursorMoved();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (!this._mouseDown) return;
        event.preventDefault();
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.touches[0].clientX - boundingRect.left) * this._editorWidth / (boundingRect.right - boundingRect.left);
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseX)) this._mouseX = 0;
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorMoved();
    }

    private _whenCursorMoved(): void {
        if (this._doc.prefs.enableNotePreview && this._mouseOver) this._doc.synth.maintainLiveInput();

        // HACK: Undoable pattern changes rely on persistent instance
        // references. Loading song from hash via undo/redo breaks that,
        // so changes are no longer undoable and the cursor status may be
        // invalid. Abort further drag changes until the mouse is released.
        const continuousState = this._doc.lastChangeWas(this._dragChange);

        if (!this._mouseDragging && this._mouseDown && this._cursor.valid && continuousState) {
            const dx = this._mouseX - this._mouseXStart;
            const dy = this._mouseY - this._mouseYStart;
            if (Math.sqrt(dx * dx + dy * dy) > 5) {
                this._mouseDragging = true;
                this._mouseHorizontal = Math.abs(dx) >= Math.abs(dy);
            }
        }

        if (this._shiftHeld && this._mouseHorizontal && Math.abs(this._mouseXStart - this._mouseX) > 5) {
            this._dragConfirmed = true;
        }

        if (this._mouseDragging && this._mouseDown && this._cursor.valid && continuousState) {
            this._dragChange!.undo();
            const sequence = new ChangeSequence();
            this._dragChange = sequence;
            this._doc.setProspectiveChange(this._dragChange);

            const minDivision = this._getMinDivision();
            const currentPart = this._snapToMinDivision(this._mouseX / this._partWidth);
            if (this._draggingStartOfSelection) {
                sequence.append(new ChangePatternSelection(this._doc, Math.max(0, Math.min(this._doc.song.beatsPerBar * Config.partsPerBeat, currentPart)), this._doc.selection.patternSelectionEnd));
                this._updateSelection();
            } else if (this._draggingEndOfSelection) {
                sequence.append(new ChangePatternSelection(this._doc, this._doc.selection.patternSelectionStart, Math.max(0, Math.min(this._doc.song.beatsPerBar * Config.partsPerBeat, currentPart))));
                this._updateSelection();
            } else if (this._draggingSelectionContents) {
                const pattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);
                if (this._mouseDragging && pattern != null) {
                    this._dragChange!.undo();
                    const sequence = new ChangeSequence();
                    this._dragChange = sequence;
                    this._doc.setProspectiveChange(this._dragChange);

                    let scale = this._doc.song.scale == Config.scales.dictionary["Custom"].index ? this._doc.song.scaleCustom : Config.scales[this._doc.song.scale].flags;
                    const notesInScale = scale.filter(x => x).length;
                    const pitchRatio = this._doc.song.getChannelIsNoise(this._doc.channel) ? 1 : 12 / notesInScale;
                    const draggedParts = Math.round((this._mouseX - this._mouseXStart) / (this._partWidth * minDivision)) * minDivision;
                    const draggedTranspose = Math.round((this._mouseYStart - this._mouseY) / (this._pitchHeight * pitchRatio));
                    sequence.append(new ChangeDragSelectedNotes(this._doc, this._doc.channel, pattern, draggedParts, draggedTranspose));
                }

            } else if (this._shiftHeld && this._dragConfirmed) {

                if (this._mouseDragging) {
                    let start = Math.max(0, Math.min((this._doc.song.beatsPerBar - 1) * Config.partsPerBeat, Math.floor(this._cursor.exactPart / Config.partsPerBeat) * Config.partsPerBeat));
                    let end = start + Config.partsPerBeat;
                    if (this._cursor.curNote != null) {
                        start = Math.max(start, this._cursor.curNote.start);
                        end = Math.min(end, this._cursor.curNote.end);
                    }

                    // Todo: The following two conditional blocks could maybe be refactored.
                    if (currentPart < start) {
                        start = 0;
                        const pattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);
                        if (pattern != null) {
                            for (let i = 0; i < pattern.notes.length; i++) {
                                if (pattern.notes[i].start <= currentPart) {
                                    start = pattern.notes[i].start;
                                }
                                if (pattern.notes[i].end <= currentPart) {
                                    start = pattern.notes[i].end;
                                }
                            }
                        }
                        for (let beat = 0; beat <= this._doc.song.beatsPerBar; beat++) {
                            const part = beat * Config.partsPerBeat;
                            if (start <= part && part <= currentPart) {
                                start = part;
                            }
                        }
                    }

                    if (currentPart > end) {
                        end = Config.partsPerBeat * this._doc.song.beatsPerBar;
                        const pattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);
                        if (pattern != null) {
                            for (let i = 0; i < pattern.notes.length; i++) {
                                if (pattern.notes[i].start >= currentPart) {
                                    end = pattern.notes[i].start;
                                    break;
                                }
                                if (pattern.notes[i].end >= currentPart) {
                                    end = pattern.notes[i].end;
                                    break;
                                }
                            }
                        }
                        for (let beat = 0; beat <= this._doc.song.beatsPerBar; beat++) {
                            const part = beat * Config.partsPerBeat;
                            if (currentPart < part && part < end) {
                                end = part;
                            }
                        }
                    }

                    sequence.append(new ChangePatternSelection(this._doc, start, end));
                    this._updateSelection();
                }
            } else {

                if (this._cursor.curNote == null) {
                    sequence.append(new ChangePatternSelection(this._doc, 0, 0));


                    let backwards: boolean;
                    let directLength: number;
                    if (currentPart < this._cursor.start) {
                        backwards = true;
                        directLength = this._cursor.start - currentPart;
                    } else {
                        backwards = false;
                        directLength = currentPart - this._cursor.start + minDivision;
                    }

                    let defaultLength = minDivision;
                    for (let i = minDivision; i <= this._doc.song.beatsPerBar * Config.partsPerBeat; i += minDivision) {
                        if (minDivision == 1) {
                            if (i < 5) {
                                // Allow small lengths.
                            } else if (i <= Config.partsPerBeat / 2.0) {
                                if (i % 3 != 0 && i % 4 != 0) {
                                    continue;
                                }
                            } else if (i <= Config.partsPerBeat * 1.5) {
                                if (i % 6 != 0 && i % 8 != 0) {
                                    continue;
                                }
                            } else if (i % Config.partsPerBeat != 0) {
                                continue;
                            }
                        } else {
                            if (i >= 5 * minDivision &&
                                i % Config.partsPerBeat != 0 &&
                                i != Config.partsPerBeat * 3.0 / 4.0 &&
                                i != Config.partsPerBeat * 3.0 / 2.0 &&
                                i != Config.partsPerBeat * 4.0 / 3.0) {
                                continue;
                            }
                        }

                        const blessedLength = i;
                        if (blessedLength == directLength) {
                            defaultLength = blessedLength;
                            break;
                        }
                        if (blessedLength < directLength) {
                            defaultLength = blessedLength;
                        }

                        if (blessedLength > directLength) {
                            if (defaultLength < directLength - minDivision) {
                                defaultLength = blessedLength;
                            }
                            break;
                        }
                    }

                    let start: number;
                    let end: number;

                    if (backwards) {
                        end = this._cursor.start;
                        start = end - defaultLength;
                    } else {
                        start = this._cursor.start;
                        end = start + defaultLength;
                    }
                    const continuesLastPattern = (start < 0 && this._doc.channel < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount);
                    if (start < 0) start = 0;
                    if (end > this._doc.song.beatsPerBar * Config.partsPerBeat) end = this._doc.song.beatsPerBar * Config.partsPerBeat;

                    if (start < end) {
                        sequence.append(new ChangeEnsurePatternExists(this._doc, this._doc.channel, this._doc.bar));
                        const pattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);
                        if (pattern == null) throw new Error();
                        // Using parameter skipNote to force proper "collision" checking vis-a-vis pitch for mod channels.
                        sequence.append(new ChangeNoteTruncate(this._doc, pattern, start, end, new Note(this._cursor.pitch, 0, 0, 0)));
                        let i: number;
                        for (i = 0; i < pattern.notes.length; i++) {
                            if (pattern.notes[i].start >= end) break;
                        }
                        const theNote = new Note(this._cursor.pitch, start, end,
                            this._doc.song.getNewNoteVolume(this._doc.song.getChannelIsMod(this._doc.channel), this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), this._cursor.pitch),
                            this._doc.song.getChannelIsNoise(this._doc.channel));
                        theNote.continuesLastPattern = continuesLastPattern;
                        sequence.append(new ChangeNoteAdded(this._doc, pattern, theNote, i));
                        this._copyPins(theNote);

                        this._dragTime = backwards ? start : end;
                        this._dragPitch = this._cursor.pitch;
                        this._dragSize = theNote.pins[backwards ? 0 : 1].size;
                        this._dragVisible = true;
                    }

                    let prevPattern: Pattern | null = this._pattern;

                    this._pattern = this._doc.getCurrentPattern(this._barOffset);

                    if (this._pattern != null && this._doc.song.getChannelIsMod(this._doc.channel) && this._interactive && prevPattern != this._pattern) {
                        // Need to re-sort the notes by start time as they might change order if user drags them around.
                        this._pattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });
                    }

                } else if (this._mouseHorizontal && this._ctrlHeld) {
                    sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                    const shift = this._mouseX - this._mouseXStart;
                    let shiftedTime = this._cursor.curNote.chipWaveStartOffset - shift * 100
                    if (this._pattern == null) throw new Error();

                    const startOffset = Math.max(shiftedTime, 0);

                    sequence.append(new ChangeNoteStartOffset(this._doc, this._pattern, startOffset, this._cursor.curNote));
                    this._copyPins(this._cursor.curNote);
                } else if (this._mouseHorizontal) {
                    sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                    const shift = (this._mouseX - this._mouseXStart) / this._partWidth;

                    const shiftedPin = this._cursor.curNote.pins[this._cursor.nearPinIndex];
                    let shiftedTime = Math.round((this._cursor.curNote.start + shiftedPin.time + shift) / minDivision) * minDivision;
                    const continuesLastPattern = (shiftedTime < 0.0 && this._doc.channel < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount);
                    if (shiftedTime < 0) shiftedTime = 0;
                    if (shiftedTime > this._doc.song.beatsPerBar * Config.partsPerBeat) shiftedTime = this._doc.song.beatsPerBar * Config.partsPerBeat;

                    if (this._pattern == null) throw new Error();

                    if (shiftedTime <= this._cursor.curNote.start && this._cursor.nearPinIndex == this._cursor.curNote.pins.length - 1 ||
                        shiftedTime >= this._cursor.curNote.end && this._cursor.nearPinIndex == 0) {

                        sequence.append(new ChangeNoteAdded(this._doc, this._pattern, this._cursor.curNote, this._cursor.curIndex, true));

                        this._dragVisible = false;
                    } else {
                        const start = Math.min(this._cursor.curNote.start, shiftedTime);
                        const end = Math.max(this._cursor.curNote.end, shiftedTime);

                        this._dragTime = shiftedTime;
                        this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + this._cursor.curNote.pins[this._cursor.nearPinIndex].interval;
                        this._dragSize = this._cursor.curNote.pins[this._cursor.nearPinIndex].size;
                        this._dragVisible = true;

                        sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, start, end, this._cursor.curNote));
                        sequence.append(new ChangePinTime(this._doc, this._cursor.curNote, this._cursor.nearPinIndex, shiftedTime, continuesLastPattern));
                        this._copyPins(this._cursor.curNote);
                    }
                } else if (this._cursor.pitchIndex == -1 || this._doc.song.getChannelIsMod(this._doc.channel)) {

                    if (!this._mouseDragging)
                        sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                    const bendPart =
                        Math.max(this._cursor.curNote.start,
                            Math.min(this._cursor.curNote.end,
                                Math.round(this._mouseX / (this._partWidth * minDivision)) * minDivision
                            )
                        ) - this._cursor.curNote.start;

                    let prevPin: NotePin;
                    let nextPin = this._cursor.curNote.pins[0];
                    let bendSize = 0;
                    let bendInterval = 0;
                    let cap = this._doc.song.getVolumeCap(this._doc.song.getChannelIsMod(this._doc.channel), this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), this._cursor.pitch);

                    // Dragging gets a bit faster after difference in drag counts is >8.
                    let dragFactorSlow = 25.0 / Math.pow(cap, 0.4);
                    let dragFactorFast = 22.0 / Math.pow(cap, 0.5);
                    let dragSign = (this._mouseYStart > this._mouseY ? 1 : -1);
                    let dragCounts = Math.min(Math.abs(this._mouseYStart - this._mouseY) / dragFactorSlow, 8) + Math.max(0, Math.abs(this._mouseYStart - this._mouseY) / dragFactorFast - 8);

                    // Note volume drag overrides attempts to make a pattern selection
                    if (dragCounts > 0) {
                        this._shiftHeld = false;
                    }

                    for (let i = 1; i < this._cursor.curNote.pins.length; i++) {
                        prevPin = nextPin;
                        nextPin = this._cursor.curNote.pins[i];
                        if (bendPart > nextPin.time) continue;
                        if (bendPart < prevPin.time) throw new Error();
                        const sizeRatio = (bendPart - prevPin.time) / (nextPin.time - prevPin.time);
                        bendSize = Math.round(prevPin.size * (1.0 - sizeRatio) + nextPin.size * sizeRatio + dragSign * dragCounts);
                        // If not in fine control mode, round to 0~2~4~6 (normal 4 settings)
                        if (!this.controlMode && !this._doc.prefs.alwaysFineNoteVol && !this._doc.song.getChannelIsMod(this._doc.channel)) {
                            bendSize = Math.floor(bendSize / 2) * 2;
                        }
                        if (bendSize < 0) bendSize = 0;
                        if (bendSize > cap) bendSize = cap;
                        bendInterval = this._snapToPitch(prevPin.interval * (1.0 - sizeRatio) + nextPin.interval * sizeRatio + this._cursor.curNote.pitches[0], 0, this._getMaxPitch()) - this._cursor.curNote.pitches[0];
                        break;
                    }
                    if (this._doc.song.getChannelIsMod(this._doc.channel) && this.controlMode) {
                        // Link bend to the next note over
                        if (bendPart >= this._cursor.curNote.pins[this._cursor.curNote.pins.length - 1].time) {
                            if (this._cursor.curNote.start + this._cursor.curNote.pins[this._cursor.curNote.pins.length - 1].time < this._doc.song.beatsPerBar * Config.partsPerBeat) {
                                for (const note of this._pattern!.notes) {
                                    if (note.start == this._cursor.curNote.start + this._cursor.curNote.pins[this._cursor.curNote.pins.length - 1].time && note.pitches[0] == this._cursor.curNote.pitches[0]) {
                                        sequence.append(new ChangeSizeBend(this._doc, note, note.pins[0].time, bendSize, bendInterval, this.shiftMode));
                                    }
                                }
                            }
                            else {
                                // Try to bend to the next pattern over. Only do this if a note starts at 0, and instrument is identical in next pattern.
                                const nextPattern: Pattern | null = this._doc.getCurrentPattern(1);

                                if (nextPattern != null && nextPattern.instruments[0] == this._pattern!.instruments[0]) {
                                    for (const note of nextPattern.notes) {
                                        if (note.start == 0 && note.pitches[0] == this._cursor.curNote.pitches[0]) {
                                            sequence.append(new ChangeSizeBend(this._doc, note, note.pins[0].time, bendSize, bendInterval, this.shiftMode));
                                        }
                                    }
                                }

                            }
                        }
                        // Link bend to the previous note
                        else if (bendPart <= this._cursor.curNote.pins[0].time) {
                            if (this._cursor.curNote.start > 0) {
                                for (const note of this._pattern!.notes) {
                                    if (note.end == this._cursor.curNote.start && note.pitches[0] == this._cursor.curNote.pitches[0]) {
                                        sequence.append(new ChangeSizeBend(this._doc, note, note.pins[note.pins.length - 1].time, bendSize, bendInterval, this.shiftMode));
                                    }
                                }
                            }
                            else {
                                // Try to bend to the previous pattern over. Only do this if a note starts at the end, and instrument is identical in previous pattern.
                                const prevPattern: Pattern | null = this._doc.getCurrentPattern(-1);

                                if (prevPattern != null && prevPattern.instruments[0] == this._pattern!.instruments[0]) {
                                    for (const note of prevPattern.notes) {
                                        if (note.end == this._doc.song.beatsPerBar * Config.partsPerBeat && note.pitches[0] == this._cursor.curNote.pitches[0]) {
                                            sequence.append(new ChangeSizeBend(this._doc, note, note.pins[note.pins.length - 1].time, bendSize, bendInterval, this.shiftMode));
                                        }
                                    }
                                }
                            }
                        }
                    }

                    this._dragTime = this._cursor.curNote.start + bendPart;
                    this._dragPitch = this._cursor.curNote.pitches[this._cursor.pitchIndex == -1 ? 0 : this._cursor.pitchIndex] + bendInterval;
                    this._dragSize = bendSize;
                    this._dragVisible = true;

                    sequence.append(new ChangeSizeBend(this._doc, this._cursor.curNote, bendPart, bendSize, bendInterval, this.shiftMode));
                    this._copyPins(this._cursor.curNote);
                } else {
                    sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                    this._dragSize = this._cursor.curNote.pins[this._cursor.nearPinIndex].size;

                    if (this._pattern == null) throw new Error();

                    let bendStart: number;
                    let bendEnd: number;
                    if (this._mouseX >= this._mouseXStart) {
                        bendStart = Math.max(this._cursor.curNote.start, this._cursor.part);
                        bendEnd = currentPart + minDivision;
                    } else {
                        bendStart = Math.min(this._cursor.curNote.end, this._cursor.part + minDivision);
                        bendEnd = currentPart;
                    }
                    if (bendEnd < 0) bendEnd = 0;
                    if (bendEnd > this._doc.song.beatsPerBar * Config.partsPerBeat) bendEnd = this._doc.song.beatsPerBar * Config.partsPerBeat;
                    if (bendEnd > this._cursor.curNote.end) {
                        sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, this._cursor.curNote.start, bendEnd, this._cursor.curNote));
                    }
                    if (bendEnd < this._cursor.curNote.start) {
                        sequence.append(new ChangeNoteTruncate(this._doc, this._pattern, bendEnd, this._cursor.curNote.end, this._cursor.curNote));
                    }

                    let minPitch = Number.MAX_VALUE;
                    let maxPitch = -Number.MAX_VALUE;
                    for (const pitch of this._cursor.curNote.pitches) {
                        if (minPitch > pitch) minPitch = pitch;
                        if (maxPitch < pitch) maxPitch = pitch;
                    }
                    minPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];
                    maxPitch -= this._cursor.curNote.pitches[this._cursor.pitchIndex];

                    if (!this._doc.song.getChannelIsMod(this._doc.channel)) {
                        const bendTo = this._snapToPitch(this._findMousePitch(this._mouseY), -minPitch, this._getMaxPitch() - maxPitch);
                        sequence.append(new ChangePitchBend(this._doc, this._cursor.curNote, bendStart, bendEnd, bendTo, this._cursor.pitchIndex));
                        this._dragPitch = bendTo;
                    }
                    else {
                        const bendTo = this._snapToPitch(this._dragPitch, -minPitch, Config.modCount - 1);
                        sequence.append(new ChangePitchBend(this._doc, this._cursor.curNote, bendStart, bendEnd, bendTo, this._cursor.pitchIndex));
                        this._dragPitch = bendTo;
                    }
                    this._copyPins(this._cursor.curNote);

                    this._dragTime = bendEnd;
                    this._dragVisible = true;
                }
            }
        }

        if (!(this._mouseDown && this._cursor.valid && continuousState)) {
            this._updateCursorStatus();
            this._updatePreview();
        }
    }

    private _whenCursorReleased = (event: Event | null): void => {
        if (!this._cursor.valid) return;

        const continuousState = this._doc.lastChangeWas(this._dragChange);
        if (this._mouseDown && continuousState && this._dragChange != null) {

            if (this._draggingSelectionContents) {
                this._doc.record(this._dragChange);
                this._dragChange = null;
                // Need to re-sort the notes by start time as they might change order if user drags them around.
                if (this._pattern != null && this._doc.song.getChannelIsMod(this._doc.channel)) this._pattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });

            } else if (this._draggingStartOfSelection || this._draggingEndOfSelection || this._shiftHeld) {
                this._setPatternSelection(this._dragChange);
                this._dragChange = null;
            } else if (this._mouseDragging || this._cursor.curNote == null || !this._dragChange.isNoop() || this._draggingStartOfSelection || this._draggingEndOfSelection || this._draggingSelectionContents || this._shiftHeld) {
                this._doc.record(this._dragChange);
                this._dragChange = null;
                // Need to re-sort the notes by start time as they might change order if user drags them around.
                if (this._pattern != null && this._doc.song.getChannelIsMod(this._doc.channel)) this._pattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });

            } else {

                if (this._pattern == null) throw new Error();

                const sequence = new ChangeSequence();
                sequence.append(new ChangePatternSelection(this._doc, 0, 0));

                if (this._cursor.pitchIndex == -1) {
                    if (this._cursor.curNote.pitches.length == Config.maxChordSize) {
                        sequence.append(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.curNote.pitches[0], 0, true));
                    }
                    sequence.append(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.pitch, this._cursor.curNote.pitches.length));
                    this._copyPins(this._cursor.curNote);

                    if (this._doc.prefs.enableNotePreview && !this._doc.synth.playing) {
                        const duration = Math.min(Config.partsPerBeat, this._cursor.end - this._cursor.start);
                        this._doc.performance.setTemporaryPitches(this._cursor.curNote.pitches, duration);
                    }
                } else {
                    if (this._cursor.curNote.pitches.length == 1) {
                        sequence.append(new ChangeNoteAdded(this._doc, this._pattern, this._cursor.curNote, this._cursor.curIndex, true));
                    } else {
                        sequence.append(new ChangePitchAdded(this._doc, this._cursor.curNote, this._cursor.pitch, this._cursor.curNote.pitches.indexOf(this._cursor.pitch), true));
                    }
                }

                this._doc.record(sequence);
            }
        }

        this._mouseDown = false;
        this._mouseDragging = false;
        this._draggingStartOfSelection = false;
        this._draggingEndOfSelection = false;
        this._draggingSelectionContents = false;
        this._lastChangeWasPatternSelection = false;
        this.modDragValueLabel.setAttribute("fill", ColorConfig.secondaryText);
        this._updateCursorStatus();
        this._updatePreview();
    }

    private _setPatternSelection(change: UndoableChange): void {
        this._changePatternSelection = change;
        this._doc.record(this._changePatternSelection, this._lastChangeWasPatternSelection);
    }


    private _updatePreview(): void {
        if (this._usingTouch) {
            if (!this._mouseDown || !this._cursor.valid || !this._mouseDragging || !this._dragVisible || this._shiftHeld || this._draggingStartOfSelection || this._draggingEndOfSelection || this._draggingSelectionContents) {
                this._svgPreview.setAttribute("visibility", "hidden");

                if (!this.editingModLabel) {
                    this.modDragValueLabel.style.setProperty("display", "none");
                    this.modDragValueLabel.style.setProperty("pointer-events", "none");
                    this.modDragValueLabel.setAttribute("contenteditable", "false");
                }

            } else {
                this._svgPreview.setAttribute("visibility", "visible");

                const x = this._partWidth * this._dragTime;
                const y = this._pitchToPixelHeight(this._dragPitch - this._octaveOffset);
                const radius = (this._pitchHeight - this._pitchBorder) / 2;
                const width = 80;
                const height = 60;
                const cap = this._doc.song.getVolumeCap(this._doc.song.getChannelIsMod(this._doc.channel), this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), this._cursor.pitch);
                //this._drawNote(this._svgPreview, this._cursor.pitch, this._cursor.start, this._cursor.pins, this._pitchHeight / 2 + 1, true, this._octaveOffset);

                let pathString = "";

                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragSize / cap) - height) + " ";
                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragSize / cap) + height) + " ";
                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y - radius * (this._dragSize / cap)) + " ";
                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x + width) + " " + prettyNumber(y + radius * (this._dragSize / cap)) + " ";
                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y - radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y - radius * (this._dragSize / cap)) + " ";
                pathString += "M " + prettyNumber(x) + " " + prettyNumber(y + radius * (this._dragSize / cap)) + " ";
                pathString += "L " + prettyNumber(x - width) + " " + prettyNumber(y + radius * (this._dragSize / cap)) + " ";

                this._svgPreview.setAttribute("d", pathString);
            }
        } else {
            if (!this._mouseOver || this._mouseDown || !this._cursor.valid) {
                this._svgPreview.setAttribute("visibility", "hidden");
                if (!this.editingModLabel) {
                    this.modDragValueLabel.style.setProperty("display", "none");
                    this.modDragValueLabel.style.setProperty("pointer-events", "none");
                    this.modDragValueLabel.setAttribute("contenteditable", "false");
                }
            } else {
                this._svgPreview.setAttribute("visibility", "visible");

                if (this._cursorAtStartOfSelection()) {
                    const center = this._partWidth * this._doc.selection.patternSelectionStart;
                    const left = prettyNumber(center - 4);
                    const right = prettyNumber(center + 4);
                    const bottom = this._pitchToPixelHeight(-0.5);
                    this._svgPreview.setAttribute("d", "M " + left + " 0 L " + left + " " + bottom + " L " + right + " " + bottom + " L " + right + " 0 z");
                } else if (this._cursorAtEndOfSelection()) {
                    const center = this._partWidth * this._doc.selection.patternSelectionEnd;
                    const left = prettyNumber(center - 4);
                    const right = prettyNumber(center + 4);
                    const bottom = this._pitchToPixelHeight(-0.5);
                    this._svgPreview.setAttribute("d", "M " + left + " 0 L " + left + " " + bottom + " L " + right + " " + bottom + " L " + right + " 0 z");
                } else if (this._cursorIsInSelection()) {
                    const left = prettyNumber(this._partWidth * this._doc.selection.patternSelectionStart - 2);
                    const right = prettyNumber(this._partWidth * this._doc.selection.patternSelectionEnd + 2);
                    const bottom = this._pitchToPixelHeight(-0.5);
                    this._svgPreview.setAttribute("d", "M " + left + " 0 L " + left + " " + bottom + " L " + right + " " + bottom + " L " + right + " 0 z");
                } else {
                    this._drawNote(this._svgPreview, this._cursor.pitch, this._cursor.start, this._cursor.pins, (this._pitchHeight - this._pitchBorder) / 2 + 1, true, this._octaveOffset);
                }
            }
        }
    }

    private _updateSelection(): void {
        if (this._doc.selection.patternSelectionActive) {
            this._selectionRect.setAttribute("visibility", "visible");
            this._selectionRect.setAttribute("x", String(this._partWidth * this._doc.selection.patternSelectionStart));
            this._selectionRect.setAttribute("width", String(this._partWidth * (this._doc.selection.patternSelectionEnd - this._doc.selection.patternSelectionStart)));
        } else {
            this._selectionRect.setAttribute("visibility", "hidden");
        }
    }

    render(): void {
        const nextPattern: Pattern | null = this._doc.getCurrentPattern(this._barOffset);

        if (this._pattern != nextPattern) {
            if (this._doc.song.getChannelIsMod(this._doc.channel) && this._interactive && nextPattern != null) {
                // Need to re-sort the notes by start time as they might change order if user drags them around.
                nextPattern.notes.sort(function (a, b) { return (a.start == b.start) ? a.pitches[0] - b.pitches[0] : a.start - b.start; });
            }
            if (this._pattern != null) {
                this._dragChange = null;
                this._whenCursorReleased(null);
            }
        }
        this._pattern = nextPattern;

        this._editorWidth = this.container.clientWidth;
        this._editorHeight = this.container.clientHeight;
        this._partWidth = this._editorWidth / (this._doc.song.beatsPerBar * Config.partsPerBeat);
        this._octaveOffset = (this._doc.channel >= this._doc.song.pitchChannelCount) ? 0 : this._doc.song.channels[this._doc.channel].octave * Config.pitchesPerOctave;

        if (this._doc.song.getChannelIsNoise(this._doc.channel)) {
            this._pitchBorder = 0;
            this._pitchCount = Config.drumCount;
        }
        else if (this._doc.song.getChannelIsMod(this._doc.channel)) {
            this._pitchBorder = this._defaultModBorder;
            this._pitchCount = Config.modCount;

            if (this._pattern != null) {
                // Force max height of mod channels to conform to settings.
                for (const note of this._pattern.notes) {
                    let pitch = note.pitches[0]; // No pitch bend possible in mod channels.
                    let maxHeight = this._doc.song.getVolumeCap(true, this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), pitch);
                    let maxFoundHeight = 0;
                    for (const pin of note.pins) {
                        if (pin.size > maxFoundHeight) {
                            maxFoundHeight = pin.size;
                        }
                    }
                    // Apply scaling if the max height is below any pin setting.
                    if (maxFoundHeight > maxHeight) {
                        for (const pin of note.pins) {
                            pin.size = Math.round(pin.size * (maxHeight / maxFoundHeight));
                        }
                    }
                }
            }
        }
        else {
            this._pitchBorder = 0;
            this._pitchCount = this._doc.getVisiblePitchCount();
        }

        this._pitchHeight = this._editorHeight / this._pitchCount;
        this._octaveOffset = (this._doc.channel >= this._doc.song.pitchChannelCount) ? 0 : this._doc.getBaseVisibleOctave(this._doc.channel) * Config.pitchesPerOctave;

        if (this._renderedRhythm != this._doc.song.rhythm ||
            this._renderedPitchChannelCount != this._doc.song.pitchChannelCount ||
            this._renderedNoiseChannelCount != this._doc.song.noiseChannelCount ||
            this._renderedModChannelCount != this._doc.song.modChannelCount) {
            this._renderedRhythm = this._doc.song.rhythm;
            this._renderedPitchChannelCount = this._doc.song.pitchChannelCount;
            this._renderedNoiseChannelCount = this._doc.song.noiseChannelCount;
            this._renderedModChannelCount = this._doc.song.modChannelCount;
            this.resetCopiedPins();
        }

        this._copiedPins = this._copiedPinChannels[this._doc.channel];

        if (this._renderedWidth != this._editorWidth || this._renderedHeight != this._editorHeight) {
            this._renderedWidth = this._editorWidth;
            this._renderedHeight = this._editorHeight;
            this._svgBackground.setAttribute("width", "" + this._editorWidth);
            this._svgBackground.setAttribute("height", "" + this._editorHeight);
            this._svgPlayhead.setAttribute("height", "" + this._editorHeight);
            this._selectionRect.setAttribute("y", "0");
            this._selectionRect.setAttribute("height", "" + this._editorHeight);
        }

        const beatWidth = this._editorWidth / this._doc.song.beatsPerBar;
        if (this._renderedBeatWidth != beatWidth || this._renderedPitchHeight != this._pitchHeight) {
            this._renderedBeatWidth = beatWidth;
            this._renderedPitchHeight = this._pitchHeight;
            this._svgNoteBackground.setAttribute("width", "" + beatWidth);
            this._svgNoteBackground.setAttribute("height", "" + (this._pitchHeight * Config.pitchesPerOctave));
            this._svgDrumBackground.setAttribute("width", "" + beatWidth);
            this._svgDrumBackground.setAttribute("height", "" + this._pitchHeight);
            this._svgModBackground.setAttribute("width", "" + beatWidth);
            this._svgModBackground.setAttribute("height", "" + (this._pitchHeight));
            this._svgModBackground.setAttribute("y", "" + (this._pitchBorder / 2));
            this._backgroundDrumRow.setAttribute("width", "" + (beatWidth - 2));
            this._backgroundDrumRow.setAttribute("height", "" + (this._pitchHeight - 2));
            if (this._pitchHeight > this._pitchBorder) {
                this._backgroundModRow.setAttribute("width", "" + (beatWidth - 2));
                this._backgroundModRow.setAttribute("height", "" + (this._pitchHeight - this._pitchBorder));
            }



            for (let j = 0; j < Config.pitchesPerOctave; j++) {
                const rectangle = this._backgroundPitchRows[j];
                const y = (Config.pitchesPerOctave - j) % Config.pitchesPerOctave;
                rectangle.setAttribute("width", "" + (beatWidth - 2));
                rectangle.setAttribute("y", "" + (y * this._pitchHeight + 1));
                rectangle.setAttribute("height", "" + (this._pitchHeight - 2));
            }
        }

        if (this._interactive) {
            if (!this._mouseDown) this._updateCursorStatus();
            this._updatePreview();
            this._updateSelection();
        }

        if (this._renderedFifths != this._doc.prefs.showFifth) {
            this._renderedFifths = this._doc.prefs.showFifth;
            this._backgroundPitchRows[7].setAttribute("fill", this._doc.prefs.showFifth ? ColorConfig.fifthNote : ColorConfig.pitchBackground);
        }

        for (let j = 0; j < Config.pitchesPerOctave; j++) {
            let scale = this._doc.song.scale == Config.scales.dictionary["Custom"].index ? this._doc.song.scaleCustom : Config.scales[this._doc.song.scale].flags;

            this._backgroundPitchRows[j].style.visibility = scale[j] ? "visible" : "hidden";
        }

        if (this._doc.song.getChannelIsNoise(this._doc.channel)) {
            if (!this._renderedDrums) {
                this._renderedDrums = true;
                this._renderedMod = false;
                this._svgBackground.setAttribute("fill", "url(#patternEditorDrumBackground" + this._barOffset + ")");
            }
        } else if (this._doc.song.getChannelIsMod(this._doc.channel)) {
            if (!this._renderedMod) {
                this._renderedDrums = false;
                this._renderedMod = true;
                this._svgBackground.setAttribute("fill", "url(#patternEditorModBackground" + this._barOffset + ")");
            }
        } else {
            if (this._renderedDrums || this._renderedMod) {
                this._renderedDrums = false;
                this._renderedMod = false;
                this._svgBackground.setAttribute("fill", "url(#patternEditorNoteBackground" + this._barOffset + ")");
            }
        }

        this._redrawNotePatterns();
    }

    private _redrawNotePatterns(): void {
        this._svgNoteContainer = makeEmptyReplacementElement(this._svgNoteContainer);

        if (this._doc.prefs.showChannels) {
            if (!this._doc.song.getChannelIsMod(this._doc.channel)) {
                let noteFlashColor = "#ffffff77";
                if (this._doc.prefs.notesFlashWhenPlayed) noteFlashColor = ColorConfig.getComputed("--note-flash-secondary");
                for (let channel = this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount - 1; channel >= 0; channel--) {
                    if (channel == this._doc.channel || !this._doc.song.channels[channel].visible) continue;
                    if (this._doc.song.getChannelIsNoise(channel) != this._doc.song.getChannelIsNoise(this._doc.channel)) continue;

                    const pattern2: Pattern | null = this._doc.song.getPattern(channel, this._doc.bar + this._barOffset);
                    if (pattern2 == null) continue;

                    const octaveOffset = this._doc.getBaseVisibleOctave(channel) * Config.pitchesPerOctave;
                    for (const note of pattern2.notes) {
                        for (const pitch of note.pitches) {
                            let notePath = SVG.path();
                            notePath.setAttribute("fill", ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[channel].color, channel, this._doc.prefs.fixChannelColorOrder).secondaryNote);
                            notePath.setAttribute("pointer-events", "none");
                            this._drawNote(notePath, pitch, note.start, note.pins, this._pitchHeight * 0.19, false, octaveOffset);
                            this._svgNoteContainer.appendChild(notePath);

                            if (this._doc.prefs.notesFlashWhenPlayed) {
                                notePath = SVG.path();
                                // const noteFlashColor = ColorConfig.getComputed("--note-flash-secondary") !== "" ? "var(--note-flash-secondary)" : "#ffffff77";
                                notePath.setAttribute("fill", noteFlashColor);
                                notePath.setAttribute("pointer-events", "none");
                                this._drawNote(notePath, pitch, note.start, note.pins, this._pitchHeight * 0.19, false, octaveOffset);
                                this._svgNoteContainer.appendChild(notePath);
                                notePath.classList.add('note-flash');
                                notePath.style.opacity = "0";
                                notePath.setAttribute('note-start', String(note.start));
                                notePath.setAttribute('note-end', String(
                                    note.end
                                ));
                            }
                        }
                    }
                }
            }
        }

        if (this._pattern != null) {
            const instrument = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument(this._barOffset)];
            const chord = instrument.getChord();
            const transition = instrument.getTransition();
            const displayNumberedChords = chord.customInterval || chord.arpeggiates || chord.strumParts > 0 || transition.slides || chord.name == "monophonic";
            let noteFlashColor = "#ffffff";
            if (this._doc.prefs.notesFlashWhenPlayed) noteFlashColor = ColorConfig.getComputed("--note-flash");
            for (const note of this._pattern.notes) {
                let disabled = false;
                if (this._doc.song.getChannelIsMod(this._doc.channel)) {
                    const modIndex = instrument.modulators[Config.modCount - 1 - note.pitches[0]];
                    if ((modIndex == Config.modulators.dictionary["none"].index)
                        || instrument.invalidModulators[Config.modCount - 1 - note.pitches[0]])
                        disabled = true;
                }
                for (let i = 0; i < note.pitches.length; i++) {
                    const pitch = note.pitches[i];
                    let notePath = SVG.path();
                    let colorPrimary = (disabled ? ColorConfig.disabledNotePrimary : ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[this._doc.channel].color, this._doc.channel, this._doc.prefs.fixChannelColorOrder).primaryNote);
                    let colorSecondary = (disabled ? ColorConfig.disabledNoteSecondary : ColorConfig.getChannelColor(this._doc.song, this._doc.song.channels[this._doc.channel].color, this._doc.channel, this._doc.prefs.fixChannelColorOrder).secondaryNote);
                    notePath.setAttribute("fill", colorSecondary);
                    notePath.setAttribute("pointer-events", "none");
                    this._drawNote(notePath, pitch, note.start, note.pins, (this._pitchHeight - this._pitchBorder) / 2 + 1, false, this._octaveOffset);
                    this._svgNoteContainer.appendChild(notePath);
                    notePath = SVG.path();
                    notePath.setAttribute("fill", colorPrimary);
                    notePath.setAttribute("pointer-events", "none");
                    this._drawNote(notePath, pitch, note.start, note.pins, (this._pitchHeight - this._pitchBorder) / 2 + 1, true, this._octaveOffset);
                    this._svgNoteContainer.appendChild(notePath);

                    if (this._doc.prefs.notesFlashWhenPlayed && !disabled) {
                        notePath = SVG.path();
                        // const noteFlashColor = ColorConfig.getComputed("--note-flash") !== "" ? "var(--note-flash)" : "#ffffff";
                        notePath.setAttribute("fill", noteFlashColor);
                        notePath.setAttribute("pointer-events", "none");
                        this._drawNote(notePath, pitch, note.start, note.pins, (this._pitchHeight - this._pitchBorder) / 2 + 1, true, this._octaveOffset);
                        this._svgNoteContainer.appendChild(notePath);
                        notePath.classList.add('note-flash');
                        notePath.style.opacity = "0";
                        notePath.setAttribute('note-start', String(note.start));
                        notePath.setAttribute('note-end', String(
                            note.end
                        ));
                    }

                    let indicatorOffset = 2;
                    if (note.continuesLastPattern) {
                        const arrowHeight = Math.min(this._pitchHeight, 20);
                        let arrowPath: string;
                        arrowPath = "M " + prettyNumber(this._partWidth * note.start + indicatorOffset) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) - 0.1 * arrowHeight);
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) + 0.1 * arrowHeight);
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset + 4) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) + 0.1 * arrowHeight);
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset + 4) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) + 0.3 * arrowHeight);
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset + 12) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset));
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset + 4) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) - 0.3 * arrowHeight);
                        arrowPath += "L " + prettyNumber(this._partWidth * note.start + indicatorOffset + 4) + " " + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset) - 0.1 * arrowHeight);
                        const arrow = SVG.path();
                        arrow.setAttribute("d", arrowPath);
                        arrow.setAttribute("fill", ColorConfig.invertedText);
                        this._svgNoteContainer.appendChild(arrow);
                        indicatorOffset += 12;
                    }

                    if (note.pitches.length > 1) {
                        if (displayNumberedChords) {
                            const oscillatorLabel = SVG.text();
                            oscillatorLabel.setAttribute("x", "" + prettyNumber(this._partWidth * note.start + indicatorOffset));
                            oscillatorLabel.setAttribute("y", "" + prettyNumber(this._pitchToPixelHeight(pitch - this._octaveOffset)));
                            oscillatorLabel.setAttribute("width", "30");
                            oscillatorLabel.setAttribute("fill", ColorConfig.invertedText);
                            oscillatorLabel.setAttribute("text-anchor", "start");
                            oscillatorLabel.setAttribute("dominant-baseline", "central");
                            oscillatorLabel.setAttribute("pointer-events", "none");
                            oscillatorLabel.textContent = "" + (i + 1);
                            this._svgNoteContainer.appendChild(oscillatorLabel);
                        }
                    }
                }


                if (this._doc.song.getChannelIsMod(this._doc.channel) && this._mouseDragging && !this._mouseHorizontal && note == this._cursor.curNote) {

                    this.modDragValueLabel.style.setProperty("display", "");
                    this.modDragValueLabel.style.setProperty("pointer-events", "none");
                    this.modDragValueLabel.setAttribute("contenteditable", "false");
                    this.modDragValueLabel.style.setProperty("color", "#FFFFFF");
                    let setting = this._doc.song.channels[this._doc.channel].instruments[this._doc.getCurrentInstrument(this._barOffset)].modulators[Config.modCount - 1 - note.pitches[0]];
                    let presValue = this._dragSize + Config.modulators[setting].convertRealFactor;

                    // This is me being too lazy to fiddle with the css to get it to align center.
                    let xOffset = (+(presValue >= 10.0)) + (+(presValue >= 100.0)) + (+(presValue < 0.0)) + (+(presValue <= -10.0));

                    this._modDragValueLabelWidth = 8 + xOffset * 8;
                    this._modDragValueLabelLeft = +prettyNumber(Math.max(Math.min(this._editorWidth - 10 - xOffset * 8, this._partWidth * this._dragTime - 4 - xOffset * 4), 2));
                    this._modDragValueLabelTop = +prettyNumber(this._pitchToPixelHeight(note.pitches[0] - this._octaveOffset) - 17 - (this._pitchHeight - this._pitchBorder) / 2);

                    this.modDragValueLabel.style.setProperty("left", "" + this._modDragValueLabelLeft + "px");
                    this.modDragValueLabel.style.setProperty("top", "" + this._modDragValueLabelTop + "px");
                    this.modDragValueLabel.textContent = "" + presValue;

                }
            }
        }

        this._doc.currentPatternIsDirty = false;
    }

    private _drawNote(svgElement: SVGPathElement, pitch: number, start: number, pins: NotePin[], radius: number, showSize: boolean, offset: number): void {
        const totalWidth = this._partWidth * (pins[pins.length - 1].time + pins[0].time);
        const endOffset = 0.5 * Math.min(2, totalWidth - 1);

        let nextPin = pins[0];

        const cap = this._doc.song.getVolumeCap(this._doc.song.getChannelIsMod(this._doc.channel), this._doc.channel, this._doc.getCurrentInstrument(this._barOffset), pitch);

        let pathString = "M " + prettyNumber(this._partWidth * (start + nextPin.time) + endOffset) + " " + prettyNumber(this._pitchToPixelHeight(pitch - offset) + radius * (showSize ? nextPin.size / cap : 1.0)) + " ";

        for (let i = 1; i < pins.length; i++) {
            let prevPin = nextPin;
            nextPin = pins[i];
            let prevSide = this._partWidth * (start + prevPin.time) + (i == 1 ? endOffset : 0);
            let nextSide = this._partWidth * (start + nextPin.time) - (i == pins.length - 1 ? endOffset : 0);
            let prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
            let nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
            let prevSize = showSize ? prevPin.size / cap : 1.0;
            let nextSize = showSize ? nextPin.size / cap : 1.0;
            pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight - radius * prevSize) + " ";
            if (prevPin.interval > nextPin.interval) pathString += "L " + prettyNumber(prevSide + 1) + " " + prettyNumber(prevHeight - radius * prevSize) + " ";
            if (prevPin.interval < nextPin.interval) pathString += "L " + prettyNumber(nextSide - 1) + " " + prettyNumber(nextHeight - radius * nextSize) + " ";
            pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight - radius * nextSize) + " ";
        }
        for (let i = pins.length - 2; i >= 0; i--) {
            let prevPin = nextPin;
            nextPin = pins[i];
            let prevSide = this._partWidth * (start + prevPin.time) - (i == pins.length - 2 ? endOffset : 0);
            let nextSide = this._partWidth * (start + nextPin.time) + (i == 0 ? endOffset : 0);
            let prevHeight = this._pitchToPixelHeight(pitch + prevPin.interval - offset);
            let nextHeight = this._pitchToPixelHeight(pitch + nextPin.interval - offset);
            let prevSize = showSize ? prevPin.size / cap : 1.0;
            let nextSize = showSize ? nextPin.size / cap : 1.0;
            pathString += "L " + prettyNumber(prevSide) + " " + prettyNumber(prevHeight + radius * prevSize) + " ";
            if (prevPin.interval < nextPin.interval) pathString += "L " + prettyNumber(prevSide - 1) + " " + prettyNumber(prevHeight + radius * prevSize) + " ";
            if (prevPin.interval > nextPin.interval) pathString += "L " + prettyNumber(nextSide + 1) + " " + prettyNumber(nextHeight + radius * nextSize) + " ";
            pathString += "L " + prettyNumber(nextSide) + " " + prettyNumber(nextHeight + radius * nextSize) + " ";
        }
        pathString += "z";

        svgElement.setAttribute("d", pathString);
    }

    private _pitchToPixelHeight(pitch: number): number {
        return this._pitchHeight * (this._pitchCount - (pitch) - 0.5);
    }
}
