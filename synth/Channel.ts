// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Instrument } from "./Instrument";
import { Pattern } from "./Pattern";

export class Channel {
    octave: number = 0;
    readonly instruments: Instrument[] = [];
    readonly patterns: Pattern[] = [];
    readonly bars: number[] = [];
    muted: boolean = false;
    visible: boolean = true;
    name: string = "";
    color: number = 0;
}
