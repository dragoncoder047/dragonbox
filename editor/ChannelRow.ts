// Copyright (C) 2021 John Nesky, distributed under the MIT license.

import { HTML } from "imperative-html/dist/esm/elements-strict";
import { Pattern } from "../synth/Pattern";
import { ColorConfig } from "./ColorConfig";
import { SongDocument } from "./SongDocument";

export class Box {
    private readonly _text = document.createTextNode("");
    private readonly _label = HTML.div({ class: "channelBoxLabel" }, this._text);
    readonly container = HTML.div({ class: "channelBox", style: `margin: 1px; height: ${ChannelRow.patternHeight - 2}px;` }, this._label);
    private _renderedIndex = -1;
    private _renderedLabelColor = "?";
    private _renderedVisibility = "?";
    private _renderedBorderLeft = "?";
    private _renderedBorderRight = "?";
    private _renderedBackgroundColor = "?";
    constructor(channel: number, color: string) {
        this.container.style.background = ColorConfig.uiWidgetBackground;
        this._label.style.color = color;
    }

    setWidth(width: number): void {
        this.container.style.width = (width - 2) + "px"; // there's a 1 pixel margin on either side.
    }

    setHeight(height: number): void {
        this.container.style.height = (height - 2) + "px"; // there's a 1 pixel margin on either side.
    }

    setIndex(index: number, selected: boolean, dim: boolean, color: string, isNoise: boolean, isMod: boolean): void {
        if (this._renderedIndex != index) {
            if (index >= 100) {
                this._label.setAttribute("font-size", "16");
                this._label.style.setProperty("transform", "translate(0px, -1.5px)");
            }
            else {
                this._label.setAttribute("font-size", "20");
                this._label.style.setProperty("transform", "translate(0px, 0px)");
            }

            this._renderedIndex = index;
            this._text.data = String(index);
        }
        let useColor = selected ? ColorConfig.c_invertedText : color;
        if (this._renderedLabelColor != useColor) {
            this._label.style.color = useColor;
            this._renderedLabelColor = useColor;
        }
        if (!selected) {
            if (isNoise)
                color = dim ? ColorConfig.c_trackEditorBgNoiseDim : ColorConfig.c_trackEditorBgNoise;
            else if (isMod)
                color = dim ? ColorConfig.c_trackEditorBgModDim : ColorConfig.c_trackEditorBgMod;
            else
                color = dim ? ColorConfig.c_trackEditorBgPitchDim : ColorConfig.c_trackEditorBgPitch;
        }
        color = selected ? color : (index == 0) ? "none" : color;
        if (this._renderedBackgroundColor != color) {
            this.container.style.background = color;
            this._renderedBackgroundColor = color;
        }
    }
    // These cache the value given to them, since they're apparently quite
    // expensive to set.
    setVisibility(visibility: string): void {
        if (this._renderedVisibility != visibility) {
            this.container.style.visibility = visibility;
            this._renderedVisibility = visibility;
        }
    }
    setBorderLeft(borderLeft: string): void {
        if (this._renderedBorderLeft != borderLeft) {
            this.container.style.setProperty("border-left", borderLeft);
            this._renderedBorderLeft = borderLeft;
        }
    }
    setBorderRight(borderRight: string): void {
        if (this._renderedBorderRight != borderRight) {
            this.container.style.setProperty("border-right", borderRight);
            this._renderedBorderRight = borderRight;
        }
    }
}

export class ChannelRow {
    static patternHeight = 28;

    private _renderedBarWidth = -1;
    private _renderedBarHeight = -1;
    private _boxes: Box[] = [];

    readonly container = HTML.div({ class: "channelRow" });

    constructor(private readonly _doc: SongDocument, public readonly index: number, public readonly color: number) { }

    render(): void {
        ChannelRow.patternHeight = this._doc.getChannelHeight();

        const barWidth = this._doc.getBarWidth();
        if (this._boxes.length != this._doc.song.barCount) {
            for (let x = this._boxes.length; x < this._doc.song.barCount; x++) {
                const box = new Box(this.index, ColorConfig.getChannelColor(this._doc.song, this.color, this.index, this._doc.prefs.fixChannelColorOrder).secondaryChannel);
                box.setWidth(barWidth);
                this.container.appendChild(box.container);
                this._boxes[x] = box;
            }
            for (let x = this._doc.song.barCount; x < this._boxes.length; x++) {
                this.container.removeChild(this._boxes[x].container);
            }
            this._boxes.length = this._doc.song.barCount;
        }

        if (this._renderedBarWidth != barWidth) {
            this._renderedBarWidth = barWidth;
            for (let x = 0; x < this._boxes.length; x++) {
                this._boxes[x].setWidth(barWidth);
            }
        }

        if (this._renderedBarHeight != ChannelRow.patternHeight) {
            this._renderedBarHeight = ChannelRow.patternHeight;
            for (let x = 0; x < this._boxes.length; x++) {
                this._boxes[x].setHeight(ChannelRow.patternHeight);
            }
        }

        for (let i = 0; i < this._boxes.length; i++) {
            const pattern: Pattern | null = this._doc.song.getPattern(this.index, i);
            const selected = (i == this._doc.bar && this.index == this._doc.channel);
            const dim = (pattern == null || pattern.notes.length == 0);

            const box = this._boxes[i];
            if (i < this._doc.song.barCount) {
                const colors = ColorConfig.getChannelColor(this._doc.song, this.color, this.index, this._doc.prefs.fixChannelColorOrder);
                box.setIndex(this._doc.song.channels[this.index].bars[i], selected, dim, dim && !selected ? colors.secondaryChannel : colors.primaryChannel,
                    this.index >= this._doc.song.pitchChannelCount && this.index < this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount, this.index >= this._doc.song.pitchChannelCount + this._doc.song.noiseChannelCount);
                box.setVisibility("visible");
            } else {
                box.setVisibility("hidden");
            }
            if (i == this._doc.synth.loopBarStart) {
                box.setBorderLeft(`1px dashed ${ColorConfig.uiWidgetFocus}`);
            }
            else {
                box.setBorderLeft("none");
            }
            if (i == this._doc.synth.loopBarEnd) {
                box.setBorderRight(`1px dashed ${ColorConfig.uiWidgetFocus}`);
            }
            else {
                box.setBorderRight("none");
            }
        }
    }
}
