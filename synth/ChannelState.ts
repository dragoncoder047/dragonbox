// Copyright (c) John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

import { InstrumentState } from "./InstrumentState";

export class ChannelState {
    readonly instruments: InstrumentState[] = [];
    muted: boolean = false;
    singleSeamlessInstrument: number | null = null; // Seamless tones from a pattern with a single instrument can be transferred to a different single seamless instrument in the next pattern.
}
