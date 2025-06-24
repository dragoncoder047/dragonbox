// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { Instrument } from "./Instrument";
import { Pattern } from "./Pattern";

export class Channel {
    octave = 0;
    readonly instruments: Instrument[] = [];
    readonly patterns: Pattern[] = [];
    readonly bars: number[] = [];
    muted = false;
    visible = true;
    name = "";
    color = 0;
}
