// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Config } from "../synth/SynthConfig";
import { SongDocument } from "./SongDocument";
import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ChangeOctave } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { Piano } from "./Piano";

export class OctaveScrollBar {
    private readonly _editorWidth = 20;
    private readonly _editorHeight = 481;
    private readonly _notchHeight = 4.0;
    private readonly _octaveCount = Config.pitchOctaves;
    private readonly _octaveHeight = (this._editorHeight - this._notchHeight) / this._octaveCount;

    private readonly _handle = SVG.rect({ fill: ColorConfig.uiWidgetBackground, x: 2, y: 0, width: this._editorWidth - 4 });
    private readonly _handleHighlight = SVG.rect({ fill: "none", stroke: ColorConfig.hoverPreview, "stroke-width": 2, "pointer-events": "none", x: 1, y: 0, width: this._editorWidth - 2 });
    private readonly _upHighlight = SVG.path({ fill: ColorConfig.hoverPreview, "pointer-events": "none" });
    private readonly _downHighlight = SVG.path({ fill: ColorConfig.hoverPreview, "pointer-events": "none" });

    private readonly _svg = SVG.svg({ style: "background-color: ${ColorConfig.editorBackground}; touch-action: pan-x; position: absolute;", width: this._editorWidth, height: "100%", viewBox: "0 0 20 " + this._editorHeight, preserveAspectRatio: "none" });
    readonly container = HTML.div({ id: "octaveScrollBarContainer", style: "width: 20px; height: 100%; overflow: hidden; position: relative; flex-shrink: 0;" }, this._svg);

    //private _mouseX = 0;
    private _mouseY = 0;
    private _mouseDown = false;
    private _mouseOver = false;
    private _dragging = false;
    private _dragStart: number;
    private _barBottom: number;
    private _barHeight: number;
    private _renderedBarBottom = -1;
    private _renderedVisibleOctaveCount = -1;
    private _change: ChangeOctave | null = null;

    constructor(private _doc: SongDocument, private _piano: Piano) {
        this._doc.notifier.watch(this._documentChanged);
        this._documentChanged();

        this._svg.appendChild(this._handle);

        // notches:
        for (let i = 0; i <= this._octaveCount; i++) {
            this._svg.appendChild(SVG.rect({ fill: ColorConfig.tonic, x: 0, y: i * this._octaveHeight, width: this._editorWidth, height: this._notchHeight }));
        }

        this._svg.appendChild(this._handleHighlight);
        this._svg.appendChild(this._upHighlight);
        this._svg.appendChild(this._downHighlight);

        const center = this._editorWidth * 0.5;
        const base = 20;
        const tip = 9;
        const arrowWidth = 6;
        this._upHighlight.setAttribute("d", `M ${center} ${tip} L ${center + arrowWidth} ${base} L ${center - arrowWidth} ${base} z`);
        this._downHighlight.setAttribute("d", `M ${center} ${this._editorHeight - tip} L ${center + arrowWidth} ${this._editorHeight - base} L ${center - arrowWidth} ${this._editorHeight - base} z`);

        this.container.addEventListener("mousedown", this._whenMousePressed);
        document.addEventListener("mousemove", this._whenMouseMoved);
        document.addEventListener("mouseup", this._whenCursorReleased);
        this.container.addEventListener("mouseover", this._whenMouseOver);
        this.container.addEventListener("mouseout", this._whenMouseOut);

        this.container.addEventListener("touchstart", this._whenTouchPressed);
        this.container.addEventListener("touchmove", this._whenTouchMoved);
        this.container.addEventListener("touchend", this._whenCursorReleased);
        this.container.addEventListener("touchcancel", this._whenCursorReleased);
    }

    private _whenMouseOver = (event: MouseEvent): void => {
        if (this._mouseOver) return;
        this._mouseOver = true;
        this._updatePreview();
    }

    private _whenMouseOut = (event: MouseEvent): void => {
        if (!this._mouseOver) return;
        this._mouseOver = false;
        this._updatePreview();
    }

    private _whenMousePressed = (event: MouseEvent): void => {
        event.preventDefault();
        this._mouseDown = true;
        const boundingRect = this._svg.getBoundingClientRect();
        //this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseY)) this._mouseY = 0;
        if (this._doc.song.getChannelIsNoise(this._doc.channel) || this._doc.song.getChannelIsMod(this._doc.channel)) return;
        this._updatePreview();

        if (this._mouseY >= this._barBottom - this._barHeight && this._mouseY <= this._barBottom) {
            this._dragging = true;
            this._change = null;
            this._dragStart = this._mouseY;
        }
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        event.preventDefault();
        this._mouseDown = true;
        const boundingRect = this._svg.getBoundingClientRect();
        //this._mouseX = event.touches[0].clientX - boundingRect.left;
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseY)) this._mouseY = 0;
        if (this._doc.song.getChannelIsNoise(this._doc.channel) || this._doc.song.getChannelIsMod(this._doc.channel)) return;
        this._updatePreview();

        if (this._mouseY >= this._barBottom - this._barHeight && this._mouseY <= this._barBottom) {
            this._dragging = true;
            this._change = null;
            this._dragStart = this._mouseY;
        }
    }

    private _whenMouseMoved = (event: MouseEvent): void => {
        const boundingRect = this._svg.getBoundingClientRect();
        //this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
        this._mouseY = ((event.clientY || event.pageY) - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorMoved();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (!this._mouseDown) return;
        event.preventDefault();
        const boundingRect = this._svg.getBoundingClientRect();
        //this._mouseX = event.touches[0].clientX - boundingRect.left;
        this._mouseY = (event.touches[0].clientY - boundingRect.top) * this._editorHeight / (boundingRect.bottom - boundingRect.top);
        if (isNaN(this._mouseY)) this._mouseY = 0;
        this._whenCursorMoved();
    }

    private _whenCursorMoved(): void {
        if (this._doc.song.getChannelIsNoise(this._doc.channel) || this._doc.song.getChannelIsMod(this._doc.channel)) return;
        if (this._dragging) {
            const visibleOctaveCount = this._doc.getVisibleOctaveCount();
            const scrollableOctaves = Config.pitchOctaves - visibleOctaveCount;
            const continuingProspectiveChange = this._doc.lastChangeWas(this._change);
            const oldValue = continuingProspectiveChange ? this._change!.oldValue : this._doc.song.channels[this._doc.channel].octave;

            const currentOctave = this._doc.getBaseVisibleOctave(this._doc.channel);
            let octave = currentOctave;
            while (this._mouseY - this._dragStart < -this._octaveHeight * 0.5) {
                if (octave < scrollableOctaves) {
                    octave++;
                    this._dragStart -= this._octaveHeight;
                } else {
                    break;
                }
            }
            while (this._mouseY - this._dragStart > this._octaveHeight * 0.5) {
                if (octave > 0) {
                    octave--;
                    this._dragStart += this._octaveHeight;
                } else {
                    break;
                }
            }

            this._change = new ChangeOctave(this._doc, oldValue, Math.floor(octave + visibleOctaveCount * 0.5));
            this._doc.setProspectiveChange(this._change);
        }

        if (this._mouseOver) this._updatePreview();
    }

    private _whenCursorReleased = (event: Event): void => {
        if (!this._doc.song.getChannelIsNoise(this._doc.channel) && !this._doc.song.getChannelIsMod(this._doc.channel) && this._mouseDown) {
            if (this._dragging) {
                if (this._change != null) this._doc.record(this._change);
            } else {
                const visibleOctaveCount = this._doc.getVisibleOctaveCount();
                const scrollableOctaves = Config.pitchOctaves - visibleOctaveCount;
                const canReplaceLastChange = this._doc.lastChangeWas(this._change);
                const oldValue = canReplaceLastChange ? this._change!.oldValue : this._doc.song.channels[this._doc.channel].octave;

                const currentOctave = this._doc.getBaseVisibleOctave(this._doc.channel);
                if (this._mouseY < this._barBottom - this._barHeight * 0.5) {
                    if (currentOctave < scrollableOctaves) {
                        this._change = new ChangeOctave(this._doc, oldValue, Math.floor(currentOctave + 1 + visibleOctaveCount * 0.5));
                        this._doc.record(this._change, canReplaceLastChange);
                    }
                } else {
                    if (currentOctave > 0) {
                        this._change = new ChangeOctave(this._doc, oldValue, Math.floor(currentOctave - 1 + visibleOctaveCount * 0.5));
                        this._doc.record(this._change, canReplaceLastChange);
                    }
                }
            }
        }
        this._mouseDown = false;
        this._dragging = false;
        this._updatePreview();
    }

    private _updatePreview(): void {
        const showHighlight = this._mouseOver && !this._mouseDown;
        let showUpHighlight = false;
        let showDownHighlight = false;
        let showHandleHighlight = false;

        if (showHighlight) {
            if (this._mouseY < this._barBottom - this._barHeight) {
                showUpHighlight = true;
            } else if (this._mouseY > this._barBottom) {
                showDownHighlight = true;
            } else {
                showHandleHighlight = true;
            }
        }

        this._upHighlight.style.visibility = showUpHighlight ? "inherit" : "hidden";
        this._downHighlight.style.visibility = showDownHighlight ? "inherit" : "hidden";
        this._handleHighlight.style.visibility = showHandleHighlight ? "inherit" : "hidden";
    }

    private _documentChanged = (): void => {
        this._barBottom = this._editorHeight - (this._octaveHeight * this._doc.getBaseVisibleOctave(this._doc.channel));
        this._svg.style.visibility = (this._doc.song.getChannelIsNoise(this._doc.channel) || this._doc.song.getChannelIsMod(this._doc.channel)) ? "hidden" : "visible";
        const visibleOctaveCount = this._doc.getVisibleOctaveCount();
        if (this._renderedBarBottom != this._barBottom || this._renderedVisibleOctaveCount != visibleOctaveCount) {
            this._renderedBarBottom = this._barBottom;
            this._renderedVisibleOctaveCount = visibleOctaveCount;
            this._barHeight = (this._octaveHeight * visibleOctaveCount + this._notchHeight);
            this._handle.setAttribute("height", String(this._barHeight));
            this._handleHighlight.setAttribute("height", String(this._barHeight));
            this._handle.setAttribute("y", String(this._barBottom - this._barHeight));
            this._handleHighlight.setAttribute("y", String(this._barBottom - this._barHeight));

            this._piano.forceRender();
        }
        this._updatePreview();
    }
}