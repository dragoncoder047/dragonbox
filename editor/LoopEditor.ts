// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML, SVG } from "imperative-html/dist/esm/elements-strict";
import { ChangeChannelBar, ChangeLoop } from "./changes";
import { ColorConfig } from "./ColorConfig";
import { SongDocument } from "./SongDocument";
import { TrackEditor } from "./TrackEditor";

interface Cursor {
    startBar: number;
    mode: number;
}

interface Endpoints {
    start: number;
    length: number;
}

export class LoopEditor {
    private readonly _editorHeight = 20;
    private readonly _startMode = 0;
    private readonly _endMode = 1;
    private readonly _bothMode = 2;
    private readonly _loopMode = 3;
    private _loopAtPointStart = -1;
    private _loopAtPointEnd = -1;

    private readonly _loop = SVG.path({ fill: "none", stroke: ColorConfig.loopAccent, "stroke-width": 4 });
    private readonly _barLoop = SVG.path({ fill: "none", stroke: ColorConfig.uiWidgetFocus, "stroke-width": 2 });
    private readonly _highlight = SVG.path({ fill: ColorConfig.hoverPreview, "pointer-events": "none" });

    private readonly _svg = SVG.svg({ style: `touch-action: pan-y; position: absolute;`, height: this._editorHeight },
        this._loop,
        this._highlight,
        this._barLoop
    );

    readonly container = HTML.div({ class: "loopEditor" }, this._svg);

    private _barWidth = 32;
    private _change: ChangeLoop | null = null;
    private _cursor: Cursor = { startBar: -1, mode: -1 };
    private _mouseX = 0;
    //private _mouseY = 0;
    private _clientStartX = 0;
    private _clientStartY = 0;
    private _startedScrolling = false;
    private _draggingHorizontally = false;
    private _mouseDown = false;
    private _mouseOver = false;
    private _renderedLoopStart = -1;
    private _renderedLoopStop = -1;
    private _renderedBarCount = 0;
    private _renderedBarWidth = -1;
    private _renderedBarLoopStart = -1;
    private _renderedBarLoopEnd = -1;

    constructor(private _doc: SongDocument, private _trackEditor: TrackEditor) {
        this._updateCursorStatus();
        this._render();
        this._doc.notifier.watch(this._documentChanged);

        this.container.addEventListener("mousedown", this._whenMousePressed);
        document.addEventListener("mousemove", this._whenMouseMoved);
        document.addEventListener("mouseup", this._whenCursorReleased);
        this.container.addEventListener("mouseover", this._whenMouseOver);
        this.container.addEventListener("mouseout", this._whenMouseOut);

        this.container.addEventListener("touchstart", this._whenTouchPressed);
        this.container.addEventListener("touchmove", this._whenTouchMoved);
        this.container.addEventListener("touchend", this._whenTouchReleased);
        this.container.addEventListener("touchcancel", this._whenTouchReleased);
    }

    private _updateCursorStatus(): void {
        const bar = this._mouseX / this._barWidth;
        this._cursor.startBar = bar;

        if (bar >= this._loopAtPointStart && bar <= this._loopAtPointEnd + 1) {
            this._cursor.mode = this._loopMode;
        }
        else if (bar > this._doc.song.loopStart - 0.25 && bar < this._doc.song.loopStart + this._doc.song.loopLength + 0.25) {
            if (bar - this._doc.song.loopStart < this._doc.song.loopLength * 0.5) {
                this._cursor.mode = this._startMode;
            } else {
                this._cursor.mode = this._endMode;
            }
        } else {
            this._cursor.mode = this._bothMode;
        }
    }

    private _findEndPoints(middle: number): Endpoints {
        let start = Math.round(middle - this._doc.song.loopLength / 2);
        let end = start + this._doc.song.loopLength;
        if (start < 0) {
            end -= start;
            start = 0;
        }
        if (end > this._doc.song.barCount) {
            start -= end - this._doc.song.barCount;
            end = this._doc.song.barCount;
        }
        return { start: start, length: end - start };
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
        this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
        //this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
        this._updateCursorStatus();
        this._updatePreview();
        this._whenMouseMoved(event);
    }

    private _whenTouchPressed = (event: TouchEvent): void => {
        //event.preventDefault();
        this._mouseDown = true;
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = event.touches[0].clientX - boundingRect.left;
        //this._mouseY = event.touches[0].clientY - boundingRect.top;
        this._updateCursorStatus();
        this._updatePreview();
        //this._whenTouchMoved(event);
        this._clientStartX = event.touches[0].clientX;
        this._clientStartY = event.touches[0].clientY;
        this._draggingHorizontally = false;
        this._startedScrolling = false;
    }

    private _whenMouseMoved = (event: MouseEvent): void => {
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = (event.clientX || event.pageX) - boundingRect.left;
        //this._mouseY = (event.clientY || event.pageY) - boundingRect.top;
        this._whenCursorMoved();
    }

    private _whenTouchMoved = (event: TouchEvent): void => {
        if (!this._mouseDown) return;
        const boundingRect = this._svg.getBoundingClientRect();
        this._mouseX = event.touches[0].clientX - boundingRect.left;
        //this._mouseY = event.touches[0].clientY - boundingRect.top;

        if (!this._draggingHorizontally && !this._startedScrolling) {
            if (Math.abs(event.touches[0].clientY - this._clientStartY) > 10) {
                this._startedScrolling = true;
            } else if (Math.abs(event.touches[0].clientX - this._clientStartX) > 10) {
                this._draggingHorizontally = true;
            }
        }

        if (this._draggingHorizontally) {
            this._whenCursorMoved();
            event.preventDefault();
        }
    }

    private _whenCursorMoved(): void {
        if (this._mouseDown) {
            let oldStart = this._doc.song.loopStart;
            let oldEnd = this._doc.song.loopStart + this._doc.song.loopLength;
            if (this._change != null && this._doc.lastChangeWas(this._change)) {
                oldStart = this._change.oldStart;
                oldEnd = oldStart + this._change.oldLength;
            }

            const bar = this._mouseX / this._barWidth;
            let start: number;
            let end: number;
            let temp: number;
            if (this._cursor.mode == this._startMode) {
                start = oldStart + Math.round(bar - this._cursor.startBar);
                end = oldEnd;
                if (start < 0) start = 0;
                if (start >= this._doc.song.barCount) start = this._doc.song.barCount;
                if (start == end) {
                    start = end - 1;
                } else if (start > end) {
                    temp = start;
                    start = end;
                    end = temp;
                }
                this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
            } else if (this._cursor.mode == this._endMode) {
                start = oldStart;
                end = oldEnd + Math.round(bar - this._cursor.startBar);
                if (end < 0) end = 0;
                if (end >= this._doc.song.barCount) end = this._doc.song.barCount;
                if (end == start) {
                    end = start + 1;
                } else if (end < start) {
                    temp = start;
                    start = end;
                    end = temp;
                }
                this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, start, end - start);
            } else if (this._cursor.mode == this._bothMode) {
                const endPoints = this._findEndPoints(bar);
                this._change = new ChangeLoop(this._doc, oldStart, oldEnd - oldStart, endPoints.start, endPoints.length);
            }
            else if (this._cursor.mode == this._loopMode) {
                this._doc.synth.loopBarStart = -1;
                this._doc.synth.loopBarEnd = -1;
                this.setLoopAt(this._doc.synth.loopBarStart, this._doc.synth.loopBarEnd);
            }
            this._doc.synth.jumpIntoLoop();
            if (this._doc.prefs.autoFollow) {
                new ChangeChannelBar(this._doc, this._doc.channel, Math.floor(this._doc.synth.playhead), true);
            }
            this._doc.setProspectiveChange(this._change);
        } else {
            this._updateCursorStatus();
            this._updatePreview();
        }
    }

    private _whenTouchReleased = (event: TouchEvent): void => {
        event.preventDefault();
        if (!this._startedScrolling) {
            this._whenCursorMoved();
            this._mouseOver = false;
            this._whenCursorReleased(event);
            this._updatePreview();
        }

        this._mouseDown = false;
    }

    private _whenCursorReleased = (event: Event): void => {
        if (this._change != null) this._doc.record(this._change);
        this._change = null;
        this._mouseDown = false;
        this._updateCursorStatus();
        this._render();
    }

    private _updatePreview(): void {
        const showHighlight = this._mouseOver && !this._mouseDown;
        this._highlight.style.visibility = showHighlight ? "visible" : "hidden";

        if (showHighlight) {
            const radius = this._editorHeight / 2;

            let highlightStart = (this._doc.song.loopStart) * this._barWidth;
            let highlightStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;
            if (this._cursor.mode == this._startMode) {
                highlightStop = (this._doc.song.loopStart) * this._barWidth + radius * 2;
            } else if (this._cursor.mode == this._endMode) {
                highlightStart = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth - radius * 2;
            } else if (this._cursor.mode == this._bothMode) {
                const endPoints = this._findEndPoints(this._cursor.startBar);
                highlightStart = (endPoints.start) * this._barWidth;
                highlightStop = (endPoints.start + endPoints.length) * this._barWidth;
            }

            if (this._cursor.mode == this._loopMode) {
                const barLoopStart = (this._loopAtPointStart + 0.5) * this._barWidth;
                const barLoopEnd = (this._loopAtPointEnd + 0.5) * this._barWidth;
                this._highlight.setAttribute("d",
                    `M ${barLoopStart} ${radius * 1.7} ` +
                    `L ${barLoopStart - radius * 1.5} ${radius}` +
                    `L ${barLoopStart} ${radius * 0.3}` +
                    `L ${barLoopEnd} ${radius * 0.3}` +
                    `L ${barLoopEnd + radius * 1.5} ${radius}` +
                    `L ${barLoopEnd} ${radius * 1.7}` +
                    `z`
                );
            }
            else {

                this._highlight.setAttribute("d",
                    `M ${highlightStart + radius} ${4} ` +
                    `L ${highlightStop - radius} ${4} ` +
                    `A ${radius - 4} ${radius - 4} ${0} ${0} ${1} ${highlightStop - radius} ${this._editorHeight - 4} ` +
                    `L ${highlightStart + radius} ${this._editorHeight - 4} ` +
                    `A ${radius - 4} ${radius - 4} ${0} ${0} ${1} ${highlightStart + radius} ${4} ` +
                    `z`
                );

            }
        }
    }

    private _documentChanged = (): void => {
        this._render();
    }

    setLoopAt(startBar: number, endBar: number): void {
        this._loopAtPointStart = startBar;
        this._loopAtPointEnd = endBar;
        this._trackEditor.render();
        this._render();
    }

    private _render(): void {
        this._barWidth = this._doc.getBarWidth();

        const radius = this._editorHeight / 2;
        const loopStart = (this._doc.song.loopStart) * this._barWidth;
        const loopStop = (this._doc.song.loopStart + this._doc.song.loopLength) * this._barWidth;

        if (this._renderedBarCount != this._doc.song.barCount || this._renderedBarWidth != this._barWidth) {
            this._renderedBarCount = this._doc.song.barCount;
            this._renderedBarWidth = this._barWidth;
            const editorWidth = this._barWidth * this._doc.song.barCount;
            this.container.style.width = editorWidth + "px";
            this._svg.setAttribute("width", editorWidth + "");
        }

        if (this._renderedLoopStart != loopStart || this._renderedLoopStop != loopStop) {
            this._renderedLoopStart = loopStart;
            this._renderedLoopStop = loopStop;
            this._loop.setAttribute("d",
                `M ${loopStart + radius} ${2} ` +
                `L ${loopStop - radius} ${2} ` +
                `A ${radius - 2} ${radius - 2} ${0} ${0} ${1} ${loopStop - radius} ${this._editorHeight - 2} ` +
                `L ${loopStart + radius} ${this._editorHeight - 2} ` +
                `A ${radius - 2} ${radius - 2} ${0} ${0} ${1} ${loopStart + radius} ${2} ` +
                `z`
            );
        }

        const barLoopStart = (this._loopAtPointStart + 0.5) * this._barWidth;
        const barLoopEnd = (this._loopAtPointEnd + 0.5) * this._barWidth;
        if (this._renderedBarLoopStart != barLoopStart || this._renderedBarLoopEnd != barLoopEnd) {
            if (barLoopStart < 0 || barLoopEnd < 0) {
                this._barLoop.setAttribute("d", "");
            }
            else {
                this._barLoop.setAttribute("d",
                    `M ${barLoopStart} ${radius * 1.5} ` +
                    `L ${barLoopStart - radius} ${radius}` +
                    `L ${barLoopStart} ${radius * 0.5}` +
                    `L ${barLoopEnd} ${radius * 0.5}` +
                    `L ${barLoopEnd + radius} ${radius}` +
                    `L ${barLoopEnd} ${radius * 1.5}` +
                    `z`
                );
            }
            this._renderedBarLoopStart = barLoopStart;
            this._renderedBarLoopEnd = barLoopEnd;
        }

        this._updatePreview();
    }
}