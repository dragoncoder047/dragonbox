import { HTML } from "imperative-html/dist/esm/elements-strict";
import { SongDocument } from "./SongDocument";
import { Prompt } from "./Prompt";
import { nsLocalStorage_get, nsLocalStorage_save } from "./namespaced_localStorage";

const { button, div, h2, select, option } = HTML;

export class ShortenerConfigPrompt implements Prompt {
    private readonly _shortenerStrategySelect = select({ style: "width: 100%;" },
        option({ value: "tinyurl" }, "tinyurl.com"),
        option({ value: "isgd" }, "is.gd"),
        // option({value: "beepboxnet"}, "beepbox.net"),
    );
    private readonly _cancelButton = button({ class: "cancelButton" });
    private readonly _okayButton = button({ class: "okayButton", style: "width:45%;" }, "Okay");

    readonly container = div({ class: "prompt noSelection", style: "width: 250px;" },
        h2("Configure Shortener"),
        div({ style: "display: flex; flex-direction: row; align-items: center; height: 2em; justify-content: flex-end;" },
            div({ class: "selectContainer", style: "width: 100%;" }, this._shortenerStrategySelect),
        ),
        div({ style: "display: flex; flex-direction: row-reverse; justify-content: space-between;" },
            this._okayButton,
        ),
        this._cancelButton,
    );

    constructor(private _doc: SongDocument) {
        const lastStrategy: string | null = nsLocalStorage_get("shortenerStrategySelect");
        if (lastStrategy != null) {
            this._shortenerStrategySelect.value = lastStrategy;
        }

        this._okayButton.addEventListener("click", this._saveChanges);
        this._cancelButton.addEventListener("click", this._close);
        this.container.addEventListener("keydown", this._whenKeyPressed);
    }

    private _close = (): void => {
        this._doc.undo();
    }

    cleanUp = (): void => {
        this._okayButton.removeEventListener("click", this._saveChanges);
        this._cancelButton.removeEventListener("click", this._close);
        this.container.removeEventListener("keydown", this._whenKeyPressed);
    }

    private _whenKeyPressed = (event: KeyboardEvent): void => {
        if ((<Element>event.target).tagName != "BUTTON" && event.keyCode == 13) { // Enter key
            this._saveChanges();
        }
    }

    private _saveChanges = (): void => {
        nsLocalStorage_save("shortenerStrategySelect", this._shortenerStrategySelect.value);
        this._doc.prompt = null;
        this._doc.undo();
    }
}