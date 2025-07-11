// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { HTML } from "imperative-html/dist/esm/elements-strict";
import { Config } from "../synth/SynthConfig";
import { ChangeBeatsPerBar } from "./changes";
import { ExportPrompt } from "./ExportPrompt";
import { nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";
import { Prompt } from "./Prompt";
import { SongDocument } from "./SongDocument";

const { button, div, span, h2, input, br, select, option } = HTML;

export class BeatsPerBarPrompt implements Prompt {
    private readonly _computedSamplesLabel = div({ style: "width: 10em;" }, new Text("0:00"));
    private readonly _beatsStepper = input({ style: "width: 3em; margin-left: 1em;", type: "number", step: "1" });
    private readonly _conversionStrategySelect = select({ style: "width: 100%;" },
        option({ value: "splice" }, "Splice beats at end of bars."),
        option({ value: "stretch" }, "Stretch notes to fit in bars."),
        option({ value: "overflow" }, "Overflow notes across bars."),
    );
    private readonly _cancelButton = button({ class: "cancelButton" });
    private readonly _okayButton = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    readonly container = div({ class: "prompt noSelection", style: "width: 250px;" },
        h2("Beats Per Bar"),
        div({ style: "display: flex; flex-direction: row; align-items: center; justify-content: space-between;" },
            "Length:",
            this._computedSamplesLabel,
        ),
        div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" },
            div({ style: "text-align: right;" },
                "Beats per bar:",
                br(),
                span({ style: "font-size: smaller; color: ${ColorConfig.secondaryText};" }, "(Multiples of 3 or 4 are recommended)"),
            ),
            this._beatsStepper,
        ),
        div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" },
            div({ class: "selectContainer", style: "width: 100%;" }, this._conversionStrategySelect),
        ),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        this._cancelButton,
    );

    constructor(private _doc: SongDocument) {
        this._beatsStepper.value = this._doc.song.beatsPerBar + "";
        this._beatsStepper.min = Config.beatsPerBarMin + "";
        this._beatsStepper.max = Config.beatsPerBarMax + "";

        const lastStrategy: string | null = nsLocalStorage_get("beatCountStrategy");
        if (lastStrategy != null) {
            this._conversionStrategySelect.value = lastStrategy;
        }

        this._beatsStepper.select();
        setTimeout(() => this._beatsStepper.focus());

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this._beatsStepper.addEventListener("keypress", BeatsPerBarPrompt._validateKey);
        this._beatsStepper.addEventListener("blur", BeatsPerBarPrompt._validateNumber);
        this.container.addEventListener("keydown", this._whenKeyPressed);
        this._beatsStepper.addEventListener("input", () => { (this._computedSamplesLabel.firstChild as Text).textContent = this._predictFutureLength(); });
        this._conversionStrategySelect.addEventListener("change", () => { (this._computedSamplesLabel.firstChild as Text).textContent = this._predictFutureLength(); });
        (this._computedSamplesLabel.firstChild as Text).textContent = ExportPrompt.samplesToTime(this._doc, this._doc.synth.getTotalSamples(true, true, 0));
    }

    private _close = (): void => {
        this._doc.undo();
    }

    cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this._beatsStepper.removeEventListener("keypress", BeatsPerBarPrompt._validateKey);
        this._beatsStepper.removeEventListener("blur", BeatsPerBarPrompt._validateNumber);
        this.container.removeEventListener("keydown", this._whenKeyPressed);
    }

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
    }

    private static _validateKey(event: KeyboardEvent): boolean {
        const charCode = (event.which) ? event.which : event.keyCode;
        if (charCode != 46 && charCode > 31 && (charCode < 48 || charCode > 57)) {
            event.preventDefault();
            return true;
        }
        return false;
    }

    private static _validateNumber(event: Event): void {
        const input = <HTMLInputElement>event.target;
        input.value = String(BeatsPerBarPrompt._validate(input));
    }

    private static _validate(input: HTMLInputElement): number {
        return Math.floor(Math.max(Number(input.min), Math.min(Number(input.max), Number(input.value))));
    }

    private _predictFutureLength(): string {
        const futureDoc = new SongDocument();
        futureDoc.synth.song?.fromBase64String(this._doc.synth.song?.toBase64String() ? this._doc.synth.song?.toBase64String() : "");
        new ChangeBeatsPerBar(futureDoc, BeatsPerBarPrompt._validate(this._beatsStepper), this._conversionStrategySelect.value);
        return ExportPrompt.samplesToTime(futureDoc, futureDoc.synth.getTotalSamples(true, true, 0));
    }

    private _saveChanges = (): void => {
        nsLocalStorage_save("beatCountStrategy", this._conversionStrategySelect.value);
        this._doc.prompt = null;
        this._doc.record(new ChangeBeatsPerBar(this._doc, BeatsPerBarPrompt._validate(this._beatsStepper), this._conversionStrategySelect.value), true);
    }
}