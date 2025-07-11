// Copyright (c) 2012-2022 John Nesky and contributing authors, distributed under the MIT license, see accompanying the LICENSE.md file.

// Note: All methods are big endian.
export class ArrayBufferReader {
    private _readIndex = 0;
    private _data: DataView;

    constructor(data: DataView) {
        this._data = data;
    }

    getReadIndex(): number {
        return this._readIndex;
    }

    readUint32(): number {
        if (this._readIndex + 4 > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        const result = this._data.getUint32(this._readIndex, false);
        this._readIndex += 4;
        return result;
    }

    readUint24(): number {
        return (this.readUint8() << 16) | (this.readUint8() << 8) | (this.readUint8());
    }

    readUint16(): number {
        if (this._readIndex + 2 > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        const result = this._data.getUint16(this._readIndex, false);
        this._readIndex += 2;
        return result;
    }

    readUint8(): number {
        if (this._readIndex + 1 > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        const result = this._data.getUint8(this._readIndex);
        this._readIndex++;
        return result;
    }

    readInt8(): number {
        if (this._readIndex + 1 > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        const result = this._data.getInt8(this._readIndex);
        this._readIndex++;
        return result;
    }

    peakUint8(): number {
        if (this._readIndex + 1 > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        return this._data.getUint8(this._readIndex);
    }

    readMidi7Bits(): number {
        const result = this.readUint8();
        if (result >= 0x80) console.log("7 bit value contained 8th bit! value " + result + ", index " + this._readIndex);
        return result & 0x7f;
    }

    readMidiVariableLength(): number {
        let result = 0;
        for (let i = 0; i < 4; i++) {
            const nextByte = this.readUint8();
            result += nextByte & 0x7f;
            if (nextByte & 0x80) {
                result = result << 7;
            } else {
                break;
            }
        }
        return result;
    }

    skipBytes(length: number): void {
        this._readIndex += length;
    }

    hasMore(): boolean {
        return this._data.byteLength > this._readIndex;
    }

    getReaderForNextBytes(length: number): ArrayBufferReader {
        if (this._readIndex + length > this._data.byteLength) throw new Error("Reading past the end of the buffer.");
        const result = new ArrayBufferReader(new DataView(this._data.buffer, this._data.byteOffset + this._readIndex, length));
        this.skipBytes(length);
        return result;
    }
}